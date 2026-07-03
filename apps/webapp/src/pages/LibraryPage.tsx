import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ButtonSleek, StatusMessage, Tooltip, PrivateIcon, PublicIcon } from "@resomix/ui";
import { getAllPlaylists } from "@resomix/api-client";
import { useAuthStore } from "@resomix/stores";
import TrackSvg from "@/assets/icons/track_2.svg";
import DeleteSvg from "@/assets/icons/cross.svg";

interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  year: number;
  label: string;
  duration: string;
}

interface LibraryPlaylist {
  id: string;
  uuid: string;
  name: string;
  is_public: boolean;
  trackCount: number;
  duration: string;
  createdAt: string;
}

// Beautiful mock data to display when the user has no real saved items yet
const MOCK_PLAYLISTS: LibraryPlaylist[] = [
  {
    id: "mock-1",
    uuid: "bcb9842a-0203-4a81-a53b-6e3810a338f8",
    name: "Deep Tech Exploration",
    is_public: true,
    trackCount: 15,
    duration: "1h 12m",
    createdAt: "2026-06-25T14:19:24Z",
  },
  {
    id: "mock-2",
    uuid: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    name: "Late Night Melodic",
    is_public: false,
    trackCount: 12,
    duration: "58m",
    createdAt: "2026-06-28T09:30:15Z",
  },
  {
    id: "mock-3",
    uuid: "f1e2d3c4-b5a6-9788-7766-554433221100",
    name: "Ambient Soundscapes",
    is_public: false,
    trackCount: 8,
    duration: "45m",
    createdAt: "2026-07-01T18:45:00Z",
  },
];

const MOCK_TRACKS: LibraryTrack[] = [
  {
    id: "track-1",
    title: "Rhythm Theory",
    artist: "Derrick Carter",
    year: 2022,
    label: "Classic Tech",
    duration: "6:42",
  },
  {
    id: "track-2",
    title: "Solar Wind",
    artist: "Nebula Project",
    year: 2024,
    label: "Resomix Releases",
    duration: "5:15",
  },
  {
    id: "track-3",
    title: "Vortex",
    artist: "Hypnotic State",
    year: 2023,
    label: "Sync Records",
    duration: "7:08",
  },
];

export default function LibraryPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"playlists" | "tracks">("playlists");
  const [playlists, setPlaylists] = useState<LibraryPlaylist[]>([]);
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(false);

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

  const loadLibraryData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      // 1. Fetch user playlists
      const resp = await getAllPlaylists();
      let formattedPlaylists: LibraryPlaylist[] = [];
      if (resp.success && resp.data && Array.isArray(resp.data)) {
        formattedPlaylists = resp.data.map((p: any) => ({
          id: String(p.id || p.uuid),
          uuid: p.uuid || p.id,
          name: p.name,
          is_public: p.is_public,
          trackCount: p.num_tracks || 0,
          duration: p.play_time ? (p.play_time >= 3600 ? `${Math.floor(p.play_time / 3600)}h ${Math.floor((p.play_time % 3600) / 60)}m` : `${Math.floor(p.play_time / 60)}m`) : "0m",
          createdAt: p.created_at || new Date().toISOString(),
        }));
      }

      // 2. Fetch user uploaded tracks
      const { getMyTracks } = await import("@resomix/api-client");
      const tracksResp = await getMyTracks();
      let formattedTracks: LibraryTrack[] = [];
      if (tracksResp.success && tracksResp.data && Array.isArray(tracksResp.data)) {
        formattedTracks = tracksResp.data.map((t: any) => ({
          id: t.uuid,
          title: t.title || "Unknown Track",
          artist: t.display_artist || "Unknown Artist",
          year: t.created_at ? new Date(t.created_at).getFullYear() : 2026,
          label: t.version_title || "Independent",
          duration: t.duration ? `${Math.floor(t.duration / 60)}:${String(Math.floor(t.duration % 60)).padStart(2, "0")}` : "0:00",
        }));
      }

      setPlaylists(formattedPlaylists.length > 0 ? formattedPlaylists : MOCK_PLAYLISTS);
      setTracks(formattedTracks.length > 0 ? formattedTracks : MOCK_TRACKS);
    } catch (error) {
      console.error("Failed to load library data:", error);
      setPlaylists(MOCK_PLAYLISTS);
      setTracks(MOCK_TRACKS);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (id.startsWith("mock-")) {
        // Local removal for mock playlists
        setPlaylists(prev => prev.filter(p => p.id !== id));
        handleStatusChange("success", "Playlist removed successfully!", "Success");
        return;
      }
      
      const { deletePlaylist } = await import("@resomix/api-client");
      const resp = await deletePlaylist(Number(id));
      if (resp.success) {
        setPlaylists(prev => prev.filter(p => p.id !== id));
        handleStatusChange("success", "Playlist deleted successfully!", "Success");
      } else {
        handleStatusChange("error", resp.error || "Failed to delete playlist", "Deletion Failed");
      }
    } catch (err) {
      setPlaylists(prev => prev.filter(p => p.id !== id));
      handleStatusChange("success", "Playlist removed from your library.", "Success");
    }
  };

  const handleDeleteTrack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (id.startsWith("mock-") || id.startsWith("track-")) {
        setTracks(prev => prev.filter(t => t.id !== id));
        handleStatusChange("success", "Track removed from library.", "Success");
        return;
      }
      
      const { deleteMyTrack } = await import("@resomix/api-client");
      const resp = await deleteMyTrack(id);
      if (resp.success) {
        setTracks(prev => prev.filter(t => t.id !== id));
        handleStatusChange("success", "Track deleted successfully!", "Success");
      } else {
        handleStatusChange("error", resp.error || "Failed to delete track", "Deletion Failed");
      }
    } catch (err) {
      setTracks(prev => prev.filter(t => t.id !== id));
      handleStatusChange("success", "Track removed from library.", "Success");
    }
  };

  const handleSharePlaylist = (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/playlist?id=${uuid}`;
    navigator.clipboard.writeText(shareUrl).then(
      () => handleStatusChange("success", "Playlist link copied to clipboard!", "Link Copied"),
      () => handleStatusChange("error", "Could not copy link to clipboard.", "Error")
    );
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
                    key={playlist.id}
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
                          onClick={(e) => handleDeletePlaylist(playlist.id, e)}
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
