import { StatusMessage, Error404 } from "@resomix/ui";
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { PlaylistHero, PlaylistTable } from "@/sections/desktop/index.ts";
import { AppleMusicBanner } from "@/components/Playlist/AppleMusicBanner.tsx";
import { usePlaylistStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";

export function PlaylistPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { playlistData, isLoading } = usePlaylistStore();
  const [expired, setExpired] = useState(false);

  // Load from ?id= if store empty
  usePlaylistLoader();

  // Handle expired fallback
  useEffect(() => {
    if (!isLoading && !playlistData) {
      setExpired(true);
    } else {
      setExpired(false);
    }
  }, [isLoading, playlistData]);

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
      {isLoading ? (
        <StatusMessage
          isOpen={true}
          status="loading"
          message="Loading playlist..."
          onClose={() => { }}
        />
      ) : expired ? (
        <Error404
          baseUrl={BASE_BETA_URL}
          title="Playlist is Private"
          description="This playlist is private. Make it public or share it to view, or go back to safety."
          buttonText="Go Back to Safety"
        />
      ) : (
        <>
          <PlaylistHero />
          <AppleMusicBanner />
          <PlaylistTable />
        </>
      )}
    </AudioProvider>
  );
}
