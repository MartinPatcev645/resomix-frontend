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

/** Scroll the working panel top into view only when it sits above the viewport. */
export function scrollWorkspacePanelIntoView(panelId = "workspace-active-panel"): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(panelId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.top > window.innerHeight * 0.35) {
      el.scrollIntoView({ block: "start", behavior: "auto" });
    }
  });
}
