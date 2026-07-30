import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";
import type { ApiResponse } from "../types/api";


// ─── Types ─────────────────────────────────────────────────

export interface ContactItem {
  id: number;
  user_id: string | null;
  name: string | null;
  email: string | null;
  subject: string | null;
  phone: string | null;
  message: string | null;
  contact_type?: 'consumer' | 'partner';
  // B2B qualification fields. NULL on consumer contacts, and on whichever questions the
  // submitting partner form does not ask.
  company_name?: string | null;
  role?: string | null;
  partner_type?: string | null;
  preferred_path?: string | null;
  catalog_context?: string | null;
  catalog_size?: string | null;
  estimated_calls?: string | null;
  status: 'open' | 'resolved';
  submitted_at: string; // ISO datetime string
}

export interface ContactListParams {
  page?: number;
  page_size?: number;
  search?: string;
  search_column?: 'user_id' | 'name' | 'email' | 'message' | 'id';
  status?: 'open' | 'resolved' | 'all';
  contact_type?: 'consumer' | 'partner' | 'all';
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'id' | 'submitted_at';
  sort_order?: 'asc' | 'desc';
}

export interface ContactListResponse {
  success: boolean;
  data: ContactItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface ContactDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ContactBatchDeleteResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
  error?: string;
}

export interface ContactUpdateResponse {
  success: boolean;
  data?: ContactItem;
  message?: string;
  error?: string;
}

export interface ContactExportResponse {
  success: boolean;
  download_url: string;
  filename: string;
  expires_at: string;
  error?: string;
}

// ─── API Functions ─────────────────────────────────────────

/**
 * Get paginated list of contact submissions with filtering and search
 */
export const getContactList = async (params: ContactListParams = {}) => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 30,
    };

    // Add optional filters
    if (params.search) queryParams.search = params.search;
    if (params.search_column) queryParams.search_column = params.search_column;
    if (params.status && params.status !== 'all') queryParams.status = params.status;
    if (params.contact_type && params.contact_type !== 'all') queryParams.contact_type = params.contact_type;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;
    if (params.sort_by) queryParams.sort_by = params.sort_by;
    if (params.sort_order) queryParams.sort_order = params.sort_order;

    const data = await axiosWrapper<ContactListResponse>(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_CONTACT_LIST, { params: queryParams })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch contact list.",
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
 * Delete a single contact entry by ID
 */
export const deleteContact = async (contactId: number) => {
  try {
    const data = await axiosWrapper<{
      success: boolean;
      data?: { message: string };
      error?: string;
    }>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.ADMIN_CONTACT_DELETE}${contactId}`)
    );

    if (data.success) {
      return {
        success: true,
        message: data.data?.message || "Contact deleted successfully"
      };
    }
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to delete contact.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Delete multiple contact entries in a batch
 */
export const batchDeleteContact = async (contactIds: number[]) => {
  try {
    const data = await axiosWrapper<ContactBatchDeleteResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_CONTACT_BATCH_DELETE, {
        ids: contactIds,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      deleted_count: 0,
      error: (data as ApiResponse).error || "Failed to delete contact entries.",
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      deleted_count: 0,
    };
  }
};

/**
 * Mark contact as open or resolved
 */
export const markContactStatus = async (contactId: number, status: 'open' | 'resolved') => {
  try {
    const data = await axiosWrapper<ContactUpdateResponse>(
      authClient.post(`${API_CONFIG.ENDPOINTS.ADMIN_CONTACT_MARK_STATUS}${contactId}`, {
        status,
      })
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to update contact status.",
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/**
 * Export contact data (returns download URL to CSV file)
 */
export const exportContact = async (
  format: 'csv',
  params: ContactListParams = {}
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
    if (params.contact_type && params.contact_type !== 'all') requestBody.contact_type = params.contact_type;
    if (params.date_from) requestBody.date_from = params.date_from;
    if (params.date_to) requestBody.date_to = params.date_to;
    if (params.sort_by) requestBody.sort_by = params.sort_by;
    if (params.sort_order) requestBody.sort_order = params.sort_order;

    const data = await axiosWrapper<ContactExportResponse>(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_CONTACT_EXPORT, requestBody)
    );

    if (data.success) return data;
    
    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to export contact.",
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
 * Get a single contact submission by ID (Admin)
 */
export const getContactById = async (contactId: number) => {
  try {
    const data = await axiosWrapper<{ success: boolean; data: ContactItem }>(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_CONTACT_DETAIL}${contactId}`)
    );

    if (data.success) return data;

    return {
      success: false,
      error: (data as ApiResponse).error || "Failed to fetch contact details.",
      data: null,
    };
  } catch (error) {
    return {
      ...handleApiError(error as Error),
      data: null,
    };
  }
};