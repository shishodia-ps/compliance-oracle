#!/usr/bin/env tsx
// ============================================
// BULK RECHTSPRAAK INGESTION - THOUSANDS OF CASES
// Uses search API to find and ingest cases by rechtsgebied
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
import { XMLParser } from 'fast-xml-parser';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// XML Parser for search results
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Target number of cases per rechtsgebied (3,500 total / 7 domains = 500 each)
  TARGET_CASES_PER_DOMAIN: 500,
  
  // Batch size for processing
  BATCH_SIZE: 10,
  
  // Delay between API calls (ms)
  API_DELAY: 300,
  
  // Retry attempts
  MAX_RETRIES: 3,
  
  // Progress tracking
  PROGRESS_FILE: path.join(__dirname, 'data', 'bulk-rechtspraak-progress.json'),
  ERROR_LOG: path.join(__dirname, 'data', 'bulk-rechtspraak-errors.json'),
  
  // Only ingest cases from this year onwards (to ensure XML content availability)
  MIN_YEAR: 2015,
};

// Search queries by rechtsgebied to find diverse cases (50 queries per domain)
const SEARCH_QUERIES: Record<Rechtsgebied, string[]> = {
  'CIVIEL_RECHT': [
    'aansprakelijkheid onrechtmatige daad',
    'verbintenis contract',
    'eigendom goederenrecht',
    'huur huurovereenkomst',
    'koop koopovereenkomst',
    'burenrecht erfdienstbaarheid',
    'verborgen gebrek',
    'schadevergoeding',
    'ontruiming woning',
    'werkkostenregeling',
    'artikel 6 162 BW',
    'artikel 7 24 BW',
    'artikel 7 658 BW',
    'artikel 6 74 BW',
    'artikel 6 230 BW',
    'artikel 5 17 BW',
    'artikel 3 266 BW',
    'artikel 7 17 BW',
    'artikel 7 18 BW',
    'artikel 7 401 BW',
    'artikel 7 404 BW',
    'artikel 7 408 BW',
    'artikel 7 611 BW',
    'artikel 7 613 BW',
    'artikel 7 617 BW',
    'artikel 7 618 BW',
    'artikel 7 638 BW',
    'artikel 7 652 BW',
    'artikel 7 653 BW',
    'artikel 7 654 BW',
    'artikel 7 655 BW',
    'artikel 7 657 BW',
    'artikel 7 658 BW',
    'artikel 7 660 BW',
    'artikel 7 661 BW',
    'artikel 7 662 BW',
    'artikel 7 663 BW',
    'artikel 7 664 BW',
    'artikel 7 665 BW',
    'artikel 7 666 BW',
    'artikel 7 667 BW',
    'artikel 7 668 BW',
    'artikel 7 669 BW',
    'artikel 7 670 BW',
    'artikel 7 671 BW',
    'artikel 7 672 BW',
    'artikel 7 673 BW',
    'artikel 7 674 BW',
    'artikel 7 675 BW',
  ],
  'STRAFRECHT': [
    'diefstal',
    'medeplegen',
    'omvang straf',
    'voorarrest',
    'bewijslast',
    'verdachte bekentenis',
    'getuigenverklaring',
    'verjaring',
    'jeugdstrafrecht',
    'schuldig',
    'artikel 26 WvSr',
    'artikel 27 WvSr',
    'artikel 28 WvSr',
    'artikel 29 WvSr',
    'artikel 36 WvSr',
    'artikel 36a WvSr',
    'artikel 36b WvSr',
    'artikel 36c WvSr',
    'artikel 36d WvSr',
    'artikel 36e WvSr',
    'artikel 36f WvSr',
    'artikel 37 WvSr',
    'artikel 38 WvSr',
    'artikel 39 WvSr',
    'artikel 40 WvSr',
    'artikel 41 WvSr',
    'artikel 42 WvSr',
    'artikel 43 WvSr',
    'artikel 44 WvSr',
    'artikel 45 WvSr',
    'artikel 46 WvSr',
    'artikel 47 WvSr',
    'artikel 48 WvSr',
    'artikel 49 WvSr',
    'artikel 50 WvSr',
    'artikel 51 WvSr',
    'artikel 52 WvSr',
    'artikel 53 WvSr',
    'artikel 54 WvSr',
    'artikel 55 WvSr',
    'artikel 56 WvSr',
    'artikel 57 WvSr',
    'artikel 58 WvSr',
    'artikel 59 WvSr',
    'artikel 60 WvSr',
    'artikel 61 WvSr',
    'artikel 62 WvSr',
    'moord doodslag',
    'zware mishandeling',
    'bedreiging',
  ],
  'BESTUURSRECHT': [
    'omgevingsvergunning',
    'bestuursrechtelijke sanctie',
    'bezwaar beroep',
    'wet open overheid',
    'subsidie',
    'bestemmingsplan',
    'woonvergunning',
    'handhaving',
    'AWB algemene wet bestuursrecht',
    'overheidsaansprakelijkheid',
    'artikel 1 3 Awb',
    'artikel 1 4 Awb',
    'artikel 2 Awb',
    'artikel 3 Awb',
    'artikel 4 Awb',
    'artikel 5 Awb',
    'artikel 6 Awb',
    'artikel 7 Awb',
    'artikel 8 Awb',
    'artikel 9 Awb',
    'artikel 10 Awb',
    'artikel 11 Awb',
    'artikel 12 Awb',
    'artikel 13 Awb',
    'artikel 14 Awb',
    'artikel 15 Awb',
    'artikel 16 Awb',
    'artikel 17 Awb',
    'artikel 18 Awb',
    'artikel 19 Awb',
    'artikel 20 Awb',
    'artikel 21 Awb',
    'artikel 22 Awb',
    'artikel 23 Awb',
    'artikel 24 Awb',
    'artikel 25 Awb',
    'artikel 26 Awb',
    'artikel 27 Awb',
    'artikel 28 Awb',
    'artikel 29 Awb',
    'artikel 30 Awb',
    'artikel 31 Awb',
    'artikel 32 Awb',
    'artikel 33 Awb',
    'artikel 34 Awb',
    'artikel 35 Awb',
    'artikel 36 Awb',
    'artikel 37 Awb',
    'artikel 38 Awb',
    'artikel 39 Awb',
  ],
  'ARBEIDSRECHT': [
    'ontslag ontslagrecht',
    'arbeidsovereenkomst',
    'transitievergoeding',
    'ontslagbescherming',
    'werktijd arbeidstijd',
    'loon salaris',
    'arbeidsongeschiktheid',
    'WW uitkering',
    'WIA',
    'cao collectieve arbeidsovereenkomst',
    'artikel 7 611 BW',
    'artikel 7 613 BW',
    'artikel 7 617 BW',
    'artikel 7 618 BW',
    'artikel 7 638 BW',
    'artikel 7 652 BW',
    'artikel 7 653 BW',
    'artikel 7 654 BW',
    'artikel 7 655 BW',
    'artikel 7 657 BW',
    'artikel 7 658 BW',
    'artikel 7 660 BW',
    'artikel 7 661 BW',
    'artikel 7 662 BW',
    'artikel 7 663 BW',
    'artikel 7 664 BW',
    'artikel 7 665 BW',
    'artikel 7 666 BW',
    'artikel 7 667 BW',
    'artikel 7 668 BW',
    'artikel 7 669 BW',
    'artikel 7 670 BW',
    'artikel 7 671 BW',
    'artikel 7 672 BW',
    'artikel 7 673 BW',
    'artikel 7 674 BW',
    'artikel 7 675 BW',
    'artikel 7 676 BW',
    'artikel 7 677 BW',
    'artikel 7 678 BW',
    'artikel 7 679 BW',
    'artikel 7 680 BW',
    'artikel 7 681 BW',
    'artikel 7 682 BW',
    'artikel 7 683 BW',
    'artikel 7 684 BW',
    'artikel 7 685 BW',
    'artikel 7 686 BW',
    'artikel 7 687 BW',
    'artikel 7 688 BW',
  ],
  'FISCAAL_RECHT': [
    'belastingaanslag',
    'aangifte inkomstenbelasting',
    'vennootschapsbelasting',
    'btw belasting',
    'fiscale eenheid',
    'bezwaar belasting',
    'heffing',
    'invorderingsrente',
    'aftrekpost',
    'aanmerkelijk belang',
    'artikel 3 AWR',
    'artikel 4 AWR',
    'artikel 5 AWR',
    'artikel 6 AWR',
    'artikel 7 AWR',
    'artikel 8 AWR',
    'artikel 9 AWR',
    'artikel 10 AWR',
    'artikel 11 AWR',
    'artikel 12 AWR',
    'artikel 13 AWR',
    'artikel 14 AWR',
    'artikel 15 AWR',
    'artikel 16 AWR',
    'artikel 17 AWR',
    'artikel 18 AWR',
    'artikel 19 AWR',
    'artikel 20 AWR',
    'artikel 21 AWR',
    'artikel 22 AWR',
    'artikel 23 AWR',
    'artikel 24 AWR',
    'artikel 25 AWR',
    'artikel 26 AWR',
    'artikel 27 AWR',
    'artikel 28 AWR',
    'artikel 29 AWR',
    'artikel 30 AWR',
    'artikel 31 AWR',
    'artikel 32 AWR',
    'artikel 33 AWR',
    'artikel 34 AWR',
    'artikel 35 AWR',
    'artikel 36 AWR',
    'artikel 37 AWR',
    'artikel 38 AWR',
    'artikel 39 AWR',
    'artikel 40 AWR',
    'artikel 41 AWR',
    'artikel 42 AWR',
    'artikel 43 AWR',
    'artikel 44 AWR',
    'artikel 45 AWR',
  ],
  'EUROPEES_RECHT': [
    'Europees recht',
    'grondrechten',
    'privacy AVG',
    'vrijheid van meningsuiting',
    'non-discriminatie',
    'EHRM',
    'prejudiciele vraag',
    'Europees Hof',
    'EU verdrag',
    'handvest grondrechten',
    'artikel 1 EVRM',
    'artikel 2 EVRM',
    'artikel 3 EVRM',
    'artikel 4 EVRM',
    'artikel 5 EVRM',
    'artikel 6 EVRM',
    'artikel 7 EVRM',
    'artikel 8 EVRM',
    'artikel 9 EVRM',
    'artikel 10 EVRM',
    'artikel 11 EVRM',
    'artikel 12 EVRM',
    'artikel 13 EVRM',
    'artikel 14 EVRM',
    'artikel 15 EVRM',
    'artikel 16 EVRM',
    'artikel 17 EVRM',
    'artikel 18 EVRM',
    'artikel 1 EU-handvest',
    'artikel 2 EU-handvest',
    'artikel 3 EU-handvest',
    'artikel 4 EU-handvest',
    'artikel 5 EU-handvest',
    'artikel 6 EU-handvest',
    'artikel 7 EU-handvest',
    'artikel 8 EU-handvest',
    'artikel 9 EU-handvest',
    'artikel 10 EU-handvest',
    'artikel 11 EU-handvest',
    'artikel 12 EU-handvest',
    'artikel 13 EU-handvest',
    'artikel 14 EU-handvest',
    'artikel 15 EU-handvest',
    'artikel 16 EU-handvest',
    'artikel 17 EU-handvest',
    'artikel 18 EU-handvest',
    'artikel 19 EU-handvest',
    'artikel 20 EU-handvest',
    'artikel 21 EU-handvest',
  ],
  'OVERIG': [
    'procedure civiel',
    'kosten rechtspraak',
    'nevenindiening',
    'getuige deskundige',
    'bewijsrecht',
    'verjaring rechtspraak',
    'jurisprudentie algemeen',
    'rechtsmiddel hoger beroep',
    'rechtsmiddel cassatie',
    'rechtsmiddel verzet',
    'dagvaarding',
    'conclusie advocaat-generaal',
    'uitspraak datum',
    'instantie gerechtshof',
    'instantie rechtbank',
    'instantie hoge raad',
    'zaaknummer rolnummer',
    'rechtsgebied civiel',
    'rechtsgebied strafrecht',
    'rechtsgebied bestuursrecht',
    'rechtsgebied arbeidsrecht',
    'rechtsgebied fiscaal',
    'rechtsgebied Europees',
    'geding economische zaken',
    'geding kantonrechter',
    'geding familierecht',
    'geding sociale zaken',
    'geding bestuursrecht',
    'tussenarrest',
    'eindarrest',
    'decretale uitspraak',
    'vonnis arrest',
    'uitspraak in kort geding',
    'vrijwaring',
    'conventie reconventie',
    'incident appel',
    'incident reconventie',
    'incident voorziening',
    'artikel 7 894 BW',
    'artikel 7 895 BW',
    'artikel 7 896 BW',
    'artikel 7 897 BW',
    'artikel 7 898 BW',
    'artikel 7 899 BW',
    'artikel 7 900 BW',
    'artikel 7 901 BW',
    'artikel 7 902 BW',
    'artikel 7 903 BW',
    'artikel 7 904 BW',
    'artikel 7 905 BW',
    'artikel 7 906 BW',
    'artikel 7 907 BW',
    'artikel 7 908 BW',
    'artikel 7 909 BW',
    'artikel 7 910 BW',
    'artikel 7 911 BW',
    'artikel 7 912 BW',
    'artikel 7 913 BW',
  ],
};

// ============================================
// PROGRESS TRACKING
// ============================================

interface Progress {
  completed: string[];
  failed: string[];
  inProgress: string | null;
  byRechtsgebied: Record<string, number>;
  lastUpdated: string;
  totalNodes: number;
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
    byRechtsgebied: {},
    lastUpdated: new Date().toISOString(),
    totalNodes: 0,
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
// SEARCH FUNCTIONS
// ============================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search for cases using the Rechtspraak search API (returns XML)
 * Filters for cases from 2015 onwards with full content
 */
async function searchCases(query: string, maxResults: number = 50): Promise<string[]> {
  try {
    // Build URL - filter by year after getting results
    const url = `https://data.rechtspraak.nl/uitspraken/zoeken?inq=${encodeURIComponent(query)}&max=${maxResults}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
    });
    
    if (!response.ok) {
      console.warn(`Search failed for "${query}": ${response.status}`);
      return [];
    }
    
    const xmlText = await response.text();
    const parsed = xmlParser.parse(xmlText);
    
    // Extract ECLIs from XML results
    const eclis: string[] = [];
    const results = parsed?.feed?.entry || parsed?.['atom:feed']?.['atom:entry'] || [];
    const entries = Array.isArray(results) ? results : results ? [results] : [];
    
    for (const entry of entries) {
      // Try different ID fields
      const id = entry?.id || entry?.['atom:id'] || entry?.['dc:identifier'];
      if (id && typeof id === 'string' && id.startsWith('ECLI:')) {
        // Extract year from ECLI
        const yearMatch = id.match(/ECLI:NL:[A-Z]+:(\d{4}):/);
        const year = yearMatch ? parseInt(yearMatch[1]) : 0;
        
        // Only include cases from 2015 onwards
        if (year >= CONFIG.MIN_YEAR) {
          eclis.push(id);
        }
      }
    }
    
    return [...new Set(eclis)]; // Remove duplicates
  } catch (error) {
    console.warn(`Search error for "${query}":`, error);
    return [];
  }
}

/**
 * Get recent cases by rechtsgebied (returns XML)
 * Filters for cases from 2015 onwards
 */
async function getRecentCases(rechtsgebied: string, maxResults: number = 150): Promise<string[]> {
  try {
    // Map rechtsgebied to subject code
    const subjectMap: Record<string, string> = {
      'CIVIEL_RECHT': 'http://psi.rechtspraak.nl/rechtsgebied#civielRecht',
      'STRAFRECHT': 'http://psi.rechtspraak.nl/rechtsgebied#strafrecht',
      'BESTUURSRECHT': 'http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht',
      'ARBEIDSRECHT': 'http://psi.rechtspraak.nl/rechtsgebied#arbeidsrecht',
      'FISCAAL_RECHT': 'http://psi.rechtspraak.nl/rechtsgebied#fiscaalRecht',
      'EUROPEES_RECHT': 'http://psi.rechtspraak.nl/rechtsgebied#internationaalRecht',
      'OVERIG': 'http://psi.rechtspraak.nl/rechtsgebied#civielRecht',
    };
    
    const dateFilter = `date=>${CONFIG.MIN_YEAR}-01-01`;
    const subject = subjectMap[rechtsgebied] || rechtsgebied;
    const url = `https://data.rechtspraak.nl/uitspraken/zoeken?subject=${encodeURIComponent(subject)}&max=${maxResults}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
    });
    
    if (!response.ok) {
      console.warn(`Recent cases failed for ${rechtsgebied}: ${response.status}`);
      return [];
    }
    
    const xmlText = await response.text();
    const parsed = xmlParser.parse(xmlText);
    
    // Extract ECLIs from XML
    const eclis: string[] = [];
    const results = parsed?.feed?.entry || parsed?.['atom:feed']?.['atom:entry'] || [];
    const entries = Array.isArray(results) ? results : results ? [results] : [];
    
    for (const entry of entries) {
      const id = entry?.id || entry?.['atom:id'] || entry?.['dc:identifier'];
      if (id && typeof id === 'string' && id.startsWith('ECLI:')) {
        // Extract year from ECLI
        const yearMatch = id.match(/ECLI:NL:[A-Z]+:(\d{4}):/);
        const year = yearMatch ? parseInt(yearMatch[1]) : 0;
        
        // Only include cases from 2015 onwards
        if (year >= CONFIG.MIN_YEAR) {
          eclis.push(id);
        }
      }
    }
    
    return [...new Set(eclis)];
  } catch (error) {
    console.warn(`Recent cases error for ${rechtsgebied}:`, error);
    return [];
  }
}

// ============================================
// INGESTION FUNCTIONS
// ============================================

async function ingestCase(ecli: string, rechtsgebied: Rechtsgebied, progress: Progress): Promise<boolean> {
  // Skip if already processed
  if (progress.completed.includes(ecli) || progress.failed.includes(ecli)) {
    return progress.completed.includes(ecli);
  }
  
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      // Fetch XML
      const xmlContent = await fetchRechtspraakCase(ecli);
      
      // Parse
      const uitspraak = parseRechtspraakXML(xmlContent, ecli);
      
      // Skip metadata-only cases
      if (uitspraak.overwegingen.length === 0 && !uitspraak.beslissing) {
        console.log(`  ⚠️ Skipping ${ecli} - metadata only`);
        progress.completed.push(ecli);
        return true;
      }
      
      // Override rechtsgebied
      uitspraak.rechtsgebieden = [rechtsgebied];
      
      // Convert to nodes
      const nodes = convertRechtspraakToLegalNodes(uitspraak);
      
      // Store nodes
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
          } catch (e) {
            // Ignore
          }
        }
      }
      
      progress.completed.push(ecli);
      progress.totalNodes += nodes.length;
      progress.byRechtsgebied[rechtsgebied] = (progress.byRechtsgebied[rechtsgebied] || 0) + 1;
      
      return true;
      
    } catch (error) {
      if (attempt === CONFIG.MAX_RETRIES) {
        console.error(`  ✗ Failed ${ecli} after ${CONFIG.MAX_RETRIES} attempts`);
        logError(ecli, String(error));
        progress.failed.push(ecli);
        return false;
      }
      await sleep(CONFIG.API_DELAY * attempt);
    }
  }
  
  return false;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('========================================');
  console.log('BULK RECHTSPRAAK INGESTION');
  console.log('Target: ~3,500 cases (500 per domain)');
  console.log('========================================\n');
  
  const progress = loadProgress();
  
  console.log('Current Progress:');
  console.log(`  Completed: ${progress.completed.length}`);
  console.log(`  Failed: ${progress.failed.length}`);
  console.log(`  Total Nodes: ${progress.totalNodes}\n`);
  
  // Collect all ECLIs to ingest
  const allEclis = new Map<string, Rechtsgebied>();
  
  for (const [rechtsgebied, queries] of Object.entries(SEARCH_QUERIES)) {
    const currentCount = progress.byRechtsgebied[rechtsgebied] || 0;
    const needed = CONFIG.TARGET_CASES_PER_DOMAIN - currentCount;
    
    if (needed <= 0) {
      console.log(`✓ ${rechtsgebied} already has ${currentCount} cases`);
      continue;
    }
    
    console.log(`\n📚 ${rechtsgebied}: Need ${needed} more cases`);
    
    // Try recent cases first
    const recentEclis = await getRecentCases(rechtsgebied, 100);
    for (const ecli of recentEclis) {
      if (!allEclis.has(ecli) && !progress.completed.includes(ecli)) {
        allEclis.set(ecli, rechtsgebied as Rechtsgebied);
      }
    }
    
    // Then search by keywords
    for (const query of queries) {
      if (allEclis.size >= needed) break;
      
      console.log(`  Searching: "${query}"...`);
      const searchEclis = await searchCases(query, 30);
      
      for (const ecli of searchEclis) {
        if (!allEclis.has(ecli) && !progress.completed.includes(ecli)) {
          allEclis.set(ecli, rechtsgebied as Rechtsgebied);
        }
      }
      
      await sleep(CONFIG.API_DELAY);
    }
  }
  
  console.log(`\n🎯 Found ${allEclis.size} new cases to ingest\n`);
  
  // Process in batches
  const ecliList = Array.from(allEclis.entries());
  let processed = 0;
  let successCount = 0;
  
  for (const [ecli, rechtsgebied] of ecliList) {
    processed++;
    
    if (progress.completed.includes(ecli)) {
      console.log(`[${processed}/${ecliList.length}] ⏭ Skipping ${ecli} (done)`);
      continue;
    }
    
    process.stdout.write(`[${processed}/${ecliList.length}] Ingesting ${ecli}... `);
    
    const success = await ingestCase(ecli, rechtsgebied, progress);
    saveProgress(progress);
    
    if (success) {
      successCount++;
      console.log('✓');
    } else {
      console.log('✗');
    }
    
    await sleep(CONFIG.API_DELAY);
  }
  
  console.log('\n========================================');
  console.log('BULK INGESTION COMPLETE');
  console.log('========================================');
  console.log(`Total Cases: ${progress.completed.length}`);
  console.log(`Failed: ${progress.failed.length}`);
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
