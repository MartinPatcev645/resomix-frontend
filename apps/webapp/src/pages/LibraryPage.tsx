import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatusMessage, Tooltip, PrivateIcon, PublicIcon } from "@resomix/ui";
import { useAuthStore } from "@resomix/stores";
import { useLibrary } from "@resomix/hooks";
import TrackSvg from "@/assets/icons/track_2.svg";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    playlists,
    tracks,
    loading,
    error,
    activeTab,
    playlistsPage,
    playlistsTotalPages,
    tracksPage,
    tracksTotalPages,
    setActiveTab,
    loadPlaylists,
    loadTracks,
    removeTrack,
    removePlaylist,
    sharePlaylist,
  } = useLibrary();

  // Status Message states
  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTitle, setStatusTitle] = useState("");

  // Three-dots dropdown active menu ID
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleStatusChange = (type: "loading" | "success" | "error", message: string, title = "") => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title);
    setShowStatus(true);
  };

  // Click outside to close the three-dots dropdown menu
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Initial load and tab/page change reactions
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === "playlists") {
      loadPlaylists(playlistsPage);
    } else {
      loadTracks(tracksPage);
    }
  }, [isAuthenticated, activeTab, playlistsPage, tracksPage, loadPlaylists, loadTracks]);

  const handleDeletePlaylist = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await removePlaylist(uuid);
    if (result.success) {
      handleStatusChange("success", "Playlist removed from your library.", "Success");
    } else {
      handleStatusChange("error", result.error || "Failed to remove playlist", "Removal Failed");
    }
  };

  const handleDeleteTrack = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await removeTrack(uuid);
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
    if (activeTab === "playlists") {
      if (playlistsPage > 1) {
        loadPlaylists(playlistsPage - 1);
      }
    } else {
      if (tracksPage > 1) {
        loadTracks(tracksPage - 1);
      }
    }
  };

  const handleNextPage = () => {
    if (activeTab === "playlists") {
      if (playlistsPage < playlistsTotalPages) {
        loadPlaylists(playlistsPage + 1);
      }
    } else {
      if (tracksPage < tracksTotalPages) {
        loadTracks(tracksPage + 1);
      }
    }
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
              onClick={() => setActiveTab("playlists")}
              className={`text-[length:var(--px-16)] font-semibold font-helvetica uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "playlists"
                  ? "text-[var(--color-primary-hover)] border-b border-[var(--color-primary)]"
                  : "text-slate-400 hover:text-[var(--color-primary)]"
              }`}
            >
              Playlists ({playlists.length})
            </button>
            <button
              onClick={() => setActiveTab("tracks")}
              className={`text-[length:var(--px-16)] font-semibold font-helvetica uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "tracks"
                  ? "text-[var(--color-primary-hover)] border-b border-[var(--color-primary)]"
                  : "text-slate-400 hover:text-[var(--color-primary)]"
              }`}
            >
              Tracks ({tracks.length})
            </button>
          </div>

          {error && (
            <div className="p-[var(--px-20)] mb-[var(--px-20)] text-center border border-red-500/30 bg-red-500/5 text-red-400 font-fira text-[length:var(--px-14)] rounded-md">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-[var(--px-40)] text-center text-slate-400 font-fira">
              Loading your library...
            </div>
          ) : activeTab === "playlists" ? (
            playlists.length === 0 ? (
              <div className="p-[var(--px-40)] border border-slate-200 border-dotted rounded-lg text-center">
                <p className="text-[length:var(--px-14)] font-light font-helvetica opacity-60">
                  Your library has no playlists. Generate some playlists by searching or uploading a track.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--px-12)] w-full">
                {playlists.map((playlist) => (
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
                      <Tooltip message={playlist.is_public ? "Public Playlist" : "Private Playlist"}>
                        <div className="text-white/60">
                          {playlist.is_public ? (
                            <PublicIcon customWidth="14" customHeight="14" disableHover />
                          ) : (
                            <PrivateIcon customWidth="14" customHeight="14" disableHover />
                          )}
                        </div>
                      </Tooltip>

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
                  const trackDropdownItems = [];
                  if (track.playlist_uuid) {
                    trackDropdownItems.push({
                      id: `track-view-playlist-${track.id}`,
                      label: "Sonic Discovery",
                      icon: (
                        <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="8" y1="6" x2="21" y2="6" />
                          <line x1="8" y1="12" x2="21" y2="12" />
                          <line x1="8" y1="18" x2="21" y2="18" />
                          <line x1="3" y1="6" x2="3.01" y2="6" />
                          <line x1="3" y1="12" x2="3.01" y2="12" />
                          <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                      ),
                      onClick: () => navigate(`/playlist?id=${track.playlist_uuid}`, { state: { from: "library" } }),
                    });
                  }
                  if (track.has_analysis) {
                    trackDropdownItems.push({
                      id: `track-discovery-${track.id}`,
                      label: "Get Sonic Discovery",
                      icon: (
                        <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v20M17 5v14M22 9v6M7 7v10M2 10v4" />
                        </svg>
                      ),
                      onClick: () => navigate(`/?id=${track.id}`),
                    });
                  } else {
                    trackDropdownItems.push({
                      id: `track-analyze-${track.id}`,
                      label: "Analyze Track",
                      icon: (
                        <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v20M17 5v14M22 9v6M7 7v10M2 10v4" />
                        </svg>
                      ),
                      onClick: () => handleStatusChange("success", "Analysis is coming soon!", "Feature Coming Soon"),
                    });
                  }
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
                        <span className="text-[length:var(--px-10)] font-light font-fira text-white/40">
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

          {/* Pagination Controls */}
          {!loading && (activeTab === "playlists" ? playlistsTotalPages > 1 : tracksTotalPages > 1) && (
            <div className="flex justify-center items-center gap-[var(--px-20)] mt-[var(--px-30)] mb-[var(--px-50)]">
              <button
                disabled={activeTab === "playlists" ? playlistsPage <= 1 : tracksPage <= 1}
                onClick={handlePrevPage}
                className="px-[var(--px-16)] py-[var(--px-8)] border border-dotted border-white/20 hover:border-white/50 disabled:opacity-30 disabled:border-white/10 text-white/80 disabled:text-white/30 text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer disabled:cursor-not-allowed rounded-xs"
              >
                Prev
              </button>
              <span className="text-[length:var(--px-14)] font-light font-fira text-white/80">
                Page {activeTab === "playlists" ? playlistsPage : tracksPage} of{" "}
                {activeTab === "playlists" ? playlistsTotalPages : tracksTotalPages}
              </span>
              <button
                disabled={
                  activeTab === "playlists"
                    ? playlistsPage >= playlistsTotalPages
                    : tracksPage >= tracksTotalPages
                }
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
    </section>
  );
}
