import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export type ProcessingJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed";

export interface ProcessingJob {
  id: number;
  partner_id: number;
  ingest_log_id: number | null;
  job_type: string;
  status: ProcessingJobStatus;
  total_tracks: number;
  processed_tracks: number;
  failed_tracks: number;
  error_details: string | null;
  triggered_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TriggerEmbeddingsRequest {
  partner_id: number;
  /** "live" = persist + index into FAISS; "test" = dry-run */
  env: "live" | "test";
  /** Restrict to one ingest batch; null = all pending tracks */
  ingest_log_id?: number | null;
  /** Whether to insert generated embeddings into the partner FAISS index */
  index_after?: boolean;
  /** Skip tracks that already have embeddings */
  only_pending?: boolean;
}

export interface TriggerEmbeddingsResponse {
  status: "accepted";
  message: string;
  job_id: number;
  job_type: string;
  env: string;
}

export interface GetJobResponse {
  status: string;
  job: ProcessingJob;
}

export interface ListJobsParams {
  partner_id?: number;
  status?: ProcessingJobStatus;
  page?: number;
  page_size?: number;
}

export interface ListJobsResponse {
  status: string;
  jobs: ProcessingJob[];
}

// ─── API Calls ─────────────────────────────────────────────

/**
 * Trigger an async embeddings generation job for a partner.
 * Returns immediately with 202 Accepted + job_id; poll via getProcessingJob().
 */
export const triggerEmbeddingsJob = async (
  payload: TriggerEmbeddingsRequest,
): Promise<TriggerEmbeddingsResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_PROCESSING_JOBS_EMBEDDINGS, payload),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Poll the status of a processing job by its ID.
 */
export const getProcessingJob = async (
  jobId: number,
): Promise<GetJobResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_PROCESSING_JOBS}/${jobId}`),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * List processing jobs with optional filtering.
 */
export const listProcessingJobs = async (
  params: ListJobsParams = {},
): Promise<ListJobsResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_PROCESSING_JOBS, { params }),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
