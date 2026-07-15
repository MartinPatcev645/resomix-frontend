import axios from "axios";
import { API_CONFIG } from "../config";

/**
 * Server-authoritative session check.
 *
 * Hits the refresh endpoint — which mints a fresh access token from the HttpOnly refresh cookie —
 * with a **raw** axios call, deliberately bypassing `authClient`'s interceptors so this pure check
 * has no logout/refresh side effects of its own. The three outcomes must be handled differently:
 *
 *   - `valid`   → a live session (returns the fresh access token).
 *   - `invalid` → the server said no (401/403, or a 200 without a token) → the session is dead.
 *   - `network` → couldn't reach the server → UNKNOWN. Callers MUST NOT log the user out on this;
 *                 a flaky connection is not an expired session.
 *
 * Concurrent callers share a single in-flight request, so this can never fire two overlapping
 * refreshes (important: the backend rotates refresh tokens and treats a reused one as an attack).
 */
export type SessionStatus =
  | { status: "valid"; accessToken: string }
  | { status: "invalid" }
  | { status: "network" };

let inFlight: Promise<SessionStatus> | null = null;

const doVerify = async (): Promise<SessionStatus> => {
  try {
    const response = await axios.post(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REFRESH}`,
      {}, // empty body — the server reads the refresh token from the HttpOnly cookie
      { withCredentials: true, timeout: 15000 }
    );
    const token = response?.data?.data?.access_token;
    if (response?.data?.success && typeof token === "string" && token) {
      return { status: "valid", accessToken: token };
    }
    return { status: "invalid" };
  } catch (error) {
    // No `response` means the request never reached the server (offline, DNS, CORS, timeout) —
    // treat as UNKNOWN, not a dead session. Any actual HTTP error (401/403/…) is a dead session.
    if (axios.isAxiosError(error) && !error.response) {
      return { status: "network" };
    }
    return { status: "invalid" };
  }
};

export const verifySession = async (): Promise<SessionStatus> => {
  if (inFlight) return inFlight;
  inFlight = doVerify().finally(() => {
    inFlight = null;
  });
  return inFlight;
};
