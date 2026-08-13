import axiosInstance, { axiosWrapper, handleApiError, validateAudioFile } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";
import type { ApiResponse, RequestOptions } from "./types/api";




// ---------------------------------------------------------------------------- //
// Similarity by upload — submit, then poll
// ---------------------------------------------------------------------------- //
//
// The blocking endpoint held the request open for the whole pipeline: receive the file, embed it
// on the GPU, search, build the playlist. Cloudflare closes an origin request at 100s, and load
// testing showed 20 concurrent 40MB uploads FINISHING on the server at 93s — 15 of 20 completed
// playlists were thrown away as 524s. A request that is never held open cannot time out at the
// edge, so the upload is accepted, a job id comes back, and we poll for the result.
//
// `getSimilarTracks` keeps its old signature and return shape on purpose: every caller consumes
// `{ success, data }` exactly as before, so nothing downstream had to change.

/** Poll cadence. Typical completion is a few seconds; the backoff protects a queued upload. */
const POLL_FAST_MS = 1_500;
const POLL_SLOW_MS = 3_000;
const POLL_BACKOFF_AFTER_MS = 30_000;
/** How long the CLIENT waits. The server keeps the job for an hour — this is only our patience. */
const POLL_TIMEOUT_MS = 600_000;
/** Consecutive network failures tolerated before giving up (a blip must not lose a good job). */
const POLL_MAX_TRANSIENT_ERRORS = 5;

export interface SimilarityUploadJob {
  job_id: string;
  track_uuid?: string;
  track_id?: number | null;
  state: "queued" | "running" | "done" | "failed";
  result?: unknown;
  error?: string;
  reason?: string;
}

/**
 * Submit an upload for background similarity processing. Returns `{ job_id }` immediately.
 *
 * All the gates that must answer immediately — entitlement, per-IP burst brake, monthly upload
 * allowance, antivirus, audio validity — still run inside this request, so a denial arrives here
 * and not via the job.
 */
export const submitSimilarityUpload = async (
  file: File,
  TOPSK = 20,
  progressCallback?: (progress: number) => void,
  options?: RequestOptions,
) => {
  const validation = validateAudioFile(file);
  if (!validation.valid) {
    return { success: false as const, error: validation.error };
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    // Pre-emptively refresh the token so it cannot expire mid-transfer on a large file.
    try {
      const { getMyProfile } = await import("./auth");
      await getMyProfile();
    } catch (e) {
      console.warn("Pre-upload token check failed:", e);
    }

    const data = await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.SIMILARITY_UPLOAD_ASYNC, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { top_sk: TOPSK },
        onUploadProgress: (evt) => {
          if (evt.total && progressCallback) {
            progressCallback((evt.loaded / evt.total) * 100);
          }
        },
        // Only the transfer happens inside this request now, but a slow mobile uplink on a 100MB
        // file is still legitimately long, so the generous ceiling stays.
        timeout: 900_000,
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data;
    return {
      success: false as const,
      error: data.error || "Failed to start the upload.",
      details: (data as { details?: unknown }).details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Read one submitted upload job. `state` is `queued` | `running` | `done` | `failed`. */
export const getSimilarityUploadJob = async (jobId: string) =>
  axiosWrapper<{ success: boolean; data: SimilarityUploadJob }>(
    authClient.get(`${API_CONFIG.ENDPOINTS.SIMILARITY_UPLOAD_JOB}${jobId}/status`),
  );

/**
 * Get track similarity based on an uploaded audio file.
 *
 * Submits the upload and polls until the playlist is ready, then returns the same
 * `{ success, data }` envelope the blocking endpoint returned — callers are unchanged.
 *
 * @param file Audio file
 * @param TOPSK Number of similar tracks to return (default 20)
 * @param progressCallback Optional callback for upload progress (0-100). Reports the FILE
 *   TRANSFER only; it reaches 100 while the server is still working, which is what the
 *   processing UI already expects (it starts its step cycle at 100).
 * @param options Optional request options including idempotency key
 */
export const getSimilarTracks = async (
  file: File,
  TOPSK = 20,
  progressCallback?: (progress: number) => void,
  options?: RequestOptions,
) => {
  const submitted = await submitSimilarityUpload(file, TOPSK, progressCallback, options);
  if (!submitted || submitted.success !== true) return submitted;

  const jobId = (submitted as { data?: { job_id?: string } }).data?.job_id;
  if (!jobId) {
    return { success: false as const, error: "Upload was accepted but returned no job id." };
  }

  const startedAt = Date.now();
  let transientErrors = 0;

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const elapsed = Date.now() - startedAt;
    await new Promise((r) =>
      setTimeout(r, elapsed > POLL_BACKOFF_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS),
    );

    try {
      const res = await getSimilarityUploadJob(jobId);
      transientErrors = 0;
      const job = res?.data;

      if (job?.state === "done") {
        // Unwrap to the shape the blocking endpoint used to return in `data`.
        return { success: true as const, data: job.result };
      }
      if (job?.state === "failed") {
        return {
          success: false as const,
          error: job.error || "Failed to get similar tracks.",
          reason: job.reason ?? null,
        };
      }
      // queued | running → keep waiting.
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      // 404 = the job expired or never existed; 403 = not ours. Neither improves by retrying.
      if (status === 404 || status === 403) {
        return handleApiError(error as Error);
      }
      transientErrors += 1;
      if (transientErrors >= POLL_MAX_TRANSIENT_ERRORS) {
        return handleApiError(error as Error);
      }
      console.warn("Similarity upload poll error (will retry)", error);
    }
  }

  // The work is very likely still running server-side; we simply stopped waiting for it.
  return {
    success: false as const,
    error: "This is taking longer than expected. Your track may still be processing — check your library in a few minutes.",
    reason: "timeout" as const,
  };
};

/**
 * The original blocking upload — one request, one response, no polling.
 *
 * Kept so reverting is a one-line change at the call site if the poll-based path ever needs to be
 * switched off in a hurry. Not used by the app: it is the path that produces 524s on large
 * concurrent uploads.
 */
export const getSimilarTracksBlocking = async (
  file: File,
  TOPSK = 20,
  progressCallback?: (progress: number) => void,
  options?: RequestOptions,
) => {
  try {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { getMyProfile } = await import("./auth");
      await getMyProfile();
    } catch (e) {
      console.warn("Pre-upload token check failed:", e);
    }

    const params = { top_sk: TOPSK };

    const data = await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.SIMILARITY, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params,
        onUploadProgress: (evt) => {
          if (evt.total && progressCallback) {
            const percent = (evt.loaded / evt.total) * 100;
            progressCallback(percent);
          }
        },
        timeout: 900_000, // 15 minutes, matches legacy
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to get similar tracks.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get track similarity for a selected track ID
 * @param trackId The track ID to find similar tracks for
 * @param TOPSK Number of similar tracks to return (default 20)
 * @param options Optional request options including idempotency key
 */
export const getSimilarityForSelectedTrack = async (
  trackId: string,
  TOPSK = 20,
  options?: RequestOptions,
) => {
  try {
    const payload = {
      track_id: trackId,
      top_sk: TOPSK,
    };

    // Use authClient instead of axiosInstance to include credentials and Authorization header
    const data = await axiosWrapper<ApiResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.SELECTION_SIMILARITY, payload, {
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to get similar tracks.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Polls the /segment-status/ endpoint until segmentation is complete or timeout.
 * Returns true when segmentation_completed === true, false on timeout or fatal error.
 */
export const getSegmentStatus = async (playlistUuid: string) => {
  try {
    const data = await axiosWrapper<{ success: boolean; segmentation_completed: boolean }>(
      authClient.get(`${API_CONFIG.ENDPOINTS.SEGMENT_STATUS}${playlistUuid}`),
    );
    return data;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const waitForSegmentation = async (
  playlistUuid: string,
  timeoutMs = 300_000, // 5 minutes
  pollIntervalMs = 4_000,
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await getSegmentStatus(playlistUuid);

      if (res.success && (res as any).segmentation_completed) {
        return true; // ✅ ready
      }
      // Not ready → sleep and retry
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    } catch (err: any) {
      // 404 means playlist vanished – abort early
      if (err?.response?.status === 404) {
        console.error("Playlist not found");
        return false;
      }
      // Log and retry on transient errors
      console.warn("Segment status polling error", err);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  return false;
};
