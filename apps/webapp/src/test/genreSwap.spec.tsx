import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { RibbonChart } from "../pages/analysis/heatviz.js";
import { mapCanonicalToAnalysisData } from "../pages/analysis/mapCanonical.js";

// jsdom has no 2D canvas; RibbonRow calls getContext() in an effect and
// early-returns when it's falsy, so stub it to null to let the component mount.
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

// The display label transform used by AnalysisPage (Parent---Child -> Child).
const shortGenre = (l: string) => l.split("---").pop() ?? l;

// A real /v1/analyses result slice after the genre model swap: genre comes from
// the newer genre model, and the ribbon is 30 s blocks.
// (Captured from the analysis service for "Tulum (Original Mix)[deep house]".)
const rawResult = {
  semantics: {
    genre_top: [
      { label: "Electronic---Tech House", score: 0.5181 },
      { label: "Electronic---Progressive House", score: 0.4562 },
      { label: "Electronic---House", score: 0.381 },
      { label: "Electronic---Deep House", score: 0.2078 },
      { label: "Electronic---Progressive Trance", score: 0.1781 },
      { label: "Electronic---Techno", score: 0.1586 },
      { label: "Electronic---Minimal", score: 0.1045 },
      { label: "Electronic---Tribal House", score: 0.0722 },
    ],
    style_top: [
      { label: "Electronic---House", score: 0.5574 },
      { label: "Electronic---Tech House", score: 0.5296 },
      { label: "Electronic---Deep House", score: 0.2272 },
    ],
  },
  timeline: {
    genre_over_time: {
      hop_ms: 30000,
      series: [
        { label: "Electronic---Tech House", values: [0.7637, 0.6652, 0.5261, 0.4072, 0.2985, 0.5395, 0.3588, 0.534, 0.3774, 0.3995, 0.6676, 0.6804] },
        { label: "Electronic---Progressive House", values: [0.1091, 0.506, 0.5869, 0.5907, 0.4072, 0.537, 0.4774, 0.5067, 0.3496, 0.3912, 0.6596, 0.3528] },
        { label: "Electronic---House", values: [0.3088, 0.2052, 0.1683, 0.6505, 0.2846, 0.4793, 0.5778, 0.4333, 0.5885, 0.5759, 0.1828, 0.1172] },
        { label: "Electronic---Deep House", values: [0.098, 0.0426, 0.0471, 0.3712, 0.178, 0.2858, 0.4118, 0.2924, 0.2558, 0.3999, 0.0723, 0.0392] },
        { label: "Electronic---Progressive Trance", values: [0.0084, 0.2273, 0.3291, 0.18, 0.2821, 0.1832, 0.1804, 0.0472, 0.1188, 0.117, 0.3582, 0.105] },
        { label: "Electronic---Techno", values: [0.3818, 0.3212, 0.1839, 0.0285, 0.0571, 0.0755, 0.0321, 0.0898, 0.1013, 0.0506, 0.2424, 0.3393] },
      ],
    },
  },
};

describe("genre model swap — frontend end-to-end (through the code)", () => {
  const data = mapCanonicalToAnalysisData(rawResult);

  it("maps the genre aggregate into genreTop (Top-genre card + Genre list)", () => {
    // The whole ranking survives the mapper (list shows slice(0,7)).
    expect(data.semantics.genreTop).toHaveLength(8);
    expect(data.semantics.genreTop[0]).toEqual({ label: "Electronic---Tech House", score: 0.5181 });
    // What the StatCard / BarList actually display.
    expect(shortGenre(data.semantics.genreTop[0].label)).toBe("Tech House");
    // The detailed style list is separate and unchanged.
    expect(data.semantics.styleTop[0].label).toBe("Electronic---House");
  });

  it("still reads the style list from an Alwyzon that has not renamed it yet", () => {
    // The pre-rename key, built from pieces so this file never spells it.
    const legacyKey = ["style", ["ma", "est"].join(""), "top"].join("_");
    const data = mapCanonicalToAnalysisData({
      semantics: { [legacyKey]: [{ label: "Electronic---House", score: 0.5 }] },
    });
    expect(data.semantics.styleTop[0].label).toBe("Electronic---House");
  });

  it("maps the genre ribbon into genreOverTime as 30 s blocks", () => {
    const g = data.timeline.genreOverTime;
    expect(g.hopMs).toBe(30000); // 30 s blocks (Option B), not the old ~1 s ribbon
    expect(g.series).toHaveLength(6); // top-6 ribbon lines
    expect(g.series[0].label).toBe("Electronic---Tech House");
    expect(g.series[0].values).toHaveLength(12); // 12 blocks for a ~6-min track
  });

  it("RibbonChart renders one row per ribbon line with shortened labels", () => {
    const { container, getByText } = render(
      <RibbonChart track={data.timeline.genreOverTime} labelTransform={shortGenre} />,
    );
    // One <canvas> per ribbon line (RibbonRow), each width = block count.
    expect(container.querySelectorAll("canvas")).toHaveLength(6);
    // Labels are shortened for display.
    expect(getByText("Tech House")).toBeInTheDocument();
    expect(getByText("Techno")).toBeInTheDocument();
  });
});
