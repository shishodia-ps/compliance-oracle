import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Setting up pgvector extension...");
  
  try {
    // Standard initialization for pgvector
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("Vector extension created.");
    
    // We assume OpenAI's text-embedding-3-small which is 1536 dimensions
    console.log("Altering columns to vector(1536)...");
    
    // Convert search_chunks.embedding
    await db.execute(sql`
      ALTER TABLE search_chunks 
      ALTER COLUMN embedding 
      TYPE vector(1536) 
      USING CASE WHEN array_length(embedding, 1) = 1536 
                 THEN embedding::vector 
                 ELSE NULL END;
    `);
    
    // Convert legal_graph_clusters.embedding (just in case)
    await db.execute(sql`
      ALTER TABLE legal_graph_clusters 
      ALTER COLUMN embedding 
      TYPE vector(1536) 
      USING CASE WHEN array_length(embedding, 1) = 1536 
                 THEN embedding::vector 
                 ELSE NULL END;
    `);

    // Create HNSW indexes for fast cosine similarity search
    console.log("Creating HNSW indexes for cosine distance...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS search_chunks_embedding_idx 
      ON search_chunks 
      USING hnsw (embedding vector_cosine_ops);
    `);
    
    console.log("Setup complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error setting up pgvector:", err);
    process.exit(1);
  }
}

main();
