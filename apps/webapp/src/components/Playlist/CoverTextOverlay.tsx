import React from "react";

/**
 * CoverTextOverlay
 * ================
 *
 * A display-only HTML5 canvas that draws the playlist title CENTERED on top of the cover image
 * (the parent must be `position: relative`; this canvas fills it and is `pointer-events-none`, so
 * clicks pass through to the image / pen). It never touches or uploads the image — it only paints
 * a text layer over whatever cover the parent already renders (custom → seed → default). The parent
 * gates it via `active` (set true once the cover image has loaded) so text never flashes over a
 * blank state.
 *
 * Robustness (works on desktop, mobile, low-end devices, older browsers):
 *   • Auto-sizes the font to the title length — short titles get large text, long titles shrink and
 *     wrap (then ellipsis-truncate) to fit. Sizes are relative to the measured cover, so it adapts
 *     to any cover dimension.
 *   • A semi-transparent rounded scrim + text shadow keep the title legible over ANY cover colour.
 *   • Retina-crisp via devicePixelRatio (clamped to 3 so low-end GPUs aren't over-taxed).
 *   • Redraws on title change, container resize (ResizeObserver with a window-resize fallback), and
 *     once web fonts settle. All drawing is throttled to one animation frame.
 *   • Skips drawing entirely below `minWidth` px (default 80) — a title is illegible on a tiny
 *     thumbnail (e.g. the 50px mobile hero cover), so it cleanly no-ops there instead of cramming
 *     unreadable text. Only canvas 2D + arcTo are used, which are supported essentially everywhere.
 */

export interface CoverTextOverlayProps {
  /** The title to render (e.g. the playlist name). Empty/blank draws nothing. */
  text?: string | null;
  /** Only paint once the underlying cover image has loaded. */
  active?: boolean;
  /** Below this measured CSS width (px) the overlay is skipped (too small to be legible). */
  minWidth?: number;
  className?: string;
}

// Always-available system stack (matches the app's Helvetica-forward look) — no web-font load race.
const FONT_STACK = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_WEIGHT = 700;

/** Old-browser-safe rounded rectangle (arcTo is universally supported; roundRect is not). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Greedy word-wrap for the current ctx.font; hard-breaks any single word too wide for a line. */
function wrapLines(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";

  const breakWord = (word: string): string => {
    let chunk = "";
    for (const ch of word) {
      if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk; // remainder continues as the new current line
  };

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = "";
      }
      current = ctx.measureText(word).width <= maxWidth ? word : breakWord(word);
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface Layout {
  fontSize: number;
  lineHeight: number;
  lines: string[];
}

/** Pick the largest font (within a size-relative range) whose wrapped title fits width + height. */
function computeLayout(ctx: CanvasRenderingContext2D, text: string, W: number, H: number): Layout {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const maxWidth = W * 0.8;
  const maxHeight = H * 0.66;
  const maxFont = Math.max(9, Math.round(W * 0.15));
  const minFont = Math.max(6, Math.round(W * 0.075));

  for (let fs = maxFont; fs >= minFont; fs--) {
    ctx.font = `${FONT_WEIGHT} ${fs}px ${FONT_STACK}`;
    const lineHeight = fs * 1.18;
    const lines = wrapLines(ctx, words, maxWidth);
    const fitsHeight = lines.length * lineHeight <= maxHeight;
    const fitsWidth = lines.every((l) => ctx.measureText(l).width <= maxWidth + 0.5);
    if (fitsHeight && fitsWidth) return { fontSize: fs, lineHeight, lines };
  }

  // Nothing fit — use the smallest font and ellipsis-truncate to the available height.
  ctx.font = `${FONT_WEIGHT} ${minFont}px ${FONT_STACK}`;
  const lineHeight = minFont * 1.18;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  let lines = wrapLines(ctx, words, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = (last + "…").trim();
  }
  return { fontSize: minFont, lineHeight, lines };
}

function paint(canvas: HTMLCanvasElement, text: string, active: boolean, minWidth: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Measure the on-screen size (canvas fills the parent via w-full/h-full).
  let rect = canvas.getBoundingClientRect();
  let W = Math.round(rect.width);
  let H = Math.round(rect.height);
  if ((!W || !H) && canvas.parentElement) {
    rect = canvas.parentElement.getBoundingClientRect();
    W = Math.round(rect.width);
    H = Math.round(rect.height);
  }
  if (!W || !H) return;

  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (!active || W < minWidth || !text || !text.trim()) return;

  const { fontSize, lineHeight, lines } = computeLayout(ctx, text, W, H);
  ctx.font = `${FONT_WEIGHT} ${fontSize}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let maxLineW = 0;
  for (const line of lines) maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
  const blockH = lines.length * lineHeight;
  const padX = fontSize * 0.7;
  const padY = fontSize * 0.5;
  const scrimW = Math.min(W, maxLineW + padX * 2);
  const scrimH = Math.min(H, blockH + padY * 2);
  const cx = W / 2;
  const cy = H / 2;

  // Scrim: legibility over any cover colour.
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRectPath(ctx, cx - scrimW / 2, cy - scrimH / 2, scrimW, scrimH, Math.min(scrimW, scrimH) * 0.12);
  ctx.fill();

  // Title.
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.max(1, fontSize * 0.12);
  ctx.shadowOffsetY = Math.max(1, fontSize * 0.04);
  const firstY = cy - blockH / 2 + lineHeight / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, firstY + i * lineHeight));
  // Reset shadow so it never bleeds into a later draw.
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

export const CoverTextOverlay: React.FC<CoverTextOverlayProps> = ({
  text,
  active = true,
  minWidth = 80,
  className,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const raf =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 16);
    const caf =
      typeof window.cancelAnimationFrame === "function"
        ? window.cancelAnimationFrame.bind(window)
        : (id: number) => window.clearTimeout(id);

    let handle = 0;
    const schedule = () => {
      if (handle) return;
      handle = raf(() => {
        handle = 0;
        paint(canvas, text || "", active, minWidth);
      });
    };

    schedule();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      if (canvas.parentElement) ro.observe(canvas.parentElement);
    }
    window.addEventListener("resize", schedule);

    // Redraw once web fonts settle (in case a fallback measured differently first).
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts && fonts.ready && typeof fonts.ready.then === "function") {
      fonts.ready.then(schedule).catch(() => {});
    }

    return () => {
      if (handle) caf(handle);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [text, active, minWidth]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
};

export default CoverTextOverlay;
