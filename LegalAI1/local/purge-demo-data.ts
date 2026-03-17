import { sql } from 'drizzle-orm';

type CountRow = { count: number | string };

function hasApplyFlag() {
  return process.argv.includes('--apply');
}

async function getDb() {
  if (!process.env.DATABASE_URL) {
    try {
      await import('dotenv/config');
    } catch {
      // In production containers the env is already injected and dotenv may not be traced.
    }
  }

  const { db } = await import('../../lib/db');
  return db;
}

async function getCount(
  db: Awaited<ReturnType<typeof getDb>>,
  query: ReturnType<typeof sql>,
) {
  const rows = await db.execute(query);
  const row = rows[0] as CountRow | undefined;
  return Number(row?.count ?? 0);
}

async function main() {
  const apply = hasApplyFlag();
  const db = await getDb();

  const demoUsers = await getCount(db, sql`
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE email LIKE '%@legalai.demo'
  `);

  const demoOrganizations = await getCount(db, sql`
    SELECT COUNT(DISTINCT om.organization_id)::int AS count
    FROM organization_members om
    JOIN users u ON u.id = om.user_id
    WHERE u.email LIKE '%@legalai.demo'
  `);

  const demoInvoices = await getCount(db, sql`
    SELECT COUNT(*)::int AS count
    FROM invoices
    WHERE organization_id IN (
      SELECT DISTINCT om.organization_id
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.email LIKE '%@legalai.demo'
    )
  `);

  console.log(JSON.stringify({
    apply,
    demoUsers,
    demoOrganizations,
    demoInvoices,
  }, null, 2));

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to purge demo seed data.');
    return;
  }

  await db.execute(sql`
    DO $$
    DECLARE
      demo_user_ids text[];
      demo_org_ids text[];
    BEGIN
      SELECT COALESCE(array_agg(id), ARRAY[]::text[])
      INTO demo_user_ids
      FROM users
      WHERE email LIKE '%@legalai.demo';

      SELECT COALESCE(array_agg(DISTINCT om.organization_id), ARRAY[]::text[])
      INTO demo_org_ids
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.email LIKE '%@legalai.demo';

      IF array_length(demo_org_ids, 1) IS NOT NULL THEN
        DELETE FROM organizations WHERE id = ANY(demo_org_ids);
      END IF;

      IF array_length(demo_user_ids, 1) IS NOT NULL THEN
        DELETE FROM users WHERE id = ANY(demo_user_ids);
      END IF;
    END $$;
  `);

  console.log('\nDemo seed data removed.');
}

main().catch((error) => {
  console.error('Failed to purge demo data:', error);
  process.exit(1);
});
