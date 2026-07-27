import { describe, expect, it } from "vitest";
import { mergeStructureSegments, structureStripCaption } from "@/utils/structureStrip.ts";

describe("structureStrip", () => {
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

  it("captions with section count and median confidence", () => {
    const caption = structureStripCaption([
      { label: "intro", startMs: 0, endMs: 1000, confidence: 0.8 },
      { label: "main", startMs: 1000, endMs: 2000, confidence: 0.6 },
    ]);
    expect(caption).toBe("2 sections · median confidence 0.70");
  });

  it("excludes invalid confidences from median", () => {
    const caption = structureStripCaption([
      { label: "intro", startMs: 0, endMs: 1000, confidence: -0.04 },
      { label: "main", startMs: 1000, endMs: 2000, confidence: 0.6 },
    ]);
    expect(caption).toBe("2 sections · median confidence 0.60");
  });
});
