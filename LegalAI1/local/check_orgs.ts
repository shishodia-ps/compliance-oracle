import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function checkOrgMapping() {
  try {
    const docs = await db.execute(sql`SELECT id, name, organization_id FROM documents ORDER BY created_at DESC LIMIT 1`);
    console.log('Latest Document:', docs[0]);

    const orgs = await db.execute(sql`SELECT id, name FROM organizations LIMIT 3`);
    console.log('Organizations:', orgs);

    const users = await db.execute(sql`SELECT id, email FROM users LIMIT 3`);
    console.log('Users:', users);

    const members = await db.execute(sql`SELECT * FROM organization_members LIMIT 3`);
    console.log('Organization Members:', members);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
checkOrgMapping();
