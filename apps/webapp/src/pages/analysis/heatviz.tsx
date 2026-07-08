/**
 * heatviz.tsx — the heavier visuals: canvas heatmap (mel-spectrogram /
 * chromagram), mood radar, Camelot wheel, and the waveform + beat-grid timeline.
 * Dependency-free; canvas for the dense heatmaps, SVG for the rest.
 */

import { useEffect, useRef } from "react";
import type { Matrix } from "./data.js";
import { ACCENT } from "./charts.js";

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
  durationMs,
  height = 120,
}: {
  energy: number[];
  beatTimes: number[];
  onsetTimes: number[];
  durationMs: number;
  height?: number;
}) {
  const W = 1000;
  const H = height;
  const durS = durationMs / 1000;
  const min = Math.min(...energy);
  const max = Math.max(...energy);
  const span = max - min || 1;
  const mid = H / 2;

  // Mirror the energy curve into a symmetric "waveform" silhouette.
  const top = energy.map((v, i) => {
    const x = (i / (energy.length - 1)) * W;
    const amp = ((v - min) / span) * (H / 2 - 2);
    return `${x.toFixed(1)},${(mid - amp).toFixed(1)}`;
  });
  const bottom = energy
    .map((v, i) => {
      const x = (i / (energy.length - 1)) * W;
      const amp = ((v - min) / span) * (H / 2 - 2);
      return `${x.toFixed(1)},${(mid + amp).toFixed(1)}`;
    })
    .reverse();
  const poly = [...top, ...bottom].join(" ");
  const xOf = (t: number) => (t / durS) * W;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {/* bar/beat grid (every 4th beat drawn to read as bars) */}
      {beatTimes.filter((_, i) => i % 4 === 0).map((t, i) => (
        <line key={i} x1={xOf(t)} x2={xOf(t)} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.08} vectorEffect="non-scaling-stroke" />
      ))}
      <polygon points={poly} fill={ACCENT} fillOpacity={0.75} />
      {/* onset markers along the centre line */}
      {onsetTimes.map((t, i) => (
        <circle key={i} cx={xOf(t)} cy={mid} r={1.1} fill="currentColor" opacity={0.35} />
      ))}
    </svg>
  );
}
