import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatusMessage, Tooltip, PrivateIcon, PublicIcon, HeartFilledIcon, HeartStrokeIcon } from "@resomix/ui";
import { useAuthStore } from "@resomix/stores";
import { useLibrary, shouldOpenInNewTab, useAccess } from "@resomix/hooks";
import { CoverThumbnail } from "@/components/Library/CoverThumbnail.tsx";
import { PlaylistCoverEditor } from "@/components/Playlist/PlaylistCoverEditor.tsx";
import { ExportSubmenu } from "@/components/Library/ExportSubmenu.tsx";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import AppleExportModal from "@/components/Modals/Transfer/AppleExportModal.tsx";
import EmbedModal from "@/components/Modals/Transfer/EmbedModal.tsx";
import { TrackArtifactChips, trackHasPendingArtifact } from "@/components/TrackArtifactChips.tsx";
import { TrackMetaRow, PlaylistRenameModal, LibraryFilters, PlaylistShare } from "@/components/index.ts";

export default function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const {
    playlists,
    tracks,
    error,
    activeTab,
    playlistsLoading,
    tracksLoading,
    playlistsPage,
    playlistsTotalPages,
    playlistsTotal,
    tracksPage,
    tracksTotalPages,
    tracksTotal,
    setActiveTab,
    loadPlaylists,
    loadTracks,
    removeTrack,
    removePlaylist,
    toggleFavorite,
    sharePlaylist,
    setPlaylistVisibility,
    renamePlaylist,
    markPlaylistCoverUpdated,
    playlistsFilters,
    tracksFilters,
    applyFilters,
    clearFilters,
  } = useLibrary();

  // Filters applied to whichever tab is active (each tab keeps its own set).
  const activeFilters = activeTab === "tracks" ? tracksFilters : playlistsFilters;
  const filtersActive = Boolean(
    activeFilters.search || activeFilters.startDate || activeFilters.endDate || activeFilters.numTracks || activeFilters.favoritesOnly
  );
  // The Filters panel button reflects ONLY the panel's own filters — favorites now has its own
  // standalone toggle next to Filters/Refresh, so it must not light up the Filters button.
  const panelFiltersActive = Boolean(
    activeFilters.search || activeFilters.startDate || activeFilters.endDate || activeFilters.numTracks
  );
  // Favorites is a playlists-only, apply-immediately toggle (maps to own_favorites). Flipping it
  // preserves any other applied filters.
  const favoritesOnly = activeTab === "playlists" && playlistsFilters.favoritesOnly;
  const toggleFavoritesOnly = () =>
    applyFilters("playlists", { ...playlistsFilters, favoritesOnly: !playlistsFilters.favoritesOnly });

  // Whether the collapsible filter panel is shown (hidden by default to keep the view clean).
  const [showFilters, setShowFilters] = useState(false);

  // Derived view of whichever tab is selected (each section has its own slice / paging / loading).
  const activePlaylists = playlists;
  const activeLoading = activeTab === "tracks" ? tracksLoading : playlistsLoading;
  const activePage = activeTab === "tracks" ? tracksPage : playlistsPage;
  const activeTotalPages = activeTab === "tracks" ? tracksTotalPages : playlistsTotalPages;

  // Status Message states
  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTitle, setStatusTitle] = useState("");

  // Track deletion confirmation state
  const [trackToDelete, setTrackToDelete] = useState<{ id: string; title: string } | null>(null);

  // Playlist deletion confirmation state
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);

  // Visibility (public/private) toggle confirmation — holds the playlist + its CURRENT state.
  const [visibilityFor, setVisibilityFor] = useState<{ uuid: string; isPublic: boolean } | null>(null);
  const [visibilityBusy, setVisibilityBusy] = useState(false);

  // Rename modal — holds the playlist being renamed (same modal/flow as the playlist page). In the
  // library it also carries `hasCustomCover`, so the modal can host the cover editor.
  const [renameFor, setRenameFor] = useState<{ uuid: string; name: string; hasCustomCover: boolean } | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);

  // Share modal — mobile only. On mobile we open the SAME PlaylistShare modal the playlist page uses
  // (its "Share" button fires the native share sheet on a fresh tap). Desktop keeps the instant
  // copy-link flow below, unchanged.
  const [shareFor, setShareFor] = useState<{ uuid: string; name: string } | null>(null);

  // Apple Music export — reuses the playlist page's flow: verdict gate (login/upgrade) → the shared
  // AppleExportModal (which handles the connect check + export). Holds the playlist uuid to export.
  const access = useAccess();
  const [exportPlaylistId, setExportPlaylistId] = useState<string | null>(null);
  const [exportGate, setExportGate] = useState<{ reason: string; title: string; body: string } | null>(null);
  // Embed (iframe) — open for everyone; the modal guards on public/private itself.
  const [embedFor, setEmbedFor] = useState<{ uuid: string; isPublic: boolean } | null>(null);

  const handleExportApple = (uuid: string) => {
    setActiveMenuId(null);
    const v = access.verdict("exportApple");
    if (v === "pending") return;
    if (v === "allowed") {
      setExportPlaylistId(uuid);
      return;
    }
    if (v === "login") {
      setExportGate({
        reason: "login_required",
        title: "Log in to export",
        body: "Create a free account or log in to export your playlists to Apple Music.",
      });
    } else {
      setExportGate({
        reason: "upgrade_required",
        title: "Upgrade to export to Apple Music",
        body: "Sending your playlist straight to your Apple Music library is a Pro feature. Upgrade your plan to unlock Apple Music export.",
      });
    }
  };

  const handleExportEmbed = (uuid: string, isPublic: boolean) => {
    setActiveMenuId(null);
    setEmbedFor({ uuid, isPublic });
  };

  // Cover changed from inside the rename modal: sync the row, close every modal, confirm.
  const handleCoverUpdated = () => {
    const uuid = renameFor?.uuid;
    setRenameFor(null);
    if (uuid) markPlaylistCoverUpdated(uuid);
    handleStatusChange("success", "Your playlist cover has been updated.", "Cover Updated");
  };

  const handleCoverError = (message: string) => {
    setRenameFor(null);
    handleStatusChange("error", message, "Cover Update Failed");
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renameFor) return;
    const { uuid } = renameFor;
    setRenameBusy(true);
    handleStatusChange("loading", "Renaming playlist...", "Renaming");
    const result = await renamePlaylist(uuid, newName);
    setRenameBusy(false);
    setRenameFor(null);
    if (result.success) {
      handleStatusChange("success", "", "Playlist renamed!");
    } else {
      handleStatusChange("error", result.error || "Failed to rename playlist", "Error");
    }
  };

  const handleConfirmVisibility = async () => {
    if (!visibilityFor) return;
    const { uuid, isPublic } = visibilityFor;
    setVisibilityBusy(true);
    const result = await setPlaylistVisibility(uuid, !isPublic);
    setVisibilityBusy(false);
    setVisibilityFor(null);
    if (result.success) {
      handleStatusChange("success", `Playlist is now ${!isPublic ? "public" : "private"}.`, "Visibility Updated");
    } else {
      handleStatusChange("error", result.error || "Failed to update visibility", "Error");
    }
  };

  // Toggle a playlist's favorite state from its row heart (optimistic in the hook; reverts on
  // failure). Under the favorites-only filter, un-favoriting also drops the row (handled in the hook).
  const handleToggleFavorite = async (uuid: string, isFavorite: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await toggleFavorite(uuid, !isFavorite);
    if (!result.success) {
      handleStatusChange("error", result.error || "Failed to update favorite", "Error");
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
    if (tabParam === "playlists" || tabParam === "tracks") {
      setActiveTab(tabParam);
    } else if (tabParam === "favorites") {
      // Favorites is no longer a tab — favorites live inline on Playlists. Redirect legacy links.
      setSearchParams({ tab: "playlists" }, { replace: true });
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

  // On arrival (and on login) load both sections, so every tab's count is populated and switching
  // tabs is instant (data lives in the store). A full page reload or the Refresh button refetches —
  // deliberately NOT re-run when the user merely switches tabs.
  useEffect(() => {
    if (!isAuthenticated) return;
    loadPlaylists(1);
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

  // Refresh only the currently-selected tab (keeps the other as-is).
  const handleRefresh = () => {
    if (activeTab === "playlists") loadPlaylists(playlistsPage);
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

  const handleSharePlaylist = async (uuid: string, isAlreadyPublic: boolean, name: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Mobile: match the playlist page — ensure the playlist is public, then open the PlaylistShare
    // modal whose "Share" button opens the native share sheet (share to other apps).
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      if (!isAlreadyPublic) {
        const result = await sharePlaylist(uuid);
        if (!result.success) {
          handleStatusChange("error", result.error || "Failed to share playlist", "Sharing Failed");
          return;
        }
      }
      setShareFor({ uuid, name }); // modal receives an already-public playlist
      return;
    }

    // Desktop (unchanged): make public if needed, then copy the link.
    const shareUrl = `${window.location.origin}/sonic-discovery?id=${uuid}`;

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
    else if (activeTab === "tracks" && tracksPage > 1) loadTracks(tracksPage - 1);
  };

  const handleNextPage = () => {
    if (activeTab === "playlists" && playlistsPage < playlistsTotalPages) loadPlaylists(playlistsPage + 1);
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
              onClick={() => setSearchParams({ tab: "tracks" }, { replace: true })}
              className={`text-[length:var(--px-16)] font-semibold font-helvetica uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "tracks"
                  ? "text-[var(--color-primary-hover)] border-b border-[var(--color-primary)]"
                  : "text-slate-400 hover:text-[var(--color-primary)]"
              }`}
            >
              Uploads ({tracksTotal})
            </button>
          </div>

          {/* Persistent controls: a Filters toggle (reveals the collapsible filter panel) next to
              Refresh. Keeping filters hidden by default keeps the list clean. */}
          <div className="flex flex-wrap justify-end items-center gap-[var(--px-8)] mb-[var(--px-15)]">
            {activeTab === "playlists" && (
              <button
                type="button"
                onClick={toggleFavoritesOnly}
                disabled={activeLoading}
                aria-pressed={favoritesOnly}
                aria-label={favoritesOnly ? "Show all playlists" : "Show only favorites"}
                className="flex items-center gap-[var(--px-8)] px-[var(--px-14)] py-[var(--px-6)] border border-dotted border-white/20 hover:border-white/50 disabled:opacity-40 disabled:cursor-not-allowed text-white/80 text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer rounded-xs"
              >
                Favorites
                {/* Switch glyph — same treatment as the playlist Autoplay toggle: neon + knob right
                    when on, white + knob left when off. */}
                <svg
                  viewBox="0 0 28 16"
                  className={`h-[var(--px-16)] w-[var(--px-28)] shrink-0 ${favoritesOnly ? "text-[var(--rx-color-accent)]" : "text-white/70"}`}
                  fill="none"
                  aria-hidden="true"
                >
                  <rect x="1" y="1" width="26" height="14" rx="7" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx={favoritesOnly ? 20 : 8} cy="8" r="4" fill="currentColor" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`flex items-center gap-[var(--px-8)] px-[var(--px-14)] py-[var(--px-6)] border border-dotted text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer rounded-xs ${
                showFilters || panelFiltersActive
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-white/20 hover:border-white/50 text-white/80"
              }`}
            >
              <svg className="w-[var(--px-14)] h-[var(--px-14)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              Filters
              {panelFiltersActive && <span aria-hidden="true" className="w-[var(--px-6)] h-[var(--px-6)] rounded-full bg-[var(--color-primary)]" />}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={activeLoading}
              className="flex items-center gap-[var(--px-8)] px-[var(--px-14)] py-[var(--px-6)] border border-dotted border-white/20 hover:border-white/50 disabled:opacity-40 disabled:cursor-not-allowed text-white/80 text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer rounded-xs"
              aria-label="Refresh"
            >
              <svg className={`w-[var(--px-14)] h-[var(--px-14)] ${activeLoading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Collapsible filter panel (search / date / min-tracks / favorites-only) + Apply / Clear. */}
          {showFilters && (
            <LibraryFilters
              activeTab={activeTab}
              applied={activeFilters}
              loading={activeLoading}
              onApply={(f) => applyFilters(activeTab, f)}
              onClear={() => clearFilters(activeTab)}
            />
          )}

          {error && (
            <div className="p-[var(--px-20)] mb-[var(--px-20)] text-center border border-red-500/30 bg-red-500/5 text-red-400 font-fira text-[length:var(--px-14)] rounded-md">
              {error}
            </div>
          )}

          {activeLoading ? (
            <div className="p-[var(--px-40)] text-center text-slate-400 font-fira">
              Loading your library...
            </div>
          ) : activeTab === "playlists" ? (
            activePlaylists.length === 0 ? (
              <div className="p-[var(--px-40)] border border-slate-200 border-dotted rounded-lg text-center">
                <p className="text-[length:var(--px-14)] font-light font-helvetica opacity-60">
                  {filtersActive
                    ? "No playlists match your filters. Try adjusting or clearing them."
                    : "Your library has no playlists. Generate some playlists by searching or uploading a track."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-[var(--px-12)] w-full">
                {activePlaylists.map((playlist) => {
                  const metaLine = `${playlist.trackCount} tracks | ${playlist.duration} | Created ${new Date(playlist.createdAt).toLocaleDateString()}`;
                  return (
                  <div
                    key={playlist.uuid}
                    className="w-full border border-dotted border-slate-200/60 p-[var(--px-12)] md:p-[var(--px-16)] flex flex-wrap md:flex-nowrap items-center md:justify-between gap-y-[var(--px-10)] relative rounded-xs hover:bg-white/5 transition-colors"
                  >
                    {/* Aligned top content layout. min-w-0 is REQUIRED: this column is flex-grow, and
                        without it a flex item won't shrink below its content's intrinsic width, so the
                        title's `truncate` never engages and a long name overflows the card. */}
                    <div className="basis-full md:basis-auto flex items-start gap-[var(--px-10)] md:gap-[var(--px-20)] flex-grow min-w-0 md:pr-[var(--px-15)]">
                      {/* Playlist link (image). Real <a> so right-click / ⌘-click open a new tab;
                          a plain click is intercepted for SPA navigation. */}
                      <a
                        href={`/sonic-discovery?id=${playlist.uuid}`}
                        onClick={(e) => {
                          if (shouldOpenInNewTab(e)) return;
                          e.preventDefault();
                          navigate(`/sonic-discovery?id=${playlist.uuid}`, { state: { from: "library" } });
                        }}
                        className="flex-shrink-0 cursor-pointer"
                      >
                        {/* Playlist cover precedence: custom playlist cover (by playlist uuid) →
                            seed track cover (by uuid + token) → bundled Resomix default. */}
                        <div className="border border-dotted border-slate-200 bg-black/40 hover:border-[var(--color-primary-hover)] transition-colors overflow-hidden w-[var(--px-32)] h-[var(--px-32)] md:w-[var(--px-52)] md:h-[var(--px-52)]">
                          <CoverThumbnail playlistUuid={playlist.uuid} hasCustomCover={playlist.hasCustomCover} bust={playlist.coverBust} className="w-full h-full object-cover" />
                        </div>
                      </a>

                      {/* Stacked Text Column */}
                      <div className="flex flex-col gap-[var(--px-4)] flex-grow min-w-0">
                        {/* Title + rename pen on one row. min-w-0 + truncate keep a long name from
                            pushing the pen off; the pen opens the same rename modal as the playlist page. */}
                        <div className="flex items-center gap-[var(--px-8)] min-w-0">
                          {/* Playlist title link — same open-in-new-tab / SPA behaviour. */}
                          <a
                            href={`/sonic-discovery?id=${playlist.uuid}`}
                            title={playlist.name}
                            onClick={(e) => {
                              if (shouldOpenInNewTab(e)) return;
                              e.preventDefault();
                              navigate(`/sonic-discovery?id=${playlist.uuid}`, { state: { from: "library" } });
                            }}
                            className="text-[length:var(--px-14)] md:text-[length:var(--px-16)] font-semibold font-helvetica uppercase leading-tight hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer truncate min-w-0 grow md:grow-0"
                          >
                            {playlist.name}
                          </a>
                          <Tooltip message="Rename playlist">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setRenameFor({ uuid: playlist.uuid, name: playlist.name, hasCustomCover: !!playlist.hasCustomCover });
                              }}
                              aria-label="Rename playlist"
                              className="flex-shrink-0 text-white/50 hover:text-[var(--color-primary-hover)] cursor-pointer flex items-center justify-center p-[var(--px-2)] hover:scale-110 active:scale-90 transition-all bg-transparent border-0 outline-none"
                            >
                              {/* Pencil-with-underline (edit) — currentColor so the button's hover drives it. */}
                              <svg
                                className="w-[var(--px-13)] h-[var(--px-13)] md:w-[var(--px-15)] md:h-[var(--px-15)] fill-none stroke-current"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>
                          </Tooltip>
                        </div>

                        {/* Meta row. Desktop: stacked under the title. Mobile: hidden here and shown
                            on the bottom row (left of the actions) — see the mobile meta block below. */}
                        <div className="hidden md:block text-[length:var(--px-10)] font-light font-fira text-white/60">
                          <p>{metaLine}</p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom band. Mobile: its own row — meta on the left (wraps within the remaining
                        space) and the action icons pinned to the right. Desktop: `md:contents` dissolves
                        this wrapper so the action cluster becomes a direct card child and floats to the far
                        right exactly as before (meta is shown under the title above instead). */}
                    <div className="basis-full flex items-center justify-between gap-[var(--px-12)] md:contents">
                      {/* Mobile-only meta — left of the icons; allowed to wrap over multiple lines. */}
                      <div className="md:hidden min-w-0 flex-grow text-[length:var(--px-10)] font-light font-fira text-white/60">
                        <p>{metaLine}</p>
                      </div>

                      {/* Action cluster — heart / visibility / kebab. */}
                      <div className="flex items-center gap-[var(--px-10)] md:gap-[var(--px-15)] flex-shrink-0">
                      {/* Favorite heart — toggles favorite state inline (replaces the old Favorites tab). */}
                      <Tooltip message={playlist.is_favorite ? "Remove from Favorites" : "Add to Favorites"}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(playlist.uuid, playlist.is_favorite, e)}
                          aria-label={playlist.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                          aria-pressed={playlist.is_favorite}
                          className="text-white/60 hover:text-white cursor-pointer flex items-center justify-center p-[var(--px-4)] hover:scale-110 active:scale-90 transition-all bg-transparent border-0 outline-none"
                        >
                          {playlist.is_favorite ? (
                            <HeartFilledIcon customWidth="18" customHeight="18" className="text-white" disableHover={true} />
                          ) : (
                            <HeartStrokeIcon customWidth="18" customHeight="18" className="text-white/70" disableHover={true} />
                          )}
                        </button>
                      </Tooltip>

                      {/* Visibility (public/private) toggle. */}
                      <Tooltip message={playlist.is_public ? "Public — click to make private" : "Private — click to make public"}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVisibilityFor({ uuid: playlist.uuid, isPublic: playlist.is_public });
                          }}
                          aria-label={playlist.is_public ? "Make playlist private" : "Make playlist public"}
                          className="text-white/60 hover:text-white cursor-pointer flex items-center justify-center p-[var(--px-4)] hover:scale-110 active:scale-90 transition-all bg-transparent border-0 outline-none"
                        >
                          {playlist.is_public ? (
                            <PublicIcon customWidth="14" customHeight="14" disableHover />
                          ) : (
                            <PrivateIcon customWidth="14" customHeight="14" disableHover />
                          )}
                        </button>
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
                                onClick: () => window.open(`/sonic-discovery?id=${playlist.uuid}`, "_blank"),
                              },
                              {
                                id: `playlist-share-${playlist.uuid}`,
                                label: "Share",
                                icon: (
                                  <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
                                  </svg>
                                ),
                                onClick: (e: React.MouseEvent) => handleSharePlaylist(playlist.uuid, playlist.is_public, playlist.name, e),
                              },
                            ].map((item, index) => (
                              <div key={item.id}>
                                {index > 0 && (
                                  <div className="border-t border-dotted border-slate-200/30 mx-[var(--px-12)] my-[var(--px-4)]" />
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

                            {/* Export → secondary flyout of targets (Apple Music for now). */}
                            <div className="border-t border-dotted border-slate-200/30 mx-[var(--px-12)] my-[var(--px-4)]" />
                            <ExportSubmenu onExportApple={() => handleExportApple(playlist.uuid)} onEmbed={() => handleExportEmbed(playlist.uuid, playlist.is_public)} />

                            {/* Delete (separated, destructive). */}
                            <div className="border-t border-dotted border-slate-200/60 mx-[var(--px-12)] my-[var(--px-4)]" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                handleDeletePlaylist(playlist.uuid, e);
                              }}
                              className="w-full flex items-center gap-[var(--px-12)] px-[var(--px-16)] py-[var(--px-8)] text-[length:var(--px-12)] font-light font-helvetica hover:bg-white/5 active:bg-white/10 transition-colors duration-150 cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
                                <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                                </svg>
                              </span>
                              <span className="whitespace-nowrap leading-none">Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )
          ) : (
            tracks.length === 0 ? (
              <div className="p-[var(--px-40)] border border-slate-200 border-dotted rounded-lg text-center">
                <p className="text-[length:var(--px-14)] font-light font-helvetica opacity-60">
                  {filtersActive
                    ? "No tracks match your filters. Try adjusting or clearing them."
                    : "No saved tracks. Upload tracks or find similarity matches to add to your track collection."}
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
                      className="w-full border border-dotted border-slate-200/60 p-[var(--px-12)] md:p-[var(--px-16)] flex flex-wrap justify-between items-center gap-y-[var(--px-10)] relative hover:bg-white/5 transition-colors"
                    >
                      {/* Track identity block. The track title/image are NOT links — the track's
                          artifacts are reached via the capsules; the row itself doesn't navigate.
                          Right padding clears the absolutely-positioned top-right kebab. */}
                      <div className="flex items-start gap-[var(--px-10)] md:gap-[var(--px-20)] flex-grow min-w-0 pr-[var(--px-32)]">
                        {/* Non-clickable cover: the uploaded track's cover (media server, by uuid),
                            else the bundled Resomix default — consistent with playlist covers. */}
                        <div className="flex-shrink-0">
                          <div className="border border-dotted border-slate-200 bg-black/40 overflow-hidden w-[var(--px-32)] h-[var(--px-32)] md:w-[var(--px-52)] md:h-[var(--px-52)]">
                            <CoverThumbnail uuid={track.id} className="w-full h-full object-cover" />
                          </div>
                        </div>

                        {/* Stacked Text Column — title + meta are display-only (not selectable). */}
                        <div className="flex flex-col gap-[var(--px-4)] flex-grow min-w-0 select-none">
                          <h3
                            title={track.title}
                            className="text-[length:var(--px-14)] md:text-[length:var(--px-16)] font-semibold font-helvetica uppercase leading-tight line-clamp-2 md:line-clamp-1 break-words"
                          >
                            {track.title}
                          </h3>

                          {/* Labelled meta pairs (fixed order; absent fields skipped) */}
                          <TrackMetaRow track={track} />
                        </div>
                      </div>

                      {/* Kebab — top-right on BOTH breakpoints. */}
                      <div className="absolute top-[var(--px-8)] right-[var(--px-8)]" onClick={e => e.stopPropagation()}>
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

                      {/* Desktop: capsules right-aligned in the row (right padding clears the
                          top-right kebab). */}
                      <div className="hidden md:flex items-center justify-end w-full pr-[var(--px-28)]" onClick={e => e.stopPropagation()}>
                        <TrackArtifactChips
                          track={track}
                          onOpenPlaylist={(uuid) => navigate(`/sonic-discovery?id=${uuid}`, { state: { from: "library" } })}
                          onOpenAnalysis={(uuid) => navigate(`/analysis?id=${uuid}`, { state: { from: "library" } })}
                          onComingSoon={() => handleStatusChange("success", "Analysis is coming soon!", "Feature Coming Soon")}
                        />
                      </div>

                      {/* Mobile: the two capsules as full-width rows at the bottom of the card
                          (the card is flex-wrap, so this w-full block wraps onto its own line). */}
                      <div className="w-full md:hidden" onClick={e => e.stopPropagation()}>
                        <TrackArtifactChips
                          track={track}
                          layout="stacked"
                          onOpenPlaylist={(uuid) => navigate(`/sonic-discovery?id=${uuid}`, { state: { from: "library" } })}
                          onOpenAnalysis={(uuid) => navigate(`/analysis?id=${uuid}`, { state: { from: "library" } })}
                          onComingSoon={() => handleStatusChange("success", "Analysis is coming soon!", "Feature Coming Soon")}
                        />
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

      {/* Visibility (public/private) toggle confirmation */}
      <StatusMessage
        isOpen={!!visibilityFor}
        onClose={() => setVisibilityFor(null)}
        status="custom"
      >
        <div className="text-center w-full">
          <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
            {visibilityFor?.isPublic ? "Make Playlist Private" : "Make Playlist Public"}
          </div>
          <div className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-15)] mt-[var(--px-10)]">
            {visibilityFor?.isPublic
              ? "This playlist will no longer be reachable by its share link — only you can open it."
              : "Anyone with the link will be able to open this playlist."}
          </div>
        </div>

        <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
          <button
            onClick={() => setVisibilityFor(null)}
            disabled={visibilityBusy}
            className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmVisibility}
            disabled={visibilityBusy}
            className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)] hover:opacity-90 text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer flex justify-center items-center disabled:opacity-50"
          >
            {visibilityBusy ? "Updating…" : (visibilityFor?.isPublic ? "Make Private" : "Make Public")}
          </button>
        </div>
      </StatusMessage>

      {/* Share (mobile) — the SAME modal the playlist page uses; its Share button opens the native
          share sheet. We pass an already-public playlist so it only builds the link + shares. */}
      <PlaylistShare
        isOpen={!!shareFor}
        onClose={() => setShareFor(null)}
        id={shareFor?.uuid ?? ""}
        playlist={shareFor ? { id: shareFor.uuid, name: shareFor.name, is_public: true } : undefined}
      />

      {/* Rename playlist — same shared modal as the playlist page, plus the library-only `cover`
          slot so the cover can be changed from here too (the hero omits the prop and is unchanged). */}
      <PlaylistRenameModal
        isOpen={!!renameFor}
        initialName={renameFor?.name || ""}
        submitting={renameBusy}
        onClose={() => setRenameFor(null)}
        onSubmit={handleRenameSubmit}
        cover={
          renameFor ? (
            <PlaylistCoverEditor
              playlistUuid={renameFor.uuid}
              hasCustomCover={renameFor.hasCustomCover}
              onUpdated={handleCoverUpdated}
              onError={handleCoverError}
            />
          ) : null
        }
      />

      {/* Apple Music export — the SAME modal + entitlement gate the playlist page uses. */}
      <AppleExportModal
        isOpen={!!exportPlaylistId}
        onClose={() => setExportPlaylistId(null)}
        onStatusChange={handleStatusChange}
        initialPlaylistId={exportPlaylistId ?? undefined}
      />
      <GateCtaModal
        reason={exportGate?.reason ?? null}
        title={exportGate?.title}
        body={exportGate?.body}
        onClose={() => setExportGate(null)}
      />

      {/* Embed (iframe) — public-only; guarded inside the modal. */}
      <EmbedModal
        isOpen={!!embedFor}
        onClose={() => setEmbedFor(null)}
        playlistUuid={embedFor?.uuid ?? ""}
        isPublic={!!embedFor?.isPublic}
        onMakePublic={async () => {
          if (!embedFor) return false;
          const res = await setPlaylistVisibility(embedFor.uuid, true);
          return !!res?.success;
        }}
        onStatusChange={handleStatusChange}
      />
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
