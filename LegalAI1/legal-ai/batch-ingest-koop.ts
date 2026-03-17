#!/usr/bin/env tsx
// ============================================
// BATCH KOOP/BWB LEGISLATION INGESTION SYSTEM
// Ingests Dutch laws with full hierarchy
// ============================================

import { db, closeDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { 
  fetchBWBRegeling, 
  parseBWBXML, 
  convertToLegalGraph,
  generateLegislationTOC 
} from '@/lib/legal-ai/parsers/koop_parser';
import { recognizeLiDOCitations } from '@/lib/legal-ai/parsers/lido_mapper';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';
import type { Rechtsgebied } from '@/lib/legal-ai/types';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  BATCH_SIZE: 3,
  API_DELAY: 2000, // KOOP is slower
  MAX_RETRIES: 3,
  PROGRESS_FILE: path.join(__dirname, 'data', 'koop-progress.json'),
  ERROR_LOG: path.join(__dirname, 'data', 'koop-errors.json'),
};

// Complete Dutch law library with categorization
const DUTCH_LAWS: Array<{
  bwbId: string;
  citeertitel: string;
  rechtsgebied: Rechtsgebied;
  description: string;
  priority: 'high' | 'medium' | 'low';
}> = [
  // CIVIEL RECHT
  {
    bwbId: 'BWBR0005289',
    citeertitel: 'Burgerlijk Wetboek Boek 1 (Personen- en familierecht)',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Personen- en familierecht',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0005034',
    citeertitel: 'Burgerlijk Wetboek Boek 2 (Rechtspersonen)',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Vennootschapsrecht en rechtspersonen',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0005291',
    citeertitel: 'Burgerlijk Wetboek Boek 3 (Vermogensrecht)',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Vermogensrecht in algemene zin',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002761',
    citeertitel: 'Burgerlijk Wetboek Boek 4 (Erfrecht)',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Erfrecht en erfenissen',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0005293',
    citeertitel: 'Burgerlijk Wetboek Boek 5 (Zakenrecht)',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Zakenrecht en goederenrecht',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0005294',
    citeertitel: 'Burgerlijk Wetboek Boek 6 (Algemeen gedeelte verbintenissenrecht)',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Verbintenissenrecht - artikel 6:162 (onrechtmatige daad)',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0005290',
    citeertitel: 'Burgerlijk Wetboek Boek 7 (Bijzondere overeenkomsten)',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Contractenrecht - koop, huur, aanneming',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0006000',
    citeertitel: 'Burgerlijk Wetboek Boek 7A',
    rechtsgebied: 'CIVIEL_RECHT',
    description: 'Historische en bijzondere overeenkomsten onder Boek 7A',
    priority: 'medium',
  },
  
  // STRAFRECHT
  {
    bwbId: 'BWBR0001854',
    citeertitel: 'Wetboek van Strafrecht (WvSr)',
    rechtsgebied: 'STRAFRECHT',
    description: 'Het Nederlandse strafrecht - misdrijven en straffen',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0001903',
    citeertitel: 'Wetboek van Strafvordering (WvSv)',
    rechtsgebied: 'STRAFRECHT',
    description: 'Strafprocesrecht - opsporing en vervolging',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002458',
    citeertitel: 'Wetboek van Militair Strafrecht (WMSr)',
    rechtsgebied: 'STRAFRECHT',
    description: 'Militair strafrecht',
    priority: 'medium',
  },
  
  // BESTUURSRECHT
  {
    bwbId: 'BWBR0005537',
    citeertitel: 'Algemene Wet Bestuursrecht (AWB)',
    rechtsgebied: 'BESTUURSRECHT',
    description: 'Algemene regels voor bestuursrechtelijke handelingen',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002367',
    citeertitel: 'Wet op de Raad van State (Wet ROAS)',
    rechtsgebied: 'BESTUURSRECHT',
    description: 'Administratieve rechtspraak',
    priority: 'medium',
  },
  {
    bwbId: 'BWBR0002527',
    citeertitel: 'Wet beroep en bezwaar (Wbb)',
    rechtsgebied: 'BESTUURSRECHT',
    description: 'Rechtsbescherming in bestuursrecht',
    priority: 'medium',
  },
  {
    bwbId: 'BWBR0027238',
    citeertitel: 'Omgevingswet',
    rechtsgebied: 'BESTUURSRECHT',
    description: 'Integrale wet voor fysieke leefomgeving',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0020368',
    citeertitel: 'Wet op het financieel toezicht (Wft)',
    rechtsgebied: 'BESTUURSRECHT',
    description: 'Kernwet voor financieel toezicht, prudentieel toezicht en gedragstoezicht',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0024282',
    citeertitel: 'Wet ter voorkoming van witwassen en financieren van terrorisme (Wwft)',
    rechtsgebied: 'BESTUURSRECHT',
    description: 'Nederlandse AML/CFT-kernwet voor clientonderzoek, meldplichten en integriteitscontrole',
    priority: 'high',
  },

  // ARBEIDSRECHT
  {
    bwbId: 'BWBR0002014',
    citeertitel: 'Wet arbeidsvoorwaarden (Wet AVV)',
    rechtsgebied: 'ARBEIDSRECHT',
    description: 'Arbeidsvoorwaardenwetgeving',
    priority: 'medium',
  },
  {
    bwbId: 'BWBR0007748',
    citeertitel: 'Wet Werk en Zekerheid (WWZ)',
    rechtsgebied: 'ARBEIDSRECHT',
    description: 'Modernisering ontslagrecht en WW',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002065',
    citeertitel: 'Werkloosheidswet (WW)',
    rechtsgebied: 'ARBEIDSRECHT',
    description: 'WW-uitkeringen en werkloosheid',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002638',
    citeertitel: 'Wet op de arbeidsongeschiktheidsverzekering (WAO)',
    rechtsgebied: 'ARBEIDSRECHT',
    description: 'Arbeidsongeschiktheidsverzekering',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0013065',
    citeertitel: 'Wet WIA',
    rechtsgebied: 'ARBEIDSRECHT',
    description: 'Wet werk en inkomen naar arbeidsvermogen',
    priority: 'high',
  },
  
  // FISCAAL RECHT
  {
    bwbId: 'BWBR0002320',
    citeertitel: 'Algemene Wet inzake Rijksbelastingen (AWR)',
    rechtsgebied: 'FISCAAL_RECHT',
    description: 'Algemene belastingwetgeving',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0001980',
    citeertitel: 'Wet op de vennootschapsbelasting 1969 (Vpb)',
    rechtsgebied: 'FISCAAL_RECHT',
    description: 'Belasting voor rechtspersonen',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002200',
    citeertitel: 'Wet inkomstenbelasting 2001 (IB)',
    rechtsgebied: 'FISCAAL_RECHT',
    description: 'Inkomstenbelasting natuurlijke personen',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0001952',
    citeertitel: 'Wet op de loonbelasting 1964',
    rechtsgebied: 'FISCAAL_RECHT',
    description: 'Loonheffingen',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002629',
    citeertitel: 'Wet op de omzetbelasting 1968 (BTW)',
    rechtsgebied: 'FISCAAL_RECHT',
    description: 'Belasting over toegevoegde waarde',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002741',
    citeertitel: 'Wet op de successiewet 1956',
    rechtsgebied: 'FISCAAL_RECHT',
    description: 'Successierecht en schenkbelasting',
    priority: 'medium',
  },
  
  // EUROPEES RECHT / GRONDWET
  {
    bwbId: 'BWBR0001840',
    citeertitel: 'Grondwet (GW)',
    rechtsgebied: 'EUROPEES_RECHT',
    description: 'Nederlandse Grondwet',
    priority: 'high',
  },
  {
    bwbId: 'BWBR0002368',
    citeertitel: 'Wet Algemene Bepalingen (WAB)',
    rechtsgebied: 'OVERIG',
    description: 'Algemene bepalingen voor wetgeving',
    priority: 'medium',
  },
];

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
    hoofdstukkenCount: number;
    artikelenCount: number;
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
      hoofdstukkenCount: 0,
      artikelenCount: 0,
    },
  };
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(CONFIG.PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function logError(bwbId: string, error: string) {
  const errors = fs.existsSync(CONFIG.ERROR_LOG) 
    ? JSON.parse(fs.readFileSync(CONFIG.ERROR_LOG, 'utf-8')) 
    : [];
  errors.push({ bwbId, error, timestamp: new Date().toISOString() });
  fs.mkdirSync(path.dirname(CONFIG.ERROR_LOG), { recursive: true });
  fs.writeFileSync(CONFIG.ERROR_LOG, JSON.stringify(errors, null, 2));
}

// ============================================
// INGESTION FUNCTIONS
// ============================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ingestLawWithRetry(law: typeof DUTCH_LAWS[0]): Promise<{success: true, hoofdstukkenCount: number, artikelenCount: number} | false> {
  const fullBwbId = `BWB:${law.bwbId}`;
  
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`  [${attempt}/${CONFIG.MAX_RETRIES}] Fetching ${law.citeertitel}...`);
      
      // Fetch XML
      const xmlContent = await fetchBWBRegeling(fullBwbId);
      
      // Parse
      const wet = parseBWBXML(xmlContent, fullBwbId);
      
      // Enhance metadata with our classification
      wet.citeertitel = law.citeertitel;
      
      // Convert to nodes
      const { nodes, edges } = convertToLegalGraph(wet);
      
      // Add rechtsgebied to all nodes
      for (const node of nodes) {
        node.rechtsgebied = law.rechtsgebied;
        node.metadata = {
          ...node.metadata,
          category: law.rechtsgebied,
          priority: law.priority,
          description: law.description,
        };
      }
      
      // Store nodes
      await storeLegalNodes(nodes, edges);
      
      // Store TOC
      const toc = generateLegislationTOC(wet);
      await storeTOCCache({
        documentId: fullBwbId,
        sourceType: 'WETGEVING',
        tocData: toc,
        title: law.citeertitel,
        rechtsgebied: law.rechtsgebied,
        documentDate: wet.regelingDatum ? new Date(wet.regelingDatum) : undefined,
        nodeCount: nodes.length,
      });
      
      // Extract citations
      let citationCount = 0;
      for (const node of nodes) {
        const citations = recognizeLiDOCitations(node.contentText, node.nodeId);
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
            citationCount++;
          } catch (e) {
            // Ignore duplicates
          }
        }
      }
      
      // Count statistics
      let hoofdstukkenCount = 0;
      let artikelenCount = 0;
      for (const hd of wet.hoofdstukken) {
        hoofdstukkenCount++;
        artikelenCount += hd.artikelen.length;
        for (const pg of hd.paragrafen) {
          artikelenCount += pg.artikelen.length;
        }
      }
      
      console.log(`  ✓ Ingested ${law.citeertitel}:`);
      console.log(`     ${nodes.length} nodes, ${hoofdstukkenCount} hoofdstukken, ${artikelenCount} artikelen, ${citationCount} citations`);
      
      return { success: true, hoofdstukkenCount, artikelenCount };
      
    } catch (error) {
      console.error(`  ✗ Attempt ${attempt} failed for ${law.citeertitel}:`, error);
      if (attempt === CONFIG.MAX_RETRIES) {
        logError(law.bwbId, String(error));
        return false;
      }
      await sleep(CONFIG.API_DELAY * attempt);
    }
  }
  return false;
}

async function ingestBatch(laws: typeof DUTCH_LAWS, progress: Progress) {
  for (const law of laws) {
    // Skip if already completed
    if (progress.completed.includes(law.bwbId)) {
      console.log(`  ⏭ Skipping ${law.citeertitel} (already ingested)`);
      continue;
    }
    
    progress.inProgress = law.bwbId;
    saveProgress(progress);
    
    const result = await ingestLawWithRetry(law);
    
    if (result) {
      progress.completed.push(law.bwbId);
      progress.stats.totalNodes += 50; // Approximate average
      progress.stats.byRechtsgebied[law.rechtsgebied] = (progress.stats.byRechtsgebied[law.rechtsgebied] || 0) + 1;
      progress.stats.hoofdstukkenCount += result.hoofdstukkenCount || 0;
      progress.stats.artikelenCount += result.artikelenCount || 0;
    } else {
      progress.failed.push(law.bwbId);
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
  console.log('BATCH KOOP/BWB LEGISLATION INGESTION');
  console.log('========================================\n');
  
  const progress = loadProgress();
  
  console.log('Current Progress:');
  console.log(`  Completed: ${progress.completed.length}/${DUTCH_LAWS.length}`);
  console.log(`  Failed: ${progress.failed.length}`);
  console.log(`  Total Nodes: ${progress.stats.totalNodes}\n`);
  
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedLaws = [...DUTCH_LAWS].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
  
  // Process by priority
  for (const priority of ['high', 'medium', 'low'] as const) {
    const lawsOfPriority = sortedLaws.filter(l => l.priority === priority);
    if (lawsOfPriority.length === 0) continue;
    
    console.log(`\n📚 Processing ${priority.toUpperCase()} priority laws (${lawsOfPriority.length} laws)...`);
    await ingestBatch(lawsOfPriority, progress);
  }
  
  console.log('\n========================================');
  console.log('INGESTION COMPLETE');
  console.log('========================================');
  console.log(`Total Completed: ${progress.completed.length}/${DUTCH_LAWS.length}`);
  console.log(`Total Failed: ${progress.failed.length}`);
  console.log(`\nTotal Nodes Created: ~${progress.stats.totalNodes}`);
  console.log(`Total Hoofdstukken: ${progress.stats.hoofdstukkenCount}`);
  console.log(`Total Artikelen: ${progress.stats.artikelenCount}`);
  console.log('\nBy Rechtsgebied:');
  for (const [rg, count] of Object.entries(progress.stats.byRechtsgebied)) {
    console.log(`  ${rg}: ${count} laws`);
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

export { DUTCH_LAWS, ingestLawWithRetry };
