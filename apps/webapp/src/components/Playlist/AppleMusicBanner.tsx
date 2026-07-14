import { usePlaylistStore } from "@resomix/stores";

/**
 * Attribution banner shown when the playlist contains Apple Music preview tracks (the public
 * catalogue). Apple's brand guidelines require crediting Apple Music when using their previews.
 * (A future step can swap the text for the official Apple Music badge for full brand compliance.)
 */
export function AppleMusicBanner() {
  const playlistData = usePlaylistStore((s: any) => s.playlistData);
  const hasPreview =
    playlistData?.queried_track?.playback === "preview" ||
    (playlistData?.similar_tracks ?? []).some((t: any) => t?.playback === "preview");

  if (!hasPreview) return null;

  return (
    <div className="w-full flex items-center justify-center py-[var(--px-8)]">
      <span className="text-[length:var(--px-9)] font-fira font-light tracking-[var(--px-0-1)] text-white/60 uppercase">
        Song previews provided by Apple&nbsp;Music
      </span>
    </div>
  );
}
