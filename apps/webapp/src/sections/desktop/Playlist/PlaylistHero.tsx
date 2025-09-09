import React from "react";
import { IconButton, HoverFlow, ToggleButton, StatusMessage, Tooltip } from "@resomix/ui";
import { formatDuration, usePlaylistExport } from "@resomix/hooks";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
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
import { BASE_BETA_URL } from "@resomix/config";

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
  const { playlistData, isLoading, error } = usePlaylistStore();
  // const { uploadedUrl } = usePlayerStore();
  const { autoplay, setAutoplay, uploadedCoverArt } = usePlayerStore();
  const { canExport, isExporting } = usePlaylistExport();

  const handleStatusChange = (type: 'loading' | 'success' | 'error', message: string, title?: string) => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title || '');
    setShowStatus(true);
  };

  const handleRenameClose = () => {
    setShowRename(false);
  };

  const handleRatingClose = () => {
    setShowRating(false);
  };

  const handleExportClose = () => {
    setShowExport(false);
  };

  const handleStatusClose = () => {
    setShowStatus(false);
  };

  const handleExportClick = () => {
    if (!canExport) {
      handleStatusChange('error', 'No playlist data available to export', 'Export Failed');
      return;
    }
    setShowExport(true);
  };

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
              <div onClick={() => { window.location.href = BASE_BETA_URL }} className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline hover:cursor-pointer">
                <img src={AngleLeftSvg} alt="Angle Left" className="w-[var(--px-13)] h-[var(--px-13)]" />
                Generate track similarity
              </div>
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
                    icon={<img src={RenameSvg} alt="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    hoverIcon={<img src={RenameBlackSvg} alt="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                  />
                </Tooltip>
                <Tooltip message="Make Public and Generate Shareable Link">
                  <IconButton
                    text="Share"
                    transparent={true}
                    customWidth="min-w-[var(--px-100)]"
                    onClick={() => setShowShare(true)}
                    icon={<img src={ShareSvg} alt="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    hoverIcon={<img src={ShareBlackSvg} alt="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                  />
                </Tooltip>
                <Tooltip message="Export Playlist to TXT file">
                  <IconButton
                    text={isExporting ? "Exporting..." : "Export"}
                    transparent={true}
                    customWidth="min-w-[var(--px-100)]"
                    onClick={handleExportClick}
                    disabled={isExporting}
                    icon={<img src={ExportSvg} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                    hoverIcon={<img src={ExportBlackSvg} alt="Export" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                  />
                </Tooltip>
              </div>
            </div>
            <div className="relative border border-dotted border-slate-200 p-[var(--px-20)] h-full w-full">
              <div className="flex items-start gap-[var(--px-30)]">
                <div className="flex flex-col items-center gap-[var(--px-10)]">
                  <div className="border border-dotted border-slate-200 p-[var(--px-20)]">
                    {uploadedCoverArt ? (
                      <img src={uploadedCoverArt} alt="Track Cover" className="w-[var(--px-90)] h-[var(--px-90)] object-cover" />
                    ) : (
                      <img src={TrackSvg} alt="Track" className="w-[var(--px-90)] h-[var(--px-90)]" />
                    )}
                  </div>
                  <div onClick={() => setShowRating(true)} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-[var(--px-10)] flex gap-[var(--px-8)] items-end hover:cursor-pointer">
                    <img src={StarSvg} alt="Star" className="w-[var(--px-12)] h-[var(--px-12)] mb-[var(--px-2)]" />
                    <div className="text-[length:var(--px-8)] tracking-[var(--px-0-25)] font-light font-fira text-[var(--color-text-primary)]">Rate This Playlist</div>
                  </div>
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
                      <div className="text-[length:var(--px-19)] font-light uppercase font-helvetica leading-[var(--px-24)]">
                        <HoverFlow
                          text={playlistData?.playlist.name || "No playlist data"}
                          maxChars={35}
                          delay={800}
                          speed={80}
                          endPause={1000}
                          maxWidth="400px"
                        />
                      </div>
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
                      <img src={TimeSvg} alt="Time" className="w-[var(--px-10)] h-[var(--px-10)]" />
                      <div>{playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}</div>
                      <div>|</div>
                      <div>{playlistData?.queried_track.year}</div>
                      <div>|</div>
                      <div>{playlistData?.queried_track.label}</div>
                      <Tooltip message={showMeta ? "Hide Meta Info" : "Show Meta Info"}>
                        <img onClick={() => setShowMeta((v) => !v)} src={InfoSvg} alt="Info" className="w-[var(--px-14)] h-[var(--px-14)] ml-[var(--px-20)] hover:cursor-pointer" />
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
                    {/* Render player only when we already know the track ID to avoid extra mounts */}
                    {playlistData?.queried_track.id && (
                      // Commented out the part to use the Uploaded Audio Blob for now
                      // <InputPlayer trackId={uploadedUrl ? 'uploaded-local' : playlistData.queried_track.id} audioUrl={uploadedUrl ?? undefined} totalDuration={playlistData.queried_track.duration ?? 0} />

                      // Using the API response same as selected track
                      <InputPlayer trackId={playlistData.queried_track.id} audioUrl={undefined} totalDuration={playlistData.queried_track.duration ?? 0} />
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute right-[var(--px-10)] top-[var(--px-10)] px-[var(--px-16)] py-[var(--px-4)] rounded-3xl inline-flex justify-center items-center gap-[var(--px-8)] bg-[var(--color-secondary-background)] text-[length:var(--px-9)] tracking-[var(--px-0-25)] font-light font-fira uppercase select-none text-[#5C5C5C]">Input Track</div>
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
      />
    </div>
  );
};

export default PlaylistHero;
