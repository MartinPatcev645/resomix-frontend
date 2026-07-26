import { UploadOne, UploadHero } from "@/sections/mobile/index.ts";
import AngleDown from "@/assets/icons/AngleDown.svg";
import { StatusMessage } from "@resomix/ui";
import { useUploadStore } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { useNavigate } from "react-router-dom";
import React from "react";
import { useTrackSimilarity } from "@resomix/hooks";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import { claimDiscoveryTrigger } from "@/utils/discoveryTrigger.ts";

export function UploadMobile() {
  const { response, error, setError, gateReason, gateTitle, gateBody, setGateReason } = useUploadStore();
  const { setPlaylistResponse, loadCachedResponse } = usePlaylistStore();
  const navigate = useNavigate();

  const { handleSelectTrack } = useTrackSimilarity();

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;

    // Cache fast-path is side-effect-free (creates no playlist) — always safe to run.
    const cachedResponse = loadCachedResponse(id);
    if (cachedResponse) {
      setPlaylistResponse(cachedResponse);
      const playlistId = cachedResponse.data?.playlist?.id || null;
      navigate(playlistId ? `/sonic-discovery?id=${playlistId}` : '/sonic-discovery');
      return;
    }

    // The API call CREATES a playlist, so it must run at most once per id — even if this landing
    // remounts during a new-tab boot. `claimDiscoveryTrigger` dedups across mounts (module-level).
    if (claimDiscoveryTrigger(id)) {
      handleSelectTrack(id, true);
    }
  }, [loadCachedResponse, setPlaylistResponse, navigate, handleSelectTrack]);

  React.useEffect(() => {
    if (response && response.success) {
      setPlaylistResponse(response as any);

      const playlistId = (response as any).data?.playlist?.id || null;
      if (playlistId) {
        navigate(`/sonic-discovery?id=${playlistId}`);
      } else {
        navigate('/sonic-discovery');
      }
    }
  }, [response, setPlaylistResponse, navigate]);

  // Cleanup effect to reset upload store state when leaving the page
  // This avoids the "Back" button loop and ensures loader is closed
  React.useEffect(() => {
    return () => {
      useUploadStore.getState().reset();
    };
  }, []);

  return (
    <div className="">
      <UploadHero />
      <img src={AngleDown} aria-hidden="true" loading="lazy" draggable={false} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] w-full self-center my-[var(--px-50)]" />

      {/* Section One */}
      <div className="relative z-20 mt-[var(--px-60)]">
        <UploadOne />
      </div>

      {error && (
        <StatusMessage
          isOpen={true}
          status="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <GateCtaModal reason={gateReason} title={gateTitle ?? undefined} body={gateBody ?? undefined} onClose={() => setGateReason(null)} />
    </div>
  );
}
