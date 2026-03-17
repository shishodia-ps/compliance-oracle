import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function fixConstraints() {
  try {
    console.log('Dropping existing index masks (if any)...');
    await db.execute(sql`DROP INDEX IF EXISTS document_extractions_document_id_key;`);
    await db.execute(sql`DROP INDEX IF EXISTS pageindex_trees_document_id_key;`);
    await db.execute(sql`DROP INDEX IF EXISTS document_summaries_document_id_key;`);

    console.log('Adding true UNIQUE constraints...');
    await db.execute(sql`
      ALTER TABLE document_extractions 
      ADD CONSTRAINT document_extractions_document_id_unique UNIQUE (document_id);
    `);
    
    await db.execute(sql`
      ALTER TABLE pageindex_trees 
      ADD CONSTRAINT pageindex_trees_document_id_unique UNIQUE (document_id);
    `);
    
    await db.execute(sql`
      ALTER TABLE document_summaries 
      ADD CONSTRAINT document_summaries_document_id_unique UNIQUE (document_id);
    `);
    
    console.log('Successfully completed!');
  } catch (err) {
    console.error('Error detail:', err);
  } finally {
    process.exit(0);
  }
}
fixConstraints();
