import React from "react";
import { usePlaylistCover } from "@resomix/hooks";
import { CoverCropModal } from "@/components/Playlist/CoverCropModal.tsx";
import DefaultCover from "@/assets/default-playlist-cover.jpg";

/**
 * PlaylistCoverEditor
 * ===================
 *
 * Self-contained "cover preview + pen" block: shows the current cover (custom cover → bundled
 * default, the same precedence as the playlist hero) and lets the owner replace it — pick → validate
 * → crop to a square → upload.
 *
 * Extracted so a surface OTHER than the playlist hero can offer the same edit flow; it is currently
 * embedded in the library's rename modal via that modal's optional `cover` slot. The crop modal it
 * renders is a portaled `StatusMessage` (z-[120]), so it correctly stacks ABOVE a host modal.
 *
 * The hero deliberately keeps its own inline copy of this UI (its cover carries the canvas title
 * overlay and hero-specific layout), so nothing here changes the playlist page.
 */

export interface PlaylistCoverEditorProps {
  playlistUuid: string;
  hasCustomCover: boolean;
  /** Fired after a successful upload — the host closes its modals and shows the success message. */
  onUpdated: () => void;
  /** Fired with a user-facing message when validation or upload fails. */
  onError: (message: string) => void;
}

export const PlaylistCoverEditor: React.FC<PlaylistCoverEditorProps> = ({
  playlistUuid,
  hasCustomCover,
  onUpdated,
  onError,
}) => {
  const { coverUrl, isUploading, validateOriginal, upload } = usePlaylistCover(playlistUuid, hasCustomCover);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  // Object URL of the picked (pre-crop) image; non-null opens the crop modal.
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);

  const closeCrop = () => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handlePick = () => {
    if (isUploading) return;
    inputRef.current?.click();
  };

  const handleSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    const valid = await validateOriginal(file);
    if (!valid.ok) {
      onError(valid.error || "That image can’t be used.");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    closeCrop();
    const res = await upload(blob);
    if (res.ok) onUpdated();
    else onError(res.error || "Failed to update the cover.");
  };

  return (
    <>
      <div className="relative border border-dotted border-slate-200 w-[var(--px-120)] h-[var(--px-120)]">
        <img
          src={(hasCustomCover ? coverUrl : null) || DefaultCover}
          onError={(e) => { e.currentTarget.src = DefaultCover; }}
          draggable={false}
          aria-label="Playlist Cover"
          alt="Playlist Cover"
          className="block w-full h-full object-cover"
        />

        {/* Uploading loader over the existing cover */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span
              className="w-[var(--px-24)] h-[var(--px-24)] border-2 border-white/40 border-t-white rounded-full animate-spin"
              aria-label="Uploading cover"
            />
          </div>
        )}

        {/* Pen on the top-right corner of the border — same treatment as the playlist hero. */}
        <button
          type="button"
          onClick={handlePick}
          disabled={isUploading}
          aria-label="Change cover image"
          title="Change cover image"
          className="absolute -top-[var(--px-10)] -right-[var(--px-10)] w-[var(--px-26)] h-[var(--px-26)] flex items-center justify-center rounded-full bg-[var(--color-secondary-background)] text-white cursor-pointer shadow-[0_var(--px-3)_var(--px-8)_rgba(0,0,0,0.55)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] hover:scale-110 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          id="playlist-cover-editor-edit-button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[var(--px-12)] h-[var(--px-12)]" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleSelected}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Portaled (z-[120]) — renders above the host modal. */}
      <CoverCropModal
        isOpen={!!cropSrc}
        imageSrc={cropSrc}
        onCancel={closeCrop}
        onConfirm={handleCropConfirm}
      />
    </>
  );
};

export default PlaylistCoverEditor;
