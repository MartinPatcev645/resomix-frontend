import { API_CONFIG } from '../config';
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { SessionsResponse, SuccessResponse } from '../types/auth';

// Get all user sessions
export const getMySessions = async () => {
  try {
    const response = await axiosWrapper<SessionsResponse>(
      authClient.get(API_CONFIG.ENDPOINTS.USER_SESSIONS)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

// Revoke a specific session
export const revokeSession = async (sessionId: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.delete(`${API_CONFIG.ENDPOINTS.USER_SESSIONS}/${sessionId}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as Error);
  }
};

