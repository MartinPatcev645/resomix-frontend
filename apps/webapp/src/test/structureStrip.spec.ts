import { describe, expect, it } from "vitest";
import { mergeStructureSegments, structureListMeta } from "@/utils/structureStrip.ts";

describe("structure list", () => {
  it("merges consecutive same-type sections", () => {
    const merged = mergeStructureSegments([
      { label: "main", startMs: 0, endMs: 1000, confidence: 0.8 },
      { label: "main", startMs: 1000, endMs: 2000, confidence: 0.9 },
      { label: "drop", startMs: 2000, endMs: 3000, confidence: 0.95 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].sectionCount).toBe(2);
    expect(merged[0].endMs).toBe(2000);
  });

  it("reports the section count and median confidence", () => {
    const meta = structureListMeta(
      mergeStructureSegments([
        { label: "intro", startMs: 0, endMs: 1000, confidence: 0.8 },
        { label: "main", startMs: 1000, endMs: 2000, confidence: 0.6 },
      ]),
    );
    expect(meta).toBe("2 sections · median confidence 0.70");
  });

  it("excludes invalid confidences from the median", () => {
    const meta = structureListMeta(
      mergeStructureSegments([
        { label: "intro", startMs: 0, endMs: 1000, confidence: -0.04 },
        { label: "main", startMs: 1000, endMs: 2000, confidence: 0.6 },
      ]),
    );
    expect(meta).toBe("2 sections · median confidence 0.60");
  });

  /**
   * The header counts the rows the reader can see.
   *
   * The old caption counted RAW segments while the strip beside it drew MERGED ones, so these two
   * inputs produced "3 sections" above two blocks. Now that rows are numbered 01…NN on screen, a
   * reader can count them, and a header that disagrees is simply wrong.
   */
  it("counts merged rows, not raw segments", () => {
    const raw = [
      { label: "main", startMs: 0, endMs: 1000, confidence: 0.5 },
      { label: "main", startMs: 1000, endMs: 2000, confidence: 0.5 },
      { label: "drop", startMs: 2000, endMs: 3000, confidence: 0.5 },
    ];
    const merged = mergeStructureSegments(raw);

    expect(raw).toHaveLength(3);
    expect(merged).toHaveLength(2);
    expect(structureListMeta(merged)).toMatch(/^2 sections/);
  });

  it("has a short form for narrow viewports", () => {
    const merged = mergeStructureSegments([
      { label: "intro", startMs: 0, endMs: 1000, confidence: 0.8 },
      { label: "main", startMs: 1000, endMs: 2000, confidence: 0.6 },
    ]);
    // The full wording does not fit beside the panel title at 320px.
    expect(structureListMeta(merged, { short: true })).toBe("2 · conf 0.70");
  });

  it("omits the confidence entirely when none is usable", () => {
    // Better to say "2 sections" than to invent a number or print "median confidence NaN".
    const merged = mergeStructureSegments([
      { label: "intro", startMs: 0, endMs: 1000, confidence: -1 },
      { label: "main", startMs: 1000, endMs: 2000, confidence: -1 },
    ]);
    expect(structureListMeta(merged)).toBe("2 sections");
    expect(structureListMeta(merged, { short: true })).toBe("2");
  });

  it("says nothing at all when there are no segments", () => {
    expect(structureListMeta([])).toBe("");
  });
});
