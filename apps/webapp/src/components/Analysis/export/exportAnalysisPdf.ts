import type { AnalysisData } from "@/pages/analysis/data.ts";
import { buildAnalysisPdf, trackFacts } from "./buildAnalysisPdf.ts";

/**
 * Build the document and hand it to the browser as a download.
 *
 * The writer itself is loaded on the click rather than with the page, since nobody who does not
 * press this should pay for it. Everything after that is arithmetic, so the whole export is a few
 * hundred milliseconds and behaves the same on a phone as on a desktop.
 */

export interface ExportPdfOptions {
  landingUrl: string;
  betaUrl: string;
}

/** Builds the document, hands it to the browser, and returns the filename it was saved as. */
export async function exportAnalysisPdf(data: AnalysisData, options: ExportPdfOptions): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const makeDoc = () => new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });

  const facts = trackFacts(data.identity.filename);
  const doc = buildAnalysisPdf(makeDoc, data, {
    exportedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    landingUrl: options.landingUrl,
    betaUrl: options.betaUrl,
  });

  const filename = pdfFilename(facts.artist ? `${facts.artist} · ${facts.title}` : facts.title);
  // `returnPromise` so a browser that hands the file over asynchronously (iOS opens it rather
  // than downloading it) reports a failure here instead of looking like it worked.
  await doc.save(filename, { returnPromise: true });
  return filename;
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
