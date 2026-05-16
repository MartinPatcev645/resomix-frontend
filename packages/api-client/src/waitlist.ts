import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import { RequestOptions } from "./types/api";

interface WaitlistData {
  id: number;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface JoinWaitlistRequest {
  email: string;
}

export const joinWaitlist = async (email: string, options?: RequestOptions) => {
  try {
    const requestData: JoinWaitlistRequest = { email };
    const data = await axiosWrapper<any>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.WAITLIST, requestData, {
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to join waitlist.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

export const checkWaitlistStatus = async (email: string) => {
  try {
    const data = await axiosWrapper<any>(
      axiosInstance.post(`${API_CONFIG.ENDPOINTS.WAITLIST}status`, { 
        email 
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to check waitlist status.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
