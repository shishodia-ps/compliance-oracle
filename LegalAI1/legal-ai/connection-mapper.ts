#!/usr/bin/env tsx
// ============================================
// LEGAL DOCUMENT CONNECTION MAPPER
// Creates relationships between cases and laws
// ============================================

import { db, closeDb } from '@/lib/db';
import { recognizeLiDOCitations, extractCitationsFromUitspraak } from '@/lib/legal-ai/parsers/lido_mapper';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG = {
  PROGRESS_FILE: path.join(__dirname, 'data', 'connection-progress.json'),
  BATCH_SIZE: 100,
};

interface ConnectionProgress {
  processedNodes: string[];
  connectionsFound: number;
  lastUpdated: string;
}

function loadProgress(): ConnectionProgress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load progress:', error);
  }
  return {
    processedNodes: [],
    connectionsFound: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveProgress(progress: ConnectionProgress) {
  progress.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(CONFIG.PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function mapCaseToLawConnections(progress: ConnectionProgress) {
  console.log('\nMapping Case Law -> Legislation connections...\n');

  const processedFilter = progress.processedNodes.length > 0
    ? sql`AND node_id NOT IN (${sql.join(progress.processedNodes.map((nodeId) => sql`${nodeId}`), sql`, `)})`
    : sql``;

  const nodes = await db.execute(sql<{
    node_id: string;
    content_text: string;
    source_type: string;
  }>`
    SELECT node_id, content_text, source_type
    FROM "legal_nodes"
    WHERE source_type = 'JURISPRUDENTIE'::legal_source_type
    ${processedFilter}
    ORDER BY node_id
    LIMIT ${CONFIG.BATCH_SIZE}
  `);

  if (nodes.length === 0) {
    console.log('  No new case law nodes to process.');
    return;
  }

  console.log(`  Processing ${nodes.length} case law nodes...`);

  for (const node of nodes) {
    const citations = extractCitationsFromUitspraak(node.content_text, node.node_id);
    const lidoCitations = recognizeLiDOCitations(node.content_text, node.node_id);
    const allCitations = [...citations, ...lidoCitations];

    for (const citation of allCitations) {
      try {
        const targetExists = await db.execute(sql<{ exists: boolean }>`
          SELECT EXISTS(
            SELECT 1 FROM "legal_nodes"
            WHERE node_id = ${citation.targetId}
          ) as exists
        `);

        if (targetExists[0]?.exists) {
          await db.execute(sql`
            INSERT INTO "legal_citations" (
              "id", "source_node_id", "target_id", "citation_type", "context", "is_lido", "created_at"
            ) VALUES (
              gen_random_uuid(), ${citation.sourceNodeId}, ${citation.targetId},
              ${citation.citationType}, ${citation.context || null}, ${citation.isLiDO}, NOW()
            )
            ON CONFLICT DO NOTHING
          `);
          progress.connectionsFound++;
        }
      } catch {
        // Best-effort mapper, ignore individual citation failures.
      }
    }

    progress.processedNodes.push(node.node_id);
    saveProgress(progress);
  }

  console.log(`  Processed ${nodes.length} nodes, found ${progress.connectionsFound} total connections`);
}

async function mapLawToLawConnections() {
  console.log('\nMapping Legislation -> Legislation connections...\n');

  const laws = await db.execute(sql<{
    node_id: string;
    content_text: string;
  }>`
    SELECT node_id, content_text
    FROM "legal_nodes"
    WHERE source_type = 'WETGEVING'::legal_source_type
      AND level = 0
    ORDER BY node_id
  `);

  let newConnections = 0;

  for (const law of laws) {
    const matches = law.content_text.match(/BWB\w+/g) || [];

    for (const match of matches) {
      const targetId = `BWB:${match}`;
      if (targetId === law.node_id) {
        continue;
      }

      try {
        await db.execute(sql`
          INSERT INTO "legal_citations" (
            "id", "source_node_id", "target_id", "citation_type", "is_lido", "created_at"
          ) VALUES (
            gen_random_uuid(), ${law.node_id}, ${targetId},
            'verwijzing', false, NOW()
          )
          ON CONFLICT DO NOTHING
        `);
        newConnections++;
      } catch {
        // Ignore duplicate or malformed references.
      }
    }
  }

  console.log(`  Found ${newConnections} law-to-law connections`);
}

async function generateConnectionStats() {
  console.log('\nConnection Statistics:\n');

  const totalResult = await db.execute(sql<{ count: number }>`
    SELECT COUNT(*)::int as count FROM "legal_citations"
  `);
  console.log(`  Total connections: ${totalResult[0]?.count ?? 0}`);

  const typeResult = await db.execute(sql<{ citation_type: string; count: number }>`
    SELECT citation_type, COUNT(*)::int as count
    FROM "legal_citations"
    GROUP BY citation_type
  `);
  console.log('\n  By Type:');
  for (const row of typeResult) {
    console.log(`    ${row.citation_type}: ${row.count}`);
  }

  const lidoResult = await db.execute(sql<{ count: number }>`
    SELECT COUNT(*)::int as count FROM "legal_citations" WHERE is_lido = true
  `);
  console.log(`\n  LiDO connections: ${lidoResult[0]?.count ?? 0}`);

  const mostCited = await db.execute(sql<{ target_id: string; count: number }>`
    SELECT target_id, COUNT(*)::int as count
    FROM "legal_citations"
    GROUP BY target_id
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log('\n  Most Cited Documents:');
  for (const row of mostCited) {
    console.log(`    ${row.target_id}: ${row.count} citations`);
  }
}

async function main() {
  console.log('========================================');
  console.log('LEGAL DOCUMENT CONNECTION MAPPER');
  console.log('========================================');

  const progress = loadProgress();

  console.log(`\nResuming: ${progress.processedNodes.length} nodes already processed`);
  console.log(`Current connections: ${progress.connectionsFound}\n`);

  await mapCaseToLawConnections(progress);
  await mapLawToLawConnections();
  await generateConnectionStats();

  console.log('\n========================================');
  console.log('CONNECTION MAPPING COMPLETE');
  console.log('========================================');

  await closeDb();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('Fatal error:', error);
    await closeDb();
    process.exit(1);
  });
}

export { mapCaseToLawConnections, mapLawToLawConnections };
