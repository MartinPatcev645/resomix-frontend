import React, { useEffect } from "react";
import { IconButton, StatusMessage, Tooltip, PrivateIcon, PublicIcon, HeartStrokeIcon, HeartFilledIcon, ToggleButton } from "@resomix/ui";
import { formatDuration, usePlaylistExport, useAccess, useFavoritePlaylist, usePlaylistVisibility, usePlaylistCover, type AccessAction } from "@resomix/hooks";
import { usePlaylistStore, usePlayerStore, useAuthStore } from "@resomix/stores";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";
import { resolveLabel } from "@/utils/trackUtils.ts";
import { autoFluidGridStyle } from "@/utils/playlistGrid.ts";
import { useNavigate, useLocation } from "react-router-dom";
import { InputPlayer, PlaylistRating, PlaylistRename, PlaylistExport, PlaylistShare } from "@/components/index.ts";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import AppleExportModal from "@/components/Modals/Transfer/AppleExportModal.tsx";
import EmbedModal from "@/components/Modals/Transfer/EmbedModal.tsx";
import RenameSvg from "@/assets/icons/rename.svg";
import RenameBlackSvg from "@/assets/icons/rename_black.svg";
import ExportSvg from "@/assets/icons/export.svg";
import ExportBlackSvg from "@/assets/icons/export_black.svg";
import ShareSvg from "@/assets/icons/share.svg";
import ShareBlackSvg from "@/assets/icons/share_black.svg";
import StarSvg from "@/assets/icons/star.svg";
import DefaultCover from "@/assets/default-playlist-cover.jpg";
import InfoSvg from "@/assets/icons/info.svg";
import { CoverTextOverlay } from "@/components/Playlist/CoverTextOverlay.tsx";
import { CoverCropModal } from "@/components/Playlist/CoverCropModal.tsx";
import { playlistAccessChrome, PLAYLIST_LOCK_MARK } from "@/utils/playlistAccessChrome.ts";
import { StickyReferenceBar } from "@/components/Playlist/StickyReferenceBar.tsx";
import { PLAYLIST_DIVIDER_BORDER } from "@/utils/playlistChrome.ts";
import { WORKSPACE_BTN_PRIMARY, WORKSPACE_BTN_SECONDARY, WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

const InputTrackStatus = "Loading..."

const PlaylistHero: React.FC = () => {
  const stickySentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [showMeta, setShowMeta] = React.useState(false);
  const [showRating, setShowRating] = React.useState(false);
  const [showRename, setShowRename] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);

  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [showDownloadExport, setShowDownloadExport] = React.useState(false);
  const [showAppleExport, setShowAppleExport] = React.useState(false);
  const [showEmbed, setShowEmbed] = React.useState(false);

  const [showStatus, setShowStatus] = React.useState(false);
  const [statusType, setStatusType] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [statusTitle, setStatusTitle] = React.useState('');
  const [showLoginButton, setShowLoginButton] = React.useState(false);
  const [forkedPlaylistId, setForkedPlaylistId] = React.useState<string | null>(null);
  // const [hasForkedThisPlaylist, setHasForkedThisPlaylist] = React.useState(false);

  const { playlistData, isLoading, error } = usePlaylistStore();
  // Owner-only custom playlist cover. Precedence for what we display: custom cover (if uploaded) →
  // bundled default. A playlist never uses a track's own cover. Only the owner sees the pen to change it.
  const isOwner = !!playlistData?.playlist?.is_owner;
  const hasCustomCover = !!playlistData?.playlist?.has_custom_cover;
  const { coverUrl: customCoverUrl, isUploading: coverUploading, validateOriginal: validateCover, upload: uploadCover } =
    usePlaylistCover(playlistData?.playlist?.id, hasCustomCover);
  const coverInputRef = React.useRef<HTMLInputElement | null>(null);
  // Object URL of a picked (pre-crop) image; non-null opens the crop modal. Upload happens after crop.
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  // Gate the canvas title overlay on the cover image actually being painted (custom/seed/default),
  // so the text never flashes over a blank state.
  const [coverLoaded, setCoverLoaded] = React.useState(false);
  const { autoplay, setAutoplay } = usePlayerStore();
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
  // Dim gated controls until the verdicts are real, or when login/upgrade is required.
  const favoriteChrome = playlistAccessChrome(access.verdict("favorite"), access.ready, "Log in to save favorites");
  const renameChrome = playlistAccessChrome(access.verdict("rename"), access.ready, "Log in to rename");
  const exportChrome = playlistAccessChrome(access.verdict("export"), access.ready, "Log in to export");
  const shareChrome = playlistAccessChrome(access.verdict("share"), access.ready, "Log in to share");
  const rateChrome = playlistAccessChrome(access.verdict("rateTrack"), access.ready, "Log in to rate tracks");
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

  // Open the file picker (owner only). The pen is hidden for non-owners, but guard anyway.
  const handleCoverPick = () => {
    if (!isOwner || coverUploading) return;
    coverInputRef.current?.click();
  };

  const handleCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    const valid = await validateCover(file);
    if (!valid.ok) {
      handleStatusChange("error", valid.error || "That image can’t be used.", "Cover Update Failed");
      return;
    }
    // Open the crop modal on the picked image; the upload runs once the user confirms the square.
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleCropConfirm = async (blob: Blob) => {
    closeCrop();
    handleStatusChange("loading", "Uploading your cover…", "Updating Cover");
    const res = await uploadCover(blob);
    if (res.ok) {
      handleStatusChange("success", "Your playlist cover has been updated.", "Cover Updated");
    } else {
      handleStatusChange("error", res.error || "Failed to update the cover.", "Cover Update Failed");
    }
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
    // Guests can't use any export option (TXT/Apple/Embed all require login), so show the login
    // gate directly rather than opening a menu of locked items. verdict("export") is "login" only
    // for guests — free/pro resolve to "allowed" and get the menu.
    if (access.verdict("export") === "login") {
      setGate({ reason: "login_required", title: "Log in to export", body: "Create a free account or log in to export your playlists." });
      return;
    }
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

  // Embed — open for everyone; the modal itself guards on public/private (embedding needs a public
  // playlist, and the "make public" action inside is owner-only via the visibility endpoint).
  const handleEmbedClick = () => {
    setShowExportMenu(false);
    setShowEmbed(true);
  };

  // Make the current playlist public (used by the embed modal's guard). Returns success.
  const handleMakePublicForEmbed = async (): Promise<boolean> => {
    const id = playlistData?.playlist?.id;
    if (!id) return false;
    const res = await setVisibility(id, true);
    return !!res?.ok;
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
    <div className="relative w-full">
      {/* Toolbar */}
      <div className="mb-[var(--px-14)] flex flex-wrap items-center gap-[var(--px-8)]">
        {location.state?.from === "library" ? (
          <a
            aria-label="Back to Library"
            href="/library"
            onClick={(e) => {
              e.preventDefault();
              navigate("/library");
            }}
            className={`inline-flex min-h-[var(--px-44)] items-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-primary)] transition-[background-color,border-color] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] playlist-nav-link ${WORKSPACE_FOCUS_VISIBLE}`}
            id="playlist-hero-back-link"
          >
            ‹ Back to Library
          </a>
        ) : (
          <a
            aria-label="Back to search"
            href={BASE_BETA_URL}
            onClick={(e) => {
              e.preventDefault();
              navigate("/sonic-discovery");
            }}
            className={`inline-flex min-h-[var(--px-44)] items-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-primary)] transition-[background-color,border-color] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] playlist-nav-link ${WORKSPACE_FOCUS_VISIBLE}`}
            id="playlist-hero-back-link"
          >
            ‹ Back to search
          </a>
        )}
        <span className="flex-1" />
        <Tooltip message={autoplay ? "Turn off Autoplay" : "Turn on Autoplay"}>
          <ToggleButton
            text="Autoplay"
            customWidth="min-w-[var(--px-100)]"
            isOn={autoplay}
            onToggle={setAutoplay}
            id="playlist-hero-autoplay-toggle"
          />
        </Tooltip>
        <Tooltip message="Rename your Playlist">
          <span title={renameChrome.title}>
            <IconButton
              text={`Rename${renameChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}`}
              transparent={true}
              customWidth="min-w-[var(--px-90)]"
              onClick={() => withAccess("rename", "Log in to rename", "Create a free account or log in to rename your playlists.", () => setShowRename(true))}
              icon={<img src={RenameSvg} draggable={false} alt="Rename" aria-label="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
              hoverIcon={<img src={RenameBlackSvg} aria-label="Rename" draggable={false} alt="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
              className={`playlist-action-button !rounded-[var(--rx-radius-control)] !outline-[var(--rx-color-border-default)] !bg-transparent hover:!bg-[rgba(255,255,255,0.06)] !min-h-[var(--px-44)] ${WORKSPACE_FOCUS_VISIBLE}${renameChrome.className}`}
              id="playlist-hero-rename-button"
            />
          </span>
        </Tooltip>
        <div ref={exportButtonWrapRef} className="relative">
          <Tooltip message="Export your Playlist">
            <span title={exportChrome.title}>
              <IconButton
                text={`${isExporting ? "Exporting..." : "Export"}${exportChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}`}
                transparent={true}
                customWidth="min-w-[var(--px-90)]"
                onClick={handleExportButtonClick}
                disabled={isExporting}
                icon={<img src={ExportSvg} draggable={false} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                hoverIcon={<img src={ExportBlackSvg} draggable={false} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                className={`playlist-action-button !rounded-[var(--rx-radius-control)] !outline-[var(--rx-color-border-default)] !bg-transparent hover:!bg-[rgba(255,255,255,0.06)] !min-h-[var(--px-44)] ${WORKSPACE_FOCUS_VISIBLE}${exportChrome.className}`}
                id="playlist-hero-export-button"
              />
            </span>
          </Tooltip>
          {showExportMenu && (
            <div
              ref={exportMenuRef}
              role="menu"
              aria-label="Export options"
              className={`absolute right-0 top-[calc(100%+var(--px-6))] z-50 min-w-[var(--px-220)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] text-[var(--rx-color-text-primary)] shadow-lg`}
            >
              <button
                role="menuitem"
                className={`w-full px-[var(--px-12)] py-[var(--px-10)] text-left font-fira text-[length:var(--px-9)] font-light tracking-[var(--px-0-25)] text-[var(--rx-color-text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] ${WORKSPACE_FOCUS_VISIBLE} flex items-center gap-[var(--px-8)]`}
                onClick={handleDownloadExportClick}
                id="export-menu-download"
              >
                Export to TXT
              </button>
              <button
                role="menuitem"
                className={`w-full px-[var(--px-12)] py-[var(--px-10)] text-left font-fira text-[length:var(--px-9)] font-light tracking-[var(--px-0-25)] text-[var(--rx-color-text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] ${WORKSPACE_FOCUS_VISIBLE} flex items-center gap-[var(--px-8)] border-t ${PLAYLIST_DIVIDER_BORDER}`}
                onClick={handleAppleExportClick}
                id="export-menu-apple"
              >
                Export to Apple Music
              </button>
              <button
                role="menuitem"
                className={`w-full px-[var(--px-12)] py-[var(--px-10)] text-left font-fira text-[length:var(--px-9)] font-light tracking-[var(--px-0-25)] text-[var(--rx-color-text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] ${WORKSPACE_FOCUS_VISIBLE} flex items-center gap-[var(--px-8)] border-t ${PLAYLIST_DIVIDER_BORDER}`}
                onClick={handleEmbedClick}
                id="export-menu-embed"
              >
                Embed (iframe)
              </button>
            </div>
          )}
        </div>
        <Tooltip message="Share your Playlist">
          <span title={shareChrome.title}>
            <IconButton
              text={`Share${shareChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}`}
              transparent={true}
              customWidth="min-w-[var(--px-90)]"
              onClick={() => withAccess("share", "Log in to share", "Create a free account or log in to share your playlists.", () => setShowShare(true))}
              icon={<img src={ShareSvg} draggable={false} alt="Share" aria-label="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
              hoverIcon={<img src={ShareBlackSvg} aria-label="Share" draggable={false} alt="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
              className={`playlist-action-button !rounded-[var(--rx-radius-control)] !outline-[var(--rx-color-border-default)] !bg-transparent hover:!bg-[rgba(255,255,255,0.06)] !min-h-[var(--px-44)] ${WORKSPACE_FOCUS_VISIBLE}${shareChrome.className}`}
              id="playlist-hero-share-button"
            />
          </span>
        </Tooltip>
      </div>

      {/* Header card — restrained orange tick connects reference to results below */}
      <div
        className={`relative grid gap-[var(--px-20)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-18)] before:absolute before:left-[var(--px-18)] before:top-0 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']`}
        style={autoFluidGridStyle}
      >
        <div className={`relative h-[var(--px-120)] w-[var(--px-120)] shrink-0 border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface-raised)]`}>
          {!DEMO_MODE ? (
            <img src={(hasCustomCover ? customCoverUrl : null) || DefaultCover} onLoad={() => setCoverLoaded(true)} onError={(e) => { e.currentTarget.src = DefaultCover; }} draggable={false} aria-label="Playlist Cover" alt="Playlist Cover" className="block w-full h-full object-cover" />
          ) : (
            <img src={DefaultCover} onLoad={() => setCoverLoaded(true)} draggable={false} aria-label="Playlist Cover" alt="Playlist Cover" className="block w-full h-full object-cover" />
          )}
          <CoverTextOverlay
            text={playlistData?.playlist?.name}
            active={coverLoaded}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          {coverUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="w-[var(--px-24)] h-[var(--px-24)] border-2 border-white/40 border-t-white rounded-full animate-spin" aria-label="Uploading cover" />
            </div>
          )}
          {!DEMO_MODE && isOwner && (
            <button
              type="button"
              onClick={handleCoverPick}
              disabled={coverUploading}
              aria-label="Change cover image"
              title="Change cover image"
              className={`absolute -right-[var(--px-10)] -top-[var(--px-10)] flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface-raised)] text-[var(--rx-color-text-primary)] transition-[background-color,border-color,color] duration-[var(--rx-duration-base)] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] ${WORKSPACE_FOCUS_VISIBLE} disabled:cursor-not-allowed disabled:opacity-50`}
              id="playlist-hero-cover-edit-button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[var(--px-12)] h-[var(--px-12)]" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverSelected}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        <div className="min-w-0 flex flex-col gap-[var(--px-10)]">
          {error && (
            <div className="font-fira text-[length:var(--px-9)] opacity-75" role="alert">
              {error}
            </div>
          )}

          <div className="flex min-w-0 items-center gap-[var(--px-10)] overflow-hidden">
            {isLoading ? (
              <div className="text-[length:var(--px-19)] font-light uppercase font-helvetica leading-[var(--px-24)]">
                Loading playlist...
              </div>
            ) : (
              <h1
                id="playlist-results-heading"
                tabIndex={-1}
                title={playlistData?.playlist?.name || undefined}
                className={`m-0 min-w-0 flex-1 basis-0 truncate text-[length:var(--px-19)] font-medium uppercase font-helvetica leading-[var(--px-24)] outline-none ${WORKSPACE_FOCUS_VISIBLE}`}
              >
                {playlistData?.playlist?.name || "No playlist data"}
              </h1>
            )}
            <Tooltip message={isFavorite ? "Remove from favorites" : "Add to favorites"}>
              <button
                type="button"
                onClick={handleFavoriteClick}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFavorite}
                title={favoriteChrome.title}
                className={`flex-none shrink-0 cursor-pointer rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent p-[var(--px-10)] flex items-center justify-center transition-[background-color,border-color,transform] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] hover:scale-110 active:scale-90 playlist-favorite-button ${WORKSPACE_FOCUS_VISIBLE}${favoriteChrome.className}`}
                id="playlist-hero-favorite-button"
              >
                {isFavorite ? (
                  <HeartFilledIcon customWidth="24" customHeight="24" className="text-[var(--color-accent,#EE4A26)]" disableHover={true} />
                ) : (
                  <>
                    <HeartStrokeIcon customWidth="24" customHeight="24" className="text-white/60 hover:text-white" />
                    {favoriteChrome.showLock && (
                      <span aria-hidden="true" className="ml-[var(--px-4)] font-fira text-[length:var(--px-10)]">
                        {PLAYLIST_LOCK_MARK}
                      </span>
                    )}
                  </>
                )}
              </button>
            </Tooltip>
            <Tooltip message={
              isAuthenticated
                ? (playlistData?.playlist?.is_public ? "Public — click to make private" : "Private — click to make public")
                : "Log in to change visibility"
            }>
              <button
                type="button"
                onClick={() => {
                  // Guests can't change visibility (owner-only, login required) — prompt to log in
                  // rather than silently doing nothing.
                  if (isAuthenticated) {
                    setVisibilityConfirm(true);
                  } else {
                    setGate({ reason: "login_required", title: "Log in to update visibility", body: "Log in to make this playlist private or public." });
                  }
                }}
                aria-label={
                  isAuthenticated
                    ? (playlistData?.playlist?.is_public ? 'Make playlist private' : 'Make playlist public')
                    : 'Log in to change visibility'
                }
                className={`flex-none shrink-0 px-[var(--px-8)] py-[var(--px-4)] rounded-3xl inline-flex justify-center items-center gap-[var(--px-8)] bg-[var(--color-secondary-background)] text-[length:var(--px-9)] tracking-[var(--px-0-25)] font-light font-fira uppercase cursor-pointer hover:brightness-125 transition-[filter] ${playlistData?.playlist?.is_public ? 'text-[#5C5C5C]' : 'text-white'}`}
              >
                {playlistData?.playlist?.is_public ? (
                  <>
                    <PublicIcon customWidth="10" customHeight="10" className="text-[#5C5C5C] mb-[var(--px-2)]" disableHover={true} />
                    Public
                  </>
                ) : (
                  <>
                    <PrivateIcon customWidth="12" customHeight="12" className="text-white" disableHover={true} />
                    Private
                  </>
                )}
              </button>
            </Tooltip>
          </div>

          <p className="font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60 m-0">
            ⧖ {playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}
            {' · '}{playlistData?.queried_track.year ?? '—'}
            {resolveLabel(playlistData?.queried_track.label) ? ` · ${resolveLabel(playlistData?.queried_track.label)}` : ''}
            {' · Similarity playlist — created automatically from your reference'}
            {playlistData?.similar_tracks?.length ? ` · ${playlistData.similar_tracks.length} results` : ''}
          </p>

          <div className="flex flex-col gap-[var(--px-8)]">
            <div className={`flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-7)] font-light font-fira leading-[var(--px-14)] items-center h-[var(--px-14)] min-h-[var(--px-14)] ${showMeta ? '' : 'hidden'}`}>
              <div>ID: {playlistData?.queried_track.id}</div>
              <div>|</div>
              <div>Duration: {playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}</div>
              <div>|</div>
              <div>Status: {InputTrackStatus}</div>
              <div>|</div>
              <div>Mode: Independent</div>
              <div>|</div>
              <div>Instance: Input Track</div>
            </div>
            {playlistData?.queried_track.id && (
              <InputPlayer
                trackId={playlistData.queried_track.id}
                totalDuration={playlistData.queried_track.duration ?? 0}
                trackType={playlistData.queried_track.type}
                deepLinkUrl={playlistData.queried_track.deep_link_url}
                playButtonDataAttributes={{
                  'data-testid': 'play-button',
                  'data-track-id': playlistData?.queried_track.id,
                  'data-track-artist': playlistData?.queried_track.artist || '',
                  'data-track-title': playlistData?.queried_track.title || '',
                  'data-track-name': playlistData?.queried_track.title || '',
                }}
              />
            )}
            <div className="flex flex-wrap items-center gap-[var(--px-10)]">
              <button
                type="button"
                name="Rate these Results"
                onClick={() => setShowRating(true)}
                title={rateChrome.title}
                className={`inline-flex min-h-[var(--px-44)] items-center gap-[var(--px-8)] border border-[var(--rx-color-border-default)] px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-primary)] transition-[background-color,border-color] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] playlist-rating-button ${WORKSPACE_FOCUS_VISIBLE}` + (rateChrome.showLock ? " opacity-45" : " opacity-90")}
                id="playlist-hero-rating-button"
                aria-label="Rate these Results"
                aria-expanded={showRating}
                data-playlist-id={playlistData?.playlist?.id}
              >
                <img src={StarSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-12)] h-[var(--px-12)]" />
                Rate these results{rateChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
              </button>
              <Tooltip message={showMeta ? "Hide Meta Info" : "Show Meta Info"}>
                <button
                  type="button"
                  onClick={() => setShowMeta((v) => !v)}
                  aria-label={showMeta ? "Hide Meta Info" : "Show Meta Info"}
                  aria-expanded={showMeta}
                  className="hover:cursor-pointer playlist-meta-toggle opacity-60 hover:opacity-100"
                  id="playlist-hero-meta-toggle"
                >
                  <img draggable={false} src={InfoSvg} alt="" aria-hidden="true" className="w-[var(--px-14)] h-[var(--px-14)]" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
      <div ref={stickySentinelRef} aria-hidden="true" className="h-px w-full" data-testid="playlist-ref-sentinel" />

      <p className="mt-[var(--px-12)] mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-50 before:block before:w-[var(--px-20)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']">
        Sonic match found — scored by PYXIS-1
      </p>

      <StickyReferenceBar
        sentinelRef={stickySentinelRef}
        resultCount={playlistData?.similar_tracks?.length ?? 0}
      />

      {/* Modals */}
      <CoverCropModal
        isOpen={!!cropSrc}
        imageSrc={cropSrc}
        onCancel={closeCrop}
        onConfirm={handleCropConfirm}
      />
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

      <EmbedModal
        isOpen={showEmbed}
        onClose={() => setShowEmbed(false)}
        playlistUuid={playlistData?.playlist?.id ?? ""}
        isPublic={!!playlistData?.playlist?.is_public}
        onMakePublic={handleMakePublicForEmbed}
        onStatusChange={handleStatusChange}
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
            className={`${WORKSPACE_BTN_SECONDARY} flex-1`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmVisibility}
            disabled={visibilityBusy}
            className={`${WORKSPACE_BTN_PRIMARY} flex-1`}
          >
            {visibilityBusy ? "Updating…" : (playlistData?.playlist?.is_public ? "Make Private" : "Make Public")}
          </button>
        </div>
      </StatusMessage>
    </div>
  );
};

export default PlaylistHero;