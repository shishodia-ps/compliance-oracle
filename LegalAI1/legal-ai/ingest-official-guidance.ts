#!/usr/bin/env tsx

import { closeDb } from '@/lib/db';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';
import type { LegalNodeData, Rechtsgebied, TOCEntry } from '@/lib/legal-ai/types';
import { fetchHtmlWithFallback, htmlToStructuredText } from './html-ingestion';

export interface OfficialGuidanceDocument {
  id: string;
  title: string;
  authority: 'DNB' | 'AFM' | 'AP';
  url: string;
  description: string;
  rechtsgebied: Rechtsgebied;
  subjects: string[];
  priority: 'high' | 'medium' | 'low';
}

export const OFFICIAL_GUIDANCE_DOCUMENTS: OfficialGuidanceDocument[] = [
  {
    id: 'dnb-wwft-introductie',
    title: 'DNB - Introductie Wwft',
    authority: 'DNB',
    url: 'https://www.dnb.nl/voor-de-sector/open-boek-toezicht/wet-regelgeving/wwft/introductie-wwft/',
    description: 'Official DNB guidance page introducing Wwft obligations and supervisory context.',
    rechtsgebied: 'BESTUURSRECHT',
    subjects: ['Wwft', 'AML', 'clientonderzoek', 'meldplicht'],
    priority: 'high',
  },
  {
    id: 'afm-wwft-theme',
    title: 'AFM - Wwft theme page',
    authority: 'AFM',
    url: 'https://www.afm.nl/nl-nl/sector/themas/belangrijke-europese-wet--en-regelgeving/wwft',
    description: 'Official AFM thematic guidance around Wwft obligations and supervisory expectations.',
    rechtsgebied: 'BESTUURSRECHT',
    subjects: ['Wwft', 'AML', 'sanctiewet', 'toezicht'],
    priority: 'high',
  },
  {
    id: 'afm-wwft-leidraad',
    title: 'AFM - Leidraad Wwft en Sanctiewet',
    authority: 'AFM',
    url: 'https://www.afm.nl/nl-nl/sector/actueel/2024/juni/leidraad-wwft',
    description: 'Official AFM guidance update for Wwft and Sanctions Act interpretation.',
    rechtsgebied: 'BESTUURSRECHT',
    subjects: ['Wwft', 'Sanctiewet', 'leidraad', 'AML'],
    priority: 'high',
  },
  {
    id: 'ap-avg-algemeen',
    title: 'Autoriteit Persoonsgegevens - Algemene informatie AVG',
    authority: 'AP',
    url: 'https://autoriteitpersoonsgegevens.nl/onderwerpen/basis-avg/avg-algemeen/algemene-informatie-avg',
    description: 'Official AP overview of the GDPR / AVG obligations and concepts.',
    rechtsgebied: 'EUROPEES_RECHT',
    subjects: ['AVG', 'GDPR', 'privacy', 'gegevensbescherming'],
    priority: 'high',
  },
  {
    id: 'ap-verantwoordingsplicht',
    title: 'Autoriteit Persoonsgegevens - Verantwoordingsplicht',
    authority: 'AP',
    url: 'https://autoriteitpersoonsgegevens.nl/themas/basis-avg/avg-algemeen/verantwoordingsplicht',
    description: 'Official AP explanation of accountability obligations under the GDPR / AVG.',
    rechtsgebied: 'EUROPEES_RECHT',
    subjects: ['AVG', 'GDPR', 'verantwoordingsplicht', 'accountability'],
    priority: 'medium',
  },
];

function createGuidanceTocAndSections(
  baseNodeId: string,
  structuredText: string,
  metadataBase: Record<string, unknown>,
  sourceUrl: string,
): { nodes: LegalNodeData[]; toc: TOCEntry[] } {
  const lines = structuredText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Array<{ title: string; paragraphs: string[] }> = [];
  let current: { title: string; paragraphs: string[] } | null = null;

  for (const line of lines) {
    const normalized = line.replace(/^##\s*/, '').trim();
    const looksLikeHeading =
      line.startsWith('## ') ||
      (/^[A-Z][A-Za-zÀ-ÿ0-9 ,()/'-]{8,120}$/.test(normalized) && !normalized.endsWith('.'));

    if (looksLikeHeading) {
      current = { title: normalized, paragraphs: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { title: 'Overview', paragraphs: [] };
      sections.push(current);
    }

    current.paragraphs.push(line);
  }

  const nodes: LegalNodeData[] = [];
  const toc: TOCEntry[] = [];

  sections.forEach((section, index) => {
    const contentText = section.paragraphs.join('\n').trim();
    if (!contentText) {
      return;
    }

    const nodeId = `${baseNodeId}:section:${index + 1}`;
    nodes.push({
      nodeId,
      parentId: baseNodeId,
      sourceType: 'WETGEVING',
      rechtsgebied: metadataBase.rechtsgebied as Rechtsgebied,
      metadata: {
        ...metadataBase,
        title: section.title,
        sectionTitle: section.title,
        sectionIndex: index + 1,
      },
      content: `<section><h2>${section.title}</h2><p>${contentText.replace(/\n/g, '</p><p>')}</p></section>`,
      contentText,
      level: 2,
      displayOrder: index + 1,
      sourceUrl,
    });

    toc.push({
      nodeId,
      title: section.title,
      level: 2,
    });
  });

  return { nodes, toc };
}

export async function ingestOfficialGuidanceWithRetry(document: OfficialGuidanceDocument): Promise<boolean> {
  const fetched = await fetchHtmlWithFallback([{ url: document.url, language: 'NL' }]);
  const structured = htmlToStructuredText(fetched.html);

  if (!structured.text || structured.text.length < 300) {
    throw new Error(`Guidance content for ${document.id} is too short to ingest`);
  }

  const baseNodeId = `GUIDANCE:${document.authority}:${document.id}`;
  const metadataBase = {
    identifier: document.id,
    title: structured.title || document.title,
    description: document.description,
    authority: document.authority,
    ingestionSource: 'OFFICIELE_BEKENDMAKINGEN',
    documentKind: 'GUIDANCE',
    sourceFamily: 'OFFICIAL_GUIDANCE',
    rechtsgebied: document.rechtsgebied,
    priority: document.priority,
    subject: document.subjects,
  };

  const rootNode: LegalNodeData = {
    nodeId: baseNodeId,
    sourceType: 'WETGEVING',
    rechtsgebied: document.rechtsgebied,
    metadata: metadataBase,
    content: `<article><h1>${structured.title || document.title}</h1><p>${structured.text.replace(/\n/g, '</p><p>')}</p></article>`,
    contentText: structured.text,
    level: 1,
    displayOrder: 1,
    sourceUrl: fetched.url,
  };

  const { nodes: sectionNodes, toc } = createGuidanceTocAndSections(
    baseNodeId,
    structured.text,
    metadataBase,
    fetched.url,
  );

  const allNodes = [rootNode, ...sectionNodes];
  await storeLegalNodes(allNodes);
  await storeTOCCache({
    documentId: baseNodeId,
    sourceType: 'WETGEVING',
    tocData: toc,
    title: structured.title || document.title,
    summary: document.description,
    rechtsgebied: document.rechtsgebied,
    nodeCount: allNodes.length,
  });

  return true;
}

async function main() {
  let failed = 0;

  for (const document of OFFICIAL_GUIDANCE_DOCUMENTS) {
    console.log(`\n[GUIDANCE] ${document.authority} - ${document.title}`);
    try {
      await ingestOfficialGuidanceWithRetry(document);
      console.log(`  Stored ${document.id}`);
    } catch (error) {
      failed += 1;
      console.error(`  Failed ${document.id}:`, error);
    }
  }

  await closeDb();
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
}
