/**
 * Copy-critical: the approved sentence 'We validate, process and index the accepted
 * catalogue sample, then notify the partner when it is ready' and both
 * subject-to-agreement labels ship verbatim.
 */

export interface PilotStage {
  t: string;
  s: string;
  lbl: string;
  rx: string[];
  pt: string[];
  ev: string[];
  path?: string[];
  extra: string[];
}

export const STAGES: PilotStage[] = [
  {
    t: 'SCOPE',
    s: 'agree question · sample · criteria',
    lbl: 'STAGE 01 · SCOPE · FIT AND AGREEMENT FIRST',
    rx: [
      'Assesses fit against the qualification principles',
      'Proposes sample composition and evaluation method',
      'Drafts the scorecard for agreement',
    ],
    pt: [
      'Define the pilot question',
      'Nominate expert reviewers',
      'Confirm rights and sample availability',
    ],
    ev: ['Agreed scope document', 'Agreed scorecard with targets'],
    extra: ['no ingestion before approval'],
  },
  {
    t: 'INGEST',
    s: 'managed sftp · audio + csv',
    lbl: 'STAGE 02 · INGEST · THE LIVE MANAGED DELIVERY PATH',
    rx: [
      'Provisions your partner delivery area (managed SFTP)',
      'Receives authorised audio and the CSV manifest',
      'Holds the batch until .done arrives last',
    ],
    pt: ['Deliver authorised audio + matching manifest', 'Send the .done marker last'],
    ev: ['Delivery record', 'Batch-received confirmation'],
    path: ['managed sftp', 'audio + csv manifest', '.done sent last'],
    extra: [
      'formats: mp3 · wav · flac · aiff',
      'a partial upload never starts processing',
    ],
  },
  {
    t: 'INDEX',
    s: 'validate · process · private index',
    lbl: 'STAGE 03 · INDEX · VALIDATION AND PROFILING',
    rx: [
      'We validate, process and index the accepted catalogue sample, then notify the partner when it is ready',
      'Validation covers files, manifest and safety checks',
      'PYXIS-1 profiles accepted tracks (70+ characteristics)',
      'Completion notice arrives by webhook / the agreed operational channel',
    ],
    pt: ['Resolve validation feedback where needed'],
    ev: ['Validation summary', 'Indexed private sample'],
    path: ['validation', 'pyxis-1 processing', 'private index', 'partner notification'],
    extra: [
      'e.g. missing audio file',
      'duplicate isrc',
      'unsafe archive',
      'managed operational review, not instant or self-serve',
    ],
  },
  {
    t: 'TEST',
    s: 'ranked results per reference',
    lbl: 'STAGE 04 · TEST · YOUR REFERENCES, YOUR CATALOGUE',
    rx: [
      'Runs ranked retrieval for each agreed reference',
      'Provides scoped evaluation access',
    ],
    pt: [
      'Supply the agreed reference set',
      'Audition ranked results with your reviewers',
    ],
    ev: [
      'Ranked result sets per reference',
      'Structured track-analysis examples and versioned analysis outputs relevant to the agreed pilot use case',
    ],
    extra: [
      'uploaded references are measured separately from pre-indexed queries',
      'analysis outputs are structured data, scoped to the pilot use case',
    ],
  },
  {
    t: 'MEASURE',
    s: 'expert review · scorecard',
    lbl: 'STAGE 05 · MEASURE · THE AGREED SCORECARD, APPLIED',
    rx: [
      'Compiles scorecard measurements',
      'Records query and ingestion performance',
    ],
    pt: [
      'Expert review, blind or partially blind where practical',
      'Compare against your current method where agreed',
    ],
    ev: [
      'Relevance scorecard',
      'Performance summary',
      'Observations and limitations',
    ],
    extra: ['baseline comparison only where agreed, as not every pilot is an a/b test'],
  },
  {
    t: 'DECIDE',
    s: 'stop · extend · plan production',
    lbl: 'STAGE 06 · DECIDE · AN EVIDENCE-BASED OUTCOME',
    rx: ['Presents the findings dossier', 'Recommends production options'],
    pt: [
      'Joint findings review',
      'Evidence-based decision with your stakeholders',
    ],
    ev: [
      'Findings dossier',
      'Decision: stop · extend · plan production',
    ],
    extra: ['the pilot does not automatically convert into a contract'],
  },
];

export interface ScorecardRow {
  measure: string;
  assessment: string;
  deep?: boolean;
  targetSlot?: string;
  resultSlot?: string;
}

export const SCORECARD_PRIMARY: ScorecardRow[] = [
  {
    measure: 'Precision@10',
    assessment:
      'Proportion of the first ten results your agreed reviewers accept as musically relevant.',
  },
  {
    measure: 'Expert acceptance',
    assessment: 'How often catalogue experts consider the shortlist usable.',
  },
  {
    measure: 'Long-tail coverage',
    assessment: 'Whether relevant older or low-exposure recordings surface.',
  },
  {
    measure: 'Catalogue coverage',
    assessment:
      'Share of the accepted sample searchable and represented in the index.',
  },
  {
    measure: 'Zero-result rate',
    assessment: 'How often a valid reference fails to produce a useful shortlist.',
  },
];

export const SCORECARD_DEEP: ScorecardRow[] = [
  {
    measure: 'Pre-indexed catalogue query latency',
    assessment:
      'Median and P95 response times, measured after the sample catalogue has been indexed. These are never guaranteed.',
    deep: true,
  },
  {
    measure: 'Uploaded-reference processing',
    assessment:
      'Measured separately, because the reference must first be processed before searching the partner catalogue.',
    deep: true,
  },
  {
    measure: 'Ingestion quality',
    assessment:
      'Validation success, rejected files, and time from accepted batch to evaluation-ready.',
    deep: true,
  },
];

export const SCORECARD_OPTIONAL: ScorecardRow[] = [
  {
    measure: 'Preview-through rate',
    assessment: 'Do users play the results the system returns?',
    targetSlot: 'optional',
    resultSlot: 'partner data',
  },
  {
    measure: 'Save / shortlist-add',
    assessment: 'Do results enter real working shortlists?',
    targetSlot: 'optional',
    resultSlot: 'partner data',
  },
  {
    measure: 'Outbound click',
    assessment: 'Do results carry users onward in your product?',
    targetSlot: 'optional',
    resultSlot: 'partner data',
  },
  {
    measure: 'Repeat usage',
    assessment: 'Do your teams return with the next reference?',
    targetSlot: 'optional',
    resultSlot: 'partner data',
  },
  {
    measure: 'Conversion',
    assessment: 'Only where available and attributable in your analytics.',
    targetSlot: 'optional',
    resultSlot: 'partner data',
  },
];

export interface DossierItem {
  title: string;
  body: string;
}

export const DOSSIER_ITEMS: DossierItem[] = [
  { title: 'Scope & criteria', body: 'the agreed questions, sample and scorecard' },
  { title: 'Ingestion summary', body: 'validation results and the indexed sample' },
  {
    title: 'Evaluation access',
    body: 'scoped API key or agreed evaluation interface',
  },
  {
    title: 'Relevance evidence',
    body: 'ranked evaluations, scorecard, structured track-analysis examples scoped to the pilot use case',
  },
  { title: 'Performance summary', body: 'query and ingestion measurements' },
  {
    title: 'Catalogue observations',
    body: 'long-tail and metadata-review notes where relevant',
  },
  { title: 'Limitations & open questions', body: 'stated plainly' },
  { title: 'Production options', body: 'recommended next steps, reviewed jointly' },
];
