import { describe, expect, it } from "vitest";
import { PLAYLIST_GRID_TEMPLATE_COLUMNS } from "@/utils/playlistGrid.ts";
import pixelsCss from "../styles/pixels.css?raw";

const definedPxTokens = new Set(
  [...pixelsCss.matchAll(/(--px-[\w.-]+):/g)].map((m) => m[1]),
);

describe("playlistGrid", () => {
  it("uses only defined --px-* tokens in the column template", () => {
    const tokens = [...PLAYLIST_GRID_TEMPLATE_COLUMNS.matchAll(/var\((--px-[\w.-]+)\)/g)].map((m) => m[1]);
    for (const token of tokens) {
      expect(definedPxTokens.has(token), `missing token ${token}`).toBe(true);
    }
  });
});
