import prisma from '../config/db.js';

const cosineSimilarity = (vecA, vecB) => {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const buildRelationships = async (documentId, chunks) => {
  try {
    const documentChunks = await prisma.$queryRaw`
      SELECT 
        id,
        content,
        embedding::text as embedding_text,
        "chunkIndex"
      FROM "Chunk"
      WHERE "documentId" = ${documentId}
      ORDER BY "chunkIndex" ASC
    `;
    
    const chunksWithEmbeddings = documentChunks.map(chunk => {
      const embeddingText = chunk.embedding_text.replace(/[\[\]]/g, '');
      const embedding = embeddingText.split(',').map(Number);
      
      return {
        id: chunk.id,
        content: chunk.content,
        embedding,
        chunkIndex: chunk.chunkIndex,
      };
    });

    const relationshipsToCreate = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < chunksWithEmbeddings.length - 1; i++) {
      relationshipsToCreate.push({
        sourceChunkId: chunksWithEmbeddings[i].id,
        targetChunkId: chunksWithEmbeddings[i + 1].id,
        relationshipType: 'SEQUENTIAL',
        strength: 1.0,
      });
    }

    const SEMANTIC_WINDOW = 50;
    const SIMILARITY_THRESHOLD = 0.7;

    for (let i = 0; i < chunksWithEmbeddings.length; i++) {
      const currentChunk = chunksWithEmbeddings[i];
      const currentEmbedding = currentChunk.embedding;
      
      const endIndex = Math.min(i + SEMANTIC_WINDOW, chunksWithEmbeddings.length);
      
      for (let j = i + 1; j < endIndex; j++) {
        const otherChunk = chunksWithEmbeddings[j];
        const similarity = cosineSimilarity(currentEmbedding, otherChunk.embedding);
        
        if (similarity > SIMILARITY_THRESHOLD) {
          relationshipsToCreate.push({
            sourceChunkId: currentChunk.id,
            targetChunkId: otherChunk.id,
            relationshipType: 'SEMANTIC',
            strength: similarity,
          });
        }
      }
    }

    for (let i = 0; i < relationshipsToCreate.length; i += BATCH_SIZE) {
      const batch = relationshipsToCreate.slice(i, i + BATCH_SIZE);
      await prisma.relationship.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    console.log(`Created ${relationshipsToCreate.length} relationships for document ${documentId}`);
  } catch (error) {
    throw new Error(`Graph relationship building failed: ${error.message}`);
  }
};

export default {
  buildRelationships,
};

