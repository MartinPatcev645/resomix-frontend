import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { API_CONFIG } from "./config";
import type { ApiResponse } from "./types/api";


// Create a shared Axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 300_000, // 5 minutes
  withCredentials: true, // Include cookies with all requests
});

// Interceptor to append `api_key` as query parameter for every request
axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.params) {
    config.params = {};
  }
  // Preserve existing api_key if provided explicitly
  if (!config.params.api_key) {
    (config.params as Record<string, unknown>).api_key = API_CONFIG.API_KEY;
  }
  
  // Also include in headers for better security and backend compatibility
  config.headers['X-API-KEY'] = API_CONFIG.API_KEY;
  
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
} => {
  console.error("API Error:", error);

  // Axios error
  if ((error as AxiosError).isAxiosError && (error as AxiosError).response) {
    const { status, data } = (error as AxiosError).response!;

    // Attempt to respect standardized error format
    if (data && typeof data === "object" && (data as ApiResponse).success === false) {
      const apiError = data as { error?: string; details?: unknown[] };
      let errorMessage = apiError.error || "An error occurred.";
      if (Array.isArray(apiError.details) && apiError.details.length > 0) {
        const first = apiError.details[0] as { message?: string };
        if (first?.message) errorMessage = first.message;
      }
      return {
        success: false,
        error: errorMessage,
        details: (data as ApiResponse).details ?? null,
        status,
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

// Helper to construct full URL including path (for cases where we need absolute link)
export const getUrl = (endpoint: string, queryParams: Record<string, unknown> = {}): string => {
  const base = API_CONFIG.BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const url = new URL(`${base}${endpoint}`);
  url.searchParams.append("api_key", API_CONFIG.API_KEY);
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