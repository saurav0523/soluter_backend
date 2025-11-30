import ollama from 'ollama';
import { config } from '../config/env.js';
import redisCache from './redis-cache.service.js';

const OLLAMA_BASE_URL = config.ollamaBaseUrl;
const EMBEDDING_MODEL = config.ollamaEmbeddingModel;

// Optimized batch size based on model capacity
const OPTIMAL_BATCH_SIZE = 10;
const MAX_CONCURRENT_REQUESTS = 20;

const generateEmbeddings = async (chunks) => {
  try {
    if (!chunks || chunks.length === 0) {
      return [];
    }

    // Check cache first
    if (chunks.length === 1) {
      const cached = await redisCache.getCachedEmbedding(chunks[0]);
      if (cached) {
        return [cached];
      }

      const response = await ollama.embeddings({
        model: EMBEDDING_MODEL,
        prompt: chunks[0],
        options: {
          host: OLLAMA_BASE_URL
        }
      });

      if (response && response.embedding) {
        await redisCache.cacheEmbedding(chunks[0], response.embedding);
        return [response.embedding];
      } else {
        throw new Error('Invalid embedding response');
      }
    }

    // Parallel processing with optimal batch size and caching
    const embeddings = [];
    const batches = [];
    
    // Create batches
    for (let i = 0; i < chunks.length; i += OPTIMAL_BATCH_SIZE) {
      batches.push(chunks.slice(i, i + OPTIMAL_BATCH_SIZE));
    }

    // Process batches in parallel (with concurrency limit and caching)
    const processBatch = async (batch) => {
      const batchPromises = batch.map(async (chunk) => {
        // Check cache first
        const cached = await redisCache.getCachedEmbedding(chunk);
        if (cached) {
          return { embedding: cached };
        }

        // Generate if not cached
        try {
          const response = await ollama.embeddings({
            model: EMBEDDING_MODEL,
            prompt: chunk,
            options: {
              host: OLLAMA_BASE_URL
            }
          });

          if (response && response.embedding) {
            await redisCache.cacheEmbedding(chunk, response.embedding);
            return response;
          }
          return null;
        } catch (error) {
          console.error(`Embedding generation failed for chunk: ${error.message}`);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      return batchResults
        .filter(response => response && response.embedding)
        .map(response => response.embedding);
    };

    // Process with concurrency control
    for (let i = 0; i < batches.length; i += MAX_CONCURRENT_REQUESTS) {
      const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT_REQUESTS);
      const results = await Promise.all(concurrentBatches.map(processBatch));
      embeddings.push(...results.flat());
    }

    if (embeddings.length !== chunks.length) {
      console.warn(`Warning: Generated ${embeddings.length} embeddings for ${chunks.length} chunks`);
    }

    return embeddings;
  } catch (error) {
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
};

export default {
  generateEmbeddings,
};

