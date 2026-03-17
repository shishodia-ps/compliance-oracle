#!/usr/bin/env tsx
// ============================================
// FETCH ERFRECHT (BW Boek 4) - SPECIAL SCRIPT
// Correct BWB ID: BWBR0002761
// ============================================

import { closeDb } from '@/lib/db';
import { 
  fetchBWBRegeling, 
  parseBWBXML, 
  convertToLegalNodes,
  generateLegislationTOC 
} from '@/lib/legal-ai/parsers/koop_parser';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';

async function ingestErfrecht() {
  const law = {
    bwbId: 'BWBR0002761',
    citeertitel: 'Burgerlijk Wetboek Boek 4 (Erfrecht)',
    rechtsgebied: 'CIVIEL_RECHT' as const,
    description: 'Erfrecht en erfenissen',
    priority: 'high' as const,
  };
  
  const fullBwbId = `BWB:${law.bwbId}`;
  console.log(`Fetching ${law.citeertitel}...`);
  console.log(`URL: https://wetten.overheid.nl/${law.bwbId}`);
  
  try {
    // Fetch XML
    const xmlContent = await fetchBWBRegeling(fullBwbId);
    
    // Parse
    const wet = parseBWBXML(xmlContent, fullBwbId);
    
    console.log(`  Title: ${wet.citeertitel || wet.officieleTitel || 'N/A'}`);
    console.log(`  Hoofdstukken: ${wet.hoofdstukken.length}`);
    
    // Convert to nodes
    const nodes = convertToLegalNodes(wet);
    
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
    await storeLegalNodes(nodes);
    console.log(`  ✓ Stored ${nodes.length} nodes`);
    
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
    console.log(`  ✓ Stored TOC`);
    
    console.log(`\n✅ Successfully ingested ${law.citeertitel}!\n`);
    
    // Update progress file to remove the old failed entry
    const fs = await import('fs');
    const path = await import('path');
    const progressPath = path.join(__dirname, 'data', 'koop-progress.json');
    
    if (fs.existsSync(progressPath)) {
      const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      
      // Remove old failed entries for BWBR0005292
      progress.failed = progress.failed.filter((id: string) => id !== 'BWBR0005292');
      
      // Add new success
      if (!progress.completed.includes('BWBR0002761')) {
        progress.completed.push('BWBR0002761');
      }
      
      progress.stats.totalNodes += nodes.length;
      fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
      console.log('✓ Updated progress file');
    }
    
  } catch (error) {
    console.error(`  ✗ Failed:`, error);
    process.exit(1);
  }
  
  await closeDb();
}

ingestErfrecht().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeDb();
  process.exit(1);
});
