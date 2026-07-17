import { useState, useEffect } from "react";
import { PlaylistHero, PlaylistTable } from "@/sections/mobile/index.ts";
import MoreMenu from "@/sections/mobile/Playlist/MoreMenu.tsx";
import { PlaylistShare } from "@/components/index.ts";
import { BASE_BETA_URL } from "@resomix/config";
import { usePlaylistStore } from "@resomix/stores";
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { StatusMessage, Error404 } from "@resomix/ui";

export function PlaylistMobile() {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<{ id: string; name: string; label: string; duration: number; score?: number | null; isInput: boolean } | null>(null);

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
  const hasId = typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('id');
  const isResolving = isLoading || (hasId && !playlistData && !error);

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
      {playlistData ? (
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
                onShare={() => { handleMoreMenuClose(); setShowShare(true); }}
              />
            </div>
          )}

          {/* Share modal — opened from the reference track's three-dots menu. Owned here (not inside
              MoreMenu) so it survives the menu closing and isn't trapped under the menu's z-index. */}
          <PlaylistShare
            isOpen={showShare}
            onClose={() => setShowShare(false)}
            id={playlistData?.playlist?.id ?? ""}
          />
        </div>
      ) : isResolving ? (
        <StatusMessage
          isOpen={true}
          status="loading"
          message="Loading playlist..."
          onClose={() => { }}
        />
      ) : (
        <Error404
          baseUrl={BASE_BETA_URL}
          title="Playlist is Private"
          description="This playlist is private. Make it public or share it to view, or go back to safety."
          buttonText="Go Back to Safety"
        />
      )}
    </AudioProvider>
  );
}
