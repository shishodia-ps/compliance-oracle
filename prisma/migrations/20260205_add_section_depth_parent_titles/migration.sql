-- Add section_depth and parent_titles columns to search_chunks
-- These are additive, nullable columns for better scoring and hierarchy tracking

ALTER TABLE "search_chunks" ADD COLUMN "section_depth" INTEGER;
ALTER TABLE "search_chunks" ADD COLUMN "parent_titles" TEXT[] NOT NULL DEFAULT '{}';
