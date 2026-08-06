import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatusMessage } from "@resomix/ui";
import { useUploadStore, useTrackSimilarity } from "@resomix/hooks";
import { useAuthStore, usePlaylistStore } from "@resomix/stores";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import { claimDiscoveryTrigger } from "@/utils/discoveryTrigger.ts";
import { isCatalogueTrackId, isPlaylistUuid } from "@/utils/urlIdKind.ts";
import {
  WorkspaceAnalysisGate,
  WorkspaceAnalysisPanel,
  WorkspaceDiscoveryPanel,
  WorkspaceShell,
  DiscoveryProcessingPanel,
  WORKSPACE_PANEL_CLASS,
  type WorkspaceMode,
} from "@/sections/mobile/Workspace/index.ts";
import { WorkspaceDiscoveryResults } from "@/sections/mobile/Workspace/WorkspaceDiscoveryResults.tsx";
import AnalysisSummaryPage from "@/pages/AnalysisSummaryPage.tsx";

export function WorkspaceMobile({ mode }: { mode: WorkspaceMode }) {
  const [searchParams] = useSearchParams();
  const urlId = searchParams.get("id");
  const urlState = searchParams.get("state");
  // Explicit chain-discover seed. Catalogue track ids are UUIDs (indistinguishable in shape from a
  // playlist uuid), so a dedicated `?discover=<track-uuid>` triggers "create similarity by this
  // track" unambiguously — while `?id=<uuid>` keeps meaning "open this playlist". A numeric `?id=`
  // is still honoured as a legacy chain-discover seed for back-compat.
  const urlDiscover = searchParams.get("discover");
  const seedTrackId = urlDiscover || (urlId && isCatalogueTrackId(urlId) ? urlId : null);

  const { response, error, setError, gateReason, gateTitle, gateBody, setGateReason } = useUploadStore();
  const { setPlaylistResponse, loadCachedResponse } = usePlaylistStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const navigate = useNavigate();
  const { handleSelectTrack } = useTrackSimilarity();
  const [urlDiscoveryActive, setUrlDiscoveryActive] = React.useState(false);

  // `/analysis?id=` — the SUMMARY view. The full dashboard lives at `/analysis/full?id=`
  // and is reached by choosing it, so a free user is never dropped on an upgrade CTA by a
  // link that only meant "open this analysis".
  const showFullAnalysis = mode === "analysis" && !!urlId;

  // `?discover=<track>` (or a legacy numeric `?id=`) → chain-discover: create similarity by track.
  React.useEffect(() => {
    if (showFullAnalysis) return;
    if (!seedTrackId) return;

    const cachedResponse = loadCachedResponse(seedTrackId);
    if (cachedResponse) {
      setPlaylistResponse(cachedResponse);
      const playlistId = cachedResponse.data?.playlist?.id || null;
      navigate(playlistId ? `/sonic-discovery?id=${playlistId}` : "/sonic-discovery");
      return;
    }

    if (claimDiscoveryTrigger(seedTrackId)) {
      setUrlDiscoveryActive(true);
      handleSelectTrack(seedTrackId, true);
    }
  }, [showFullAnalysis, seedTrackId, loadCachedResponse, setPlaylistResponse, navigate, handleSelectTrack]);

  // Discovery-only: a leftover successful upload/search response must not bounce
  // /analysis back to /sonic-discovery (that made Analyse appear unselectable).
  React.useEffect(() => {
    if (mode !== "discovery" || showFullAnalysis) return;
    if (response && response.success) {
      setUrlDiscoveryActive(false);
      setPlaylistResponse(response as Parameters<typeof setPlaylistResponse>[0]);

      const playlistId = (response as { data?: { playlist?: { id?: string } } }).data?.playlist?.id || null;
      if (playlistId) {
        navigate(`/sonic-discovery?id=${playlistId}`);
      } else {
        navigate("/sonic-discovery");
      }
    }
  }, [mode, showFullAnalysis, response, setPlaylistResponse, navigate]);

  if (showFullAnalysis) {
    return (
      <>
        <AnalysisSummaryPage />
        {error && (
          <StatusMessage isOpen={true} status="error" message={error} onClose={() => setError(null)} />
        )}
      </>
    );
  }

  const showPlaylistResults =
    mode === "discovery" &&
    ((urlId && isPlaylistUuid(urlId)) || (!!urlState && !urlId));
  const showUrlDiscoveryProcessing = mode === "discovery" && urlDiscoveryActive;

  return (
    <>
      <WorkspaceShell mode={mode}>
        {showPlaylistResults ? (
          <WorkspaceDiscoveryResults />
        ) : showUrlDiscoveryProcessing ? (
          <div className={WORKSPACE_PANEL_CLASS}>
            <DiscoveryProcessingPanel />
          </div>
        ) : mode === "discovery" ? (
          <WorkspaceDiscoveryPanel />
        ) : isAuthenticated || sessionExpired ? (
          <WorkspaceAnalysisPanel />
        ) : (
          <WorkspaceAnalysisGate />
        )}
      </WorkspaceShell>

      {error && !sessionExpired && (
        <StatusMessage isOpen={true} status="error" message={error} onClose={() => setError(null)} />
      )}

      <GateCtaModal
        reason={sessionExpired ? null : gateReason}
        title={gateTitle ?? undefined}
        body={gateBody ?? undefined}
        onClose={() => setGateReason(null)}
      />
    </>
  );
}
