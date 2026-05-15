import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

export interface AdminUserSearchItem {
  id: number;
  uuid: string | null;
  email: string | null;
  username: string | null;
  name: string | null;
  is_email_verified: boolean | null;
  created_at: string | null;
}

export interface AdminUserSearchResponse {
  success: boolean;
  data?: AdminUserSearchItem[];
  error?: string;
}

export const searchAdminUsers = async (
  query: string,
  limit = 10,
): Promise<AdminUserSearchResponse> => {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      success: false,
      data: [],
      error: "Query parameter cannot be empty",
    };
  }

  try {
    const response = await axiosWrapper<AdminUserSearchResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_USER_SEARCH, {
        params: {
          q: trimmedQuery,
          limit,
        },
      }),
    );

    if (response.success && response.data) {
      return response;
    }

    return {
      success: false,
      data: [],
      error: response.error || "Failed to search users.",
    };
  } catch (error) {
    const apiError = handleApiError(error as Error);
    return {
      ...apiError,
      data: [],
    };
  }
};


