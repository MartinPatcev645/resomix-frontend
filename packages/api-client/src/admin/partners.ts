import { API_CONFIG } from "../config";
import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
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
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_LIST, { params })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const createPartner = async (payload: PartnerCreateRequest): Promise<{ success: boolean; data?: Partner; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_CREATE, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const listApiKeys = async (partnerId: number): Promise<{ success: boolean; data: PartnerApiKey[]; error?: string }> => {
  try {
    const url = `${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_LIST}${partnerId}`;
    return await axiosWrapper(authClient.get(url));
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const issueApiKey = async (payload: ApiKeyIssueRequest): Promise<{ success: boolean; data: ApiKeyIssueResponse; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_ISSUE, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const revokeApiKey = async (payload: ApiKeyRevokeRequest): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_REVOKE, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const updatePartner = async (id: number, payload: Partial<PartnerCreateRequest>): Promise<{ success: boolean; data: Partner; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.patch(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_LIST}${id}`, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const deletePartner = async (id: number): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.delete(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_LIST}${id}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const rotateApiKey = async (payload: ApiKeyRotateRequest): Promise<{ success: boolean; data: ApiKeyIssueResponse; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_API_KEY_ROTATE, payload)
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
      authClient.get(API_CONFIG.ENDPOINTS.PARTNER_ME)
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
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_DETAIL}${partnerId}`)
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
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_SFTP_PROVISION, payload)
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
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_DETAIL}${partnerId}/sftp`)
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
      authClient.post(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_DETAIL}${partnerId}/sftp/retry`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

// ─── B2B Webhook & Stripe Billing Interfaces ───────────────

export interface WebhookConfig {
  id?: number;
  partner_id: number;
  url: string;
  secret_hash?: string;
  signing_secret?: string;
  events: string[];
  is_active: boolean;
  consecutive_failures?: number;
}

export interface WebhookDeliveryLog {
  id: number;
  webhook_id: number;
  event_type: string;
  payload: string;
  request_headers: string;
  response_status: number;
  response_body: string;
  delivered_at: string;
  consecutive_failures: number;
  created_at: string;
}

// ─── B2B Webhook & Stripe Billing API Calls ──────────────────

/**
 * Get webhooks configured for a partner (Admin)
 */
export const getPartnerWebhooks = async (partnerId: number): Promise<{ success: boolean; data: WebhookConfig[]; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_WEBHOOKS}/${partnerId}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Create a new partner webhook configuration (Admin)
 */
export const createPartnerWebhook = async (payload: WebhookConfig): Promise<{ success: boolean; webhook: WebhookConfig; signing_secret: string; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PARTNER_WEBHOOKS, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Update an existing partner webhook configuration (Admin)
 */
export const updatePartnerWebhook = async (webhookId: number, payload: Partial<WebhookConfig>): Promise<{ success: boolean; data: WebhookConfig; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.patch(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_WEBHOOK_DETAIL}/${webhookId}`, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Delete a partner webhook configuration by ID (Admin)
 */
export const deletePartnerWebhook = async (webhookId: number): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.delete(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_WEBHOOK_DETAIL}/${webhookId}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Get all failed B2B webhook delivery logs (Admin)
 */
export const listFailedWebhookLogs = async (): Promise<{ success: boolean; data: WebhookDeliveryLog[]; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_WEBHOOK_LOGS_FAILED)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Manually retry a failed webhook delivery attempt (Admin)
 */
export const retryWebhookDelivery = async (logId: number): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.post(`${API_CONFIG.ENDPOINTS.ADMIN_WEBHOOK_LOGS_RETRY}${logId}/retry`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Create a Stripe checkout session for a B2B partner subscription (Admin)
 */
export const createStripeCheckoutSession = async (
  partnerId: number,
  payload: { tier: string; billing_cycle: string; po_number?: string }
): Promise<{ success: boolean; checkout_url: string; error?: string }> => {
  try {
    return await axiosWrapper(
      authClient.post(`${API_CONFIG.ENDPOINTS.ADMIN_PARTNER_STRIPE_CHECKOUT}${partnerId}/stripe/checkout`, payload)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

