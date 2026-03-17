import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function checkData() {
  try {
    const docs = await db.execute(sql`SELECT id, name, status, processing_stage FROM documents ORDER BY created_at DESC LIMIT 1`);
    
    if (docs.length > 0) {
      const docId = docs[0].id;
      console.log('Doc:', docs[0].name, '| Status:', docs[0].status);
      
      const extractions = await db.execute(sql`SELECT count(*) FROM document_extractions WHERE document_id = ${docId}`);
      console.log('Extractions for latest doc:', extractions[0].count);
      
      const summary = await db.execute(sql`SELECT count(*) FROM document_summaries WHERE document_id = ${docId}`);
      console.log('Summaries for latest doc:', summary[0].count);
      
      const tree = await db.execute(sql`SELECT count(*) FROM pageindex_trees WHERE document_id = ${docId}`);
      console.log('Trees for latest doc:', tree[0].count);

      const chunks = await db.execute(sql`SELECT count(*) FROM search_chunks WHERE document_id = ${docId}`);
      console.log('Search Chunks for latest doc:', chunks[0].count);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
checkData();
