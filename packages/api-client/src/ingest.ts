import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import type { ApiResponse } from "./types/api";

/**
 * Trigger Monthly Track Ingestion
 */
export const ingestMonthlyTrack = async () => {
  try {
    return await axiosWrapper<ApiResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.INGEST_MONTHLY_TRACK)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Trigger Monthly Embedding Update
 */
export const ingestMonthlyEmbeddings = async () => {
  try {
    return await axiosWrapper<ApiResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.INGEST_MONTHLY_EMBEDDINGS)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Trigger Open Tracks Ingestion
 */
export const ingestOpenTrack = async () => {
  try {
    return await axiosWrapper<ApiResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.INGEST_OPEN_TRACK)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Trigger Open Tracks Embedding Update
 */
export const ingestOpenEmbeddings = async () => {
  try {
    return await axiosWrapper<ApiResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.INGEST_OPEN_EMBEDDINGS)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
