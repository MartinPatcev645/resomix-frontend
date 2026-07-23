/**
 * usePlaylistCover
 * ================
 *
 * Single source for the owner-only custom playlist cover: it BUILDS the cover URL (fetched from the
 * media server by playlist uuid + playback token, mirroring peaks / track covers) and OWNS the upload
 * action. Keeping both here means the desktop and mobile `PlaylistHero` stay in sync and the pages
 * stay thin.
 *
 * Flow: pick a file → `validateOriginal` (type / ≤ 3 MB / 100–4000 px per side, NON-square allowed) →
 * the caller opens the crop modal (react-easy-crop) → the user crops to a square → `upload(blob)`
 * sends the cropped square. So the backend/media server always receives a proper square.
 *
 * The alwyzon backend re-checks size/type + owner and the media server re-checks square/resolution
 * with Pillow — the client checks are UX only, never the security boundary.
 */

import { useCallback, useState } from "react";
import { usePlaylistStore } from "@resomix/stores";
import { uploadPlaylistCover } from "@resomix/api-client";
import { usePlaylistCoverUrl } from "./usePlaylistCoverUrl";

const MAX_COVER_BYTES = 3 * 1024 * 1024; // 3 MB — kept in sync with the backend limit.
const MIN_DIM = 100; // kept in sync with the media server's _PLAYLIST_COVER_MIN_DIM
const MAX_DIM = 4000; // kept in sync with the media server's _PLAYLIST_COVER_MAX_DIM

export interface CoverActionResult {
  ok: boolean;
  error?: string;
}

export interface UsePlaylistCoverResult {
  /** Media-server cover URL when a custom cover exists (with a cache-buster after upload); else null. */
  coverUrl: string | null;
  /** True while an upload request is in flight. */
  isUploading: boolean;
  /** Validate a freshly-picked file BEFORE cropping (type / size / bounds; non-square is allowed). */
  validateOriginal: (file: File) => Promise<CoverActionResult>;
  /** Upload the cropped square (a Blob produced by the crop modal). */
  upload: (blob: Blob) => Promise<CoverActionResult>;
}

/** Read an image file's pixel dimensions in the browser. Rejects on a non-decodable file. */
function readImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode-failed"));
    };
    img.src = url;
  });
}

/**
 * Pre-flight validation of the ORIGINAL picked file (UX only — the server re-validates). Non-square is
 * allowed here: the user crops to a square in the modal afterwards. We just gate type, size, and that
 * each side is within [MIN_DIM, MAX_DIM] so the eventual square crop stays in range.
 */
async function validateOriginalFile(file: File): Promise<CoverActionResult> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return { ok: false, error: "Please choose a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_COVER_BYTES) {
    return { ok: false, error: "Image must be 3 MB or smaller." };
  }
  let dims: { width: number; height: number };
  try {
    dims = await readImageDimensions(file);
  } catch {
    return { ok: false, error: "That file doesn’t look like a valid image." };
  }
  if (dims.width < MIN_DIM || dims.height < MIN_DIM) {
    return { ok: false, error: `Image must be at least ${MIN_DIM}×${MIN_DIM} px.` };
  }
  if (dims.width > MAX_DIM || dims.height > MAX_DIM) {
    return { ok: false, error: `Image must be at most ${MAX_DIM}×${MAX_DIM} px.` };
  }
  return { ok: true };
}

export function usePlaylistCover(
  playlistUuid: string | null | undefined,
  hasCustomCover: boolean,
): UsePlaylistCoverResult {
  const updateCustomCover = usePlaylistStore((s) => s.updatePlaylistCustomCover);

  const [isUploading, setIsUploading] = useState(false);
  // Bumped after a successful upload so the (same-URL) replaced image is re-fetched, not cached.
  const [bust, setBust] = useState(0);

  const coverUrl = usePlaylistCoverUrl(playlistUuid, hasCustomCover, bust);

  const validateOriginal = useCallback(
    (file: File): Promise<CoverActionResult> => validateOriginalFile(file),
    [],
  );

  const upload = useCallback(
    async (blob: Blob): Promise<CoverActionResult> => {
      if (!playlistUuid) return { ok: false, error: "No playlist to update." };

      setIsUploading(true);
      try {
        const resp = await uploadPlaylistCover(playlistUuid, blob);
        if (resp && (resp as { success?: boolean }).success) {
          updateCustomCover?.(true);
          setBust(Date.now()); // force a re-fetch of the newly stored image
          return { ok: true };
        }
        return {
          ok: false,
          error: (resp as { error?: string })?.error || "Failed to upload cover. Please try again.",
        };
      } catch (err) {
        return { ok: false, error: (err as Error)?.message || "Failed to upload cover. Please try again." };
      } finally {
        setIsUploading(false);
      }
    },
    [playlistUuid, updateCustomCover],
  );

  return { coverUrl, isUploading, validateOriginal, upload };
}
