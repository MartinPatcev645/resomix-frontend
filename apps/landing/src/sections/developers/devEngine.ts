// Fictional requests and responses. Placeholder credentials only. Public-safe by design — nothing internal.

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
  return extra ? `dev-draw ${extra}` : 'dev-draw';
}

export type RouteKey = 'search' | 'sim' | 'ana';

export const ROUTES: Record<
  RouteKey,
  { note: string; frag: string }
> = {
  search: {
    note: 'ROUTE: SEARCH · metadata query returns partner track IDs',
    frag: '"data": { "tracks": [ … ] }',
  },
  sim: {
    note: 'ROUTE: SIMILARITY · ranked matches from your private index',
    frag: '"data": { "similar_tracks": [ … ] }',
  },
  ana: {
    note: 'ROUTE: ANALYSIS · on demand · async job returns versioned JSON',
    frag: '"data": { "analysis_id": "ana_4c2d91" }',
  },
};

/** Per-route availability shown in the hero router diagram. Analysis is provisioned on
 *  request against a partner's own catalogue rather than enabled on every key, so it is
 *  labelled like the playback route instead of sharing the LIVE badge. */
export const ROUTE_STATUS: Record<RouteKey, string> = {
  search: 'LIVE',
  sim: 'LIVE',
  ana: 'ON DEMAND',
};

export type CodeToken = { type: 'k' | 's' | 'o' | 'c' | 'text'; text: string };
export type CodeLine = CodeToken[];

export function codeToPlainText(lines: CodeLine[]): string {
  return lines.map((line) => line.map((t) => t.text).join('')).join('\n');
}

const K = (text: string): CodeToken => ({ type: 'k', text });
const S = (text: string): CodeToken => ({ type: 's', text });
const O = (text: string): CodeToken => ({ type: 'o', text });
const C = (text: string): CodeToken => ({ type: 'c', text });
const T = (text: string): CodeToken => ({ type: 'text', text });

const SIM_RES_SHORT: CodeLine[] = [
  [T('{')],
  [T('  '), K('"success"'), T(': '), O('true'), T(',')],
  [T('  '), K('"data"'), T(': {')],
  [T('    '), K('"queried_track"'), T(': { '), K('"rank"'), T(': 0, '), K('"score"'), T(': 1.0,')],
  [T('      '), K('"id"'), T(': '), O('"trk_71f5e8c0"'), T(',')],
  [T('      '), K('"artist"'), T(': '), S('"Signal Frame"'), T(', '), K('"title"'), T(': '), S('"Night Transit"'), T(' },')],
  [T('    '), K('"similar_tracks"'), T(': [')],
  [T('      { '), K('"rank"'), T(': 1, '), K('"score"'), T(': '), O('0.9821'), T(',')],
  [T('        '), K('"id"'), T(': '), O('"trk_b803c120"'), T(',')],
  [T('        '), K('"artist"'), T(': '), S('"Phase Archive"'), T(', '), K('"title"'), T(': '), S('"Low Meridian"'), T(' }')],
  [T('      '), C('… 19 more ranked matches')],
  [T('    ]')],
  [T('  }')],
  [T('}')],
];

const SIM_RES_FULL: CodeLine[] = [
  ...SIM_RES_SHORT.slice(0, 10),
  [T('      { '), K('"rank"'), T(': 2, '), K('"score"'), T(': '), O('0.9714'), T(',')],
  [T('        '), K('"id"'), T(': '), O('"trk_2f19aa04"'), T(',')],
  [T('        '), K('"artist"'), T(': '), S('"Vector Coast"'), T(', '), K('"title"'), T(': '), S('"Halide"'), T(' }')],
  [T('      '), C('… 18 more')],
  [T('    ],')],
  [T('    '), K('"playlist"'), T(': { '), K('"id"'), T(': '), O('"pl_90ce41"'), T(', '), K('"name"'), T(': '), S('"Similar to Night Transit"'), T(', '), K('"auto_created"'), T(': '), O('true'), T(' }')],
  [T('  }')],
  [T('}')],
];

export type WfKey = 'chain' | 'simid' | 'simup' | 'ana' | 'play';

export type Workflow = {
  title: string;
  ep: string;
  req: CodeLine[];
  res: CodeLine[];
  resFull: CodeLine[] | null;
  expl: string;
  async: boolean;
};

export const WF: Record<WfKey, Workflow> = {
  chain: {
    title: 'WORKFLOW · SEARCH → TRACK ID → SIMILARITY',
    ep: 'GET /api/v1/search_tracks/ → POST /api/v1/similarity/search',
    req: [
      [K('GET'), T(' /api/v1/search_tracks/?query=night+transit&mode='), O('auto')],
      [K('Authorization'), T(': Bearer rmx_live_xxxxxxxxxxxxxxxxxxxxxxxx')],
      [T('')],
      [C('# then feed the returned ID into similarity:')],
      [K('POST'), T(' /api/v1/similarity/search')],
      [T('{ '), K('"track_id"'), T(': '), O('"trk_71f5e8c0"'), T(', '), K('"top_sk"'), T(': 20 }')],
    ],
    res: SIM_RES_SHORT,
    resFull: SIM_RES_FULL,
    expl: 'Search is metadata-based: it finds the partner track ID, which similarity then uses. Two calls, one workflow.',
    async: false,
  },
  simid: {
    title: 'WORKFLOW · SIMILARITY BY CATALOGUE TRACK ID',
    ep: 'POST /api/v1/similarity/search',
    req: [
      [K('POST'), T(' /api/v1/similarity/search')],
      [K('Authorization'), T(': Bearer rmx_live_xxxxxxxxxxxxxxxxxxxxxxxx')],
      [K('Content-Type'), T(': application/json')],
      [T('')],
      [T('{')],
      [T('  '), K('"track_id"'), T(': '), O('"trk_71f5e8c0"'), T(',')],
      [T('  '), K('"top_sk"'), T(': 20')],
      [T('}')],
    ],
    res: SIM_RES_SHORT,
    resFull: SIM_RES_FULL,
    expl: 'One existing catalogue ID in, ranked neighbours out, at result depths of 10, 20, 50 or 100. Ranking is based on the audio profile.',
    async: false,
  },
  simup: {
    title: 'WORKFLOW · SIMILARITY BY UPLOADED REFERENCE',
    ep: 'POST /api/v1/similarity/upload',
    req: [
      [K('POST'), T(' /api/v1/similarity/upload?top_sk='), O('20')],
      [K('Authorization'), T(': Bearer rmx_live_xxxxxxxxxxxxxxxxxxxxxxxx')],
      [K('Content-Type'), T(': multipart/form-data')],
      [T('')],
      [T('file: reference.wav '), C('(≤ 100 MB · .mp3 .wav .flac .aiff)')],
    ],
    res: SIM_RES_SHORT,
    resFull: SIM_RES_FULL,
    expl: 'The uploaded file is the query reference: PYXIS-1 analyses it, and the matches still come only from your own indexed catalogue. The upload does not become a catalogue item.',
    async: false,
  },
  ana: {
    title: 'WORKFLOW · ASYNCHRONOUS ANALYSIS JOB',
    ep: 'POST /api/v1/analysis/upload → GET /api/v1/analysis/{id}/status → /result',
    req: [
      [C('# provisioned on request against your own catalogue.')],
      [C('# not enabled on a standard partner key by default.')],
      [T('')],
      [K('POST'), T(' /api/v1/analysis/upload')],
      [K('Authorization'), T(': Bearer rmx_live_xxxxxxxxxxxxxxxxxxxxxxxx')],
      [T('')],
      [T('file: new_signing.flac')],
      [T('')],
      [C('# poll until the job succeeds:')],
      [K('GET'), T(' /api/v1/analysis/'), O('ana_4c2d91'), T('/status')],
    ],
    res: [
      [T('{')],
      [T('  '), K('"success"'), T(': '), O('true'), T(',')],
      [T('  '), K('"data"'), T(': {')],
      [T('    '), K('"analysis_id"'), T(': '), O('"ana_4c2d91"'), T(',')],
      [T('    '), K('"state"'), T(': '), O('"running"'), T(',')],
      [T('    '), K('"progress"'), T(': { '), K('"stage"'), T(': '), S('"rhythm"'), T(', '), K('"percent"'), T(': 40 },')],
      [T('    '), K('"part1_ready"'), T(': '), O('false'), T(', '), K('"result_available"'), T(': '), O('false')],
      [T('  }')],
      [T('}')],
    ],
    resFull: [
      [T('{')],
      [T('  '), K('"success"'), T(': '), O('true'), T(',')],
      [T('  '), K('"data"'), T(': {')],
      [T('    '), K('"analysis_id"'), T(': '), O('"ana_4c2d91"'), T(',')],
      [T('    '), K('"state"'), T(': '), O('"succeeded"'), T(',')],
      [T('    '), K('"part1_ready"'), T(': '), O('true'), T(', '), K('"result_available"'), T(': '), O('true'), T(',')],
      [T('    '), C('// then GET /result:')],
      [T('    '), K('"schema_version"'), T(': '), S('"resomix-analysis-1.1"'), T(',')],
      [T('    '), K('"status"'), T(': '), O('"complete"'), T(', '), C('// or "partial"')],
      [T('    '), K('"rhythm"'), T(': { '), C('…'), T(' }, '), K('"tonality"'), T(': { '), C('…'), T(' }, '), C('see section 05')],
      [T('  }')],
      [T('}')],
    ],
    expl: 'Upload returns an analysis ID immediately. Poll the job state, then retrieve the versioned structured result; part 1 (technical, rhythm, tonality, structure) is readable before the slower semantic sections finish.',
    async: true,
  },
  play: {
    title: 'WORKFLOW · PLAYBACK-ENABLED INTEGRATION',
    ep: 'permission-gated service mode · endpoint detail in the docs',
    req: [
      [C('# available to partners provisioned with the')],
      [C('# similarity + playback service mode only:')],
      [T('')],
      [T('1 · request a short-lived playback token')],
      [T('2 · attach it to authorised media requests')],
      [T('3 · the token expires automatically')],
    ],
    res: [
      [T('{')],
      [T('  '), K('"success"'), T(': '), O('true'), T(',')],
      [T('  '), K('"data"'), T(': {')],
      [T('    '), K('"playback_token"'), T(': '), O('"pbt_xxxxxxxx"'), T(',')],
      [T('    '), K('"expires"'), T(': '), S('"short-lived"')],
      [T('  }')],
      [T('}')],
      [T('')],
      [C('# illustrative shape · playback rights are')],
      [C('# provisioned per partner, never automatic')],
    ],
    resFull: null,
    expl: 'Playback is a separate, permission-gated service mode. Similarity-only partners receive IDs, scores and metadata, with no audio access.',
    async: false,
  },
};

export type SgKey = 'rhythm' | 'tonality' | 'loudness' | 'mood' | 'structure' | 'prov';

export const SG: Record<SgKey, CodeLine[]> = {
  rhythm: [
    [T('{')],
    [T('  '), K('"bpm"'), T(': '), O('124.02'), T(', '), K('"confidence"'), T(': '), O('0.94'), T(',')],
    [T('  '), K('"beat_times_seconds"'), T(': [ 0.482, 0.966, 1.450, '), C('…'), T(' ],')],
    [T('  '), K('"downbeats_seconds"'), T(': [ 0.482, 2.418, '), C('…'), T(' ],')],
    [T('  '), K('"bar_count"'), T(': 96,')],
    [T('  '), K('"phrase_boundaries_seconds"'), T(': [ 0.0, 30.9, 61.8, '), C('…'), T(' ]')],
    [T('}')],
  ],
  tonality: [
    [T('{')],
    [T('  '), K('"key"'), T(': '), S('"G"'), T(', '), K('"scale"'), T(': '), S('"minor"'), T(',')],
    [T('  '), K('"camelot"'), T(': '), O('"6A"'), T(', '), K('"strength"'), T(': '), O('0.88'), T(',')],
    [T('  '), K('"tuning_hz"'), T(': 440.1,')],
    [T('  '), K('"alt_key"'), T(': '), S('"B♭"'), T(', '), K('"alt_scale"'), T(': '), S('"major"'), T(', '), K('"alt_camelot"'), T(': '), O('"6B"'), T(',')],
    [T('  '), K('"ambiguous"'), T(': '), O('false'), T(' '), C('// weak tonic or a close alternative')],
    [T('}')],
  ],
  loudness: [
    [T('{')],
    [T('  '), K('"integrated_loudness_lufs"'), T(': '), O('-7.4'), T(',')],
    [T('  '), K('"loudness_range_lu"'), T(': 6.2, '), K('"true_peak_dbtp"'), T(': -0.6,')],
    [T('  '), K('"dynamic_complexity"'), T(': 4.1, '), K('"crest_factor"'), T(': 5.8,')],
    [T('  '), K('"loudness_curve"'), T(': { '), K('"values"'), T(': [ '), C('…'), T(' ], '), K('"hop_ms"'), T(': 100.0 },')],
    [T('  '), K('"rms_energy_curve"'), T(': { '), K('"values"'), T(': [ '), C('…'), T(' ], '), K('"hop_ms"'), T(': 100.0 }')],
    [T('}')],
  ],
  mood: [
    [T('{')],
    [T('  '), K('"genre_top"'), T(': [ { '), K('"label"'), T(': '), S('"deep house"'), T(', '), K('"score"'), T(': '), O('0.62'), T(' }, '), C('…'), T(' ],')],
    [T('  '), K('"mood_theme_top"'), T(': [ { '), K('"label"'), T(': '), S('"dark"'), T(', '), K('"score"'), T(': '), O('0.71'), T(' }, '), C('…'), T(' ],')],
    [T('  '), K('"mood_dimensions"'), T(': { '), K('"party"'), T(': '), O('0.66'), T(', '), K('"relaxed"'), T(': 0.40, '), C('…'), T(' },')],
    [T('  '), K('"valence"'), T(': '), O('0.31'), T(', '), K('"arousal"'), T(': '), O('0.72'), T(', '), K('"danceability"'), T(': 0.81,')],
    [T('  '), K('"mood_electronic"'), T(': 0.97, '), K('"mood_acoustic"'), T(': 0.03,')],
    [T('  '), K('"voice_instrumental"'), T(': '), S('"instrumental"'), T(', '), K('"voice_score"'), T(': 0.99')],
    [T('}')],
  ],
  structure: [
    [T('{')],
    [T('  '), K('"structure_segments"'), T(': [')],
    [T('    { '), K('"label"'), T(': '), O('"intro"'), T(', '), K('"start_ms"'), T(': 0.0, '), K('"end_ms"'), T(': 52100.0, '), K('"confidence"'), T(': 0.90 },')],
    [T('    { '), K('"label"'), T(': '), O('"drop"'), T(', '), K('"start_ms"'), T(': 118400.0, '), K('"end_ms"'), T(': 184000.0, '), K('"confidence"'), T(': 0.86 },')],
    [T('    '), C('… build · breakdown · outro')],
    [T('  ]')],
    [T('}')],
  ],
  prov: [
    [T('{')],
    [T('  '), K('"service_version"'), T(': '), S('"analysis-2.x"'), T(',')],
    [T('  '), K('"schema_version"'), T(': '), O('"resomix-analysis-1.1"'), T(',')],
    [T('  '), K('"elapsed_seconds"'), T(': 18.34,')],
    [T('  '), K('"stage_timings_seconds"'), T(': { '), K('"rhythm"'), T(': 2.1, '), K('"tonality"'), T(': 1.4, '), C('…'), T(' },')],
    [T('  '), K('"stage_errors"'), T(': { }  '), C('// populated on a partial result')],
    [T('}')],
  ],
};

/** The real JSON path each group lives at in the canonical result — shown next to the
 *  fragment so a reader knows where to look in an actual payload, not just what it means.
 *  Loudness lives under `technical` and structure under `energy`; the group headings are
 *  human labels, these are the keys on the wire. */
export function sgDisplayName(key: SgKey): string {
  if (key === 'prov') return 'provenance';
  if (key === 'loudness') return 'technical';
  if (key === 'mood') return 'semantics';
  if (key === 'structure') return 'energy.structure_segments';
  return key;
}

export const AUTH_CODE = 'Authorization: Bearer rmx_live_xxxxxxxxxxxxxxxxxxxxxxxx';

export const ENVELOPE_LINES: CodeLine[] = [
  [T('{ '), K('"success"'), T(': '), O('true'), T(',  '), K('"data"'), T(': { … } }')],
  [T('{ '), K('"success"'), T(': '), O('false'), T(', '), K('"error"'), T(': '), S('"Human-readable message."'), T(' }')],
];

export const API_DOCS_URL = 'https://api-docs.resomix.com/';

/** The ingestion checklist behind section 04 — every requirement, stage by stage. Deep-linked
 *  rather than pointing at the docs root, so "View Ingestion Requirements" lands on the answer
 *  instead of a home page the reader then has to navigate from. */
export const API_DOCS_INGESTION_REQUIREMENTS_URL =
  'https://api-docs.resomix.com/ingestion-requirements';
