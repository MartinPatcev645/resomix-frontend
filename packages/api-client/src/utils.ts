import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { API_CONFIG } from "./config";

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
  return config;
});

// Generic Axios wrapper to unwrap `data` property
export const axiosWrapper = async <T>(apiCall: Promise<AxiosResponse<T>>): Promise<T> =>
  apiCall.then((res) => res.data);

// Error handling utility for standardized server responses (mirrors legacy behaviour)
export const handleApiError = (error: AxiosError | Error): {
  success: false;
  error: string;
  details?: unknown;
} => {
  console.error("API Error:", error);

  // Axios error
  if ((error as AxiosError).isAxiosError && (error as AxiosError).response) {
    const { status, data } = (error as AxiosError).response!;

    // Attempt to respect standardized error format
    if (data && typeof data === "object" && (data as any).success === false) {
      const apiError = data as { error?: string; details?: unknown[] };
      let errorMessage = apiError.error || "An error occurred.";
      if (Array.isArray(apiError.details) && apiError.details.length > 0) {
        const first = apiError.details[0] as { message?: string };
        if (first?.message) errorMessage = first.message;
      }
      return {
        success: false,
        error: errorMessage,
        details: (data as any).details ?? null,
      };
    }

    switch (status) {
      case 401:
        return { success: false, error: "Authentication error. Please check your API key." };
      case 413:
        return { success: false, error: "File too large." };
      case 415:
        return { success: false, error: "Unsupported file type." };
      case 422:
        return { success: false, error: "Invalid data provided." };
      case 429:
        return { success: false, error: "Too many requests. Please try again later." };
      case 500:
        return { success: false, error: "Server error. Please try again later." };
      default:
        return { success: false, error: "An error occurred. Please try again." };
    }
  }

  // Fallback for generic Error / network issues
  return {
    success: false,
    error: (error as any).message || "Network error. Please check your connection.",
  };
};

// Helper to construct full URL including path (for cases where we need absolute link)
export const getUrl = (endpoint: string, queryParams: Record<string, unknown> = {}): string => {
  const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);
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

export default axiosInstance; 