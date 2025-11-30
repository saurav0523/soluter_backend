-- Migration: Add Learning System Tables
-- Run this migration to add Query, QueryAnswer, and Feedback tables

-- Create Query table
CREATE TABLE IF NOT EXISTS "Query" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionEmbedding" vector(768) NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- Create QueryAnswer table
CREATE TABLE IF NOT EXISTS "QueryAnswer" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "contextChunks" TEXT[] NOT NULL DEFAULT '{}',
    "qualityScore" DOUBLE PRECISION,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryAnswer_pkey" PRIMARY KEY ("id")
);

-- Create Feedback table
CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "answerId" TEXT,
    "rating" INTEGER NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "correction" TEXT,
    "userNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "Query_documentId_idx" ON "Query"("documentId");
CREATE INDEX IF NOT EXISTS "QueryAnswer_queryId_idx" ON "QueryAnswer"("queryId");
CREATE INDEX IF NOT EXISTS "QueryAnswer_qualityScore_idx" ON "QueryAnswer"("qualityScore");
CREATE INDEX IF NOT EXISTS "Feedback_queryId_idx" ON "Feedback"("queryId");
CREATE INDEX IF NOT EXISTS "Feedback_answerId_idx" ON "Feedback"("answerId");
CREATE INDEX IF NOT EXISTS "Feedback_isHelpful_idx" ON "Feedback"("isHelpful");

-- Add foreign key constraints
ALTER TABLE "Query" ADD CONSTRAINT "Query_documentId_fkey" 
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QueryAnswer" ADD CONSTRAINT "QueryAnswer_queryId_fkey" 
    FOREIGN KEY ("queryId") REFERENCES "Query"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_queryId_fkey" 
    FOREIGN KEY ("queryId") REFERENCES "Query"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_answerId_fkey" 
    FOREIGN KEY ("answerId") REFERENCES "QueryAnswer"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index on questionEmbedding for similarity search (using pgvector)
CREATE INDEX IF NOT EXISTS "Query_questionEmbedding_idx" 
    ON "Query" USING ivfflat ("questionEmbedding" vector_cosine_ops)
    WITH (lists = 100);

