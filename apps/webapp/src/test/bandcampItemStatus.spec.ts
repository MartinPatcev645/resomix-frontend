import { describe, expect, it } from "vitest";
import {
  analyzeAvailability,
  canRunActions,
  findSimilarAvailability,
  getItemStatus,
} from "@/features/bandcamp/lib/itemStatus.ts";

describe("getItemStatus", () => {
  it("says whether the item is in Resomix", () => {
    expect(getItemStatus({ resomixTrackId: null })).toEqual({ label: "Not in Resomix yet", tone: "neutral" });
    expect(getItemStatus({ resomixTrackId: "42" })).toEqual({ label: "In Resomix", tone: "accent" });
  });

  it("never calls an unmatched item pending or analyzed", () => {
    const label = getItemStatus({ resomixTrackId: null }).label;
    expect(label).not.toMatch(/pending/i);
    expect(label).not.toMatch(/analy[sz]ed/i);
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
