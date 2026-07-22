import React, { useEffect } from "react";
import { IconButton, HoverFlow, StatusMessage, Tooltip, PrivateIcon, PublicIcon, HeartStrokeIcon, HeartFilledIcon, ToggleButton } from "@resomix/ui";
import { formatDuration, usePlaylistExport, useAccess, useFavoritePlaylist, usePlaylistVisibility, type AccessAction } from "@resomix/hooks";
import { usePlaylistStore, usePlayerStore, useAuthStore } from "@resomix/stores";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { resolveLabel } from "@/utils/trackUtils.ts";
import { useNavigate, useLocation } from "react-router-dom";
import { InputPlayer, PlaylistRating, PlaylistRename, PlaylistExport, PlaylistShare } from "@/components/index.ts";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import AppleExportModal from "@/components/Modals/Transfer/AppleExportModal.tsx";
import RenameSvg from "@/assets/icons/rename.svg";
import RenameBlackSvg from "@/assets/icons/rename_black.svg";
import ExportSvg from "@/assets/icons/export.svg";
import ExportBlackSvg from "@/assets/icons/export_black.svg";
import ShareSvg from "@/assets/icons/share.svg";
import ShareBlackSvg from "@/assets/icons/share_black.svg";
import AngleLeftSvg from "@/assets/icons/angle_left.svg";
import StarSvg from "@/assets/icons/star.svg";
import TrackSvg from "@/assets/icons/track_2.svg";
import TimeSvg from "@/assets/icons/time.svg";
import InfoSvg from "@/assets/icons/info.svg";
import { AppleMusicBadge } from "@/components/Playlist/AppleMusicBadge.tsx";

const InputTrackStatus = "Loading..."

const PlaylistHero: React.FC = () => {
  const [showMeta, setShowMeta] = React.useState(false);
  const [showRating, setShowRating] = React.useState(false);
  const [showRename, setShowRename] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);

  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [showDownloadExport, setShowDownloadExport] = React.useState(false);
  const [showAppleExport, setShowAppleExport] = React.useState(false);

  const [showStatus, setShowStatus] = React.useState(false);
  const [statusType, setStatusType] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [statusTitle, setStatusTitle] = React.useState('');
  const [showLoginButton, setShowLoginButton] = React.useState(false);
  const [forkedPlaylistId, setForkedPlaylistId] = React.useState<string | null>(null);
  // const [hasForkedThisPlaylist, setHasForkedThisPlaylist] = React.useState(false);

  const { playlistData, isLoading, error } = usePlaylistStore();
  const { autoplay, setAutoplay, uploadedCoverArt } = usePlayerStore();
  const { canExport, isExporting } = usePlaylistExport();
  // Single source of truth for gated actions (share/rename/favorite/…): useAccess merges the
  // client auth flag with the server entitlements and yields one verdict per action —
  // allowed | login | upgrade | pending. While "pending" the control is dimmed and a click is a
  // no-op; we NEVER show a login/upgrade modal from an unsettled state (that's the bug where a
  // logged-in user was told to log in). The overall "Rate These Results" (playlist rating +
  // feedback) stays open to guests (visitor_id), so it is NOT gated here.
  const access = useAccess();
  // Favorite/unfavorite the current playlist (heart top-right of the card). Guests are prompted to
  // log in; the backend rejects favoriting a guest-created playlist and that message is surfaced.
  const { isFavorite, toggleFavorite } = useFavoritePlaylist();
  // Login/upgrade gate prompt for actions the current tier can't do (guests see rename/export but
  // are intercepted with a "log in" modal rather than the button being hidden).
  const [gate, setGate] = React.useState<{ reason: string; title: string; body: string } | null>(null);
  /** Run `action` if allowed; otherwise raise the correct gate. Pending → no-op (control is dimmed). */
  const withAccess = (action: AccessAction, title: string, body: string, run: () => void) => {
    const v = access.verdict(action);
    if (v === "pending") return;
    if (v === "allowed") return run();
    setGate({ reason: v === "login" ? "login_required" : "upgrade_required", title, body });
  };
  // Dim gated controls until the verdicts are real.
  const accessDim = access.ready ? "" : " opacity-60";
  // Public/private toggle of the CURRENT playlist. Only a logged-in user can toggle (the owner);
  // logged-out users see the badge as a read-only status (unchanged). The backend enforces
  // owner-only and returns 403 for a non-owner, which is surfaced via the status message.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setVisibility } = usePlaylistVisibility();
  const [visibilityConfirm, setVisibilityConfirm] = React.useState(false);
  const [visibilityBusy, setVisibilityBusy] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const exportButtonWrapRef = React.useRef<HTMLDivElement | null>(null);
  const exportMenuRef = React.useRef<HTMLDivElement | null>(null);

  // Reset fork state when playlist changes
  useEffect(() => {
    // setHasForkedThisPlaylist(false);
    setForkedPlaylistId(null);
  }, [playlistData?.playlist?.id]);

  const handleStatusChange = (type: 'loading' | 'success' | 'error', message: string, title?: string) => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title || '');
    setShowStatus(true);
  };

  const handleConfirmVisibility = async () => {
    const id = playlistData?.playlist?.id;
    const isPublic = !!playlistData?.playlist?.is_public;
    if (!id) return;
    setVisibilityBusy(true);
    const res = await setVisibility(id, !isPublic);
    setVisibilityBusy(false);
    setVisibilityConfirm(false);
    if (res.ok) {
      handleStatusChange('success', `Playlist is now ${!isPublic ? 'public' : 'private'}.`, 'Visibility Updated');
    } else {
      handleStatusChange('error', res.error || 'Failed to update visibility', 'Error');
    }
  };

  const handleFavoriteClick = async () => {
    withAccess("favorite", "Log in to save favorites", "Create a free account or log in to add playlists to your favorites.", async () => {
      const res = await toggleFavorite();
      if (res.gated) {
        // Backstop from the hook (client auth flag says guest) — same login gate.
        setGate({ reason: "login_required", title: "Log in to save favorites", body: "Create a free account or log in to add playlists to your favorites." });
      } else if (!res.ok && res.error) {
        handleStatusChange('error', res.error, 'Favorites');
      }
    });
  };

  const handleRenameClose = () => setShowRename(false);
  const handleShareClose = () => setShowShare(false);
  const handleRatingClose = () => setShowRating(false);
  const handleDownloadExportClose = () => setShowDownloadExport(false);



  const handleStatusClose = () => {
    setShowStatus(false);
    // Don't clear forkedPlaylistId or hasForkedThisPlaylist here - keep them for the button to work
  };

  // The Export button just opens the menu (for everyone — guests included). Each option inside is
  // gated individually on click, so the menu always shows what's available and explains the gate
  // where it's hit (matches the requirement: the Apple option is visible to free users but gated).
  const handleExportButtonClick = () => {
    if (isExporting) return;
    setShowExportMenu((v) => !v);
  };

  // TXT download — gated on the plan's `can_export` capability.
  const handleDownloadExportClick = () => {
    setShowExportMenu(false);
    withAccess("export", "Log in to export", "Create a free account or log in to export your playlists.", () => {
      if (!canExport) {
        handleStatusChange('error', 'No playlist data available to export', 'Export Failed');
        return;
      }
      setShowDownloadExport(true);
    });
  };

  // Apple Music export — visible to everyone; gated on the `export_targets` entitlement containing
  // "apple". Guests get a login prompt, free users an upgrade prompt, entitled users the modal.
  const handleAppleExportClick = () => {
    setShowExportMenu(false);
    const v = access.verdict("exportApple");
    if (v === "pending") return;
    if (v === "allowed") {
      setShowAppleExport(true);
      return;
    }
    if (v === "login") {
      setGate({
        reason: "login_required",
        title: "Log in to export",
        body: "Create a free account or log in to export your playlists to Apple Music.",
      });
    } else {
      setGate({
        reason: "upgrade_required",
        title: "Upgrade to export to Apple Music",
        body: "Sending your playlist straight to your Apple Music library is a Pro feature. Upgrade your plan to unlock Apple Music export.",
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        showExportMenu &&
        exportButtonWrapRef.current &&
        exportMenuRef.current &&
        !exportButtonWrapRef.current.contains(target) &&
        !exportMenuRef.current.contains(target)
      ) {
        setShowExportMenu(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showExportMenu) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showExportMenu]);

  // // Fork functionality with StatusMessage
  // const { fork, forking } = usePlaylistFork({
  //   onError: (title, message) => {
  //     // Check if the error is authentication related
  //     const isAuthError = message.toLowerCase().includes('not authenticated') ||
  //       message.toLowerCase().includes('log in');
  //     setShowLoginButton(isAuthError);
  //     setForkedPlaylistId(null); // Clear forked playlist ID on error
  //     handleStatusChange('error', message, title);
  //   },
  //   onSuccess: (title, message, response) => {
  //     setShowLoginButton(false);
  //     setHasForkedThisPlaylist(true); // Mark as forked locally
  //     // Store the forked playlist ID from the response
  //     if (response?.data?.playlist?.id) {
  //       setForkedPlaylistId(response.data.playlist.id);
  //     }
  //     handleStatusChange('success', message, title);
  //   },
  // });

  // const handleForkClick = async () => {
  //   if (DEMO_MODE || !playlistData?.playlist.id || forking) return;
  //   await fork(playlistData.playlist.id);
  // };

  const handleLoginClick = () => {
    setShowLoginButton(false);
    setShowStatus(false);
    // Preserve path + query (the ?id=) so login returns to this exact playlist.
    navigate(`/auth/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
  };

  const handleOpenYourCopyClick = () => {
    if (forkedPlaylistId) {
      setShowStatus(false);
      setForkedPlaylistId(null);
      window.location.href = `${BASE_BETA_URL}/sonic-discovery?id=${forkedPlaylistId}`;
    }
  };

  // Check if playlist is already forked (either from server or locally)
  // const isForked = playlistData?.playlist.fork_id && playlistData.playlist.fork_id.trim() !== '' || hasForkedThisPlaylist;


  return (
    <div className="relative">
      {/* Hidden SVG defs for clip-path */}
      <svg
        viewBox="0 0 1152 628"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-[length:var(--px-628)] pointer-events-none z-10 overflow-visible"
      >
        <defs>
          <clipPath id="heroClip" clipPathUnits="objectBoundingBox">
            <path transform="scale(0.0008680556,0.0015923567)" d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z" />
          </clipPath>
        </defs>

        {/* stroke outline */}
        <path
          d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z"
          stroke="white"
          strokeOpacity="1"
          strokeWidth="1"
          strokeDasharray="0.74 0.74"
          fill="none"
        />
      </svg>

      {/* Clip content inside shape */}
      <div
        className="relative w-[var(--px-1152)] h-[var(--px-628)] mx-auto z-20"
        style={{
          clipPath: "url(#heroClip)",
          WebkitClipPath: "url(#heroClip)"
        }}
      >
        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col items-center justify-between w-full h-full select-none py-[var(--px-55)]">
          <div></div>
          <div className="flex flex-col w-[var(--px-700)] gap-[var(--px-10)]">
            <div className="flex w-full justify-between items-center">
              {location.state?.from === "library" ? (
                <a
                  aria-label="Back to Library"
                  href="/library"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/library");
                  }}
                  className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline playlist-nav-link"
                  id="playlist-hero-back-link"
                >
                  <img src={AngleLeftSvg} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-13)] h-[var(--px-13)]" />
                  Back to Library
                </a>
              ) : (
                <a
                  aria-label="Back to Search"
                  href={BASE_BETA_URL}
                  className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline playlist-nav-link"
                  id="playlist-hero-back-link"
                >
                  <img src={AngleLeftSvg} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-13)] h-[var(--px-13)]" />
                  Back to Search
                </a>
              )}
              <div className="flex items-center gap-[var(--px-8)]">
                <Tooltip message={autoplay ? "Turn off Autoplay" : "Turn on Autoplay"}>
                  <ToggleButton
                    text="Autoplay"
                    customWidth="min-w-[var(--px-120)]"
                    isOn={autoplay}
                    onToggle={setAutoplay}
                    id="playlist-hero-autoplay-toggle"
                  />
                </Tooltip>
                <Tooltip message="Rename your Playlist">
                    <IconButton
                      text="Rename"
                      transparent={true}
                      customWidth="min-w-[var(--px-100)]"
                      onClick={() => withAccess("rename", "Log in to rename", "Create a free account or log in to rename your playlists.", () => setShowRename(true))}
                      icon={<img src={RenameSvg} draggable={false} alt="Rename" aria-label="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                      hoverIcon={<img src={RenameBlackSvg} aria-label="Rename" draggable={false} alt="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                      className={"playlist-action-button" + accessDim}
                      id="playlist-hero-rename-button"
                    />
                  </Tooltip>

                <div ref={exportButtonWrapRef} className="relative">
                  <Tooltip message="Export your Playlist">
                    <IconButton
                      text={isExporting ? "Exporting..." : "Export"}
                      transparent={true}
                      customWidth="min-w-[var(--px-100)]"
                      onClick={handleExportButtonClick}
                      disabled={isExporting}
                      icon={<img src={ExportSvg} draggable={false} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                      hoverIcon={<img src={ExportBlackSvg} draggable={false} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                      className="playlist-action-button"
                      id="playlist-hero-export-button"
                    />
                  </Tooltip>
                  {showExportMenu && (
                    <div
                      ref={exportMenuRef}
                      role="menu"
                      aria-label="Export options"
                      className="absolute right-0 top-[calc(100%+var(--px-6))] z-50 min-w-[var(--px-220)] bg-[var(--color-secondary-background)] text-white border border-dotted border-slate-200 shadow-lg"
                    >
                      <button
                        role="menuitem"
                        className="w-full text-left px-[var(--px-12)] py-[var(--px-10)] hover:bg-white hover:text-black transition-colors text-[length:var(--px-9)] tracking-[var(--px-0-25)] font-light font-fira flex items-center gap-[var(--px-8)]"
                        onClick={handleDownloadExportClick}
                        id="export-menu-download"
                      >
                        Export to TXT
                      </button>
                      <button
                        role="menuitem"
                        className="w-full text-left px-[var(--px-12)] py-[var(--px-10)] hover:bg-white hover:text-black transition-colors text-[length:var(--px-9)] tracking-[var(--px-0-25)] font-light font-fira flex items-center gap-[var(--px-8)] border-t border-dotted border-slate-200/40"
                        onClick={handleAppleExportClick}
                        id="export-menu-apple"
                      >
                        Export to Apple Music
                      </button>
                    </div>
                  )}
                </div>

                <Tooltip message="Share your Playlist">
                  <IconButton
                    text="Share"
                    transparent={true}
                    customWidth="min-w-[var(--px-100)]"
                    onClick={() => withAccess("share", "Log in to share", "Create a free account or log in to share your playlists.", () => setShowShare(true))}
                    icon={<img src={ShareSvg} draggable={false} alt="Share" aria-label="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    hoverIcon={<img src={ShareBlackSvg} aria-label="Share" draggable={false} alt="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    className={"playlist-action-button" + accessDim}
                    id="playlist-hero-share-button"
                  />
                </Tooltip>
              </div>
            </div>

            <div className="relative border border-dotted border-slate-200 p-[var(--px-20)] h-full w-full">
              <div className="flex items-start gap-[var(--px-30)]">
                <div className="flex flex-col items-center gap-[var(--px-10)]">
                  <div className="border border-dotted border-slate-200 p-[var(--px-20)]">
                    {!DEMO_MODE && uploadedCoverArt ? (
                      <img src={uploadedCoverArt} onError={(e) => { e.currentTarget.src = TrackSvg; }} draggable={false} aria-label="Track Cover" alt="Track Cover" className="w-[var(--px-90)] h-[var(--px-90)] object-cover" />
                    ) : (
                      <img src={TrackSvg} draggable={false} alt="Track Cover" aria-label="Track Cover" className="w-[var(--px-90)] h-[var(--px-90)]" />
                    )}
                  </div>
                  <button
                    type="button"
                    name="Rate these Results"
                    onClick={() => setShowRating(true)}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-[var(--px-10)] flex gap-[var(--px-8)] items-end cursor-pointer playlist-rating-button"
                    id="playlist-hero-rating-button"
                    aria-label="Rate these Results"
                    aria-expanded={showRating}
                    data-playlist-id={playlistData?.playlist?.id}
                  >
                    <img src={StarSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-12)] h-[var(--px-12)] mb-[var(--px-2)]" />
                    <span className="text-[length:var(--px-8)] tracking-[var(--px-0-25)] font-light font-fira text-[var(--color-text-primary)]">Rate These Results</span>
                  </button>
                </div>
                <div className="flex flex-col w-full gap-[var(--px-20)] max-w-[var(--px-480)]">
                  <div className="flex flex-col gap-[var(--px-7)] min-h-[var(--px-61)]">
                    {error && (
                      <div className="text-red-500 text-[length:var(--px-9)] font-fira">
                        Error: {error}
                      </div>
                    )}

                    {isLoading ? (
                      <div className="text-[length:var(--px-19)] font-light uppercase font-helvetica leading-[var(--px-24)]">
                        Loading playlist...
                      </div>
                    ) : (
                      <h1 className="text-[length:var(--px-19)] font-light uppercase font-helvetica leading-[var(--px-24)]">
                        <HoverFlow
                          text={playlistData?.playlist?.name || "No playlist data"}
                          maxChars={35}
                          delay={800}
                          speed={80}
                          endPause={1000}
                          maxWidth="400px"
                        />
                      </h1>
                    )}
                    <div className={`text-[length:var(--px-9)] font-light tracking-[var(--px-0-1)] font-fira leading-[var(--px-14)] ${(playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title) === playlistData?.playlist?.name ? 'hidden' : ''}`}>
                      {/* Display only if default is changed */}
                      <HoverFlow
                        text={playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title}
                        maxChars={70}
                        delay={800}
                        speed={80}
                        endPause={1000}
                        maxWidth="400px"
                      />
                    </div>
                    <div className={`${(playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title) === playlistData?.playlist?.name ? '' : 'hidden'}`}></div>
                    <div className="flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-9)] font-light font-fira leading-[var(--px-14)] items-center">
                      <img src={TimeSvg} draggable={false} aria-label="Time" alt="Time" className="w-[var(--px-10)] h-[var(--px-10)]" />
                      <div>{playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}</div>
                      <div>|</div>
                      <div>{playlistData?.queried_track.year}</div>
                      {resolveLabel(playlistData?.queried_track.label) && (
                        <>
                          <div>|</div>
                          <div>{resolveLabel(playlistData?.queried_track.label)}</div>
                        </>
                      )}
                      <Tooltip message={showMeta ? "Hide Meta Info" : "Show Meta Info"}>
                        <button
                          type="button"
                          onClick={() => setShowMeta((v) => !v)}
                          aria-label={showMeta ? "Hide Meta Info" : "Show Meta Info"}
                          aria-expanded={showMeta}
                          className="hover:cursor-pointer playlist-meta-toggle"
                          id="playlist-hero-meta-toggle"
                        >
                          <img draggable={false} src={InfoSvg} alt="" aria-hidden="true" className="w-[var(--px-14)] h-[var(--px-14)] ml-[var(--px-20)]" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[var(--px-10)]">
                    {/* Hidden Meta Info */}
                    <div className={`flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-7)] font-light font-fira leading-[var(--px-14)] items-center h-[var(--px-14)] min-h-[var(--px-14)] ${showMeta ? '' : 'hidden'}`}>
                      <div>ID: {playlistData?.queried_track.id}</div>
                      <div>|</div>
                      <div>Duration: {playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}</div>
                      <div>|</div>
                      <div>Status: {InputTrackStatus}</div>
                      <div>|</div>
                      <div>Mode: Independent</div>
                      <div>|</div>
                      {/* Usage: playlistData?.queried_track.type (either 'upload' or 'internal') */}
                      <div>Instance: Input Track</div>
                    </div>
                    <div className={`h-[var(--px-14)] min-h-[var(--px-14)] ${showMeta ? 'hidden' : ''}`}></div>
                    {/* The actual Input player */}
                    {playlistData?.queried_track.id && (
                      <InputPlayer
                        trackId={playlistData.queried_track.id}
                        totalDuration={playlistData.queried_track.duration ?? 0}
                        playButtonDataAttributes={{
                          'data-testid': 'play-button',
                          'data-track-id': playlistData?.queried_track.id,
                          'data-track-artist': playlistData?.queried_track.artist || '',
                          'data-track-title': playlistData?.queried_track.title || '',
                          'data-track-name': playlistData?.queried_track.title || '',
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute right-[var(--px-10)] top-[var(--px-10)] flex items-center gap-[var(--px-8)]">
                <Tooltip message={isFavorite ? "Remove from favorites" : "Add to favorites"}>
                  <button
                    type="button"
                    onClick={handleFavoriteClick}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    className="mt-[var(--px-6)] cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 playlist-favorite-button"
                    id="playlist-hero-favorite-button"
                  >
                    {isFavorite ? (
                      <HeartFilledIcon customWidth="24" customHeight="24" className="text-white" disableHover={true} />
                    ) : (
                      <HeartStrokeIcon customWidth="24" customHeight="24" className="text-white/60 hover:text-white" />
                    )}
                  </button>
                </Tooltip>
                <Tooltip message={
                  isAuthenticated
                    ? (playlistData?.playlist?.is_public ? "Public — click to make private" : "Private — click to make public")
                    : (playlistData?.playlist?.is_public ? "Playlist is Public" : "Playlist is Private!")
                }>
                  {/* Logged-in owner → clickable toggle; logged-out → read-only status badge. */}
                  {React.createElement(
                    isAuthenticated ? 'button' : 'div',
                    {
                      ...(isAuthenticated
                        ? {
                            type: 'button',
                            onClick: () => setVisibilityConfirm(true),
                            'aria-label': playlistData?.playlist?.is_public ? 'Make playlist private' : 'Make playlist public',
                          }
                        : {}),
                      className: `px-[var(--px-8)] py-[var(--px-4)] rounded-3xl inline-flex justify-center items-center gap-[var(--px-8)] bg-[var(--color-secondary-background)] text-[length:var(--px-9)] tracking-[var(--px-0-25)] font-light font-fira uppercase ${isAuthenticated ? 'cursor-pointer hover:brightness-125 transition-[filter]' : 'cursor-default'} ${playlistData?.playlist?.is_public ? 'text-[#5C5C5C]' : 'text-white'}`,
                    },
                    playlistData?.playlist?.is_public ? (
                      <>
                        <PublicIcon customWidth="10" customHeight="10" className="text-[#5C5C5C] mb-[var(--px-2)]" disableHover={true} />
                        Public
                      </>
                    ) : (
                      <>
                        <PrivateIcon customWidth="12" customHeight="12" className="text-white" disableHover={true} />
                        Private
                      </>
                    )
                  )}
                </Tooltip>
              </div>
              {/* Apple Music attribution — only for a CATALOGUE reference track that actually has a
                  deep link (an 'internal' track with no deep_link_url must not show the badge). */}
              {playlistData?.queried_track?.type === 'internal' && playlistData?.queried_track?.deep_link_url && (
                <div className="absolute right-[var(--px-5)] bottom-[var(--px-0-1)]">
                  <AppleMusicBadge deepLinkUrl={playlistData?.queried_track?.deep_link_url} playing />
                </div>
              )}
            </div>
          </div>
          <div className="text-[var(--color-text-secondary)] text-[length:var(--px-19)] font-light font-helvetica uppercase">SONIC MATCH FOUND - SCORED BY PYXIS-1</div>
        </div>
      </div>

      {/* Modals */}
      <GateCtaModal
        reason={gate?.reason ?? null}
        title={gate?.title}
        body={gate?.body}
        onClose={() => setGate(null)}
      />
      <PlaylistRating
        isOpen={showRating}
        onClose={handleRatingClose}
        onStatusChange={handleStatusChange}
      />
      <PlaylistRename
        isOpen={showRename}
        onClose={handleRenameClose}
        onStatusChange={handleStatusChange}
      />

      <PlaylistShare
        isOpen={showShare}
        onClose={handleShareClose}
        id={playlistData?.playlist?.id ?? ""}
      />

      <PlaylistExport
        isOpen={showDownloadExport}
        onClose={handleDownloadExportClose}
        onStatusChange={handleStatusChange}
      />

      <AppleExportModal
        isOpen={showAppleExport}
        onClose={() => setShowAppleExport(false)}
        onStatusChange={handleStatusChange}
        initialPlaylistId={playlistData?.playlist?.id}
      />

      {/* Status Message */}
      <StatusMessage
        isOpen={showStatus}
        onClose={handleStatusClose}
        status={statusType}
        message={statusMessage}
        title={statusTitle}
        additionalButton={showLoginButton ? {
          text: 'Log In',
          transparent: false,
          onClick: handleLoginClick,
          disabled: false,
        } : forkedPlaylistId ? {
          text: 'Open Your Own Copy',
          transparent: false,
          onClick: handleOpenYourCopyClick,
          disabled: false,
        } : undefined}
      />

      {/* Public/private toggle confirmation */}
      <StatusMessage
        isOpen={visibilityConfirm}
        onClose={() => setVisibilityConfirm(false)}
        status="custom"
      >
        <div className="text-center w-full">
          <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
            {playlistData?.playlist?.is_public ? "Make Playlist Private" : "Make Playlist Public"}
          </div>
          <div className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-15)] mt-[var(--px-10)]">
            {playlistData?.playlist?.is_public
              ? "This playlist will no longer be reachable by its share link — only you can open it."
              : "Anyone with the link will be able to open this playlist."}
          </div>
        </div>
        <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
          <button
            onClick={() => setVisibilityConfirm(false)}
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
            {visibilityBusy ? "Updating…" : (playlistData?.playlist?.is_public ? "Make Private" : "Make Public")}
          </button>
        </div>
      </StatusMessage>
    </div>
  );
};

export default PlaylistHero;