import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { ApiResponse } from "../types/api";


// ─── Types ─────────────────────────────────────────────────

export interface FeedbackItem {
  id: number;
  user_id: string | null;
  category: string | null;
  message: string | null;
  satisfaction: number | null;
  recommendation: number | null;
  status: 'open' | 'resolved';
  submitted_at: string; // ISO datetime string
}

export interface FeedbackListParams {
  page?: number;
  page_size?: number;
  search?: string;
  search_column?: 'user_id' | 'category' | 'message' | 'status';
  status?: 'open' | 'resolved' | 'all';
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'id' | 'submitted_at' | 'satisfaction' | 'recommendation';
  sort_order?: 'asc' | 'desc';
}

export interface FeedbackListResponse {
  success: boolean;
  data: FeedbackItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface FeedbackDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface FeedbackBatchDeleteResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
  error?: string;
}

export interface FeedbackUpdateData {
  status?: 'open' | 'resolved';
  category?: string;
}

export interface FeedbackUpdateResponse {
  success: boolean;
  data?: FeedbackItem;
  message?: string;
  error?: string;
}

// ─── API Functions ─────────────────────────────────────────

/**
 * Get paginated list of feedback with filtering and search
 */
export const getFeedbackList = async (params: FeedbackListParams = {}) => {
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

    const data = await axiosWrapper<FeedbackListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_LIST, { params: queryParams })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch feedback list.",
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
 * Delete a single feedback entry by ID
 */
export const deleteFeedback = async (feedbackId: number) => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      data?: { message: string };
      error?: string;
    }>(
      axiosInstance.delete(`${API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_DELETE}${feedbackId}`)
    );

    if (data.success) {
      return {
        success: true,
        message: data.data?.message || "Feedback deleted successfully"
      };
    }
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to delete feedback.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Delete multiple feedback entries in a batch
 */
export const batchDeleteFeedback = async (feedbackIds: number[]) => {
  try {
    const data = await axiosWrapper<FeedbackBatchDeleteResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_BATCH_DELETE, {
        ids: feedbackIds,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      deleted_count: 0,
      error: (data as ApiResponse).error || "Failed to delete feedback entries.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      deleted_count: 0,
    };
  }
};

/**
 * Update a feedback entry (e.g., change status)
 */
export const updateFeedback = async (feedbackId: number, updateData: FeedbackUpdateData) => {
  try {
    const data = await axiosWrapper<FeedbackUpdateResponse>(
      axiosInstance.patch(`${API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_UPDATE}${feedbackId}`, updateData)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to update feedback.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get a single feedback entry by ID
 */
export const getFeedbackById = async (feedbackId: number) => {
  try {
    const data = await axiosWrapper<{ success: boolean; data: FeedbackItem }>(
      axiosInstance.get(`${API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_DETAIL}${feedbackId}`)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch feedback details.",
      data: null,
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      data: null,
    };
  }
};

export interface FeedbackExportResponse {
  success: boolean;
  download_url: string;
  filename: string;
  expires_at: string;
  error?: string;
}

/**
 * Export feedback data (returns download URL to CSV file)
 */
export const exportFeedback = async (
  format: 'csv',
  params: FeedbackListParams = {}
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

    const data = await axiosWrapper<FeedbackExportResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_EXPORT, requestBody)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to export feedback.",
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

/**
 * Mark feedback status as open or resolved (Admin)
 */
export const markFeedbackStatus = async (feedbackId: number, status: 'open' | 'resolved') => {
  try {
    const data = await axiosWrapper<FeedbackUpdateResponse>(
      axiosInstance.patch(`${API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_MARK_STATUS}${feedbackId}/status`, {
        status,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to update feedback status.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Get feedback statistics/summary (Admin)
 */
export const getFeedbackStats = async () => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      stats: {
        total: number;
        open: number;
        resolved: number;
        avg_satisfaction: number;
        avg_recommendation: number;
        by_category: Record<string, number>;
      };
    }>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_FEEDBACK_STATS)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch feedback statistics.",
      stats: null,
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      stats: null,
    };
  }
};
