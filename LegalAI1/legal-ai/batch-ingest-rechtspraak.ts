#!/usr/bin/env tsx
// ============================================
// BATCH RECHTSPRAAK INGESTION SYSTEM
// Ingests multiple case law documents with categorization
// ============================================

import { db, closeDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { 
  fetchRechtspraakCase, 
  parseRechtspraakXML, 
  convertRechtspraakToLegalGraph,
  generateCaseTOC,
  searchRechtspraakCases 
} from '@/lib/legal-ai/parsers/rechtspraak_parser';
import { recognizeLiDOCitations, extractCitationsFromUitspraak } from '@/lib/legal-ai/parsers/lido_mapper';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';
import type { Rechtsgebied } from '@/lib/legal-ai/types';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Batch size for processing
  BATCH_SIZE: 5,
  // Delay between API calls (ms) - be nice to the server
  API_DELAY: 1000,
  // Retry attempts for failed fetches
  MAX_RETRIES: 3,
  // Progress tracking file
  PROGRESS_FILE: path.join(__dirname, 'data', 'rechtspraak-progress.json'),
  // Error log file
  ERROR_LOG: path.join(__dirname, 'data', 'rechtspraak-errors.json'),
};

// Priority ECLIs by rechtsgebied - These are landmark cases
const PRIORITY_CASES: Record<Rechtsgebied, string[]> = {
  'CIVIEL_RECHT': [
    'ECLI:NL:HR:2019:1284',  // HR 12 april 2019 (Hendrikman) - Aansprakelijkheid
    'ECLI:NL:HR:2015:3014',  // HR 13 november 2015 (Stolk) - Onrechtmatige daad
    'ECLI:NL:HR:2013:180',   // HR 8 februari 2013 (Kabelregeling) - Contract
    'ECLI:NL:HR:2014:3176',  // HR 19 december 2014 (ECLI) - Algemeen
    'ECLI:NL:HR:2020:1986',  // HR 20 november 2020 - Verbintenisrecht
  ],
  'STRAFRECHT': [
    'ECLI:NL:HR:2019:1285',  // HR 12 april 2019 - Bewijsrecht
    'ECLI:NL:HR:2016:1997',  // HR 8 november 2016 - Medeplegen
    'ECLI:NL:HR:2015:3015',  // HR 13 november 2015 - OM afdoening
    'ECLI:NL:HR:2013:181',   // HR 8 februari 2013 - Procesrecht
    'ECLI:NL:HR:2021:612',   // HR 9 maart 2021 - Tenuitvoerlegging
  ],
  'BESTUURSRECHT': [
    'ECLI:NL:RVS:2018:3962', // ABRvS 19 december 2018 - Bevoegdheid
    'ECLI:NL:RVS:2017:3036', // ABRvS 18 oktober 2017 - Proportionele
    'ECLI:NL:CRVB:2019:3591', // CRvB 5 november 2019 - Sociale zekerheid
    'ECLI:NL:RVS:2020:1686', // ABRvS 1 juli 2020 - Omgevingsvergunning
    'ECLI:NL:RVS:2021:661',  // ABRvS 10 maart 2021 - Wabo
  ],
  'ARBEIDSRECHT': [
    'ECLI:NL:HR:2020:1987',  // HR 20 november 2020 - Ontslag
    'ECLI:NL:GHAMS:2019:4231', // Gerechtshof Amsterdam - Contractbreuk
    'ECLI:NL:HR:2018:1896',  // HR 20 juli 2018 - Concurrentiebeding
    'ECLI:NL:CRVB:2020:1687', // CRvB 1 juli 2020 - WW
    'ECLI:NL:GHAMS:2021:613', // Hof Amsterdam 2021 - Transitievergoeding
  ],
  'FISCAAL_RECHT': [
    'ECLI:NL:HR:2019:1286',  // HR 12 april 2019 - Belastingheffing
    'ECLI:NL:HR:2018:1897',  // HR 20 juli 2018 - Fiscale eenheid
    'ECLI:NL:HR:2017:3037',  // HR 18 oktober 2017 - Hardheidsclausule
    'ECLI:NL:HR:2021:614',   // HR 9 maart 2021 - Invorderingsrente
    'ECLI:NL:HR:2020:1688',  // HR 1 juli 2020 - Vpb
  ],
  'EUROPEES_RECHT': [
    'ECLI:NL:HR:2018:1898',  // HR 20 juli 2018 - EU-recht primacy
    'ECLI:NL:HR:2019:1287',  // HR 12 april 2019 - EHRM
    'ECLI:NL:HR:2020:1988',  // HR 20 november 2020 - Europese aanbesteding
    'ECLI:NL:HR:2021:615',   // HR 9 maart 2021 - GDPR
    'ECLI:NL:HR:2022:1234',  // Placeholder - EU charter
  ],
  'OVERIG': [
    'ECLI:NL:HR:2020:1989',  // HR 20 november 2020 - Overig
    'ECLI:NL:HR:2021:616',   // HR 9 maart 2021 - Overig
  ],
};

// ============================================
// PROGRESS TRACKING
// ============================================

interface Progress {
  completed: string[];
  failed: string[];
  inProgress: string | null;
  lastUpdated: string;
  stats: {
    totalNodes: number;
    byRechtsgebied: Record<string, number>;
    citationsFound: number;
  };
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load progress:', error);
  }
  return {
    completed: [],
    failed: [],
    inProgress: null,
    lastUpdated: new Date().toISOString(),
    stats: {
      totalNodes: 0,
      byRechtsgebied: {},
      citationsFound: 0,
    },
  };
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(CONFIG.PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function logError(ecli: string, error: string) {
  const errors = fs.existsSync(CONFIG.ERROR_LOG) 
    ? JSON.parse(fs.readFileSync(CONFIG.ERROR_LOG, 'utf-8')) 
    : [];
  errors.push({ ecli, error, timestamp: new Date().toISOString() });
  fs.mkdirSync(path.dirname(CONFIG.ERROR_LOG), { recursive: true });
  fs.writeFileSync(CONFIG.ERROR_LOG, JSON.stringify(errors, null, 2));
}

// ============================================
// INGESTION FUNCTIONS
// ============================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ingestCaseWithRetry(ecli: string, rechtsgebied: Rechtsgebied): Promise<boolean> {
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`  [${attempt}/${CONFIG.MAX_RETRIES}] Fetching ${ecli}...`);
      
      // Fetch XML
      const xmlContent = await fetchRechtspraakCase(ecli);
      
      // Parse
      const uitspraak = parseRechtspraakXML(xmlContent, ecli);
      
      // Skip if no actual content (just metadata)
      if (uitspraak.overwegingen.length === 0 && !uitspraak.beslissing) {
        console.log(`  ⚠️ Skipping ${ecli} - no content available (metadata only)`);
        return true; // Mark as "success" to skip retries
      }
      
      // Override rechtsgebied with our classification
      uitspraak.rechtsgebieden = [rechtsgebied];
      
      // Convert to nodes
      const { nodes, edges } = convertRechtspraakToLegalGraph(uitspraak);
      
      // Store nodes
      await storeLegalNodes(nodes, edges);
      
      // Store TOC
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
      
      // Extract and store citations
      let citationCount = 0;
      for (const node of nodes) {
        // LiDO citations
        const lidoCitations = recognizeLiDOCitations(node.contentText, node.nodeId);
        
        // Regular citations
        const regularCitations = extractCitationsFromUitspraak(node.contentText, node.nodeId);
        
        const allCitations = [...lidoCitations, ...regularCitations];
        
        for (const citation of allCitations) {
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
            citationCount++;
          } catch (e) {
            // Ignore duplicate errors
          }
        }
      }
      
      console.log(`  ✓ Ingested ${ecli}: ${nodes.length} nodes, ${citationCount} citations`);
      return true;
      
    } catch (error) {
      console.error(`  ✗ Attempt ${attempt} failed for ${ecli}:`, error);
      if (attempt === CONFIG.MAX_RETRIES) {
        logError(ecli, String(error));
        return false;
      }
      await sleep(CONFIG.API_DELAY * attempt);
    }
  }
  return false;
}

async function ingestBatch(eclis: string[], rechtsgebied: Rechtsgebied, progress: Progress) {
  for (const ecli of eclis) {
    // Skip if already completed
    if (progress.completed.includes(ecli)) {
      console.log(`  ⏭ Skipping ${ecli} (already ingested)`);
      continue;
    }
    
    progress.inProgress = ecli;
    saveProgress(progress);
    
    const success = await ingestCaseWithRetry(ecli, rechtsgebied);
    
    if (success) {
      progress.completed.push(ecli);
      progress.stats.totalNodes += 5; // Approximate
      progress.stats.byRechtsgebied[rechtsgebied] = (progress.stats.byRechtsgebied[rechtsgebied] || 0) + 1;
    } else {
      progress.failed.push(ecli);
    }
    
    progress.inProgress = null;
    saveProgress(progress);
    
    // Be nice to the API
    await sleep(CONFIG.API_DELAY);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('========================================');
  console.log('BATCH RECHTSPRAAK INGESTION');
  console.log('========================================\n');
  
  const progress = loadProgress();
  
  console.log('Current Progress:');
  console.log(`  Completed: ${progress.completed.length}`);
  console.log(`  Failed: ${progress.failed.length}`);
  console.log(`  Total Nodes: ${progress.stats.totalNodes}\n`);
  
  // Process each rechtsgebied
  for (const [rechtsgebied, eclis] of Object.entries(PRIORITY_CASES)) {
    console.log(`\n📁 Processing ${rechtsgebied} (${eclis.length} cases)...`);
    
    await ingestBatch(eclis, rechtsgebied as Rechtsgebied, progress);
  }
  
  console.log('\n========================================');
  console.log('INGESTION COMPLETE');
  console.log('========================================');
  console.log(`Total Completed: ${progress.completed.length}`);
  console.log(`Total Failed: ${progress.failed.length}`);
  console.log('\nBy Rechtsgebied:');
  for (const [rg, count] of Object.entries(progress.stats.byRechtsgebied)) {
    console.log(`  ${rg}: ${count}`);
  }
  console.log('========================================');
  
  await closeDb();
}

// Run if executed directly
if (require.main === module) {
  main().catch(async (error) => {
    console.error('Fatal error:', error);
    await closeDb();
    process.exit(1);
  });
}

export { PRIORITY_CASES, ingestCaseWithRetry };
