import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { API_CONFIG } from "./config";
import { getDeviceHash, initDeviceHash } from "./deviceId";
import { emitQuotaDenied } from "./quotaEvents";
import type { ApiResponse } from "./types/api";


// Create a shared Axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 300_000, // 5 minutes
  withCredentials: true, // Include cookies with all requests
});

// Request interceptor. The retired static api_key is no longer sent: guests are anonymous
// (→ System Partner 1) and logged-in users are identified by their JWT (attached by authClient).
// This base instance only attaches the guest device signal and any idempotency key.
axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const isAdminRoute = config.url?.includes('admin') || config.url?.includes('/admin/');

  // Guest device signal for server-side visitor_id derivation (never sent on admin/B2B routes).
  if (!isAdminRoute) {
    // AWAIT the hash, never just peek at it. `getDeviceHash()` is synchronous and returns null
    // until the fingerprint has been computed, so the FIRST requests of a session — including the
    // `/entitlements/me` fetch that fires at bootstrap — would go out without the header. The
    // server then derives a *different*, degraded visitor id for those, which splits one guest's
    // usage across two identities: they get extra free searches, and the usage chip reads a
    // different counter than enforcement wrote to.
    //
    // Cached after the first call (memory + localStorage), so this costs nothing thereafter.
    const deviceHash = getDeviceHash() ?? (await initDeviceHash());
    if (deviceHash) {
      config.headers['X-Device-Hash'] = deviceHash;
    }
  }

  // Support for Idempotency-Key
  const customConfig = config as any;
  if (customConfig.idempotencyKey) {
    config.headers['Idempotency-Key'] = customConfig.idempotencyKey;
  }

  return config;
});

// Interceptor to log correlation ID for debugging
axiosInstance.interceptors.response.use((response) => {
  const correlationId = response.headers['x-correlation-id'];
  if (correlationId) {
    // console.log(`[API] Correlation-ID: ${correlationId} for ${response.config.url}`);
  }
  return response;
}, (error) => {
  if (error.response?.headers['x-correlation-id']) {
    console.error(`[API Error] Correlation-ID: ${error.response.headers['x-correlation-id']} for ${error.config?.url}`);
  }
  return Promise.reject(error);
});

// Generic Axios wrapper to unwrap `data` property
export const axiosWrapper = async <T>(apiCall: Promise<AxiosResponse<T>>): Promise<T> =>
  apiCall.then((res) => res.data);

// Error handling utility for standardized server responses (mirrors legacy behaviour)
export const handleApiError = (error: AxiosError | Error): {
  success: false;
  error: string;
  details?: unknown;
  status?: number;
  /** Soft-gate reason from the entitlement layer: "login_required" | "upgrade_required". */
  reason?: string | null;
  /**
   * Machine-readable denial code from the pricing gate — "quota_exceeded" | "library_full" |
   * "export_limit_reached" | "plan_required" | "login_required".
   *
   * Distinct from `error`, which is the sentence we show the user. Switch modals on this, never on
   * the prose: the prose is written for humans and is expected to change.
   */
  code?: string | null;
  /** Denial detail on a 402: { metric, used, limit, resets_at, upgrade }. */
  quota?: { metric?: string; used?: number; limit?: number; resets_at?: string; upgrade?: string } | null;
} => {
  console.error("API Error:", error);

  // Axios error
  if ((error as AxiosError).isAxiosError && (error as AxiosError).response) {
    const { status, data } = (error as AxiosError).response!;

    // Attempt to respect standardized error format
    if (data && typeof data === "object" && (data as ApiResponse).success === false) {
      const apiError = data as any;
      let errorMessage = apiError.error || "An error occurred.";
      
      // Try to extract detailed validation errors (for Pydantic exceptions wrapped by standard-response format)
      if (apiError.data?.details && Array.isArray(apiError.data.details) && apiError.data.details.length > 0) {
        const first = apiError.data.details[0];
        if (first?.field && first?.message) {
          errorMessage = `${first.field}: ${first.message}`;
        } else if (first?.message) {
          errorMessage = first.message;
        }
      } else if (Array.isArray(apiError.details) && apiError.details.length > 0) {
        const first = apiError.details[0] as { message?: string };
        if (first?.message) errorMessage = first.message;
      }

      // A 402 is the one error the whole app reacts to identically: refresh the usage chip and
      // open the upgrade modal. Emitted once here so no call site has to know that.
      // Fire-and-forget; never awaited (see quotaEvents).
      if (status === 402) {
        emitQuotaDenied({
          code: apiError.code ?? null,
          error: errorMessage,
          reason: apiError.reason ?? null,
          quota: apiError.data?.metric ? apiError.data : null,
        });
      }

      return {
        success: false,
        error: errorMessage,
        details: apiError.data?.details || apiError.details || null,
        status,
        reason: apiError.reason ?? null,
        code: apiError.code ?? null,
        // Only a quota denial carries this shape; `metric` is what distinguishes it from any other
        // endpoint that happens to return a `data` block alongside an error.
        quota: status === 402 && apiError.data?.metric ? apiError.data : null,
      };
    }

    switch (status) {
      case 401:
        return { success: false, error: "Authentication error. Please check your API key.", status };
      case 413:
        return { success: false, error: "File too large.", status };
      case 415:
        return { success: false, error: "Unsupported file type.", status };
      case 422:
        return { success: false, error: "Invalid data provided.", status };
      case 429:
        return { success: false, error: "Too many requests. Please try again later.", status };
      case 500:
        return { success: false, error: "Server error. Please try again later.", status };
      default:
        return { success: false, error: "An error occurred. Please try again.", status };
    }
  }

  // Fallback for generic Error / network issues
  return {
    success: false,
    error: (error as Error).message || "Network error. Please check your connection.",
  };
};

// Helper to construct full URL including path (for cases where we need absolute link).
// No api_key is appended — public media/streaming URLs are reached anonymously (→ Partner 1).
export const getUrl = (endpoint: string, queryParams: Record<string, unknown> = {}): string => {
  const base = API_CONFIG.BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const url = new URL(`${base}${endpoint}`);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.append(k, String(v));
    }
  });
  return url.toString();
};

// File validation helper
export const validateAudioFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > API_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${API_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    };
  }
  if (!API_CONFIG.ALLOWED_AUDIO_TYPES.includes(file.type)) {
    return { valid: false, error: "Invalid file type. Please upload an audio file." };
  }
  return { valid: true };
};

/**
 * Generate a UUID v4 for use as an idempotency key.
 * Uses crypto.randomUUID() where available, otherwise falls back to a manual generator.
 */
export const generateIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default axiosInstance; 