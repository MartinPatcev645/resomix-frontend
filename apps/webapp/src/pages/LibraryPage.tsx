import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatusMessage, Tooltip, PrivateIcon, PublicIcon, HeartFilledIcon } from "@resomix/ui";
import { useAuthStore } from "@resomix/stores";
import { useLibrary } from "@resomix/hooks";
import TrackSvg from "@/assets/icons/track_2.svg";
import { TrackArtifactChips, trackHasPendingArtifact } from "@/components/TrackArtifactChips.tsx";

export default function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const {
    playlists,
    favorites,
    tracks,
    error,
    activeTab,
    playlistsLoading,
    favoritesLoading,
    tracksLoading,
    playlistsPage,
    playlistsTotalPages,
    playlistsTotal,
    favoritesPage,
    favoritesTotalPages,
    favoritesTotal,
    tracksPage,
    tracksTotalPages,
    tracksTotal,
    setActiveTab,
    loadPlaylists,
    loadFavorites,
    loadTracks,
    removeTrack,
    removePlaylist,
    removeFavoritePlaylist,
    sharePlaylist,
  } = useLibrary();

  // Derived view of whichever tab is selected (each section has its own slice / paging / loading).
  const activePlaylists = activeTab === "favorites" ? favorites : playlists;
  const activeLoading =
    activeTab === "tracks" ? tracksLoading : activeTab === "favorites" ? favoritesLoading : playlistsLoading;
  const activePage =
    activeTab === "tracks" ? tracksPage : activeTab === "favorites" ? favoritesPage : playlistsPage;
  const activeTotalPages =
    activeTab === "tracks" ? tracksTotalPages : activeTab === "favorites" ? favoritesTotalPages : playlistsTotalPages;

  // Status Message states
  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTitle, setStatusTitle] = useState("");

  // Track deletion confirmation state
  const [trackToDelete, setTrackToDelete] = useState<{ id: string; title: string } | null>(null);

  // Playlist deletion confirmation state
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);

  // Remove a playlist from favorites (Favorites tab). All items in that tab are favorites, so the
  // heart is filled and clicking it un-favorites — the row then drops out of the list.
  const handleRemoveFavorite = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await removeFavoritePlaylist(uuid);
    if (!result.success) {
      handleStatusChange("error", result.error || "Failed to remove from favorites", "Error");
    }
  };

  // Three-dots dropdown active menu ID
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleStatusChange = (type: "loading" | "success" | "error", message: string, title = "") => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title);
    setShowStatus(true);
  };

  // Sync activeTab with URL query parameter on mount and when URL parameter changes
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (tabParam === "playlists" || tabParam === "favorites" || tabParam === "tracks") {
      setActiveTab(tabParam);
    } else {
      // If no tab in URL, sync activeTab back to URL parameter
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [tabParam, activeTab, setActiveTab, setSearchParams]);

  // Click outside to close the three-dots dropdown menu
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // On arrival (and on login) load all three sections, so every tab's count is populated and
  // switching tabs is instant (data lives in the store). A full page reload or the Refresh button
  // refetches — deliberately NOT re-run when the user merely switches tabs.
  useEffect(() => {
    if (!isAuthenticated) return;
    loadPlaylists(1);
    loadFavorites(1);
    loadTracks(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Every upload spawns BOTH a similarity playlist and an analysis; the sibling runs in the
  // background and lands a minute or two later. While the Tracks tab shows a just-uploaded row whose
  // sibling artifact hasn't arrived yet, silently re-poll my-tracks every 10s so its capsule flips
  // from "generating" to a live link the moment it's ready — no manual refresh, both directions.
  // Self-terminating: re-arms only while something is still pending (see trackHasPendingArtifact).
  useEffect(() => {
    if (activeTab !== "tracks") return;
    if (!tracks.some(trackHasPendingArtifact)) return;
    const timer = setTimeout(() => {
      loadTracks(tracksPage, 20, { silent: true });
    }, 10000);
    return () => clearTimeout(timer);
  }, [activeTab, tracks, tracksPage, loadTracks]);

  // Refresh only the currently-selected tab (keeps the others as-is).
  const handleRefresh = () => {
    if (activeTab === "playlists") loadPlaylists(playlistsPage);
    else if (activeTab === "favorites") loadFavorites(favoritesPage);
    else loadTracks(tracksPage);
  };

  const handleDeletePlaylist = (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaylistToDelete(uuid);
  };

  const handleConfirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    const uuid = playlistToDelete;
    setPlaylistToDelete(null);
    handleStatusChange("loading", "Removing playlist...", "Removing");
    const result = await removePlaylist(uuid);
    if (result.success) {
      handleStatusChange("success", "Playlist removed from your library.", "Success");
    } else {
      handleStatusChange("error", result.error || "Failed to remove playlist", "Removal Failed");
    }
  };

  const handleDeleteTrack = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const track = tracks.find((t) => t.id === uuid);
    if (track) {
      setTrackToDelete({ id: uuid, title: track.title });
    }
  };

  const handleConfirmDeleteTrack = async () => {
    if (!trackToDelete) return;
    const { id } = trackToDelete;
    setTrackToDelete(null);
    handleStatusChange("loading", "Deleting track...", "Deleting");
    const result = await removeTrack(id);
    if (result.success) {
      handleStatusChange("success", "Track deleted successfully.", "Success");
    } else {
      handleStatusChange("error", result.error || "Failed to delete track", "Deletion Failed");
    }
  };

  const handleSharePlaylist = async (uuid: string, isAlreadyPublic: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/playlist?id=${uuid}`;
    
    const copyLink = () => {
      navigator.clipboard.writeText(shareUrl).then(
        () => handleStatusChange("success", "Link copied to clipboard!", "Link Copied"),
        () => handleStatusChange("error", "Could not copy link to clipboard.", "Error")
      );
    };

    if (isAlreadyPublic) {
      copyLink();
    } else {
      const result = await sharePlaylist(uuid);
      if (result.success) {
        navigator.clipboard.writeText(shareUrl).then(
          () => handleStatusChange("success", "Playlist is now public. Link copied to clipboard!", "Shared Successfully"),
          () => handleStatusChange("success", "Playlist is now public.", "Shared Successfully")
        );
      } else {
        handleStatusChange("error", result.error || "Failed to share playlist", "Sharing Failed");
      }
    }
  };

  const handlePrevPage = () => {
    if (activeTab === "playlists" && playlistsPage > 1) loadPlaylists(playlistsPage - 1);
    else if (activeTab === "favorites" && favoritesPage > 1) loadFavorites(favoritesPage - 1);
    else if (activeTab === "tracks" && tracksPage > 1) loadTracks(tracksPage - 1);
  };

  const handleNextPage = () => {
    if (activeTab === "playlists" && playlistsPage < playlistsTotalPages) loadPlaylists(playlistsPage + 1);
    else if (activeTab === "favorites" && favoritesPage < favoritesTotalPages) loadFavorites(favoritesPage + 1);
    else if (activeTab === "tracks" && tracksPage < tracksTotalPages) loadTracks(tracksPage + 1);
  };

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Library
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Your saved playlists and track collections
          </p>
        </header>

        <div className="mx-auto w-full max-w-4xl px-[var(--px-10)] md:px-0">
          {/* Tab Switcher */}
          <div className="flex justify-center gap-[var(--px-30)] mb-[var(--px-40)] border-b border-dotted border-slate-200/30 pb-[var(--px-15)]">
            <button
              onClick={() => setSearchParams({ tab: "playlists" }, { replace: true })}
              className={`text-[length:var(--px-16)] font-semibold font-helvetica uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "playlists"
                  ? "text-[var(--color-primary-hover)] border-b border-[var(--color-primary)]"
                  : "text-slate-400 hover:text-[var(--color-primary)]"
              }`}
            >
              Playlists ({playlistsTotal})
            </button>
            <button
              onClick={() => setSearchParams({ tab: "favorites" }, { replace: true })}
              className={`text-[length:var(--px-16)] font-semibold font-helvetica uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "favorites"
                  ? "text-[var(--color-primary-hover)] border-b border-[var(--color-primary)]"
                  : "text-slate-400 hover:text-[var(--color-primary)]"
              }`}
            >
              Favorites ({favoritesTotal})
            </button>
            <button
              onClick={() => setSearchParams({ tab: "tracks" }, { replace: true })}
              className={`text-[length:var(--px-16)] font-semibold font-helvetica uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "tracks"
                  ? "text-[var(--color-primary-hover)] border-b border-[var(--color-primary)]"
                  : "text-slate-400 hover:text-[var(--color-primary)]"
              }`}
            >
              Tracks ({tracksTotal})
            </button>
          </div>

          {/* Refresh the currently-selected tab (a full page reload refetches all three). */}
          <div className="flex justify-end mb-[var(--px-15)]">
            <button
              onClick={handleRefresh}
              disabled={activeLoading}
              className="flex items-center gap-[var(--px-8)] px-[var(--px-14)] py-[var(--px-6)] border border-dotted border-white/20 hover:border-white/50 disabled:opacity-40 text-white/80 text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer disabled:cursor-not-allowed rounded-xs"
              aria-label="Refresh"
            >
              <svg
                className={`w-[var(--px-14)] h-[var(--px-14)] ${activeLoading ? "animate-spin" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              Refresh
            </button>
          </div>

          {error && (
            <div className="p-[var(--px-20)] mb-[var(--px-20)] text-center border border-red-500/30 bg-red-500/5 text-red-400 font-fira text-[length:var(--px-14)] rounded-md">
              {error}
            </div>
          )}

          {activeLoading ? (
            <div className="p-[var(--px-40)] text-center text-slate-400 font-fira">
              Loading your library...
            </div>
          ) : activeTab === "playlists" || activeTab === "favorites" ? (
            activePlaylists.length === 0 ? (
              <div className="p-[var(--px-40)] border border-slate-200 border-dotted rounded-lg text-center">
                <p className="text-[length:var(--px-14)] font-light font-helvetica opacity-60">
                  {activeTab === "favorites"
                    ? "You have no favorited playlists yet."
                    : "Your library has no playlists. Generate some playlists by searching or uploading a track."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--px-12)] w-full">
                {activePlaylists.map((playlist) => (
                  <div
                    key={playlist.uuid}
                    className="w-full border border-dotted border-slate-200/60 p-[var(--px-12)] md:p-[var(--px-16)] flex justify-between items-center relative rounded-xs hover:bg-white/5 transition-colors"
                  >
                    {/* Aligned top content layout */}
                    <div className="flex items-start gap-[var(--px-10)] md:gap-[var(--px-20)] flex-grow pr-[var(--px-15)]">
                      {/* Clickable Image Link */}
                      <a
                        href={`/playlist?id=${playlist.uuid}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/playlist?id=${playlist.uuid}`, { state: { from: "library" } });
                        }}
                        className="flex-shrink-0 cursor-pointer"
                      >
                        <div className="border border-dotted border-slate-200 p-[var(--px-6)] md:p-[var(--px-10)] bg-black/40 hover:border-[var(--color-primary-hover)] transition-colors">
                          <img
                            src={TrackSvg}
                            draggable={false}
                            alt="Playlist Icon"
                            className="w-[var(--px-20)] h-[var(--px-20)] md:w-[var(--px-32)] md:h-[var(--px-32)]"
                          />
                        </div>
                      </a>

                      {/* Stacked Text Column */}
                      <div className="flex flex-col gap-[var(--px-4)] flex-grow">
                        {/* Clickable Title Link */}
                        <a
                          href={`/playlist?id=${playlist.uuid}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/playlist?id=${playlist.uuid}`, { state: { from: "library" } });
                          }}
                          className="text-[length:var(--px-14)] md:text-[length:var(--px-16)] font-semibold font-helvetica uppercase leading-tight hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
                        >
                          {playlist.name}
                        </a>
                        
                        {/* Meta Info Row - always stacked below the title on right of image */}
                        <div className="text-[length:var(--px-10)] font-light font-fira text-white/60">
                          <p>
                            {playlist.trackCount} tracks | {playlist.duration} | Created{" "}
                            {new Date(playlist.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-[var(--px-10)] md:gap-[var(--px-15)] flex-shrink-0 align-middle">
                      {activeTab === "favorites" ? (
                        <Tooltip message="Remove from Favorites">
                          <button
                            onClick={(e) => handleRemoveFavorite(playlist.uuid, e)}
                            className="text-white/60 hover:text-white cursor-pointer mt-[var(--px-2)] flex items-center justify-center transition-all p-[var(--px-4)] hover:scale-110 active:scale-90 bg-transparent border-0 outline-none"
                            aria-label="Remove from Favorites"
                          >
                            <HeartFilledIcon customWidth="22" customHeight="22" className="text-white" disableHover={true} />
                          </button>
                        </Tooltip>
                      ) : (
                        <Tooltip message={playlist.is_public ? "Public Playlist" : "Private Playlist"}>
                          <div className="text-white/60">
                            {playlist.is_public ? (
                              <PublicIcon customWidth="14" customHeight="14" disableHover />
                            ) : (
                              <PrivateIcon customWidth="14" customHeight="14" disableHover />
                            )}
                          </div>
                        </Tooltip>
                      )}

                      {/* Dropdown Actions */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === playlist.uuid ? null : playlist.uuid)}
                          className="p-[var(--px-6)] md:p-[var(--px-8)] text-white/60 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                          aria-label="Actions"
                        >
                          <svg className="w-[var(--px-18)] h-[var(--px-18)] fill-current text-white/70 hover:text-white" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </button>
                        
                        {activeMenuId === playlist.uuid && (
                          <div className="absolute right-0 mt-[var(--px-4)] w-[var(--px-180)] bg-[var(--color-secondary)] border border-dotted border-slate-200/60 rounded-xs shadow-2xl z-20 py-[var(--px-4)] text-[length:var(--px-11)] font-light font-helvetica">
                            {[
                              {
                                id: `playlist-open-${playlist.uuid}`,
                                label: "Open in New Tab",
                                icon: (
                                  <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
                                  </svg>
                                ),
                                onClick: () => window.open(`/playlist?id=${playlist.uuid}`, "_blank"),
                              },
                              {
                                id: `playlist-share-${playlist.uuid}`,
                                label: "Share",
                                icon: (
                                  <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
                                  </svg>
                                ),
                                onClick: (e: React.MouseEvent) => handleSharePlaylist(playlist.uuid, playlist.is_public, e),
                              },
                              {
                                id: `playlist-delete-${playlist.uuid}`,
                                label: "Delete",
                                separated: true,
                                danger: true,
                                icon: (
                                  <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                                  </svg>
                                ),
                                onClick: (e: React.MouseEvent) => handleDeletePlaylist(playlist.uuid, e),
                              }
                            ].map((item, index) => (
                              <div key={item.id}>
                                {index > 0 && (
                                  <div className={`border-t border-dotted ${item.separated ? 'border-slate-200/60' : 'border-slate-200/30'} mx-[var(--px-12)] my-[var(--px-4)]`} />
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    item.onClick(e);
                                  }}
                                  className={`w-full flex items-center gap-[var(--px-12)] px-[var(--px-16)] py-[var(--px-8)] text-[length:var(--px-12)] font-light font-helvetica hover:bg-white/5 active:bg-white/10 transition-colors duration-150 cursor-pointer ${
                                    item.danger ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" : "text-white/80 hover:text-white"
                                  }`}
                                >
                                  <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
                                    {item.icon}
                                  </span>
                                  <span className="whitespace-nowrap leading-none">
                                    {item.label}
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            tracks.length === 0 ? (
              <div className="p-[var(--px-40)] border border-slate-200 border-dotted rounded-lg text-center">
                <p className="text-[length:var(--px-14)] font-light font-helvetica opacity-60">
                  No saved tracks. Upload tracks or find similarity matches to add to your track collection.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--px-12)] w-full">
                {tracks.map((track) => {
                  // Sonic Discovery + Analysis are surfaced as capsules on the row (see
                  // <TrackArtifactChips/> below); the 3-dot menu keeps just the destructive action.
                  const trackDropdownItems = [];
                  trackDropdownItems.push({
                    id: `track-delete-${track.id}`,
                    label: "Delete Track",
                    separated: true,
                    danger: true,
                    icon: (
                      <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                      </svg>
                    ),
                    onClick: (e: React.MouseEvent) => handleDeleteTrack(track.id, e),
                  });

                  return (
                    <div
                      key={track.id}
                      className="w-full border border-dotted border-slate-200/60 p-[var(--px-12)] md:p-[var(--px-16)] flex justify-between items-center relative hover:bg-white/5 transition-colors"
                    >
                      {/* Aligned top content layout */}
                      <div className="flex items-start gap-[var(--px-10)] md:gap-[var(--px-20)] flex-grow pr-[var(--px-15)]">
                        {track.playlist_uuid ? (
                          <>
                            {/* Clickable Image Link */}
                            <a
                              href={`/playlist?id=${track.playlist_uuid}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/playlist?id=${track.playlist_uuid}`, { state: { from: "library" } });
                              }}
                              className="flex-shrink-0 cursor-pointer"
                            >
                              <div className="border border-dotted border-slate-200 p-[var(--px-6)] md:p-[var(--px-10)] bg-black/40 hover:border-[var(--color-primary-hover)] transition-colors">
                                <img
                                  src={TrackSvg}
                                  draggable={false}
                                  alt="Track Icon"
                                  className="w-[var(--px-20)] h-[var(--px-20)] md:w-[var(--px-32)] md:h-[var(--px-32)]"
                                />
                              </div>
                            </a>

                            {/* Stacked Text Column */}
                            <div className="flex flex-col gap-[var(--px-4)] flex-grow">
                              {/* Clickable Title Link */}
                              <a
                                href={`/playlist?id=${track.playlist_uuid}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/playlist?id=${track.playlist_uuid}`, { state: { from: "library" } });
                                }}
                                className="text-[length:var(--px-14)] md:text-[length:var(--px-16)] font-semibold font-helvetica uppercase leading-tight hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
                              >
                                {track.title}
                              </a>

                              {/* Meta Info Row - to the right of image, below title */}
                              <div className="flex flex-col md:flex-row md:items-center gap-[var(--px-4)] md:gap-[var(--px-20)] text-[length:var(--px-10)] font-light font-fira text-white/60">
                                <span>{track.artist} | {track.year} | {track.label}</span>
                                <span className="text-white/40 md:border-l md:border-white/20 md:pl-[var(--px-20)]">
                                  Playlist UUID: {track.playlist_uuid}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Non-clickable Image */}
                            <div className="flex-shrink-0">
                              <div className="border border-dotted border-slate-200 p-[var(--px-6)] md:p-[var(--px-10)] bg-black/40">
                                <img
                                  src={TrackSvg}
                                  draggable={false}
                                  alt="Track Icon"
                                  className="w-[var(--px-20)] h-[var(--px-20)] md:w-[var(--px-32)] md:h-[var(--px-32)]"
                                />
                              </div>
                            </div>

                            {/* Stacked Text Column */}
                            <div className="flex flex-col gap-[var(--px-4)] flex-grow">
                              <h3 className="text-[length:var(--px-14)] md:text-[length:var(--px-16)] font-semibold font-helvetica uppercase leading-tight">
                                {track.title}
                              </h3>

                              {/* Meta Info Row - to the right of image, below title */}
                              <div className="flex flex-col md:flex-row md:items-center gap-[var(--px-4)] md:gap-[var(--px-20)] text-[length:var(--px-10)] font-light font-fira text-white/60">
                                <span>{track.artist} | {track.year} | {track.label}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-[var(--px-10)] md:gap-[var(--px-15)] flex-shrink-0 align-middle" onClick={e => e.stopPropagation()}>
                        {/* Artifact capsules: reach the track's Sonic Discovery playlist and its
                            analysis straight from the row; a still-generating sibling shows a live
                            "…generating" pill that the 10s poll flips to a link when it lands. */}
                        <TrackArtifactChips
                          track={track}
                          onOpenPlaylist={(uuid) => navigate(`/playlist?id=${uuid}`, { state: { from: "library" } })}
                          onOpenAnalysis={(uuid) => navigate(`/analysis?id=${uuid}`, { state: { from: "library" } })}
                          onComingSoon={() => handleStatusChange("success", "Analysis is coming soon!", "Feature Coming Soon")}
                        />

                        <span className="hidden md:inline text-[length:var(--px-10)] font-light font-fira text-white/40">
                          {track.duration}
                        </span>

                        {/* Dropdown Actions */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === track.id ? null : track.id)}
                            className="p-[var(--px-6)] md:p-[var(--px-8)] text-white/60 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                            aria-label="Actions"
                          >
                            <svg className="w-[var(--px-18)] h-[var(--px-18)] fill-current text-white/70 hover:text-white" viewBox="0 0 24 24">
                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </button>
                          
                          {activeMenuId === track.id && (
                            <div className="absolute right-0 mt-[var(--px-4)] w-[var(--px-180)] bg-[var(--color-secondary)] border border-dotted border-slate-200/60 rounded-xs shadow-2xl z-20 py-[var(--px-4)] text-[length:var(--px-11)] font-light font-helvetica">
                              {trackDropdownItems.map((item, index) => (
                                <div key={item.id}>
                                  {index > 0 && (
                                    <div className={`border-t border-dotted ${item.separated ? 'border-slate-200/60' : 'border-slate-200/30'} mx-[var(--px-12)] my-[var(--px-4)]`} />
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      item.onClick(e);
                                    }}
                                    className="w-full flex items-center gap-[var(--px-12)] px-[var(--px-16)] py-[var(--px-8)] text-[length:var(--px-12)] font-light font-helvetica hover:bg-white/5 active:bg-white/10 transition-colors duration-150 cursor-pointer text-white/80 hover:text-white"
                                  >
                                    <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
                                      {item.icon}
                                    </span>
                                    <span className="whitespace-nowrap leading-none">
                                      {item.label}
                                    </span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Pagination Controls (for the active tab) */}
          {!activeLoading && activeTotalPages > 1 && (
            <div className="flex justify-center items-center gap-[var(--px-20)] mt-[var(--px-30)] mb-[var(--px-50)]">
              <button
                disabled={activePage <= 1}
                onClick={handlePrevPage}
                className="px-[var(--px-16)] py-[var(--px-8)] border border-dotted border-white/20 hover:border-white/50 disabled:opacity-30 disabled:border-white/10 text-white/80 disabled:text-white/30 text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer disabled:cursor-not-allowed rounded-xs"
              >
                Prev
              </button>
              <span className="text-[length:var(--px-14)] font-light font-fira text-white/80">
                Page {activePage} of {activeTotalPages}
              </span>
              <button
                disabled={activePage >= activeTotalPages}
                onClick={handleNextPage}
                className="px-[var(--px-16)] py-[var(--px-8)] border border-dotted border-white/20 hover:border-white/50 disabled:opacity-30 disabled:border-white/10 text-white/80 disabled:text-white/30 text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer disabled:cursor-not-allowed rounded-xs"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <StatusMessage
        isOpen={showStatus}
        onClose={() => setShowStatus(false)}
        status={statusType}
        message={statusMessage}
        title={statusTitle}
      />

      <StatusMessage
        isOpen={!!trackToDelete}
        onClose={() => setTrackToDelete(null)}
        status="custom"
      >
        <DeleteTrackModalContent
          trackName={trackToDelete?.title || ""}
          onClose={() => setTrackToDelete(null)}
          onConfirm={handleConfirmDeleteTrack}
          isOpen={!!trackToDelete}
        />
      </StatusMessage>

      <StatusMessage
        isOpen={!!playlistToDelete}
        onClose={() => setPlaylistToDelete(null)}
        status="custom"
      >
        {/* Warning icon */}
        <svg viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[var(--px-58)] h-[var(--px-58)]" aria-hidden="true">
          <circle cx="29" cy="29" r="28.815" stroke="white" strokeWidth="0.37" />
          <path d="M29 20v12" stroke="white" strokeWidth="0.37" strokeLinecap="round" />
          <circle cx="29" cy="38" r="1.5" fill="white" />
        </svg>

        <div className="text-center w-full">
          <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
            Delete Playlist
          </div>
          <div className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-15)] mt-[var(--px-10)]">
            Are you sure you want to delete this playlist? This action is non-recoverable.
          </div>
        </div>

        <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
          <button 
            onClick={() => setPlaylistToDelete(null)} 
            className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDeletePlaylist}
            className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer flex justify-center items-center"
          >
            Delete
          </button>
        </div>
      </StatusMessage>
    </section>
  );
}

interface DeleteTrackModalContentProps {
  isOpen: boolean;
  trackName: string;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteTrackModalContent({ isOpen, trackName, onClose, onConfirm }: DeleteTrackModalContentProps) {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (!isOpen) return;
    setCountdown(4);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  return (
    <>
      {/* Warning icon */}
      <svg viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[var(--px-58)] h-[var(--px-58)]" aria-hidden="true">
        <circle cx="29" cy="29" r="28.815" stroke="white" strokeWidth="0.37" />
        <path d="M29 20v12" stroke="white" strokeWidth="0.37" strokeLinecap="round" />
        <circle cx="29" cy="38" r="1.5" fill="white" />
      </svg>

      <div className="text-center w-full">
        <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
          Delete Track
        </div>
        <div className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-15)] mt-[var(--px-10)] text-slate-300">
          Are you sure you want to delete <span className="font-semibold text-white">"{trackName}"</span>?
        </div>
        <div className="text-left bg-white/5 border border-dotted border-white/10 p-[var(--px-15)] mt-[var(--px-15)] rounded-xs">
          <p className="text-[length:var(--px-11)] font-semibold font-helvetica text-white uppercase tracking-wider mb-[var(--px-8)]">
            This action is non-recoverable and will permanently delete:
          </p>
          <ul className="list-disc pl-[var(--px-15)] text-[length:var(--px-11)] font-light font-fira text-slate-400 flex flex-col gap-[var(--px-4)]">
            <li>His playback 30s chunk and peaks</li>
            <li>The embedding fingerprint from pyxis 1</li>
            <li>The playlist created by that track</li>
            <li>The analysis created by that track</li>
          </ul>
        </div>
      </div>

      <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
        <button
          onClick={onClose}
          className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          disabled={countdown > 0}
          onClick={onConfirm}
          className={`flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer flex justify-center items-center ${
            countdown > 0
              ? 'border-red-500/30 text-red-500/30 cursor-not-allowed'
              : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
          }`}
        >
          {countdown > 0 ? `Delete (${countdown}s)` : 'Delete'}
        </button>
      </div>
    </>
  );
}
