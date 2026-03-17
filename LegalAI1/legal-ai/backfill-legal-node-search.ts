import { sql } from 'drizzle-orm';
import { closeDb, db } from '@/lib/db';

type BackfillOptions = {
  batchSize: number;
  maxBatches: number | null;
  afterNodeId: string | null;
};

type NodeBatchRow = {
  nodeId: string;
};

function parseArgs(argv: string[]): BackfillOptions {
  let batchSize = 500;
  let maxBatches: number | null = null;
  let afterNodeId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === '--batch-size' && value) {
      batchSize = Number.parseInt(value, 10);
      index += 1;
      continue;
    }

    if (arg === '--max-batches' && value) {
      maxBatches = Number.parseInt(value, 10);
      index += 1;
      continue;
    }

    if (arg === '--after-node-id' && value) {
      afterNodeId = value;
      index += 1;
      continue;
    }
  }

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --batch-size: ${String(batchSize)}`);
  }

  if (maxBatches !== null && (!Number.isInteger(maxBatches) || maxBatches <= 0)) {
    throw new Error(`Invalid --max-batches: ${String(maxBatches)}`);
  }

  return { batchSize, maxBatches, afterNodeId };
}

async function fetchBatch(afterNodeId: string | null, batchSize: number): Promise<string[]> {
  const result = await db.execute<NodeBatchRow>(sql`
    SELECT node_id AS "nodeId"
    FROM legal_nodes
    WHERE ${afterNodeId === null ? sql`TRUE` : sql`node_id > ${afterNodeId}`}
    ORDER BY node_id
    LIMIT ${batchSize}
  `);

  return result.rows.map((row) => row.nodeId);
}

async function updateBatch(nodeIds: string[]): Promise<number> {
  if (nodeIds.length === 0) {
    return 0;
  }

  const updateResult = await db.execute(sql`
    UPDATE legal_nodes AS ln
    SET
      search_language = public.legal_nodes_resolve_search_language(ln.metadata),
      search_vector_legal = public.legal_nodes_build_search_vector(
        public.legal_nodes_resolve_search_language(ln.metadata),
        ln.content_text,
        ln.content
      )
    WHERE ln.node_id = ANY(${nodeIds})
  `);

  return updateResult.rowCount ?? 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  let cursor = options.afterNodeId;
  let batchNumber = 0;
  let totalRows = 0;

  console.log(
    `[backfill-legal-node-search] Starting with batchSize=${options.batchSize}, ` +
      `maxBatches=${options.maxBatches ?? 'unbounded'}, afterNodeId=${cursor ?? '<start>'}`
  );

  while (options.maxBatches === null || batchNumber < options.maxBatches) {
    const nodeIds = await fetchBatch(cursor, options.batchSize);

    if (nodeIds.length === 0) {
      break;
    }

    batchNumber += 1;
    const updatedRows = await updateBatch(nodeIds);
    totalRows += updatedRows;
    cursor = nodeIds[nodeIds.length - 1] ?? cursor;

    console.log(
      `[backfill-legal-node-search] Batch ${batchNumber} updated ${updatedRows} rows; cursor=${cursor}`
    );
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[backfill-legal-node-search] Completed ${batchNumber} batches, updated ${totalRows} rows in ${elapsedMs}ms`
  );
}

main()
  .catch((error) => {
    console.error('[backfill-legal-node-search] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
