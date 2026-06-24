import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listIngestLogs,
  getIngestLog,
  triggerIngestion,
  retryIngestion,
  refreshIngestLogStatus,
  listProcessingJobs,
  triggerEmbeddingsJob,
  triggerPeaksSegmentsJob,
  pauseProcessingJob,
  resumeProcessingJob,
  type IngestLog,
  type IngestLogError,
  type ProcessingJob,
  type ListIngestLogsParams,
  type ListJobsParams,
  type PeaksSegmentsStage,
} from '@resomix/api-client';
import { message } from 'antd';

export function usePipeline() {
  // SFTP Ingest Log State
  const [ingestLogs, setIngestLogs] = useState<IngestLog[]>([]);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestPagination, setIngestPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // Processing Job State
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsPagination, setJobsPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // Filter States
  const [partnerFilter, setPartnerFilter] = useState<number | undefined>(undefined);
  const [ingestStatusFilter, setIngestStatusFilter] = useState<any>(undefined);
  const [jobStatusFilter, setJobStatusFilter] = useState<any>(undefined);

  const fetchIngestLogs = useCallback(async () => {
    setIngestLoading(true);
    try {
      const params: ListIngestLogsParams = {
        page: ingestPagination.current,
        page_size: ingestPagination.pageSize,
        partner_id: partnerFilter,
        status: ingestStatusFilter,
      };
      const result = await listIngestLogs(params);
      if (result && result.logs) {
        setIngestLogs(result.logs);
        
        let dynamicTotal = result.logs.length;
        if (result.logs.length === ingestPagination.pageSize) {
          dynamicTotal = ingestPagination.current * ingestPagination.pageSize + 1;
        } else {
          dynamicTotal = (ingestPagination.current - 1) * ingestPagination.pageSize + result.logs.length;
        }

        setIngestPagination(prev => ({
          ...prev,
          total: (result as any).pagination?.total || dynamicTotal,
        }));
      }
    } catch {
      message.error('Failed to load ingestion logs');
    } finally {
      setIngestLoading(false);
    }
  }, [ingestPagination.current, ingestPagination.pageSize, partnerFilter, ingestStatusFilter]);

  const fetchProcessingJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const params: ListJobsParams = {
        page: jobsPagination.current,
        page_size: jobsPagination.pageSize,
        partner_id: partnerFilter,
        status: jobStatusFilter,
      };
      const result = await listProcessingJobs(params);
      if (result && result.jobs) {
        setProcessingJobs(result.jobs);
        
        let dynamicTotal = result.jobs.length;
        if (result.jobs.length === jobsPagination.pageSize) {
          dynamicTotal = jobsPagination.current * jobsPagination.pageSize + 1;
        } else {
          dynamicTotal = (jobsPagination.current - 1) * jobsPagination.pageSize + result.jobs.length;
        }

        setJobsPagination(prev => ({
          ...prev,
          total: (result as any).pagination?.total || dynamicTotal,
        }));
      }
    } catch {
      message.error('Failed to load processing jobs');
    } finally {
      setJobsLoading(false);
    }
  }, [jobsPagination.current, jobsPagination.pageSize, partnerFilter, jobStatusFilter]);

  const triggerIngest = async (partnerId: number, env: 'live' | 'test') => {
    try {
      const result = await triggerIngestion({ partner_id: partnerId, env });
      if (result && result.status === 'accepted') {
        message.success(result.message || 'Ingestion triggered successfully');
        fetchIngestLogs();
        return true;
      }
      return false;
    } catch {
      message.error('Failed to trigger ingestion');
      return false;
    }
  };

  const retryIngest = async (logId: number) => {
    try {
      const result = await retryIngestion(logId);
      if (result && result.status === 'accepted') {
        message.success(result.message || 'Retry triggered successfully');
        fetchIngestLogs();
        return true;
      }
      return false;
    } catch {
      message.error('Failed to retry ingestion batch');
      return false;
    }
  };

  const triggerEmbeddings = async (payload: {
    partner_id: number;
    env: 'live' | 'test';
    ingest_log_id?: number | null;
    index_after?: boolean;
    only_pending?: boolean;
  }) => {
    try {
      const result = await triggerEmbeddingsJob(payload);
      if (result && result.status === 'accepted') {
        message.success(result.message || 'Embeddings generator job started');
        fetchProcessingJobs();
        return true;
      }
      return false;
    } catch {
      message.error('Failed to trigger embeddings generation job');
      return false;
    }
  };

  const pauseJob = async (jobId: number) => {
    try {
      const result = await pauseProcessingJob(jobId);
      if (result && result.status === 'accepted') {
        message.success(result.message || 'Job paused successfully');
        fetchProcessingJobs();
        return true;
      }
      return false;
    } catch {
      message.error('Failed to pause processing job');
      return false;
    }
  };

  const resumeJob = async (jobId: number, env: 'live' | 'test' = 'live', indexAfter: boolean = true) => {
    try {
      const result = await resumeProcessingJob(jobId, { env, index_after: indexAfter });
      if (result && result.status === 'accepted') {
        message.success(result.message || 'Job resumed successfully');
        fetchProcessingJobs();
        return true;
      }
      return false;
    } catch {
      message.error('Failed to resume processing job');
      return false;
    }
  };

  const getIngestLogDetail = async (logId: number): Promise<{ log: IngestLog; errors: IngestLogError[] } | null> => {
    try {
      const result = await getIngestLog(logId);
      if (result && result.log) {
        return { log: result.log, errors: result.errors || [] };
      }
      return null;
    } catch {
      message.error('Failed to fetch ingest log details');
      return null;
    }
  };

  const triggerPeaksSegments = async (stage: PeaksSegmentsStage, payload: {
    partner_id: number;
    env: 'live' | 'test';
    ingest_log_id?: number | null;
    only_pending?: boolean;
  }) => {
    try {
      const result = await triggerPeaksSegmentsJob(stage, payload);
      if (result && (result.status === 'accepted' || result.status === 'already_running')) {
        message.success(result.message || `${stage} job started`);
        fetchProcessingJobs();
        return true;
      }
      return false;
    } catch {
      message.error(`Failed to trigger ${stage} job`);
      return false;
    }
  };

  const refreshIngestLog = async (logId: number) => {
    try {
      const result = await refreshIngestLogStatus(logId);
      if (result && result.log) {
        // Update the log in-place in the list
        setIngestLogs(prev =>
          prev.map(l => l.id === logId ? result.log : l),
        );
        return result;
      }
      return null;
    } catch {
      message.error('Failed to refresh ingest log status');
      return null;
    }
  };

  const handleIngestPageChange = (page: number, pageSize: number) => {
    setIngestPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const handleJobsPageChange = (page: number, pageSize: number) => {
    setJobsPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  useEffect(() => {
    fetchIngestLogs();
  }, [fetchIngestLogs]);

  useEffect(() => {
    fetchProcessingJobs();
  }, [fetchProcessingJobs]);

  return {
    ingestLogs,
    ingestLoading,
    ingestPagination,
    processingJobs,
    jobsLoading,
    jobsPagination,
    partnerFilter,
    setPartnerFilter,
    ingestStatusFilter,
    setIngestStatusFilter,
    jobStatusFilter,
    setJobStatusFilter,
    fetchIngestLogs,
    fetchProcessingJobs,
    triggerIngest,
    retryIngest,
    triggerEmbeddings,
    triggerPeaksSegments,
    pauseJob,
    resumeJob,
    getIngestLogDetail,
    refreshIngestLog,
    handleIngestPageChange,
    handleJobsPageChange,
  };
}
