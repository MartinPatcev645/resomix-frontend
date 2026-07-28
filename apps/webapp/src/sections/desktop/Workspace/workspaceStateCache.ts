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
 * Recover the working panel into view when it is off-screen:
 * scrolled past (top above viewport) or fully below the fold.
 * Do not scroll when the panel is already visible — its natural resting
 * position under the mode cards sits past 35% of many viewports, and the
 * old threshold jumped the page on every WorkspaceStage remount/mode switch.
 */
export function scrollWorkspacePanelIntoView(panelId = "workspace-active-panel"): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(panelId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.top > window.innerHeight) {
      el.scrollIntoView({ block: "start", behavior: "auto" });
    }
  });
}
