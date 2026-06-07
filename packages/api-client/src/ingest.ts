import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import type { ApiResponse } from "./types/api";

/**
 * @deprecated Use `triggerIngestion` from `./admin/ingestion` instead.
 * These legacy routes (`/api/v1/ingest/*`) are frozen and will be removed.
 * Prefer `POST /api/v1/admin/ingestion/trigger` for new integrations.
 */

/**
 * @deprecated Trigger Monthly Track Ingestion via legacy endpoint.
 * Use `triggerIngestion({ partner_id, env })` from `./admin/ingestion` instead.
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
 * @deprecated Trigger Monthly Embedding Update via legacy endpoint.
 * Use `triggerEmbeddingsJob` from `./admin/processing` instead.
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
 * @deprecated Trigger Open Tracks Ingestion via legacy endpoint.
 * Use `triggerIngestion({ partner_id, env })` from `./admin/ingestion` instead.
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
 * @deprecated Trigger Open Tracks Embedding Update via legacy endpoint.
 * Use `triggerEmbeddingsJob` from `./admin/processing` instead.
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
