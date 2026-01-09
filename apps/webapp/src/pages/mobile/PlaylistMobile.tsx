import { useState, useEffect } from "react";
import { PlaylistHero, PlaylistTable } from "@/sections/mobile/index.ts";
import MoreMenu from "@/sections/mobile/Playlist/MoreMenu.tsx";
import { BASE_BETA_URL } from "@resomix/config";
import { usePlaylistStore } from "@resomix/stores";
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { StatusMessage } from "@resomix/ui";

export function PlaylistMobile() {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<{ id: string; name: string; label: string; duration: number; score?: number | null; isInput: boolean } | null>(null);

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
      }, 3000);
    } else {
      // Data arrived or still loading – ensure expired flag reset
      setExpired(false);
      if (timeoutId) clearTimeout(timeoutId);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, playlistData]);

  const handleExpiredClose = () => {
    window.location.href = BASE_BETA_URL;
  };

  const handleMoreMenuOpen = (
    trackId: string,
    name: string,
    label: string,
    duration: number,
    score: number | null,
    isInput: boolean = false,
  ) => {
    setSelectedTrack({ id: trackId, name, label, duration, score, isInput });
    setShowMoreMenu(true);
  };

  const handleMoreMenuClose = () => {
    setShowMoreMenu(false);
    setSelectedTrack(null);
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
        <div className="">
          <PlaylistHero onMoreClick={handleMoreMenuOpen} />

          {/* Content Table */}
          <div className="relative z-20">
            <PlaylistTable onMoreClick={handleMoreMenuOpen} />
          </div>

          {/* More Menu Overlay */}
          {showMoreMenu && (
            <div className="fixed inset-0 z-[100]">
              <MoreMenu
                onClose={handleMoreMenuClose}
                trackId={selectedTrack?.id}
                name={selectedTrack?.name}
                label={selectedTrack?.label}
                duration={selectedTrack?.duration}
                score={selectedTrack?.score ?? undefined}
                isInput={selectedTrack?.isInput || false}
              />
            </div>
          )}
        </div>
      )}
    </AudioProvider>
  );
}
