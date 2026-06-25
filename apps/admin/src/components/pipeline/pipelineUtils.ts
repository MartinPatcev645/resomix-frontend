import type { ProcessingJob } from '@resomix/api-client';

// ─── Stage Definitions ────────────────────────────────────────

export type PipelineStage = 'ingestion' | 'transcode' | 'embeddings' | 'peaks' | 'segments';

export type StageStatus =
  | 'queued'
  | 'running'
  | 'finalizing'
  | 'completed'
  | 'partial'   // completed w/ failures (≤5%)
  | 'halted'    // ≥5% failures, auto-gate tripped
  | 'paused'
  | 'skipped';

export interface StageInfo {
  id: PipelineStage;
  label: string;
  /** Aggregate status derived from underlying jobs / ingest logs */
  status: StageStatus;
  /** Total tracks scoped to this stage */
  total: number;
  /** Successfully processed */
  processed: number;
  /** Failed items */
  failed: number;
  /** Whether this stage is not applicable (e.g. peaks for similarity_only) */
  isSkipped: boolean;
  /** Most recent job for this stage (if any) */
  latestJob: ProcessingJob | null;
}

export interface GateResult {
  /** Did the upstream stage pass cleanly? */
  state: 'passed' | 'halted' | 'pending';
  /** Failure rate that tripped the gate (only for halted) */
  failRate?: number;
}

/** The 5% leniency threshold: if ≥5% of tracks failed, the gate halts */
const HALT_THRESHOLD = 0.05;

// ─── Stage topology ───────────────────────────────────────────

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'ingestion', label: 'Ingestion' },
  { id: 'transcode', label: 'Transcode' },
  { id: 'embeddings', label: 'Embedding' },
  { id: 'peaks', label: 'Peaks' },
  { id: 'segments', label: 'Segments' },
];

/**
 * At INGESTED the backend spawns Embedding and Transcode concurrently (siblings of
 * Ingestion) — embeddings are computed off the original/preview, not the 128k mp3, so
 * they do not wait for transcode. Peaks / Segments fork off Transcode (they consume the
 * transcoded mp3) and only for similarity_playback partners. Embedding is the critical
 * path to READY; transcode does not gate it.
 */
export const STAGE_DEPENDENCIES: Record<PipelineStage, PipelineStage | null> = {
  ingestion: null,
  transcode: 'ingestion',
  embeddings: 'ingestion',
  peaks: 'transcode',
  segments: 'transcode',
};

// ─── Status derivation ───────────────────────────────────────

/**
 * Map a backend job_type to our PipelineStage.
 * The backend uses "transcode" | "embeddings" | "peaks" | "segments".
 */
export function jobTypeToStage(jobType: string): PipelineStage | null {
  const map: Record<string, PipelineStage> = {
    transcode: 'transcode',
    embeddings: 'embeddings',
    peaks: 'peaks',
    segments: 'segments',
  };
  return map[jobType] ?? null;
}

/**
 * Given a list of processing jobs, return only those matching a stage.
 */
export function getJobsForStage(jobs: ProcessingJob[], stage: PipelineStage): ProcessingJob[] {
  if (stage === 'ingestion') return []; // ingestion has its own data source
  return jobs.filter(j => jobTypeToStage(j.job_type) === stage);
}

/**
 * Derive a single aggregate status for a stage from its latest job.
 * Uses the most recent job (by created_at) as the source of truth.
 */
export function deriveStageStatus(
  jobs: ProcessingJob[],
  stage: PipelineStage,
  isSkipped: boolean,
): StageStatus {
  if (isSkipped) return 'skipped';

  const stageJobs = getJobsForStage(jobs, stage);
  if (stageJobs.length === 0) return 'queued';

  // Sort by created_at descending to get the latest job
  const sorted = [...stageJobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = sorted[0];

  switch (latest.status) {
    case 'running':
      return 'running';
    case 'finalizing':
      return 'finalizing';
    case 'paused':
      return 'paused';
    case 'pending':
      return 'queued';
    case 'completed': {
      // Check if there were failures within leniency
      const total = latest.total_tracks || 0;
      const failed = latest.failed_tracks || 0;
      if (failed > 0 && total > 0) {
        const failRate = failed / total;
        return failRate >= HALT_THRESHOLD ? 'halted' : 'partial';
      }
      return 'completed';
    }
    case 'partial':
      return 'partial';
    case 'failed':
      return 'halted';
    default:
      return 'queued';
  }
}

/**
 * Derive ingestion stage status from ingest logs.
 */
export function deriveIngestionStatus(
  ingestLogs: Array<{ status: string; track_count: number }>,
): StageStatus {
  if (ingestLogs.length === 0) return 'queued';

  // Check the most recent log
  const latest = ingestLogs[0]; // already sorted newest-first from API
  switch (latest.status) {
    case 'PROCESSING':
      return 'running';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'halted';
    case 'PENDING':
      return 'queued';
    default:
      return 'queued';
  }
}

/**
 * Compute the gate between two stages.
 */
export function computeStageGate(
  upstreamStatus: StageStatus,
  upstreamFailed: number,
  upstreamTotal: number,
): GateResult {
  // If upstream hasn't completed, gate is pending
  if (['queued', 'running', 'finalizing', 'paused', 'skipped'].includes(upstreamStatus)) {
    return { state: 'pending' };
  }

  // If halted, gate is halted
  if (upstreamStatus === 'halted') {
    const failRate = upstreamTotal > 0 ? upstreamFailed / upstreamTotal : 0;
    return { state: 'halted', failRate };
  }

  // Completed or partial — check fail rate
  if (upstreamTotal > 0 && upstreamFailed > 0) {
    const failRate = upstreamFailed / upstreamTotal;
    if (failRate >= HALT_THRESHOLD) {
      return { state: 'halted', failRate };
    }
  }

  return { state: 'passed' };
}

// ─── Color and styling ───────────────────────────────────────

export interface StatusStyle {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}

export function getStatusStyle(status: StageStatus): StatusStyle {
  switch (status) {
    case 'queued':
      return { color: '#8b8fa3', bgColor: 'rgba(139,143,163,0.10)', borderColor: '#8b8fa3', label: 'Queued' };
    case 'running':
      return { color: '#3b82f6', bgColor: 'rgba(59,130,246,0.10)', borderColor: '#3b82f6', label: 'Running' };
    case 'finalizing':
      return { color: '#6366f1', bgColor: 'rgba(99,102,241,0.10)', borderColor: '#6366f1', label: 'Finalizing' };
    case 'completed':
      return { color: '#10b981', bgColor: 'rgba(16,185,129,0.10)', borderColor: '#10b981', label: 'Completed' };
    case 'partial':
      return { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.10)', borderColor: '#f59e0b', label: 'Completed w/ failures' };
    case 'halted':
      return { color: '#ef4444', bgColor: 'rgba(239,68,68,0.10)', borderColor: '#ef4444', label: 'Halted — needs review' };
    case 'paused':
      return { color: '#64748b', bgColor: 'rgba(100,116,139,0.10)', borderColor: '#64748b', label: 'Paused' };
    case 'skipped':
      return { color: '#94a3b8', bgColor: 'transparent', borderColor: '#94a3b8', label: 'Skipped' };
  }
}

/**
 * Get the Antd Tag color name for a status.
 */
export function getStatusTagColor(status: StageStatus): string {
  switch (status) {
    case 'queued': return 'default';
    case 'running': return 'processing';
    case 'finalizing': return 'purple';
    case 'completed': return 'success';
    case 'partial': return 'warning';
    case 'halted': return 'error';
    case 'paused': return 'default';
    case 'skipped': return 'default';
  }
}

// ─── Aggregate counts ────────────────────────────────────────

export interface StageCounts {
  total: number;
  processed: number;
  failed: number;
}

/**
 * Aggregate counts for a stage from its latest job.
 */
export function getLatestJobForStage(jobs: ProcessingJob[], stage: PipelineStage): ProcessingJob | null {
  const stageJobs = getJobsForStage(jobs, stage);
  if (stageJobs.length === 0) return null;
  return [...stageJobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

export function getStageCounts(jobs: ProcessingJob[], stage: PipelineStage): StageCounts {
  const latest = getLatestJobForStage(jobs, stage);
  if (!latest) return { total: 0, processed: 0, failed: 0 };
  return {
    total: latest.total_tracks || 0,
    processed: latest.processed_tracks || 0,
    failed: latest.failed_tracks || 0,
  };
}

// ─── Duration formatting ─────────────────────────────────────

export function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const diffSecs = Math.floor((end - start) / 1000);
  if (diffSecs < 0) return '—';
  if (diffSecs < 60) return `${diffSecs}s`;
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

/**
 * Estimate ETA for a running job based on current throughput.
 */
export function estimateEta(job: ProcessingJob): string | null {
  if (job.status !== 'running' || !job.started_at) return null;
  const processed = (job.processed_tracks || 0) + (job.failed_tracks || 0);
  const total = job.total_tracks || 0;
  if (processed === 0 || total === 0) return null;

  const elapsedMs = Date.now() - new Date(job.started_at).getTime();
  const msPerTrack = elapsedMs / processed;
  const remaining = total - processed;
  const etaMs = msPerTrack * remaining;

  if (etaMs < 60_000) return `~${Math.ceil(etaMs / 1000)}s`;
  if (etaMs < 3_600_000) return `~${Math.ceil(etaMs / 60_000)}m`;
  return `~${(etaMs / 3_600_000).toFixed(1)}h`;
}

/**
 * Build the full StageInfo array for the stepper from current data.
 */
export function buildStageInfos(
  ingestLogs: Array<{ status: string; track_count: number }>,
  jobs: ProcessingJob[],
  skippedStages: Set<PipelineStage>,
): StageInfo[] {
  return PIPELINE_STAGES.map(({ id, label }) => {
    const isSkipped = skippedStages.has(id);

    if (id === 'ingestion') {
      const status = isSkipped ? 'skipped' as StageStatus : deriveIngestionStatus(ingestLogs);
      const latest = ingestLogs[0];
      return {
        id,
        label,
        status,
        total: latest?.track_count ?? 0,
        processed: status === 'completed' ? (latest?.track_count ?? 0) : 0,
        failed: status === 'halted' ? 1 : 0,
        isSkipped,
        latestJob: null,
      };
    }

    const status = deriveStageStatus(jobs, id, isSkipped);
    const counts = getStageCounts(jobs, id);
    const latestJob = getLatestJobForStage(jobs, id);

    return {
      id,
      label,
      status,
      total: counts.total,
      processed: counts.processed,
      failed: counts.failed,
      isSkipped,
      latestJob,
    };
  });
}

/**
 * Build the full StageInfo array for the stepper representing a single IngestLog (run) and its child jobs.
 */
export function buildStageInfosForLog(
  log: any | null,
  jobs: ProcessingJob[],
  skippedStages: Set<PipelineStage>,
): StageInfo[] {
  return PIPELINE_STAGES.map(({ id, label }) => {
    const isSkipped = skippedStages.has(id);
    if (isSkipped) {
      return {
        id,
        label,
        status: 'skipped' as StageStatus,
        total: 0,
        processed: 0,
        failed: 0,
        isSkipped: true,
        latestJob: null,
      };
    }

    if (!log) {
      return {
        id,
        label,
        status: 'queued' as StageStatus,
        total: 0,
        processed: 0,
        failed: 0,
        isSkipped: false,
        latestJob: null,
      };
    }

    if (id === 'ingestion') {
      const stage = log.stage || 'RECEIVED';
      let status: StageStatus = 'queued';

      if (['RECEIVED', 'VALIDATING', 'MOVED', 'PERSISTING'].includes(stage)) {
        status = log.status === 'FAILED' ? 'halted' : 'running';
      } else if (['TRANSCODING', 'INGESTED', 'EMBEDDING', 'INDEXED', 'FINALIZING', 'READY'].includes(stage)) {
        status = log.status === 'FAILED' ? 'halted' : 'completed';
      } else {
        status = log.status === 'PROCESSING' ? 'running' : log.status === 'COMPLETED' ? 'completed' : log.status === 'FAILED' ? 'halted' : 'queued';
      }

      return {
        id,
        label,
        status,
        total: log.track_count || 0,
        processed: status === 'completed' ? (log.track_count || 0) : 0,
        failed: status === 'halted' ? 1 : 0,
        isSkipped: false,
        latestJob: null,
      };
    }

    // For transcode, embeddings, peaks, segments
    const stageJobs = jobs.filter(j => j.ingest_log_id === log.id && jobTypeToStage(j.job_type) === id);
    const latestJob = stageJobs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0] || null;

    let status: StageStatus = 'queued';

    if (latestJob) {
      switch (latestJob.status) {
        case 'running':
          status = 'running';
          break;
        case 'finalizing':
          status = 'finalizing';
          break;
        case 'paused':
          status = 'paused';
          break;
        case 'pending':
          status = 'queued';
          break;
        case 'completed': {
          const total = latestJob.total_tracks || 0;
          const failed = latestJob.failed_tracks || 0;
          if (failed > 0 && total > 0) {
            const failRate = failed / total;
            status = failRate >= HALT_THRESHOLD ? 'halted' : 'partial';
          } else {
            status = 'completed';
          }
          break;
        }
        case 'partial':
          status = 'partial';
          break;
        case 'failed':
          status = 'halted';
          break;
        default:
          status = 'queued';
      }
    } else {
      // Fallback to IngestLog.stage mapping if no job found yet
      const currentStage = log.stage || 'RECEIVED';
      if (id === 'transcode') {
        if (currentStage === 'TRANSCODING') {
          status = 'running';
        } else if (['INGESTED', 'EMBEDDING', 'INDEXED', 'FINALIZING', 'READY'].includes(currentStage)) {
          status = 'completed';
        }
      } else if (id === 'embeddings') {
        if (currentStage === 'EMBEDDING') {
          status = 'running';
        } else if (currentStage === 'INDEXED' || currentStage === 'FINALIZING') {
          status = 'finalizing';
        } else if (currentStage === 'READY') {
          status = 'completed';
        }
      }
    }

    const total = latestJob?.total_tracks || 0;
    const processed = latestJob?.processed_tracks || 0;
    const failed = latestJob?.failed_tracks || 0;

    return {
      id,
      label,
      status,
      total,
      processed,
      failed,
      isSkipped: false,
      latestJob,
    };
  });
}

