import { encode } from "fast-png";
import type { Matrix } from "@/pages/analysis/data.ts";
import { blend, C, colormap, type RGB } from "./pdfTheme.ts";

/**
 * The two pictures in the document that are genuinely pixels.
 *
 * Everything else the export draws is vector, but a spectrogram and a chromagram are dense grids
 * of measured values and there is nothing to gain from turning a hundred thousand cells into a
 * hundred thousand rectangles. They are encoded straight to PNG in JavaScript rather than through
 * a canvas, so the export needs no DOM at all: the same code runs in a browser, in a test and on a
 * phone, and cannot be defeated by a canvas the browser declines to give us.
 *
 * The maths mirrors `Heatmap` and `SpectrogramView` in heatviz.tsx, including the ramp, the dB
 * window and the mel-to-linear resample. If one of those changes, change it here too.
 */

/** Wider than this buys nothing at A4 and costs encode time. */
const MAX_COLS = 1800;
/** Display window in dB below the peak, as on screen. */
const DB_RANGE = 120;
const hzToMel = (f: number) => 2595 * Math.log10(1 + f / 700);

export interface Png {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Column indices to sample, so a long track does not encode more pixels than the page can show. */
function columnMap(cols: number): number[] {
  if (cols <= MAX_COLS) return Array.from({ length: cols }, (_, i) => i);
  return Array.from({ length: MAX_COLS }, (_, i) => Math.min(cols - 1, Math.round((i * (cols - 1)) / (MAX_COLS - 1))));
}

function png(width: number, height: number, rgb: Uint8Array): Png {
  return { data: encode({ width, height, data: rgb, channels: 3, depth: 8 }), width, height };
}

/**
 * The spectrogram, low frequency at the bottom.
 *
 * A linear-frequency result is drawn bin for bin. The older mel-banded results are resampled onto
 * a linear axis first, exactly as the page does, so the printed frequency labels are honest.
 */
export function spectrogramPng(matrix: Matrix | null | undefined, sampleRateHz: number, linear: boolean): Png | null {
  const rows = matrix?.data?.length ?? 0;
  const cols = rows ? matrix!.data[0].length : 0;
  if (!rows || !cols) return null;
  const data = matrix!.data;

  let max = -Infinity;
  for (const row of data) for (const v of row) if (v > max) max = v;
  if (!Number.isFinite(max)) return null;
  const floor = max - DB_RANGE;

  const map = columnMap(cols);
  const w = map.length;

  if (linear) {
    const out = new Uint8Array(w * rows * 3);
    for (let r = 0; r < rows; r++) {
      const yr = rows - 1 - r; // low frequency at the bottom
      const row = data[r];
      for (let c = 0; c < w; c++) {
        const [rr, gg, bb] = colormap((row[map[c]] - floor) / DB_RANGE);
        const o = (yr * w + c) * 3;
        out[o] = rr;
        out[o + 1] = gg;
        out[o + 2] = bb;
      }
    }
    return png(w, rows, out);
  }

  const fmaxHz = sampleRateHz > 0 ? sampleRateHz / 2 : 22050;
  const melMaxHz = hzToMel(fmaxHz) || 1;
  const OUT = 256;
  const out = new Uint8Array(w * OUT * 3);
  for (let y = 0; y < OUT; y++) {
    const f = fmaxHz * (1 - y / (OUT - 1));
    const bp = (hzToMel(f) / melMaxHz) * (rows - 1);
    const b0 = Math.max(0, Math.min(rows - 1, Math.floor(bp)));
    const b1 = Math.min(rows - 1, b0 + 1);
    const t = bp - b0;
    const row0 = data[b0];
    const row1 = data[b1];
    for (let c = 0; c < w; c++) {
      const i = map[c];
      const v = row0[i] * (1 - t) + row1[i] * t;
      const [rr, gg, bb] = colormap((v - floor) / DB_RANGE);
      const o = (y * w + c) * 3;
      out[o] = rr;
      out[o + 1] = gg;
      out[o + 2] = bb;
    }
  }
  return png(w, OUT, out);
}

/**
 * The chromagram in one hue, low pitch class at the bottom.
 *
 * Each of the twelve rows is drawn `ROW_PX` pixels tall so the image is scaled DOWN onto the page
 * rather than up. A twelve-pixel-tall image stretched across a lane comes out of a PDF viewer
 * smeared, because there is no pixelated rendering hint to give it.
 */
const ROW_PX = 8;

export function chromaPng(matrix: Matrix | null | undefined, tint: RGB = C.pitch): Png | null {
  const rows = matrix?.data?.length ?? 0;
  const cols = rows ? matrix!.data[0].length : 0;
  if (!rows || !cols) return null;
  const data = matrix!.data;

  let min = Infinity;
  let max = -Infinity;
  for (const row of data) for (const v of row) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const span = max - min || 1;

  const map = columnMap(cols);
  const w = map.length;
  const h = rows * ROW_PX;
  const out = new Uint8Array(w * h * 3);
  for (let r = 0; r < rows; r++) {
    const yr = rows - 1 - r; // low pitch class at the bottom
    const row = data[r];
    for (let c = 0; c < w; c++) {
      const v = Math.max(0, Math.min(1, (row[map[c]] - min) / span));
      const [rr, gg, bb] = blend(tint, C.lane, v);
      for (let k = 0; k < ROW_PX; k++) {
        const o = ((yr * ROW_PX + k) * w + c) * 3;
        out[o] = rr;
        out[o + 1] = gg;
        out[o + 2] = bb;
      }
    }
  }
  return png(w, h, out);
}
