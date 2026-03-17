#!/usr/bin/env tsx
// ============================================
// TARGETED INGESTION - Labor & Tax Cases
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
  LABOR_TARGET: 500,
  TAX_TARGET: 300,
  BATCH_SIZE: 10,
  API_DELAY: 200,
  PROGRESS_FILE: path.join(__dirname, 'data', 'ingest-targeted-progress.json'),
};

// Search configurations for Labor Law
const LABOR_SEARCHES = [
  { query: 'ontslag', description: 'Dismissal cases' },
  { query: 'arbeidsovereenkomst', description: 'Employment contracts' },
  { query: 'collectieve arbeidsovereenkomst', description: 'Collective labor agreements' },
  { query: 'werknemer werkgever', description: 'Employee-employer disputes' },
  { query: 'ontslag op staande voet', description: 'Immediate dismissal' },
  { query: 'ontslagvergoeding', description: 'Severance pay' },
  { query: 'arbeidsrecht', description: 'General labor law' },
];

// Search configurations for Tax Law
const TAX_SEARCHES = [
  { query: 'belasting', description: 'General tax cases' },
  { query: 'fiscaal', description: 'Fiscal cases' },
  { query: 'btw', description: 'VAT/BTW disputes' },
  { query: 'vennootschapsbelasting', description: 'Corporate tax' },
  { query: 'inkomstenbelasting', description: 'Income tax' },
  { query: 'loonbelasting', description: 'Payroll tax' },
  { query: 'belastingontduiking', description: 'Tax evasion' },
  { query: 'fiscale fraude', description: 'Tax fraud' },
  { query: 'heffing', description: 'Tax assessments' },
];

// Specialized courts
const COURTS = [
  'http://psi.rechtspraak.nl/CBB',  // Business court (tax)
  'http://psi.rechtspraak.nl/CentraleRaad',  // Social security (labor-related)
  'http://psi.rechtspraak.nl/HogeRaad',  // Supreme Court
];

interface Progress {
  laborCompleted: string[];
  taxCompleted: string[];
  failed: string[];
  laborCount: number;
  taxCount: number;
  totalNodes: number;
  lastUpdated: string;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    }
  } catch (error) {}
  return {
    laborCompleted: [],
    taxCompleted: [],
    failed: [],
    laborCount: 0,
    taxCount: 0,
    totalNodes: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(CONFIG.PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search for cases by query and optionally by court
 */
async function searchCases(
  query: string,
  year: number,
  maxResults: number = 100,
  court?: string
): Promise<string[]> {
  try {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    let url = `https://data.rechtspraak.nl/uitspraken/zoeken?q=${encodeURIComponent(query)}&date=${startDate}&date=${endDate}&return=DOC&max=${maxResults}`;
    
    if (court) {
      url += `&creator=${encodeURIComponent(court)}`;
    }
    
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
    console.error(`Search error for "${query}":`, error);
    return [];
  }
}

/**
 * Ingest a single case
 */
async function ingestCase(
  ecli: string, 
  rechtsgebied: Rechtsgebied, 
  progress: Progress,
  isLabor: boolean
): Promise<boolean> {
  const completedList = isLabor ? progress.laborCompleted : progress.taxCompleted;
  
  if (completedList.includes(ecli) || progress.failed.includes(ecli)) {
    return completedList.includes(ecli);
  }
  
  try {
    // Fetch the full case content
    const xmlContent = await fetchRechtspraakCase(ecli);
    
    // Parse
    const uitspraak = parseRechtspraakXML(xmlContent, ecli);
    
    // Check if it has actual content
    if (uitspraak.overwegingen.length === 0 && !uitspraak.beslissing) {
      console.log(`  ⚠️ ${ecli} - no content`);
      if (isLabor) progress.laborCompleted.push(ecli);
      else progress.taxCompleted.push(ecli);
      return true;
    }
    
    // Override rechtsgebied
    uitspraak.rechtsgebieden = [rechtsgebied];
    
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
    
    if (isLabor) {
      progress.laborCompleted.push(ecli);
      progress.laborCount++;
    } else {
      progress.taxCompleted.push(ecli);
      progress.taxCount++;
    }
    progress.totalNodes += nodes.length;
    
    return true;
    
  } catch (error) {
    console.error(`  ✗ Error ingesting ${ecli}:`, error);
    progress.failed.push(ecli);
    return false;
  }
}

/**
 * Process searches for a domain
 */
async function processDomain(
  searches: Array<{query: string; description: string}>,
  rechtsgebied: Rechtsgebied,
  target: number,
  progress: Progress,
  isLabor: boolean,
  years: number[]
) {
  const domainName = isLabor ? 'LABOR' : 'TAX';
  const currentCount = isLabor ? progress.laborCount : progress.taxCount;
  
  console.log(`\n========================================`);
  console.log(`${domainName} LAW INGESTION`);
  console.log(`Target: ${target} cases (currently: ${currentCount})`);
  console.log(`========================================\n`);
  
  for (const search of searches) {
    if ((isLabor ? progress.laborCount : progress.taxCount) >= target) break;
    
    console.log(`\n🔍 Searching: ${search.description} (${search.query})`);
    
    for (const year of years) {
      if ((isLabor ? progress.laborCount : progress.taxCount) >= target) break;
      
      // Search without court first
      const eclis = await searchCases(search.query, year, 100);
      
      if (eclis.length === 0) continue;
      
      // Filter out already processed
      const completedList = isLabor ? progress.laborCompleted : progress.taxCompleted;
      const newEclis = eclis.filter(e => !completedList.includes(e) && !progress.failed.includes(e));
      
      if (newEclis.length === 0) continue;
      
      console.log(`  📅 ${year}: Found ${newEclis.length} new cases (of ${eclis.length})`);
      
      // Process cases
      let successCount = 0;
      
      for (const ecli of newEclis.slice(0, 30)) { // Max 30 per search/year
        if ((isLabor ? progress.laborCount : progress.taxCount) >= target) break;
        
        const success = await ingestCase(ecli, rechtsgebied, progress, isLabor);
        
        if (success) {
          successCount++;
          console.log(`  ✓ ${ecli} - ${isLabor ? progress.laborCount : progress.taxCount}/${target}`);
        }
        
        // Save progress periodically
        if (successCount % 5 === 0) {
          saveProgress(progress);
        }
        
        await sleep(CONFIG.API_DELAY);
      }
      
      console.log(`  ✓ Ingested: ${successCount}`);
      saveProgress(progress);
    }
  }
  
  // Also try specialized courts
  console.log(`\n🏛️ Searching specialized courts...`);
  
  for (const court of COURTS) {
    if ((isLabor ? progress.laborCount : progress.taxCount) >= target) break;
    
    for (const year of years.slice(0, 5)) { // Recent years only
      if ((isLabor ? progress.laborCount : progress.taxCount) >= target) break;
      
      const query = isLabor ? 'arbeid' : 'belasting';
      const eclis = await searchCases(query, year, 100, court);
      
      const completedList = isLabor ? progress.laborCompleted : progress.taxCompleted;
      const newEclis = eclis.filter(e => !completedList.includes(e) && !progress.failed.includes(e));
      
      if (newEclis.length === 0) continue;
      
      console.log(`  ${court} (${year}): ${newEclis.length} new cases`);
      
      for (const ecli of newEclis.slice(0, 20)) {
        if ((isLabor ? progress.laborCount : progress.taxCount) >= target) break;
        
        const success = await ingestCase(ecli, rechtsgebied, progress, isLabor);
        if (success) {
          console.log(`  ✓ ${ecli} - ${isLabor ? progress.laborCount : progress.taxCount}/${target}`);
        }
        
        await sleep(CONFIG.API_DELAY);
      }
      
      saveProgress(progress);
    }
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('========================================');
  console.log('TARGETED INGESTION: Labor & Tax Cases');
  console.log('========================================\n');
  
  const progress = loadProgress();
  
  console.log('Current Progress:');
  console.log(`  Labor Cases: ${progress.laborCount}/${CONFIG.LABOR_TARGET}`);
  console.log(`  Tax Cases: ${progress.taxCount}/${CONFIG.TAX_TARGET}`);
  console.log(`  Total Nodes: ${progress.totalNodes}\n`);
  
  // Years to search - focus on recent years with more digital cases
  const years = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
  
  // Process Labor cases
  if (progress.laborCount < CONFIG.LABOR_TARGET) {
    await processDomain(
      LABOR_SEARCHES,
      'ARBEIDSRECHT',
      CONFIG.LABOR_TARGET,
      progress,
      true,
      years
    );
  } else {
    console.log('\n✓ Labor target already reached!');
  }
  
  // Process Tax cases
  if (progress.taxCount < CONFIG.TAX_TARGET) {
    await processDomain(
      TAX_SEARCHES,
      'FISCAAL_RECHT',
      CONFIG.TAX_TARGET,
      progress,
      false,
      years
    );
  } else {
    console.log('\n✓ Tax target already reached!');
  }
  
  console.log('\n========================================');
  console.log('COMPLETE');
  console.log('========================================');
  console.log(`Labor Cases: ${progress.laborCount}/${CONFIG.LABOR_TARGET}`);
  console.log(`Tax Cases: ${progress.taxCount}/${CONFIG.TAX_TARGET}`);
  console.log(`Failed: ${progress.failed.length}`);
  console.log(`Total Nodes: ${progress.totalNodes}`);
  console.log('========================================');
  
  await closeDb();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeDb();
  process.exit(1);
});
