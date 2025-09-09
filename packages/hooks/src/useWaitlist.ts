import { useState, useCallback } from 'react';
import { joinWaitlist, checkWaitlistStatus } from '@resomix/api-client';

interface WaitlistData {
  id: number;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface WaitlistResponse {
  success: boolean;
  data?: WaitlistData;
  error?: string;
  details?: unknown;
}

interface UseWaitlistReturn {
  // State
  isLoading: boolean;
  isCheckingStatus: boolean;
  error: string | null;
  success: boolean;
  waitlistData: WaitlistData | null;
  
  // Actions
  joinWaitlist: (email: string) => Promise<WaitlistResponse>;
  checkStatus: (email: string) => Promise<WaitlistResponse>;
  clearError: () => void;
  clearSuccess: () => void;
  reset: () => void;
}

export const useWaitlist = (): UseWaitlistReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [waitlistData, setWaitlistData] = useState<WaitlistData | null>(null);

  const joinWaitlistHandler = useCallback(async (email: string): Promise<WaitlistResponse> => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setWaitlistData(null);

    try {
      const response = await joinWaitlist(email);
      
      if (response.success) {
        setSuccess(true);
        setWaitlistData(response.data || null);
        return response;
      } else {
        setError(response.error || 'Failed to join waitlist');
        return response;
      }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkStatusHandler = useCallback(async (email: string): Promise<WaitlistResponse> => {
    setIsCheckingStatus(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await checkWaitlistStatus(email);
      
      if (response.success) {
        setSuccess(true);
        setWaitlistData(response.data || null);
        return response;
      } else {
        setError(response.error || 'Failed to check waitlist status');
        return response;
      }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearSuccess = useCallback(() => {
    setSuccess(false);
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsCheckingStatus(false);
    setError(null);
    setSuccess(false);
    setWaitlistData(null);
  }, []);

  return {
    // State
    isLoading,
    isCheckingStatus,
    error,
    success,
    waitlistData,
    
    // Actions
    joinWaitlist: joinWaitlistHandler,
    checkStatus: checkStatusHandler,
    clearError,
    clearSuccess,
    reset,
  };
};
