-- Fix: Replace B-tree index on text_vector with GIN index
-- The B-tree index fails on large tsvector values (> 2704 bytes)
-- GIN indexes are the correct index type for full-text search tsvector columns

-- Drop the problematic B-tree index (if it exists)
DROP INDEX IF EXISTS "search_chunks_text_vector_idx";

-- Create proper GIN index for tsvector full-text search
-- Using GIN index type allows efficient full-text search without size limitations
CREATE INDEX "search_chunks_text_vector_idx" ON "search_chunks" USING GIN("text_vector");

-- Note: The @@index([textVector]) in schema.prisma should remain as-is.
-- Prisma will generate a default index, but we override it here with raw SQL.
-- This migration ensures the index type is GIN instead of the default B-tree.
