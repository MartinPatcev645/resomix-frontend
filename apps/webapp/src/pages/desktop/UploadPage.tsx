import { UploadHero, UploadOne } from "@/sections/desktop/index.ts";
import { StatusMessage } from "@resomix/ui";
import { useUploadStore, useTrackSimilarity } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { useNavigate } from "react-router-dom";
import React from "react";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";

export function UploadPage() {
  const { response, error, setError, gateReason, gateTitle, gateBody, setGateReason, isFileUpload } = useUploadStore();
  const { setPlaylistResponse, loadCachedResponse } = usePlaylistStore();
  const navigate = useNavigate();
  const processedId = React.useRef<string | null>(null);

  const { handleSelectTrack } = useTrackSimilarity();

  // Trigger similarity if id param present on first mount
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
          navigate(`/playlist?id=${playlistId}`);
        } else {
          navigate('/playlist');
        }
      } else {
        // Not in cache, make API call
        handleSelectTrack(id, true);
      }
    }
  }, [loadCachedResponse, setPlaylistResponse, navigate]);

  // Watch for API completion and route to playlist
  React.useEffect(() => {
    if (response && response.success) {
      setPlaylistResponse(response as any, isFileUpload);

      const playlistId = (response as any).data?.playlist?.id || null;
      if (playlistId) {
        navigate(`/playlist?id=${playlistId}`);
      } else {
        navigate('/playlist');
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
    <>
      <UploadHero />
      <UploadOne />

      {error && (
        <StatusMessage
          isOpen={true}
          status="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <GateCtaModal reason={gateReason} title={gateTitle ?? undefined} body={gateBody ?? undefined} onClose={() => setGateReason(null)} />
    </>
  );
}
