import { describe, expect, it } from "vitest";
import { scoreBandWidthPct, shortlistScoreRange } from "@/utils/scoreBand.ts";

describe("scoreBand", () => {
  it("normalises scores to the shortlist min–max span", () => {
    const range = shortlistScoreRange([0.91, 0.95, 0.98]);
    expect(scoreBandWidthPct(0.98, range.min, range.max)).toBe(100);
    expect(scoreBandWidthPct(0.91, range.min, range.max)).toBe(8);
    expect(scoreBandWidthPct(0.945, range.min, range.max)).toBeGreaterThan(8);
    expect(scoreBandWidthPct(0.945, range.min, range.max)).toBeLessThan(100);
  });

  it("returns full width when all scores are equal", () => {
    const range = shortlistScoreRange([0.95, 0.95]);
    expect(scoreBandWidthPct(0.95, range.min, range.max)).toBe(100);
  });
});
