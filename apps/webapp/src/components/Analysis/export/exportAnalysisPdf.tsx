import type React from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { analysisExportFontCss } from "./exportFonts.ts";
import { paginate, type MeasuredBlock } from "./paginate.ts";
import { buildExportBlocks, trackFacts, type ExportMeta } from "./ExportDocument.tsx";
import { Flow, Settle, Sheets } from "./ExportStage.tsx";
import {
  CAPTURE_SCALE,
  CONTENT_H,
  PAGE_BG,
  PAGE_H,
  PAGE_H_PT,
  PAGE_W,
  PAGE_W_PT,
  PX_TO_PT,
  pinnedTokenCss,
} from "./exportTheme.ts";

/**
 * Export the analysis as a PDF, in one click.
 *
 * The document is built in a hidden DOM tree, photographed page by page and assembled with jsPDF,
 * all in the browser. That is the only route that both downloads on a click (the print dialog is
 * not a download, and a server-rendered PDF is a service we would have to run) and keeps the sheet
 * looking like the page, since what is photographed IS the page's own components with the page's
 * own fonts and colours. The cost is that the body text is an image rather than selectable glyphs;
 * the two hyperlinks on the cover are added back as real PDF links so the document is still
 * clickable where it matters.
 *
 * Nothing here touches the live dashboard. The hidden tree is its own React root, mounted for the
 * length of the export and removed in a `finally`.
 */

const HOST_ID = "resomix-analysis-export";

/** PNG keeps the charts and the small type clean. JPEG would halve the file and ring around text. */
const IMAGE_FORMAT = "PNG";

export interface ExportPdfOptions {
  landingUrl: string;
  betaUrl: string;
  /** Called with each stage, for the button's label. */
  onStage?: (stage: "building" | "drawing" | "saving") => void;
}

export async function exportAnalysisPdf(data: AnalysisData, options: ExportPdfOptions): Promise<void> {
  const facts = trackFacts(data.identity.filename);
  const meta: ExportMeta = {
    facts,
    exportedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    landingUrl: options.landingUrl,
    betaUrl: options.betaUrl,
  };
  const blocks = buildExportBlocks(data, meta);
  const documentTitle = facts.artist ? `${facts.artist} · ${facts.title}` : facts.title;

  options.onStage?.("building");

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("aria-hidden", "true");
  // Laid out and painted, but far off-screen: `display:none` or `visibility:hidden` would leave
  // every canvas in the document blank, since nothing would ever draw.
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${PAGE_W}px`,
    transform: "translateX(-200vw)",
    zIndex: "-1",
    pointerEvents: "none",
    background: PAGE_BG,
  } as Partial<CSSStyleDeclaration>);

  const tokens = document.createElement("style");
  tokens.textContent = pinnedTokenCss(`#${HOST_ID}`);
  host.appendChild(tokens);

  const mount = document.createElement("div");
  mount.style.width = `${PAGE_W}px`;
  host.appendChild(mount);
  document.body.appendChild(host);

  const root = createRoot(mount);

  try {
    // Pass one: the whole document in one column at content width, to measure every block.
    await renderSettled(root, <Flow blocks={blocks} />);
    const measured: MeasuredBlock[] = blocks.map((b) => ({
      id: b.id,
      breakBefore: b.breakBefore,
      height: blockHeight(mount, b.id),
    }));
    const plan = paginate(measured, CONTENT_H);

    // Pass two: the same blocks, dealt onto sheets.
    await renderSettled(root, <Sheets plan={plan} blocks={blocks} title={documentTitle} />);

    options.onStage?.("drawing");
    const pageEls = Array.from(mount.querySelectorAll<HTMLElement>("[data-export-page]"));
    const fontEmbedCSS = await analysisExportFontCss();
    const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

    // A capture draws the page into an <img> from an SVG data URL, and on the first one of a
    // session the browser can hand it back before the embedded fonts and images are ready — the
    // well-known "first shot comes out blank". One throwaway pass warms that up; every capture
    // after it is complete.
    if (pageEls.length) {
      await toCanvas(pageEls[0], { pixelRatio: 1, backgroundColor: PAGE_BG, fontEmbedCSS, cacheBust: false });
    }

    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
    for (let i = 0; i < pageEls.length; i++) {
      const el = pageEls[i];
      const canvas = await toCanvas(el, {
        pixelRatio: CAPTURE_SCALE,
        backgroundColor: PAGE_BG,
        width: PAGE_W,
        height: PAGE_H,
        fontEmbedCSS,
        cacheBust: false,
      });
      if (i > 0) doc.addPage("a4", "portrait");
      doc.addImage(canvas, IMAGE_FORMAT, 0, 0, PAGE_W_PT, PAGE_H_PT, `page-${i}`, "NONE");
      addLinks(doc, el);
    }

    options.onStage?.("saving");
    doc.save(pdfFilename(documentTitle));
  } finally {
    root.unmount();
    host.remove();
  }
}

/* ------------------------------------------------------------------ plumbing */

/** Resolves once React has committed AND the browser has had two frames to lay out and paint. */
function renderSettled(root: Root, node: React.ReactNode): Promise<void> {
  return new Promise<void>((resolve) => {
    root.render(<Settle onMounted={() => void afterPaint().then(resolve)}>{node}</Settle>);
  });
}

async function afterPaint(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  try {
    await document.fonts.ready;
  } catch {
    /* no font loading API — the capture falls back to the system stack */
  }
  await new Promise<void>((r) => setTimeout(r, 40));
}

function blockHeight(mount: HTMLElement, id: string): number {
  const el = mount.querySelector<HTMLElement>(`[data-export-block="${CSS.escape(id)}"]`);
  return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
}

/**
 * The cover's two hyperlinks, as real PDF links over the rendered text.
 *
 * jsPDF places them by rectangle, so the coordinates come from the live DOM: the anchor's box
 * relative to its page, converted from CSS pixels to points.
 */
function addLinks(doc: { link: (x: number, y: number, w: number, h: number, options: unknown) => void }, page: HTMLElement): void {
  const pageBox = page.getBoundingClientRect();
  page.querySelectorAll<HTMLAnchorElement>("a[data-pdf-link][href]").forEach((a) => {
    const box = a.getBoundingClientRect();
    if (!box.width || !box.height) return;
    doc.link(
      (box.left - pageBox.left) * PX_TO_PT,
      (box.top - pageBox.top) * PX_TO_PT,
      box.width * PX_TO_PT,
      box.height * PX_TO_PT,
      { url: a.href },
    );
  });
}

/** A filename a DJ can find again, without the characters a filesystem will not take. */
export function pdfFilename(documentTitle: string): string {
  const safe = documentTitle
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${safe || "Track"} - Resomix analysis.pdf`;
}
