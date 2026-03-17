import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function checkDuplicates() {
  try {
    console.log('Checking duplicates in document_extractions...');
    const extractions = await db.execute(sql`
      SELECT document_id, COUNT(*) 
      FROM document_extractions 
      GROUP BY document_id 
      HAVING COUNT(*) > 1;
    `);
    console.log(extractions);

    console.log('Checking duplicates in pageindex_trees...');
    const trees = await db.execute(sql`
      SELECT document_id, COUNT(*) 
      FROM pageindex_trees 
      GROUP BY document_id 
      HAVING COUNT(*) > 1;
    `);
    console.log(trees);

    console.log('Checking duplicates in document_summaries...');
    const summaries = await db.execute(sql`
      SELECT document_id, COUNT(*) 
      FROM document_summaries 
      GROUP BY document_id 
      HAVING COUNT(*) > 1;
    `);
    console.log(summaries);

    // Get any actual errors from the ALTER TABLE statement
    console.log('Trying ALTER TABLE document_extractions...');
    await db.execute(sql`ALTER TABLE document_extractions ADD CONSTRAINT document_extractions_document_id_key UNIQUE (document_id);`);

  } catch (err) {
    console.error('Error detail:', err);
  } finally {
    process.exit(0);
  }
}
checkDuplicates();
