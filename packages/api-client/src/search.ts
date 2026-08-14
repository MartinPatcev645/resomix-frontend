import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import type { ApiResponse } from "./types/api";
import authClient from "./authClient";


/**
 * Rows `/search` returns when the request carries no bearer token.
 *
 * Mirrors the backend's `SEARCH_RESULTS_DEFAULT`. Used only to decide whether sending a token is
 * worth anything — it is never displayed, so a drift between the two costs an unnecessary
 * authenticated request at worst, never a wrong result count.
 */
export const SEARCH_DEFAULT_RESULTS = 30;

/**
 * Search the catalogue.
 *
 * **Anonymous by default, deliberately.** This runs on every debounced keystroke, and the backend
 * does zero work to resolve a caller who sends no token — no decode, no user read, no plan
 * lookup. Guests and free users therefore search exactly as fast as they did before the cap
 * existed.
 *
 * `authenticated: true` opts into the slower path, and the caller should set it only when the
 * plan actually earns more rows (see `useWorkspaceSearch`). Sending a token when it changes
 * nothing just buys a round trip.
 */
export const searchTracks = async (
  query: string,
  mode: 'auto' | 'artist' | 'title' = 'auto',
  opts: { authenticated?: boolean } = {},
) => {
  try {
    const client = opts.authenticated ? authClient : axiosInstance;
    const data = await axiosWrapper<ApiResponse>(
      client.get(API_CONFIG.ENDPOINTS.SEARCH, { params: { query, mode: mode.toLowerCase() } }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to search tracks.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
