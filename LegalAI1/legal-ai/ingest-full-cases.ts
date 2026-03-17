#!/usr/bin/env tsx
// ============================================
// INGEST FULL CASES - Using return=DOC parameter
// This gets cases with actual XML content
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

const CONFIG = {
  TARGET: 4000,  // Target 3,500+ cases
  BATCH_SIZE: 10,
  API_DELAY: 150,
  PROGRESS_FILE: path.join(__dirname, 'data', 'ingest-full-cases-progress.json'),
  YEARS: [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008, 2007, 2006, 2005, 2004, 2003, 2002, 2001, 2000],
};

// Search by date ranges - no court filter to maximize results
const SEARCH_QUERIES: Array<{name: string; from: number}> = [
  {name: 'batch1', from: 0},
  {name: 'batch2', from: 100},
  {name: 'batch3', from: 200},
  {name: 'batch4', from: 300},
  {name: 'batch5', from: 400},
  {name: 'batch6', from: 500},
  {name: 'batch7', from: 600},
  {name: 'batch8', from: 700},
];

// ============================================
// SEARCH WITH return=DOC PARAMETER
// ============================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search for cases with actual content using return=DOC with pagination
 */
async function searchCasesWithPagination(
  year: number, 
  maxResults: number = 100,
  from: number = 0
): Promise<string[]> {
  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    // Search with pagination using 'from' parameter
    const url = `https://data.rechtspraak.nl/uitspraken/zoeken?date=${startDate}&date=${endDate}&return=DOC&max=${maxResults}&from=${from}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const xmlText = await response.text();
    
    // Parse XML to extract ECLIs
    const eclis: string[] = [];
    const idMatches = xmlText.match(/<id>(ECLI:[^<]+)<\/id>/g);
    
    if (idMatches) {
      for (const match of idMatches) {
        const ecli = match.replace(/<\/?id>/g, '');
        if (ecli.startsWith('ECLI:')) {
          eclis.push(ecli);
        }
      }
    }
    
    return [...new Set(eclis)];
  } catch (error) {
    return [];
  }
}

// ============================================
// PROGRESS TRACKING
// ============================================

interface Progress {
  completed: string[];
  failed: string[];
  byRechtsgebied: Record<string, number>;
  byYear: Record<string, number>;
  lastUpdated: string;
  totalNodes: number;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    }
  } catch (error) {}
  return {
    completed: [],
    failed: [],
    byRechtsgebied: {},
    byYear: {},
    lastUpdated: new Date().toISOString(),
    totalNodes: 0,
  };
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(CONFIG.PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================
// INGEST CASE
// ============================================

async function ingestCase(ecli: string, defaultRechtsgebied: Rechtsgebied, year: number, progress: Progress): Promise<boolean> {
  if (progress.completed.includes(ecli) || progress.failed.includes(ecli)) {
    return progress.completed.includes(ecli);
  }
  
  try {
    // Fetch the full case content
    const xmlContent = await fetchRechtspraakCase(ecli);
    
    // Parse
    const uitspraak = parseRechtspraakXML(xmlContent, ecli);
    
    // Check if it has actual content
    if (uitspraak.overwegingen.length === 0 && !uitspraak.beslissing) {
      console.log(`  ⚠️ ${ecli} - no content`);
      progress.completed.push(ecli);
      return true;
    }
    
    // Use actual rechtsgebied from case, or default if not found
    const rechtsgebied = uitspraak.rechtsgebieden?.[0] as Rechtsgebied || defaultRechtsgebied;
    
    // Convert to nodes
    const nodes = convertRechtspraakToLegalNodes(uitspraak);
    
    // Store
    await storeLegalNodes(nodes);
    
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
    progress.byYear[String(year)] = (progress.byYear[String(year)] || 0) + 1;
    
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
  console.log('INGEST FULL CASES');
  console.log('Using return=DOC parameter for content');
  console.log('========================================\n');
  
  const progress = loadProgress();
  
  console.log('Current Progress:');
  console.log(`  Completed: ${progress.completed.length}`);
  console.log(`  Failed: ${progress.failed.length}`);
  console.log(`  Total Nodes: ${progress.totalNodes}\n`);
  
  // Process by year with pagination
  for (const year of CONFIG.YEARS) {
    if (progress.completed.length >= CONFIG.TARGET) break;
    
    console.log(`\n📅 Year ${year}:`);
    
    for (const query of SEARCH_QUERIES) {
      if (progress.completed.length >= CONFIG.TARGET) break;
      
      console.log(`  📄 Batch ${query.name} (from=${query.from})...`);
      
      // Search for cases with pagination
      const eclis = await searchCasesWithPagination(year, 100, query.from);
      
      if (eclis.length === 0) {
        break;
      }
      
      // Filter out already processed
      const newEclis = eclis.filter(e => !progress.completed.includes(e) && !progress.failed.includes(e));
      
      if (newEclis.length === 0) {
        continue;
      }
      
      console.log(`     Found ${newEclis.length} new cases (of ${eclis.length})`);
      
      // Process cases
      let successCount = 0;
      let contentCount = 0;
      
      for (const ecli of newEclis) {
        const success = await ingestCase(ecli, 'OVERIG', year, progress);
        
        if (success) {
          successCount++;
          contentCount++;
        }
        
        // Save progress periodically
        if (successCount % 5 === 0) {
          saveProgress(progress);
        }
        
        await sleep(CONFIG.API_DELAY);
      }
      
      console.log(`     ✓ Ingested: ${contentCount}`);
      saveProgress(progress);
    }
  }
  
  console.log('\n========================================');
  console.log('COMPLETE');
  console.log('========================================');
  console.log(`Total Cases: ${progress.completed.length}`);
  console.log(`Failed: ${progress.failed.length}`);
  console.log(`Total Nodes: ${progress.totalNodes}`);
  console.log('\nBy Year:');
  for (const [year, count] of Object.entries(progress.byYear).sort()) {
    console.log(`  ${year}: ${count}`);
  }
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
