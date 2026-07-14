import { useState, useEffect } from "react";
import { PlaylistHero, PlaylistTable } from "@/sections/mobile/index.ts";
import MoreMenu from "@/sections/mobile/Playlist/MoreMenu.tsx";
import { AppleMusicBanner } from "@/components/Playlist/AppleMusicBanner.tsx";
import { BASE_BETA_URL } from "@resomix/config";
import { usePlaylistStore } from "@resomix/stores";
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { StatusMessage, Error404 } from "@resomix/ui";

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
    if (!isLoading && !playlistData) {
      setExpired(true);
    } else {
      setExpired(false);
    }
  }, [isLoading, playlistData]);

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
        <Error404
          baseUrl={BASE_BETA_URL}
          title="Playlist is Private"
          description="This playlist is private. Make it public or share it to view, or go back to safety."
          buttonText="Go Back to Safety"
        />
      ) : (
        <div className="">
          <PlaylistHero onMoreClick={handleMoreMenuOpen} />
          <AppleMusicBanner />

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
