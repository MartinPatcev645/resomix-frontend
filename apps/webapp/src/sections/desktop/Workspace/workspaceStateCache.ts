import type { SearchResult } from "@resomix/hooks";
import type { WorkspaceReference } from "@/sections/desktop/Workspace/ReferenceChip.tsx";

export interface DiscoveryPanelCache {
  source: "search" | "upload";
  reference: WorkspaceReference | null;
  catalogueTrackId: string | null;
  pendingUpload: File | null;
  searchQuery: string;
  searchResults: SearchResult[];
  searchMode: string;
}

export interface AnalysisPanelCache {
  pendingFile: File | null;
}

const discoveryCache: DiscoveryPanelCache = {
  source: "search",
  reference: null,
  catalogueTrackId: null,
  pendingUpload: null,
  searchQuery: "",
  searchResults: [],
  searchMode: "auto",
};

const analysisCache: AnalysisPanelCache = {
  pendingFile: null,
};

export function getDiscoveryCache(): DiscoveryPanelCache {
  return discoveryCache;
}

export function patchDiscoveryCache(patch: Partial<DiscoveryPanelCache>): void {
  Object.assign(discoveryCache, patch);
}

export function getAnalysisCache(): AnalysisPanelCache {
  return analysisCache;
}

export function patchAnalysisCache(patch: Partial<AnalysisPanelCache>): void {
  Object.assign(analysisCache, patch);
}

export function clearDiscoveryReferenceCache(): void {
  discoveryCache.reference = null;
  discoveryCache.catalogueTrackId = null;
  discoveryCache.pendingUpload = null;
}

export function clearAnalysisCache(): void {
  analysisCache.pendingFile = null;
}

/**
 * Bring the active workspace panel into view after a mode switch (Analyse ⇄ Similarity) or a
 * stage change. Behaviour is identical on desktop and mobile (they share WorkspaceStage):
 *
 *   • If the panel is already fully on screen, do nothing — never nudge a settled view.
 *   • Otherwise smoothly scroll just enough to reveal it. A short panel settles in the lower
 *     part of the viewport so the mode cards above stay in context ("even if at the bottom");
 *     a tall panel aligns to the top so as much as possible shows. Its top never lands past
 *     the top edge.
 *
 * Always a smooth glide so switching tasks never feels jumpy (the old auto/​block:"start" call
 * slammed the page and, combined with WebLayout's scrollTo(0,0), read as a mid-screen jump on
 * mobile). Respects prefers-reduced-motion (instant jump). Two rAFs let the route remount and
 * WebLayout's top-reset settle before we measure.
 */
export function scrollWorkspacePanelIntoView(panelId = "workspace-active-panel"): void {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(panelId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const fullyVisible = rect.top >= 0 && rect.bottom <= vh;
      if (fullyVisible) return;
      // Where the panel's top should rest inside the viewport: leave context above it when the
      // panel is short enough to fit lower down, but never push its top off the top edge.
      const restingOffset = Math.min(vh * 0.55, Math.max(0, vh - rect.height));
      const targetY = Math.max(0, window.scrollY + rect.top - restingOffset);
      window.scrollTo({ top: targetY - 80, behavior: reduce ? "auto" : "smooth" });
    });
  });
}

/** Clearance for the sticky navbar so the target does not land underneath it. */
const STICKY_NAV_CLEARANCE = 80;

/**
 * Re-anchor the panel after choosing a reference.
 *
 * Picking a track swaps a long results list for a short reference preview, so the document gets
 * dramatically shorter in one frame. The browser clamps the existing scroll position to the new
 * document height, and on mobile — where the list is tall and the user has scrolled well into it —
 * that clamp lands them on the footer, with the track they just chose somewhere far above.
 *
 * Different intent from `scrollWorkspacePanelIntoView`, which deliberately leaves context ABOVE a
 * short panel to reveal it after a task switch. Here the panel IS the context: the source tabs and
 * the chosen track need to be the first thing on screen, so this aligns to the top instead.
 *
 * No-op when the panel top is already comfortably in view, so a desktop layout that never collapses
 * is left alone. Two rAFs so the collapse has actually reflowed before we measure it.
 */
export function scrollWorkspacePanelToTop(panelId = "workspace-active-panel"): void {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(panelId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Already sitting in the upper part of the viewport → the user can see it; don't nudge.
      if (rect.top >= 0 && rect.top <= window.innerHeight * 0.35) return;
      const targetY = Math.max(0, window.scrollY + rect.top - STICKY_NAV_CLEARANCE);
      window.scrollTo({ top: targetY, behavior: reduce ? "auto" : "smooth" });
    });
  });
}
