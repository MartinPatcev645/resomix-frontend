import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";

/**
 * Get API Health Status.
 */
export const getApiHealth = async () => {
  try {
    return await axiosWrapper<{ status: string; service: string }>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.HEALTH)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get API Root Info.
 */
export const getApiRootInfo = async () => {
  try {
    return await axiosWrapper<any>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ROOT)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
