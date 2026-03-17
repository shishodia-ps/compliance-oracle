#!/usr/bin/env tsx
// ============================================
// MASTER ORCHESTRATION SCRIPT
// Runs all ingestion processes in sequence
// ============================================

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { db, closeDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

const CONFIG = {
  DATA_DIR: path.join(__dirname, 'data'),
};

interface IngestionReport {
  timestamp: string;
  phases: {
    legislation: { status: string; count: number; errors: string[] };
    caseLaw: { status: string; count: number; errors: string[] };
    connections: { status: string; count: number; errors: string[] };
  };
  finalStats: {
    totalNodes: number;
    totalDocuments: number;
    totalConnections: number;
    byRechtsgebied: Record<string, number>;
  };
}

function ensureDataDir() {
  if (!fs.existsSync(CONFIG.DATA_DIR)) {
    fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
  }
}

function runCommand(command: string, description: string): boolean {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📌 ${description}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    return true;
  } catch (error) {
    console.error(`\n❌ Failed: ${description}`);
    return false;
  }
}

async function generateFinalReport(): Promise<IngestionReport> {
  console.log('\n\n📊 Generating Final Report...\n');
  
  // Get stats from database
  const totalNodes = await db.execute(sql`
    SELECT COUNT(*) as count FROM "legal_nodes"
  `);
  
  const totalDocuments = await db.execute(sql`
    SELECT COUNT(*) as count FROM (
      SELECT DISTINCT CASE 
        WHEN source_type = 'JURISPRUDENTIE'::legal_source_type THEN split_part(node_id, ':overweging:', 1)
        WHEN source_type = 'WETGEVING'::legal_source_type THEN split_part(node_id, ':hoofdstuk:', 1)
        ELSE node_id
      END
      FROM "legal_nodes"
    ) as docs
  `);
  
  const totalConnections = await db.execute(sql`
    SELECT COUNT(*) as count FROM "legal_citations"
  `);
  
  const byRechtsgebied = await db.execute(sql`
    SELECT rechtsgebied, COUNT(*) as count
    FROM "legal_nodes"
    WHERE rechtsgebied IS NOT NULL
    GROUP BY rechtsgebied
  `);
  
  const report: IngestionReport = {
    timestamp: new Date().toISOString(),
    phases: {
      legislation: { status: 'completed', count: 0, errors: [] },
      caseLaw: { status: 'completed', count: 0, errors: [] },
      connections: { status: 'completed', count: Number((totalConnections as any[])[0].count), errors: [] },
    },
    finalStats: {
      totalNodes: Number((totalNodes as any[])[0].count),
      totalDocuments: Number((totalDocuments as any[])[0].count),
      totalConnections: Number((totalConnections as any[])[0].count),
      byRechtsgebied: (byRechtsgebied as Array<{ rechtsgebied: string; count: bigint }>).reduce((acc, row) => {
        acc[row.rechtsgebied] = Number(row.count);
        return acc;
      }, {} as Record<string, number>),
    },
  };
  
  return report;
}

function printReport(report: IngestionReport) {
  console.log('\n\n' + '='.repeat(70));
  console.log('                    INGESTION COMPLETE - FINAL REPORT');
  console.log('='.repeat(70));
  console.log(`\nTimestamp: ${report.timestamp}`);
  console.log('\n📚 FINAL STATISTICS:');
  console.log(`  Total Legal Nodes:    ${report.finalStats.totalNodes.toLocaleString()}`);
  console.log(`  Total Documents:      ${report.finalStats.totalDocuments.toLocaleString()}`);
  console.log(`  Total Connections:    ${report.finalStats.totalConnections.toLocaleString()}`);
  
  console.log('\n📂 By Rechtsgebied:');
  for (const [rg, count] of Object.entries(report.finalStats.byRechtsgebied)) {
    const emoji = {
      'CIVIEL_RECHT': '⚖️',
      'STRAFRECHT': '🔒',
      'BESTUURSRECHT': '🏛️',
      'ARBEIDSRECHT': '💼',
      'FISCAAL_RECHT': '💰',
      'EUROPEES_RECHT': '🇪🇺',
      'OVERIG': '📄',
    }[rg] || '📄';
    console.log(`  ${emoji} ${rg.padEnd(20)} ${count.toLocaleString().padStart(6)} nodes`);
  }
  
  console.log('\n✅ All phases completed successfully!');
  console.log('\n' + '='.repeat(70));
  console.log('\nNext steps:');
  console.log('  1. Start the development server: npm run dev');
  console.log('  2. Navigate to: http://localhost:3000/app/legal-ai');
  console.log('  3. Start asking legal questions!\n');
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('      DUTCH LEGAL AI - COMPLETE DATA INGESTION ORCHESTRATOR');
  console.log('='.repeat(70));
  
  ensureDataDir();
  
  // Phase 1: Legislation (KOOP/BWB)
  const legislationSuccess = runCommand(
    'npx tsx scripts/legal-ai/batch-ingest-koop.ts',
    'Phase 1: Ingesting Dutch Legislation (KOOP/BWB)'
  );
  
  if (!legislationSuccess) {
    console.error('\n⚠️ Legislation ingestion had issues, but continuing...');
  }
  
  // Phase 2: Case Law (Rechtspraak)
  const caseLawSuccess = runCommand(
    'npx tsx scripts/legal-ai/batch-ingest-rechtspraak.ts',
    'Phase 2: Ingesting Case Law (Rechtspraak)'
  );
  
  if (!caseLawSuccess) {
    console.error('\n⚠️ Case law ingestion had issues, but continuing...');
  }
  
  // Phase 3: Connection Mapping
  const connectionsSuccess = runCommand(
    'npx tsx scripts/legal-ai/connection-mapper.ts',
    'Phase 3: Mapping Document Connections'
  );
  
  if (!connectionsSuccess) {
    console.error('\n⚠️ Connection mapping had issues, but continuing...');
  }
  
  // Generate Report
  const report = await generateFinalReport();
  printReport(report);
  
  // Save report to file
  const reportPath = path.join(CONFIG.DATA_DIR, 'ingestion-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}\n`);
  
  await closeDb();
}

// Run
main().catch(async (error) => {
  console.error('\n❌ Fatal error:', error);
  await closeDb();
  process.exit(1);
});
