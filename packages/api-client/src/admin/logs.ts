import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Interfaces ─────────────────────────────────────────────

export interface SystemLog {
  id: number;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  category: string;
  action: string;
  message: string;
  endpoint: string | null;
  status_code: number | null;
  duration_ms: number | null;
  client_ip: string | null;
  correlation_id: string | null;
  log_metadata: any | null;
  created_at: string;
  stack_trace?: string | null;
  query_params?: string | null;
  user_agent?: string | null;
}

export interface SystemLogsStats {
  total_logs: number;
  level_distribution: Record<string, number>;
  error_rate_percent: number;
  total_requests: number;
  error_requests: number;
  period_hours: number;
}

export interface SystemOverviewStats {
  window_hours: number;
  generated_at: string;
  status: "healthy" | "degraded" | "critical";
  system_logs: {
    status: "healthy" | "degraded" | "critical";
    total_all_time: number;
    total_in_window: number;
    error_count: number;
    critical_count: number;
    warning_count: number;
    error_rate_percent: number;
    by_level: Record<string, number>;
    by_category: Record<string, number>;
    avg_duration_ms: number;
    slow_request_count: number;
    recent_attention: SystemLog[];
    timeseries: {
      bucket: string;
      total: number;
      errors: number;
      warnings: number;
    }[];
  };
  operations: {
    total_in_window: number;
    active_admins: number;
    top_actions: {
      action: string;
      count: number;
    }[];
  };
}

export interface ListSystemLogsParams {
  page?: number;
  page_size?: number;
  level?: string;
  category?: string;
  action?: string;
  endpoint?: string;
  q?: string;
  client_ip?: string;
  correlation_id?: string;
  status_code?: number;
  track_id?: number;
  playlist_id?: number;
  min_duration?: number;
  start_date?: string;
  end_date?: string;
  order_by?: string;
  order_dir?: "asc" | "desc";
}

export interface OperationLog {
  id: number;
  admin_user_id: number;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  before_state: any | null;
  after_state: any | null;
  ip_address: string;
  correlation_id: string | null;
  created_at: string;
}

export interface ListOperationLogsParams {
  page?: number;
  page_size?: number;
  admin_user_id?: number;
  action?: string;
  target_type?: string;
  target_id?: string;
  correlation_id?: string;
  start_date?: string;
  end_date?: string;
  order_dir?: "asc" | "desc";
}

export interface PaginationEnvelope {
  total: number;
  pages: number;
  page: number;
  size: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ListResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationEnvelope;
  error?: string;
}

export interface DetailResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ─── API Calls ─────────────────────────────────────────────

export const getSystemLogs = async (params: ListSystemLogsParams): Promise<ListResponse<SystemLog>> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_SYSTEM_LOGS, { params })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getSystemLogDetail = async (logId: number): Promise<DetailResponse<SystemLog>> => {
  try {
    return await axiosWrapper(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_SYSTEM_LOGS}/${logId}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getSystemLogsStats = async (hours = 24): Promise<DetailResponse<SystemLogsStats>> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_SYSTEM_LOGS_STATS, { params: { hours } })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getOperationLogs = async (params: ListOperationLogsParams): Promise<ListResponse<OperationLog>> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_OPERATION_LOGS, { params })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getOperationLogDetail = async (logId: number): Promise<DetailResponse<OperationLog>> => {
  try {
    return await axiosWrapper(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_OPERATION_LOGS}/${logId}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getSystemLogsOverview = async (hours = 24): Promise<DetailResponse<SystemOverviewStats>> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_SYSTEM_LOGS_OVERVIEW, { params: { hours } })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
