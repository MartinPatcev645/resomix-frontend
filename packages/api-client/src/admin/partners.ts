import { API_CONFIG } from "../config";
import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import type { 
  Partner, 
  PartnerCreateRequest, 
  PartnerApiKey, 
  ApiKeyIssueRequest, 
  ApiKeyIssueResponse,
  ApiKeyRevokeRequest,
  ApiKeyRotateRequest
} from "../types/partner";

export interface PartnerListParams {
  page?: number;
  page_size?: number;
  tier?: string;
  is_active?: boolean;
}

export interface PartnerListResponse {
  success: boolean;
  data: Partner[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    size: number;
  };
}

export const listPartners = async (params: PartnerListParams = {}): Promise<PartnerListResponse> => {
  try {
    return await axiosWrapper(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_LIST, { params })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const createPartner = async (payload: PartnerCreateRequest): Promise<{ success: boolean; data?: Partner; error?: string }> => {
  try {
    return await axiosWrapper(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_CREATE, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const listApiKeys = async (partnerId: number): Promise<{ success: boolean; data: PartnerApiKey[]; error?: string }> => {
  try {
    const url = `${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_LIST}${partnerId}`;
    return await axiosWrapper(axiosInstance.get(url));
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const issueApiKey = async (payload: ApiKeyIssueRequest): Promise<{ success: boolean; data: ApiKeyIssueResponse; error?: string }> => {
  try {
    return await axiosWrapper(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_ISSUE, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const revokeApiKey = async (payload: ApiKeyRevokeRequest): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    return await axiosWrapper(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_REVOKE, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const updatePartner = async (id: number, payload: Partial<PartnerCreateRequest>): Promise<{ success: boolean; data: Partner; error?: string }> => {
  try {
    return await axiosWrapper(
      axiosInstance.patch(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_LIST}${id}`, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const deletePartner = async (id: number): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    return await axiosWrapper(
      axiosInstance.delete(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_LIST}${id}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const rotateApiKey = async (payload: ApiKeyRotateRequest): Promise<{ success: boolean; data: ApiKeyIssueResponse; error?: string }> => {
  try {
    return await axiosWrapper(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_ROTATE, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
