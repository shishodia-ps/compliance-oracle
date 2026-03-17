#!/usr/bin/env tsx
// ============================================
// KOOP/BWB DATA INGESTION SCRIPT
// Ingests legislation from wetten.overheid.nl
// ============================================

import { closeDb } from '@/lib/db';
import { 
  fetchBWBRegeling, 
  parseBWBXML, 
  convertToLegalNodes,
  generateLegislationTOC 
} from '@/lib/legal-ai/parsers/koop_parser';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';

// Important Dutch laws to ingest
const IMPORTANT_LAWS = [
  'BWBR0005290', // Burgerlijk Wetboek Boek 7
  'BWBR0006000', // Burgerlijk Wetboek Boek 7A
  'BWBR0001854', // Wetboek van Strafrecht (Criminal Code)
  'BWBR0001903', // Wetboek van Strafvordering (Criminal Procedure)
  'BWBR0005537', // Algemene Wet Bestuursrecht (General Administrative Law)
  'BWBR0001840', // Grondwet (Constitution)
];

async function ingestLaw(bwbId: string) {
  const fullBwbId = `BWB:${bwbId}`;
  console.log(`Ingesting law: ${fullBwbId}`);
  
  try {
    // Fetch XML
    const xmlContent = await fetchBWBRegeling(fullBwbId);
    
    // Parse XML
    const wet = parseBWBXML(xmlContent, fullBwbId);
    console.log(`  Title: ${wet.citeertitel || wet.officieleTitel || 'N/A'}`);
    console.log(`  Hoofdstukken: ${wet.hoofdstukken.length}`);
    
    // Convert to legal nodes
    const nodes = convertToLegalNodes(wet);
    
    // Store nodes
    await storeLegalNodes(nodes);
    console.log(`  Stored ${nodes.length} nodes`);
    
    // Generate and store TOC
    const toc = generateLegislationTOC(wet);
    await storeTOCCache({
      documentId: fullBwbId,
      sourceType: 'WETGEVING',
      tocData: toc,
      title: wet.citeertitel || wet.officieleTitel,
      documentDate: wet.regelingDatum ? new Date(wet.regelingDatum) : undefined,
      nodeCount: nodes.length,
    });
    console.log(`  Stored TOC`);
    
    console.log(`  ✓ Successfully ingested ${fullBwbId}\n`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to ingest ${fullBwbId}:`, error);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('KOOP/BWB DATA INGESTION');
  console.log('========================================\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const bwbId of IMPORTANT_LAWS) {
    const success = await ingestLaw(bwbId);
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
