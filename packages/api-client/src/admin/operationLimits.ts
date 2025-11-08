import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export interface AdminOperationType {
  id: number;
  code: string;
  description: string;
}

export interface AdminOperationTypesResponse {
  success: boolean;
  data?: AdminOperationType[];
  total?: number;
  error?: string;
}

export interface AdminUserOperationLimit {
  user_id: number;
  user_uuid: string | null;
  user_email: string | null;
  user_username: string | null;
  operation_id: number;
  operation_code: string;
  operation_description: string;
  limit_value: number;
  window_seconds: number | null;
  playlist_count: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserOperationLimitListParams {
  page?: number;
  page_size?: number;
  search?: string;
  operation_code?: string;
}

export interface AdminUserOperationLimitListResponse {
  success: boolean;
  data?: AdminUserOperationLimit[];
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  error?: string;
}

export interface AdminUserOperationLimitResponse {
  success: boolean;
  data?: AdminUserOperationLimit;
  error?: string;
}

export interface AdminUserOperationLimitUpsertRequest {
  user_identifier: string;
  operation_code: string;
  limit_value: number;
  window_seconds?: number | null;
}

export interface AdminUserOperationLimitUpsertResponse {
  success: boolean;
  data?: AdminUserOperationLimit;
  error?: string;
}

export interface AdminUserOperationLimitDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────

const buildDetailPath = (userIdentifier: string, operationCode: string) =>
  `${API_CONFIG.ENDPOINTS.ADMIN_OPERATION_LIMIT_DETAIL}${encodeURIComponent(
    userIdentifier,
  )}/${encodeURIComponent(operationCode)}`;

const defaultPagination = (page?: number, pageSize?: number) => ({
  page: page || 1,
  page_size: pageSize || 30,
  total: 0,
  total_pages: 0,
});

// ─── API Calls ─────────────────────────────────────────────

export const getOperationTypes = async (): Promise<AdminOperationTypesResponse> => {
  try {
    const response = await axiosWrapper<AdminOperationTypesResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_OPERATION_TYPES),
    );

    if (response.success && response.data) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to fetch operation types.",
      data: [],
      total: 0,
    };
  } catch (error) {
    const apiError = handleApiError(error as any);
    return {
      ...apiError,
      data: [],
      total: 0,
    };
  }
};

export const getUserOperationLimits = async (
  params: AdminUserOperationLimitListParams = {},
): Promise<AdminUserOperationLimitListResponse> => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 30,
    };

    if (params.search) {
      queryParams.search = params.search;
    }

    if (params.operation_code) {
      queryParams.operation_code = params.operation_code;
    }

    const response = await axiosWrapper<AdminUserOperationLimitListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_OPERATION_LIMITS, {
        params: queryParams,
      }),
    );

    if (response.success && response.data && response.pagination) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to fetch user operation limits.",
      data: [],
      pagination: defaultPagination(queryParams.page, queryParams.page_size),
    };
  } catch (error) {
    const apiError = handleApiError(error as any);
    return {
      ...apiError,
      data: [],
      pagination: defaultPagination(params.page, params.page_size),
    };
  }
};

export const getUserOperationLimit = async (
  userIdentifier: string,
  operationCode: string,
): Promise<AdminUserOperationLimitResponse> => {
  try {
    const response = await axiosWrapper<AdminUserOperationLimitResponse>(
      axiosInstance.get(buildDetailPath(userIdentifier, operationCode)),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to fetch user operation limit.",
    };
  } catch (error) {
    const apiError = handleApiError(error as any);
    return {
      ...apiError,
    };
  }
};

export const upsertUserOperationLimit = async (
  payload: AdminUserOperationLimitUpsertRequest,
): Promise<AdminUserOperationLimitUpsertResponse> => {
  try {
    const response = await axiosWrapper<AdminUserOperationLimitUpsertResponse>(
      axiosInstance.put(API_CONFIG.ENDPOINTS.ADMIN_OPERATION_LIMITS, payload),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to save user operation limit.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const deleteUserOperationLimit = async (
  userIdentifier: string,
  operationCode: string,
): Promise<AdminUserOperationLimitDeleteResponse> => {
  try {
    const response = await axiosWrapper<AdminUserOperationLimitDeleteResponse>(
      axiosInstance.delete(buildDetailPath(userIdentifier, operationCode)),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to delete user operation limit.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};


