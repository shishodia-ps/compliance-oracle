#!/usr/bin/env tsx

import { sql } from 'drizzle-orm';
import { db, closeDb } from '@/lib/db';
import { createCompletion } from '@/lib/modules/moonshot-client';

type ClassifiableEdgeType = 'CITES' | 'APPLIES_LAW' | 'OVERRIDES' | 'EXCEPTS';
type ClassificationStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface EdgeLeaseRow {
  id: string;
  source_node_id: string;
  target_node_id: string;
}

interface NodeContextRow {
  node_id: string;
  source_type: string;
  content_text: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
}

interface ParsedArgs {
  batchSize: number;
  once: boolean;
}

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_IDLE_MS = 2000;
const SOURCE_SNIPPET_LIMIT = 2500;
const SYSTEM_PROMPT = [
  'You are a strict Dutch legal citation classifier.',
  'Choose exactly one edge type from: CITES, APPLIES_LAW, OVERRIDES, EXCEPTS.',
  'Rules:',
  '1. Use APPLIES_LAW when a case specifically applies the cited law to facts.',
  '2. Use OVERRIDES only for explicit overrulings.',
  '3. Use EXCEPTS for explicit exceptions.',
  '4. Default to CITES.',
  'Return ONLY valid JSON: {"edgeType":"...", "reason":"..."}.',
  'CRITICAL: Do not include code snippets, unescaped quotes, or newlines in the reason string.',
].join(' ');

function parseArgs(argv: string[]): ParsedArgs {
  let batchSize = DEFAULT_BATCH_SIZE;
  let once = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--batch-size') {
      const next = argv[i + 1];
      const parsed = Number.parseInt(next || '', 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        batchSize = parsed;
        i += 1;
      }
      continue;
    }
    if (arg === '--once') {
      once = true;
    }
  }

  return { batchSize, once };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimSnippet(value: string | null | undefined, maxLength = SOURCE_SNIPPET_LIMIT): string {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  
  // Try normal JSON parsing first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Fall through
  }

  // Try extracting from code fences
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Fall through
    }
  }

  // Try extracting any { ... } block
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Fall through
    }
  }

  // Final fallback: Regex for edgeType/edge_type
  const edgeTypeMatch = trimmed.match(/"(?:edgeType|edge_type)"\s*:\s*"([^"]+)"/i);
  if (edgeTypeMatch) {
    return { edgeType: edgeTypeMatch[1] };
  }

  return null;
}

function parseEdgeType(raw: string): ClassifiableEdgeType | null {
  const upper = raw.trim().toUpperCase();
  if (upper === 'CITES' || upper === 'APPLIES_LAW' || upper === 'OVERRIDES' || upper === 'EXCEPTS') {
    return upper;
  }
  return null;
}

async function leasePendingEdges(batchSize: number): Promise<EdgeLeaseRow[]> {
  const rows = await db.transaction(async (tx) => tx.execute(sql`
    WITH picked AS (
      SELECT id, source_node_id, target_node_id
      FROM legal_edges
      WHERE classification_status = 'PENDING'::legal_edge_classification_status
      ORDER BY created_at, id
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE legal_edges AS edges
    SET classification_status = 'PROCESSING'::legal_edge_classification_status
    FROM picked
    WHERE edges.id = picked.id
    RETURNING edges.id, edges.source_node_id, edges.target_node_id
  `));

  return rows as unknown as EdgeLeaseRow[];
}

async function loadNodeContexts(nodeIds: string[]): Promise<Map<string, NodeContextRow>> {
  if (nodeIds.length === 0) {
    return new Map();
  }

  const rows = await db.execute(sql`
    SELECT node_id, source_type, content_text, content, metadata
    FROM legal_nodes
    WHERE node_id IN (${sql.join(nodeIds.map((id) => sql`${id}`), sql`, `)})
  `);

  const map = new Map<string, NodeContextRow>();
  for (const row of rows as unknown as NodeContextRow[]) {
    map.set(row.node_id, row);
  }
  return map;
}

function buildClassificationPrompt(edge: EdgeLeaseRow, sourceNode: NodeContextRow | undefined, targetNode: NodeContextRow | undefined): string {
  const sourceTitle = String(sourceNode?.metadata?.title || sourceNode?.node_id || edge.source_node_id);
  const targetTitle = String(targetNode?.metadata?.title || targetNode?.node_id || edge.target_node_id);
  const sourceText = trimSnippet(sourceNode?.content_text || sourceNode?.content);
  const targetText = trimSnippet(targetNode?.content_text || targetNode?.content);

  return [
    `Source node: ${edge.source_node_id}`,
    `Source title: ${sourceTitle}`,
    `Source type: ${sourceNode?.source_type || 'UNKNOWN'}`,
    `Source excerpt: ${sourceText || '[missing]'}`,
    '',
    `Target node: ${edge.target_node_id}`,
    `Target title: ${targetTitle}`,
    `Target type: ${targetNode?.source_type || 'UNKNOWN'}`,
    `Target excerpt: ${targetText || '[missing]'}`,
    '',
    'Classify the legal relationship from source to target.',
    'Return only JSON.',
  ].join('\n');
}

async function markFailed(edgeId: string, reason: string): Promise<void> {
  console.error(`[edges] ${edgeId} failed: ${reason}`);
  await db.execute(sql`
    UPDATE legal_edges
    SET classification_status = 'FAILED'::legal_edge_classification_status
    WHERE id = ${edgeId}::uuid
  `);
}

async function markCompleted(edgeId: string, edgeType: ClassifiableEdgeType): Promise<void> {
  await db.execute(sql`
    UPDATE legal_edges
    SET edge_type = ${edgeType}::legal_edge_type,
        classification_status = 'COMPLETED'::legal_edge_classification_status
    WHERE id = ${edgeId}::uuid
  `);
}

async function classifyEdge(edge: EdgeLeaseRow, nodeMap: Map<string, NodeContextRow>): Promise<void> {
  const sourceNode = nodeMap.get(edge.source_node_id);
  const targetNode = nodeMap.get(edge.target_node_id);

  if (!sourceNode || !targetNode) {
    await markFailed(edge.id, 'missing source or target node');
    return;
  }

  const response = await createCompletion({
    prompt: buildClassificationPrompt(edge, sourceNode, targetNode),
    systemPrompt: SYSTEM_PROMPT,
    temperature: 1,
    maxTokens: 200,
    requestId: `edge-classify-${edge.id}`,
  });

  if (!response.success || !response.data?.content) {
    const message = response.error?.message || 'classification request failed';
    await markFailed(edge.id, message);
    return;
  }

  const parsed = parseJsonObject(response.data.content);
  const edgeType = parseEdgeType(String(parsed?.edgeType || parsed?.edge_type || ''));
  if (!edgeType) {
    await markFailed(edge.id, `invalid classifier output: ${response.data.content}`);
    return;
  }

  await markCompleted(edge.id, edgeType);
}

async function processBatch(batchSize: number): Promise<number> {
  const leasedEdges = await leasePendingEdges(batchSize);
  if (leasedEdges.length === 0) {
    return 0;
  }

  const nodeIds = [...new Set(leasedEdges.flatMap((edge) => [edge.source_node_id, edge.target_node_id]))];
  const nodeMap = await loadNodeContexts(nodeIds);

  for (const edge of leasedEdges) {
    try {
      await classifyEdge(edge, nodeMap);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markFailed(edge.id, message);
    }
  }

  return leasedEdges.length;
}

async function main(): Promise<void> {
  const { batchSize, once } = parseArgs(process.argv.slice(2));
  console.log(`[edges] starting classifier with batch size ${batchSize}${once ? ' (once)' : ''}`);

  try {
    while (true) {
      const leasedEdges = await leasePendingEdges(batchSize);
      if (leasedEdges.length === 0) {
        if (once) {
          console.log('[edges] no pending edges found');
          break;
        }
        await sleep(DEFAULT_IDLE_MS);
        continue;
      }

      console.log(`[edges] processing batch of ${leasedEdges.length} edge(s)...`);
      const nodeIds = [...new Set(leasedEdges.flatMap((edge) => [edge.source_node_id, edge.target_node_id]))];
      const nodeMap = await loadNodeContexts(nodeIds);

      let processedCount = 0;
      for (const edge of leasedEdges) {
        processedCount += 1;
        if (processedCount % 5 === 0 || processedCount === leasedEdges.length) {
          console.log(`[edges] progress: ${processedCount}/${leasedEdges.length}`);
        }

        try {
          await classifyEdge(edge, nodeMap);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await markFailed(edge.id, message);
        }
      }

      console.log(`[edges] completed batch of ${leasedEdges.length} edge(s)`);
      if (once) {
        break;
      }
    }
  } finally {
    await closeDb();
  }
}

main().catch(async (error) => {
  console.error('[edges] fatal error', error);
  await closeDb();
  process.exitCode = 1;
});
