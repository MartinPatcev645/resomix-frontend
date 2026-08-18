import React, { useEffect } from "react";
import { ConfirmDialog, StatusMessage, PrivateIcon, PublicIcon, HeartStrokeIcon, HeartFilledIcon } from "@resomix/ui";
import { formatDuration, usePlaylistExport, useAccess, useFavoritePlaylist, usePlaylistVisibility, usePlaylistCover, type AccessAction } from "@resomix/hooks";
import { usePlaylistStore, usePlayerStore, useAuthStore } from "@resomix/stores";
import { InputPlayer, PlaylistRating, PlaylistRename, PlaylistExport, PlaylistShare } from "@/components/index.ts";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";
import { CoverCropModal } from "@/components/Playlist/CoverCropModal.tsx";
import { CoverTextOverlay } from "@/components/Playlist/CoverTextOverlay.tsx";
import AppleExportModal from "@/components/Modals/Transfer/AppleExportModal.tsx";
import StarSvg from "@/assets/icons/star_white.svg";
import DefaultCover from "@/assets/default-playlist-cover.jpg";
import { DEMO_MODE } from "@resomix/config";
import { resolveLabel } from "@/utils/trackUtils.ts";
import { useNavigate, useLocation } from "react-router-dom";
import { playlistAccessChrome, PLAYLIST_LOCK_MARK } from "@/utils/playlistAccessChrome.ts";
import { StickyReferenceBar } from "@/components/Playlist/StickyReferenceBar.tsx";
import { PLAYLIST_DIVIDER_BORDER } from "@/utils/playlistChrome.ts";
import { WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";
import { HERO_TOOLBAR_BTN, HeroChevronLeft, HeroAutoplayToggle, HeroClockIcon, RenameIcon, ExportIcon, ShareIcon } from "@/components/Playlist/heroToolbar.tsx";

const PlaylistHero: React.FC = () => {
  const stickySentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [showRating, setShowRating] = React.useState(false);
  const [showRename, setShowRename] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [showDownloadExport, setShowDownloadExport] = React.useState(false);
  const [showAppleExport, setShowAppleExport] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState(false);
  const [statusType, setStatusType] = React.useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = React.useState("");
  const [statusTitle, setStatusTitle] = React.useState("");

  const { playlistData } = usePlaylistStore();
  const isOwner = !!playlistData?.playlist?.is_owner;
  const hasCustomCover = !!playlistData?.playlist?.has_custom_cover;
  const { coverUrl: customCoverUrl, isUploading, isPreparing: coverPreparing, prepare: prepareCover, upload: uploadCover } =
    usePlaylistCover(playlistData?.playlist?.id, hasCustomCover);
  // One busy flag for the two stages the user experiences as "working": downscaling the picked photo
  // and uploading the crop.
  const coverUploading = isUploading || coverPreparing;
  const coverInputRef = React.useRef<HTMLInputElement | null>(null);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [coverLoaded, setCoverLoaded] = React.useState(false);

  const access = useAccess();
  const { isFavorite, toggleFavorite } = useFavoritePlaylist();
  const [gate, setGate] = React.useState<{ reason: string; title: string; body: string } | null>(null);
  const withAccess = (action: AccessAction, title: string, body: string, run: () => void) => {
    const v = access.verdict(action);
    if (v === "pending") return;
    if (v === "allowed") return run();
    setGate({ reason: v === "login" ? "login_required" : "upgrade_required", title, body });
  };

  const favoriteChrome = playlistAccessChrome(access.verdict("favorite"), access.ready, "Log in to save favorites");
  const renameChrome = playlistAccessChrome(access.verdict("rename"), access.ready, "Log in to rename");
  const exportChrome = playlistAccessChrome(access.verdict("export"), access.ready, "Log in to export");
  const shareChrome = playlistAccessChrome(access.verdict("share"), access.ready, "Log in to share");
  const rateChrome = playlistAccessChrome(access.verdict("rateTrack"), access.ready, "Log in to rate tracks");

  const { autoplay, setAutoplay } = usePlayerStore();
  const { canExport, isExporting } = usePlaylistExport();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setVisibility } = usePlaylistVisibility();
  const [visibilityConfirm, setVisibilityConfirm] = React.useState(false);
  const [visibilityBusy, setVisibilityBusy] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const exportButtonWrapRef = React.useRef<HTMLDivElement | null>(null);
  const exportMenuRef = React.useRef<HTMLDivElement | null>(null);

  const handleStatusChange = (type: "loading" | "success" | "error", message: string, title?: string) => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title || "");
    setShowStatus(true);
  };

  const handleCoverPick = () => {
    if (!isOwner || coverUploading) return;
    coverInputRef.current?.click();
  };

  const handleCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // `prepareCover` downscales the original before the cropper ever sees it, so a 48 MP photo is a
    // bounded working image by the time it reaches the modal.
    const prepared = await prepareCover(file);
    if (!prepared.ok || !prepared.blob) {
      handleStatusChange("error", prepared.error || "That image can’t be used.", "Cover Update Failed");
      return;
    }
    setCropSrc(URL.createObjectURL(prepared.blob));
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
      handleStatusChange("success", `Playlist is now ${!isPublic ? "public" : "private"}.`, "Visibility Updated");
    } else {
      handleStatusChange("error", res.error || "Failed to update visibility", "Error");
    }
  };

  const handleFavoriteClick = async () => {
    withAccess("favorite", "Log in to save favorites", "Create a free account or log in to add playlists to your favorites.", async () => {
      const res = await toggleFavorite();
      if (res.gated) {
        setGate({ reason: "login_required", title: "Log in to save favorites", body: "Create a free account or log in to add playlists to your favorites." });
      } else if (!res.ok && res.error) {
        handleStatusChange("error", res.error, "Favorites");
      }
    });
  };

  const handleRenameClose = () => setShowRename(false);
  const handleShareClose = () => setShowShare(false);
  const handleRatingClose = () => setShowRating(false);
  const handleDownloadExportClose = () => setShowDownloadExport(false);
  const handleStatusClose = () => setShowStatus(false);

  const handleExportButtonClick = () => {
    if (isExporting) return;
    // Guests can't use any export option (TXT/Apple all require login), so show the login gate
    // directly rather than opening a menu of locked items. verdict("export") is "login" only for
    // guests — free/pro resolve to "allowed" and get the menu.
    if (access.verdict("export") === "login") {
      setGate({ reason: "login_required", title: "Log in to export", body: "Create a free account or log in to export your playlists." });
      return;
    }
    setShowExportMenu((v) => !v);
  };

  const handleDownloadExportClick = () => {
    setShowExportMenu(false);
    withAccess("export", "Log in to export", "Create a free account or log in to export your playlists.", () => {
      if (!canExport) {
        handleStatusChange("error", "No playlist data available to export", "Export Failed");
        return;
      }
      setShowDownloadExport(true);
    });
  };

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
      if (e.key === "Escape" && showExportMenu) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showExportMenu]);

  return (
    <div className="relative w-full select-none pt-[var(--px-20)]">
      {/* Toolbar — two compact rows */}
      <div className="mb-[var(--px-12)] flex flex-col gap-[var(--px-8)]">
        <div className="flex items-center gap-[var(--px-3)]">
          {location.state?.from === "library" ? (
            <a
              href="/library"
              onClick={(e) => {
                e.preventDefault();
                navigate("/library");
              }}
              className={`${HERO_TOOLBAR_BTN} ${WORKSPACE_FOCUS_VISIBLE}`}
              id="playlist-hero-back-link"
              aria-label="Back to Library"
            >
              <HeroChevronLeft />
              Back to Library
            </a>
          ) : (
            <a
              href="/sonic-discovery"
              onClick={(e) => {
                e.preventDefault();
                navigate("/sonic-discovery");
              }}
              className={`${HERO_TOOLBAR_BTN} ${WORKSPACE_FOCUS_VISIBLE}`}
              id="playlist-hero-back-link"
              aria-label="Back to search"
            >
              <HeroChevronLeft />
              Back to search
            </a>
          )}
          <span className="flex-1" />
          <button
            type="button"
            aria-pressed={autoplay}
            aria-label={autoplay ? "Turn off Autoplay" : "Turn on Autoplay"}
            onClick={() => setAutoplay(!autoplay)}
            className={`${HERO_TOOLBAR_BTN} ${WORKSPACE_FOCUS_VISIBLE}`}
            id="playlist-hero-autoplay-toggle"
          >
            <HeroAutoplayToggle on={autoplay} />
            Autoplay
          </button>
        </div>

        <div className="flex items-stretch gap-[var(--px-8)]">
          <button
            type="button"
            title={renameChrome.title}
            aria-label="Rename"
            onClick={() => withAccess("rename", "Log in to rename", "Create a free account or log in to rename your playlists.", () => setShowRename(true))}
            className={`${HERO_TOOLBAR_BTN} flex-1 basis-0 min-w-0 !px-[var(--px-8)] ${WORKSPACE_FOCUS_VISIBLE}${renameChrome.className}`}
            id="playlist-hero-rename-button"
          >
            <RenameIcon />
            Rename{renameChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
          </button>
          <div ref={exportButtonWrapRef} className="relative flex-1 basis-0 min-w-0">
            <button
              type="button"
              title={exportChrome.title}
              aria-label="Export"
              onClick={handleExportButtonClick}
              disabled={isExporting}
              className={`${HERO_TOOLBAR_BTN} w-full !px-[var(--px-8)] disabled:cursor-not-allowed ${WORKSPACE_FOCUS_VISIBLE}${exportChrome.className}`}
              id="playlist-hero-export-button"
            >
              <ExportIcon />
              {isExporting ? "Exporting..." : "Export"}{exportChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
            </button>
            {showExportMenu && (
              <div
                ref={exportMenuRef}
                role="menu"
                aria-label="Export options"
                className={`absolute left-0 top-[calc(100%+var(--px-6))] z-50 min-w-[var(--px-220)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] text-[var(--rx-color-text-primary)] shadow-lg`}
              >
                <button
                  role="menuitem"
                  className={`flex w-full items-center gap-[var(--px-8)] px-[var(--px-14)] py-[var(--px-10)] text-left font-fira text-[length:var(--px-9)] font-light tracking-[var(--px-0-25)] text-[var(--rx-color-text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] ${WORKSPACE_FOCUS_VISIBLE}`}
                  onClick={handleDownloadExportClick}
                  id="export-menu-download"
                >
                  Export to TXT
                </button>
                <button
                  role="menuitem"
                  className={`flex w-full items-center gap-[var(--px-8)] border-t ${PLAYLIST_DIVIDER_BORDER} px-[var(--px-12)] py-[var(--px-10)] text-left font-fira text-[length:var(--px-9)] font-light tracking-[var(--px-0-25)] text-[var(--rx-color-text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] ${WORKSPACE_FOCUS_VISIBLE}`}
                  onClick={handleAppleExportClick}
                  id="export-menu-apple"
                >
                  Export to Apple Music
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            title={shareChrome.title}
            aria-label="Share"
            onClick={() => withAccess("share", "Log in to share", "Create a free account or log in to share your playlists.", () => setShowShare(true))}
            className={`${HERO_TOOLBAR_BTN} flex-1 basis-0 min-w-0 !px-[var(--px-6)] ${WORKSPACE_FOCUS_VISIBLE}${shareChrome.className}`}
            id="playlist-hero-share-button"
          >
            <ShareIcon />
            Share{shareChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
          </button>
        </div>
      </div>

      {/* Header card — stacked mobile anatomy */}
      <div className={`relative flex flex-col gap-[var(--px-14)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-16)] before:absolute before:left-[var(--px-16)] before:top-0 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']`}>
        {/* Cover + quick actions — cover on the left, favourite/visibility pinned to the top of the
            space beside it, rating button underneath them. */}
        <div className="flex items-start gap-[var(--px-14)]">
          <div className={`relative h-[var(--px-88)] w-[var(--px-88)] shrink-0 border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface-raised)]`}>
            {!DEMO_MODE ? (
              <img
                src={(hasCustomCover ? customCoverUrl : null) || DefaultCover}
                onLoad={() => setCoverLoaded(true)}
                onError={(e) => {
                  e.currentTarget.src = DefaultCover;
                }}
                draggable={false}
                aria-label="Playlist Cover"
                alt="Playlist Cover"
                className="block h-full w-full object-cover"
              />
            ) : (
              <img
                src={DefaultCover}
                onLoad={() => setCoverLoaded(true)}
                draggable={false}
                alt="Playlist Cover"
                aria-label="Playlist Cover"
                className="block h-full w-full object-cover"
              />
            )}
            <CoverTextOverlay
              text={playlistData?.playlist?.name}
              active={coverLoaded}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            {coverUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="h-[var(--px-16)] w-[var(--px-16)] animate-spin rounded-full border-2 border-white/40 border-t-white" aria-label="Uploading cover" />
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              // Any image. Deliberately NOT listing image/heic: Safari 17+ has a bug where naming
              // HEIC in `accept` makes it convert your JPEGs and PNGs *to* HEIC on the way out.
              accept="image/*"
              className="hidden"
              onChange={handleCoverSelected}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[var(--px-8)]">
            {/* Cover edit sits next to the cover it acts on; `ml-auto` on the pair below keeps
                favourite/visibility flush right whether or not the edit button renders. */}
            <div className="flex items-center gap-[var(--px-8)]">
              {!DEMO_MODE && isOwner && (
                <button
                  type="button"
                  onClick={handleCoverPick}
                  disabled={coverUploading}
                  aria-label="Change cover image"
                  // HERO_TOOLBAR_BTN, so the hover matches the rest of the hero. Opaque surface
                  // override because this sits on the artwork.
                  className={`${HERO_TOOLBAR_BTN} h-[var(--px-44)] w-[var(--px-44)] shrink-0 !px-0 !bg-[var(--rx-color-surface-raised)] ${WORKSPACE_FOCUS_VISIBLE} disabled:opacity-50`}
                  id="playlist-hero-cover-edit-button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[var(--px-10)] w-[var(--px-10)]" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              )}
              <div className="ml-auto flex items-center gap-[var(--px-8)]">
                <button
                  type="button"
                  onClick={handleFavoriteClick}
                  aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  title={favoriteChrome.title}
                  className={`flex h-[var(--px-44)] w-[var(--px-44)] flex-none shrink-0 items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent p-0 playlist-favorite-button ${WORKSPACE_FOCUS_VISIBLE}${favoriteChrome.className}`}
                  id="playlist-hero-favorite-button"
                >
                  {isFavorite ? (
                    <HeartFilledIcon customWidth="20" customHeight="20" className="text-[var(--color-accent,#EE4A26)]" disableHover={true} />
                  ) : (
                    <>
                      <HeartStrokeIcon customWidth="20" customHeight="20" className="text-white/70" />
                      {favoriteChrome.showLock && (
                        <span aria-hidden="true" className="ml-[var(--px-2)] font-fira text-[length:var(--px-9)]">
                          {PLAYLIST_LOCK_MARK}
                        </span>
                      )}
                    </>
                  )}
                </button>
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
                      ? (playlistData?.playlist?.is_public ? "Make playlist private" : "Make playlist public")
                      : "Log in to change visibility"
                  }
                  className="inline-flex min-h-[var(--px-44)] flex-none shrink-0 items-center gap-[var(--px-4)] border border-[rgba(255,255,255,.14)] px-[var(--px-8)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] cursor-pointer"
                >
                  {playlistData?.playlist?.is_public ? (
                    <>
                      <PublicIcon customWidth="8" customHeight="8" className="opacity-60" disableHover={true} />
                      Public
                    </>
                  ) : (
                    <>
                      <PrivateIcon customWidth="8" customHeight="8" disableHover={true} />
                      Private
                    </>
                  )}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRating(true)}
              title={rateChrome.title}
              className={`${HERO_TOOLBAR_BTN} w-full !px-[var(--px-12)] gap-[var(--px-8)] playlist-rating-button ${WORKSPACE_FOCUS_VISIBLE}` + (rateChrome.showLock ? " opacity-45" : " opacity-80")}
              id="playlist-hero-rating-button"
              aria-label="Rate these results"
            >
              <img src={StarSvg} draggable={false} alt="" aria-hidden="true" className="h-[var(--px-12)] w-[var(--px-12)]" />
              Rate these results{rateChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-[var(--px-8)] overflow-hidden">
          <h1
            id="playlist-results-heading"
            tabIndex={-1}
            title={playlistData?.playlist?.name || undefined}
            className={`m-0 min-w-0 flex-1 basis-0 truncate text-[length:var(--px-15)] font-medium uppercase font-helvetica leading-[var(--px-18)] outline-none ${WORKSPACE_FOCUS_VISIBLE}`}
          >
            {playlistData?.playlist?.name || ""}
          </h1>
        </div>

        <p className="m-0 font-fira text-[length:var(--px-10)] tracking-[var(--px-1)] opacity-60">
          <HeroClockIcon />{" "}
          {playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : "--:--"}
          {" · "}{playlistData?.queried_track.year ?? "—"}
          {resolveLabel(playlistData?.queried_track.label) ? ` · ${resolveLabel(playlistData?.queried_track.label)}` : ""}
          {playlistData?.similar_tracks?.length ? ` · ${playlistData.similar_tracks.length} results` : ""}
        </p>

        {playlistData?.queried_track.id && (
          <InputPlayer
            mobile
            trackId={playlistData.queried_track.id}
            totalDuration={playlistData.queried_track.duration ?? 0}
            trackType={playlistData.queried_track.type}
            deepLinkUrl={playlistData.queried_track.deep_link_url}
            playButtonDataAttributes={{
              "data-testid": "play-button",
              "data-track-id": playlistData?.queried_track.id || "",
              "data-track-artist": playlistData?.queried_track.artist || "",
              "data-track-title": playlistData?.queried_track.title || "",
              "data-track-name": playlistData?.queried_track.title || "",
            }}
          />
        )}

      </div>
      <div ref={stickySentinelRef} aria-hidden="true" className="h-px w-full" data-testid="playlist-ref-sentinel" />

      <p className="mt-[var(--px-12)] mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50 before:block before:w-[var(--px-20)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']">
        Sonic match found, scored by PYXIS-1
      </p>

      <StickyReferenceBar
        sentinelRef={stickySentinelRef}
        resultCount={playlistData?.similar_tracks?.length ?? 0}
      />

      <CoverCropModal isOpen={!!cropSrc} imageSrc={cropSrc} onCancel={closeCrop} onConfirm={handleCropConfirm} />
      <GateCtaModal reason={gate?.reason ?? null} title={gate?.title} body={gate?.body} onClose={() => setGate(null)} />
      <PlaylistRating isOpen={showRating} onClose={handleRatingClose} onStatusChange={handleStatusChange} />
      <PlaylistRename isOpen={showRename} onClose={handleRenameClose} onStatusChange={handleStatusChange} />
      <PlaylistShare isOpen={showShare} onClose={handleShareClose} id={playlistData?.playlist?.id ?? ""} />
      <PlaylistExport isOpen={showDownloadExport} onClose={handleDownloadExportClose} onStatusChange={handleStatusChange} />
      <AppleExportModal
        isOpen={showAppleExport}
        onClose={() => setShowAppleExport(false)}
        onStatusChange={handleStatusChange}
        initialPlaylistId={playlistData?.playlist?.id}
      />

      <StatusMessage
        isOpen={showStatus}
        onClose={handleStatusClose}
        status={statusType}
        message={statusMessage}
        title={statusTitle}
      />

      {/* Public/private toggle confirmation */}
      <ConfirmDialog
        isOpen={visibilityConfirm}
        onClose={() => setVisibilityConfirm(false)}
        onConfirm={handleConfirmVisibility}
        eyebrow="Playlist // Visibility"
        title={playlistData?.playlist?.is_public ? "Make playlist private" : "Make playlist public"}
        message={playlistData?.playlist?.is_public
          ? "This playlist will no longer be reachable by its share link; only you can open it."
          : "Anyone with the link will be able to open this playlist."}
        confirmLabel={playlistData?.playlist?.is_public ? "Make Private" : "Make Public"}
        busy={visibilityBusy}
        busyLabel="Updating…"
      />
    </div>
  );
};

export default PlaylistHero;
