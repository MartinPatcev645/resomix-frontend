import React, { useEffect } from "react";
import { IconButton, HoverFlow, ToggleButton, StatusMessage, Tooltip, PrivateIcon, PublicIcon, HeartStrokeIcon, HeartFilledIcon } from "@resomix/ui";
import { formatDuration, usePlaylistExport, usePlaylistFork } from "@resomix/hooks";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";
import { useNavigate, useLocation } from "react-router-dom";
import { InputPlayer, PlaylistRating, PlaylistShare, PlaylistRename, PlaylistExport } from "@/components/index.ts";
import RenameSvg from "@/assets/icons/rename.svg";
import RenameBlackSvg from "@/assets/icons/rename_black.svg";
import ShareSvg from "@/assets/icons/share.svg";
import ShareBlackSvg from "@/assets/icons/share_black.svg";
import ExportSvg from "@/assets/icons/export.svg";
import ExportBlackSvg from "@/assets/icons/export_black.svg";
import AngleLeftSvg from "@/assets/icons/angle_left.svg";
import StarSvg from "@/assets/icons/star.svg";
import TrackSvg from "@/assets/icons/track_2.svg";
import TimeSvg from "@/assets/icons/time.svg";
import InfoSvg from "@/assets/icons/info.svg";

const InputTrackStatus = "Loading..."

const PlaylistHero: React.FC = () => {
  const [showMeta, setShowMeta] = React.useState(false);
  const [showRating, setShowRating] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [showRename, setShowRename] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState(false);
  const [statusType, setStatusType] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [statusTitle, setStatusTitle] = React.useState('');
  const [showLoginButton, setShowLoginButton] = React.useState(false);
  const [forkedPlaylistId, setForkedPlaylistId] = React.useState<string | null>(null);
  const [hasForkedThisPlaylist, setHasForkedThisPlaylist] = React.useState(false);

  const { playlistData, isLoading, error } = usePlaylistStore();
  const { autoplay, setAutoplay, uploadedCoverArt } = usePlayerStore();
  const { canExport, isExporting } = usePlaylistExport();
  const navigate = useNavigate();
  const location = useLocation();

  // Reset fork state when playlist changes
  useEffect(() => {
    setHasForkedThisPlaylist(false);
    setForkedPlaylistId(null);
  }, [playlistData?.playlist.id]);

  const handleStatusChange = (type: 'loading' | 'success' | 'error', message: string, title?: string) => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title || '');
    setShowStatus(true);
  };

  const handleRenameClose = () => setShowRename(false);
  const handleRatingClose = () => setShowRating(false);
  const handleExportClose = () => setShowExport(false);
  const handleStatusClose = () => {
    setShowStatus(false);
    // Don't clear forkedPlaylistId or hasForkedThisPlaylist here - keep them for the button to work
  };

  const handleExportClick = () => {
    if (!canExport) {
      handleStatusChange('error', 'No playlist data available to export', 'Export Failed');
      return;
    }
    setShowExport(true);
  };

  // Fork functionality with StatusMessage
  const { fork, forking } = usePlaylistFork({
    onError: (title, message) => {
      // Check if the error is authentication related
      const isAuthError = message.toLowerCase().includes('not authenticated') ||
        message.toLowerCase().includes('log in');
      setShowLoginButton(isAuthError);
      setForkedPlaylistId(null); // Clear forked playlist ID on error
      handleStatusChange('error', message, title);
    },
    onSuccess: (title, message, response) => {
      setShowLoginButton(false);
      setHasForkedThisPlaylist(true); // Mark as forked locally
      // Store the forked playlist ID from the response
      if (response?.data?.playlist?.id) {
        setForkedPlaylistId(response.data.playlist.id);
      }
      handleStatusChange('success', message, title);
    },
  });

  const handleForkClick = async () => {
    if (!playlistData?.playlist.id || forking) return;
    await fork(playlistData.playlist.id);
  };

  const handleLoginClick = () => {
    setShowLoginButton(false);
    setShowStatus(false);
    navigate(`/auth/login?redirect=${encodeURIComponent(location.pathname)}`);
  };

  const handleOpenYourCopyClick = () => {
    if (forkedPlaylistId) {
      setShowStatus(false);
      setForkedPlaylistId(null);
      window.location.href = `${BASE_BETA_URL}/playlist?id=${forkedPlaylistId}`;
    }
  };

  // Check if playlist is already forked (either from server or locally)
  const isForked = playlistData?.playlist.fork_id && playlistData.playlist.fork_id.trim() !== '' || hasForkedThisPlaylist;


  return (
    <div className="relative">
      {/* Hidden SVG defs for clip-path */}
      <svg
        viewBox="0 0 1152 628"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-[length:var(--px-628)] pointer-events-none z-10"
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
              <a
                aria-label="Generate track similarity"
                href={BASE_BETA_URL}
                className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline playlist-nav-link"
                id="playlist-hero-back-link"
              >
                <img src={AngleLeftSvg} alt="" aria-hidden="true" draggable={false} className="w-[var(--px-13)] h-[var(--px-13)]" />
                Generate track similarity
              </a>
              <div className="flex items-center gap-[var(--px-8)]">
                <Tooltip message={autoplay ? "Turn off Autoplay" : "Turn on Autoplay"}>
                  <ToggleButton
                    text="Autoplay"
                    customWidth="min-w-[var(--px-120)]"
                    isOn={autoplay}
                    onToggle={setAutoplay}
                  />
                </Tooltip>
                <Tooltip message="Rename your Playlist">
                  <IconButton
                    text="Rename"
                    transparent={true}
                    customWidth="min-w-[var(--px-100)]"
                    onClick={() => setShowRename(true)}
                    icon={<img src={RenameSvg} draggable={false} alt="Rename" aria-label="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    hoverIcon={<img src={RenameBlackSvg} aria-label="Rename" draggable={false} alt="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    className="playlist-action-button"
                    id="playlist-hero-rename-button"
                  />
                </Tooltip>
                <Tooltip message="Make Public and Generate Shareable Link">
                  <IconButton
                    text="Share"
                    transparent={true}
                    customWidth="min-w-[var(--px-100)]"
                    onClick={() => setShowShare(true)}
                    icon={<img src={ShareSvg} draggable={false} aria-label="Share" alt="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    hoverIcon={<img src={ShareBlackSvg} draggable={false} alt="Share" aria-label="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    className="playlist-action-button"
                    id="playlist-hero-share-button"
                  />
                </Tooltip>

                <Tooltip message="Export Playlist to TXT file">
                  <IconButton
                    text={isExporting ? "Exporting..." : "Export"}
                    transparent={true}
                    customWidth="min-w-[var(--px-100)]"
                    onClick={handleExportClick}
                    disabled={isExporting}
                    icon={<img src={ExportSvg} draggable={false} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    hoverIcon={<img src={ExportBlackSvg} draggable={false} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    className="playlist-action-button"
                    id="playlist-hero-export-button"
                  />
                </Tooltip>
              </div>
            </div>

            <div className="relative border border-dotted border-slate-200 p-[var(--px-20)] h-full w-full">
              <div className="flex items-start gap-[var(--px-30)]">
                <div className="flex flex-col items-center gap-[var(--px-10)]">
                  <div className="border border-dotted border-slate-200 p-[var(--px-20)]">
                    {uploadedCoverArt ? (
                      <img src={uploadedCoverArt} draggable={false} aria-label="Track Cover" alt="Track Cover" className="w-[var(--px-90)] h-[var(--px-90)] object-cover" />
                    ) : (
                      <img src={TrackSvg} draggable={false} alt="Track Cover" aria-label="Track Cover" className="w-[var(--px-90)] h-[var(--px-90)]" />
                    )}
                  </div>
                  <button
                    type="button"
                    name="Rate this playlist"
                    onClick={() => setShowRating(true)}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-[var(--px-10)] flex gap-[var(--px-8)] items-end cursor-pointer playlist-rating-button"
                    id="playlist-hero-rating-button"
                    aria-label="Rate this playlist"
                    aria-expanded={showRating}
                    data-playlist-id={playlistData?.playlist.id}
                  >
                    <img src={StarSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-12)] h-[var(--px-12)] mb-[var(--px-2)]" />
                    <span className="text-[length:var(--px-8)] tracking-[var(--px-0-25)] font-light font-fira text-[var(--color-text-primary)]">Rate This Playlist</span>
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
                          text={playlistData?.playlist.name || "No playlist data"}
                          maxChars={35}
                          delay={800}
                          speed={80}
                          endPause={1000}
                          maxWidth="400px"
                        />
                      </h1>
                    )}
                    <div className={`text-[length:var(--px-9)] font-light tracking-[var(--px-0-1)] font-fira leading-[var(--px-14)] ${(playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title) === playlistData?.playlist.name ? 'hidden' : ''}`}>
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
                    <div className={`${(playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title) === playlistData?.playlist.name ? '' : 'hidden'}`}></div>
                    <div className="flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-9)] font-light font-fira leading-[var(--px-14)] items-center">
                      <img src={TimeSvg} draggable={false} aria-label="Time" alt="Time" className="w-[var(--px-10)] h-[var(--px-10)]" />
                      <div>{playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}</div>
                      <div>|</div>
                      <div>{playlistData?.queried_track.year}</div>
                      <div>|</div>
                      <div>{playlistData?.queried_track.label}</div>
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
                {isForked ? (
                  <HeartFilledIcon customWidth="24" customHeight="24" className="text-white" disableHover={true} />
                ) : (
                  <Tooltip message="Fork this playlist as your own">
                    <HeartStrokeIcon customWidth="24" customHeight="24" className="text-white mt-[var(--px-6)]" onClick={handleForkClick} />
                  </Tooltip>
                )}
                <Tooltip message={playlistData?.playlist.is_public ? "Playlist is Public" : "Playlist is Private! Share to make it public"}>
                  <div className={`px-[var(--px-8)] py-[var(--px-4)] rounded-3xl inline-flex justify-center items-center gap-[var(--px-8)] bg-[var(--color-secondary-background)] text-[length:var(--px-9)] tracking-[var(--px-0-25)] font-light font-fira uppercase cursor-pointer ${playlistData?.playlist.is_public ? 'text-[#5C5C5C]' : 'text-white'}`}>
                    {playlistData?.playlist.is_public ? (
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
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
          <div className="text-[var(--color-text-secondary)] text-[length:var(--px-19)] font-light font-helvetica uppercase">SONIC MATCH FOUND</div>
        </div>
      </div>

      {/* Modals */}
      <PlaylistRating
        isOpen={showRating}
        onClose={handleRatingClose}
        onStatusChange={handleStatusChange}
      />
      <PlaylistShare isOpen={showShare} onClose={() => setShowShare(false)} id={playlistData?.playlist.id || ''} />
      <PlaylistRename
        isOpen={showRename}
        onClose={handleRenameClose}
        onStatusChange={handleStatusChange}
      />

      <PlaylistExport
        isOpen={showExport}
        onClose={handleExportClose}
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
    </div>
  );
};

export default PlaylistHero;
