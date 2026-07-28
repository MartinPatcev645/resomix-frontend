import React, { useCallback, useEffect, useState } from "react";
import { useTrackSimilarity, usePopularTracks, useResponsive, useUpload, useUploadStore } from "@resomix/hooks";
import type { SearchResult } from "@resomix/hooks";
import { useAuthStore } from "@resomix/stores";
import { BASE_LANDING_URL } from "@resomix/config";
import {
  SearchComponent,
  UploadComponent,
  SearchComponentMobile,
  UploadComponentMobile,
} from "@/components/index.ts";
import { displayArtistOrOmit } from "@/utils/trackUtils.ts";
import { savePlaylistAnalysis } from "@/utils/playlistAnalysis.ts";
import {
  SOURCE_TAB_SEARCH,
  SOURCE_TAB_UPLOAD,
  UPLOAD_OUTCOME_LINE,
  UPLOAD_PRIVACY_NOTE,
  FIND_SIMILAR_CTA,
} from "./workspaceCopy.ts";
import { ReferenceChip, type WorkspaceReference } from "./ReferenceChip.tsx";
import { DepthControl } from "./DepthControl.tsx";
import { DiscoveryProcessingPanel } from "./DiscoveryProcessingPanel.tsx";
import { DiscoveryEmptyGuide } from "./DiscoveryEmptyGuide.tsx";
import { WORKSPACE_PANEL_CLASS, WORKSPACE_STAGE_MIN_H, WORKSPACE_BTN_PRIMARY } from "./workspacePanelStyles.ts";
import { SubmitPendingGlyph, WorkspaceStage } from "./WorkspaceStage.tsx";
import {
  getDiscoveryCache,
  patchDiscoveryCache,
  clearDiscoveryReferenceCache,
} from "./workspaceStateCache.ts";
import { withViewTransition } from "@/utils/viewTransition.ts";

export const WorkspaceDiscoveryPanel: React.FC = () => {
  const cached = getDiscoveryCache();
  const [source, setSource] = useState<"search" | "upload">(cached.source);
  const [reference, setReference] = useState<WorkspaceReference | null>(cached.reference);
  const [catalogueTrackId, setCatalogueTrackId] = useState<string | null>(cached.catalogueTrackId);
  const [pendingUpload, setPendingUpload] = useState<File | null>(cached.pendingUpload);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { popularTracks } = usePopularTracks();
  const { isDesktop } = useResponsive();
  const { showOverlay, response, error, gateReason } = useUploadStore();

  const stageKey = isSubmitting
    ? "processing"
    : reference
      ? "reference"
      : source === "search"
        ? "search"
        : "upload";

  useEffect(() => {
    patchDiscoveryCache({ source, reference, catalogueTrackId, pendingUpload });
  }, [source, reference, catalogueTrackId, pendingUpload]);

  const onAnalysis = useCallback(
    (playlistId: string, stats: Parameters<typeof savePlaylistAnalysis>[1]) => {
      savePlaylistAnalysis(playlistId, stats);
    },
    [],
  );

  const { handleSelectTrack } = useTrackSimilarity({ onAnalysis });
  const { handleUpload } = useUpload({ onAnalysis });

  useEffect(() => {
    if (showOverlay) {
      useUploadStore.getState().setOverlay(false);
    }
  }, [showOverlay]);

  useEffect(() => {
    if (response?.success || error || gateReason) {
      setIsSubmitting(false);
    }
  }, [response, error, gateReason]);

  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  useEffect(() => {
    if (!sessionExpired) return;
    setIsSubmitting(false);
    const upload = useUploadStore.getState();
    upload.setGateReason(null);
    upload.setError(null);
  }, [sessionExpired]);

  // "Change" — drop the selected reference but KEEP the search results, so the user returns to the
  // same result list to pick a different track.
  const clearReference = () => {
    clearDiscoveryReferenceCache();
    setReference(null);
    setCatalogueTrackId(null);
    setPendingUpload(null);
    setIsSubmitting(false);
  };

  // Reset the search field + results to empty (a "fresh" search screen).
  const clearSearchState = () => {
    patchDiscoveryCache({ searchQuery: "", searchResults: [] });
  };

  // "Cancel" — fully abandon the selection and land on a fresh search screen.
  const cancelReference = () => {
    withViewTransition(() => {
      clearReference();
      clearSearchState();
      setSource("search");
    });
  };

  // Switching tabs unselects any preview AND resets the search, so the destination (and a later
  // return) is always a fresh screen — not the stale preview/results. Fixes the bug where clicking
  // Upload while a track was selected changed the tab but not the view (the preview took priority).
  const switchSource = (next: "search" | "upload") => {
    if (next === source) return;
    withViewTransition(() => {
      clearReference();
      clearSearchState();
      setSource(next);
    });
  };

  const onCatalogueSelect = (track: SearchResult) => {
    setCatalogueTrackId(String(track.id));
    setPendingUpload(null);
    setReference({
      title: track.title,
      artist: displayArtistOrOmit(track.artist),
      duration: track.duration,
      source: "catalogue",
      detail: "Catalogue track",
    });
  };

  const onUploadSelected = (file: File) => {
    setPendingUpload(file);
    setCatalogueTrackId(null);
    setReference({
      title: file.name.replace(/\.[^.]+$/, ""),
      source: "upload",
      detail: file.name,
    });
  };

  const tryExample = () => {
    const first = popularTracks[0];
    if (first) onCatalogueSelect(first);
  };

  const submitDiscovery = async () => {
    if (!reference || isSubmitting) return;
    setIsSubmitting(true);

    if (catalogueTrackId) {
      await handleSelectTrack(catalogueTrackId);
      return;
    }

    if (pendingUpload) {
      await handleUpload(pendingUpload);
    }
  };

  const showProcessing = isSubmitting;
  const showEmptyGuide = !showProcessing && !reference && source === "search";

  return (
    <section
      className={[WORKSPACE_PANEL_CLASS, WORKSPACE_STAGE_MIN_H, "px-0 pt-0"].join(" ")}
      aria-labelledby="workspace-discovery-heading"
    >
      <h2 id="workspace-discovery-heading" className="sr-only">
        Find similar tracks
      </h2>

      <WorkspaceStage stageKey={stageKey}>
        {!showProcessing && (
          <div
            className="flex w-full overflow-hidden border border-[var(--rx-color-border-default)] max-[640px]:grid max-[640px]:grid-cols-2"
            role="tablist"
            aria-label="Reference source"
          >
            <SourceTab
              selected={source === "search"}
              onClick={() => switchSource("search")}
              label={SOURCE_TAB_SEARCH}
            />
            <SourceTab
              selected={source === "upload"}
              onClick={() => switchSource("upload")}
              label={SOURCE_TAB_UPLOAD}
            />
          </div>
        )}

        <div className={showProcessing ? "p-[var(--px-22)]" : "px-[var(--px-22)] pb-[var(--px-8)]"}>
        {showProcessing ? (
          <DiscoveryProcessingPanel />
        ) : reference ? (
          <div className="space-y-[var(--px-16)] pt-[var(--px-18)]">
            <ReferenceChip reference={reference} onCancel={cancelReference} />
            <div className="flex flex-wrap items-end justify-between gap-[var(--px-12)]">
              <DepthControl />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void submitDiscovery()}
                className={WORKSPACE_BTN_PRIMARY}
              >
                {FIND_SIMILAR_CTA}
                {isSubmitting ? <SubmitPendingGlyph /> : null}
              </button>
            </div>
          </div>
        ) : source === "search" ? (
          <div>
            {isDesktop ? (
              <SearchComponent
                variant="workspace"
                hideSourceTabs
                onUploadClick={() => switchSource("upload")}
                onTrackSelect={onCatalogueSelect}
              />
            ) : (
              <SearchComponentMobile
                variant="workspace"
                hideSourceTabs
                onUploadClick={() => switchSource("upload")}
                onTrackSelect={onCatalogueSelect}
              />
            )}
            {showEmptyGuide && (
              <DiscoveryEmptyGuide
                examples={popularTracks}
                onTryExample={tryExample}
                onSelectExample={onCatalogueSelect}
              />
            )}
          </div>
        ) : (
          <div className="pb-[var(--px-8)] pt-[var(--px-8)]">
            <p className="mb-[var(--px-18)] text-[length:var(--px-16)] font-helvetica font-light leading-[var(--px-24)] text-[var(--rx-color-text-secondary)]">
              {UPLOAD_OUTCOME_LINE}
            </p>
            {isDesktop ? (
              <UploadComponent
                variant="workspace"
                hideSourceTabs
                deferSubmit
                onFileSelected={onUploadSelected}
                onSearchClick={() => switchSource("search")}
                onAnalysis={onAnalysis}
              />
            ) : (
              <UploadComponentMobile
                variant="workspace"
                hideSourceTabs
                deferSubmit
                onFileSelected={onUploadSelected}
                onSearchClick={() => switchSource("search")}
                onAnalysis={onAnalysis}
              />
            )}
            <p className="mt-[var(--px-14)] text-[length:var(--px-12)] font-helvetica font-light leading-[var(--px-18)] text-[var(--rx-color-text-muted)]">
              {UPLOAD_PRIVACY_NOTE}{" "}
              <a
                href={`${BASE_LANDING_URL}/trust`}
                className="underline underline-offset-[var(--px-3)]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Trust, Rights &amp; Security
              </a>{" "}
              ·{" "}
              <a
                href={`${BASE_LANDING_URL}/trust#privacy`}
                className="underline underline-offset-[var(--px-3)]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
            </p>
          </div>
        )}
        </div>
      </WorkspaceStage>
    </section>
  );
};

const SourceTab: React.FC<{ selected: boolean; label: string; onClick: () => void }> = ({
  selected,
  label,
  onClick,
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={selected}
    onClick={onClick}
    className={[
      "ws-focus-ring min-h-[var(--px-44)] shrink-0 border-r border-[var(--rx-color-border-subtle)] px-[var(--px-24)] py-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] transition-[background-color,color,box-shadow] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)] last:border-r-0 max-[640px]:px-[var(--px-8)] max-[640px]:text-center",
      selected
        ? "bg-[var(--rx-color-overlay)] text-[var(--rx-color-text-primary)] shadow-[inset_0_-2px_0_0_var(--rx-color-accent)]"
        : "text-[var(--rx-color-text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--rx-color-text-primary)]",
    ].join(" ")}
  >
    {label}
  </button>
);
