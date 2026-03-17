#!/usr/bin/env tsx

import { closeDb } from '@/lib/db';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';
import type { LegalEdgeData, LegalNodeData, Rechtsgebied, TOCEntry } from '@/lib/legal-ai/types';
import { recognizeLiDOCitations } from '@/lib/legal-ai/parsers/lido_mapper';
import { fetchHtmlWithFallback, htmlToStructuredText } from './html-ingestion';

export interface EurLexAmlDocument {
  id: string;
  celex: string;
  title: string;
  description: string;
  rechtsgebied: Rechtsgebied;
  priority: 'high' | 'medium' | 'low';
  subjects: string[];
}

export const EUR_LEX_AML_DOCUMENTS: EurLexAmlDocument[] = [
  {
    id: 'amlr',
    celex: '32024R1624',
    title: 'Regulation (EU) 2024/1624 (AMLR)',
    description: 'Single Rulebook anti-money laundering regulation for obliged entities and supervision.',
    rechtsgebied: 'EUROPEES_RECHT',
    priority: 'high',
    subjects: ['AMLR', 'AML', 'CFT', 'single rulebook'],
  },
  {
    id: 'amla',
    celex: '32024R1620',
    title: 'Regulation (EU) 2024/1620 (AMLA)',
    description: 'Regulation establishing the Anti-Money Laundering Authority.',
    rechtsgebied: 'EUROPEES_RECHT',
    priority: 'high',
    subjects: ['AMLA', 'AML', 'supervision'],
  },
  {
    id: 'amld6',
    celex: '32024L1640',
    title: 'Directive (EU) 2024/1640 (AMLD6 package)',
    description: 'EU anti-money laundering directive for national implementation and supervision.',
    rechtsgebied: 'EUROPEES_RECHT',
    priority: 'high',
    subjects: ['AMLD', 'AML', 'CFT', 'directive'],
  },
];

function createStructuralEdges(parentNodeId: string, childNodeId: string): LegalEdgeData[] {
  return [
    {
      sourceNodeId: childNodeId,
      targetNodeId: parentNodeId,
      edgeType: 'BELONGS_TO',
      weight: 1,
      validFrom: null,
      validUntil: null,
    },
    {
      sourceNodeId: parentNodeId,
      targetNodeId: childNodeId,
      edgeType: 'HAS_CHILD',
      weight: 1,
      validFrom: null,
      validUntil: null,
    },
  ];
}

function contextualizeEurLexSectionText(rootTitle: string, sectionTitle: string, text: string): string {
  const context = `[${rootTitle} -> ${sectionTitle}] `;
  return `${context}${text}`.trim();
}

function extractEurLexCitationEdges(sourceNodeId: string, text: string): LegalEdgeData[] {
  const edges: LegalEdgeData[] = [];
  const targets = new Set<string>();

  const directPatterns = [
    /CELEX:(3\d{4}[RLD]\d{4})/gi,
    /\b(3\d{4}[RLD]\d{4})\b/g,
    /\b(BWBR\d{7,})\b/gi,
    /\b(ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9]+)\b/g,
  ];

  for (const pattern of directPatterns) {
    for (const match of text.matchAll(pattern)) {
      const rawTarget = match[1];
      const normalizedTarget = rawTarget.startsWith('ECLI:')
        ? rawTarget
        : rawTarget.startsWith('BWBR')
          ? `BWB:${rawTarget.toUpperCase()}`
          : rawTarget.startsWith('CELEX:')
            ? rawTarget
            : /^3\d{4}[RLD]\d{4}$/i.test(rawTarget)
              ? `CELEX:${rawTarget.toUpperCase()}`
              : rawTarget;
      if (!normalizedTarget || normalizedTarget === sourceNodeId || targets.has(normalizedTarget)) {
        continue;
      }
      targets.add(normalizedTarget);
      edges.push({
        sourceNodeId,
        targetNodeId: normalizedTarget,
        edgeType: 'CITES',
        weight: 1,
        validFrom: null,
        validUntil: null,
      });
    }
  }

  for (const citation of recognizeLiDOCitations(text, sourceNodeId)) {
    const targetNodeId = citation.targetId.startsWith('BWBR')
      ? `BWB:${citation.targetId.toUpperCase()}`
      : citation.targetId;
    if (!targetNodeId || targetNodeId === sourceNodeId || targets.has(targetNodeId)) {
      continue;
    }
    targets.add(targetNodeId);
    edges.push({
      sourceNodeId,
      targetNodeId,
      edgeType: 'CITES',
      weight: 1,
      validFrom: null,
      validUntil: null,
    });
  }

  return edges;
}

function buildSectionNodes(
  baseNodeId: string,
  rootTitle: string,
  fullText: string,
  metadataBase: Record<string, unknown>,
  sourceUrl: string,
): { nodes: LegalNodeData[]; edges: LegalEdgeData[]; toc: TOCEntry[] } {
  const lines = fullText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headingPattern = /^(##\s*)?(article|artikel|chapter|hoofdstuk|section|afdeling|title|titel|recital|overweging)\s+[0-9ivxlcdm]+[a-z0-9\-.:() ]*$/i;
  const sections: Array<{ title: string; content: string[] }> = [];
  let current: { title: string; content: string[] } | null = null;

  for (const line of lines) {
    const normalized = line.replace(/^##\s*/, '').trim();
    if (headingPattern.test(normalized)) {
      current = { title: normalized, content: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { title: 'Overview', content: [] };
      sections.push(current);
    }

    current.content.push(line);
  }

  const nodes: LegalNodeData[] = [];
  const edges: LegalEdgeData[] = [];
  const toc: TOCEntry[] = [];

  sections.forEach((section, index) => {
    const contentText = section.content.join('\n').trim();
    if (!contentText) {
      return;
    }

    const nodeId = `${baseNodeId}:section:${index + 1}`;
    const contextualText = contextualizeEurLexSectionText(rootTitle, section.title, contentText);
    nodes.push({
      nodeId,
      parentId: baseNodeId,
      sourceType: 'WETGEVING',
      rechtsgebied: 'EUROPEES_RECHT',
      metadata: {
        ...metadataBase,
        title: section.title,
        sectionTitle: section.title,
        sectionIndex: index + 1,
      },
      content: `<h2>${section.title}</h2>\n<p>${contentText.replace(/\n/g, '</p><p>')}</p>`,
      contentText: contextualText,
      level: 2,
      displayOrder: index + 1,
      sourceUrl,
    });
    edges.push(...createStructuralEdges(baseNodeId, nodeId));
    edges.push(...extractEurLexCitationEdges(nodeId, contextualText));

    toc.push({
      nodeId,
      title: section.title,
      level: 2,
    });
  });

  return { nodes, edges, toc };
}

export async function ingestEurLexAmlDocumentWithRetry(
  document: EurLexAmlDocument,
): Promise<boolean> {
  const attempts = [
    { url: `https://eur-lex.europa.eu/legal-content/NL/TXT/HTML/?uri=CELEX:${document.celex}`, language: 'NL' },
    { url: `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${document.celex}`, language: 'EN' },
  ];

  const fetched = await fetchHtmlWithFallback(attempts);
  const structured = htmlToStructuredText(fetched.html);

  if (!structured.text || structured.text.length < 500) {
    throw new Error(`EUR-Lex content for ${document.celex} is too short to ingest`);
  }

  const baseNodeId = `CELEX:${document.celex}`;
  const metadataBase = {
    identifier: `CELEX:${document.celex}`,
    title: structured.title || document.title,
    description: document.description,
    celex: document.celex,
    ingestionSource: 'EUR_LEX',
    documentKind: 'EU_LEGISLATION',
    priority: document.priority,
    language: fetched.language || 'NL',
    subject: document.subjects,
    sourceFamily: 'EU AML PACKAGE',
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

  const { nodes: sectionNodes, edges: sectionEdges, toc } = buildSectionNodes(
    baseNodeId,
    structured.title || document.title,
    structured.text,
    metadataBase,
    fetched.url,
  );
  const allNodes = [rootNode, ...sectionNodes];
  const allEdges = extractEurLexCitationEdges(baseNodeId, rootNode.contentText).concat(sectionEdges);

  await storeLegalNodes(allNodes, allEdges);
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

  for (const document of EUR_LEX_AML_DOCUMENTS) {
    console.log(`\n[EUR-LEX] ${document.celex} - ${document.title}`);
    try {
      await ingestEurLexAmlDocumentWithRetry(document);
      console.log(`  Stored ${document.celex}`);
    } catch (error) {
      failed += 1;
      console.error(`  Failed ${document.celex}:`, error);
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
