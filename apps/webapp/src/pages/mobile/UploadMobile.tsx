import { UploadOne, UploadHero } from "@/sections/mobile/index.ts";
import AngleDown from "@/assets/icons/AngleDown.svg";
import { StatusMessage } from "@resomix/ui";
import { useUploadStore } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { useNavigate } from "react-router-dom";
import React from "react";
import { useTrackSimilarity } from "@resomix/hooks";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";

export function UploadMobile() {
  const { response, error, setError, gateReason, gateTitle, gateBody, setGateReason } = useUploadStore();
  const { setPlaylistResponse, loadCachedResponse } = usePlaylistStore();
  const navigate = useNavigate();
  const processedId = React.useRef<string | null>(null);

  const { handleSelectTrack } = useTrackSimilarity();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    // Prevent infinite loop by checking if we've already processed this ID
    if (id && processedId.current !== id) {
      processedId.current = id;

      // First check cache before making API call
      const cachedResponse = loadCachedResponse(id);
      if (cachedResponse) {
        // Found in cache, use cached data and navigate directly
        setPlaylistResponse(cachedResponse);
        const playlistId = cachedResponse.data?.playlist?.id || null;
        if (playlistId) {
          navigate(`/sonic-discovery?id=${playlistId}`);
        } else {
          navigate('/sonic-discovery');
        }
      } else {
        // Not in cache, make API call
        handleSelectTrack(id, true);
      }
    }
  }, [loadCachedResponse, setPlaylistResponse, navigate]);

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
