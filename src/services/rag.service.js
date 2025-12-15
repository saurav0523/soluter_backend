import prisma from '../config/db.js';
import embedService from './embed.service.js';
import rerankService from './rerank.service.js';
import redisCache from './redis-cache.service.js';
import {
  MAX_CONTEXT_CHUNKS,
  MIN_CONTEXT_CHUNKS,
  SIMILARITY_THRESHOLD,
} from '../utils/constants.js';

const formatEmbeddingForPG = (emb) => {
  return `[${emb.map(n => {
    if (!isFinite(n)) return '0.0';
    return Number(n).toString();
  }).join(',')}]`;
};

const expandNeighbors = async (chunkIds) => {
  if (!chunkIds || chunkIds.length === 0) return [];

  const chunkIdsArray = Array.isArray(chunkIds) ? chunkIds : [chunkIds];
  
  if (chunkIdsArray.length === 0) return [];
  
  const arrayLiteral = `{${chunkIdsArray.map(id => `"${id.replace(/"/g, '""')}"`).join(',')}}`;
  const relations = await prisma.$queryRawUnsafe(
    `SELECT r.id AS rel_id, r."sourceChunkId", r."targetChunkId", r."relationshipType",
            src.content AS source_content, src."chunkIndex" AS source_chunkIndex, src."documentId" AS source_documentId,
            tgt.content AS target_content, tgt."chunkIndex" AS target_chunkIndex, tgt."documentId" AS target_documentId,
            dsrc."fileName" AS source_documentName, dtgt."fileName" AS target_documentName
     FROM "Relationship" r
     LEFT JOIN "Chunk" src ON r."sourceChunkId" = src.id
     LEFT JOIN "Chunk" tgt ON r."targetChunkId" = tgt.id
     LEFT JOIN "Document" dsrc ON src."documentId" = dsrc.id
     LEFT JOIN "Document" dtgt ON tgt."documentId" = dtgt.id
     WHERE r."sourceChunkId" = ANY($1::text[]) OR r."targetChunkId" = ANY($1::text[])`,
    arrayLiteral
  );

  const neighbors = [];

  for (const row of relations) {
    if (row.target_content && row.targetChunkId && !chunkIds.includes(row.targetChunkId)) {
      neighbors.push({
        id: row.targetChunkId,
        content: row.target_content,
        chunkIndex: row.target_chunkIndex,
        documentName: row.target_documentName || null,
        relationType: row.relationshipType || null,
      });
    }
    if (row.source_content && row.sourceChunkId && !chunkIds.includes(row.sourceChunkId)) {
      neighbors.push({
        id: row.sourceChunkId,
        content: row.source_content,
        chunkIndex: row.source_chunkIndex,
        documentName: row.source_documentName || null,
        relationType: row.relationshipType || null,
      });
    }
  }

  const uniq = new Map();
  for (const n of neighbors) {
    if (!uniq.has(n.id)) uniq.set(n.id, n);
  }

  return Array.from(uniq.values());
};

const cosineSimFromArrays = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const va = Number(a[i]) || 0;
    const vb = Number(b[i]) || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }

  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

const retrieveContext = async (question, documentId = null, options = {}) => {
  try {
    // Check cache first
    const cached = await redisCache.getCachedQuery(question, documentId);
    if (cached) {
      return cached;
    }

    const topK = options.topK ?? MAX_CONTEXT_CHUNKS;
    const expandNeighborsCount = options.expandNeighborsCount ?? 5;
    const vectorDim = options.vectorDim ?? 768;
    const useReranking = options.useReranking ?? true;

    // Use provided embedding if available (for parallel operations), otherwise generate
    let qEmb;
    if (options.questionEmbedding) {
      qEmb = options.questionEmbedding;
    } else {
      const qEmbArray = await embedService.generateEmbeddings([question]);
      if (!qEmbArray || !qEmbArray[0]) throw new Error('Embedding generation failed');
      qEmb = qEmbArray[0];
    }

    const qVector = formatEmbeddingForPG(qEmb);

    let sql;
    let params;

    if (documentId) {
      sql = `
        SELECT c.id, c.content, c."chunkIndex", d."fileName" as "documentName",
               1 - (c.embedding <=> $1::vector(${vectorDim})) AS similarity
        FROM "Chunk" c
        JOIN "Document" d ON c."documentId" = d.id
        WHERE c."documentId" = $2
        ORDER BY c.embedding <-> $1::vector(${vectorDim})
        LIMIT ${topK}
      `;
      params = [qVector, documentId];
    } else {
      sql = `
        SELECT c.id, c.content, c."chunkIndex", d."fileName" as "documentName",
               1 - (c.embedding <=> $1::vector(${vectorDim})) AS similarity
        FROM "Chunk" c
        JOIN "Document" d ON c."documentId" = d.id
        ORDER BY c.embedding <-> $1::vector(${vectorDim})
        LIMIT ${topK}
      `;
      params = [qVector];
    }

    const results = await prisma.$queryRawUnsafe(sql, ...params);

    if (!results || results.length === 0) {
      return [];
    }

    const topChunks = results.map(r => ({
      id: r.id,
      content: String(r.content || '').trim(),
      score: Number(r.similarity ?? 0),
      documentName: r.documentName || null,
      chunkIndex: r.chunkIndex ?? null,
    }));

    const chunkIds = topChunks.map(c => c.id);
    const neighborChunks = await expandNeighbors(chunkIds);

    let neighborWithScores = [];

    if (neighborChunks.length > 0) {
      const neighborsToEval = neighborChunks.slice(0, expandNeighborsCount);
      const neighborTexts = neighborsToEval.map(n => n.content);

      const neighborEmbArray = await embedService.generateEmbeddings(neighborTexts);

      for (let i = 0; i < neighborsToEval.length; i++) {
        const n = neighborsToEval[i];
        const nEmb = neighborEmbArray[i];

        const sim = cosineSimFromArrays(qEmb, nEmb);

        neighborWithScores.push({
          id: n.id,
          content: String(n.content || '').trim(),
          score: sim,
          documentName: n.documentName || null,
          chunkIndex: n.chunkIndex ?? null,
        });
      }
    }

    const mergedMap = new Map();

    for (const c of topChunks) {
      mergedMap.set(c.id, c);
    }

    for (const n of neighborWithScores) {
      if (mergedMap.has(n.id)) {
        const existing = mergedMap.get(n.id);
        if ((n.score || 0) > (existing.score || 0)) mergedMap.set(n.id, n);
      } else {
        mergedMap.set(n.id, n);
      }
    }

    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) => (b.score || 0) - (a.score || 0));

    const topScore = merged[0]?.score ?? 0;
    // Push quality up: use global similarity threshold + adaptive factor
    const adaptiveThreshold = Math.max(SIMILARITY_THRESHOLD, topScore * 0.6);

    let finalChunks = merged
      .filter(c => (c.score ?? 0) >= adaptiveThreshold)
      .slice(0, MAX_CONTEXT_CHUNKS);

    if (finalChunks.length < MIN_CONTEXT_CHUNKS) {
      finalChunks = merged.slice(0, Math.min(MIN_CONTEXT_CHUNKS, merged.length));
    }

    // Apply re-ranking for better context selection
    if (useReranking && finalChunks.length > topK) {
      finalChunks = await rerankService.rerankChunks(question, finalChunks, topK);
    } else {
      finalChunks = finalChunks.slice(0, topK);
    }

    // Cache the result
    await redisCache.cacheQuery(question, documentId, finalChunks);

    return finalChunks;
  } catch (err) {
    throw new Error(`RAG retrieval failed: ${err.message}`);
  }
};

export default {
  retrieveContext,
  formatEmbeddingForPG,
};
