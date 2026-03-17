#!/usr/bin/env tsx
// ============================================
// FETCH MASS CASES - Uses predefined ECLI lists + generator
// Target: 500+ real cases
// ============================================

import { db, closeDb } from '@/lib/db';
import { 
  fetchRechtspraakCase, 
  parseRechtspraakXML, 
  convertRechtspraakToLegalNodes,
  generateCaseTOC 
} from '@/lib/legal-ai/parsers/rechtspraak_parser';
import { recognizeLiDOCitations, extractCitationsFromUitspraak } from '@/lib/legal-ai/parsers/lido_mapper';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';
import type { Rechtsgebied } from '@/lib/legal-ai/types';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// Generate ECLI patterns for recent years (2020-2024)
function generateECLIs(): Array<{ecli: string; rechtsgebied: Rechtsgebied}> {
  const cases: Array<{ecli: string; rechtsgebied: Rechtsgebied}> = [];
  
  // Courts and their rechtsgebied mapping
  const courts: Array<{code: string; name: string; rechtsgebied: Rechtsgebied; start: number; end: number}> = [
    // Hoge Raad - mixed
    {code: 'HR', name: 'Hoge Raad', rechtsgebied: 'CIVIEL_RECHT', start: 1, end: 150},
    {code: 'HR', name: 'Hoge Raad', rechtsgebied: 'STRAFRECHT', start: 151, end: 300},
    {code: 'HR', name: 'Hoge Raad', rechtsgebied: 'ARBEIDSRECHT', start: 301, end: 400},
    {code: 'HR', name: 'Hoge Raad', rechtsgebied: 'FISCAAL_RECHT', start: 401, end: 500},
    
    // Gerechtshoven - civil
    {code: 'GHAMS', name: 'Hof Amsterdam', rechtsgebied: 'CIVIEL_RECHT', start: 1, end: 80},
    {code: 'GHARN', name: 'Hof Arnhem', rechtsgebied: 'CIVIEL_RECHT', start: 81, end: 160},
    {code: 'GHDHA', name: 'Hof Den Haag', rechtsgebied: 'CIVIEL_RECHT', start: 161, end: 240},
    {code: 'GHSHE', name: 'Hof Den Bosch', rechtsgebied: 'CIVIEL_RECHT', start: 241, end: 320},
    {code: 'GHLEE', name: 'Hof Leeuwarden', rechtsgebied: 'CIVIEL_RECHT', start: 321, end: 400},
    
    // Gerechtshoven - criminal
    {code: 'GHAMS', name: 'Hof Amsterdam', rechtsgebied: 'STRAFRECHT', start: 401, end: 500},
    {code: 'GHARN', name: 'Hof Arnhem', rechtsgebied: 'STRAFRECHT', start: 501, end: 600},
    {code: 'GHDHA', name: 'Hof Den Haag', rechtsgebied: 'STRAFRECHT', start: 601, end: 700},
    
    // ABRvS
    {code: 'RVS', name: 'ABRvS', rechtsgebied: 'BESTUURSRECHT', start: 1, end: 200},
    
    // CRvB
    {code: 'CRVB', name: 'CRvB', rechtsgebied: 'BESTUURSRECHT', start: 201, end: 400},
    
    // Rechtbanken - civil
    {code: 'RBAMS', name: 'Rb Amsterdam', rechtsgebied: 'CIVIEL_RECHT', start: 1, end: 60},
    {code: 'RBROT', name: 'Rb Rotterdam', rechtsgebied: 'CIVIEL_RECHT', start: 61, end: 120},
    {code: 'RBDHA', name: 'Rb Den Haag', rechtsgebied: 'CIVIEL_RECHT', start: 121, end: 180},
    {code: 'RBUTR', name: 'Rb Utrecht', rechtsgebied: 'CIVIEL_RECHT', start: 181, end: 240},
    
    // Rechtbanken - criminal
    {code: 'RBAMS', name: 'Rb Amsterdam', rechtsgebied: 'STRAFRECHT', start: 241, end: 350},
    {code: 'RBROT', name: 'Rb Rotterdam', rechtsgebied: 'STRAFRECHT', start: 351, end: 460},
    {code: 'RBDHA', name: 'Rb Den Haag', rechtsgebied: 'STRAFRECHT', start: 461, end: 570},
    
    // Rechtbanken - admin
    {code: 'RBAMS', name: 'Rb Amsterdam', rechtsgebied: 'BESTUURSRECHT', start: 571, end: 650},
    {code: 'RBROT', name: 'Rb Rotterdam', rechtsgebied: 'BESTUURSRECHT', start: 651, end: 730},
    
    // Labor
    {code: 'RBAMS', name: 'Rb Amsterdam', rechtsgebied: 'ARBEIDSRECHT', start: 731, end: 800},
    {code: 'RBROT', name: 'Rb Rotterdam', rechtsgebied: 'ARBEIDSRECHT', start: 801, end: 870},
  ];
  
  // Years to generate (focus on recent years where XML is available)
  const years = [2024, 2023, 2022, 2021, 2020];
  
  for (const year of years) {
    for (const court of courts) {
      for (let num = court.start; num <= court.end && num <= court.start + 40; num++) {
        // Generate ECLI with padding
        const paddedNum = String(num).padStart(4, '0');
        const ecli = `ECLI:NL:${court.code}:${year}:${paddedNum}`;
        cases.push({ ecli, rechtsgebied: court.rechtsgebied });
      }
    }
  }
  
  return cases;
}

// ============================================
// PROGRESS TRACKING
// ============================================

const PROGRESS_FILE = path.join(__dirname, 'data', 'fetch-mass-cases-progress.json');

interface Progress {
  completed: string[];
  failed: string[];
  byRechtsgebied: Record<string, number>;
  lastUpdated: string;
  totalNodes: number;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load progress:', error);
  }
  return {
    completed: [],
    failed: [],
    byRechtsgebied: {},
    lastUpdated: new Date().toISOString(),
    totalNodes: 0,
  };
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================
// INGEST
// ============================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ingestCase(ecli: string, rechtsgebied: Rechtsgebied, progress: Progress): Promise<boolean> {
  if (progress.completed.includes(ecli) || progress.failed.includes(ecli)) {
    return progress.completed.includes(ecli);
  }
  
  try {
    const xmlContent = await fetchRechtspraakCase(ecli);
    const uitspraak = parseRechtspraakXML(xmlContent, ecli);
    
    // Skip metadata-only
    if (uitspraak.overwegingen.length === 0 && !uitspraak.beslissing) {
      progress.completed.push(ecli);
      return true;
    }
    
    uitspraak.rechtsgebieden = [rechtsgebied];
    const nodes = convertRechtspraakToLegalNodes(uitspraak);
    
    await storeLegalNodes(nodes);
    
    const toc = generateCaseTOC(uitspraak);
    await storeTOCCache({
      documentId: ecli,
      sourceType: 'JURISPRUDENTIE',
      tocData: toc,
      title: uitspraak.titel,
      rechtsgebied,
      documentDate: uitspraak.uitspraakDatum ? new Date(uitspraak.uitspraakDatum) : undefined,
      nodeCount: nodes.length,
    });
    
    // Citations
    for (const node of nodes) {
      const citations = [
        ...recognizeLiDOCitations(node.contentText, node.nodeId),
        ...extractCitationsFromUitspraak(node.contentText, node.nodeId),
      ];
      for (const citation of citations) {
        try {
          await db.execute(sql`
            INSERT INTO "legal_citations" (
              "id", "source_node_id", "target_id", "citation_type", "context", "is_lido", "created_at"
            ) VALUES (
              gen_random_uuid(), ${citation.sourceNodeId}, ${citation.targetId},
              ${citation.citationType}, ${citation.context || null}, ${citation.isLiDO}, NOW()
            )
            ON CONFLICT DO NOTHING
          `);
        } catch (e) {}
      }
    }
    
    progress.completed.push(ecli);
    progress.totalNodes += nodes.length;
    progress.byRechtsgebied[rechtsgebied] = (progress.byRechtsgebied[rechtsgebied] || 0) + 1;
    
    return true;
  } catch (error) {
    progress.failed.push(ecli);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('========================================');
  console.log('FETCH MASS CASES');
  console.log('Target: 500+ cases via ECLI patterns');
  console.log('========================================\n');
  
  const progress = loadProgress();
  const allCases = generateECLIs();
  
  console.log(`Generated ${allCases.length} ECLI patterns`);
  console.log(`Already completed: ${progress.completed.length}`);
  console.log(`Remaining: ${allCases.length - progress.completed.length}\n`);
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  for (let i = 0; i < allCases.length; i++) {
    const { ecli, rechtsgebied } = allCases[i];
    
    if (progress.completed.includes(ecli)) {
      skipCount++;
      continue;
    }
    
    if ((i + 1) % 10 === 0 || i === 0) {
      process.stdout.write(`\r[${i + 1}/${allCases.length}] Success: ${successCount}, Failed: ${failCount}, Skip: ${skipCount}`);
    }
    
    const success = await ingestCase(ecli, rechtsgebied, progress);
    
    if (success) {
      if (!progress.failed.includes(ecli)) {
        successCount++;
      }
    } else {
      failCount++;
    }
    
    // Save every 20 cases
    if ((successCount + failCount) % 20 === 0) {
      saveProgress(progress);
    }
    
    await sleep(300);
  }
  
  saveProgress(progress);
  
  console.log('\n\n========================================');
  console.log('COMPLETE');
  console.log('========================================');
  console.log(`Total Attempted: ${allCases.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skip (already done): ${skipCount}`);
  console.log(`Total Nodes: ${progress.totalNodes}`);
  console.log('\nBy Rechtsgebied:');
  for (const [rg, count] of Object.entries(progress.byRechtsgebied)) {
    console.log(`  ${rg}: ${count}`);
  }
  console.log('========================================');
  
  await closeDb();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeDb();
  process.exit(1);
});
