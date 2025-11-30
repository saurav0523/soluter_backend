// Redis-based cache service replacing in-memory cache
import redis from '../config/redis.js';
import { hashQuestion } from '../config/redis.js';

// Cache TTL constants
const CACHE_TTL_QUERY = 1800; // 30 minutes in seconds
const CACHE_TTL_EMBEDDING = 86400; // 24 hours in seconds
const CACHE_TTL_ANSWER = 3600; // 1 hour for learned answers
const CACHE_TTL_RESPONSE = 7200; // 2 hours for complete responses
const SIMILARITY_THRESHOLD = 0.85; // 85% similarity to use cached response

/**
 * Cache query results
 */
export const cacheQuery = async (question, documentId, result) => {
  try {
    const key = `query:${hashQuestion(question)}:${documentId || 'global'}`;
    await redis.setex(key, CACHE_TTL_QUERY, JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('Redis cache query error:', error);
    return false;
  }
};

export const getCachedQuery = async (question, documentId) => {
  try {
    const key = `query:${hashQuestion(question)}:${documentId || 'global'}`;
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Redis get cached query error:', error);
    return null;
  }
};

/**
 * Cache embeddings
 */
export const cacheEmbedding = async (text, embedding) => {
  try {
    const key = `embedding:${hashQuestion(text)}`;
    await redis.setex(key, CACHE_TTL_EMBEDDING, JSON.stringify(embedding));
    return true;
  } catch (error) {
    console.error('Redis cache embedding error:', error);
    return false;
  }
};

export const getCachedEmbedding = async (text) => {
  try {
    const key = `embedding:${hashQuestion(text)}`;
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Redis get cached embedding error:', error);
    return null;
  }
};

/**
 * Cache learned answers (high-quality query-answer pairs)
 */
export const cacheLearnedAnswer = async (question, answer, answerId, qualityScore, documentId = null) => {
  try {
    const key = `kb:answer:${hashQuestion(question)}`;
    const value = {
      answer,
      answerId,
      qualityScore,
      documentId,
      updatedAt: Date.now(),
    };
    await redis.setex(key, CACHE_TTL_ANSWER, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis cache learned answer error:', error);
    return false;
  }
};

export const getCachedLearnedAnswer = async (question) => {
  try {
    const key = `kb:answer:${hashQuestion(question)}`;
    const cached = await redis.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      // Only return if quality score is good
      if (data.qualityScore >= 0.6) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Redis get cached learned answer error:', error);
    return null;
  }
};

/**
 * Invalidate cache for a question (when answer is updated)
 */
export const invalidateQuestionCache = async (question, documentId = null) => {
  try {
    const keys = [
      `query:${hashQuestion(question)}:${documentId || 'global'}`,
      `kb:answer:${hashQuestion(question)}`,
    ];
    await redis.del(...keys);
    return true;
  } catch (error) {
    console.error('Redis invalidate cache error:', error);
    return false;
  }
};

/**
 * Cache complete response (question + answer + metadata)
 * Stores with embedding for similarity lookup
 */
export const cacheResponse = async (question, questionEmbedding, response, documentId = null) => {
  try {
    const questionHash = hashQuestion(question);
    const key = `response:${questionHash}:${documentId || 'global'}`;
    
    const value = {
      question,
      questionEmbedding, // Store embedding for similarity search
      response,
      documentId,
      cachedAt: Date.now(),
    };
    
    await redis.setex(key, CACHE_TTL_RESPONSE, JSON.stringify(value));
    
    // Also store in similarity index (sorted set by documentId)
    if (documentId) {
      const similarityKey = `response:similarity:${documentId}`;
      // Store question hash with timestamp for cleanup
      await redis.zadd(similarityKey, Date.now(), questionHash);
      await redis.expire(similarityKey, CACHE_TTL_RESPONSE);
    }
    
    return true;
  } catch (error) {
    console.error('Redis cache response error:', error);
    return false;
  }
};

/**
 * Find similar cached response using embedding similarity
 * Returns cached response if similarity >= threshold
 * Optimized: Only checks top N cached responses
 */
export const findSimilarCachedResponse = async (questionEmbedding, documentId = null, threshold = SIMILARITY_THRESHOLD) => {
  try {
    // First, try to find in database (faster for large cache)
    // This will be handled by learningService.findSimilarQueries which checks DB first
    
    // Then check Redis cache (limit to recent 50 responses for performance)
    const pattern = documentId ? `response:*:${documentId}` : 'response:*:global';
    const allKeys = await redis.keys(pattern);
    
    if (allKeys.length === 0) return null;
    
    // Limit to most recent 50 responses to avoid performance issues
    const keysToCheck = allKeys.slice(0, 50);
    
    // Calculate cosine similarity with cached responses
    let bestMatch = null;
    let bestSimilarity = 0;
    
    // Process in batches for better performance
    const batchSize = 10;
    for (let i = 0; i < keysToCheck.length; i += batchSize) {
      const batch = keysToCheck.slice(i, i + batchSize);
      const cachedData = await Promise.all(
        batch.map(key => redis.get(key).catch(() => null))
      );
      
      for (let j = 0; j < cachedData.length; j++) {
        if (!cachedData[j]) continue;
        
        try {
          const data = JSON.parse(cachedData[j]);
          if (!data.questionEmbedding) continue;
          
          // Calculate cosine similarity
          const similarity = cosineSimilarity(questionEmbedding, data.questionEmbedding);
          
          if (similarity >= threshold && similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = {
              ...data.response,
              similarity,
              cachedQuestion: data.question,
            };
          }
        } catch (error) {
          // Skip invalid cache entries
          continue;
        }
      }
      
      // Early exit if we found a very good match
      if (bestSimilarity >= 0.95) break;
    }
    
    return bestMatch;
  } catch (error) {
    console.error('Redis find similar cached response error:', error);
    return null;
  }
};

/**
 * Cosine similarity calculation
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Clear all caches (use with caution)
 */
export const clearAllCaches = async () => {
  try {
    const keys = await redis.keys('query:*');
    const embeddingKeys = await redis.keys('embedding:*');
    const answerKeys = await redis.keys('kb:answer:*');
    const responseKeys = await redis.keys('response:*');
    const similarityKeys = await redis.keys('response:similarity:*');
    
    if (keys.length > 0) await redis.del(...keys);
    if (embeddingKeys.length > 0) await redis.del(...embeddingKeys);
    if (answerKeys.length > 0) await redis.del(...answerKeys);
    if (responseKeys.length > 0) await redis.del(...responseKeys);
    if (similarityKeys.length > 0) await redis.del(...similarityKeys);
    
    return true;
  } catch (error) {
    console.error('Redis clear all caches error:', error);
    return false;
  }
};

export default {
  cacheQuery,
  getCachedQuery,
  cacheEmbedding,
  getCachedEmbedding,
  cacheLearnedAnswer,
  getCachedLearnedAnswer,
  cacheResponse,
  findSimilarCachedResponse,
  invalidateQuestionCache,
  clearAllCaches,
};

