// Fictional, non-commercial sample track only — not a real recording. Authored section data so every interpretation matches the drawing. Deterministic.

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

/* ---------- authored sample profile (fictional, non-commercial) ---------- */
export type TrackProfile = {
  t: string;
  a: string;
  bpm: number;
  key: string;
  lufs: number;
  dur: number;
  bright: number;
};

export type Section = {
  n: string;
  t0: number;
  t1: number;
  e: number;
  lufs: number;
  role: string;
};

export const TRACK: TrackProfile = {
  t: 'BASALT ROOM',
  a: 'Iva Sequence',
  bpm: 124,
  key: 'G MIN · 6A',
  lufs: -7.4,
  dur: 378,
  bright: 0.42,
};

export const SECTIONS: Section[] = [
  {
    n: 'INTRO',
    t0: 0,
    t1: 52,
    e: 0.25,
    lufs: -12.1,
    role: 'Establishes the groove: sub-weighted, sparse and percussive. Sets the tempo it will keep for the whole track.',
  },
  {
    n: 'BUILD',
    t0: 52,
    t1: 118,
    e: 0.48,
    lufs: -9.8,
    role: 'Layers enter in long phrases; intensity climbs gradually with no abrupt jumps.',
  },
  {
    n: 'DROP 01',
    t0: 118,
    t1: 184,
    e: 0.82,
    lufs: -7.1,
    role: 'First full-weight section, with the groove at working energy, dense but still dark.',
  },
  {
    n: 'BREAK',
    t0: 184,
    t1: 252,
    e: 0.38,
    lufs: -11.2,
    role: 'The longest breakdown. Energy releases, tonal movement widens, and the track breathes before its peak.',
  },
  {
    n: 'DROP 02',
    t0: 252,
    t1: 326,
    e: 0.95,
    lufs: -6.8,
    role: 'The main drop begins after the longest breakdown and carries the track\u2019s highest sustained energy, and brightness lifts with it.',
  },
  {
    n: 'OUTRO',
    t0: 326,
    t1: 378,
    e: 0.3,
    lufs: -12.6,
    role: 'Steps down instead of cutting, with a long tail that mixes out cleanly.',
  },
];

const EPTS: [number, number][] = ([[0, 0.16]] as [number, number][])
  .concat(SECTIONS.map((s): [number, number] => [(s.t0 + s.t1) / 2, s.e]))
  .concat([[TRACK.dur, 0.2]]);

const LPTS: [number, number][] = ([[0, -13.2]] as [number, number][])
  .concat(SECTIONS.map((s): [number, number] => [(s.t0 + s.t1) / 2, s.lufs]))
  .concat([[TRACK.dur, -13]]);

function interp(pts: [number, number][], t: number): number {
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const a = pts[i];
  const b = pts[i + 1];
  const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  const mu = (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, f)))) / 2;
  return a[1] + (b[1] - a[1]) * mu;
}

export function eAt(t: number): number {
  const v = interp(EPTS, t) + 0.028 * Math.sin(t * 0.21) + 0.018 * Math.sin(t * 0.53 + 1.7);
  return Math.min(1, Math.max(0.05, v));
}

export function lAt(t: number): number {
  return interp(LPTS, t) + 0.28 * Math.sin(t * 0.17 + 0.6);
}

/** controlled spectral heat ramp — brand-first (grey → orange → hot) */
export function heat(v: number): string {
  if (v <= 0) return 'transparent';
  if (v < 0.28) return `rgba(255,255,255,${(v * 0.55).toFixed(2)})`;
  if (v < 0.55) return `rgba(238,74,38,${((v - 0.28) * 1.6 + 0.18).toFixed(2)})`;
  if (v < 0.82) return `rgba(238,74,38,${(0.62 + (v - 0.55) * 1.2).toFixed(2)})`;
  return `rgba(255,186,150,${(0.75 + (v - 0.82) * 1.4).toFixed(2)})`;
}

export function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

export function waveBarsPath(
  seed: string,
  x0: number,
  cy: number,
  w: number,
  h: number,
  n: number,
): string {
  const r = rngFor(seed);
  const step = w / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TRACK.dur;
    const env = 0.25 + 0.75 * eAt(t);
    const bh = h * 0.5 * env * (0.5 + 0.5 * r());
    const x = (x0 + i * step + step / 2).toFixed(1);
    d += 'M' + x + ' ' + (cy - bh).toFixed(1) + 'L' + x + ' ' + (cy + bh).toFixed(1);
  }
  return d;
}

export function contourD(
  fn: (t: number) => number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  lo: number,
  hi: number,
  n = 60,
): string {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TRACK.dur;
    const v = (fn(t) - lo) / (hi - lo);
    const x = x0 + (i / n) * w;
    const y = y0 + h - Math.min(1, Math.max(0, v)) * h;
    d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d;
}

export type SectionBlock = {
  x: number;
  width: number;
  label: string;
  duration: string;
  hot: boolean;
  isDrop: boolean;
};

export function sectionBlocks(
  x0: number,
  _y0: number,
  w: number,
  h: number,
  withLabels: boolean,
  activeIdx: number,
): SectionBlock[] {
  return SECTIONS.map((s, i) => {
    const bx = x0 + (s.t0 / TRACK.dur) * w;
    const bw = ((s.t1 - s.t0) / TRACK.dur) * w;
    return {
      x: bx,
      width: bw - 3,
      label: s.n,
      duration: withLabels && h >= 26 ? fmt(s.t1 - s.t0) : '',
      hot: i === activeIdx,
      isDrop: s.n.indexOf('DROP') === 0,
    };
  });
}

export type LensKey = 'structure' | 'energy' | 'harmony' | 'timbre' | 'identity';

export const LANE_ORDER: LensKey[] = ['structure', 'energy', 'harmony', 'timbre', 'identity'];

export const LENS: Record<LensKey, { i: string }> = {
  structure: {
    i: 'Six sections in long phrases: intro, build, first drop, the longest break, the main drop and a mixable outro. The <b>break → drop 02</b> transition is the track\u2019s structural centre.',
  },
  energy: {
    i: 'Intensity climbs gradually, releases through the break, then reaches its <b>highest sustained energy in drop 02</b>, and the outro steps down rather than cutting.',
  },
  harmony: {
    i: 'Centred on <b>G minor (6A)</b> with high confidence. Tonal movement widens during the break and re-anchors for the final drop.',
  },
  timbre: {
    i: 'Dark, dense and sub-weighted through the first half; <b>brightness lifts at drop 02</b>, opening the top end without losing weight.',
  },
  identity: {
    i: 'Reads primarily as <b>deep house (0.62)</b> with tech-house and minimal influences: dark, hypnotic, synth-led, with no vocal presence.',
  },
};

export type ModeKey = 'dj' | 'prod' | 'label' | 'sup' | 'api';

export type ModeDef = {
  head: string;
  copy: string;
  attrs: string[];
  outcome: string;
  cta: string;
  lanes: LensKey[];
  vizlbl: string;
  chips: string[];
};

export const MODES: Record<ModeKey, ModeDef> = {
  dj: {
    head: 'For DJs',
    copy: 'Read the track before it enters your preparation: arrangement, tempo, key, movement and weight, at a glance.',
    attrs: [
      'Structure: where every section starts and ends',
      'BPM: stable 124, confirmed across the beat grid',
      'Key: G minor · 6A, high confidence',
      'Energy journey: where it holds, lifts and releases',
      'Loudness and dynamics: how heavy it actually plays',
    ],
    outcome: 'Understand the track before adding it to a set-preparation workflow.',
    cta: 'Analyse a track',
    lanes: ['structure', 'energy'],
    vizlbl: 'DJ READING · STRUCTURE + ENERGY · SAMPLE DATA',
    chips: ['<b>124</b> BPM · stable', '<b>G MIN</b> · 6A', '<b>−7.4</b> LUFS', 'main drop <b>4:12</b>', 'outro mixes out'],
  },
  prod: {
    head: 'For Producers',
    copy: 'Study how a reference builds texture, movement and intensity, as measured evidence rather than guesswork.',
    attrs: [
      'Arrangement: pacing and section balance',
      'Timbre: texture and weight over time',
      'Spectral profile: where the density lives',
      'Energy movement: how intensity is shaped',
      'Harmony: tonal centre and movement',
    ],
    outcome: 'Study how a reference track builds texture, movement and intensity.',
    cta: 'Analyse a reference',
    lanes: ['timbre', 'energy', 'harmony'],
    vizlbl: 'PRODUCER READING · TIMBRE + ENERGY + HARMONY · SAMPLE DATA',
    chips: [
      'texture: <b>dark · dense</b>',
      'brightness lifts at <b>drop 02</b>',
      'long phrases',
      '<b>G MIN</b> centre',
      'gradual builds',
    ],
  },
  label: {
    head: 'For Labels & Distributors',
    copy: 'One analytical language across the catalogue: consistent, repeatable track-level descriptors.',
    attrs: [
      'Genre and style signals with confidence',
      'Mood and vibe descriptors',
      'Structural summaries per release',
      'Consistent metadata across the catalogue',
      'Flagging inconsistent tagging',
    ],
    outcome: 'Turn catalogue audio into consistent, searchable track intelligence.',
    cta: 'Start a catalogue pilot',
    lanes: ['identity', 'structure'],
    vizlbl: 'CATALOGUE READING · IDENTITY + STRUCTURE · SAMPLE DATA',
    chips: ['<b>deep house</b> 0.62', 'tech house 0.21', 'mood: <b>dark · hypnotic</b>', '6 sections', 'repeatable output'],
  },
  sup: {
    head: 'For Supervisors & Curators',
    copy: 'Assess fit fast: mood, pacing, tonal character and texture, before the full listen.',
    attrs: [
      'Mood and theme indicators',
      'Pacing: how the track unfolds',
      'Tonal character: dark or bright, dense or open',
      'Intensity: where it peaks and breathes',
      'Structural development at a glance',
    ],
    outcome: 'Assess whether a track fits the emotional and sonic direction of a brief.',
    cta: 'Analyse a track',
    lanes: ['identity', 'timbre', 'energy'],
    vizlbl: 'BRIEF READING · IDENTITY + TIMBRE + ENERGY · SAMPLE DATA',
    chips: ['mood: <b>dark · late-night</b>', 'pacing: <b>gradual</b>', 'texture: dense → open', 'peak at <b>4:48</b>', 'no vocals'],
  },
  api: {
    head: 'For Product & API Teams',
    copy: 'The same profile as structured, versioned, explainable data, retrieved instead of rebuilt.',
    attrs: [
      'Structured descriptors per track',
      'Deterministic, repeatable output',
      'Analysis retrieval by track',
      'Catalogue-scale processing',
      'Explainable, versioned results',
    ],
    outcome: 'Add track intelligence to another platform without building the signal-processing layer internally.',
    cta: 'View the API',
    lanes: ['structure', 'energy', 'harmony', 'timbre', 'identity'],
    vizlbl: 'API READING · FULL PROFILE · SAMPLE DATA',
    chips: [
      'structured descriptors',
      'deterministic',
      'versioned: <b>pyxis-1 v5.3.9</b>',
      'whole-track + sections',
      'explainable',
    ],
  },
};

export function agreeAt(t: number): number {
  return Math.max(0.5, 0.9 - (t > 184 && t < 252 ? 0.35 * Math.sin((Math.PI * (t - 184)) / 68) : 0));
}

export function centroidAt(t: number): number {
  return 0.34 + eAt(t) * 0.14 + (t > 252 && t < 326 ? 0.2 : 0);
}

export type HeatCell = { x: number; y: number; width: number; height: number; fill: string };

export function chromaStripCells(x0: number, w: number, sy: number, rh: number): HeatCell[] {
  const pcs = ['G', 'A#', 'D', 'F', 'C', 'other'];
  const r = rngFor('chromastrip');
  const cells: HeatCell[] = [];
  pcs.forEach((pc, row) => {
    for (let c = 0; c < 40; c++) {
      const t = (c / 40) * TRACK.dur;
      const inBreak = t > 184 && t < 252;
      const base =
        pc === 'G'
          ? 0.85
          : pc === 'A#'
            ? 0.6
            : pc === 'D'
              ? 0.42
              : pc === 'F'
                ? inBreak
                  ? 0.5
                  : 0.14
                : pc === 'C'
                  ? inBreak
                    ? 0.42
                    : 0.12
                  : 0.1;
      const v = Math.min(1, base * (0.78 + 0.22 * r()));
      cells.push({
        x: x0 + c * (w / 40),
        y: sy + row * rh,
        width: w / 40 - 1.5,
        height: rh - 1.5,
        fill: heat(pc === 'G' ? v : v * 0.75),
      });
    }
  });
  return cells;
}

export function chromagramCells(x0: number, w: number, y0: number, rh: number): HeatCell[] {
  const pcs = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
  const r = rngFor('chroma');
  const cells: HeatCell[] = [];
  pcs.forEach((pc, row) => {
    for (let c = 0; c < 46; c++) {
      const t = (c / 46) * TRACK.dur;
      const inBreak = t > 184 && t < 252;
      let strength =
        (pc === 'G' ? 0.88 : pc === 'A#' ? 0.62 : pc === 'D' ? 0.46 : 0.12) +
        (inBreak ? 0.2 : 0) * (pc === 'F' || pc === 'C' ? 2 : 1);
      strength = Math.min(1, strength * (0.75 + 0.25 * r()));
      cells.push({
        x: x0 + c * (w / 46),
        y: y0 + row * rh,
        width: w / 46 - 1.5,
        height: rh - 1.5,
        fill: heat(strength),
      });
    }
  });
  return cells;
}

export function spectrogramCells(x0: number, w: number, y0: number, hgt: number): HeatCell[] {
  const rows = 30;
  const cols = 84;
  const r = rngFor('spectro');
  const harmonicRows = [27, 24, 21, 18, 15];
  const cells: HeatCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const t = (c / cols) * TRACK.dur;
      const fr = 1 - row / rows;
      const e = eAt(t);
      let v = 0;
      if (fr < 0.3) v = e * 0.85;
      else if (fr < 0.62) v = e * 0.5;
      else if (fr < 0.82) v = e * 0.3;
      else v = e * 0.18;
      if (harmonicRows.indexOf(row) >= 0) v += e * 0.35 * (1 - ((rows - row) / rows) * 0.5);
      if (c % 3 === 0 && e > 0.55 && fr < 0.75) v += 0.22;
      if (fr > 0.6 && e > 0.6 && c % 2 === 0) v += 0.14;
      if (t > 252 && t < 326 && fr > 0.5) v += 0.26;
      if (t > 184 && t < 252 && fr < 0.25) v *= 0.55;
      v = Math.min(1, v * (0.74 + 0.26 * r()));
      if (v < 0.05) continue;
      cells.push({
        x: x0 + c * (w / cols),
        y: y0 + row * (hgt / rows),
        width: w / cols - 1,
        height: hgt / rows - 1,
        fill: heat(v),
      });
    }
  }
  return cells;
}

export function timbreShares(t: number): [number, number, number, number] {
  const drop2 = t > 252 && t < 326 ? 1 : 0;
  const brk = t > 184 && t < 252 ? 1 : 0;
  const sub = 0.4 - 0.08 * drop2 - 0.12 * brk;
  const body = 0.32 - 0.02 * drop2;
  const pres = 0.18 + 0.06 * drop2 + 0.06 * brk;
  const air = 0.1 + 0.06 * drop2;
  const tot = sub + body + pres + air;
  return [sub / tot, body / tot, pres / tot, air / tot];
}

export type TimbreBandPath = { d: string; fill: string; name: string; labelY: number };

export function timbreEvolutionPaths(x0: number, w: number, y0: number, hgt: number): TimbreBandPath[] {
  const fills = [
    'rgba(255,255,255,.07)',
    'rgba(255,255,255,.14)',
    'rgba(238,74,38,.34)',
    'rgba(255,186,150,.55)',
  ];
  const names = ['SUB', 'BODY', 'PRESENCE', 'AIR'];
  const n = 64;
  const tops: number[][] = [[], [], [], []];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TRACK.dur;
    const s = timbreShares(t);
    let acc = 0;
    for (let b = 0; b < 4; b++) {
      acc += s[b];
      tops[b].push(acc);
    }
  }
  return names.map((nm, b2) => {
    let d = '';
    for (let i = 0; i <= n; i++) {
      d += (i ? ' L' : 'M') + (x0 + (i / n) * w).toFixed(1) + ' ' + (y0 + hgt - tops[b2][i] * hgt).toFixed(1);
    }
    for (let i = n; i >= 0; i--) {
      const lower = b2 === 0 ? 0 : tops[b2 - 1][i];
      d += ' L' + (x0 + (i / n) * w).toFixed(1) + ' ' + (y0 + hgt - lower * hgt).toFixed(1);
    }
    const mid = b2 === 0 ? tops[0][4] / 2 : (tops[b2][4] + tops[b2 - 1][4]) / 2;
    return { d: d + ' Z', fill: fills[b2], name: nm, labelY: y0 + hgt - mid * hgt + 4 };
  });
}

export type MfccBar = { x: number; height: number; opacity: number; label: string };

export function mfccBars(): MfccBar[] {
  const r = rngFor('mfcc');
  const bars: MfccBar[] = [];
  for (let i = 0; i < 13; i++) {
    const v = 0.25 + 0.75 * r();
    bars.push({
      x: 8 + i * 88,
      height: 40 * v,
      opacity: 0.18 + v * 0.4,
      label: 'c' + (i + 1),
    });
  }
  return bars;
}

export function timbreRidgePath(seed: string, x0: number, yBase: number, w: number, n: number): string {
  const r = rngFor(seed);
  let d = 'M' + x0 + ' ' + yBase;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TRACK.dur;
    const lift = (eAt(t) * 0.5 + (t > 252 && t < 326 ? 0.35 : 0)) * 34 * (0.7 + 0.3 * r());
    d += ' L' + (x0 + (i / n) * w).toFixed(1) + ' ' + (yBase - lift).toFixed(1);
  }
  return d;
}

export function lensTimbrePath(seed: string, x0: number, y: number, w: number): string {
  const r = rngFor(seed);
  let d = 'M' + x0 + ' ' + (y + 20);
  for (let j = 0; j <= 26; j++) {
    const t = (j / 26) * TRACK.dur;
    d +=
      ' L' +
      (x0 + (j / 26) * w).toFixed(1) +
      ' ' +
      (y + 20 - (eAt(t) * 0.5 + (t > 252 && t < 326 ? 0.3 : 0)) * 18 * (0.75 + 0.25 * r())).toFixed(1);
  }
  return d;
}

export const DEFAULT_SECTION_SEL = 4;

export function drawCls(extra?: string) {
  return extra ? `ti-draw ${extra}` : 'ti-draw';
}
