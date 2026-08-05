// Fictional, non-commercial sample tracks only — not real recordings. Deterministic: same input ⇒ same output.

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

/* ---------- fictional sample data ---------- */
export type Ref = {
  t: string;
  a: string;
  bpm: number;
  key: string;
  dur: string;
  e: number;
  bright: number;
  dens: number;
  voc: string;
  status: string;
};

export type Track = {
  t: string;
  a: string;
  bpm: number;
  key: string;
  dur: string;
  sim: { g: number; en: number; ti: number; st: number };
  de: number;
  bright: number;
  dens: number;
  voc: string;
};

export type RefState = {
  ref: 'int' | 'up';
  custom: Ref | null;
};

export type DimKey = keyof typeof DIMNAMES;

export type RankedTrack = {
  t: Track;
  sc: number;
};

export type StructureBlock = {
  label: string;
  x: number;
  w: number;
};

export type StructureBlockRow = StructureBlock & {
  hot: boolean;
  showLabel: boolean;
  y: number;
  h: number;
};

export type PulseRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  acc: boolean;
};

export const REFS: Record<'int' | 'up', Ref> = {
  int: {
    t: 'NIGHT CIRCUIT',
    a: 'Vela Nine',
    bpm: 124,
    key: '8A',
    dur: '6:42',
    e: 0.72,
    bright: 0.45,
    dens: 0.75,
    voc: 'inst',
    status: 'internal similarity · sample data',
  },
  up: {
    t: 'UNTITLED_REF_03.WAV',
    a: 'Private upload',
    bpm: 126,
    key: '9A',
    dur: '5:58',
    e: 0.78,
    bright: 0.5,
    dens: 0.8,
    voc: 'inst',
    status: 'custom file upload · processed for you only',
  },
};

export const TRACKS: Track[] = [
  {
    t: 'PALE ORBIT',
    a: 'Kessler Line',
    bpm: 124,
    key: '8A',
    dur: '6:12',
    sim: { g: 0.95, en: 0.92, ti: 0.88, st: 0.9 },
    de: 0.02,
    bright: 0.42,
    dens: 0.78,
    voc: 'inst',
  },
  {
    t: 'TUNNEL GLASS',
    a: 'Mira Volt',
    bpm: 123,
    key: '8A',
    dur: '5:48',
    sim: { g: 0.92, en: 0.88, ti: 0.9, st: 0.85 },
    de: -0.03,
    bright: 0.4,
    dens: 0.72,
    voc: 'inst',
  },
  {
    t: 'LOW MERIDIAN',
    a: 'Oster Fen',
    bpm: 125,
    key: '9A',
    dur: '7:20',
    sim: { g: 0.9, en: 0.85, ti: 0.82, st: 0.88 },
    de: 0.1,
    bright: 0.38,
    dens: 0.8,
    voc: 'inst',
  },
  {
    t: 'VAPOUR STEP',
    a: 'Nadir Club',
    bpm: 124,
    key: '8B',
    dur: '6:05',
    sim: { g: 0.88, en: 0.9, ti: 0.75, st: 0.86 },
    de: 0.06,
    bright: 0.58,
    dens: 0.7,
    voc: 'voc',
  },
  {
    t: 'HELIX FERN',
    a: 'Duna Praxis',
    bpm: 126,
    key: '9A',
    dur: '5:32',
    sim: { g: 0.86, en: 0.94, ti: 0.79, st: 0.8 },
    de: 0.15,
    bright: 0.52,
    dens: 0.84,
    voc: 'inst',
  },
  {
    t: 'IRON GARDEN',
    a: 'Solene K',
    bpm: 122,
    key: '7A',
    dur: '6:58',
    sim: { g: 0.84, en: 0.78, ti: 0.7, st: 0.82 },
    de: -0.12,
    bright: 0.3,
    dens: 0.62,
    voc: 'voc',
  },
  {
    t: 'STATIC BLOOM',
    a: 'Ro Chamber',
    bpm: 124,
    key: '8A',
    dur: '6:30',
    sim: { g: 0.81, en: 0.72, ti: 0.92, st: 0.78 },
    de: -0.18,
    bright: 0.62,
    dens: 0.55,
    voc: 'inst',
  },
  {
    t: 'COLD PAVILION',
    a: 'Vantage Motel',
    bpm: 123,
    key: '8A',
    dur: '5:44',
    sim: { g: 0.78, en: 0.82, ti: 0.68, st: 0.9 },
    de: 0.04,
    bright: 0.35,
    dens: 0.74,
    voc: 'inst',
  },
];

export const DIMNAMES = {
  g: 'groove',
  en: 'energy',
  ti: 'timbre',
  st: 'structure',
} as const;

export function getRef(state: RefState): Ref {
  return state.custom ?? REFS[state.ref];
}

/* ---------- scoring (deterministic mock — plain feature similarity) ---------- */
export function scoreOf(tr: Track): number {
  return Math.round(((tr.sim.g + tr.sim.en + tr.sim.ti + tr.sim.st) / 4) * 100);
}

export function rankedList(ref?: Ref): RankedTrack[] {
  const currentRef = ref ?? REFS.int;
  const pool = TRACKS.filter((t) => t.t !== currentRef.t);
  return pool
    .map((t) => ({ t, sc: scoreOf(t) }))
    .sort((a, b) => b.sc - a.sc || a.t.t.localeCompare(b.t.t))
    .slice(0, 5);
}

export function topDims(tr: Track): DimKey[] {
  return (Object.keys(DIMNAMES) as DimKey[])
    .sort((a, b) => tr.sim[b] - tr.sim[a])
    .slice(0, 2);
}

const EXPL_P1: Record<DimKey, string> = {
  g: 'closely aligned groove and percussion profile',
  en: 'a matched energy journey',
  ti: 'related spectral texture',
  st: 'similar phrase structure',
};

const EXPL_P2: Record<DimKey, string> = {
  g: 'compatible groove behaviour',
  en: 'a compatible energy arc',
  ti: 'related texture and weight',
  st: 'phrase timing that transitions well',
};

export function explOf(tr: Track): string {
  const d = topDims(tr);
  const p1 = EXPL_P1[d[0]];
  const p2 = EXPL_P2[d[1]];
  const ep =
    tr.de >= 0.08
      ? 'a controlled lift in energy'
      : tr.de <= -0.08
        ? 'easing the energy for a reset'
        : 'holding the current energy';
  return p1.charAt(0).toUpperCase() + p1.slice(1) + ', with ' + p2 + ', ' + ep + '.';
}

export function keynote(tr: Track, ref?: Ref): string {
  const currentRef = ref ?? REFS.int;
  const db = tr.bpm - currentRef.bpm;
  const keyok = tr.key === currentRef.key ? 'same Camelot key' : 'harmonically compatible key';
  const br =
    Math.abs(tr.bright - currentRef.bright) < 0.06
      ? 'matched brightness'
      : tr.bright < currentRef.bright
        ? 'slightly darker'
        : 'slightly brighter';
  return (
    'tempo ' +
    (db === 0 ? '±0' : (db > 0 ? '+' : '') + db) +
    ' BPM · ' +
    keyok +
    ' · ' +
    br
  );
}

/* ---------- svg primitives (all deterministic) ---------- */
export function barsPath(name: string, x0: number, cy: number, w: number, h: number, n: number): string {
  const r = rngFor(name + 'w');
  let d = '';
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const env = 0.35 + 0.65 * Math.sin(Math.PI * (i / n)) * (0.6 + 0.4 * r());
    const bh = h * 0.5 * env * (0.45 + 0.55 * r());
    const x = (x0 + i * step + step / 2).toFixed(1);
    d += 'M' + x + ' ' + (cy - bh).toFixed(1) + 'L' + x + ' ' + (cy + bh).toFixed(1);
  }
  return d;
}

type EnergyTrack = {
  e?: number;
  de?: number;
};

export function energyD(track: EnergyTrack, x0: number, y0: number, w: number, h: number): string {
  const e = track.e !== undefined ? track.e : 0.7;
  const de = track.de || 0;
  const yb = y0 + h;
  const ph = (v: number) => yb - v * h;
  const p1 = 0.28;
  const p2 = 0.55 + e * 0.3;
  const p3 = 0.34;
  const p4 = Math.min(0.95, 0.5 + e * 0.35 + de * 0.5);
  const p5 = 0.3 + de * 0.4;
  return (
    'M' +
    x0 +
    ' ' +
    ph(p1) +
    ' C' +
    (x0 + w * 0.14) +
    ' ' +
    ph(p1 + 0.04) +
    ' ' +
    (x0 + w * 0.2) +
    ' ' +
    ph(p2 - 0.1) +
    ' ' +
    (x0 + w * 0.28) +
    ' ' +
    ph(p2) +
    ' S' +
    (x0 + w * 0.42) +
    ' ' +
    ph(p3 + 0.1) +
    ' ' +
    (x0 + w * 0.5) +
    ' ' +
    ph(p3) +
    ' S' +
    (x0 + w * 0.66) +
    ' ' +
    ph(p4) +
    ' ' +
    (x0 + w * 0.76) +
    ' ' +
    ph(p4) +
    ' S' +
    (x0 + w * 0.94) +
    ' ' +
    ph(p5) +
    ' ' +
    (x0 + w) +
    ' ' +
    ph(p5)
  );
}

export function ridgeD(
  name: string,
  layer: number | string,
  bright: number,
  x0: number,
  yb: number,
  w: number,
  amp: number,
  close?: boolean,
): string {
  const r = rngFor(name + 't' + layer);
  const n = 14;
  const step = w / n;
  let d = 'M' + x0 + ' ' + yb;
  for (let i = 0; i <= n; i++) {
    const lift = amp * (0.3 + 0.7 * Math.sin((Math.PI * i) / n)) * (0.5 + 0.5 * r()) * (0.6 + bright * 0.8);
    d += ' L' + (x0 + i * step).toFixed(1) + ' ' + (yb - lift).toFixed(1);
  }
  if (close) d += ' L' + (x0 + w) + ' ' + yb + ' Z';
  return d;
}

export function blocksOf(name: string): StructureBlock[] {
  const r = rngFor(name + 's');
  const parts: [string, number][] = [
    ['intro', 0.1 + 0.04 * r()],
    ['build', 0.16 + 0.05 * r()],
    ['drop', 0.2 + 0.05 * r()],
    ['break', 0.12 + 0.04 * r()],
    ['drop', 0.18 + 0.04 * r()],
    ['outro', 0.1 + 0.03 * r()],
  ];
  const tot = parts.reduce((s, p) => s + p[1], 0);
  let acc = 0;
  return parts.map((p) => {
    const b: StructureBlock = { label: p[0], x: acc / tot, w: p[1] / tot };
    acc += p[1];
    return b;
  });
}

export function blocksRowOf(
  name: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  _color: string,
  withLabels: boolean,
): StructureBlockRow[] {
  return blocksOf(name).map((b) => ({
    label: b.label,
    x: x0 + b.x * w,
    w: b.w * w - 3,
    hot: b.label === 'drop',
    showLabel: withLabels && h >= 22,
    y: y0,
    h,
  }));
}

export function pulsesOf(
  name: string,
  dens: number,
  x0: number,
  yb: number,
  w: number,
  h: number,
  n: number,
): PulseRect[] {
  const r = rngFor(name + 'g');
  const step = w / n;
  const out: PulseRect[] = [];
  for (let i = 0; i < n; i++) {
    const on = r() < 0.45 + dens * 0.5;
    if (!on) continue;
    const acc = r() > 0.8;
    const bh = h * (0.3 + 0.7 * r()) * (acc ? 1 : 0.72);
    out.push({
      x: x0 + i * step,
      y: yb - bh,
      width: Math.max(2.5, step * 0.38),
      height: bh,
      acc,
    });
  }
  return out;
}
