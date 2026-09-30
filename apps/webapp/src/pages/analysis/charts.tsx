/**
 * charts.tsx — dependency-free, dark-theme SVG chart primitives for the analysis
 * page. No external charting lib: everything is inline SVG so it stays fully
 * self-contained for the testing phase. All colors come from the app's CSS vars.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ScoredLabel, Series } from "./data.js";

export const ACCENT = "#EE4A26"; // --color-neon-orange

/* ------------------------------------------------------------ Spinner/loader */
export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-white/15"
      style={{ width: size, height: size, borderTopColor: ACCENT }}
    />
  );
}

/** A titled loading row: spinner + a title + optional subtitle. */
export function LoadingStep({
  title,
  subtitle,
  done = false,
  waiting = false,
}: {
  title: string;
  subtitle?: string;
  done?: boolean;
  waiting?: boolean;
}) {
  return (
    <div className={"flex items-center gap-[var(--px-14)] " + (waiting ? "opacity-40" : "")}>
      <span className="grid h-[var(--px-28)] w-[var(--px-28)] shrink-0 place-items-center">
        {done ? (
          <span className="grid h-[var(--px-22)] w-[var(--px-22)] place-items-center rounded-full" style={{ background: ACCENT }}>
            <svg viewBox="0 0 12 12" className="h-[var(--px-10)] w-[var(--px-10)]"><path d="M2 6 L5 9 L10 3" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        ) : waiting ? (
          <span className="h-[var(--px-10)] w-[var(--px-10)] rounded-full border border-white/30" />
        ) : (
          <Spinner size={22} />
        )}
      </span>
      <div className="min-w-0">
        <div className="font-helvetica text-[length:var(--px-12)] uppercase tracking-[var(--px-1)]">{title}</div>
        {subtitle && <div className="font-helvetica text-[length:var(--px-10)] opacity-50">{subtitle}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ time helpers */
export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Nearest sample value at a 0..1 fraction of a series. */
export function valueAt(values: number[], frac: number): number | null {
  if (!values.length) return null;
  const i = Math.min(values.length - 1, Math.max(0, Math.round(frac * (values.length - 1))));
  return values[i];
}

/** #rrggbb (or #rgb) -> rgba() string. */
export function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/* ---------------------------------------------------------------- TimeAxis */
/**
 * Wraps a full-track chart (rendered edge-to-edge: t=0 at the left, t=duration
 * at the right) and overlays a shared **playhead**, **click-to-seek**, and a
 * **hover guide + tooltip**. Every full-track graph shares one `currentMs`, so
 * the cursor moves identically across all of them as the track plays / seeks.
 */
export function TimeAxis({
  durationMs,
  currentMs = null,
  onSeek,
  tooltip,
  className = "",
  children,
}: {
  durationMs: number;
  currentMs?: number | null;
  onSeek?: (ms: number) => void;
  tooltip?: (frac: number) => ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const fracAt = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const playFrac = currentMs != null && durationMs > 0 ? Math.min(1, currentMs / durationMs) : null;
  const flip = hover != null && hover > 0.72;
  return (
    <div
      ref={ref}
      className={"relative " + (onSeek ? "cursor-crosshair " : "") + className}
      onClick={onSeek ? (e) => onSeek(fracAt(e.clientX) * durationMs) : undefined}
      onPointerMove={(e) => setHover(fracAt(e.clientX))}
      onPointerLeave={() => setHover(null)}
    >
      {children}
      {hover != null && (
        <>
          <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white/25" style={{ left: `${hover * 100}%` }} />
          {tooltip && (
            <div
              className="pointer-events-none absolute top-[var(--px-2)] z-20 rounded-[var(--px-4)] border border-[var(--opacity-20)] bg-black/85 px-[var(--px-6)] py-[var(--px-3)] font-helvetica text-[length:var(--px-9)] leading-tight"
              style={{ left: `${hover * 100}%`, transform: flip ? "translateX(-100%)" : "none", marginLeft: flip ? -6 : 6, maxWidth: 220 }}
            >
              <div className="opacity-45">{fmtClock(hover * durationMs)}</div>
              {tooltip(hover)}
            </div>
          )}
        </>
      )}
      {playFrac != null && (
        <div className="pointer-events-none absolute inset-y-0 z-10 w-[1.5px] bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]" style={{ left: `${playFrac * 100}%` }} />
      )}
    </div>
  );
}

/** Rows of label→value for a hover tooltip (used by multi-series graphs). */
export function TipRows({ rows }: { rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="mt-[2px] flex flex-col gap-[1px]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-[var(--px-12)]">
          <span className="lowercase" style={{ color: r.color }}>{r.label}</span>
          <span className="tabular-nums opacity-70">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ ToggleLegend */
/** Checkbox-style legend: click to show/hide a series; always keeps >= 1 on. */
export function ToggleLegend({
  items,
  hidden,
  onToggle,
}: {
  items: { label: string; color: string; suffix?: string }[];
  hidden: Set<string>;
  onToggle: (label: string) => void;
}) {
  return (
    <div className="mt-[var(--px-8)] flex flex-wrap gap-[var(--px-8)]">
      {items.map((it) => {
        const on = !hidden.has(it.label);
        return (
          <button
            key={it.label}
            type="button"
            onClick={() => onToggle(it.label)}
            className={
              "flex items-center gap-[var(--px-6)] rounded-full border px-[var(--px-10)] py-[var(--px-3)] font-helvetica text-[length:var(--px-10)] capitalize transition-all hover:brightness-125 " +
              (on ? "" : "opacity-45")
            }
            style={{ borderColor: on ? it.color : "var(--opacity-30)", background: on ? hexA(it.color, 0.14) : "transparent" }}
          >
            <span
              className="grid h-[var(--px-11)] w-[var(--px-11)] place-items-center rounded-[3px] border"
              style={{ borderColor: on ? it.color : "var(--opacity-40)", background: on ? it.color : "transparent" }}
            >
              {on && (
                <svg viewBox="0 0 10 10" className="h-[var(--px-8)] w-[var(--px-8)]">
                  <path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span>{it.suffix ? `${it.label} · ${it.suffix}` : it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Toggle a label in a hidden-set while guaranteeing at least one stays visible. */
export function useToggleSet(total: number) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else if (total - next.size > 1) next.add(label); // keep >= 1 visible
      return next;
    });
  return { hidden, toggle };
}

/* ------------------------------------------------------------------ Panel */
export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
  center = false,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <section
      className={
        "rounded-[var(--px-12)] border border-[var(--opacity-15)] bg-[var(--opacity-10)] " +
        "p-[var(--px-20)] " + className
      }
    >
      <header
        className={
          "mb-[var(--px-14)] flex gap-[var(--px-10)] " +
          (center ? "flex-col items-center text-center" : "items-baseline justify-between")
        }
      >
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
export function StatCard({
  label,
  value,
  unit,
  sub,
  hint,
}: {
  label: string;
  value: ReactNode;
  /**
   * The value's unit, set small and dim right after it — "124.0 BPM", "F min 4A", "-10.4 LUFS".
   * Kept out of `value` so the number stays the biggest thing in the card, which is what a reader
   * scanning five cards is actually looking for.
   */
  unit?: string;
  sub?: string;
  hint?: string;
}) {
  return (
    <div
      // `h-full`: the five cards share a grid row and must stay one height. A genre name that
      // wraps ("Progressive House") made its card a line taller than the other four.
      className="group relative h-full rounded-[var(--px-10)] border border-[var(--an-border)] bg-[var(--an-card)] p-[var(--px-14)] transition-colors hover:border-[var(--rx-color-border-strong)]"
    >
      <div className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] text-[var(--an-text-muted)]">
        {label}
      </div>
      <div className="mt-[var(--px-6)] flex items-baseline gap-[var(--px-6)]">
        <span className="font-helvetica text-[length:var(--px-26)] font-medium leading-none text-[var(--an-text)]">
          {value}
        </span>
        {unit && (
          <span className="font-fira text-[length:var(--px-11)] leading-none text-[var(--an-text-muted)]">{unit}</span>
        )}
      </div>
      {/* `tracking-normal` on purpose. The page wrapper sets 1px letter spacing that this line
          inherited, and at 11px mono that is enough to push "LRA 5.1 LU · peak -0.7 dBTP" onto a
          second line in a five-across row, making every card in the row a line taller. */}
      {sub && <div className="mt-[var(--px-8)] font-fira text-[length:var(--px-11)] tracking-normal text-[var(--an-text-muted)]">{sub}</div>}
      {hint && (
        <div className="pointer-events-none absolute left-[var(--px-8)] right-[var(--px-8)] top-full z-30 mt-[var(--px-4)] rounded-[var(--px-6)] border border-[var(--opacity-20)] bg-black/90 px-[var(--px-8)] py-[var(--px-6)] font-helvetica text-[length:var(--px-9)] font-light leading-snug opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {hint}
        </div>
      )}
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
// Edge-to-edge single-series line/area. Cursor + hover come from a wrapping
// <TimeAxis> so it stays in sync with every other full-track graph.
export function LineChart({
  series,
  height = 90,
  color = ACCENT,
  area = true,
}: {
  series: Series;
  height?: number;
  color?: string;
  area?: boolean;
}) {
  const W = 600;
  const H = height;
  const { line, area: areaPath } = useCurvePath(series.values, W, H, 0);
  const gid = useId();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaPath} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* --------------------------------------------------------- MultiLineChart */
// Edge-to-edge multi-series with a checkbox legend (show/hide lines, min 1) and
// a shared playhead + hover values via TimeAxis (over the chart, not the legend).
export function MultiLineChart({
  lines,
  height = 110,
  durationMs,
  currentMs = null,
  onSeek,
}: {
  lines: { label: string; series: Series; color: string; fmt?: (v: number) => string }[];
  height?: number;
  durationMs?: number;
  currentMs?: number | null;
  onSeek?: (ms: number) => void;
}) {
  const W = 600;
  const H = height;
  const { hidden, toggle } = useToggleSet(lines.length);
  const visible = lines.filter((l) => !hidden.has(l.label));
  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
      {visible.map((l) => {
        const vals = l.series.values;
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const span = max - min || 1;
        const d = vals
          .map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, vals.length - 1)) * W).toFixed(1)} ${((1 - (v - min) / span) * H).toFixed(1)}`)
          .join(" ");
        return <path key={l.label} d={d} fill="none" stroke={l.color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
  const tip = (frac: number) => (
    <TipRows
      rows={visible.map((l) => {
        const v = valueAt(l.series.values, frac);
        return { label: l.label, value: v == null ? "–" : l.fmt ? l.fmt(v) : v.toFixed(2), color: l.color };
      })}
    />
  );
  return (
    <div className="w-full">
      {durationMs ? (
        <TimeAxis durationMs={durationMs} currentMs={currentMs} onSeek={onSeek} tooltip={tip}>
          {svg}
        </TimeAxis>
      ) : (
        svg
      )}
      <ToggleLegend items={lines.map((l) => ({ label: l.label, color: l.color }))} hidden={hidden} onToggle={toggle} />
    </div>
  );
}

/* ----------------------------------------------------------------- BarList */
export function BarList({
  items,
  format = (v: number) => `${(v * 100).toFixed(0)}%`,
  labelTransform,
}: {
  items: ScoredLabel[];
  format?: (v: number) => string;
  labelTransform?: (label: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-[var(--px-8)]">
      {items.map((it) => {
        // Absolute 0–100 scale: a 70% value fills 70% of the track, the rest of
        // the (faint white) track shows the remainder — so bars are comparable.
        const pct = Math.max(2, Math.min(100, it.score * 100));
        const shown = labelTransform ? labelTransform(it.label) : it.label;
        return (
          <li key={it.label} className="group -mx-[var(--px-4)] rounded-[var(--px-6)] px-[var(--px-4)] py-[var(--px-2)] transition-colors hover:bg-white/5" title={`${shown} · ${format(it.score)}`}>
            <div className="mb-[var(--px-3)] flex items-baseline justify-between font-helvetica text-[length:var(--px-11)]">
              <span className="truncate pr-[var(--px-8)]">{shown}</span>
              <span className="shrink-0 opacity-50 tabular-nums group-hover:opacity-90">{format(it.score)}</span>
            </div>
            <div className="h-[var(--px-6)] w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full transition-[width,filter] duration-500 group-hover:brightness-125"
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
export function Gauge({ value, label, sub, hint }: { value: number; label: string; sub?: string; hint?: string }) {
  const R = 46;
  const C = Math.PI * R; // semicircle circumference
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="group relative flex flex-col items-center">
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
      <div className="mt-[var(--px-2)] w-full truncate text-center font-helvetica text-[length:var(--px-10)] uppercase opacity-70">
        {label}
      </div>
      {sub && <div className="font-helvetica text-[length:var(--px-9)] opacity-40">{sub}</div>}
      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-[var(--px-2)] w-max max-w-[var(--px-140)] -translate-x-1/2 rounded-[var(--px-6)] border border-[var(--opacity-20)] bg-black/90 px-[var(--px-8)] py-[var(--px-6)] text-center font-helvetica text-[length:var(--px-9)] font-light leading-snug opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {hint}
        </div>
      )}
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
  const [hover, setHover] = useState(false);

  const axisText = (x: number, y: number, t: string) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-current font-helvetica" fontSize="8" opacity={0.45}>
      {t}
    </text>
  );

  return (
    <div className="mx-auto w-full max-w-[var(--px-260)]">
      <svg
        viewBox={`0 0 ${S} ${S}`}
        className="w-full cursor-default"
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
      >
        <rect x={pad} y={pad} width={inner} height={inner} fill="var(--opacity-10)" stroke="currentColor" strokeOpacity={0.1} rx={6} />
        <line x1={S / 2} y1={pad} x2={S / 2} y2={S - pad} stroke="currentColor" strokeOpacity={0.12} />
        <line x1={pad} y1={S / 2} x2={S - pad} y2={S / 2} stroke="currentColor" strokeOpacity={0.12} />
        {axisText(S / 2, pad - 12, "energetic")}
        {axisText(S / 2, S - pad + 12, "calm")}
        {axisText(pad - 14, S / 2, "-ve")}
        {axisText(S - pad + 14, S / 2, "+ve")}
        <circle cx={cx} cy={cy} r={hover ? 14 : 11} fill={ACCENT} fillOpacity={0.25} style={{ transition: "r 0.15s" }} />
        <circle cx={cx} cy={cy} r={hover ? 6 : 5} fill={ACCENT} style={{ transition: "r 0.15s" }} />
      </svg>
      <div className="h-[var(--px-12)] text-center font-helvetica text-[length:var(--px-9)] tabular-nums opacity-70">
        {hover ? `valence ${(valence * 100).toFixed(0)}% · arousal ${(arousal * 100).toFixed(0)}%` : ""}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- TagChips */
export function TagChips({ items, singleLine = false }: { items: ScoredLabel[]; singleLine?: boolean }) {
  const max = Math.max(...items.map((i) => i.score), 0.0001);
  const ref = useRef<HTMLDivElement>(null);
  const sig = items.map((i) => i.label).join("|");

  // `singleLine`: show only the whole chips that fit on the FIRST row (desktop);
  // on mobile (< sm) show them all, wrapped. Two-pass — a "measuring" render
  // shows every chip so we can read each one's row (offsetTop); the count is set
  // in a layout effect (flushes before paint, so the multi-row pass never shows).
  const [measuring, setMeasuring] = useState(true);
  const [count, setCount] = useState(items.length);
  const lastSig = useRef(sig);
  if (singleLine && lastSig.current !== sig) {
    lastSig.current = sig;
    if (!measuring) setMeasuring(true); // re-measure when the tags change
  }

  useLayoutEffect(() => {
    if (!singleLine || !measuring) return;
    const el = ref.current;
    if (!el) return;
    if (window.innerWidth < 640) {
      setCount(items.length); // mobile: keep all, wrapped + centered
    } else {
      const kids = Array.from(el.children) as HTMLElement[];
      const firstTop = kids.length ? kids[0].offsetTop : 0;
      let n = 0;
      for (const k of kids) {
        if (k.offsetTop > firstTop) break; // wrapped to the next row -> drop it and the rest
        n += 1;
      }
      setCount(n);
    }
    setMeasuring(false);
  }, [measuring, singleLine, sig, items.length]);

  useEffect(() => {
    if (!singleLine) return;
    const onResize = () => setMeasuring(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [singleLine]);

  const visible = !singleLine || measuring ? items : items.slice(0, count);

  return (
    <div
      ref={ref}
      className={"flex flex-wrap gap-[var(--px-8)] " + (singleLine ? "justify-center" : "")}
    >
      {visible.map((it) => {
        const strength = it.score / max;
        return (
          <span
            key={it.label}
            title={`${it.label} · ${(it.score * 100).toFixed(0)}%`}
            className="shrink-0 cursor-default whitespace-nowrap rounded-full border px-[var(--px-10)] py-[var(--px-4)] font-helvetica text-[length:var(--px-11)] lowercase transition-all hover:!opacity-100 hover:brightness-125"
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
