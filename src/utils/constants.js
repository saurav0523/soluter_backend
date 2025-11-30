// Chunking configuration
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;

// RAG configuration
export const MAX_CONTEXT_CHUNKS = 10;
export const MIN_CONTEXT_CHUNKS = 3;
export const SIMILARITY_THRESHOLD = 0.6;

// Performance optimization constants
export const EMBEDDING_BATCH_SIZE = 10;
export const MAX_CONCURRENT_EMBEDDINGS = 20;
export const CHUNK_INSERT_BATCH_SIZE = 50;
export const GRAPH_SEMANTIC_WINDOW = 50; // Only check chunks within this window for semantic similarity
export const GRAPH_RELATIONSHIP_BATCH_SIZE = 100;

// Cache configuration
export const CACHE_MAX_SIZE = 1000;
export const CACHE_TTL_QUERY = 1800000; // 30 minutes for query results
export const CACHE_TTL_EMBEDDING = 86400000; // 24 hours for embeddings

// Re-ranking configuration
export const USE_RERANKING = true;
export const RERANK_TOP_K = 5;

// OCR configuration
export const OCR_WORKER_POOL_SIZE = 2;

// File upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

