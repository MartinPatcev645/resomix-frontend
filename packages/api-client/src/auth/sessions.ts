import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { SessionsResponse, SuccessResponse } from '../types/auth';

// Get all user sessions
export const getMySessions = async () => {
  try {
    const response = await axiosWrapper<SessionsResponse>(
      authClient.get('/users/me/sessions')
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

// Revoke a specific session
export const revokeSession = async (sessionId: string) => {
  try {
    const response = await axiosWrapper<SuccessResponse>(
      authClient.delete(`/users/me/sessions/${sessionId}`)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};

