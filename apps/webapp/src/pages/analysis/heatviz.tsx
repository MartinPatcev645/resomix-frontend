/**
 * heatviz.tsx — the heavier visuals: canvas heatmap (mel-spectrogram /
 * chromagram), mood radar, Camelot wheel, and the waveform + beat-grid timeline.
 * Dependency-free; canvas for the dense heatmaps, SVG for the rest.
 */

import { useEffect, useRef, useState } from "react";
import type { Matrix, StemMetrics, TimelineTrack } from "./data.js";
import { ACCENT, fmtClock, TimeAxis, TipRows, ToggleLegend, valueAt } from "./charts.js";

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
export function Heatmap({ matrix, height = 150, gamma = 1 }: { matrix: Matrix; height?: number; gamma?: number }) {
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
        const [rr, gg, bb] = colormap(((matrix.data[r][c] - min) / span) ** gamma);
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

/* ------------------------------------------------- SpectrogramView (labeled) */
// The mel-spectrogram is dB power over 40 mel bands (0 → Nyquist). We keep the
// heatmap edge-to-edge (so the shared playhead/seek stays aligned with the other
// full-track charts) and overlay a mel-scaled Hz axis, a time axis, and a
// power colorbar — the librosa `specshow` look, without breaking alignment.
const DB_RANGE = 120; // display window in dB below the peak
const DB_TICKS = [-120, -110, -100, -90, -80, -70, -60, -50, -40, -30, -20, -10, 0];
const HZ_STEP = 2000; // linear frequency ticks every 2 kHz (0, 2k, 4k, … Nyquist)
const fmtHz = (f: number) => (f === 0 ? "0" : f >= 1000 ? `${Math.round(f / 1000)}k` : `${f}`);
const CHROMA_LABELS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const hzToMel = (f: number) => 2595 * Math.log10(1 + f / 700);

function niceTimeTicks(durationMs: number): number[] {
  if (durationMs <= 0) return [];
  const secs = durationMs / 1000;
  const step = [5, 10, 15, 30, 60, 120, 300, 600].find((s) => secs / s <= 8) ?? 600;
  const out: number[] = [];
  for (let t = 0; t <= secs + 1e-6; t += step) out.push(t * 1000);
  return out;
}

export function SpectrogramView({
  matrix,
  sampleRateHz,
  durationMs,
  currentMs,
  onSeek,
  height = 190,
  linear = false,
}: {
  matrix: Matrix;
  sampleRateHz: number;
  durationMs: number;
  currentMs?: number | null;
  onSeek?: (ms: number) => void;
  height?: number;
  // true = rows are already linear frequency bins (draw directly); false = mel
  // bands (resample onto a linear axis).
  linear?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rows = matrix.data.length;
    const cols = rows ? matrix.data[0].length : 0;
    if (!rows || !cols) return;

    // dB relative to the peak, clamped to the display window below it.
    let max = -Infinity;
    for (const row of matrix.data) for (const v of row) if (v > max) max = v;
    const floor = max - DB_RANGE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (linear) {
      // Already a linear-frequency spectrogram — draw each bin directly (low bin
      // at the bottom); the axis is linear so no remap is needed.
      canvas.width = cols;
      canvas.height = rows;
      const img = ctx.createImageData(cols, rows);
      for (let r = 0; r < rows; r++) {
        const yr = rows - 1 - r; // low frequency at the bottom
        for (let c = 0; c < cols; c++) {
          const [rr, gg, bb] = colormap((matrix.data[r][c] - floor) / DB_RANGE);
          const o = (yr * cols + c) * 4;
          img.data[o] = rr;
          img.data[o + 1] = gg;
          img.data[o + 2] = bb;
          img.data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    // Fallback (older results): mel-banded data — resample onto a LINEAR axis so
    // the display + ticks are evenly spaced in Hz. Row y (0 = top = Nyquist)
    // samples the mel band whose centre frequency matches (interpolated).
    const fmaxHz = sampleRateHz > 0 ? sampleRateHz / 2 : 22050;
    const melMaxHz = hzToMel(fmaxHz) || 1;
    const OUT = 256; // vertical render resolution
    const bandAt = new Float32Array(OUT);
    for (let y = 0; y < OUT; y++) {
      const f = fmaxHz * (1 - y / (OUT - 1));
      bandAt[y] = (hzToMel(f) / melMaxHz) * (rows - 1);
    }
    canvas.width = cols;
    canvas.height = OUT;
    const img = ctx.createImageData(cols, OUT);
    for (let y = 0; y < OUT; y++) {
      const bp = bandAt[y];
      const b0 = Math.max(0, Math.min(rows - 1, Math.floor(bp)));
      const b1 = Math.min(rows - 1, b0 + 1);
      const t = bp - b0;
      const row0 = matrix.data[b0];
      const row1 = matrix.data[b1];
      for (let c = 0; c < cols; c++) {
        const v = row0[c] * (1 - t) + row1[c] * t; // interpolate between mel bands
        const [rr, gg, bb] = colormap((v - floor) / DB_RANGE);
        const o = (y * cols + c) * 4;
        img.data[o] = rr;
        img.data[o + 1] = gg;
        img.data[o + 2] = bb;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [matrix, sampleRateHz, linear]);

  const rows = matrix.data.length;
  const cols = rows ? matrix.data[0].length : 0;
  if (!rows || !cols) {
    return <div className="grid h-[var(--px-80)] place-items-center text-[length:var(--px-11)] opacity-40">no spectrogram</div>;
  }

  const fmax = sampleRateHz > 0 ? sampleRateHz / 2 : 22050;
  const yFrac = (f: number) => 1 - f / fmax; // LINEAR frequency axis (0 = top)
  const hzTicks: number[] = [];
  for (let f = 0; f <= fmax + 1; f += HZ_STEP) hzTicks.push(f); // 0, 2k, 4k, … up to Nyquist
  const timeTicks = niceTimeTicks(durationMs);
  const gradient = `linear-gradient(to right, ${STOPS.map(
    ([p, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${Math.round(p * 100)}%`,
  ).join(", ")})`;

  return (
    <div className="flex">
      {/* frequency axis — OUTSIDE the plot, evenly spaced (0, 2k, 4k … Nyquist) */}
      <div className="relative shrink-0 w-[var(--px-34)]" style={{ height }}>
        {hzTicks.map((f) => (
          <div
            key={f}
            className="pointer-events-none absolute right-0 flex items-center gap-[var(--px-3)]"
            style={{ top: `${yFrac(f) * 100}%`, transform: "translateY(-50%)" }}
          >
            <span className="font-helvetica text-[length:var(--px-9)] tabular-nums opacity-55">{fmtHz(f)}</span>
            <span className="h-px w-[var(--px-5)] bg-white/40" />
          </div>
        ))}
      </div>

      {/* plot + time axis + power scale, all sharing the plot's width */}
      <div className="min-w-0 flex-1">
        <TimeAxis durationMs={durationMs} currentMs={currentMs ?? null} onSeek={onSeek} tooltip={() => null}>
          <canvas ref={ref} className="block w-full rounded-[var(--px-8)]" style={{ height, imageRendering: "pixelated" }} />
        </TimeAxis>

        {timeTicks.length > 1 && (
          <div className="relative mt-[var(--px-4)] h-[var(--px-12)]">
            {timeTicks.map((t) => {
              const frac = durationMs > 0 ? t / durationMs : 0;
              if (frac > 1.0001) return null;
              const tx = frac < 0.03 ? "translateX(0)" : frac > 0.97 ? "translateX(-100%)" : "translateX(-50%)";
              return (
                <span
                  key={t}
                  className="absolute font-helvetica text-[length:var(--px-9)] tabular-nums opacity-45"
                  style={{ left: `${Math.min(100, frac * 100)}%`, transform: tx }}
                >
                  {fmtClock(t)}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-[var(--px-6)] flex items-center gap-[var(--px-10)]">
          <span className="shrink-0 font-helvetica text-[length:var(--px-9)] uppercase tracking-wide opacity-45">Power</span>
          <div className="flex-1">
            <div className="h-[var(--px-8)] w-full rounded-full" style={{ background: gradient }} />
            <div className="relative mt-[var(--px-2)] h-[var(--px-10)]">
              {DB_TICKS.map((db) => {
                const frac = (db + DB_RANGE) / DB_RANGE; // −120 → 0 (left), 0 → 1 (right)
                const tx = frac < 0.03 ? "translateX(0)" : frac > 0.97 ? "translateX(-100%)" : "translateX(-50%)";
                return (
                  <span
                    key={db}
                    className="absolute font-helvetica text-[length:var(--px-9)] tabular-nums opacity-45"
                    style={{ left: `${frac * 100}%`, transform: tx }}
                  >
                    {db} dB
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------- ChromaView (labeled chroma) */
// The chromagram is 12 pitch-class rows (C…B) over time. We reuse the Heatmap
// canvas but add the pitch labels down the left + a hover that reports the
// strongest pitch classes at that moment (and keeps the shared playhead/seek).
export function ChromaView({
  matrix,
  durationMs,
  currentMs,
  onSeek,
  height = 130,
}: {
  matrix: Matrix;
  durationMs: number;
  currentMs?: number | null;
  onSeek?: (ms: number) => void;
  height?: number;
}) {
  const rows = matrix.data.length;
  const cols = rows ? matrix.data[0].length : 0;
  if (!rows || !cols) {
    return <div className="grid h-[var(--px-80)] place-items-center text-[length:var(--px-11)] opacity-40">no chromagram</div>;
  }

  // pitch-class intensities at a time fraction, strongest first.
  const chromaAt = (frac: number) => {
    const f = Math.min(cols - 1, Math.max(0, Math.round(frac * (cols - 1))));
    return matrix.data
      .map((row, i) => ({ label: CHROMA_LABELS[i] ?? String(i), v: row[f] ?? 0 }))
      .sort((a, b) => b.v - a.v);
  };

  return (
    <div className="flex">
      {/* pitch-class axis — OUTSIDE the plot (C at the bottom … B at the top) */}
      <div className="relative shrink-0 w-[var(--px-24)]" style={{ height }}>
        {CHROMA_LABELS.slice(0, rows).map((lab, i) => {
          const yr = rows - 1 - i; // pitch-class 0 (C) at the bottom
          return (
            <div
              key={lab + i}
              className="pointer-events-none absolute right-0 flex items-center gap-[var(--px-3)]"
              style={{ top: `${((yr + 0.5) / rows) * 100}%`, transform: "translateY(-50%)" }}
            >
              <span className="font-helvetica text-[length:var(--px-8)] tabular-nums opacity-55">{lab}</span>
              <span className="h-px w-[var(--px-4)] bg-white/40" />
            </div>
          );
        })}
      </div>

      <div className="min-w-0 flex-1">
        <TimeAxis
          durationMs={durationMs}
          currentMs={currentMs ?? null}
          onSeek={onSeek}
          tooltip={(frac) => (
            <TipRows rows={chromaAt(frac).slice(0, 4).map((t) => ({ label: t.label, value: `${(t.v * 100).toFixed(0)}%` }))} />
          )}
        >
          <Heatmap matrix={matrix} height={height} gamma={2.2} />
        </TimeAxis>
      </div>
    </div>
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
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-[var(--px-260)]">
      {/* viewBox padded horizontally so the side labels (e.g. "relaxed") don't clip */}
      <svg viewBox="-26 -6 252 212" className="w-full">
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
          const [x, y] = pt(i, R * Math.max(0.02, dims[k]));
          return (
            <circle
              key={`d${k}`}
              cx={x}
              cy={y}
              r={hover === k ? 5.5 : 3.5}
              fill={ACCENT}
              className="cursor-default"
              style={{ transition: "r 0.12s" }}
              onPointerEnter={() => setHover(k)}
              onPointerLeave={() => setHover(null)}
            />
          );
        })}
        {axes.map((k, i) => {
          const [x, y] = pt(i, R + 12);
          return (
            <text
              key={k}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="cursor-default fill-current font-helvetica"
              fontSize="9"
              opacity={hover === k ? 1 : 0.7}
              fontWeight={hover === k ? 600 : 400}
              onPointerEnter={() => setHover(k)}
              onPointerLeave={() => setHover(null)}
            >
              {k}
            </text>
          );
        })}
      </svg>
      <div className="h-[var(--px-12)] text-center font-helvetica text-[length:var(--px-9)] tabular-nums opacity-70">
        {hover ? `${hover} · ${(dims[hover] * 100).toFixed(0)}%` : ""}
      </div>
    </div>
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
  const [hover, setHover] = useState<string | null>(null);

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
    <div className="mx-auto w-full max-w-[var(--px-260)]">
      <svg viewBox="0 0 220 220" className="w-full">
      {WHEEL.map((_, i) => {
        const active = isActive(i, "B");
        const neigh = isNeighbor(i, "B");
        const key = `${i + 1}B · ${WHEEL[i].major} major`;
        return (
          <g key={`b${i}`}>
            <path
              d={seg(i, 62, 100)}
              fill={active ? ACCENT : neigh ? "rgba(238,74,38,0.28)" : "var(--opacity-10)"}
              stroke="currentColor"
              strokeOpacity={hover === key ? 0.6 : 0.15}
              className="cursor-default transition-[stroke-opacity]"
              onPointerEnter={() => setHover(key)}
              onPointerLeave={() => setHover(null)}
            >
              <title>{key}</title>
            </path>
            <text {...xy(labelPos(i, 81))} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize="7.5" opacity={active ? 1 : 0.75}>
              {i + 1}B
            </text>
          </g>
        );
      })}
      {WHEEL.map((_, i) => {
        const active = isActive(i, "A");
        const neigh = isNeighbor(i, "A");
        const key = `${i + 1}A · ${WHEEL[i].minor}`;
        return (
          <g key={`a${i}`}>
            <path
              d={seg(i, 30, 62)}
              fill={active ? ACCENT : neigh ? "rgba(238,74,38,0.28)" : "var(--opacity-10)"}
              stroke="currentColor"
              strokeOpacity={hover === key ? 0.6 : 0.15}
              className="cursor-default transition-[stroke-opacity]"
              onPointerEnter={() => setHover(key)}
              onPointerLeave={() => setHover(null)}
            >
              <title>{key}</title>
            </path>
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
      <div className="h-[var(--px-12)] text-center font-helvetica text-[length:var(--px-9)] opacity-70">
        {hover ?? (side === "B" ? `${camelot} · ${WHEEL[num - 1]?.major ?? ""} major` : `${camelot} · ${WHEEL[num - 1]?.minor ?? ""}`)}
      </div>
    </div>
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
  downbeats = [],
  phraseBoundaries = [],
  bassEntryMs = null,
  voiceRegions = [],
  durationMs,
  height = 120,
  showBeats = false,
}: {
  energy: number[];
  beatTimes: number[];
  onsetTimes: number[];
  downbeats?: number[];
  phraseBoundaries?: number[];
  bassEntryMs?: number | null;
  voiceRegions?: { startMs: number; endMs: number; meanScore: number }[];
  durationMs: number;
  height?: number;
  showBeats?: boolean;
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
  // Bar grid: detected downbeats if present, else every 4th beat.
  const gridTimes = downbeats.length ? downbeats : beatTimes.filter((_, i) => i % 4 === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {/* faint bar grid behind the waveform (default view) */}
      {!showBeats && gridTimes.map((t, i) => (
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
      {/* bright beat grid ON TOP of the waveform (toggled on) */}
      {showBeats && gridTimes.map((t, i) => (
        <line key={`bb${i}`} x1={xOf(t)} x2={xOf(t)} y1={0} y2={H} stroke="#fff" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
      ))}
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
  currentMs = null,
}: {
  segments: Segment[];
  durationMs: number;
  currentMs?: number | null;
}) {
  return (
    <div>
      <div className="pointer-events-none flex h-[var(--px-44)] w-full overflow-hidden rounded-[var(--px-8)]">
        {segments.map((s, i) => {
          const w = ((s.endMs - s.startMs) / durationMs) * 100;
          const active = currentMs != null && currentMs >= s.startMs && currentMs < s.endMs;
          return (
            <div
              key={i}
              className={"relative flex items-center justify-center border-r border-black/30 " + (active ? "brightness-[1.35]" : "")}
              style={{ width: `${w}%`, background: SECTION_COLOR[s.label] ?? SECTION_COLOR.section }}
            >
              <span className="truncate px-[var(--px-4)] font-helvetica text-[length:var(--px-9)] uppercase tracking-[var(--px-1)]">
                {w > 6 ? s.label : ""}
              </span>
            </div>
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

/** Section label at a 0..1 fraction of the track (for the structure tooltip). */
export function sectionAt(segments: Segment[], durationMs: number, frac: number): string | null {
  const ms = frac * durationMs;
  const seg = segments.find((s) => ms >= s.startMs && ms < s.endMs);
  return seg ? seg.label : null;
}

/* -------------------------------------------------------------- RibbonChart */
export function RibbonChart({
  track,
  rowHeight = 18,
  labelTransform,
}: {
  track: TimelineTrack;
  rowHeight?: number;
  labelTransform?: (label: string) => string;
}) {
  return (
    <div className="flex flex-col gap-[var(--px-4)]">
      {track.series.map((s) => {
        const label = labelTransform ? labelTransform(s.label) : s.label;
        return (
          <div key={s.label} className="relative">
            <RibbonRow values={s.values} height={rowHeight} />
            <span
              title={label}
              className="pointer-events-none absolute left-[var(--px-6)] top-1/2 max-w-[45%] -translate-y-1/2 truncate font-helvetica text-[length:var(--px-9)] lowercase text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]"
            >
              {label}
            </span>
          </div>
        );
      })}
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
      className="block w-full rounded-[var(--px-4)] bg-[var(--opacity-15)]"
      style={{ height, imageRendering: "pixelated" }}
    />
  );
}

/* ------------------------------------------------------------- StemArea */
export function StemArea({
  stems,
  hidden,
  onToggle,
  height = 150,
  durationMs,
  currentMs = null,
  onSeek,
  vocalRegions = [],
}: {
  stems: Record<string, StemMetrics>;
  hidden?: Set<string>;
  onToggle?: (name: string) => void;
  height?: number;
  durationMs?: number;
  currentMs?: number | null;
  onSeek?: (ms: number) => void;
  vocalRegions?: { startMs: number; endMs: number; meanScore: number }[];
}) {
  const allNames = Object.keys(stems);
  const names = allNames.filter((n) => !hidden?.has(n)); // stacked in this order
  const W = 1000;
  const H = height;
  const nPoints = allNames.length ? stems[allNames[0]].energyCurve.values.length : 0;
  if (!nPoints) return null;

  // Scale by the TOTAL stack (all stems) so hiding a stem removes its band
  // without rescaling the others — the remaining heights stay truthful.
  const totalCol = Array.from({ length: nPoints }, (_, i) =>
    allNames.reduce((s, name) => s + (stems[name].energyCurve.values[i] ?? 0), 0),
  );
  const maxSum = Math.max(...totalCol, 0.0001);

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

  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full rounded-[var(--px-8)]" style={{ height }}>
      {/* measured vocal-activity regions (from the vocals stem), behind the areas */}
      {durationMs
        ? vocalRegions.map((r, i) => (
            <rect
              key={`vr${i}`}
              x={(r.startMs / durationMs) * W}
              y={0}
              width={Math.max(0, ((r.endMs - r.startMs) / durationMs) * W)}
              height={H}
              fill={STEM_COLORS.vocals}
              fillOpacity={0.12}
            />
          ))
        : null}
      {polys.map((p) => (
        <polygon key={p.name} points={p.points} fill={STEM_COLORS[p.name] ?? "#888"} fillOpacity={0.8} />
      ))}
    </svg>
  );
  const tip = (frac: number) => (
    <TipRows
      rows={names.map((name) => {
        const v = valueAt(stems[name].energyCurve.values, frac);
        return { label: name, value: v == null ? "–" : `${(v * 100).toFixed(0)}%`, color: STEM_COLORS[name] ?? "#888" };
      })}
    />
  );

  return (
    <div>
      {durationMs ? (
        <TimeAxis durationMs={durationMs} currentMs={currentMs} onSeek={onSeek} tooltip={tip}>
          {svg}
        </TimeAxis>
      ) : (
        svg
      )}
      {onToggle ? (
        <ToggleLegend
          items={allNames.map((n) => ({ label: n, color: STEM_COLORS[n] ?? "#888", suffix: `${stems[n].presencePct.toFixed(0)}%` }))}
          hidden={hidden ?? new Set()}
          onToggle={onToggle}
        />
      ) : (
        <div className="mt-[var(--px-8)] flex flex-wrap gap-[var(--px-12)]">
          {allNames.map((name) => (
            <span key={name} className="flex items-center gap-[var(--px-5)] font-helvetica text-[length:var(--px-10)] opacity-70">
              <span className="inline-block h-[var(--px-8)] w-[var(--px-8)] rounded-full" style={{ background: STEM_COLORS[name] ?? "#888" }} />
              {name} · {stems[name].presencePct.toFixed(0)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Donut */
export function Donut({ stems, hidden }: { stems: Record<string, StemMetrics>; hidden?: Set<string> }) {
  const names = Object.keys(stems);
  const total = names.reduce((s, n) => s + stems[n].presencePct, 0) || 1;
  const R = 38;
  const C = 2 * Math.PI * R;
  const [hovered, setHovered] = useState<string | null>(null);
  let acc = 0;

  return (
    <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-[var(--px-140)]">
      {names.map((name) => {
        const frac = stems[name].presencePct / total;
        const dash = frac * C;
        const off = -acc * C;
        acc += frac;
        const isHidden = hidden?.has(name);
        const isHover = hovered === name;
        // deselected -> faded; hover -> full opacity + a "zoom" via thicker ring.
        const opacity = isHidden ? (isHover ? 0.85 : 0.22) : isHover ? 1 : 0.9;
        return (
          <circle
            key={name}
            r={R}
            cx={50}
            cy={50}
            fill="none"
            stroke={STEM_COLORS[name] ?? "#888"}
            strokeWidth={isHover ? 21 : 14}
            strokeOpacity={opacity}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={off}
            transform="rotate(-90 50 50)"
            onPointerEnter={() => setHovered(name)}
            onPointerLeave={() => setHovered(null)}
            style={{ transition: "stroke-width 0.15s ease, stroke-opacity 0.15s ease" }}
          />
        );
      })}
      <text x={50} y={hovered ? 47 : 50} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize={hovered ? 12 : 8} fontWeight={hovered ? 600 : 400} opacity={hovered ? 1 : 0.6}>
        {hovered ? `${stems[hovered].presencePct.toFixed(0)}%` : "mix"}
      </text>
      {hovered && (
        <text x={50} y={60} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica lowercase" fontSize={7} opacity={0.7}>
          {hovered}
        </text>
      )}
    </svg>
  );
}
