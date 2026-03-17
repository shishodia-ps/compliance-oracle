#!/usr/bin/env tsx

export type IngestionStageKind = 'koop' | 'rechtspraak' | 'eurlex' | 'guidance' | 'manual';

export interface IngestionStage {
  id: string;
  title: string;
  kind: IngestionStageKind;
  description: string;
  goal: string;
  notes: string[];
  bwbIds?: string[];
  documentIds?: string[];
  commandHint?: string;
}

export const INGESTION_STAGES: IngestionStage[] = [
  {
    id: 'koop-core-civil-labor',
    title: 'KOOP Core Civil + Labor Law',
    kind: 'koop',
    description: 'Foundational Dutch private-law and labor-law legislation needed for article-level legal questions.',
    goal: 'Fix obvious legislation gaps like BW Book 7 / 7A before adding more case law.',
    bwbIds: [
      'BWBR0005289',
      'BWBR0005034',
      'BWBR0005291',
      'BWBR0002761',
      'BWBR0005293',
      'BWBR0005294',
      'BWBR0005290',
      'BWBR0006000',
      'BWBR0002014',
      'BWBR0007748',
      'BWBR0002065',
      'BWBR0002638',
      'BWBR0013065',
    ],
    notes: [
      'Run this first. It closes the most visible article-level gaps.',
      'Includes BW Book 7 and Book 7A, which are currently missing in production.',
    ],
  },
  {
    id: 'koop-public-criminal-tax',
    title: 'KOOP Public + Criminal + Tax + Financial',
    kind: 'koop',
    description: 'Core administrative, criminal, tax, constitutional, environmental, and financial-supervision legislation.',
    goal: 'Broaden high-value legislation coverage before adding more jurisprudence volume, including compliance-critical laws like Wft and Wwft.',
    bwbIds: [
      'BWBR0001854',
      'BWBR0001903',
      'BWBR0002458',
      'BWBR0005537',
      'BWBR0002367',
      'BWBR0002527',
      'BWBR0027238',
      'BWBR0020368',
      'BWBR0024282',
      'BWBR0002320',
      'BWBR0001980',
      'BWBR0002200',
      'BWBR0001952',
      'BWBR0002629',
      'BWBR0002741',
      'BWBR0001840',
      'BWBR0002368',
    ],
    notes: [
      'This is the second legislation batch after private/labor coverage is repaired.',
      'Includes Wft and Wwft so compliance and AML questions are grounded in actual Dutch legislation before more case-law volume is added.',
      'Keeps the free official corpus broad without jumping straight into huge case-law volume.',
    ],
  },
  {
    id: 'koop-gap-fill-remaining',
    title: 'KOOP Gap Fill Remaining Laws',
    kind: 'koop',
    description: 'Any remaining Dutch laws already present in the curated KOOP catalog.',
    goal: 'Complete the curated KOOP set before adding new source families.',
    notes: [
      'This stage should be run only after the first two KOOP batches are complete.',
      'It intentionally finishes the curated catalog instead of adding random one-off laws.',
    ],
  },
  {
    id: 'rechtspraak-priority-foundation',
    title: 'Rechtspraak Priority Foundation',
    kind: 'rechtspraak',
    description: 'Landmark and seed case-law set from the current curated ECLI list.',
    goal: 'Keep jurisprudence useful without flooding storage immediately.',
    notes: [
      'Run after KOOP core batches so legal article questions are grounded in legislation first.',
      'Uses the existing curated priority ECLI list only.',
    ],
  },
  {
    id: 'rechtspraak-next-50000',
    title: 'Rechtspraak Next 50k',
    kind: 'manual',
    description: 'Mass ingest the next 50,000 Rechtspraak cases once legislation foundation is stable.',
    goal: 'Add breadth and practical jurisprudence coverage without trying to ingest the whole corpus.',
    commandHint: 'npx tsx scripts/legal-ai/mass-ingest-rechtspraak.ts',
    notes: [
      'Keep this for the end, exactly as requested.',
      'Only start this when storage and indexing behavior are confirmed healthy.',
    ],
  },
  {
    id: 'eurlex-aml-package',
    title: 'EUR-Lex AML Package',
    kind: 'eurlex',
    description: 'Ingest the free EU AML package and other high-value EU legislation from official sources.',
    goal: 'Support AMLR/AMLD/AMLA questions from actual legislation instead of model memory.',
    documentIds: ['amlr', 'amla', 'amld6'],
    notes: [
      'This is free official EU legislation, not commercial content.',
      'Fetches the official EUR-Lex HTML text in Dutch first, then English as fallback.',
    ],
  },
  {
    id: 'official-guidance-supervisors',
    title: 'Official Guidance and Supervisors',
    kind: 'guidance',
    description: 'Add official guidance from DNB, AFM, AP, and other free regulator sources as guidance documents.',
    goal: 'Separate practical guidance from black-letter law while keeping both searchable.',
    documentIds: [
      'dnb-wwft-introductie',
      'afm-wwft-theme',
      'afm-wwft-leidraad',
      'ap-avg-algemeen',
      'ap-verantwoordingsplicht',
    ],
    notes: [
      'Stored as WETGEVING nodes with metadata.documentKind = GUIDANCE until the source-type enum is widened.',
      'This is the right place for free practical materials after law + case-law basics are stable.',
    ],
  },
];

export const DEFAULT_INGESTION_ORDER = [
  'koop-core-civil-labor',
  'koop-public-criminal-tax',
  'koop-gap-fill-remaining',
  'eurlex-aml-package',
  'official-guidance-supervisors',
  'rechtspraak-priority-foundation',
  'rechtspraak-next-50000',
];

export function getStageById(stageId: string): IngestionStage | undefined {
  return INGESTION_STAGES.find((stage) => stage.id === stageId);
}
