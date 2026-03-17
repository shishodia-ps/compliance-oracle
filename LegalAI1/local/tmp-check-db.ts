import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Checking DB...');
  const orgs = await db.execute(sql`SELECT * FROM organizations`);
  console.log('Organizations:', orgs.length, orgs.map((o: any) => o.id));
  
  const docs = await db.execute(sql`SELECT count(*) as count FROM documents`);
  console.log('Documents count:', docs[0].count);
  
  const users = await db.execute(sql`SELECT id, name, email FROM users`);
  console.log('Users:', users.length, users);

  const memberships = await db.execute(sql`SELECT * FROM organization_members`);
  console.log('Memberships:', memberships.length, memberships);
  
  process.exit(0);
}

run();
