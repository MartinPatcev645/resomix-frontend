/**
 * usePlaylistCover
 * ================
 *
 * Single source for the owner-only custom playlist cover: it both BUILDS the cover URL (fetched
 * from the media server by playlist uuid + playback token, mirroring peaks / track covers) and
 * OWNS the upload action (client validation → POST → flip the store flag → re-fetch the replaced
 * image). Keeping both here means the desktop and mobile `PlaylistHero` stay in sync and the pages
 * stay thin.
 *
 * Client validation mirrors the server gates so obvious mistakes fail instantly (no round-trip):
 *   • JPEG or PNG only
 *   • ≤ 1 MB
 *   • square (equal width/height)
 *   • between 200px and 3000px on each side
 * The alwyzon backend re-checks size/type + owner and the media server re-checks square/resolution
 * with Pillow — the client checks are UX only, never the security boundary.
 */

import { useCallback, useState } from "react";
import { usePlaylistStore } from "@resomix/stores";
import { uploadPlaylistCover } from "@resomix/api-client";
import { usePlaylistCoverUrl } from "./usePlaylistCoverUrl";

const MAX_COVER_BYTES = 1024 * 1024; // 1 MB — kept in sync with the backend limit.
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
  /** Validate + upload a chosen file. Returns a human-readable error on failure. */
  upload: (file: File) => Promise<CoverActionResult>;
}

/** Read an image file's pixel dimensions in the browser. Rejects on a non-decodable file. */
function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
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

/** Client-side pre-flight validation (UX only — the server re-validates authoritatively). */
async function validateCoverFile(file: File): Promise<CoverActionResult> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    return { ok: false, error: "Please choose a JPEG or PNG image." };
  }
  if (file.size > MAX_COVER_BYTES) {
    return { ok: false, error: "Image must be 1 MB or smaller." };
  }
  let dims: { width: number; height: number };
  try {
    dims = await readImageDimensions(file);
  } catch {
    return { ok: false, error: "That file doesn’t look like a valid image." };
  }
  if (dims.width !== dims.height) {
    return { ok: false, error: "Cover must be square (equal width and height)." };
  }
  if (dims.width < MIN_DIM || dims.width > MAX_DIM) {
    return { ok: false, error: `Cover must be between ${MIN_DIM}px and ${MAX_DIM}px on each side.` };
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

  const upload = useCallback(
    async (file: File): Promise<CoverActionResult> => {
      if (!playlistUuid) return { ok: false, error: "No playlist to update." };

      const valid = await validateCoverFile(file);
      if (!valid.ok) return valid;

      setIsUploading(true);
      try {
        const resp = await uploadPlaylistCover(playlistUuid, file);
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

  return { coverUrl, isUploading, upload };
}
