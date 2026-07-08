/**
 * charts.tsx — dependency-free, dark-theme SVG chart primitives for the analysis
 * page. No external charting lib: everything is inline SVG so it stays fully
 * self-contained for the testing phase. All colors come from the app's CSS vars.
 */

import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ScoredLabel, Series } from "./data.js";

export const ACCENT = "#EE4A26"; // --color-neon-orange

/* ------------------------------------------------------------------ Panel */
export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        "rounded-[var(--px-12)] border border-[var(--opacity-15)] bg-[var(--opacity-10)] " +
        "p-[var(--px-20)] " + className
      }
    >
      <header className="mb-[var(--px-14)] flex items-baseline justify-between gap-[var(--px-10)]">
        <div>
          <h2 className="font-helvetica text-[length:var(--px-14)] font-medium uppercase tracking-[var(--px-1)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-[var(--px-2)] font-helvetica text-[length:var(--px-10)] font-light opacity-50">
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- StatCard */
export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-[var(--px-10)] border border-[var(--opacity-15)] bg-[var(--opacity-10)] p-[var(--px-14)]">
      <div className="font-helvetica text-[length:var(--px-9)] font-light uppercase tracking-[var(--px-1)] opacity-50">
        {label}
      </div>
      <div className="mt-[var(--px-4)] font-helvetica text-[length:var(--px-26)] font-medium leading-none">
        {value}
      </div>
      {sub && <div className="mt-[var(--px-3)] font-helvetica text-[length:var(--px-9)] opacity-40">{sub}</div>}
    </div>
  );
}

/* --------------------------------------------------- shared curve helpers */
function useCurvePath(values: number[], w: number, h: number, pad = 2) {
  return useMemo(() => {
    if (values.length === 0) return { line: "", area: "", min: 0, max: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const dx = (w - pad * 2) / Math.max(1, values.length - 1);
    const pts = values.map((v, i) => {
      const x = pad + i * dx;
      const y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
    return { line, area, min, max };
  }, [values, w, h, pad]);
}

/* -------------------------------------------------------------- LineChart */
export function LineChart({
  series,
  height = 90,
  color = ACCENT,
  area = true,
  format = (v: number) => v.toFixed(1),
}: {
  series: Series;
  height?: number;
  color?: string;
  area?: boolean;
  format?: (v: number) => string;
}) {
  const W = 600;
  const H = height;
  const { line, area: areaPath } = useCurvePath(series.values, W, H);
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);

  const idx = hover;
  const dx = (W - 4) / Math.max(1, series.values.length - 1);
  const hx = idx != null ? 2 + idx * dx : 0;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * (W - 4);
          setHover(Math.max(0, Math.min(series.values.length - 1, Math.round(rel / dx))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={areaPath} fill={`url(#${gid})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {idx != null && (
          <>
            <line x1={hx} y1={0} x2={hx} y2={H} stroke="currentColor" strokeOpacity={0.25} vectorEffect="non-scaling-stroke" />
            <circle cx={hx} cy={2 + (H - 4) * (1 - norm(series.values, idx))} r={3} fill={color} />
          </>
        )}
      </svg>
      {idx != null && (
        <div className="pointer-events-none absolute top-[var(--px-2)] right-[var(--px-4)] font-helvetica text-[length:var(--px-10)] opacity-80">
          {format(series.values[idx])}
          {series.unit ? ` ${series.unit}` : ""}
        </div>
      )}
    </div>
  );
}

function norm(values: number[], i: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (values[i] - min) / (max - min || 1);
}

/* --------------------------------------------------------- MultiLineChart */
export function MultiLineChart({
  lines,
  height = 110,
}: {
  lines: { label: string; series: Series; color: string }[];
  height?: number;
}) {
  const W = 600;
  const H = height;
  // Normalize each line to its own range so different units share the plot.
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {lines.map((l) => {
          const vals = l.series.values;
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const span = max - min || 1;
          const dx = (W - 4) / Math.max(1, vals.length - 1);
          const d = vals
            .map((v, i) => `${i ? "L" : "M"}${(2 + i * dx).toFixed(1)} ${(2 + (H - 4) * (1 - (v - min) / span)).toFixed(1)}`)
            .join(" ");
          return <path key={l.label} d={d} fill="none" stroke={l.color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="mt-[var(--px-8)] flex flex-wrap gap-[var(--px-12)]">
        {lines.map((l) => (
          <span key={l.label} className="flex items-center gap-[var(--px-5)] font-helvetica text-[length:var(--px-10)] opacity-70">
            <span className="inline-block h-[var(--px-8)] w-[var(--px-8)] rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- BarList */
export function BarList({
  items,
  max,
  format = (v: number) => `${(v * 100).toFixed(0)}%`,
  labelTransform,
}: {
  items: ScoredLabel[];
  max?: number;
  format?: (v: number) => string;
  labelTransform?: (label: string) => string;
}) {
  const top = max ? Math.max(...items.map((i) => i.score)) : Math.max(...items.map((i) => i.score), 0.0001);
  return (
    <ul className="flex flex-col gap-[var(--px-8)]">
      {items.map((it) => {
        const pct = Math.max(2, (it.score / top) * 100);
        return (
          <li key={it.label} className="group">
            <div className="mb-[var(--px-3)] flex items-baseline justify-between font-helvetica text-[length:var(--px-11)]">
              <span className="truncate pr-[var(--px-8)]">{labelTransform ? labelTransform(it.label) : it.label}</span>
              <span className="shrink-0 opacity-50 tabular-nums">{format(it.score)}</span>
            </div>
            <div className="h-[var(--px-6)] w-full overflow-hidden rounded-full bg-[var(--opacity-15)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: ACCENT }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ Gauge */
export function Gauge({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const R = 46;
  const C = Math.PI * R; // semicircle circumference
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-full max-w-[var(--px-140)]">
        <path d="M6 64 A54 54 0 0 1 114 64" fill="none" stroke="var(--opacity-20)" strokeWidth={8} strokeLinecap="round" />
        <path
          d="M6 64 A54 54 0 0 1 114 64"
          fill="none"
          stroke={ACCENT}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(clamped * C * 54) / R} ${C * 54}`}
        />
        <text x="60" y="58" textAnchor="middle" className="fill-current font-helvetica" fontSize="20" fontWeight={600}>
          {(clamped * 100).toFixed(0)}
        </text>
      </svg>
      <div className="mt-[var(--px-2)] text-center font-helvetica text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-70">
        {label}
      </div>
      {sub && <div className="font-helvetica text-[length:var(--px-9)] opacity-40">{sub}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- MoodMap */
export function MoodMap({ valence, arousal }: { valence: number; arousal: number }) {
  const S = 200;
  const pad = 26;
  const inner = S - 2 * pad;
  const cx = pad + Math.max(0, Math.min(1, valence)) * inner;
  const cy = pad + (1 - Math.max(0, Math.min(1, arousal))) * inner; // invert y

  const axisText = (x: number, y: number, t: string) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize="8" opacity={0.45}>
      {t}
    </text>
  );

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[var(--px-260)]">
      <rect x={pad} y={pad} width={inner} height={inner} fill="var(--opacity-10)" stroke="currentColor" strokeOpacity={0.1} rx={6} />
      <line x1={S / 2} y1={pad} x2={S / 2} y2={S - pad} stroke="currentColor" strokeOpacity={0.12} />
      <line x1={pad} y1={S / 2} x2={S - pad} y2={S / 2} stroke="currentColor" strokeOpacity={0.12} />
      {axisText(S / 2, pad - 12, "energetic")}
      {axisText(S / 2, S - pad + 12, "calm")}
      {axisText(pad - 14, S / 2, "neg")}
      {axisText(S - pad + 14, S / 2, "pos")}
      <circle cx={cx} cy={cy} r={11} fill={ACCENT} fillOpacity={0.25} />
      <circle cx={cx} cy={cy} r={5} fill={ACCENT} />
    </svg>
  );
}

/* -------------------------------------------------------------- TagChips */
export function TagChips({ items }: { items: ScoredLabel[] }) {
  const max = Math.max(...items.map((i) => i.score), 0.0001);
  return (
    <div className="flex flex-wrap gap-[var(--px-8)]">
      {items.map((it) => {
        const strength = it.score / max;
        return (
          <span
            key={it.label}
            className="rounded-full border px-[var(--px-10)] py-[var(--px-4)] font-helvetica text-[length:var(--px-11)] lowercase"
            style={{
              borderColor: ACCENT,
              background: `rgba(238,74,38,${(0.08 + strength * 0.32).toFixed(2)})`,
              opacity: 0.55 + strength * 0.45,
            }}
          >
            {it.label}
          </span>
        );
      })}
    </div>
  );
}
