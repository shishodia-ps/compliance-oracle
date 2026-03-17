import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function checkData() {
  try {
    const res = await db.execute(sql`
        SELECT conname, contype, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        JOIN pg_namespace n ON n.oid = c.connamespace 
        WHERE conrelid = 'document_extractions'::regclass;
    `);
    console.log('document_extractions Constraints:', res);

    const res2 = await db.execute(sql`
        SELECT conname, contype, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        JOIN pg_namespace n ON n.oid = c.connamespace 
        WHERE conrelid = 'pageindex_trees'::regclass;
    `);
    console.log('pageindex_trees Constraints:', res2);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
checkData();
