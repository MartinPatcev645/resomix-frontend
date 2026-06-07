import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export type IngestStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface IngestLogError {
  id: number;
  error_code: string;
  error_message: string;
  error_severity: string;
  reference_node: string;
}

export interface IngestLog {
  id: number;
  partner_id: number;
  party_id: string | null;
  package_folder: string;
  batch_filename: string;
  status: IngestStatus;
  track_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ListIngestLogsParams {
  partner_id?: number;
  status?: IngestStatus;
  page?: number;
  page_size?: number;
}

export interface ListIngestLogsResponse {
  status: string;
  logs: IngestLog[];
}

export interface GetIngestLogResponse {
  status: string;
  log: IngestLog;
  errors: IngestLogError[];
}

export interface TriggerIngestionRequest {
  partner_id: number;
  /** "live" = full persist; "test" = dry-run validate + report only */
  env: "live" | "test";
}

export interface TriggerIngestionResponse {
  status: "accepted";
  message: string;
  partner_id: number;
  env: string;
  batch_path: string;
}

export interface RetryIngestionResponse {
  status: "accepted";
  message: string;
  ingest_log_id: number;
  partner_id: number;
  env: string;
}

// ─── API Calls ─────────────────────────────────────────────

/**
 * List ingestion logs with optional filtering.
 */
export const listIngestLogs = async (
  params: ListIngestLogsParams = {},
): Promise<ListIngestLogsResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_INGESTION_LOGS, { params }),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Get a single ingest log by ID, including per-row errors.
 */
export const getIngestLog = async (
  logId: number,
): Promise<GetIngestLogResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_INGESTION_LOGS}/${logId}`),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Manually trigger an ingestion run for a partner.
 * Returns 202 Accepted immediately; use listIngestLogs() to monitor progress.
 */
export const triggerIngestion = async (
  payload: TriggerIngestionRequest,
): Promise<TriggerIngestionResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_INGESTION_TRIGGER, payload),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Retry a previously failed ingestion batch.
 * Returns 202 Accepted; monitor progress via getIngestLog().
 */
export const retryIngestion = async (
  logId: number,
): Promise<RetryIngestionResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(
        `${API_CONFIG.ENDPOINTS.ADMIN_INGESTION_LOGS}/${logId}/retry`,
      ),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
