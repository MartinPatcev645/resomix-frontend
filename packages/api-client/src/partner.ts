import authClient from "./authClient";
import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";

// ─── Types ─────────────────────────────────────────────────

export interface PlaybackTokenResponse {
  success: boolean;
  data?: {
    token: string;
    expires_in: number;
    partner_id: number;
    scope: string;
  };
  error?: string;
}

export interface DeletionLogEntry {
  track_id: number;
  uuid: string;
  title: string;
  deleted_at: string;
}

export interface DeletionLogResponse {
  success: boolean;
  data?: {
    entries: DeletionLogEntry[];
    /** ECDSA signature over the entries payload */
    signature: string;
  };
  error?: string;
}

export interface DeletionLogParams {
  /** YYYY-MM-DD */
  from_date?: string;
  /** YYYY-MM-DD */
  to_date?: string;
}

// ─── API Calls ─────────────────────────────────────────────

/**
 * Exchange the partner API key for a short-lived HS256 "valet" JWT.
 * Attach this token to Hetzner media-serving requests for partner-scoped asset access.
 */
export const mintPlaybackToken =
  async (): Promise<PlaybackTokenResponse> => {
    try {
      return await axiosWrapper(
        authClient.post(API_CONFIG.ENDPOINTS.PARTNER_PLAYBACK_TOKEN),
      );
    } catch (error: any) {
      return handleApiError(error) as any;
    }
  };

/**
 * Fetch the ECDSA-signed track deletion audit log for the authenticated partner.
 * Use for compliance / reconciliation purposes.
 */
export const getPartnerDeletionLog = async (
  params: DeletionLogParams = {},
): Promise<DeletionLogResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.PARTNER_DELETION_LOG, { params }),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
