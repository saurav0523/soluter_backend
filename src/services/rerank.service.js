import embedService from './embed.service.js';

const rerankChunks = async (query, chunks, topK = 5) => {
  try {
    if (!chunks || chunks.length === 0) return [];

    const queryEmbeddings = await embedService.generateEmbeddings([query]);
    if (!queryEmbeddings || !queryEmbeddings[0]) return chunks.slice(0, topK);

    const queryEmbedding = queryEmbeddings[0];

    const scoredChunks = chunks.map(chunk => {
      const vectorScore = chunk.score || 0;

      const keywordScore = calculateKeywordOverlap(query, chunk.content);

      const positionScore = chunk.chunkIndex !== null 
        ? Math.max(0, 1 - (chunk.chunkIndex / 1000))
        : 0.5;

      const combinedScore = (
        vectorScore * 0.6 +
        keywordScore * 0.3 +
        positionScore * 0.1
      );

      return {
        ...chunk,
        originalScore: vectorScore,
        keywordScore,
        positionScore,
        finalScore: combinedScore,
      };
    });

    scoredChunks.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    return scoredChunks.slice(0, topK).map(chunk => ({
      ...chunk,
      score: chunk.finalScore,
    }));
  } catch (error) {
    console.error('Re-ranking failed:', error);
    return chunks.slice(0, topK);
  }
};

const calculateKeywordOverlap = (query, content) => {
  if (!query || !content) return 0;

  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'is', 'are', 'was', 'were', 'what', 'how', 'when', 'where', 'why'].includes(word));

  const contentLower = content.toLowerCase();
  
  let matches = 0;
  queryWords.forEach(word => {
    if (contentLower.includes(word)) {
      matches++;
    }
  });

  return queryWords.length > 0 ? matches / queryWords.length : 0;
};

const rerankWithDiversity = async (query, chunks, topK = 5) => {
  try {
    const reranked = await rerankChunks(query, chunks, topK * 2);

    const byDocument = {};
    reranked.forEach(chunk => {
      const docId = chunk.documentName || 'unknown';
      if (!byDocument[docId]) {
        byDocument[docId] = [];
      }
      byDocument[docId].push(chunk);
    });

    const diverse = [];
    const maxPerDocument = Math.ceil(topK / Object.keys(byDocument).length);

    for (const docChunks of Object.values(byDocument)) {
      diverse.push(...docChunks.slice(0, maxPerDocument));
      if (diverse.length >= topK) break;
    }

    return diverse.slice(0, topK);
  } catch (error) {
    console.error('Diversity re-ranking failed:', error);
    return chunks.slice(0, topK);
  }
};

export default {
  rerankChunks,
  rerankWithDiversity,
  calculateKeywordOverlap,
};

