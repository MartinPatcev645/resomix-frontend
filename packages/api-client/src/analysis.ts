/**
 * Analysis-as-an-artifact client (Phase D)
 * ========================================
 *
 * Return-visit access to a previously generated analysis, routed through Alwyzon (never a direct
 * browser→analysis-service call in prod). See `docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md` §4.
 *
 *   - `getAnalysisSummary(uuid)` → the single-value summary row (owner-or-public).
 *   - `getAnalysisResult(id)`    → the full or partial result, as Alwyzon serves it.
 *
 * The result always comes through Alwyzon, which removes internal fields on the way out. The old
 * token fetch straight from the analysis service's cache is retired on the server (410).
 *
 * Uses `authClient` so a logged-in user's JWT rides along (the server gates owner-or-public).
 */

import authClient from "./authClient";
import { axiosWrapper, handleApiError, validateAudioFile } from "./utils";
import { API_CONFIG } from "./config";

/** Single-value analysis summary (mirror of the backend `to_dict`). */
export interface AnalysisSummary {
  analysis_uuid: string;
  track_id: number;
  is_public: boolean;
  bpm: number | null;
  key: string | null;
  scale: string | null;
  camelot: string | null;
  loudness_lufs: number | null;
  top_genre: string | null;
  top_style: string | null;
  top_mood: string | null;
  top_instrument: string | null;
  danceability: number | null;
  valence: number | null;
  arousal: number | null;
  voice_score: number | null;
  voice_instrumental: string | null;
  duration_ms: number | null;
  sample_rate_hz: number | null;
  bit_rate: number | null;
  channels: number | null;
  codec: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AnalysisSummaryEnvelope {
  success: boolean;
  data: AnalysisSummary;
}

const analysisPath = (analysisUuid: string): string =>
  `${API_CONFIG.ENDPOINTS.ANALYSIS}/${encodeURIComponent(analysisUuid)}`;

/** Fetch the single-value summary for a previously generated analysis (owner-or-public). */
export const getAnalysisSummary = async (analysisUuid: string) => {
  try {
    return await axiosWrapper<AnalysisSummaryEnvelope>(
      authClient.get(analysisPath(analysisUuid)),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// ---------------------------------------------------------------------------- //
// Fresh upload → analyze (routed through Alwyzon; login-only, counts vs uploads_per_month)
// ---------------------------------------------------------------------------- //

export interface AnalysisUploadResult {
  analysis_id: string;
  track_uuid: string;
}
export interface AnalysisUploadEnvelope {
  success: boolean;
  data: AnalysisUploadResult;
}

/** Live job status document proxied from the analysis service. */
export interface AnalysisJobStatus {
  state?: "queued" | "running" | "succeeded" | "failed";
  part1_ready?: boolean;
  progress?: { percent?: number; stage?: string };
  error?: string;
  result_available?: boolean;
}
export interface AnalysisStatusEnvelope {
  success: boolean;
  data: AnalysisJobStatus;
}

/** The canonical result (partial or full) proxied from the analysis service. */
export interface AnalysisResultEnvelope {
  success: boolean;
  data: Record<string, unknown>;
}

/**
 * Upload a track for analysis through Alwyzon (the single upload front-door). Login-only; counts
 * against `uploads_per_month`. Returns `{ analysis_id, track_uuid }`; poll `getAnalysisStatus` /
 * `getAnalysisResult` for progressive delivery. A denied upload surfaces `reason`
 * (`login_required` / `upgrade_required`) for the gate CTA.
 */
export const uploadForAnalysis = async (
  file: File,
  progressCallback?: (progress: number) => void,
) => {
  const validation = validateAudioFile(file);
  if (!validation.valid) {
    return { success: false as const, error: validation.error };
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    // Pre-emptively refresh the token before the (potentially large) upload.
    try {
      const { getMyProfile } = await import("./auth");
      await getMyProfile();
    } catch (e) {
      console.warn("Pre-upload token check failed:", e);
    }

    const data = await axiosWrapper<AnalysisUploadEnvelope>(
      authClient.post(`${API_CONFIG.ENDPOINTS.ANALYSIS}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total && progressCallback) {
            progressCallback((evt.loaded / evt.total) * 100);
          }
        },
        timeout: 900_000,
      }),
    );
    if (data.success === true) return data;
    return {
      success: false as const,
      error: (data as { error?: string }).error || "Upload failed.",
      reason: (data as { reason?: string }).reason,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Poll the analysis job status (owner-or-public via Alwyzon). */
export const getAnalysisStatus = async (analysisId: string) => {
  try {
    return await axiosWrapper<AnalysisStatusEnvelope>(
      authClient.get(`${analysisPath(analysisId)}/status`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Fetch the partial/full canonical result (owner-or-public via Alwyzon). */
export const getAnalysisResult = async (analysisId: string) => {
  try {
    return await axiosWrapper<AnalysisResultEnvelope>(
      authClient.get(`${analysisPath(analysisId)}/result`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
