import React from "react";
import {
  RxBadge,
  RxButton,
  RxIconButton,
  RxModeSelector,
  RxReferenceStrip,
  RxScoreRail,
  RxSearchField,
  RxSidebarItem,
  RxTabs,
  RxTrackResultRow,
} from "@resomix/ui";

const modeOptions = [
  {
    id: "discovery",
    title: "Find Similar Tracks",
    description: "One reference becomes a ranked shortlist you can audition.",
    output: "OUTPUT // RANKED SIMILARITY PLAYLIST",
  },
  {
    id: "analysis",
    title: "Analyse a Track",
    description: "Understand its structure, energy, rhythm, harmony and timbre.",
    output: "OUTPUT // TRACK INTELLIGENCE PROFILE",
  },
] as const;

const tabOptions = [
  { id: "search", label: "Search a known track" },
  { id: "upload", label: "Upload a reference" },
];

const searchModeOptions = [
  { value: "title-artist", label: "Title + artist" },
  { value: "catalogue", label: "Catalogue reference" },
];

const contrastChecks = [
  { label: "Primary text on canvas", ratio: "18.69:1", value: "rgba(255,255,255,0.96) on #050505" },
  { label: "Secondary text on surface", ratio: "12.12:1", value: "rgba(255,255,255,0.8) on #111111" },
  { label: "Muted / microcopy on surface", ratio: "9.94:1", value: "rgba(255,255,255,0.72) on #111111" },
  { label: "Muted / microcopy on input field", ratio: "10.20:1", value: "rgba(255,255,255,0.72) on #0A0A0A" },
  { label: "Accent control on canvas", ratio: "5.48:1", value: "#EE4A26 on #050505" },
  { label: "Focus ring against surfaces", ratio: "8.48:1", value: "#FF8F74 against #111111" },
  { label: "Unavailable status badge on surface", ratio: "7.20:1", value: "#FF7660 on #111111 — badge exempt from row dim" },
];

const desktopRows = [
  {
    artworkLabel: "D1",
    title: "Night Signal",
    artist: "Specimen Artist",
    score: 82.6,
    bpm: 126,
    musicalKey: "9A",
    year: 2022,
    duration: "06:14",
    state: "default" as const,
  },
  {
    artworkLabel: "D2",
    title: "Night Signal (Shortlist Hover Study)",
    artist: "Specimen Artist",
    score: 80.7,
    bpm: 125,
    musicalKey: "9A",
    year: 2023,
    duration: "07:02",
    state: "hover" as const,
  },
  {
    artworkLabel: "D3",
    title: "Current Task Selection",
    artist: "Review Context",
    score: 79.8,
    bpm: 124,
    musicalKey: "8A",
    year: 2021,
    duration: "05:44",
    state: "selected" as const,
  },
  {
    artworkLabel: "D4",
    title: "Circuit Bloom",
    artist: "Playback Specimen",
    score: 78.2,
    bpm: 128,
    musicalKey: "10A",
    year: 2020,
    duration: "05:48",
    state: "playing" as const,
  },
  {
    artworkLabel: "D5",
    title: "Paused Candidate Reference",
    artist: "Playback Specimen",
    score: 77.6,
    bpm: 127,
    musicalKey: "10A",
    year: 2019,
    duration: "06:03",
    state: "paused" as const,
  },
  {
    artworkLabel: "D6",
    title: "Archive Transfer Pending Preview Rights",
    artist: "Private Pilot Source",
    score: 72.4,
    bpm: 124,
    musicalKey: "8A",
    year: 1998,
    duration: "04:59",
    state: "unavailable" as const,
    unavailableReason: "Preview unavailable",
  },
];

const mobileRows = [
  {
    artworkLabel: "M1",
    title: "Compact mobile row",
    artist: "Specimen artist",
    score: 82.6,
    bpm: 126,
    musicalKey: "9A",
    year: 2022,
    duration: "06:14",
    state: "default" as const,
  },
  {
    artworkLabel: "M2",
    title: "Hover state mobile row",
    artist: "Specimen artist",
    score: 80.7,
    bpm: 125,
    musicalKey: "8A",
    year: 2024,
    duration: "07:02",
    state: "hover" as const,
  },
  {
    artworkLabel: "M3",
    title: "Playing mobile row",
    artist: "Playback specimen",
    score: 79.2,
    bpm: 128,
    musicalKey: "10A",
    year: 2020,
    duration: "05:48",
    state: "playing" as const,
  },
  {
    artworkLabel: "M4",
    title: "Paused mobile row",
    artist: "Playback specimen",
    score: 77.9,
    bpm: 127,
    musicalKey: "10A",
    year: 2021,
    duration: "06:03",
    state: "paused" as const,
  },
  {
    artworkLabel: "M5",
    title: "Long-form specimen title to prove wrapped metadata keeps the year and duration visible on small screens",
    artist: "Wrapped metadata example",
    score: 76.4,
    bpm: 123,
    musicalKey: "7A",
    year: 2023,
    duration: "06:58",
    state: "selected" as const,
    wrapped: true,
  },
  {
    artworkLabel: "M6",
    title: "Preview unavailable specimen",
    artist: "Private pilot source",
    score: 72.4,
    bpm: 120,
    musicalKey: "7A",
    year: 1998,
    duration: "04:59",
    state: "unavailable" as const,
    unavailableReason: "Preview unavailable",
  },
];

function SectionHead({ index, title, sysId }: { index: string; title: string; sysId?: string }) {
  return (
    <div className="rx-section-head">
      <span className="rx-section-index">{index}</span>
      <h2 className="rx-section-title">{title}</h2>
      {sysId ? <span className="rx-sys-id">{sysId}</span> : null}
    </div>
  );
}

function useSpecimenMetadata() {
  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = "Resomix UI System Specimen";

    let robots = document.querySelector('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");

    return () => {
      document.title = previousTitle;
      if (created && robots?.parentNode) {
        robots.parentNode.removeChild(robots);
      }
    };
  }, []);
}

export default function UiSystemSpecimenPage() {
  const [activeMode, setActiveMode] = React.useState("discovery");
  const [activeTab, setActiveTab] = React.useState("search");
  const [searchValue, setSearchValue] = React.useState("Specimen reference title");
  const [searchMode, setSearchMode] = React.useState("title-artist");

  useSpecimenMetadata();

  return (
    <div data-rx-ui className="rx-shell">
      <main className="rx-page">
        <div className="rx-system-frame rx-ticks">
          <section className="rx-hero">
            <p className="rx-sys-id">[RX_UI / PHASE_1B]</p>
            <p className="rx-kicker">Internal review route / specimen only</p>
            <h1 className="rx-display">Resomix UI System</h1>
            <p className="rx-body">
              Precision-industrial Phase 1B refinement. Development-only specimen, unlinked from production navigation, built from static demonstrative data.
            </p>
            <div className="rx-inline">
              <RxBadge tone="accent">Route is internal</RxBadge>
              <RxBadge>SAMPLE DATA</RxBadge>
              <RxBadge>REBUILT FROM PRODUCT PATTERNS</RxBadge>
              <RxBadge>SCHEMATIC — NOT PRODUCT UI</RxBadge>
              <RxBadge tone="accent">PRIVATE PILOT</RxBadge>
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="01 //" title="Foundations" sysId="SYS // FOUNDATIONS" />
            <div className="rx-rack rx-ticks rx-stack">
              <div className="rx-grid rx-grid-4">
                {[
                  ["Canvas", "var(--rx-color-canvas)"],
                  ["Primary surface", "var(--rx-color-surface)"],
                  ["Raised surface", "var(--rx-color-surface-raised)"],
                  ["Subtle overlay", "var(--rx-color-overlay)"],
                  ["Accent", "var(--rx-color-accent)"],
                  ["Accent soft", "var(--rx-color-accent-soft)"],
                  ["Border default", "var(--rx-color-border-default)"],
                  ["Focus", "var(--rx-color-focus)"],
                ].map(([label, color]) => (
                  <div key={label} className="rx-swatch">
                    <div className="rx-swatch__chip" style={{ background: color }} />
                    <p className="rx-meta">{label}</p>
                    <code className="rx-meta">{color}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="rx-grid rx-grid-3">
              <div className="rx-panel rx-type-card rx-stack">
                <p className="rx-display" style={{ fontSize: "var(--px-48)" }}>Display</p>
                <p className="rx-supporting">Benzin, uppercase, reserved for the single page-display role.</p>
              </div>
              <div className="rx-panel rx-type-card rx-stack">
                <h3 className="rx-section-title" style={{ fontSize: "var(--px-28)", lineHeight: "var(--px-32)" }}>
                  Section title
                </h3>
                <p className="rx-supporting">Helvetica Neue bold for H2 structure and interface hierarchy.</p>
              </div>
              <div className="rx-panel rx-type-card rx-stack">
                <p className="rx-body">Interface and supporting body copy stay readable on the dark canvas.</p>
                <p className="rx-meta">Technical labels and metadata use Fira Code at controlled sizes.</p>
              </div>
            </div>

            <div className="rx-grid rx-grid-3">
              <div className="rx-panel rx-note-card rx-stack">
                <p className="rx-label">Spacing scale</p>
                <div className="rx-token-list">
                  {["0", "4", "8", "12", "16", "24", "32", "48", "64"].map((token) => (
                    <code key={token}>--rx-space-{token}</code>
                  ))}
                </div>
              </div>
              <div className="rx-panel rx-note-card rx-stack">
                <p className="rx-label">Geometry</p>
                <div className="rx-token-list">
                  <code>--rx-radius-panel // 0</code>
                  <code>--rx-radius-control // 2px</code>
                  <code>--rx-radius-tag // 2px</code>
                  <code>--rx-notch-md // 10px · --rx-notch-sm // 6px</code>
                </div>
              </div>
              <div className="rx-panel rx-note-card rx-stack">
                <p className="rx-label">Sizes + motion</p>
                <div className="rx-token-list">
                  <code>Interactive minimum // 44px</code>
                  <code>Sticky strip // 56px</code>
                  <code>Compact / wrapped row // 80 / 96px</code>
                  <code>Transition // 120–160ms · reduced-motion off</code>
                </div>
              </div>
            </div>

            <div className="rx-stack">
              <p className="rx-label">Measured contrast</p>
              <div className="rx-measure-grid">
                {contrastChecks.map((check) => (
                  <div key={check.label} className="rx-contrast-card rx-stack">
                    <p className="rx-meta">{check.label}</p>
                    <p className="rx-contrast-value">{check.ratio}</p>
                    <p className="rx-supporting">{check.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="02 //" title="Interaction States" sysId="SYS // INTERACTION" />
            <div className="rx-grid rx-grid-4">
              {[
                ["Default / inactive", "Neutral, readable, available.", undefined],
                ["Hover", "Temporary pointer affordance.", { background: "rgba(255,255,255,0.05)" }],
                ["Focus visible", "External ring, distinct from content states.", { boxShadow: "var(--rx-ring)" }],
                ["Selected", "Left rail + restrained tint.", { background: "rgba(238,74,38,0.12)", boxShadow: "inset 3px 0 0 0 #ee4a26" }],
                ["Playing", "Strongest orange fill + rail.", { background: "rgba(238,74,38,0.2)", boxShadow: "inset 3px 0 0 0 #ee4a26" }],
                ["Paused", "Quiet neutral; not identical to playing.", { background: "rgba(255,255,255,0.03)", boxShadow: "inset 3px 0 0 0 rgba(255,255,255,0.24)" }],
                ["Loading", "Work in progress without layout shift.", undefined],
                ["Disabled", "Readable and unavailable.", { color: "rgba(255,255,255,0.42)" }],
                ["Unavailable", "Preview cannot be used.", { opacity: 0.68 }],
                ["Error", "Failure, not selection.", { borderColor: "rgba(255,118,96,0.42)", color: "var(--rx-color-error)" }],
              ].map(([label, copy, style]) => (
                <div key={label as string} className="rx-panel rx-state-card rx-stack">
                  <div className="rx-state-preview" style={style as React.CSSProperties | undefined}>
                    {label as string}
                  </div>
                  <p className="rx-meta">{copy as string}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="03 //" title="Buttons and Small Controls" />
            <div className="rx-inline">
              <RxButton variant="primary">Primary action</RxButton>
              <RxButton variant="secondary">Secondary action</RxButton>
              <RxButton variant="ghost">Quiet action</RxButton>
              <RxButton variant="secondary" loading>Loading</RxButton>
              <RxButton variant="secondary" disabled>Disabled</RxButton>
              <RxIconButton label="Play" icon=">" />
              <RxIconButton label="Pause" icon="II" active />
              <RxIconButton label="More actions" icon="..." />
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="04 //" title="Product Mode Selector" sysId="SYS // MODE" />
            <RxModeSelector
              label="Product mode"
              options={[...modeOptions]}
              value={activeMode}
              onChange={setActiveMode}
            />
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="05 //" title="Search and Upload Controls" sysId="SYS // INPUT BAY" />
            <RxTabs label="Input method" tabs={tabOptions} activeTab={activeTab} onChange={setActiveTab} />
            <div className="rx-grid-gap rx-grid-2">
              <div className="rx-panel rx-note-card">
                <RxSearchField
                  label="Search a known track"
                  searchModeLabel="Search Mode"
                  searchModeValue={searchMode}
                  searchModeOptions={searchModeOptions}
                  value={searchValue}
                  onValueChange={(event) => setSearchValue(event.target.value)}
                  onSearchModeChange={(event) => setSearchMode(event.target.value)}
                  placeholder="Enter a reference title"
                  hint="Default specimen state with a neutral, labelled control."
                  uploadLabel={activeTab === "upload" ? "Upload a reference" : undefined}
                  uploadState="default"
                />
              </div>
              <div className="rx-upload-bay-grid">
                <div className="rx-panel rx-note-card rx-stack">
                  <p className="rx-label">Upload bay // drag-active</p>
                  <RxSearchField
                    label="Search a known track"
                    searchModeLabel="Search Mode"
                    searchModeValue="title-artist"
                    searchModeOptions={searchModeOptions}
                    value=""
                    placeholder="Drag-active state"
                    uploadLabel="Upload a reference"
                    uploadState="drag-active"
                  />
                </div>
                <div className="rx-panel rx-note-card rx-stack">
                  <p className="rx-label">Upload bay // focus</p>
                  <RxSearchField
                    label="Search a known track"
                    searchModeLabel="Search Mode"
                    searchModeValue="title-artist"
                    searchModeOptions={searchModeOptions}
                    value=""
                    placeholder="Focus state"
                    uploadLabel="Upload a reference"
                    uploadState="focus"
                  />
                </div>
                <div className="rx-panel rx-note-card rx-stack">
                  <p className="rx-label">Upload bay // error</p>
                  <RxSearchField
                    label="Search a known track"
                    searchModeLabel="Search Mode"
                    searchModeValue="catalogue"
                    searchModeOptions={searchModeOptions}
                    value=""
                    placeholder="Error state"
                    status="error"
                    uploadLabel="Upload a reference"
                    uploadState="error"
                  />
                </div>
                <div className="rx-panel rx-note-card">
                  <RxSearchField
                    label="Search a known track"
                    searchModeLabel="Search Mode"
                    searchModeValue="title-artist"
                    searchModeOptions={searchModeOptions}
                    value=""
                    placeholder="Loading state"
                    status="loading"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="06 //" title="Score Rails" sysId="SYS // METER" />
            <div className="rx-grid rx-grid-3">
              <div className="rx-panel rx-note-card rx-stack">
                <RxScoreRail label="Matched shortlist score" score={82.6} />
                <p className="rx-meta">82.6% and 80.7% stay visually close because they are close.</p>
              </div>
              <div className="rx-panel rx-note-card rx-stack">
                <RxScoreRail label="Matched shortlist score" score={80.7} />
                <p className="rx-meta">Idle rails stay neutral silver — not orange by default.</p>
              </div>
              <div className="rx-panel rx-note-card rx-stack">
                <RxScoreRail label="Currently playing match" score={78.2} emphasis="playing" />
                <p className="rx-meta">STATE // PLAYING — orange reserved for active emphasis.</p>
              </div>
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="07 //" title="Desktop Result Rows" sysId="CH // 01" />
            <div className="rx-channel">
              {desktopRows.map((row) => (
                <RxTrackResultRow key={`${row.title}-${row.state}`} {...row} />
              ))}
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="08 //" title="Mobile Result Rows" sysId="CH // 02" />
            <div className="rx-channel rx-mobile-stack">
              {mobileRows.map((row) => (
                <RxTrackResultRow key={`${row.title}-${row.state}`} mobile {...row} />
              ))}
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="09 //" title="Sticky Reference Strip" sysId="REF // TRACK" />
            <div className="rx-stack">
              <RxReferenceStrip
                artworkLabel="REF"
                title="Reference // Night Signal"
                artist="Specimen Artist"
                resultCount={42}
                state="playing"
              />
              <div style={{ maxWidth: "var(--px-500)" }}>
                <RxReferenceStrip
                  artworkLabel="REF"
                  title="Reference // Mobile review"
                  artist="Specimen Artist"
                  resultCount={17}
                  state="paused"
                />
              </div>
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="10 //" title="Sidebar and Status Items" />
            <div className="rx-grid-gap rx-grid-2">
              <div className="rx-stack">
                <RxSidebarItem label="Similar tracks" count={42} active />
                <RxSidebarItem label="Analysis profile" count={1} />
                <RxSidebarItem label="Private pilot references" count={3} />
              </div>
              <div className="rx-panel rx-note-card rx-stack">
                <p className="rx-label">Supporting primitives</p>
                <div className="rx-inline">
                  <RxBadge>SAMPLE DATA</RxBadge>
                  <RxBadge>REBUILT FROM PRODUCT PATTERNS</RxBadge>
                  <RxBadge tone="accent">PRIVATE PILOT</RxBadge>
                </div>
                <div className="rx-divider" />
                <p className="rx-supporting">
                  Low-contrast dividers and sharp status tags support denser rack layouts. Transport and action controls are square hardware blocks; circular geometry is reserved for identity avatars only.
                </p>
              </div>
            </div>
          </section>

          <section className="rx-section rx-stack">
            <SectionHead index="11 //" title="Responsive Notes" />
            <div className="rx-grid-gap rx-grid-2">
              <div className="rx-panel rx-note-card rx-stack">
                <p className="rx-label">Review widths</p>
                <p className="rx-supporting">
                  Desktop 1440, laptop 1280, tablet 768, phone 390. Channel strips keep titles, year and duration visible without horizontal scroll.
                </p>
                <div className="rx-token-list">
                  <code>Desktop retains multi-column channel density.</code>
                  <code>Tablet holds two-column racks from 600px.</code>
                  <code>Phone keeps 44px targets and 96px wrapped rows.</code>
                  <code>Notches step from 10px desktop to 6px mobile.</code>
                </div>
              </div>
              <div className="rx-panel rx-note-card rx-stack">
                <p className="rx-label">Accessibility</p>
                <p className="rx-supporting">
                  Mode cards use radio semantics; tabs stay keyboard-reachable; focus rings remain rectangular even when chamfered surfaces are active; reduced-motion collapses transitions.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
