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

/**
 * Get current partner information (API Key Required)
 */
export const getPartnerMe = async () => {
  try {
    return await axiosWrapper<any>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.PARTNER_ME)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Get a single partner's details by ID (Admin)
 */
export const getPartnerDetail = async (partnerId: number): Promise<{ success: boolean; data?: Partner; error?: string }> => {
  try {
    return await axiosWrapper(
      axiosInstance.get(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_DETAIL}${partnerId}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

// ─── SFTP Provisioning Types ───────────────────────────────

export interface SftpProvisionRequest {
  partner_id: number;
  username: string;
  password: string;
  use_public_key?: boolean;
  public_key?: string | null;
}

export interface SftpProvisionResponse {
  success: boolean;
  message?: string;
  data?: {
    host: string;
    port: number;
    username: string;
  };
  error?: string;
}

export interface SftpStatusResponse {
  success: boolean;
  data?: {
    provisioned: boolean;
    host: string | null;
    port: number | null;
    username: string | null;
    last_provisioned_at: string | null;
  };
  error?: string;
}

// ─── SFTP API Calls ────────────────────────────────────────

/**
 * Provision SFTP access for a partner (Admin)
 */
export const provisionSftpPartner = async (payload: SftpProvisionRequest): Promise<SftpProvisionResponse> => {
  try {
    return await axiosWrapper(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_SFTP_PROVISION, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Get SFTP provisioning status for a partner (Admin)
 */
export const getSftpStatus = async (partnerId: number): Promise<SftpStatusResponse> => {
  try {
    return await axiosWrapper(
      axiosInstance.get(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_DETAIL}${partnerId}/sftp`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Retry SFTP provisioning for a partner (Admin)
 */
export const retrySftpProvisioning = async (partnerId: number): Promise<SftpProvisionResponse> => {
  try {
    return await axiosWrapper(
      axiosInstance.post(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_DETAIL}${partnerId}/sftp/retry`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
