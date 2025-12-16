
CREATE INDEX IF NOT EXISTS chunk_embedding_idx 
ON "Chunk" USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
CREATE INDEX IF NOT EXISTS query_embedding_idx 
ON "Query" USING ivfflat ("questionEmbedding" vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS chunk_document_idx ON "Chunk"("documentId");
CREATE INDEX IF NOT EXISTS chunk_index_idx ON "Chunk"("chunkIndex");
CREATE INDEX IF NOT EXISTS relationship_source_idx ON "Relationship"("sourceChunkId");
CREATE INDEX IF NOT EXISTS relationship_target_idx ON "Relationship"("targetChunkId");
CREATE INDEX IF NOT EXISTS chunk_doc_index_idx ON "Chunk"("documentId", "chunkIndex");
CREATE INDEX chunk_embedding_hnsw_idx ON "Chunk" USING hnsw (embedding vector_cosine_ops);
