import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function migrateConstraints() {
  try {
    console.log('Adding UNIQUE constraint to document_extractions...');
    await db.execute(sql`
      ALTER TABLE document_extractions 
      ADD CONSTRAINT document_extractions_document_id_key UNIQUE (document_id);
    `);
    console.log('Success.');

    console.log('Adding UNIQUE constraint to pageindex_trees...');
    await db.execute(sql`
      ALTER TABLE pageindex_trees 
      ADD CONSTRAINT pageindex_trees_document_id_key UNIQUE (document_id);
    `);
    console.log('Success.');

    console.log('Adding UNIQUE constraint to document_summaries...');
    await db.execute(sql`
      ALTER TABLE document_summaries 
      ADD CONSTRAINT document_summaries_document_id_key UNIQUE (document_id);
    `);
    console.log('Success.');

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}
migrateConstraints();
