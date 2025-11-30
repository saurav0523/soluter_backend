-- Migration: Add vector indexes for performance optimization
-- Run this after pgvector extension is installed

-- Index for Chunk embeddings (for similarity search)
CREATE INDEX IF NOT EXISTS chunk_embedding_idx 
ON "Chunk" USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for Query embeddings (for finding similar queries)
CREATE INDEX IF NOT EXISTS query_embedding_idx 
ON "Query" USING ivfflat ("questionEmbedding" vector_cosine_ops)
WITH (lists = 100);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS chunk_document_idx ON "Chunk"("documentId");
CREATE INDEX IF NOT EXISTS chunk_index_idx ON "Chunk"("chunkIndex");
CREATE INDEX IF NOT EXISTS relationship_source_idx ON "Relationship"("sourceChunkId");
CREATE INDEX IF NOT EXISTS relationship_target_idx ON "Relationship"("targetChunkId");

-- Composite index for document + chunk index queries
CREATE INDEX IF NOT EXISTS chunk_doc_index_idx ON "Chunk"("documentId", "chunkIndex");

-- Note: For PostgreSQL 15+ with pgvector 0.5+, you can use HNSW instead of IVFFlat:
-- CREATE INDEX chunk_embedding_hnsw_idx ON "Chunk" USING hnsw (embedding vector_cosine_ops);
-- HNSW is faster but uses more memory

