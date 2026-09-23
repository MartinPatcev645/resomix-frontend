import { describe, expect, it } from "vitest";
import {
  barMeans,
  barsFromDownbeats,
  camelotNeighbours,
  genreAgreement,
  lufsFrac,
  meanInRange,
  mergeGenreModels,
  parseCamelot,
  topSeriesByMean,
} from "@/utils/analysisTimeline.ts";

/**
 * The Timeline tab's maths, at the points where a real track breaks it: a beatless result with no
 * downbeats, a curve that stops before the audio does, a key the wheel cannot read, and two genre
 * models that disagree.
 */

describe("barsFromDownbeats", () => {
  it("uses the downbeats and runs the last bar to the end of the track", () => {
    const bars = barsFromDownbeats([0, 2, 4], 6000);
    expect(bars).toHaveLength(3);
    expect(bars[0]).toMatchObject({ startMs: 0, endMs: 2000 });
    expect(bars[2]).toMatchObject({ startMs: 4000, endMs: 6000 });
  });

  it("covers the run-in when the first downbeat is not at zero", () => {
    const bars = barsFromDownbeats([1.5, 3], 4500);
    expect(bars[0]).toMatchObject({ startMs: 0, endMs: 1500 });
  });

  it("falls back to equal slices on a beatless track, rather than drawing nothing", () => {
    const bars = barsFromDownbeats([], 8000, 4);
    expect(bars).toHaveLength(4);
    expect(bars[3].endMs).toBe(8000);
  });

  it("has no bars at all for a zero-length track", () => {
    expect(barsFromDownbeats([0, 1], 0)).toEqual([]);
  });
});

describe("meanInRange / barMeans", () => {
  const series = { values: [0, 1, 2, 3], hopMs: 1000 };

  it("averages the samples inside the window", () => {
    expect(meanInRange(series, 0, 2000)).toBe(0.5);
  });

  it("returns the sample it lands in when the window is shorter than a hop", () => {
    expect(meanInRange(series, 2100, 2200)).toBe(2);
  });

  it("is null when there is no series", () => {
    expect(meanInRange(null, 0, 1000)).toBeNull();
  });

  it("scales bars so the loudest one is 1", () => {
    const bars = barsFromDownbeats([0, 2], 4000);
    // Bar means are 0.5 and 2.5, so the quiet bar reads as a fifth of the loud one.
    expect(barMeans(series, bars)).toEqual([0.2, 1]);
  });
});

describe("lufsFrac", () => {
  it("prints the axis values at the gridlines", () => {
    expect(lufsFrac(-6)).toBe(0);
    expect(lufsFrac(-10)).toBeCloseTo(1 / 3, 5);
    expect(lufsFrac(-14)).toBeCloseTo(2 / 3, 5);
  });

  it("clamps instead of leaving the lane", () => {
    expect(lufsFrac(0)).toBe(0);
    expect(lufsFrac(-60)).toBe(1);
  });
});

describe("topSeriesByMean", () => {
  it("ranks by mean score and keeps only the top n", () => {
    const track = {
      hopMs: 100,
      series: [
        { label: "quiet", values: [0.1, 0.1] },
        { label: "loud", values: [0.9, 0.7] },
        { label: "mid", values: [0.5, 0.5] },
      ],
    };
    expect(topSeriesByMean(track, 2).map((r) => r.label)).toEqual(["loud", "mid"]);
  });

  it("is empty when the track has not arrived yet", () => {
    expect(topSeriesByMean(null, 5)).toEqual([]);
  });
});

describe("camelotNeighbours", () => {
  it("wraps around the wheel", () => {
    expect(camelotNeighbours("1A").map((n) => n.code)).toEqual(["1A", "12A", "2A", "1B"]);
    expect(camelotNeighbours("12B").map((n) => n.code)).toEqual(["12B", "11B", "1B", "12A"]);
  });

  it("invents nothing for a key it cannot read", () => {
    expect(camelotNeighbours("13A")).toEqual([]);
    expect(camelotNeighbours(null)).toEqual([]);
    expect(parseCamelot("f minor")).toBeNull();
  });
});

describe("mergeGenreModels", () => {
  const id = (s: string) => s;

  it("joins the models on the label and sorts by their best claim", () => {
    const rows = mergeGenreModels(
      [
        { label: "house", score: 0.8 },
        { label: "techno", score: 0.3 },
      ],
      [
        { label: "house", score: 0.6 },
        { label: "minimal", score: 0.5 },
      ],
      id,
    );
    expect(rows.map((r) => r.label)).toEqual(["house", "minimal", "techno"]);
    expect(rows[0]).toMatchObject({ discogs: 0.8, maest: 0.6, max: 0.8 });
  });

  it("keeps a label only one model found, with a gap for the other", () => {
    const rows = mergeGenreModels([{ label: "dub", score: 0.4 }], [], id);
    expect(rows[0]).toMatchObject({ discogs: 0.4, maest: null });
  });

  it("keeps the stronger score when shortening collapses two labels into one", () => {
    const rows = mergeGenreModels(
      [
        { label: "electronic---house", score: 0.4 },
        { label: "house", score: 0.7 },
      ],
      [],
      (l) => l.split("---").pop() as string,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].discogs).toBe(0.7);
  });

  it("says something honest when the models share nothing", () => {
    const rows = mergeGenreModels([{ label: "dub", score: 0.4 }], [{ label: "jazz", score: 0.3 }], id);
    expect(genreAgreement(rows)).toContain("entirely different");
  });
});
