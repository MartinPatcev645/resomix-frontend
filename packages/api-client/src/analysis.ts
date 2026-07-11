/**
 * Analysis-as-an-artifact client (Phase D)
 * ========================================
 *
 * Return-visit access to a previously generated analysis, routed through Alwyzon (never a direct
 * browser→analysis-service call in prod). See `docs/UPLOADS_AND_SEARCH_LIMITS_PLAN.md` §4.
 *
 *   - `getAnalysisSummary(uuid)` → the single-value summary row (owner-or-public).
 *   - `mintAnalysisToken(uuid)`  → a short-lived, IP-locked retrieval token + `retrieval_path`.
 *
 * The caller composes the full cached-JSON fetch itself:
 *   `${analysisMediaBase}${retrieval_path}?token=${token}` → the Hetzner served cache
 * (the webapp owns the media base URL, so this package stays env-agnostic).
 *
 * Uses `authClient` so a logged-in user's JWT rides along (the server gates owner-or-public).
 */

import authClient from "./authClient";
import { axiosWrapper, handleApiError } from "./utils";
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

/** Retrieval token for the full cached JSON on the Hetzner served cache. */
export interface AnalysisRetrievalToken {
  token: string;
  expires_in: number;
  analysis_uuid: string;
  scope: "analysis";
  /** Compose `${analysisMediaBase}${retrieval_path}?token=${token}` to fetch the full JSON. */
  retrieval_path: string;
}

export interface AnalysisTokenEnvelope {
  success: boolean;
  data: AnalysisRetrievalToken;
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

/** Mint a short-lived retrieval token for the full cached JSON (owner-or-public). */
export const mintAnalysisToken = async (analysisUuid: string) => {
  try {
    return await axiosWrapper<AnalysisTokenEnvelope>(
      authClient.post(`${analysisPath(analysisUuid)}/token`),
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
