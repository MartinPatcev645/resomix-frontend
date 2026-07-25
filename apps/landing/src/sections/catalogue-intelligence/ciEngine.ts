// Fictional catalogue only — labels, artists and tracks invented. Deterministic. Strategic views are pilot illustrations, not live modules.

/* ---------- deterministic prng ---------- */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFor(name: string): () => number {
  return mulberry32(hash(name));
}

export function drawCls(extra?: string) {
  return extra ? `ci-draw ${extra}` : 'ci-draw';
}

/* ---------- field regions ---------- */
export type Region = {
  id: string;
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  n: number;
  eraOld: number;
};

export const REGIONS: Region[] = [
  { id: 'r1', name: 'PEAK-TIME · DENSE', cx: 0.3, cy: 0.34, rx: 0.16, ry: 0.2, n: 70, eraOld: 0.25 },
  { id: 'r2', name: 'DEEP / DUB · DENSE', cx: 0.62, cy: 0.58, rx: 0.17, ry: 0.19, n: 74, eraOld: 0.35 },
  { id: 'r3', name: 'AMBIENT OFFSHOOTS', cx: 0.87, cy: 0.16, rx: 0.07, ry: 0.09, n: 16, eraOld: 0.5 },
  { id: 'r4', name: 'BREAKS ERA 2009–13', cx: 0.24, cy: 0.78, rx: 0.13, ry: 0.11, n: 38, eraOld: 0.85 },
  { id: 'r5', name: 'SPARSE REGION', cx: 0.87, cy: 0.8, rx: 0.09, ry: 0.11, n: 9, eraOld: 0.6 },
];

export type FieldNode = {
  x: number;
  y: number;
  old: boolean;
  region: string;
};

export function fieldNodes(seed: string): FieldNode[] {
  const r = rngFor(seed);
  const nodes: FieldNode[] = [];
  REGIONS.forEach((rg) => {
    for (let i = 0; i < rg.n; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r());
      nodes.push({
        x: rg.cx + Math.cos(a) * rg.rx * rad,
        y: rg.cy + Math.sin(a) * rg.ry * rad,
        old: r() < rg.eraOld,
        region: rg.id,
      });
    }
  });
  return nodes;
}

export type RefResult = {
  t: string;
  a: string;
  year: number;
  label: string;
  why: string;
  region: string;
  old: boolean;
  _x?: number;
  _y?: number;
};

export type CiRef = {
  t: string;
  a: string;
  year: number;
  results: RefResult[];
};

export const CI_REFS: Record<'a' | 'b', CiRef> = {
  a: {
    t: 'COLD LATITUDE',
    a: 'Nia Voss',
    year: 2026,
    results: [
      {
        t: 'PALLADIUM NIGHT',
        a: 'Vel Mira',
        year: 2015,
        label: 'VAST SIGNAL',
        why: 'rhythmic profile + timbre + energy contour closely related',
        region: 'r2',
        old: true,
      },
      {
        t: 'GLASS ATRIUM',
        a: 'Dun Harbor',
        year: 2023,
        label: 'OBLIQUE MOTION',
        why: 'matched groove density and spectral weight',
        region: 'r1',
        old: false,
      },
      {
        t: 'NIGHT FREIGHT',
        a: 'Kappa Motive',
        year: 2011,
        label: 'BLUE RELAY',
        why: 'related structure and dark timbre — low current exposure',
        region: 'r4',
        old: true,
      },
      {
        t: 'ELDER CIRCUIT',
        a: 'Silent Auditorium',
        year: 2025,
        label: 'VAST SIGNAL',
        why: 'harmonically compatible · similar energy journey',
        region: 'r2',
        old: false,
      },
    ],
  },
  b: {
    t: 'VERDE STATIC',
    a: 'Ostra Line',
    year: 2024,
    results: [
      {
        t: 'HOLLOW COAST',
        a: 'Mire Palas',
        year: 2013,
        label: 'BLUE RELAY',
        why: 'shared percussive character and sparse texture',
        region: 'r4',
        old: true,
      },
      {
        t: 'SALT ORBIT',
        a: 'Dun Harbor',
        year: 2022,
        label: 'OBLIQUE MOTION',
        why: 'related timbre and phrase structure',
        region: 'r1',
        old: false,
      },
      {
        t: 'AER LUMEN',
        a: 'Fen Quarto',
        year: 2016,
        label: 'VAST SIGNAL',
        why: 'compatible tonal centre · matched brightness',
        region: 'r3',
        old: true,
      },
      {
        t: 'LOW GALLERY',
        a: 'Silent Auditorium',
        year: 2026,
        label: 'VAST SIGNAL',
        why: 'closely aligned energy and rhythm',
        region: 'r2',
        old: false,
      },
    ],
  },
};

export type Match = {
  t: string;
  a: string;
  year: number;
  label: string;
  exp: string;
  sc: number;
  old: boolean;
  why: string;
  fams: string[];
  extra?: boolean;
};

export const MATCHES: Match[] = [
  {
    t: 'PALLADIUM NIGHT',
    a: 'Vel Mira',
    year: 2015,
    label: 'VAST SIGNAL',
    exp: 'LOW EXPOSURE',
    sc: 91,
    old: true,
    why: 'Its rhythm, timbre and energy are closely related to the reference — a strong archive candidate that text search would never return.',
    fams: ['rhythm', 'timbre', 'energy'],
  },
  {
    t: 'SALT ORBIT',
    a: 'Dun Harbor',
    year: 2022,
    label: 'OBLIQUE MOTION',
    exp: 'ACTIVE',
    sc: 90,
    old: false,
    why: 'Closely aligned rhythm and energy with related spectral weight.',
    fams: ['rhythm', 'energy'],
  },
  {
    t: 'NIGHT FREIGHT',
    a: 'Kappa Motive',
    year: 2011,
    label: 'BLUE RELAY',
    exp: 'DORMANT',
    sc: 87,
    old: true,
    why: 'Related structure and dark timbre — essentially invisible to text search today.',
    fams: ['structure', 'timbre'],
  },
  {
    t: 'AER LUMEN',
    a: 'Fen Quarto',
    year: 2016,
    label: 'VAST SIGNAL',
    exp: 'LOW EXPOSURE',
    sc: 86,
    old: true,
    extra: true,
    why: 'Compatible tonal centre with matched brightness.',
    fams: ['harmony', 'timbre'],
  },
  {
    t: 'LOW GALLERY',
    a: 'Silent Auditorium',
    year: 2026,
    label: 'VAST SIGNAL',
    exp: 'ACTIVE',
    sc: 84,
    old: false,
    extra: true,
    why: 'Similar energy journey and phrase timing.',
    fams: ['energy', 'structure'],
  },
];

export type Cluster = {
  id: string;
  name: string;
  cx: number;
  cy: number;
  r: number;
  count: number;
  chars: string;
  years: string;
  meta: string;
  q: string;
};

export const CLUSTERS: Cluster[] = [
  {
    id: 'c1',
    name: 'PEAK-TIME',
    cx: 0.3,
    cy: 0.32,
    r: 0.17,
    count: 412,
    chars: 'driving · bright · 126–130 bpm',
    years: '2018–2026',
    meta: 'techno / peak-time',
    q: 'Is this area over-dependent on one label or release period?',
  },
  {
    id: 'c2',
    name: 'DEEP / DUB',
    cx: 0.62,
    cy: 0.56,
    r: 0.18,
    count: 388,
    chars: 'dark · rolling · sub-weighted',
    years: '2012–2026',
    meta: 'deep house / dub techno',
    q: 'Does this cluster contain underexposed inventory worth a campaign?',
  },
  {
    id: 'c3',
    name: 'ISOLATED',
    cx: 0.87,
    cy: 0.16,
    r: 0.07,
    count: 26,
    chars: 'ambient · beatless · wide',
    years: '2014–2019',
    meta: 'described inconsistently',
    q: 'Are similar tracks described inconsistently in the stored metadata?',
  },
  {
    id: 'c4',
    name: 'MIXED ERA',
    cx: 0.24,
    cy: 0.78,
    r: 0.12,
    count: 143,
    chars: 'breaks · percussive · raw',
    years: '2009–2025',
    meta: 'breaks / electro',
    q: 'Older tracks sit inside a modern-sounding cluster — is there a campaign theme here?',
  },
  {
    id: 'c5',
    name: 'SPARSE',
    cx: 0.86,
    cy: 0.8,
    r: 0.09,
    count: 17,
    chars: 'few nearby recordings',
    years: '2010–2022',
    meta: 'various',
    q: 'Underrepresented sound, incomplete ingestion or a deliberate focus?',
  },
];

export type MatrixRow = {
  k: string;
  s: string;
  m: string;
  st: string;
  cls: 'st-ok' | 'st-conf' | 'st-rev';
  d: string;
  ex?: boolean;
};

export const MATRIX: MatrixRow[] = [
  {
    k: 'BPM',
    s: '126',
    m: '124',
    st: 'POSSIBLE CONFLICT',
    cls: 'st-conf',
    d: 'Measured value differs by 2 BPM — worth a listen. Your team decides; nothing is corrected automatically.',
  },
  {
    k: 'Key',
    s: 'F# minor',
    m: 'G minor · 6A',
    st: 'REVIEW RECOMMENDED',
    cls: 'st-rev',
    d: 'Measured key disagrees with the stored value — a discrepancy worth checking.',
  },
  {
    k: 'Genre / style',
    s: 'electronica',
    m: 'indicators: deep house · dub',
    st: 'REVIEW RECOMMENDED',
    cls: 'st-rev',
    d: 'Broad stored tag vs specific measured indicators — a candidate for richer description.',
  },
  {
    k: 'Duration',
    s: '6:18',
    m: '6:18',
    st: 'ALIGNED',
    cls: 'st-ok',
    ex: true,
    d: 'Stored and measured values agree.',
  },
];

export type CampItem = [string, string, string];

export type Camp = {
  lbl: string;
  q: string;
  copy: string;
  note: string;
  items: CampItem[];
};

export const CAMPS: Record<'ed' | 'sync' | 'ar', Camp> = {
  ed: {
    lbl: 'ARCHIVE CAMPAIGN · SAMPLE',
    q: '"Ten years of the label — which archive tracks still speak to the current sound?"',
    copy: 'A current reference reveals relevant older tracks for human review — release date stops deciding visibility.',
    note: 'candidates ranked by sonic relevance · human review decides',
    items: [
      ['PALLADIUM NIGHT · 2015', 'rhythm + timbre related', 'REVIEWED'],
      ['NIGHT FREIGHT · 2011', 'structure + dark timbre', 'PENDING'],
      ['HOLLOW COAST · 2013', 'percussive character', 'PENDING'],
    ],
  },
  sync: {
    lbl: 'SYNC / CREATIVE BRIEF · SAMPLE',
    q: '"Late-night, warm, hypnotic — nothing obvious."',
    copy: 'An approved reference produces a shortlist organised by sonic relevance, mood and texture indicators.',
    note: 'mood/texture indicators support — clearance and creative approval stay human',
    items: [
      ['AER LUMEN · 2016', 'tonal centre + brightness fit', 'SHORTLISTED'],
      ['SALT ORBIT · 2022', 'texture + restraint', 'REVIEWED'],
      ['LOW GALLERY · 2026', 'energy shape fits the brief', 'PENDING'],
    ],
  },
  ar: {
    lbl: 'RELEASE & A&R RESEARCH · SAMPLE',
    q: '"How does this demo relate to what we already own?"',
    copy: 'A new reference is compared with existing catalogue relationships to support — not replace — professional judgement.',
    note: 'advisory context only · no artistic judgement is automated',
    items: [
      ['ELDER CIRCUIT · 2025', 'nearest owned neighbour', 'REVIEWED'],
      ['GLASS ATRIUM · 2023', 'crowded area — strong overlap', 'PENDING'],
      ['SPARSE REGION', 'few nearby recordings — possible space', 'PENDING'],
    ],
  },
};

export type QueueItem = {
  act: string;
  why: string;
  own: string;
};

export const QUEUE: QueueItem[] = [
  {
    act: 'Add to pitch shortlist',
    why: 'SALT ORBIT ranked highly against the current brief reference.',
    own: 'sync team',
  },
  {
    act: 'Recheck metadata',
    why: 'Stored 126 vs measured 124 BPM on one sample track.',
    own: 'metadata team',
  },
  {
    act: 'Review for archive campaign',
    why: 'PALLADIUM NIGHT (2015) keeps surfacing against current references.',
    own: 'catalogue mgr',
  },
  {
    act: 'Compare with related tracks',
    why: '26 recordings sit apart and are described inconsistently.',
    own: 'catalogue mgr',
  },
];

export const QSTATES = ['OPEN', 'IN REVIEW', 'DECIDED'] as const;

export type LensKey = 'cm' | 'ar' | 'sync' | 'label' | 'api';

export type Lens = {
  head: string;
  q: string;
  attrs: string[];
  out: string;
  cta: string;
  regions: string[];
};

export const LENS9: Record<LensKey, Lens> = {
  cm: {
    head: 'Catalogue Managers',
    q: 'Which catalogue assets are difficult to find or described inconsistently?',
    attrs: [
      'Coverage map — dense, isolated and sparse regions',
      'Stored vs measured review prompts',
      'Low-exposure inventory surfaced by relevance',
      'Consistent descriptors across eras',
    ],
    out: 'Pilot output: a reviewed map of hard-to-find inventory and metadata review priorities.',
    cta: 'Start a catalogue pilot',
    regions: ['r3', 'r4', 'r5'],
  },
  ar: {
    head: 'A&R Teams',
    q: 'How does a new reference relate to the existing catalogue?',
    attrs: [
      'Reference-to-catalogue relationships',
      'Crowded vs underrepresented sonic areas',
      'Nearest owned neighbours for any demo',
      'Advisory context — never a verdict',
    ],
    out: 'Pilot output: reference comparisons across the catalogue to support release judgement.',
    cta: 'Start a catalogue pilot',
    regions: ['r1', 'r2', 'r5'],
  },
  sync: {
    head: 'Sync & Curation',
    q: 'Which owned recordings fit this sonic direction?',
    attrs: [
      'Reference-led search beyond genre tags',
      'Mood and texture context per result',
      'Fast human-reviewed shortlists',
      'Less-obvious candidates from the archive',
    ],
    out: 'Pilot output: brief-driven shortlists drawn from owned repertoire.',
    cta: 'Start a catalogue pilot',
    regions: ['r2', 'r3', 'r4'],
  },
  label: {
    head: 'Labels & Distributors',
    q: 'How can sound-first discovery deepen the user journey across our repertoire?',
    attrs: [
      'Catalogue-scale profiling',
      'Searchable sonic relationships',
      'Private ingestion and evaluation',
      'Integration pathways that keep your storefront',
    ],
    out: 'Pilot output: an evidence-based decision on sound-first discovery for your repertoire.',
    cta: 'Start a catalogue pilot',
    regions: ['r1', 'r2', 'r4'],
  },
  api: {
    head: 'Product & Platform Teams',
    q: 'How can we add catalogue similarity and track analysis without rebuilding the infrastructure?',
    attrs: [
      'Scoped API access',
      'Catalogue processing at ingest',
      'Similarity + analysis retrieval',
      'Deterministic, explainable output',
    ],
    out: 'Pilot output: a scoped API evaluation against your integration path.',
    cta: 'Explore the API',
    regions: ['r1', 'r2', 'r3', 'r4', 'r5'],
  },
};

export type FieldState = {
  ref: 'a' | 'b';
  sel: number;
};
