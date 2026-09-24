import React from "react";
import { shortGenre } from "@resomix/hooks";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { fmtClock } from "@/pages/analysis/charts.tsx";
import {
  CamelotWheel,
  ChromaView,
  Donut,
  RibbonChart,
  SpectrogramView,
  StemArea,
  STEM_COLORS,
  keyFromCamelot,
  chromaLabelsForKey,
} from "@/pages/analysis/heatviz.tsx";
import { StructureStrip } from "../StructureStrip.tsx";
import { EnergyLane } from "../timeline/EnergyLane.tsx";
import {
  camelotNeighbours,
  camelotRootPitchClass,
  inKeyPitchClasses,
  meanChromaFromMatrix,
} from "@/utils/analysisTimeline.ts";
import { CONTENT_W, FOOTER_H, PAGE_BG, PAGE_H, PAGE_W, SIDE_MARGIN, TOP_PADDING } from "./exportTheme.ts";

/**
 * The printed document.
 *
 * This is a second, separate rendering of the analysis, not a print stylesheet over the first. The
 * tabs on screen are responsive, interactive and paged by a reader who can scroll; a sheet of A4
 * is none of those things, and the layout that is right for one is wrong for the other. Keeping
 * them apart also means the export cannot change what the page does — the only thing shared is the
 * chart components themselves, which draw the data and are used here exactly as they are used
 * there.
 *
 * Every size is a literal pixel rather than a `--px-*` token, because the token scale is tied to
 * the viewport and this is a fixed sheet. The two scripts, the colours and the chart internals are
 * the page's own.
 */

/* ------------------------------------------------------------------ colours */

const INK = "var(--an-text)";
const INK_STRONG = "var(--an-text-strong)";
const INK_SOFT = "var(--an-text-secondary)";
const INK_MUTED = "var(--an-text-muted)";
const INK_FAINT = "var(--an-text-faint)";
const LINE = "var(--an-border)";
const CARD = "var(--an-card)";
const LANE_BG = "var(--an-lane)";
const ACCENT = "var(--an-accent)";

/** Lane geometry for the printed timeline: label gutter, chart, right axis. */
const GUTTER = 92;
const AXIS = 34;
const LANE_GAP = 10;

/** Lane heights on paper. Between the page's compact and full-height settings. */
const H = { ruler: 15, structure: 56, energy: 100, spectrum: 122, pitch: 78, row: 16, stems: 92 };

/* -------------------------------------------------------------- track facts */

export interface TrackFacts {
  title: string;
  artist: string | null;
  file: string;
}

/**
 * Artist and title out of the filename.
 *
 * The analysis result carries the uploaded filename and nothing else, so this reads the one
 * convention the files actually follow ("Artist - Title (Mix).mp3", sometimes behind a track
 * number) and prints only what it can honestly claim: no separator means no artist, and the whole
 * name becomes the title.
 */
// Fast refresh never applies here: this tree is mounted for a second inside an export and thrown
// away, so the rule's split would only scatter the document across files for no gain.
// eslint-disable-next-line react-refresh/only-export-components
export function trackFacts(filename: string): TrackFacts {
  const file = filename || "Untitled";
  const noExt = file.replace(/\.(mp3|wav|flac|aiff?|m4a|ogg|mpe?g)$/i, "");
  const noIndex = noExt.replace(/^\s*\d{1,3}\s*[.\-_)]\s+/, "");
  const split = noIndex.split(/\s+-\s+/);
  if (split.length >= 2) {
    const artist = split[0].trim();
    const title = split.slice(1).join(" - ").trim();
    if (artist && title) return { title, artist, file };
  }
  return { title: noIndex.trim() || file, artist: null, file };
}

const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtBpm = (b: number) => (Number.isInteger(b) ? String(b) : b.toFixed(1));

/* ------------------------------------------------------------ small pieces */

const SectionHead: React.FC<{ index: string; title: string; sub?: string }> = ({ index, title, sub }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
    <span className="font-fira" style={{ fontSize: 10, letterSpacing: "0.12em", color: ACCENT }}>
      {index}
    </span>
    <h2 className="font-helvetica" style={{ margin: 0, fontSize: 15, fontWeight: 500, color: INK, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {title}
    </h2>
    {sub ? (
      <span className="font-fira" style={{ marginLeft: "auto", fontSize: 9.5, color: INK_MUTED }}>
        {sub}
      </span>
    ) : null}
  </div>
);

const Card: React.FC<{ children: React.ReactNode; pad?: number; style?: React.CSSProperties }> = ({ children, pad = 12, style }) => (
  <div style={{ border: `1px solid ${LINE}`, background: CARD, borderRadius: 6, padding: pad, ...style }}>{children}</div>
);

const Stat: React.FC<{ label: string; value: string; unit?: string; sub?: string }> = ({ label, value, unit, sub }) => (
  <Card pad={10}>
    <div className="font-fira" style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.14em", color: INK_MUTED }}>
      {label}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
      <span className="font-helvetica" style={{ fontSize: 20, fontWeight: 500, lineHeight: 1, color: INK }}>
        {value}
      </span>
      {unit ? (
        <span className="font-fira" style={{ fontSize: 9, color: INK_SOFT }}>
          {unit}
        </span>
      ) : null}
    </div>
    {sub ? (
      <div className="font-fira" style={{ fontSize: 8.5, color: INK_MUTED, marginTop: 6 }}>
        {sub}
      </div>
    ) : null}
  </Card>
);

const FactRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: "flex", gap: 12, borderBottom: `1px solid var(--an-rule)`, padding: "6px 0" }}>
    <span className="font-fira" style={{ width: 92, flex: "0 0 auto", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: INK_MUTED }}>
      {label}
    </span>
    <span className="font-helvetica" style={{ minWidth: 0, flex: 1, fontSize: 11.5, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {value}
    </span>
  </div>
);

/** One row of the printed timeline: gutter label, chart, right axis. */
const Lane: React.FC<{
  title: string;
  meta?: string;
  axis?: React.ReactNode[];
  aside?: React.ReactNode;
  gutterExtra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, meta, axis, aside, gutterExtra, children }) => (
  <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px minmax(0,1fr) ${AXIS}px`, columnGap: LANE_GAP }}>
    <div style={{ paddingTop: 2 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span className="font-fira" style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: INK_STRONG }}>
          {title}
        </span>
        {aside}
      </div>
      {meta ? (
        <div className="font-fira" style={{ fontSize: 8.5, color: INK_MUTED, marginTop: 3 }}>
          {meta}
        </div>
      ) : null}
      {gutterExtra ? <div style={{ marginTop: 5 }}>{gutterExtra}</div> : null}
    </div>
    <div style={{ minWidth: 0 }}>{children}</div>
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 1, paddingBottom: 1 }}>
      {(axis ?? []).map((t, i) => (
        <span key={i} className="font-fira" style={{ fontSize: 8, lineHeight: 1, color: INK_MUTED }}>
          {t}
        </span>
      ))}
    </div>
  </div>
);

/** The shared ruler, printed above and below the lanes exactly as the tab does. */
const Ruler: React.FC<{ durationMs: number; flip?: boolean }> = ({ durationMs, flip = false }) => {
  const step = 60_000;
  const ticks: number[] = [];
  for (let t = step; t < durationMs; t += step) if (t / durationMs < 0.94) ticks.push(t);
  return (
    <div style={{ position: "relative", width: "100%", height: H.ruler }}>
      <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "var(--an-grid)", ...(flip ? { top: 0 } : { bottom: 0 }) }} />
      {ticks.map((t) => (
        <span
          key={t}
          className="font-fira"
          style={{ position: "absolute", left: `${(t / durationMs) * 100}%`, transform: "translateX(-50%)", fontSize: 8, lineHeight: 1, color: INK_MUTED, ...(flip ? { bottom: 2 } : { top: 2 }) }}
        >
          {fmtClock(t)}
        </span>
      ))}
      <span className="font-fira" style={{ position: "absolute", right: 0, fontSize: 8, lineHeight: 1, color: INK_MUTED, ...(flip ? { bottom: 2 } : { top: 2 }) }}>
        {fmtClock(durationMs)}
      </span>
    </div>
  );
};

/* ----------------------------------------------------------------- blocks */

export interface ExportBlock {
  id: string;
  node: React.ReactNode;
  /** Start a new page before this block. */
  breakBefore?: boolean;
}

export interface ExportMeta {
  facts: TrackFacts;
  exportedOn: string;
  landingUrl: string;
  betaUrl: string;
}

/**
 * The document, block by block, in reading order.
 *
 * A block is the unit the paginator will not cut through, which is why a heading and the thing it
 * heads are one block rather than two.
 */
// eslint-disable-next-line react-refresh/only-export-components -- see trackFacts above
export function buildExportBlocks(data: AnalysisData, meta: ExportMeta): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  const { facts } = meta;

  /* ------------------------------------------------------------- cover */
  blocks.push({
    id: "cover",
    node: (
      <div>
        <div className="font-fira" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.22em", color: ACCENT }}>
          Resomix · Track Intelligence
        </div>
        <h1
          className="font-helvetica"
          style={{ margin: "14px 0 0", fontSize: 34, lineHeight: 1.12, fontWeight: 500, color: INK, textTransform: "uppercase", letterSpacing: "0.01em" }}
        >
          {facts.title}
        </h1>
        {facts.artist ? (
          <div className="font-helvetica" style={{ marginTop: 8, fontSize: 15, fontWeight: 300, color: INK_SOFT }}>
            {facts.artist}
          </div>
        ) : null}

        <div style={{ height: 1, background: LINE, margin: "22px 0 18px" }} />

        <p className="font-helvetica" style={{ margin: 0, fontSize: 12, lineHeight: 1.75, fontWeight: 300, color: INK_SOFT, maxWidth: 560 }}>
          This is a track analysis exported from Resomix, a music similarity search and audio analysis platform for
          electronic music. Drop one track and it reveals the track's identity, its closest sonic relatives and its
          place within a music catalogue.
        </p>
        <p className="font-helvetica" style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.75, fontWeight: 300, color: INK_SOFT, maxWidth: 560 }}>
          Everything on the pages that follow was measured or predicted from the audio itself. The live reading of this
          track, with playback and the full catalogue around it, is at{" "}
          <a data-pdf-link href={meta.betaUrl} style={{ color: ACCENT, textDecoration: "none", borderBottom: `1px solid ${ACCENT}` }}>
            beta.resomix.com
          </a>
          . More about the platform is at{" "}
          <a data-pdf-link href={meta.landingUrl} style={{ color: ACCENT, textDecoration: "none", borderBottom: `1px solid ${ACCENT}` }}>
            resomix.com
          </a>
          .
        </p>

        <div style={{ display: "flex", gap: 26, marginTop: 24 }}>
          {[
            ["01", "Timeline", "structure · energy · spectrum · pitch · style · mood · stems"],
            ["02", "Harmony", "key · mix-compatible keys · note energy"],
            ["03", "Vibe", "valence · arousal · perceptual profile · mood"],
            ["04", "Genre & Sonic Style", "two ranked readings"],
          ].map(([n, name, what]) => (
            <div key={n} style={{ flex: 1, minWidth: 0 }}>
              <div className="font-fira" style={{ fontSize: 9, color: ACCENT }}>
                {n}
              </div>
              <div className="font-helvetica" style={{ fontSize: 11.5, color: INK, marginTop: 4 }}>
                {name}
              </div>
              <div className="font-fira" style={{ fontSize: 8, lineHeight: 1.5, color: INK_FAINT, marginTop: 4 }}>
                {what}
              </div>
            </div>
          ))}
        </div>

        <div className="font-fira" style={{ marginTop: 22, fontSize: 9, color: INK_FAINT }}>
          Exported {meta.exportedOn}
        </div>
      </div>
    ),
  });

  /* -------------------------------------------------------- track facts */
  const bitrate = data.identity.bitRate ? `${Math.round(data.identity.bitRate / 1000)} kbps` : "—";
  blocks.push({
    id: "facts",
    node: (
      <div>
        <SectionHead index="—" title="The track" />
        <div style={{ marginTop: 10 }}>
          <FactRow label="Title" value={facts.title} />
          <FactRow label="Artist" value={facts.artist ?? "not in the filename"} />
          <FactRow label="File" value={facts.file} />
          <FactRow label="Length" value={`${fmtDuration(data.identity.durationMs)} (${fmtClock(data.identity.durationMs)})`} />
          <FactRow
            label="Format"
            value={`${(data.identity.codec || "audio").toUpperCase()} · ${bitrate} · ${data.identity.channels === 2 ? "stereo" : "mono"} · ${
              data.identity.sampleRateHz ? `${data.identity.sampleRateHz / 1000} kHz` : "—"
            }`}
          />
          <FactRow label="Analysed" value={meta.exportedOn} />
        </div>
      </div>
    ),
  });

  /* -------------------------------------------------------------- stats */
  const keyLabel = keyFromCamelot(data.tonality.camelot);
  const topGenre = data.semantics.styleMaestTop?.length ? data.semantics.styleMaestTop : data.semantics.genreTop ?? [];
  const sections = data.energy.structureSegments.filter((s) => !s.hidden).length;
  const bars = data.energy.structureSegments.reduce((sum, s) => sum + (s.bars ?? 0), 0);
  blocks.push({
    id: "stats",
    node: (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10 }}>
        <Stat
          label="Tempo"
          value={data.rhythm.bpm == null ? "—" : fmtBpm(data.rhythm.bpm)}
          unit={data.rhythm.bpm == null ? undefined : "BPM"}
          sub={`${data.rhythm.beatCount} beats`}
        />
        <Stat
          label="Key"
          value={keyLabel ? `${keyLabel.name} ${keyLabel.scale === "major" ? "maj" : "min"}` : "—"}
          unit={data.tonality.camelot ?? undefined}
          sub={`${(data.tonality.strength * 100).toFixed(0)}% strength`}
        />
        <Stat
          label="Loudness"
          value={data.technical.integratedLufs.toFixed(1)}
          unit="LUFS"
          sub={`LRA ${data.technical.loudnessRangeLu.toFixed(1)} LU · peak ${data.technical.truePeakDbtp.toFixed(1)} dB`}
        />
        <Stat
          label="Length"
          value={fmtDuration(data.identity.durationMs)}
          sub={sections ? `${bars ? `${bars} bars · ` : ""}${sections} section${sections === 1 ? "" : "s"}` : "—"}
        />
        <Stat
          label="Genre"
          value={topGenre.length ? shortGenre(topGenre[0].label) : "—"}
          unit={topGenre.length ? `${(topGenre[0].score * 100).toFixed(0)}%` : undefined}
          sub={topGenre[1] ? `${shortGenre(topGenre[1].label)} ${(topGenre[1].score * 100).toFixed(0)}%` : "top match"}
        />
      </div>
    ),
  });

  /* ----------------------------------------------------------- timeline */
  blocks.push({ id: "timeline", breakBefore: true, node: <TimelineSheet data={data} /> });

  /* ------------------------------------------------------------ harmony */
  const neighbours = camelotNeighbours(data.tonality.camelot);
  const altLabel = keyFromCamelot(data.tonality.altCamelot);
  blocks.push({
    id: "harmony-key",
    node: (
      <div>
        <SectionHead index="02" title="Harmony" sub={data.tonality.camelot ?? undefined} />
        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", gap: 26, marginTop: 16, alignItems: "start" }}>
          <div>
            <CamelotWheel camelot={data.tonality.camelot ?? ""} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <KeyCard label="Key" value={keyLabel ? `${keyLabel.name} ${keyLabel.scale}` : "—"} sub={data.tonality.camelot ? `${data.tonality.camelot} Camelot · ${(data.tonality.strength * 100).toFixed(0)}% strength` : "not read"} />
            <KeyCard label="Alternative" value={altLabel ? `${altLabel.name} ${altLabel.scale}` : "—"} sub={data.tonality.altCamelot ? `${data.tonality.altCamelot} Camelot · second candidate` : "no second candidate"} />
            {data.tonality.ambiguous ? (
              <div className="font-fira" style={{ fontSize: 10, background: "var(--an-flag-bg)", color: "var(--an-flag-fg)", borderRadius: 4, padding: "8px 12px" }}>
                Key may be ambiguous
                {altLabel ? `, possibly ${altLabel.name} ${altLabel.scale} (${data.tonality.altCamelot})` : ""}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
  });

  if (neighbours.length > 0) {
    blocks.push({
      id: "harmony-mix",
      node: (
        <div>
          <MinorHead>Mix-compatible keys</MinorHead>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginTop: 10 }}>
            {neighbours.map((n) => {
              const label = keyFromCamelot(n.code);
              return (
                <Card key={n.relation} pad={11} style={{ background: LANE_BG }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                    <span className="font-helvetica" style={{ fontSize: 16, fontWeight: 600, color: INK }}>
                      {n.code}
                    </span>
                    <span className="font-fira" style={{ fontSize: 9.5, color: INK_SOFT }}>
                      {label ? `${label.name} ${label.scale}` : "—"}
                    </span>
                  </div>
                  <div className="font-fira" style={{ fontSize: 8.5, color: INK_MUTED, marginTop: 5 }}>
                    {n.relation}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ),
    });
  }

  const chroma =
    data.tonality.meanChroma?.length === 12 ? data.tonality.meanChroma : meanChromaFromMatrix(data.tonality.chromagram?.data);
  if (chroma.length === 12) {
    const noteNames = chromaLabelsForKey(data.tonality.camelot);
    const inKey = inKeyPitchClasses(data.tonality.camelot);
    const tonicIndex = camelotRootPitchClass(data.tonality.camelot) ?? -1;
    const chromaMax = chroma.reduce((m, v) => (v > m ? v : m), 0) || 1;
    blocks.push({
      id: "harmony-notes",
      node: (
        <div>
          <MinorHead aside="whole track · in-key notes lit, others dimmed">Note energy</MinorHead>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 10 }}>
            {noteNames.map((note, i) => {
              const isTonic = i === tonicIndex;
              const opacity = !inKey.size ? 0.7 : isTonic ? 1 : inKey.has(i) ? 0.55 : 0.15;
              return (
                <div key={note + i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ position: "relative", height: 96, width: "100%" }}>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "100%",
                        height: `${Math.max(2, (chroma[i] / chromaMax) * 100)}%`,
                        background: "var(--an-pitch)",
                        borderRadius: "2px 2px 0 0",
                        opacity,
                      }}
                    />
                  </div>
                  <span
                    className="font-fira"
                    style={{
                      fontSize: 9,
                      fontWeight: isTonic ? 600 : 400,
                      color: isTonic ? "var(--an-pitch)" : inKey.has(i) || !inKey.size ? INK_SOFT : INK_FAINT,
                    }}
                  >
                    {note}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ),
    });
  }

  /* --------------------------------------------------------------- vibe */
  blocks.push({ id: "vibe", node: <VibeSheet data={data} /> });

  const moodTags = [...(data.semantics.moodThemeTop ?? [])].sort((a, b) => b.score - a.score);
  if (moodTags.length) {
    blocks.push({
      id: "vibe-moods",
      node: (
        <div>
          <MinorHead aside="above 50% highlighted">Mood tags</MinorHead>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 }}>
            {moodTags.slice(0, 6).map((t) => {
              const hot = t.score >= 0.5;
              return (
                <span
                  key={t.label}
                  className="font-helvetica"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 4,
                    fontSize: 12 + Math.round(Math.min(1, Math.max(0, t.score)) * 4),
                    padding: hot ? "8px 15px" : "5px 11px",
                    background: hot ? "var(--an-tag-hot-bg)" : "var(--an-tag-bg)",
                    color: hot ? "var(--an-tag-hot-fg)" : "var(--an-tag-fg)",
                    boxShadow: `inset 0 0 0 1px ${hot ? "color-mix(in srgb, var(--an-tag-hot-fg) 33%, transparent)" : "var(--an-tag-edge)"}`,
                    textTransform: "lowercase",
                  }}
                >
                  {t.label}
                  <span className="font-fira" style={{ fontSize: 9, opacity: 0.65 }}>
                    {Math.round(t.score * 100)}%
                  </span>
                </span>
              );
            })}
          </div>
          {moodTags.length > 6 ? (
            <div className="font-fira" style={{ fontSize: 8.5, color: INK_FAINT, marginTop: 8 }}>
              hidden: {moodTags.slice(6).map((t) => `${t.label} ${Math.round(t.score * 100)}`).join(" · ")}
            </div>
          ) : null}
        </div>
      ),
    });
  }

  /* -------------------------------------------------------------- genre */
  blocks.push({ id: "genre", node: <GenreSheet data={data} /> });

  /* ------------------------------------------------------------ closing */
  blocks.push({
    id: "closing",
    node: (
      <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
        <p className="font-helvetica" style={{ margin: 0, fontSize: 10.5, lineHeight: 1.7, fontWeight: 300, color: INK_MUTED, maxWidth: 560 }}>
          Tempo, key and loudness are measured from the audio. Genre, mood, style and instruments are predicted, and
          read best as a ranking rather than a single answer. Structure is read from the beat grid, so a track with no
          steady pulse is described in looser words than one with a clear one.
        </p>
      </div>
    ),
  });

  return blocks;
}

const MinorHead: React.FC<{ children: React.ReactNode; aside?: string }> = ({ children, aside }) => (
  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
    <h3 className="font-fira" style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.16em", color: INK_STRONG }}>
      {children}
    </h3>
    {aside ? (
      <span className="font-fira" style={{ fontSize: 8.5, color: INK_MUTED }}>
        {aside}
      </span>
    ) : null}
  </div>
);

const KeyCard: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <Card pad={12}>
    <div className="font-fira" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.16em", color: INK_MUTED }}>
      {label}
    </div>
    <div className="font-helvetica" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, color: INK, marginTop: 6 }}>
      {value}
    </div>
    <div className="font-fira" style={{ fontSize: 9.5, color: INK_MUTED, marginTop: 7 }}>
      {sub}
    </div>
  </Card>
);

/* --------------------------------------------------------------- sheets */

const fmtHz = (hz: number) => (hz >= 1000 ? `${Math.round(hz / 1000)}k` : `${Math.round(hz)}`);

/** The whole Timeline tab as one printed block, on one ruler. */
const TimelineSheet: React.FC<{ data: AnalysisData }> = ({ data }) => {
  const durationMs = data.identity.durationMs;
  const segments = data.energy.structureSegments;
  const shown = segments.filter((s) => !s.hidden).length;
  const bars = segments.reduce((sum, s) => sum + (s.bars ?? 0), 0);
  const nyquist = data.identity.sampleRateHz > 0 ? data.identity.sampleRateHz / 2 : 22050;
  const spectrogram = data.spectral.linearSpectrogram ?? data.spectral.melSpectrogram;
  const tonic = data.tonality.key ? data.tonality.key.replace(/\s.*$/, "") : null;
  const stems = data.composition.stems;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionHead
        index="01"
        title="Timeline"
        sub={[shown ? `${shown} sections` : "", bars ? `${bars} bars` : "", data.rhythm.bpm != null ? `${fmtBpm(data.rhythm.bpm)} BPM` : ""]
          .filter(Boolean)
          .join(" · ")}
      />
      {data.structure?.summary ? (
        <p className="font-helvetica" style={{ margin: 0, fontSize: 10.5, lineHeight: 1.6, fontWeight: 300, color: INK_SOFT }}>
          {data.structure.summary}
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px minmax(0,1fr) ${AXIS}px`, columnGap: LANE_GAP }}>
          <span />
          <Ruler durationMs={durationMs} />
          <span />
        </div>

        {segments.length > 0 ? (
          <Lane title="Structure" meta={shown ? `${shown} sections` : undefined}>
            <StructureStrip segments={segments} durationMs={durationMs} currentMs={null} height={H.structure} showEnds={false} />
          </Lane>
        ) : null}

        <Lane title="Energy" meta="RMS per bar" axis={["−6", "−10", "−14 dB"]}>
          <EnergyLane data={data} durationMs={durationMs} height={H.energy} />
        </Lane>

        <Lane title="Spectrum" meta="Hz, linear" axis={[1, 0.75, 0.5, 0.25, 0].map((f) => fmtHz(nyquist * f))}>
          <SpectrogramView
            matrix={spectrogram}
            sampleRateHz={data.identity.sampleRateHz}
            durationMs={durationMs}
            currentMs={null}
            height={H.spectrum}
            linear={!!data.spectral.linearSpectrogram}
            chrome={false}
          />
        </Lane>

        <Lane title="Pitch" meta={tonic ? `chromagram · tonic ${tonic}` : "chromagram"} axis={["B", tonic ?? "—", "C"]}>
          <ChromaView
            matrix={data.tonality.chromagram}
            durationMs={durationMs}
            currentMs={null}
            height={H.pitch}
            tint={[79, 209, 224]}
            showLabels={false}
          />
        </Lane>

        {data.timeline.genreOverTime.series.length > 0 && (
          <Lane title="Sonic style" meta="over time">
            <RibbonChart track={data.timeline.genreOverTime} rowHeight={H.row} labelTransform={shortGenre} />
          </Lane>
        )}
        {data.timeline.moodOverTime.series.length > 0 && (
          <Lane title="Mood" meta="over time">
            <RibbonChart track={data.timeline.moodOverTime} rowHeight={H.row} />
          </Lane>
        )}
        {data.timeline.instrumentOverTime.series.length > 0 && (
          <Lane title="Instruments" meta="over time">
            <RibbonChart track={data.timeline.instrumentOverTime} rowHeight={H.row} />
          </Lane>
        )}

        {Object.keys(stems).length > 0 && (
          <Lane
            title="Stems"
            aside={
              <span style={{ display: "block", width: 30 }}>
                <Donut stems={stems} />
              </span>
            }
            gutterExtra={
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {Object.keys(stems).map((name) => {
                  const color = STEM_COLORS[name] ?? "#888";
                  return (
                    <span
                      key={name}
                      className="font-fira"
                      style={{
                        display: "block",
                        borderRadius: 3,
                        border: `1px solid ${color}`,
                        background: `${color}24`,
                        color,
                        fontSize: 8,
                        padding: "1px 5px",
                        textTransform: "capitalize",
                      }}
                    >
                      {name} ({stems[name].presencePct.toFixed(0)}%)
                    </span>
                  );
                })}
              </div>
            }
          >
            <StemArea
              stems={stems}
              height={H.stems}
              durationMs={durationMs}
              currentMs={null}
              vocalRegions={data.composition.vocalRegions}
              showLegend={false}
            />
          </Lane>
        )}

        <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px minmax(0,1fr) ${AXIS}px`, columnGap: LANE_GAP }}>
          <span />
          <Ruler durationMs={durationMs} flip />
          <span />
        </div>
      </div>
    </div>
  );
};

const METERS: { label: string; pick: (s: AnalysisData["semantics"]) => number; color: string }[] = [
  { label: "Danceable", pick: (s) => s.danceability, color: "var(--an-meter-danceable)" },
  { label: "Electronic", pick: (s) => s.moodElectronic, color: "var(--an-meter-electronic)" },
  { label: "Vocal", pick: (s) => s.voiceScore, color: "var(--an-meter-vocal)" },
  { label: "Approachable", pick: (s) => s.approachability, color: "var(--an-meter-approachable)" },
  { label: "Bright", pick: (s) => s.timbreBright, color: "var(--an-meter-bright)" },
  { label: "Acoustic", pick: (s) => s.moodAcoustic, color: "var(--an-meter-acoustic)" },
];

const VibeSheet: React.FC<{ data: AnalysisData }> = ({ data }) => {
  const s = data.semantics;
  const x = (s.valence + 1) / 2;
  const y = (s.arousal + 1) / 2;
  return (
    <div>
      <SectionHead
        index="03"
        title="Vibe"
        sub={`${s.valence >= 0 ? "+" : ""}${s.valence.toFixed(2)} valence · ${s.arousal >= 0 ? "+" : ""}${s.arousal.toFixed(2)} arousal`}
      />
      <div style={{ display: "grid", gridTemplateColumns: "270px minmax(0,1fr)", gap: 26, marginTop: 16, alignItems: "start" }}>
        <div>
          <div style={{ position: "relative", width: 270, height: 270, borderRadius: 8, border: `1px solid ${LINE}`, background: LANE_BG }}>
            <span style={{ position: "absolute", left: 12, right: 12, top: "50%", height: 1, background: "var(--an-grid)" }} />
            <span style={{ position: "absolute", top: 12, bottom: 12, left: "50%", width: 1, background: "var(--an-grid)" }} />
            <AxisWord style={{ left: "50%", top: 9, transform: "translateX(-50%)" }}>energetic</AxisWord>
            <AxisWord style={{ left: "50%", bottom: 9, transform: "translateX(-50%)" }}>calm</AxisWord>
            <AxisWord style={{ left: 9, top: "50%", transform: "translateY(-50%)" }}>dark</AxisWord>
            <AxisWord style={{ right: 9, top: "50%", transform: "translateY(-50%)" }}>bright</AxisWord>
            <span
              style={{
                position: "absolute",
                left: `${x * 100}%`,
                bottom: `${y * 100}%`,
                width: 12,
                height: 12,
                marginLeft: -6,
                marginBottom: -6,
                borderRadius: "50%",
                background: ACCENT,
                boxShadow: "0 0 0 6px color-mix(in srgb, var(--an-accent) 13%, transparent)",
              }}
            />
          </div>
        </div>
        <div>
          <MinorHead>Perceptual profile</MinorHead>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", columnGap: 22, marginTop: 6 }}>
            {METERS.map((m) => {
              const v = Math.max(0, Math.min(1, m.pick(s)));
              return (
                <div
                  key={m.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "92px minmax(0,1fr) 30px",
                    alignItems: "center",
                    gap: 9,
                    borderBottom: `1px solid var(--an-rule)`,
                    padding: "9px 0",
                  }}
                >
                  <span className="font-helvetica" style={{ fontSize: 11, color: INK_SOFT }}>
                    {m.label}
                  </span>
                  <span style={{ display: "block", height: 5, width: "100%", borderRadius: 3, background: LINE, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${v * 100}%`, borderRadius: 3, background: m.color }} />
                  </span>
                  <span className="font-fira" style={{ fontSize: 11, textAlign: "right", color: INK }}>
                    {Math.round(v * 100)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const AxisWord: React.FC<{ children: React.ReactNode; style: React.CSSProperties }> = ({ children, style }) => (
  <span
    className="font-fira"
    style={{ position: "absolute", fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.08em", color: INK_SOFT, ...style }}
  >
    {children}
  </span>
);

const TOP_N = 7;

const GenreSheet: React.FC<{ data: AnalysisData }> = ({ data }) => {
  const genre = (data.semantics.styleMaestTop ?? []).slice(0, TOP_N);
  const style = (data.semantics.genreTop ?? []).slice(0, TOP_N);
  return (
    <div>
      <SectionHead index="04" title="Genre & Sonic Style" sub={`top ${TOP_N} of each`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 20, marginTop: 16 }}>
        <RankedList title="Genre" items={genre} />
        <RankedList title="Sonic style" items={style} />
      </div>
      <p className="font-helvetica" style={{ margin: "16px 0 0", fontSize: 10.5, fontWeight: 300, color: INK_SOFT }}>
        Two readings of the same track. Where they agree, the label is safe to file under.
      </p>
    </div>
  );
};

/**
 * The genre bars, redrawn rather than reused.
 *
 * `BarList` is the page's component and it hovers, transitions and truncates to a column width
 * that does not exist here. On paper the label can have the room it needs and the bar can be flat.
 */
const RankedList: React.FC<{ title: string; items: { label: string; score: number }[] }> = ({ title, items }) => (
  <Card pad={14}>
    <div className="font-fira" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.16em", color: INK_STRONG }}>
      {title}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
      {items.length === 0 ? (
        <span className="font-helvetica" style={{ fontSize: 11, color: INK_MUTED }}>
          not available for this track
        </span>
      ) : (
        items.map((it) => (
          <div key={it.label}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span className="font-helvetica" style={{ fontSize: 11, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {shortGenre(it.label)}
              </span>
              <span className="font-fira" style={{ fontSize: 10, color: INK_SOFT }}>
                {(it.score * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 5, width: "100%", borderRadius: 3, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, it.score * 100))}%`, borderRadius: 3, background: ACCENT }} />
            </div>
          </div>
        ))
      )}
    </div>
  </Card>
);
/* ------------------------------------------------------------ page frame */

/**
 * One A4 sheet: the dotted side lines the site frames every page with, the content, and the footer
 * that carries the track, the branding and the page number.
 */
export const ExportPage: React.FC<{
  children: React.ReactNode;
  title: string;
  page: number;
  total: number;
}> = ({ children, title, page, total }) => (
  <div
    data-export-page={page}
    style={{
      position: "relative",
      width: PAGE_W,
      height: PAGE_H,
      background: PAGE_BG,
      overflow: "hidden",
      color: INK,
    }}
  >
    <div style={{ position: "absolute", top: 0, bottom: 0, left: SIDE_MARGIN, borderLeft: "1px dotted rgba(226,232,240,0.28)" }} />
    <div style={{ position: "absolute", top: 0, bottom: 0, right: SIDE_MARGIN, borderRight: "1px dotted rgba(226,232,240,0.28)" }} />

    <div style={{ position: "absolute", left: SIDE_MARGIN, top: TOP_PADDING, width: CONTENT_W }}>{children}</div>

    <div
      style={{
        position: "absolute",
        left: SIDE_MARGIN,
        right: SIDE_MARGIN,
        bottom: 0,
        height: FOOTER_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderTop: `1px solid var(--an-rule)`,
      }}
    >
      <span className="font-fira" style={{ fontSize: 8.5, color: INK_FAINT, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>
      <span className="font-fira" style={{ fontSize: 8.5, letterSpacing: "0.18em", textTransform: "uppercase", color: INK_MUTED }}>
        Resomix · resomix.com
      </span>
      <span className="font-fira" style={{ fontSize: 8.5, color: INK_FAINT }}>
        {page} / {total}
      </span>
    </div>
  </div>
);
