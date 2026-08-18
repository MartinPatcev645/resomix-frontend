/**
 * coverImage
 * ==========
 *
 * The browser half of the playlist-cover pipeline. Two steps, both here so the three surfaces that
 * offer the edit flow (desktop hero, mobile hero, library rename modal) share one implementation:
 *
 *   1. `prepareForCrop(file)` — the ONLY step that touches the camera original. Downscales the
 *      longest side to `WORKING_MAX` and bakes in the JPEG EXIF orientation.
 *   2. `renderSquareCover(src, area)` — turns the user's crop selection into the exact square we
 *      store: `COVER_SIZE`×`COVER_SIZE` JPEG.
 *
 * Why a library instead of plain canvas
 * -------------------------------------
 * A phone photo is 24–48 MP — a plain iPhone shot is 4032×3024, the Pro's is 8064×6048. Decoding one
 * costs ~200 MB of bitmap, and iOS caps canvas/image memory at roughly device RAM / 4. Past that
 * Safari hands back a BLANK or subsampled image rather than throwing, so a naive `drawImage` of the
 * original yields black covers on exactly the phones this feature exists for.
 *
 * `pica` (through its `image-blob-reduce` wrapper) resizes in 1024 px tiles specifically to bound
 * peak memory, and auto-selects plain JS / WASM / web workers for the device. The native shortcut —
 * `createImageBitmap(file, { resizeWidth })` — is not usable: Safari silently ignores the resize
 * options, so it fails on the one browser we most need.
 *
 * Everything after step 1 works on the bounded image, never the original: the cropper renders a
 * ≤1600 px picture and the export canvas is smaller still. That is what keeps an old phone smooth.
 *
 * The library is loaded on demand (~19 KB gzipped) so it costs nothing until someone picks a cover.
 */

/** The stored cover is always exactly this many pixels square. */
export const COVER_SIZE = 500;

/** JPEG quality for the stored cover. Deliberately generous — a 500 px square is ~80 KB either way,
 *  so there is nothing to gain by compressing harder and visible detail to lose. */
const COVER_QUALITY = 0.92;

/** Longest side of the working image handed to the cropper. Large enough that the user can zoom in
 *  and still crop a region above `COVER_SIZE`, small enough to stay far inside every device's
 *  canvas budget. */
const WORKING_MAX = 1600;

/** Hard ceiling on the RAW picked file, mirroring Alwyzon's `_MAX_COVER_BYTES`. Generous on purpose:
 *  no phone photo comes close, and rejecting one for size is the bug we are fixing. */
export const MAX_COVER_BYTES = 15 * 1024 * 1024;

/** Structurally compatible with react-easy-crop's `Area`, declared here so this package does not
 *  depend on a UI library. Values are in the SOURCE image's pixels. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Reducer {
  toBlob(blob: Blob, options: { max: number }): Promise<Blob>;
  pica: PicaInstance;
}

interface PicaInstance {
  resize(from: HTMLCanvasElement | HTMLImageElement, to: HTMLCanvasElement): Promise<HTMLCanvasElement>;
  toBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob>;
}

let libPromise: Promise<Reducer> | null = null;

/**
 * Load pica + image-blob-reduce once, on first use.
 *
 * A failed dynamic import (offline, a stale chunk after a deploy) clears the cached promise so the
 * next attempt refetches rather than replaying the failure for the rest of the session.
 */
function loadImageLib(): Promise<Reducer> {
  if (!libPromise) {
    libPromise = import('image-blob-reduce')
      .then((mod) => {
        const factory = ((mod as unknown as { default?: unknown }).default ?? mod) as () => Reducer;
        return factory();
      })
      .catch((err) => {
        libPromise = null;
        throw err;
      });
  }
  return libPromise;
}

/** Decode an object URL into an `<img>`. Rejects when the browser cannot read the format. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode-failed'));
    img.src = src;
  });
}

/**
 * Downscale a freshly picked file to a working image for the cropper.
 *
 * Rejects when the browser cannot decode the format (e.g. a HEIC on Android, which has no HEIC
 * decoder) — the caller turns that into a message naming formats that do work.
 */
export async function prepareForCrop(file: File): Promise<Blob> {
  const reduce = await loadImageLib();
  // Called as a method, never destructured: `toBlob` is a class method that walks its own pipeline
  // through `this` (`this._blob_to_image`, `this.pica`, …), so pulling it off the instance detaches
  // it and it throws on the first internal call.
  return reduce.toBlob(file, { max: WORKING_MAX });
}

/**
 * Render the chosen crop region as the square JPEG we store.
 *
 * `imageSrc` must be an object URL of the blob from `prepareForCrop` — same-origin `blob:`, so the
 * canvas is never tainted and `toBlob` works.
 */
export async function renderSquareCover(imageSrc: string, area: CropArea): Promise<Blob> {
  const { pica } = await loadImageLib();
  const image = await loadImage(imageSrc);

  // react-easy-crop's aspect lock makes the region square already; `min` is belt-and-braces against
  // a sub-pixel rounding difference producing a 1 px-off rectangle.
  const side = Math.max(1, Math.round(Math.min(area.width, area.height)));

  const out = document.createElement('canvas');
  out.width = COVER_SIZE;
  out.height = COVER_SIZE;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('canvas-unavailable');
  // A transparent source (PNG/WebP with alpha) encodes as BLACK in a JPEG. Paint an opaque ground
  // first so a logo on transparency lands on white rather than a black square.
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, COVER_SIZE, COVER_SIZE);

  if (side <= COVER_SIZE) {
    // The selection is already at or below the target (the user zoomed right in). There is no detail
    // to preserve, so scale up directly — pica exists for the downscale case.
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(image, area.x, area.y, side, side, 0, 0, COVER_SIZE, COVER_SIZE);
  } else {
    // Lift the region out at its natural size, then let pica do the reduction. Its Lanczos filter
    // matters here: 1600 → 500 is a 3× step where plain canvas smoothing goes visibly soft.
    const cropped = document.createElement('canvas');
    cropped.width = side;
    cropped.height = side;
    const cropCtx = cropped.getContext('2d');
    if (!cropCtx) throw new Error('canvas-unavailable');
    cropCtx.fillStyle = '#ffffff';
    cropCtx.fillRect(0, 0, side, side);
    cropCtx.drawImage(image, area.x, area.y, side, side, 0, 0, side, side);
    await pica.resize(cropped, out);
    cropped.width = cropped.height = 0; // release the intermediate promptly — iOS is stingy
  }

  const blob = await pica.toBlob(out, 'image/jpeg', COVER_QUALITY);
  out.width = out.height = 0;
  return blob;
}
