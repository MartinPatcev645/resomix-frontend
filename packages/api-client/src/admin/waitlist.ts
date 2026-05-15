import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { ApiResponse } from "../types/api";


// ─── Types ─────────────────────────────────────────────────

export interface WaitlistItem {
  id: number;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface WaitlistListParams {
  page?: number;
  page_size?: number;
  search?: string;
  search_column?: 'email' | 'id';
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'id' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface WaitlistListResponse {
  success: boolean;
  data: WaitlistItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface WaitlistDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface WaitlistBatchDeleteResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
  error?: string;
}

export interface WaitlistUpdateResponse {
  success: boolean;
  data?: WaitlistItem;
  message?: string;
  error?: string;
}

export interface WaitlistExportResponse {
  success: boolean;
  download_url: string;
  filename: string;
  expires_at: string;
  error?: string;
}

// ─── API Functions ─────────────────────────────────────────

/**
 * Get paginated list of waitlist entries with filtering and search
 */
export const getWaitlistList = async (params: WaitlistListParams = {}) => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 30,
    };

    // Add optional filters
    if (params.search) queryParams.search = params.search;
    if (params.search_column) queryParams.search_column = params.search_column;
    if (params.status && params.status !== 'all') queryParams.status = params.status;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;
    if (params.sort_by) queryParams.sort_by = params.sort_by;
    if (params.sort_order) queryParams.sort_order = params.sort_order;

    const data = await axiosWrapper<WaitlistListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_LIST, { params: queryParams })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch waitlist.",
      data: [],
      pagination: { page: 1, page_size: 30, total: 0, total_pages: 0 },
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      data: [],
      pagination: { page: 1, page_size: 30, total: 0, total_pages: 0 },
    };
  }
};

/**
 * Delete a single waitlist entry by ID
 */
export const deleteWaitlist = async (waitlistId: number) => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      data?: { message: string };
      error?: string;
    }>(
      axiosInstance.delete(`${API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_DELETE}${waitlistId}`)
    );

    if (data.success) {
      return {
        success: true,
        message: data.data?.message || "Waitlist entry deleted successfully"
      };
    }
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to delete waitlist entry.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Delete multiple waitlist entries in a batch
 */
export const batchDeleteWaitlist = async (waitlistIds: number[]) => {
  try {
    const data = await axiosWrapper<WaitlistBatchDeleteResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_BATCH_DELETE, {
        ids: waitlistIds,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      deleted_count: 0,
      error: (data as ApiResponse).error || "Failed to delete waitlist entries.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      deleted_count: 0,
    };
  }
};

/**
 * Update waitlist status
 */
export const updateWaitlistStatus = async (
  waitlistId: number, 
  status: 'pending' | 'approved' | 'rejected'
) => {
  try {
    const data = await axiosWrapper<WaitlistUpdateResponse>(
      axiosInstance.post(`${API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_UPDATE_STATUS}${waitlistId}`, {
        status,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to update waitlist status.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Export waitlist data (returns download URL to CSV file)
 */
export const exportWaitlist = async (
  format: 'csv',
  params: WaitlistListParams = {}
) => {
  try {
    const requestBody: Record<string, any> = {
      format,
    };

    // Add optional filters to the request body
    if (params.page) requestBody.page = params.page;
    if (params.page_size) requestBody.page_size = params.page_size;
    if (params.search) requestBody.search = params.search;
    if (params.search_column) requestBody.search_column = params.search_column;
    if (params.status && params.status !== 'all') requestBody.status = params.status;
    if (params.date_from) requestBody.date_from = params.date_from;
    if (params.date_to) requestBody.date_to = params.date_to;
    if (params.sort_by) requestBody.sort_by = params.sort_by;
    if (params.sort_order) requestBody.sort_order = params.sort_order;

    const data = await axiosWrapper<WaitlistExportResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_WAITLIST_EXPORT, requestBody)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to export waitlist.",
      download_url: "",
      filename: "",
      expires_at: "",
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      download_url: "",
      filename: "",
      expires_at: "",
    };
  }
};
