import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Error404 } from "@resomix/ui";
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";
import { PlaylistHero, PlaylistTable } from "@/sections/desktop/index.ts";
import { scrollToPlaylistHero } from "@/utils/scrollToPlaylistHero.ts";

/** Playlist results view — live handlers unchanged; composed inside the workspace shell (Stage 3). */
export const WorkspaceDiscoveryResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { playlistData, isLoading, error } = usePlaylistStore();
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

  const hasId = !!searchParams.get("id") || !!searchParams.get("state");
  const isResolving = isLoading || (hasId && !playlistData && !error);

  useEffect(() => {
    const id = searchParams.get("id");
    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (state && !id) {
      const newParams = new URLSearchParams({
        id: decodeURIComponent(state),
        code: code || "",
        state,
        error: oauthError || "",
        share: "true",
      });
      navigate(`?${newParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <AudioProvider>
      {playlistData ? (
        <>
          <div ref={heroRef}>
            <PlaylistHero />
          </div>
          <PlaylistTable />
        </>
      ) : (
        <Error404
          baseUrl={BASE_BETA_URL}
          loading={isResolving}
          eyebrow="Access"
          title="Playlist is Private"
          description="This playlist is private. Make it public or share it to view, or go back to safety."
          buttonText="Go Back to Safety"
        />
      )}
    </AudioProvider>
  );
};
