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
  WorkspaceDiscoveryResults,
  WorkspaceShell,
  DiscoveryProcessingPanel,
  WORKSPACE_PANEL_CLASS,
  type WorkspaceMode,
} from "@/sections/desktop/Workspace/index.ts";
import AnalysisPage from "@/pages/AnalysisPage.tsx";

export function WorkspacePage({ mode }: { mode: WorkspaceMode }) {
  const [searchParams] = useSearchParams();
  const urlId = searchParams.get("id");
  const urlState = searchParams.get("state");

  const { response, error, setError, gateReason, gateTitle, gateBody, setGateReason } = useUploadStore();
  const { setPlaylistResponse, loadCachedResponse } = usePlaylistStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const navigate = useNavigate();
  const { handleSelectTrack } = useTrackSimilarity();
  const [urlDiscoveryActive, setUrlDiscoveryActive] = React.useState(false);

  const showFullAnalysis = mode === "analysis" && !!urlId;

  // Numeric `?id=` → chain-discover (same contract as UploadPage / `/?id=`).
  React.useEffect(() => {
    if (showFullAnalysis) return;
    if (!urlId || !isCatalogueTrackId(urlId)) return;

    const cachedResponse = loadCachedResponse(urlId);
    if (cachedResponse) {
      setPlaylistResponse(cachedResponse);
      const playlistId = cachedResponse.data?.playlist?.id || null;
      navigate(playlistId ? `/sonic-discovery?id=${playlistId}` : "/sonic-discovery");
      return;
    }

    if (claimDiscoveryTrigger(urlId)) {
      setUrlDiscoveryActive(true);
      handleSelectTrack(urlId, true);
    }
  }, [showFullAnalysis, urlId, loadCachedResponse, setPlaylistResponse, navigate, handleSelectTrack]);

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

  // Full Track Intelligence deep links (?id=<analysis_uuid>) — standalone page, no workspace shell.
  if (showFullAnalysis) {
    return (
      <>
        <AnalysisPage />
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
