/**
 * heatviz.tsx — the heavier visuals: canvas heatmap (mel-spectrogram /
 * chromagram), mood radar, Camelot wheel, and the waveform + beat-grid timeline.
 * Dependency-free; canvas for the dense heatmaps, SVG for the rest.
 */

import { useEffect, useRef } from "react";
import type { Matrix, StemMetrics, TimelineTrack } from "./data.js";
import { ACCENT } from "./charts.js";

export const STEM_COLORS: Record<string, string> = {
  drums: "#EE4A26",
  bass: "#7fb0ff",
  other: "#8fd694",
  vocals: "#c88fe0",
};

/* ---------------------------------------------------- colormap (magma-ish) */
const STOPS: [number, [number, number, number]][] = [
  [0.0, [8, 8, 18]],
  [0.35, [70, 24, 78]],
  [0.6, [170, 48, 60]],
  [0.8, [238, 96, 40]],
  [1.0, [255, 224, 150]],
];
function colormap(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = (x - t0) / (t1 - t0 || 1);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/* --------------------------------------------------------------- Heatmap */
export function Heatmap({ matrix, height = 150 }: { matrix: Matrix; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rows = matrix.data.length;
    const cols = rows ? matrix.data[0].length : 0;
    if (!rows || !cols) return;

    // Normalize across the whole matrix for display.
    let min = Infinity;
    let max = -Infinity;
    for (const row of matrix.data) for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min || 1;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = cols;
    canvas.height = rows;
    const img = ctx.createImageData(cols, rows);
    for (let r = 0; r < rows; r++) {
      // Draw low index at the bottom (natural frequency / pitch orientation).
      const yr = rows - 1 - r;
      for (let c = 0; c < cols; c++) {
        const [rr, gg, bb] = colormap((matrix.data[r][c] - min) / span);
        const o = (yr * cols + c) * 4;
        img.data[o] = rr;
        img.data[o + 1] = gg;
        img.data[o + 2] = bb;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [matrix]);

  return (
    <canvas
      ref={ref}
      className="w-full rounded-[var(--px-8)]"
      style={{ height, imageRendering: "pixelated" }}
    />
  );
}

/* ------------------------------------------------------------- MoodRadar */
const MOOD_ORDER = ["happy", "party", "aggressive", "sad", "relaxed"];
export function MoodRadar({ dims }: { dims: Record<string, number> }) {
  const cx = 100;
  const cy = 100;
  const R = 78;
  const axes = MOOD_ORDER.filter((k) => k in dims);
  const n = axes.length;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  const poly = axes
    .map((k, i) => {
      const [x, y] = pt(i, R * Math.max(0.02, dims[k]));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[var(--px-260)]">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon
          key={g}
          points={axes.map((_, i) => pt(i, R * g).map((v) => v.toFixed(1)).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.12} />;
      })}
      <polygon points={poly} fill={ACCENT} fillOpacity={0.28} stroke={ACCENT} strokeWidth={1.5} />
      {axes.map((k, i) => {
        const [x, y] = pt(i, R + 12);
        return (
          <text
            key={k}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-current font-helvetica"
            fontSize="9"
            opacity={0.7}
          >
            {k}
          </text>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------- CamelotWheel */
// tonic pitch-class order around the wheel (Camelot 1..12 => these keys)
const WHEEL = [
  { b: "B", major: "B", minor: "G#m" },
  { b: "F#", major: "F#", minor: "D#m" },
  { b: "Db", major: "Db", minor: "Bbm" },
  { b: "Ab", major: "Ab", minor: "Fm" },
  { b: "Eb", major: "Eb", minor: "Cm" },
  { b: "Bb", major: "Bb", minor: "Gm" },
  { b: "F", major: "F", minor: "Dm" },
  { b: "C", major: "C", minor: "Am" },
  { b: "G", major: "G", minor: "Em" },
  { b: "D", major: "D", minor: "Bm" },
  { b: "A", major: "A", minor: "F#m" },
  { b: "E", major: "E", minor: "C#m" },
];
export function CamelotWheel({ camelot }: { camelot: string }) {
  const num = parseInt(camelot, 10); // 1..12
  const side = camelot.slice(-1).toUpperCase(); // "A" | "B"
  const cx = 110;
  const cy = 110;

  const seg = (i: number, rInner: number, rOuter: number) => {
    const a0 = (Math.PI * 2 * (i - 0.5)) / 12 - Math.PI / 2;
    const a1 = (Math.PI * 2 * (i + 0.5)) / 12 - Math.PI / 2;
    const p = (a: number, r: number) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    return `M${p(a0, rInner)} L${p(a0, rOuter)} A${rOuter} ${rOuter} 0 0 1 ${p(a1, rOuter)} L${p(a1, rInner)} A${rInner} ${rInner} 0 0 0 ${p(a0, rInner)} Z`;
  };
  const labelPos = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  const isActive = (i: number, s: "A" | "B") => i + 1 === num && side === s;
  const isNeighbor = (i: number, s: "A" | "B") =>
    (s === side && (i + 1 === (num % 12) + 1 || i + 1 === ((num + 10) % 12) + 1)) ||
    (i + 1 === num && s !== side);

  return (
    <svg viewBox="0 0 220 220" className="mx-auto w-full max-w-[var(--px-260)]">
      {WHEEL.map((_, i) => {
        const active = isActive(i, "B");
        const neigh = isNeighbor(i, "B");
        return (
          <g key={`b${i}`}>
            <path
              d={seg(i, 62, 100)}
              fill={active ? ACCENT : neigh ? "rgba(238,74,38,0.28)" : "var(--opacity-10)"}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            <text {...xy(labelPos(i, 81))} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize="7.5" opacity={active ? 1 : 0.75}>
              {i + 1}B
            </text>
          </g>
        );
      })}
      {WHEEL.map((_, i) => {
        const active = isActive(i, "A");
        const neigh = isNeighbor(i, "A");
        return (
          <g key={`a${i}`}>
            <path
              d={seg(i, 30, 62)}
              fill={active ? ACCENT : neigh ? "rgba(238,74,38,0.28)" : "var(--opacity-10)"}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            <text {...xy(labelPos(i, 46))} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize="7" opacity={active ? 1 : 0.6}>
              {i + 1}A
            </text>
          </g>
        );
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize="15" fontWeight={600}>
        {camelot}
      </text>
    </svg>
  );
}
function xy([x, y]: readonly [number, number]) {
  return { x, y };
}

/* --------------------------------------------------------- WaveTimeline */
export function WaveTimeline({
  energy,
  beatTimes,
  onsetTimes,
  phraseBoundaries = [],
  bassEntryMs = null,
  voiceRegions = [],
  durationMs,
  cursorMs = null,
  onSeek,
  height = 120,
}: {
  energy: number[];
  beatTimes: number[];
  onsetTimes: number[];
  phraseBoundaries?: number[];
  bassEntryMs?: number | null;
  voiceRegions?: { startMs: number; endMs: number; meanScore: number }[];
  durationMs: number;
  cursorMs?: number | null;
  onSeek?: (ms: number) => void;
  height?: number;
}) {
  const W = 1000;
  const H = height;
  const durS = durationMs / 1000;
  const min = Math.min(...energy);
  const max = Math.max(...energy);
  const span = max - min || 1;
  const mid = H / 2;

  const amp = (v: number) => ((v - min) / span) * (H / 2 - 2);
  const top = energy.map((v, i) => `${((i / (energy.length - 1)) * W).toFixed(1)},${(mid - amp(v)).toFixed(1)}`);
  const bottom = energy
    .map((v, i) => `${((i / (energy.length - 1)) * W).toFixed(1)},${(mid + amp(v)).toFixed(1)}`)
    .reverse();
  const poly = [...top, ...bottom].join(" ");
  const xOf = (t: number) => (t / durS) * W;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={"w-full " + (onSeek ? "cursor-pointer" : "")}
      style={{ height }}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - r.left) / r.width) * durationMs);
      }}
    >
      {/* bar grid (every 4th beat) */}
      {beatTimes.filter((_, i) => i % 4 === 0).map((t, i) => (
        <line key={`b${i}`} x1={xOf(t)} x2={xOf(t)} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.06} vectorEffect="non-scaling-stroke" />
      ))}
      {/* phrase boundaries (stronger) */}
      {phraseBoundaries.map((t, i) => (
        <line key={`p${i}`} x1={xOf(t)} x2={xOf(t)} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.18} vectorEffect="non-scaling-stroke" />
      ))}
      {/* vocal-activity regions (behind the waveform) */}
      {voiceRegions.map((r, i) => (
        <g key={`v${i}`}>
          <rect x={xOf(r.startMs / 1000)} y={0} width={xOf(r.endMs / 1000) - xOf(r.startMs / 1000)} height={H} fill="#7fb0ff" fillOpacity={0.16} />
          <text x={xOf(r.startMs / 1000) + 3} y={H - 4} className="font-helvetica" fontSize="8" fill="#7fb0ff">vox</text>
        </g>
      ))}
      <polygon points={poly} fill={ACCENT} fillOpacity={0.75} />
      {/* onsets on the centre line */}
      {onsetTimes.map((t, i) => (
        <circle key={`o${i}`} cx={xOf(t)} cy={mid} r={1.1} fill="currentColor" opacity={0.3} />
      ))}
      {/* bass entry marker */}
      {bassEntryMs != null && (
        <>
          <line x1={xOf(bassEntryMs / 1000)} x2={xOf(bassEntryMs / 1000)} y1={0} y2={H} stroke="#7fb0ff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={xOf(bassEntryMs / 1000) + 4} y={12} className="fill-current font-helvetica" fontSize="9" fill="#7fb0ff">bass</text>
        </>
      )}
      {/* playhead cursor */}
      {cursorMs != null && (
        <line x1={xOf(cursorMs / 1000)} x2={xOf(cursorMs / 1000)} y1={0} y2={H} stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------ StructureTimeline */
type Segment = { startMs: number; endMs: number; label: string; confidence: number };

const SECTION_COLOR: Record<string, string> = {
  intro: "rgba(238,74,38,0.22)",
  build: "rgba(238,74,38,0.5)",
  drop: "#EE4A26",
  breakdown: "rgba(127,176,255,0.45)",
  outro: "rgba(238,74,38,0.18)",
  section: "rgba(255,255,255,0.15)",
};

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function StructureTimeline({
  segments,
  durationMs,
  cursorMs = null,
  onSeek,
}: {
  segments: Segment[];
  durationMs: number;
  cursorMs?: number | null;
  onSeek?: (ms: number) => void;
}) {
  return (
    <div>
      <div className="flex h-[var(--px-44)] w-full overflow-hidden rounded-[var(--px-8)]">
        {segments.map((s, i) => {
          const w = ((s.endMs - s.startMs) / durationMs) * 100;
          const active = cursorMs != null && cursorMs >= s.startMs && cursorMs < s.endMs;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSeek?.(s.startMs)}
              title={`${s.label} · ${fmtTime(s.startMs)}–${fmtTime(s.endMs)} · ${(s.confidence * 100).toFixed(0)}% conf`}
              className={
                "relative flex items-center justify-center border-r border-black/30 transition-opacity " +
                (active ? "opacity-100 ring-1 ring-white/70" : "opacity-90 hover:opacity-100")
              }
              style={{ width: `${w}%`, background: SECTION_COLOR[s.label] ?? SECTION_COLOR.section }}
            >
              <span className="truncate px-[var(--px-4)] font-helvetica text-[length:var(--px-9)] uppercase tracking-[var(--px-1)]">
                {w > 6 ? s.label : ""}
              </span>
            </button>
          );
        })}
      </div>
      {/* time axis */}
      <div className="mt-[var(--px-4)] flex justify-between font-helvetica text-[length:var(--px-8)] opacity-40">
        <span>0:00</span>
        <span>{fmtTime(durationMs / 2)}</span>
        <span>{fmtTime(durationMs)}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- RibbonChart */
export function RibbonChart({ track, rowHeight = 16 }: { track: TimelineTrack; rowHeight?: number }) {
  return (
    <div className="flex flex-col gap-[var(--px-4)]">
      {track.series.map((s) => (
        <div key={s.label} className="flex items-center gap-[var(--px-8)]">
          <span className="w-[var(--px-90)] shrink-0 truncate font-helvetica text-[length:var(--px-10)] lowercase opacity-70">
            {s.label}
          </span>
          <RibbonRow values={s.values} height={rowHeight} />
        </div>
      ))}
    </div>
  );
}

function RibbonRow({ values, height }: { values: number[]; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || values.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const n = values.length;
    canvas.width = n;
    canvas.height = 1;
    const img = ctx.createImageData(n, 1);
    for (let c = 0; c < n; c++) {
      const a = Math.max(0, Math.min(1, values[c]));
      const o = c * 4;
      img.data[o] = 238;
      img.data[o + 1] = 74;
      img.data[o + 2] = 38;
      img.data[o + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
  }, [values]);
  return (
    <canvas
      ref={ref}
      className="min-w-0 flex-1 rounded-[var(--px-4)] bg-[var(--opacity-15)]"
      style={{ height, imageRendering: "pixelated" }}
    />
  );
}

/* ------------------------------------------------------------- StemArea */
export function StemArea({ stems, height = 150 }: { stems: Record<string, StemMetrics>; height?: number }) {
  const names = Object.keys(stems);
  const W = 1000;
  const H = height;
  const nPoints = names.length ? stems[names[0]].energyCurve.values.length : 0;
  if (!nPoints) return null;

  const colSum = Array.from({ length: nPoints }, (_, i) =>
    names.reduce((s, name) => s + (stems[name].energyCurve.values[i] ?? 0), 0),
  );
  const maxSum = Math.max(...colSum, 0.0001);

  let cumulative = new Array(nPoints).fill(0);
  const polys = names.map((name) => {
    const vals = stems[name].energyCurve.values;
    const lower = cumulative.slice();
    const upper = lower.map((l, i) => l + (vals[i] ?? 0));
    cumulative = upper;
    const x = (i: number) => (i / (nPoints - 1)) * W;
    const yOf = (v: number) => H - (v / maxSum) * H;
    const top = upper.map((v, i) => `${x(i).toFixed(1)},${yOf(v).toFixed(1)}`);
    const bot = lower.map((v, i) => `${x(i).toFixed(1)},${yOf(v).toFixed(1)}`).reverse();
    return { name, points: [...top, ...bot].join(" ") };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full rounded-[var(--px-8)]" style={{ height }}>
        {polys.map((p) => (
          <polygon key={p.name} points={p.points} fill={STEM_COLORS[p.name] ?? "#888"} fillOpacity={0.78} />
        ))}
      </svg>
      <div className="mt-[var(--px-8)] flex flex-wrap gap-[var(--px-12)]">
        {names.map((name) => (
          <span key={name} className="flex items-center gap-[var(--px-5)] font-helvetica text-[length:var(--px-10)] opacity-70">
            <span className="inline-block h-[var(--px-8)] w-[var(--px-8)] rounded-full" style={{ background: STEM_COLORS[name] ?? "#888" }} />
            {name} · {stems[name].presencePct.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Donut */
export function Donut({ stems }: { stems: Record<string, StemMetrics> }) {
  const names = Object.keys(stems);
  const total = names.reduce((s, n) => s + stems[n].presencePct, 0) || 1;
  const R = 38;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-[var(--px-140)]">
      {names.map((name) => {
        const frac = stems[name].presencePct / total;
        const dash = frac * C;
        const el = (
          <circle
            key={name}
            r={R}
            cx={50}
            cy={50}
            fill="none"
            stroke={STEM_COLORS[name] ?? "#888"}
            strokeWidth={14}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-acc * C}
            transform="rotate(-90 50 50)"
          />
        );
        acc += frac;
        return el;
      })}
      <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize="8" opacity={0.6}>
        mix
      </text>
    </svg>
  );
}
