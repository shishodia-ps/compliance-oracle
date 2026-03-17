#!/usr/bin/env tsx
// ============================================
// MASS RECHTSPRAAK INGESTION - 50,000+ CASES
// Robust pagination-based approach via Open Data API
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

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  TARGET_TOTAL: 50000,
  API_DELAY: 40,         // ms between content fetches
  SEARCH_DELAY: 200,     // ms between search pagination calls
  MAX_RETRIES: 3,
  SEARCH_PAGE_SIZE: 1000, // max results per search page
  PROGRESS_FILE: path.join(__dirname, 'data', 'mass-rechtspraak-progress.json'),
  ERROR_LOG: path.join(__dirname, 'data', 'mass-rechtspraak-errors.json'),
  // Months to search (we go month by month for better coverage)
  START_YEAR: 2010,
  END_YEAR: 2024,
};

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
  lastMonth?: string; // Track where we left off: "2023-06"
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

function logError(ecli: string, error: string) {
  try {
    const errors = fs.existsSync(CONFIG.ERROR_LOG)
      ? JSON.parse(fs.readFileSync(CONFIG.ERROR_LOG, 'utf-8'))
      : [];
    errors.push({ ecli, error, timestamp: new Date().toISOString() });
    fs.mkdirSync(path.dirname(CONFIG.ERROR_LOG), { recursive: true });
    fs.writeFileSync(CONFIG.ERROR_LOG, JSON.stringify(errors.slice(-500), null, 2)); // Keep last 500
  } catch { }
}

// ============================================
// SEARCH API - Fetch ECLI lists by date range
// ============================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all ECLIs for a given month using pagination
 * Returns deduplicated list of ECLI identifiers
 */
async function fetchECLIsForMonth(year: number, month: number): Promise<string[]> {
  const allECLIs = new Set<string>();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

  // Calculate end date (last day of month)
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`;

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `https://data.rechtspraak.nl/uitspraken/zoeken?date=${startDate}&date=${endDate}&max=${CONFIG.SEARCH_PAGE_SIZE}&from=${offset}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 LegalAI-Scraper/1.0',
          'Accept': 'application/xml, text/xml, */*'
        }
      });

      if (!response.ok) {
        break;
      }

      const xml = await response.text();

      // Extract ECLIs from XML
      const matches = xml.match(/<id>(ECLI:[^<]+)<\/id>/g);
      if (!matches || matches.length === 0) {
        hasMore = false;
        break;
      }

      let foundNew = 0;
      for (const match of matches) {
        const ecli = match.replace(/<\/?id>/g, '').trim();
        if (ecli.startsWith('ECLI:')) {
          if (!allECLIs.has(ecli)) foundNew++;
          allECLIs.add(ecli);
        }
      }

      // If we got a full page, there might be more
      if (foundNew > 0 && matches.length >= CONFIG.SEARCH_PAGE_SIZE * 0.8) {
        offset += CONFIG.SEARCH_PAGE_SIZE;
        await sleep(CONFIG.SEARCH_DELAY);
      } else {
        hasMore = false;
      }

    } catch (error) {
      hasMore = false;
    }
  }

  return Array.from(allECLIs);
}

// ============================================
// RECHTSGEBIED CLASSIFICATION
// ============================================

function mapRechtsgebied(raw: string): Rechtsgebied {
  const rg = raw.toLowerCase();
  if (rg.includes('civiel') || rg.includes('verbintenis') || rg.includes('personen')) return 'CIVIEL_RECHT';
  if (rg.includes('straf')) return 'STRAFRECHT';
  if (rg.includes('bestuur') || rg.includes('vreemdeling') || rg.includes('omgevings')) return 'BESTUURSRECHT';
  if (rg.includes('arbeid') || rg.includes('ontslag') || rg.includes('sociaal')) return 'ARBEIDSRECHT';
  if (rg.includes('fiscaal') || rg.includes('belasting')) return 'FISCAAL_RECHT';
  if (rg.includes('europees') || rg.includes('internationaal')) return 'EUROPEES_RECHT';
  return 'OVERIG';
}

// ============================================
// INGEST SINGLE CASE
// ============================================

async function ingestCase(ecli: string, progress: Progress): Promise<boolean> {
  // Skip if already processed
  if (progress.completed.includes(ecli) || progress.failed.includes(ecli)) {
    return progress.completed.includes(ecli);
  }

  // Check if already in DB
  const existing = await db.execute(sql<{ count: number }>`
    SELECT COUNT(*)::int as count FROM "legal_nodes" WHERE "node_id" = ${ecli}
  `);
  if (existing[0] && Number(existing[0].count) > 0) {
    progress.completed.push(ecli);
    return true;
  }

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      // Fetch XML
      const xmlContent = await fetchRechtspraakCase(ecli);

      // Parse
      const uitspraak = parseRechtspraakXML(xmlContent, ecli);

      // Skip metadata-only cases
      if (uitspraak.overwegingen.length === 0 && !uitspraak.beslissing) {
        progress.completed.push(ecli);
        return true;
      }

      // Determine rechtsgebied from content
      let rechtsgebied: Rechtsgebied = 'OVERIG';
      if (uitspraak.rechtsgebieden && uitspraak.rechtsgebieden.length > 0) {
        rechtsgebied = mapRechtsgebied(uitspraak.rechtsgebieden[0]);
      }

      // Override with classified value for DB
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

      // Extract citations
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

      // Extract year from ECLI
      const yearMatch = ecli.match(/:(\d{4}):/);
      const year = yearMatch ? yearMatch[1] : 'unknown';

      progress.completed.push(ecli);
      progress.totalNodes += nodes.length;
      progress.byRechtsgebied[rechtsgebied] = (progress.byRechtsgebied[rechtsgebied] || 0) + 1;
      progress.byYear[year] = (progress.byYear[year] || 0) + 1;

      return true;

    } catch (error) {
      if (attempt === CONFIG.MAX_RETRIES) {
        logError(ecli, String(error));
        progress.failed.push(ecli);
        return false;
      }
      await sleep(CONFIG.API_DELAY * attempt * 2);
    }
  }

  return false;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('========================================');
  console.log('MASS RECHTSPRAAK INGESTION');
  console.log(`Target: ${CONFIG.TARGET_TOTAL.toLocaleString()} cases`);
  console.log('Method: Month-by-month pagination');
  console.log(`Delay: ${CONFIG.API_DELAY}ms per case`);
  console.log('========================================\n');

  const progress = loadProgress();

  // Use a Set for fast lookups
  const completedSet = new Set(progress.completed);
  const failedSet = new Set(progress.failed);

  console.log('Current Progress:');
  console.log(`  Completed: ${completedSet.size}`);
  console.log(`  Failed: ${failedSet.size}`);
  console.log(`  Total Nodes: ${progress.totalNodes}\n`);

  if (completedSet.size >= CONFIG.TARGET_TOTAL) {
    console.log('✓ Target already reached!');
    await closeDb();
    return;
  }

  let sessionSuccess = 0;
  let sessionSkip = 0;
  let sessionFail = 0;

  // Process year by year, month by month
  for (let year = CONFIG.END_YEAR; year >= CONFIG.START_YEAR; year--) {
    if (completedSet.size >= CONFIG.TARGET_TOTAL) break;

    console.log(`\n📅 Year ${year}`);

    for (let month = 12; month >= 1; month--) {
      if (completedSet.size >= CONFIG.TARGET_TOTAL) break;

      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      // Skip future months
      const now = new Date();
      if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) {
        continue;
      }

      process.stdout.write(`  📆 ${monthStr}: searching... `);

      const eclis = await fetchECLIsForMonth(year, month);

      // Filter out already processed
      const newECLIs = eclis.filter(e => !completedSet.has(e) && !failedSet.has(e));

      if (newECLIs.length === 0) {
        console.log(`${eclis.length} found, 0 new`);
        continue;
      }

      console.log(`${eclis.length} found, ${newECLIs.length} new → ingesting...`);

      let monthSuccess = 0;
      let monthFail = 0;

      for (let i = 0; i < newECLIs.length; i++) {
        if (completedSet.size >= CONFIG.TARGET_TOTAL) break;

        const ecli = newECLIs[i];
        const success = await ingestCase(ecli, progress);

        if (success) {
          monthSuccess++;
          sessionSuccess++;
          completedSet.add(ecli);
        } else {
          monthFail++;
          sessionFail++;
          failedSet.add(ecli);
        }

        // Save progress every 50 cases
        if ((monthSuccess + monthFail) % 50 === 0) {
          saveProgress(progress);
          const total = completedSet.size;
          const pct = ((total / CONFIG.TARGET_TOTAL) * 100).toFixed(1);
          process.stdout.write(`    [${total.toLocaleString()}/${CONFIG.TARGET_TOTAL.toLocaleString()} = ${pct}%] `);
          process.stdout.write(`✓${monthSuccess} ✗${monthFail}\r`);
        }

        // Delay between requests
        await sleep(CONFIG.API_DELAY);
      }

      console.log(`    ✓ ${monthSuccess} ingested, ✗ ${monthFail} failed`);
      saveProgress(progress);
      progress.lastMonth = monthStr;
    }

    // Year summary
    console.log(`  📊 Year ${year}: ${progress.byYear[String(year)] || 0} cases total`);
  }

  // Final stats
  console.log('\n========================================');
  console.log('MASS INGESTION COMPLETE');
  console.log('========================================');
  console.log(`Session: ✓${sessionSuccess} new, ↷${sessionSkip} skipped, ✗${sessionFail} failed`);
  console.log(`Total Cases: ${completedSet.size}`);
  console.log(`Total Nodes: ${progress.totalNodes}`);
  console.log('\nBy Year:');
  for (const [year, count] of Object.entries(progress.byYear).sort()) {
    console.log(`  ${year}: ${count}`);
  }
  console.log('\nBy Rechtsgebied:');
  for (const [rg, count] of Object.entries(progress.byRechtsgebied).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    console.log(`  ${rg}: ${count}`);
  }
  console.log('========================================');

  saveProgress(progress);
  await closeDb();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeDb();
  process.exit(1);
});
