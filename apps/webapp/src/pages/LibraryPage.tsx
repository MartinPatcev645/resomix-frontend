import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ButtonSleek, StatusMessage, Tooltip, PrivateIcon, PublicIcon } from "@resomix/ui";
import { useAuthStore } from "@resomix/stores";
import { useLibrary } from "@resomix/hooks";
import TrackSvg from "@/assets/icons/track_2.svg";
import DeleteSvg from "@/assets/icons/cross.svg";

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

  const handleStatusChange = (type: "loading" | "success" | "error", message: string, title = "") => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title);
    setShowStatus(true);
  };

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

  const handleSharePlaylist = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await sharePlaylist(uuid);
    if (result.success) {
      const shareUrl = `${window.location.origin}/playlist?id=${uuid}`;
      navigator.clipboard.writeText(shareUrl).then(
        () => handleStatusChange("success", "Playlist is now public. Link copied to clipboard!", "Shared Successfully"),
        () => handleStatusChange("success", "Playlist is now public.", "Shared Successfully")
      );
    } else {
      handleStatusChange("error", result.error || "Failed to share playlist", "Sharing Failed");
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

        <div className="mx-auto w-full max-w-4xl px-[var(--px-20)] lg:px-0">
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
                    onClick={() => navigate(`/playlist?id=${playlist.uuid}`)}
                    className="w-full border border-dotted border-slate-200/60 p-[var(--px-16)] flex justify-between items-center relative hover:bg-white/5 transition-colors cursor-pointer rounded-xs"
                  >
                    <div className="flex items-center gap-[var(--px-20)]">
                      <div className="border border-dotted border-slate-200 p-[var(--px-10)] flex-shrink-0 bg-black/40">
                        <img
                          src={TrackSvg}
                          draggable={false}
                          alt="Playlist Icon"
                          className="w-[var(--px-32)] h-[var(--px-32)]"
                        />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-[var(--color-primary)] leading-tight">
                          {playlist.name}
                        </h3>
                        <p className="text-[length:var(--px-10)] font-light font-fira text-white/60 mt-[var(--px-4)]">
                          {playlist.trackCount} tracks | {playlist.duration} | Created{" "}
                          {new Date(playlist.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-[var(--px-15)]">
                      <Tooltip message={playlist.is_public ? "Public Playlist" : "Private Playlist"}>
                        <div className="text-white/60">
                          {playlist.is_public ? (
                            <PublicIcon customWidth="14" customHeight="14" disableHover />
                          ) : (
                            <PrivateIcon customWidth="14" customHeight="14" disableHover />
                          )}
                        </div>
                      </Tooltip>

                      <div className="flex items-center gap-[var(--px-10)]" onClick={e => e.stopPropagation()}>
                        <ButtonSleek
                          text="Open"
                          onClick={() => navigate(`/playlist?id=${playlist.uuid}`)}
                        />
                        <ButtonSleek
                          text="Share"
                          onClick={(e) => handleSharePlaylist(playlist.uuid, e)}
                          transparent
                        />
                        <button
                          onClick={(e) => handleDeletePlaylist(playlist.uuid, e)}
                          className="p-[var(--px-8)] hover:text-red-500 transition-colors cursor-pointer flex items-center justify-center"
                          aria-label="Delete playlist"
                        >
                          <img
                            src={DeleteSvg}
                            alt="Delete"
                            className="w-[var(--px-14)] h-[var(--px-14)]"
                          />
                        </button>
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
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => navigate(`/?id=${track.id}`)}
                    className="w-full border border-dotted border-slate-200/60 p-[var(--px-16)] flex justify-between items-center relative hover:bg-white/5 transition-colors cursor-pointer rounded-xs"
                  >
                    <div className="flex items-center gap-[var(--px-20)]">
                      <div className="border border-dotted border-slate-200 p-[var(--px-10)] flex-shrink-0 bg-black/40">
                        <img
                          src={TrackSvg}
                          draggable={false}
                          alt="Track Icon"
                          className="w-[var(--px-32)] h-[var(--px-32)]"
                        />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-[var(--color-primary)] leading-tight">
                          {track.title}
                        </h3>
                        <p className="text-[length:var(--px-10)] font-light font-fira text-white/60 mt-[var(--px-4)]">
                          {track.artist} | {track.year} | {track.label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-[var(--px-15)]" onClick={e => e.stopPropagation()}>
                      <span className="text-[length:var(--px-10)] font-light font-fira text-white/40">
                        {track.duration}
                      </span>
                      <div className="flex items-center gap-[var(--px-10)]">
                        <ButtonSleek
                          text="Find Matches"
                          onClick={() => navigate(`/?id=${track.id}`)}
                        />
                        <button
                          onClick={(e) => handleDeleteTrack(track.id, e)}
                          className="p-[var(--px-8)] hover:text-red-500 transition-colors cursor-pointer flex items-center justify-center"
                          aria-label="Remove track"
                        >
                          <img
                            src={DeleteSvg}
                            alt="Delete"
                            className="w-[var(--px-14)] h-[var(--px-14)]"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Pagination Controls */}
          {!loading && (activeTab === "playlists" ? playlistsTotalPages > 1 : tracksTotalPages > 1) && (
            <div className="flex justify-center items-center gap-[var(--px-20)] mt-[var(--px-30)] mb-[var(--px-50)]">
              <ButtonSleek
                text="Prev"
                disabled={activeTab === "playlists" ? playlistsPage <= 1 : tracksPage <= 1}
                onClick={handlePrevPage}
                transparent
              />
              <span className="text-[length:var(--px-14)] font-light font-fira text-white/80">
                Page {activeTab === "playlists" ? playlistsPage : tracksPage} of{" "}
                {activeTab === "playlists" ? playlistsTotalPages : tracksTotalPages}
              </span>
              <ButtonSleek
                text="Next"
                disabled={
                  activeTab === "playlists"
                    ? playlistsPage >= playlistsTotalPages
                    : tracksPage >= tracksTotalPages
                }
                onClick={handleNextPage}
                transparent
              />
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
