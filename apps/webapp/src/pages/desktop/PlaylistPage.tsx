import { StatusMessage } from "@resomix/ui";
import { useEffect, useState } from "react";
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

  const { playlistData, isLoading } = usePlaylistStore();
  const [expired, setExpired] = useState(false);

  // Load from ?id= if store empty
  usePlaylistLoader();

  // Handle expired fallback
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (!isLoading && !playlistData) {
      setExpired(true);
      timeoutId = setTimeout(() => {
        handleExpiredClose();
      }, 5000);
    } else {
      // Data arrived or still loading – ensure expired flag reset
      setExpired(false);
      if (timeoutId) clearTimeout(timeoutId);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
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

  const handleExpiredClose = () => {
    window.location.href = BASE_BETA_URL;
  };

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
        <StatusMessage
          isOpen={true}
          onClose={handleExpiredClose}
          status="error"
          message="Playlist Private. Share to make it public to view"
        />
      ) : (
        <>
          <PlaylistHero />
          <PlaylistTable />
        </>
      )}
    </AudioProvider>
  );
}
