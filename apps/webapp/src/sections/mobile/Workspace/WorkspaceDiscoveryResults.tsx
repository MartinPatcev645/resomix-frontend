import React, { useEffect, useRef, useState } from "react";
import { Error404 } from "@resomix/ui";
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";
import { PlaylistHero, PlaylistTable } from "@/sections/mobile/index.ts";
import MoreMenu from "@/sections/mobile/Playlist/MoreMenu.tsx";
import { PlaylistShare } from "@/components/index.ts";
import AppleExportModal from "@/components/Modals/Transfer/AppleExportModal.tsx";
import { scrollToPlaylistHero } from "@/utils/scrollToPlaylistHero.ts";

/** Mobile playlist results — live handlers unchanged; composed inside the workspace shell (Stage 3). */
export const WorkspaceDiscoveryResults: React.FC = () => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAppleExport, setShowAppleExport] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<{
    id: string;
    name: string;
    label: string;
    duration: number;
    score?: number | null;
    isInput: boolean;
  } | null>(null);

  const { playlistData, isLoading, error, errorReason } = usePlaylistStore();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (playlistData?.playlist?.id) {
      document.getElementById("playlist-results-heading")?.focus({ preventScroll: true });
      // Opening a playlist (?id=…) should land on the hero, not the workspace header/task cards
      // above it — smooth-scroll the hero to the top once it has rendered.
      scrollToPlaylistHero(heroRef.current);
    }
  }, [playlistData?.playlist?.id]);

  usePlaylistLoader();

  const hasId =
    typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("id");
  const isResolving = isLoading || (hasId && !playlistData && !error);

  const handleMoreMenuOpen = (
    trackId: string,
    name: string,
    label: string,
    duration: number,
    score: number | null,
    isInput = false,
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
        <div>
          <div ref={heroRef}>
            <PlaylistHero />
          </div>
          <div className="relative z-20">
            <PlaylistTable onMoreClick={handleMoreMenuOpen} />
          </div>

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
                onShare={() => {
                  handleMoreMenuClose();
                  setShowShare(true);
                }}
                onAppleExport={() => {
                  handleMoreMenuClose();
                  setShowAppleExport(true);
                }}
              />
            </div>
          )}

          <PlaylistShare
            isOpen={showShare}
            onClose={() => setShowShare(false)}
            id={playlistData?.playlist?.id ?? ""}
          />

          <AppleExportModal
            isOpen={showAppleExport}
            onClose={() => setShowAppleExport(false)}
            onStatusChange={() => {}}
            initialPlaylistId={playlistData?.playlist?.id}
          />
        </div>
      ) : (
        <Error404
          baseUrl={BASE_BETA_URL}
          loading={isResolving}
          eyebrow={errorReason === "forbidden" ? "Access" : "Error"}
          title={errorReason === "forbidden" ? "Playlist is Private" : "Something went wrong"}
          description={
            errorReason === "forbidden"
              ? "This playlist is private. Make it public or share it to view, or go back to safety."
              : "We could not load this playlist. This is usually temporary \u2014 please try again."
          }
          buttonText="Go Back to Safety"
        />
      )}
    </AudioProvider>
  );
};
