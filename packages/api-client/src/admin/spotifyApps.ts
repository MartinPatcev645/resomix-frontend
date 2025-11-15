import axiosInstance, { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export interface AdminSpotifyApp {
  id: number;
  name: string;
  description: string | null;
  client_id: string;
  client_secret?: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminSpotifyAppListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
  search?: string;
}

export interface AdminSpotifyAppListResponse {
  success: boolean;
  data?: AdminSpotifyApp[];
  pagination?: {
    total: number;
    skip: number;
    limit: number;
    count: number;
  };
  error?: string;
}

export interface AdminSpotifyAppResponse {
  success: boolean;
  data?: AdminSpotifyApp;
  error?: string;
}

export interface AdminSpotifyAppCreateRequest {
  name: string;
  description?: string;
  client_id: string;
  client_secret: string;
  is_active?: boolean;
}

export interface AdminSpotifyAppUpdateRequest {
  name?: string;
  description?: string;
  client_id?: string;
  client_secret?: string;
  is_active?: boolean;
}

export interface AdminSpotifyAppDeleteParams {
  cascade?: boolean;
}

export interface AdminSpotifyAppDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface AdminSpotifyAppUser {
  user_id: number;
  user_email: string | null;
  user_username: string | null;
  user_uuid: string | null;
  spotify_app_id: number;
  spotify_app_name: string;
  created_at: string;
  updated_at: string;
}

export interface AdminSpotifyAppUserListParams {
  page?: number;
  page_size?: number;
  search?: string;
  spotify_app_id?: number;
}

export interface AdminSpotifyAppUserListResponse {
  success: boolean;
  data?: AdminSpotifyAppUser[];
  pagination?: {
    total: number;
    skip: number;
    limit: number;
    count: number;
  };
  error?: string;
}

export interface AdminSpotifyAppUserResponse {
  success: boolean;
  data?: AdminSpotifyAppUser;
  error?: string;
}

export interface AdminSpotifyAppUserUpsertRequest {
  user_identifier: string;
  spotify_app_id: number;
}

export interface AdminSpotifyAppUserUpsertResponse {
  success: boolean;
  data?: AdminSpotifyAppUser;
  error?: string;
}

export interface AdminSpotifyAppUserDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────

const buildAppPath = (appId: number) =>
  `${API_CONFIG.ENDPOINTS.ADMIN_SPOTIFY_APPS}${appId}`;

const buildUserPath = (userIdentifier: string) =>
  `${API_CONFIG.ENDPOINTS.ADMIN_SPOTIFY_APP_USERS}/${encodeURIComponent(userIdentifier)}`;

const defaultPagination = (page?: number, pageSize?: number) => ({
  total: 0,
  skip: 0,
  limit: pageSize || 100,
  count: 0,
});

// ─── API Calls ─────────────────────────────────────────────

export const getSpotifyApps = async (
  params: AdminSpotifyAppListParams = {},
): Promise<AdminSpotifyAppListResponse> => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 100,
    };

    if (params.is_active !== undefined) {
      queryParams.is_active = params.is_active;
    }

    if (params.search) {
      queryParams.search = params.search;
    }

    const response = await axiosWrapper<AdminSpotifyAppListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_SPOTIFY_APPS, {
        params: queryParams,
      }),
    );

    if (response.success && response.data && response.pagination) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to fetch Spotify apps.",
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

export const getSpotifyApp = async (
  appId: number,
  includeSecret: boolean = true,
): Promise<AdminSpotifyAppResponse> => {
  try {
    const response = await axiosWrapper<AdminSpotifyAppResponse>(
      axiosInstance.get(buildAppPath(appId), {
        params: {
          include_secret: includeSecret,
        },
      }),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to fetch Spotify app.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const createSpotifyApp = async (
  payload: AdminSpotifyAppCreateRequest,
): Promise<AdminSpotifyAppResponse> => {
  try {
    const response = await axiosWrapper<AdminSpotifyAppResponse>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.ADMIN_SPOTIFY_APPS, payload),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to create Spotify app.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const updateSpotifyApp = async (
  appId: number,
  payload: AdminSpotifyAppUpdateRequest,
): Promise<AdminSpotifyAppResponse> => {
  try {
    const response = await axiosWrapper<AdminSpotifyAppResponse>(
      axiosInstance.put(buildAppPath(appId), payload),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to update Spotify app.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const deleteSpotifyApp = async (
  appId: number,
  params: AdminSpotifyAppDeleteParams = {},
): Promise<AdminSpotifyAppDeleteResponse> => {
  try {
    const queryParams: Record<string, any> = {};
    if (params.cascade !== undefined) {
      queryParams.cascade = params.cascade;
    }

    const response = await axiosWrapper<AdminSpotifyAppDeleteResponse>(
      axiosInstance.delete(buildAppPath(appId), {
        params: queryParams,
      }),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to delete Spotify app.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const getSpotifyAppUsers = async (
  params: AdminSpotifyAppUserListParams = {},
): Promise<AdminSpotifyAppUserListResponse> => {
  try {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 30,
    };

    if (params.search) {
      queryParams.search = params.search;
    }

    if (params.spotify_app_id) {
      queryParams.spotify_app_id = params.spotify_app_id;
    }

    const response = await axiosWrapper<AdminSpotifyAppUserListResponse>(
      axiosInstance.get(API_CONFIG.ENDPOINTS.ADMIN_SPOTIFY_APP_USERS, {
        params: queryParams,
      }),
    );

    if (response.success && response.data && response.pagination) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to fetch Spotify app users.",
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

export const getSpotifyAppUser = async (
  userIdentifier: string,
): Promise<AdminSpotifyAppUserResponse> => {
  try {
    const response = await axiosWrapper<AdminSpotifyAppUserResponse>(
      axiosInstance.get(buildUserPath(userIdentifier)),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to fetch Spotify app user.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const upsertSpotifyAppUser = async (
  payload: AdminSpotifyAppUserUpsertRequest,
): Promise<AdminSpotifyAppUserUpsertResponse> => {
  try {
    const response = await axiosWrapper<AdminSpotifyAppUserUpsertResponse>(
      axiosInstance.put(API_CONFIG.ENDPOINTS.ADMIN_SPOTIFY_APP_USERS, payload),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to save Spotify app user association.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

export const deleteSpotifyAppUser = async (
  userIdentifier: string,
): Promise<AdminSpotifyAppUserDeleteResponse> => {
  try {
    const response = await axiosWrapper<AdminSpotifyAppUserDeleteResponse>(
      axiosInstance.delete(buildUserPath(userIdentifier)),
    );

    if (response.success) {
      return response;
    }

    return {
      success: false,
      error: response.error || "Failed to delete Spotify app user association.",
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

