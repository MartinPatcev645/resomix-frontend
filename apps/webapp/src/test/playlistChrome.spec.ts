import { describe, expect, it } from "vitest";
import {
  initialVisibleCount,
  nextVisibleCount,
  PLAYLIST_VISIBLE_PAGE,
} from "@/utils/playlistChrome.ts";

describe("playlistChrome progressive disclosure", () => {
  it("shows all results when total is at or below the page size", () => {
    expect(initialVisibleCount(10)).toBe(10);
    expect(initialVisibleCount(PLAYLIST_VISIBLE_PAGE)).toBe(PLAYLIST_VISIBLE_PAGE);
  });

  it("caps the initial window at 25 when more results exist", () => {
    expect(initialVisibleCount(50)).toBe(25);
    expect(initialVisibleCount(100)).toBe(25);
  });

  it("advances in increments of 25 without exceeding the total", () => {
    expect(nextVisibleCount(25, 100)).toBe(50);
    expect(nextVisibleCount(75, 100)).toBe(100);
    expect(nextVisibleCount(100, 100)).toBe(100);
  });
});
