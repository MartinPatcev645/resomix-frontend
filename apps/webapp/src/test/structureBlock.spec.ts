import { describe, expect, it } from "vitest";
import { mapCanonicalToAnalysisData } from "@/pages/analysis/mapCanonical.ts";
import { SECTION_WORD_GROUPS, sectionTone } from "@/utils/sectionColors.ts";
import { sectionAtMs, sectionWord, structureListMeta, structureTableRows } from "@/utils/structureStrip.ts";
import sectionTokensCss from "@/styles/sections.css?raw";

/**
 * The `structure` block as the analysis service emits it, for a minimal track: canonical `drop`
 * sections shown as "groove", a hidden `start` marker ahead of the intro and a hidden `end` after
 * the outro. Shaped on a real reading from the delivered review set.
 */
const grooveStructure = {
  status: "ok",
  gate: null,
  summary: "8-bar intro, full · groove 1 from bar 9 (0:15), rising · 12-bar outro, full · evolving groove",
  family: "groove",
  routed_family: "mixed",
  vocabulary: "groove",
  family_reason: "mixed family, no break routine",
  family_detail: { top_style: "Electronic---Tech House" },
  sections: [
    { label: "start", start_ms: 0, end_ms: 400, bars: 0, hidden: true, word: null, number: null, modifiers: [], shown: null, start_bar: null },
    { label: "intro", start_ms: 400, end_ms: 15480, bars: 8, hidden: false, word: "intro", number: null, modifiers: ["full"], shown: "intro · full", start_bar: 1 },
    { label: "drop", start_ms: 15480, end_ms: 93000, bars: 40, hidden: false, word: "groove", number: "1", modifiers: ["rising"], shown: "groove 1 · rising", start_bar: 9 },
    { label: "drop", start_ms: 93000, end_ms: 139000, bars: 24, hidden: false, word: "groove", number: "2", modifiers: [], shown: "groove 2", start_bar: 49 },
    { label: "outro", start_ms: 139000, end_ms: 160000, bars: 12, hidden: false, word: "outro", number: null, modifiers: ["full"], shown: "outro · full", start_bar: 73 },
    { label: "end", start_ms: 160000, end_ms: 170000, bars: 5, hidden: true, word: null, number: null, modifiers: [], shown: null, start_bar: null },
  ],
};

const raw = (extra: Record<string, unknown>) => ({ identity: { duration_ms: 170000 }, energy: {}, ...extra });

describe("the structure block", () => {
  it("never calls a groove track's sections a drop, in any text the UI reads", () => {
    const data = mapCanonicalToAnalysisData(raw({ structure: grooveStructure }));
    const texts = data.energy.structureSegments.flatMap((s) => [s.label, s.shown ?? "", s.word ?? ""]);
    expect(texts.join(" ").toLowerCase()).not.toContain("drop");
    // the canonical class is kept, but only as `role`, which nothing displays
    expect(data.energy.structureSegments.filter((s) => s.role === "drop")).toHaveLength(2);
  });

  it("labels a section with its word and number, and keeps the modifiers for the tooltip", () => {
    const segs = mapCanonicalToAnalysisData(raw({ structure: grooveStructure })).energy.structureSegments;
    const groove1 = segs.find((s) => s.startMs === 15480)!;
    expect(groove1.label).toBe("groove 1");
    expect(groove1.word).toBe("groove");
    expect(groove1.shown).toBe("groove 1 · rising");
    expect(groove1.bars).toBe(40);
    expect(groove1.startBar).toBe(9);
  });

  it("keeps hidden markers in the strip so every later block stays in line with the audio", () => {
    const segs = mapCanonicalToAnalysisData(raw({ structure: grooveStructure })).energy.structureSegments;
    expect(segs).toHaveLength(6);
    expect(segs[0].hidden).toBe(true);
    expect(segs[0].label).toBe("");
    // contiguous from 0 to the end, which is what the width-based strip relies on
    segs.forEach((s, i) => i > 0 && expect(s.startMs).toBe(segs[i - 1].endMs));
  });

  it("never names a hidden marker, on hover or under the playhead", () => {
    const segs = mapCanonicalToAnalysisData(raw({ structure: grooveStructure })).energy.structureSegments;
    expect(sectionAtMs(segs, 100)).toBeUndefined(); // inside the `start` marker
    expect(sectionAtMs(segs, 20000)?.shown).toBe("groove 1 · rising");
    expect(sectionAtMs(segs, 165000)).toBeUndefined(); // inside the `end` marker
    expect(sectionAtMs(segs, 100000)?.label).toBe("groove 2");
  });

  it("lists every shown section in the table, numbered, never merged", () => {
    const segs = mapCanonicalToAnalysisData(raw({ structure: grooveStructure })).energy.structureSegments;
    const rows = structureTableRows(segs);
    expect(rows.map((r) => r.shown)).toEqual(["intro · full", "groove 1 · rising", "groove 2", "outro · full"]);
    // the model publishes no per-section confidence, so the header must not invent one
    expect(structureListMeta(rows)).toBe("4 sections");
  });

  it("carries the whole-track reading", () => {
    const { structure } = mapCanonicalToAnalysisData(raw({ structure: grooveStructure }));
    expect(structure?.status).toBe("ok");
    expect(structure?.family).toBe("groove");
    expect(structure?.summary.endsWith("evolving groove")).toBe(true);
  });

  it("passes a no-beat-grid track through as a gate with its sentence", () => {
    const gate = { status: "gate", gate: "continuous piece - no clear sections (no beat grid)", sections: [], summary: "" };
    const { structure } = mapCanonicalToAnalysisData(raw({ structure: gate }));
    expect(structure?.status).toBe("gate");
    expect(structure?.gate).toContain("no clear sections");
  });

  it("shows no structure at all for an older result, even one that still carries v1 / v2", () => {
    const old = raw({
      energy: { structure_segments: [{ start_ms: 0, end_ms: 1000, label: "drop", confidence: 0.9 }] },
      structure_v2: { segments: [{ start_ms: 0, end_ms: 1000, label: "drop" }] },
    });
    const data = mapCanonicalToAnalysisData(old);
    expect(data.structure).toBeNull();
    // the old sections still feed the sentences they always fed, but nothing draws them
    expect(data.energy.structureSegments[0].label).toBe("drop");
  });

  it("treats a block with no shown sections as absent rather than as an empty track", () => {
    const empty = { ...grooveStructure, sections: grooveStructure.sections.filter((s) => s.hidden) };
    expect(mapCanonicalToAnalysisData(raw({ structure: empty })).structure).toBeNull();
  });

  it("finds a drop by its displayed word, so a numbered drop still counts", () => {
    expect(sectionWord({ word: "drop", label: "drop 1a" })).toBe("drop");
    expect(sectionWord({ label: "main" })).toBe("main");
  });
});

describe("section colours", () => {
  // Every word the structure reading can put on screen: the four vocabularies, plus "part".
  const SHOWN_WORDS = [
    "intro", "build", "main", "drop", "groove", "breakdown", "break", "cooldown", "wind-down", "outro",
    "opening", "swell", "full", "sparse", "fade", "closing", "part",
  ];

  it("gives every word the reading can show its own colour", () => {
    expect(Object.keys(SECTION_WORD_GROUPS).sort()).toEqual([...SHOWN_WORDS].sort());
    for (const word of SHOWN_WORDS) {
      expect(sectionTone(word)).toEqual({ bg: `var(--section-${word}-bg)`, fg: `var(--section-${word}-fg)` });
    }
  });

  it("defines a token for every colour it hands out, so no block renders unstyled", () => {
    for (const word of SHOWN_WORDS) {
      expect(sectionTokensCss).toContain(`--section-${word}-bg:`);
      expect(sectionTokensCss).toContain(`--section-${word}-fg:`);
    }
  });

  it("colours by the word, so a numbered or capitalised label still matches", () => {
    const segs = mapCanonicalToAnalysisData(raw({ structure: grooveStructure })).energy.structureSegments;
    const groove2 = segs.find((s) => s.label === "groove 2")!;
    expect(sectionTone(sectionWord(groove2)).fg).toBe("var(--section-groove-fg)");
    expect(sectionTone("Wind-Down").fg).toBe("var(--section-wind-down-fg)");
  });

  it("draws anything unknown as 'part', never as nothing", () => {
    expect(sectionTone("rise").fg).toBe("var(--section-part-fg)"); // an older reading's word
    expect(sectionTone("constructor").fg).toBe("var(--section-part-fg)"); // not a prototype key
    expect(sectionTone("").bg).toBe("var(--section-part-bg)");
  });
});
