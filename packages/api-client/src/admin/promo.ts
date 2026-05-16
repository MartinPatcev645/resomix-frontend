import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { ApiResponse } from "../types/api";

export interface PromoCreateRequest {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses?: number;
  expires_at?: string; // ISO datetime
}

/**
 * Create a new Promo Code (Admin)
 */
export const createPromoCode = async (data: PromoCreateRequest) => {
  try {
    const response = await axiosWrapper<ApiResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PROMO_CREATE, data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};
