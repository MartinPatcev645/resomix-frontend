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
  TRY_EXAMPLE_ACTION,
  TRY_EXAMPLE_HINT,
  UPLOAD_PRIVACY_NOTE,
  FIND_SIMILAR_CTA,
} from "./workspaceCopy.ts";
import { ReferenceChip, type WorkspaceReference } from "./ReferenceChip.tsx";
import { DepthControl } from "./DepthControl.tsx";
import { DiscoveryProcessingPanel } from "./DiscoveryProcessingPanel.tsx";
import { WORKSPACE_PANEL_CLASS, WORKSPACE_STAGE_MIN_H } from "./workspacePanelStyles.ts";
import { SubmitPendingGlyph, WorkspaceStage } from "./WorkspaceStage.tsx";
import {
  getDiscoveryCache,
  patchDiscoveryCache,
  clearDiscoveryReferenceCache,
} from "./workspaceStateCache.ts";

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

  const clearReference = () => {
    clearDiscoveryReferenceCache();
    setReference(null);
    setCatalogueTrackId(null);
    setPendingUpload(null);
    setIsSubmitting(false);
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

  return (
    <section
      className={[WORKSPACE_PANEL_CLASS, WORKSPACE_STAGE_MIN_H].join(" ")}
      aria-labelledby="workspace-discovery-heading"
    >
      <h2 id="workspace-discovery-heading" className="sr-only">
        Find similar tracks
      </h2>

      <WorkspaceStage stageKey={stageKey}>
        {!showProcessing && (
          <div className="mb-[var(--px-18)] flex flex-wrap gap-[var(--px-6)]" role="tablist" aria-label="Reference source">
            <SourceTab
              selected={source === "search"}
              onClick={() => setSource("search")}
              label={SOURCE_TAB_SEARCH}
            />
            <SourceTab
              selected={source === "upload"}
              onClick={() => setSource("upload")}
              label={SOURCE_TAB_UPLOAD}
            />
          </div>
        )}

        {showProcessing ? (
          <DiscoveryProcessingPanel />
        ) : reference ? (
          <div className="space-y-[var(--px-16)]">
            <ReferenceChip reference={reference} onChange={clearReference} />
            <div className="flex flex-wrap items-end justify-between gap-[var(--px-12)]">
              <DepthControl />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void submitDiscovery()}
                className="inline-flex min-h-[var(--px-44)] items-center justify-center rounded-full bg-[var(--color-primary)] px-[var(--px-22)] font-fira text-[length:var(--px-12)] font-medium uppercase tracking-[var(--px-2)] text-[var(--color-text-primary,#000)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
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
                onUploadClick={() => setSource("upload")}
                onTrackSelect={onCatalogueSelect}
              />
            ) : (
              <SearchComponentMobile
                variant="workspace"
                hideSourceTabs
                onUploadClick={() => setSource("upload")}
                onTrackSelect={onCatalogueSelect}
              />
            )}
            <p className="mt-[var(--px-12)] font-fira text-[length:var(--px-12)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60">
              {TRY_EXAMPLE_HINT}{" "}
              <button
                type="button"
                className="underline underline-offset-[var(--px-3)] opacity-80 hover:opacity-100"
                onClick={tryExample}
              >
                {TRY_EXAMPLE_ACTION}
              </button>
            </p>
          </div>
        ) : (
          <div>
            {isDesktop ? (
              <UploadComponent
                variant="workspace"
                hideSourceTabs
                deferSubmit
                onFileSelected={onUploadSelected}
                onSearchClick={() => setSource("search")}
                onAnalysis={onAnalysis}
              />
            ) : (
              <UploadComponentMobile
                variant="workspace"
                hideSourceTabs
                deferSubmit
                onFileSelected={onUploadSelected}
                onSearchClick={() => setSource("search")}
                onAnalysis={onAnalysis}
              />
            )}
            <p className="mt-[var(--px-14)] text-[length:var(--px-12)] font-helvetica font-light leading-[var(--px-18)] opacity-70">
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
      "min-h-[var(--px-44)] border px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] transition-colors",
      selected
        ? "border-slate-200 bg-[rgba(255,255,255,.04)] text-[var(--color-primary)] before:text-[var(--color-accent,#EE4A26)] before:content-['▸\\00a0']"
        : "border-transparent text-[var(--color-primary)] opacity-50 hover:opacity-80",
    ].join(" ")}
  >
    {label}
  </button>
);
