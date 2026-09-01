import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";
import { API_CONFIG } from "../config";

// ─── Interfaces ─────────────────────────────────────────────

export type BackupServerRole = "alwyzon" | "media";

export type BackupRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  // Some components worked and some did not, or a component never reported.
  // Deliberately distinct from `failed`: a night where four of five pieces
  // landed still moved the restore point forward for those four.
  | "partial"
  | "failed";

export type BackupComponentStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export type BackupComponentName =
  | "db"
  | "secrets"
  | "media-embeddings"
  | "media-uploads"
  | "analysis-results"
  | "verify"
  | "retention";

export interface BackupComponent {
  id: number;
  component: BackupComponentName | string;
  status: BackupComponentStatus;
  started_at: string | null;
  finished_at: string | null;
  duration_s: number | null;
  snapshot_id: string | null;
  files_new: number;
  files_changed: number;
  files_processed: number;
  bytes_processed: number;
  /** restic's LOGICAL figure, before compression. Never label this as storage used. */
  bytes_added: number;
  /** What actually reached the Storage Box. This is the one to chart. */
  bytes_stored: number;
  error: string | null;
}

export interface BackupRun {
  id: number;
  run_uid: string;
  server_role: BackupServerRole | string;
  hostname: string | null;
  trigger: "scheduled" | "manual";
  triggered_by_user_id: number | null;
  status: BackupRunStatus;
  started_at: string | null;
  finished_at: string | null;
  duration_s: number | null;
  bytes_stored: number;
  files_processed: number;
  error: string | null;
  created_at: string;
  components?: BackupComponent[];
}

/** `never` (has not succeeded once) is kept apart from `stale` (succeeded, then
 *  stopped). The first is a setup problem, the second is an incident. */
export type BackupHealth = "ok" | "stale" | "never";

export interface BackupComponentHealth {
  component: string;
  last_success_at: string | null;
  age_hours: number | null;
  health: BackupHealth;
}

export interface BackupRoleStatus {
  server_role: BackupServerRole | string;
  /** False until the agent on that box is deployed and its URL is set. */
  agent_configured: boolean;
  running: boolean;
  active_run_uid: string | null;
  last_run: BackupRun | null;
  components: BackupComponentHealth[];
  health: "ok" | "degraded" | "never" | "unknown";
}

export interface BackupStatus {
  overall_health: "ok" | "degraded" | "never";
  stale_after_hours: number;
  generated_at: string;
  roles: BackupRoleStatus[];
}

export interface BackupStats {
  window_days: number;
  runs_by_status: Record<string, number>;
  runs_total: number;
  bytes_stored: number;
  avg_duration_s: number;
  daily: { date: string; bytes_stored: number; runs: number }[];
}

export interface BackupSnapshot {
  id: string;
  short_id?: string;
  time: string;
  tags?: string[];
  paths?: string[];
  hostname?: string;
  size?: number;
}

export interface BackupSnapshotsResponse {
  snapshots: BackupSnapshot[];
  repository?: string;
  total_size?: number;
}

export interface ListBackupRunsParams {
  page?: number;
  page_size?: number;
  server_role?: BackupServerRole;
  status?: BackupRunStatus;
  trigger?: "scheduled" | "manual";
  days?: number;
}

// The envelope shapes are shared across every admin module and are already
// exported from ./logs. Re-declaring them here would collide in the barrel
// (`export *` drops names that two modules both export), so this file exports
// concrete response types instead of another set of generics.
export interface BackupPagination {
  total: number;
  pages: number;
  page: number;
  size: number;
  has_next: boolean;
  has_prev: boolean;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  pagination: BackupPagination;
  error?: string;
}

interface DetailResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export type BackupRunsResponse = ListResponse<BackupRun>;
export type BackupRunResponse = DetailResponse<BackupRun>;
export type BackupStatusResponse = DetailResponse<BackupStatus>;
export type BackupStatsResponse = DetailResponse<BackupStats>;
export type BackupSnapshotsResult = DetailResponse<BackupSnapshotsResponse>;
export type BackupPurgeResponse = DetailResponse<{ removed: number }>;

export interface TriggerResponse {
  success: boolean;
  data?: BackupRun;
  /** Present on both paths. On failure it says WHY, including the case where no
   *  agent is configured yet, which is not the same as a failed backup. */
  message?: string;
  error?: string;
}

// ─── API Calls ─────────────────────────────────────────────

export const getBackupStatus = async (): Promise<BackupStatusResponse> => {
  try {
    return await axiosWrapper(authClient.get(API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_STATUS));
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getBackupStats = async (days = 30): Promise<BackupStatsResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_STATS, { params: { days } })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getBackupRuns = async (
  params: ListBackupRunsParams
): Promise<BackupRunsResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_RUNS, { params })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getBackupRun = async (runUid: string): Promise<BackupRunResponse> => {
  try {
    return await axiosWrapper(
      authClient.get(`${API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_RUNS}/${runUid}`)
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const getBackupSnapshots = async (
  serverRole: BackupServerRole,
  tag?: string
): Promise<BackupSnapshotsResult> => {
  try {
    return await axiosWrapper(
      authClient.get(API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_SNAPSHOTS, {
        params: { server_role: serverRole, ...(tag ? { tag } : {}) },
      })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const triggerBackupRun = async (
  serverRole: BackupServerRole,
  components?: string[]
): Promise<TriggerResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_RUN, {
        server_role: serverRole,
        ...(components?.length ? { components } : {}),
      })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const triggerBackupVerify = async (
  serverRole: BackupServerRole,
  full = false
): Promise<TriggerResponse> => {
  try {
    return await axiosWrapper(
      authClient.post(API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_VERIFY, {
        server_role: serverRole,
        full,
      })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};

export const purgeBackupHistory = async (
  days?: number
): Promise<BackupPurgeResponse> => {
  try {
    return await axiosWrapper(
      authClient.delete(API_CONFIG.ENDPOINTS.ADMIN_BACKUPS_HISTORY, {
        params: days ? { days } : undefined,
      })
    );
  } catch (error: any) {
    return handleApiError(error) as any;
  }
};
