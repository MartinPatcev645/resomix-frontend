import { Error404 } from "@resomix/ui";
import { useEffect } from "react";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { PlaylistHero, PlaylistTable } from "@/sections/desktop/index.ts";
import { usePlaylistStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";

export function PlaylistPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { playlistData, isLoading, error } = usePlaylistStore();

  // Load from ?id= if store empty
  usePlaylistLoader();

  // Derive the view directly from the store (no lagging state). While an id is still resolving — no
  // data and no error yet, INCLUDING the brief window on mount/refresh before the loader effect flips
  // `isLoading` — we treat it as loading, so we never flash the "Playlist is Private" screen. That
  // screen shows only once the load has definitively failed (errored) or there's simply no id.
  // `state` (present on a share / OAuth return) is redirected to `id` by the effect below, so treat
  // it as "an id is coming" — otherwise the pre-redirect frame would flash the "Private" screen.
  const hasId = !!searchParams.get('id') || !!searchParams.get('state');
  const isResolving = isLoading || (hasId && !playlistData && !error);

  useEffect(() => {
    const id = searchParams.get('id');
    const state = searchParams.get('state');
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (state && !id) {
      const newParams = new URLSearchParams({
        id: decodeURIComponent(state),
        code: code || '',
        state: state,
        error: error || '',
        share: 'true',
      });

      navigate(`?${newParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <AudioProvider>
      {playlistData ? (
        <>
          <PlaylistHero />
          <PlaylistTable />
        </>
      ) : (
        // Render the page frame immediately (never a black screen): a loader while the id is still
        // resolving, then the real "private" message only once the load has definitively failed.
        <Error404
          baseUrl={BASE_BETA_URL}
          loading={isResolving}
          title="Playlist is Private"
          description="This playlist is private. Make it public or share it to view, or go back to safety."
          buttonText="Go Back to Safety"
        />
      )}
    </AudioProvider>
  );
}
