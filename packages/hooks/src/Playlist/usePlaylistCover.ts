/**
 * usePlaylistCover
 * ================
 *
 * Single source for the owner-only custom playlist cover: it BUILDS the cover URL (fetched from the
 * media server by playlist uuid + playback token, mirroring peaks / track covers) and OWNS both
 * halves of the change action. Keeping them here means the desktop hero, the mobile hero and the
 * library's rename modal stay in sync and the pages stay thin.
 *
 * Flow: pick a file → `prepare` (accept any image ≤ 15 MB, then downscale it to a working image) →
 * the caller opens the crop modal (react-easy-crop) on the PREPARED blob → the user crops → `upload`
 * sends the 500×500 square.
 *
 * `prepare` normalises rather than rejects. The old version validated instead: it required ≤ 3 MB and
 * each side within 100–4000 px, which rejected a plain 12 MP iPhone photo (4032×3024) by 32 pixels —
 * so every default iPhone shot bounced, and the user was told to go shrink it themselves. Size and
 * resolution are now something we fix, not something we ask the user to fix. The only things that can
 * still fail here are "that isn't an image", "that is over 15 MB", and "this browser cannot decode
 * that format" — all of which name a real problem the user can act on.
 *
 * Alwyzon re-checks size, format and resolution and owns the owner check; the client is UX only,
 * never the security boundary.
 */

import { useCallback, useState } from "react";
import { usePlaylistStore } from "@resomix/stores";
import { uploadPlaylistCover } from "@resomix/api-client";
import { usePlaylistCoverUrl } from "./usePlaylistCoverUrl";
import { MAX_COVER_BYTES, prepareForCrop } from "./coverImage";

export interface CoverActionResult {
  ok: boolean;
  error?: string;
}

export interface PreparedCover extends CoverActionResult {
  /** The downscaled working image to hand to the cropper. Present only when `ok`. */
  blob?: Blob;
}

export interface UsePlaylistCoverResult {
  /** Media-server cover URL when a custom cover exists (with a cache-buster after upload); else null. */
  coverUrl: string | null;
  /** True while an upload request is in flight. */
  isUploading: boolean;
  /** True while a picked file is being downscaled — can be a second or two on an older phone. */
  isPreparing: boolean;
  /** Accept + downscale a freshly picked file. Resolves with the blob to open the cropper on. */
  prepare: (file: File) => Promise<PreparedCover>;
  /** Upload the cropped square (a Blob produced by the crop modal). */
  upload: (blob: Blob) => Promise<CoverActionResult>;
}

export function usePlaylistCover(
  playlistUuid: string | null | undefined,
  hasCustomCover: boolean,
): UsePlaylistCoverResult {
  const updateCustomCover = usePlaylistStore((s) => s.updatePlaylistCustomCover);

  const [isUploading, setIsUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  // Bumped after a successful upload so the (same-URL) replaced image is re-fetched, not cached.
  const [bust, setBust] = useState(0);

  const coverUrl = usePlaylistCoverUrl(playlistUuid, hasCustomCover, bust);

  const prepare = useCallback(async (file: File): Promise<PreparedCover> => {
    // Any image format the browser can read is welcome — a camera or phone should never be told its
    // own output is "not allowed".
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "Please choose an image file." };
    }
    if (file.size > MAX_COVER_BYTES) {
      return { ok: false, error: "Image must be 15 MB or smaller." };
    }

    setIsPreparing(true);
    try {
      const blob = await prepareForCrop(file);
      return { ok: true, blob };
    } catch {
      // Almost always an undecodable format rather than a broken file — HEIC has no decoder outside
      // Safari, so an Android pick from a HEIC gallery lands here. Name the way out.
      return {
        ok: false,
        error: "This browser can’t read that image format. Try a JPEG, PNG, or WebP.",
      };
    } finally {
      setIsPreparing(false);
    }
  }, []);

  const upload = useCallback(
    async (blob: Blob): Promise<CoverActionResult> => {
      if (!playlistUuid) return { ok: false, error: "No playlist to update." };

      setIsUploading(true);
      try {
        const resp = await uploadPlaylistCover(playlistUuid, blob);
        if (resp && (resp as { success?: boolean }).success) {
          // Scoped by uuid: when this runs from the LIBRARY the playlist store may hold a different
          // playlist, and an unscoped flip would mark the wrong one as having a custom cover.
          updateCustomCover?.(true, playlistUuid);
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

  return { coverUrl, isUploading, isPreparing, prepare, upload };
}
