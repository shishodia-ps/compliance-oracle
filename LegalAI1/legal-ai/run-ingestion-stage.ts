#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { closeDb } from '@/lib/db';
import { DUTCH_LAWS, ingestLawWithRetry } from './batch-ingest-koop';
import { PRIORITY_CASES, ingestCaseWithRetry } from './batch-ingest-rechtspraak';
import { EUR_LEX_AML_DOCUMENTS, ingestEurLexAmlDocumentWithRetry } from './ingest-eurlex-aml';
import { OFFICIAL_GUIDANCE_DOCUMENTS, ingestOfficialGuidanceWithRetry } from './ingest-official-guidance';
import {
  DEFAULT_INGESTION_ORDER,
  getStageById,
  INGESTION_STAGES,
  type IngestionStage,
} from './ingestion-catalog';
import type { Rechtsgebied } from '@/lib/legal-ai/types';

const STATUS_FILE = path.join(__dirname, 'data', 'ingestion-stage-status.json');

type StageStatusValue = 'pending' | 'in_progress' | 'completed' | 'failed' | 'manual';

interface StageStatusEntry {
  status: StageStatusValue;
  startedAt?: string;
  completedAt?: string;
  notes?: string[];
  error?: string;
}

type StageStatusMap = Record<string, StageStatusEntry>;

function loadStageStatus(): StageStatusMap {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')) as StageStatusMap;
      const normalized = INGESTION_STAGES.reduce<StageStatusMap>((acc, stage) => {
        const existing = parsed[stage.id];
        const defaultStatus = stage.kind === 'manual' ? 'manual' : 'pending';

        if (!existing) {
          acc[stage.id] = { status: defaultStatus };
          return acc;
        }

        acc[stage.id] = {
          ...existing,
          status:
            existing.status === 'manual' && stage.kind !== 'manual'
              ? 'pending'
              : existing.status,
        };
        return acc;
      }, {});

      return normalized;
    }
  } catch (error) {
    console.error('Failed to load ingestion stage status:', error);
  }

  return INGESTION_STAGES.reduce<StageStatusMap>((acc, stage) => {
    acc[stage.id] = { status: stage.kind === 'manual' ? 'manual' : 'pending' };
    return acc;
  }, {});
}

function saveStageStatus(statusMap: StageStatusMap) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(statusMap, null, 2));
}

function formatStatusLine(stage: IngestionStage, entry: StageStatusEntry): string {
  const meta = [
    `id=${stage.id}`,
    `kind=${stage.kind}`,
    `status=${entry.status}`,
  ];

  if (entry.completedAt) {
    meta.push(`completed=${entry.completedAt}`);
  }

  return `- ${stage.title}\n  ${meta.join(' | ')}\n  ${stage.description}\n  Goal: ${stage.goal}`;
}

function printStageList(statusMap: StageStatusMap) {
  console.log('\nDutch legal ingestion rollout\n');
  for (const stageId of DEFAULT_INGESTION_ORDER) {
    const stage = getStageById(stageId)!;
    const entry = statusMap[stage.id] ?? { status: stage.kind === 'manual' ? 'manual' : 'pending' };
    console.log(formatStatusLine(stage, entry));
    if (stage.commandHint) {
      console.log(`  Command: ${stage.commandHint}`);
    }
    for (const note of stage.notes) {
      console.log(`  Note: ${note}`);
    }
    console.log('');
  }
}

function updateStageStatus(
  statusMap: StageStatusMap,
  stageId: string,
  next: Partial<StageStatusEntry>,
) {
  statusMap[stageId] = {
    ...(statusMap[stageId] ?? { status: 'pending' }),
    ...next,
  };
  saveStageStatus(statusMap);
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === '--list') {
      args.set('list', true);
      continue;
    }
    if (part === '--complete') {
      args.set('complete', argv[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (part === '--stage') {
      args.set('stage', argv[i + 1] ?? '');
      i += 1;
      continue;
    }
  }
  return args;
}

async function runKoopStage(stage: IngestionStage): Promise<boolean> {
  const requestedIds = new Set(stage.bwbIds ?? []);
  const completedIds: string[] = [];
  let ok = true;

  for (const law of DUTCH_LAWS) {
    const shouldInclude =
      stage.id === 'koop-gap-fill-remaining'
        ? !DEFAULT_INGESTION_ORDER
            .map((stageId) => getStageById(stageId))
            .filter((candidate): candidate is IngestionStage => Boolean(candidate))
            .filter((candidate) => candidate.kind === 'koop' && candidate.id !== 'koop-gap-fill-remaining')
            .some((candidate) => (candidate.bwbIds ?? []).includes(law.bwbId))
        : requestedIds.has(law.bwbId);

    if (!shouldInclude) {
      continue;
    }

    console.log(`\n[KOOP] ${law.bwbId} - ${law.citeertitel}`);
    const success = await ingestLawWithRetry(law);
    if (success) {
      completedIds.push(law.bwbId);
    } else {
      ok = false;
    }
  }

  console.log(`\nCompleted KOOP stage ${stage.id}: ${completedIds.length} laws processed.`);
  return ok;
}

async function runRechtspraakStage(stage: IngestionStage): Promise<boolean> {
  if (stage.id !== 'rechtspraak-priority-foundation') {
    throw new Error(`Unsupported Rechtspraak stage: ${stage.id}`);
  }

  let ok = true;
  for (const [rechtsgebied, eclis] of Object.entries(PRIORITY_CASES)) {
    console.log(`\n[RECHTSPRAAK] ${rechtsgebied} - ${eclis.length} curated cases`);
    for (const ecli of eclis) {
      const success = await ingestCaseWithRetry(ecli, rechtsgebied as Rechtsgebied);
      if (!success) {
        ok = false;
      }
    }
  }

  return ok;
}

async function runEurLexStage(stage: IngestionStage): Promise<boolean> {
  const requestedIds = new Set(stage.documentIds ?? []);
  let ok = true;

  for (const document of EUR_LEX_AML_DOCUMENTS) {
    if (requestedIds.size > 0 && !requestedIds.has(document.id)) {
      continue;
    }

    console.log(`\n[EUR-LEX] ${document.celex} - ${document.title}`);
    try {
      const success = await ingestEurLexAmlDocumentWithRetry(document);
      if (!success) {
        ok = false;
      }
    } catch (error) {
      console.error(`Failed EUR-Lex document ${document.celex}:`, error);
      ok = false;
    }
  }

  return ok;
}

async function runGuidanceStage(stage: IngestionStage): Promise<boolean> {
  const requestedIds = new Set(stage.documentIds ?? []);
  let ok = true;

  for (const document of OFFICIAL_GUIDANCE_DOCUMENTS) {
    if (requestedIds.size > 0 && !requestedIds.has(document.id)) {
      continue;
    }

    console.log(`\n[GUIDANCE] ${document.authority} - ${document.title}`);
    try {
      const success = await ingestOfficialGuidanceWithRetry(document);
      if (!success) {
        ok = false;
      }
    } catch (error) {
      console.error(`Failed guidance document ${document.id}:`, error);
      ok = false;
    }
  }

  return ok;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const statusMap = loadStageStatus();

  if (args.get('list')) {
    printStageList(statusMap);
    return;
  }

  const completeStageId = args.get('complete');
  if (typeof completeStageId === 'string' && completeStageId) {
    const stage = getStageById(completeStageId);
    if (!stage) {
      throw new Error(`Unknown stage: ${completeStageId}`);
    }
    updateStageStatus(statusMap, stage.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      notes: ['Marked completed manually.'],
    });
    console.log(`Marked stage ${stage.id} as completed.`);
    return;
  }

  const stageId = args.get('stage');
  if (typeof stageId !== 'string' || !stageId) {
    printStageList(statusMap);
    console.log('Usage:');
    console.log('  npx tsx scripts/legal-ai/run-ingestion-stage.ts --list');
    console.log('  npx tsx scripts/legal-ai/run-ingestion-stage.ts --stage <stage-id>');
    console.log('  npx tsx scripts/legal-ai/run-ingestion-stage.ts --complete <stage-id>');
    return;
  }

  const stage = getStageById(stageId);
  if (!stage) {
    throw new Error(`Unknown stage: ${stageId}`);
  }

  if (stage.kind === 'manual') {
    console.log(`Stage ${stage.id} is manual.`);
    if (stage.commandHint) {
      console.log(`Suggested command: ${stage.commandHint}`);
    }
    for (const note of stage.notes) {
      console.log(`- ${note}`);
    }
    return;
  }

  updateStageStatus(statusMap, stage.id, {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  try {
    const successPromise = (() => {
      switch (stage.kind) {
        case 'koop':
          return runKoopStage(stage);
        case 'rechtspraak':
          return runRechtspraakStage(stage);
        case 'eurlex':
          return runEurLexStage(stage);
        case 'guidance':
          return runGuidanceStage(stage);
        default:
          throw new Error(`Unsupported stage kind: ${(stage as IngestionStage).kind}`);
      }
    })();
    const success = await successPromise;

    updateStageStatus(statusMap, stage.id, {
      status: success ? 'completed' : 'failed',
      completedAt: new Date().toISOString(),
      error: success ? undefined : 'One or more items failed. Check stage-level logs.',
    });

    if (!success) {
      process.exitCode = 1;
    }
  } catch (error) {
    updateStageStatus(statusMap, stage.id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await closeDb();
  }
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
