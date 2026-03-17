#!/usr/bin/env tsx
// ============================================
// RECHTSPRAAK DATA INGESTION SCRIPT
// Ingests case law from rechtspraak.nl Open Data API
// ============================================

import { db, closeDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { 
  fetchRechtspraakCase, 
  parseRechtspraakXML, 
  convertRechtspraakToLegalNodes,
  generateCaseTOC,
  searchRechtspraakCases 
} from '@/lib/legal-ai/parsers/rechtspraak_parser';
import { recognizeLiDOCitations } from '@/lib/legal-ai/parsers/lido_mapper';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';

async function ingestCase(ecli: string) {
  console.log(`Ingesting case: ${ecli}`);
  
  try {
    // Fetch XML from API
    const xmlContent = await fetchRechtspraakCase(ecli);
    
    // Parse XML
    const uitspraak = parseRechtspraakXML(xmlContent, ecli);
    console.log(`  Title: ${uitspraak.titel || 'N/A'}`);
    console.log(`  Overwegingen: ${uitspraak.overwegingen.length}`);
    console.log(`  Rechtsgebieden: ${uitspraak.rechtsgebieden?.join(', ') || 'N/A'}`);
    
    // Convert to legal nodes
    const nodes = convertRechtspraakToLegalNodes(uitspraak);
    
    // Store nodes
    await storeLegalNodes(nodes);
    console.log(`  Stored ${nodes.length} nodes`);
    
    // Generate and store TOC
    const toc = generateCaseTOC(uitspraak);
    await storeTOCCache({
      documentId: ecli,
      sourceType: 'JURISPRUDENTIE',
      tocData: toc,
      title: uitspraak.titel,
      rechtsgebied: uitspraak.rechtsgebieden?.[0] ? 
        mapRechtsgebied(uitspraak.rechtsgebieden[0]) : undefined,
      documentDate: uitspraak.uitspraakDatum ? new Date(uitspraak.uitspraakDatum) : undefined,
      nodeCount: nodes.length,
    });
    console.log(`  Stored TOC`);
    
    // Extract and store LiDO citations
    for (const node of nodes) {
      const citations = recognizeLiDOCitations(node.contentText, node.nodeId);
      if (citations.length > 0) {
        console.log(`  Found ${citations.length} citations in ${node.nodeId}`);
        // Store citations in database
        for (const citation of citations) {
          await db.execute(sql`
            INSERT INTO "legal_citations" (
              "id", "source_node_id", "target_id", "citation_type", "context", "is_lido", "created_at"
            ) VALUES (
              gen_random_uuid(), ${citation.sourceNodeId}, ${citation.targetId},
              ${citation.citationType}, ${citation.context || null}, ${citation.isLiDO}, NOW()
            )
            ON CONFLICT DO NOTHING
          `);
        }
      }
    }
    
    console.log(`  ✓ Successfully ingested ${ecli}\n`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to ingest ${ecli}:`, error);
    return false;
  }
}

function mapRechtsgebied(str: string): 'CIVIEL_RECHT' | 'STRAFRECHT' | 'BESTUURSRECHT' | 'ARBEIDSRECHT' | 'FISCAAL_RECHT' | 'EUROPEES_RECHT' | 'OVERIG' {
  const mapping: Record<string, 'CIVIEL_RECHT' | 'STRAFRECHT' | 'BESTUURSRECHT' | 'ARBEIDSRECHT' | 'FISCAAL_RECHT' | 'EUROPEES_RECHT' | 'OVERIG'> = {
    'Civiel recht': 'CIVIEL_RECHT',
    'Strafrecht': 'STRAFRECHT',
    'Bestuursrecht': 'BESTUURSRECHT',
    'Arbeidsrecht': 'ARBEIDSRECHT',
    'Fiscaal recht': 'FISCAAL_RECHT',
    'Europees recht': 'EUROPEES_RECHT',
  };
  return mapping[str] || 'OVERIG';
}

async function main() {
  // Example ECLIs to ingest
  const testECLIs = [
    'ECLI:NL:HR:2023:123', // Example - replace with real ECLIs
  ];
  
  console.log('========================================');
  console.log('RECHTSPRAAK DATA INGESTION');
  console.log('========================================\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const ecli of testECLIs) {
    const success = await ingestCase(ecli);
    if (success) successCount++;
    else failCount++;
  }
  
  console.log('========================================');
  console.log('INGESTION COMPLETE');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('========================================');
  
  await closeDb();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeDb();
  process.exit(1);
});
