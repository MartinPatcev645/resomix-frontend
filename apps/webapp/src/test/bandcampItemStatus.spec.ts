import { describe, expect, it } from "vitest";
import {
  analyzeAvailability,
  canRunActions,
  findSimilarAvailability,
  getItemStatus,
} from "@/features/bandcamp/lib/itemStatus.ts";
import type { BandcampAnalysisStatus } from "@/features/bandcamp/api/types.ts";

describe("getItemStatus", () => {
  const cases: Array<[BandcampAnalysisStatus, string | null, string]> = [
    ["none", null, "Not in Resomix yet"],
    ["none", "42", "In Resomix"],
    ["queued", null, "Analysis pending"],
    ["queued", "42", "Analysis pending"],
    ["done", "42", "Analyzed"],
    ["done", null, "Analyzed"],
    ["failed", "42", "Analysis failed"],
    ["failed", null, "Analysis failed"],
  ];

  it.each(cases)("analysis %s + track id %s -> %s", (analysisStatus, resomixTrackId, label) => {
    expect(getItemStatus({ analysisStatus, resomixTrackId }).label).toBe(label);
  });

  it("never calls an unqueued, unmatched item pending", () => {
    expect(getItemStatus({ analysisStatus: "none", resomixTrackId: null }).label).not.toMatch(/pending/i);
  });

  it("colours failures as errors and finished analyses as success", () => {
    expect(getItemStatus({ analysisStatus: "failed", resomixTrackId: "1" }).tone).toBe("error");
    expect(getItemStatus({ analysisStatus: "done", resomixTrackId: "1" }).tone).toBe("success");
  });
});

describe("action availability", () => {
  it("enables Find similar only for matched items", () => {
    expect(canRunActions({ itemType: "track", resomixTrackId: "7" })).toBe(true);
    expect(findSimilarAvailability({ itemType: "track", resomixTrackId: "7" })).toEqual({ enabled: true, reason: null });
    expect(findSimilarAvailability({ itemType: "track", resomixTrackId: null })).toEqual({
      enabled: false,
      reason: "This track isn't in Resomix yet.",
    });
  });

  it("explains that albums cannot be analysed, as an expected state", () => {
    const album = { itemType: "album" as const, resomixTrackId: null };
    expect(findSimilarAvailability(album).reason).toBe("Albums can't be analyzed yet.");
    expect(analyzeAvailability(album)).toEqual({ enabled: false, reason: "Albums can't be analyzed yet." });
  });

  it("keeps Analyze off for matched tracks until the backend supports it", () => {
    expect(analyzeAvailability({ itemType: "track", resomixTrackId: "7" })).toEqual({
      enabled: false,
      reason: "Track Intelligence for imported tracks is coming soon.",
    });
  });
});
