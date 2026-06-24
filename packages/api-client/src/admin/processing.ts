import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Types ─────────────────────────────────────────────────

export type ProcessingJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "paused"
  | "finalizing";

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
  finalizing_at: string | null;
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

export type PeaksSegmentsStage = "peaks" | "segments";

export interface TriggerPeaksSegmentsRequest {
  partner_id: number;
  env: "live" | "test";
  ingest_log_id?: number | null;
  only_pending?: boolean;
}

export interface TriggerPeaksSegmentsResponse {
  status: "accepted" | "already_running";
  message: string;
  job_id: number;
  job_type: string;
  job_status?: string;
  total_tracks?: number;
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

/**
 * Pause a running processing job.
 */
export const pauseProcessingJob = async (
  jobId: number,
): Promise<{ status: "accepted"; message: string; job_id: number; job_status: "paused" }> => {
  try {
    const url = API_CONFIG.ENDPOINTS.ADMIN_PROCESSING_JOBS_PAUSE.replace("{id}", jobId.toString());
    return await axiosWrapper(
      authClient.post(url),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Resume a paused/crashed processing job.
 */
export const resumeProcessingJob = async (
  jobId: number,
  params: { env: "live" | "test"; index_after?: boolean },
): Promise<{ status: "accepted"; message: string; job_id: number; job_status: "running"; total_tracks: number }> => {
  try {
    const url = API_CONFIG.ENDPOINTS.ADMIN_PROCESSING_JOBS_RESUME.replace("{id}", jobId.toString());
    return await axiosWrapper(
      authClient.post(url, null, { params }),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

/**
 * Trigger a peaks or segments (playback assets) job for a partner.
 * POST /api/v1/admin/processing/jobs/{stage}
 */
export const triggerPeaksSegmentsJob = async (
  stage: PeaksSegmentsStage,
  payload: TriggerPeaksSegmentsRequest,
): Promise<TriggerPeaksSegmentsResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(`${API_CONFIG.ENDPOINTS.ADMIN_PROCESSING_JOBS_STAGE}/${stage}`, payload),
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
