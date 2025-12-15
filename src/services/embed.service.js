import ollama from 'ollama';
import redisCache from './redis-cache.service.js';

const OPTIMAL_BATCH_SIZE = 10;
const MAX_CONCURRENT_REQUESTS = 20;

const normalizeEmbedding = (embedding) => {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    return embedding;
  }

  let normSq = 0;
  for (const v of embedding) {
    const n = Number(v) || 0;
    normSq += n * n;
  }

  if (normSq === 0) {
    return embedding.map(() => 0);
  }

  const norm = Math.sqrt(normSq);
  return embedding.map(v => (Number(v) || 0) / norm);
};

// Generate single embedding using HuggingFace or Ollama
const generateSingleEmbedding = async (text) => {
  const USE_CLOUD_EMBEDDINGS = process.env.USE_CLOUD_EMBEDDINGS === 'true';
  const HF_API_KEY = process.env.HF_API_KEY;
  const HF_EMBEDDING_MODEL = process.env.HF_EMBEDDING_MODEL || 'nomic-ai/nomic-embed-text-v1';
  const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
  const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL;

  if (USE_CLOUD_EMBEDDINGS && HF_API_KEY) {
    // HuggingFace Inference API (Production) - Uses SAME token as LLM
    const response = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_EMBEDDING_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
    }

    const embedding = await response.json();
    
    // HF returns embedding directly as array
    if (Array.isArray(embedding)) {
      return normalizeEmbedding(embedding);
    } else if (embedding.embeddings && Array.isArray(embedding.embeddings[0])) {
      return normalizeEmbedding(embedding.embeddings[0]);
    }
    
    throw new Error('Invalid HuggingFace embedding response format');
  } else {
    // Local Ollama (Development)
    const response = await ollama.embeddings({
      model: OLLAMA_EMBEDDING_MODEL,
      prompt: text,
      options: {
        host: OLLAMA_BASE_URL
      }
    });

    if (!response || !response.embedding) {
      throw new Error('Invalid Ollama embedding response');
    }

    return normalizeEmbedding(response.embedding);
  }
};

const generateEmbeddings = async (chunks) => {
  try {
    if (!chunks || chunks.length === 0) {
      return [];
    }

    // Single chunk - fast path with caching
    if (chunks.length === 1) {
      const cached = await redisCache.getCachedEmbedding(chunks[0]);
      if (cached) {
        return [cached];
      }

      const embedding = await generateSingleEmbedding(chunks[0]);
      await redisCache.cacheEmbedding(chunks[0], embedding);
      return [embedding];
    }

    // Multiple chunks - batch processing with caching
    const embeddings = [];
    const batches = [];
    
    for (let i = 0; i < chunks.length; i += OPTIMAL_BATCH_SIZE) {
      batches.push(chunks.slice(i, i + OPTIMAL_BATCH_SIZE));
    }

    const processBatch = async (batch) => {
      const batchPromises = batch.map(async (chunk) => {
        const cached = await redisCache.getCachedEmbedding(chunk);
        if (cached) {
          return { embedding: cached };
        }

        try {
          const embedding = await generateSingleEmbedding(chunk);
          await redisCache.cacheEmbedding(chunk, embedding);
          return { embedding };
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
