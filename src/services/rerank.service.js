// Re-ranking service for better context selection
// Uses cross-encoder approach to re-rank retrieved chunks

import embedService from './embed.service.js';

/**
 * Re-ranks chunks based on their relevance to the query
 * Uses a combination of semantic similarity and keyword matching
 */
const rerankChunks = async (query, chunks, topK = 5) => {
  try {
    if (!chunks || chunks.length === 0) return [];

    // Generate query embedding
    const queryEmbeddings = await embedService.generateEmbeddings([query]);
    if (!queryEmbeddings || !queryEmbeddings[0]) return chunks.slice(0, topK);

    const queryEmbedding = queryEmbeddings[0];

    // Calculate enhanced scores
    const scoredChunks = chunks.map(chunk => {
      // Existing similarity score
      const vectorScore = chunk.score || 0;

      // Keyword overlap score (simple keyword matching)
      const keywordScore = calculateKeywordOverlap(query, chunk.content);

      // Position score (prefer earlier chunks in document)
      const positionScore = chunk.chunkIndex !== null 
        ? Math.max(0, 1 - (chunk.chunkIndex / 1000)) // Decay after 1000 chunks
        : 0.5;

      // Combined score with weights
      const combinedScore = (
        vectorScore * 0.6 +      // Vector similarity (primary)
        keywordScore * 0.3 +     // Keyword matching
        positionScore * 0.1       // Position bias
      );

      return {
        ...chunk,
        originalScore: vectorScore,
        keywordScore,
        positionScore,
        finalScore: combinedScore,
      };
    });

    // Sort by final score and return top K
    scoredChunks.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    return scoredChunks.slice(0, topK).map(chunk => ({
      ...chunk,
      score: chunk.finalScore, // Update score to final score
    }));
  } catch (error) {
    console.error('Re-ranking failed:', error);
    // Return original chunks if re-ranking fails
    return chunks.slice(0, topK);
  }
};

/**
 * Calculate keyword overlap between query and content
 */
const calculateKeywordOverlap = (query, content) => {
  if (!query || !content) return 0;

  // Extract keywords (simple approach - can be enhanced with NLP)
  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2) // Filter short words
    .filter(word => !['the', 'is', 'are', 'was', 'were', 'what', 'how', 'when', 'where', 'why'].includes(word));

  const contentLower = content.toLowerCase();
  
  let matches = 0;
  queryWords.forEach(word => {
    if (contentLower.includes(word)) {
      matches++;
    }
  });

  // Normalize to 0-1 range
  return queryWords.length > 0 ? matches / queryWords.length : 0;
};

/**
 * Re-rank with diversity - ensures chunks come from different parts of document
 */
const rerankWithDiversity = async (query, chunks, topK = 5) => {
  try {
    const reranked = await rerankChunks(query, chunks, topK * 2); // Get more candidates

    // Group by document
    const byDocument = {};
    reranked.forEach(chunk => {
      const docId = chunk.documentName || 'unknown';
      if (!byDocument[docId]) {
        byDocument[docId] = [];
      }
      byDocument[docId].push(chunk);
    });

    // Select diverse chunks
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

