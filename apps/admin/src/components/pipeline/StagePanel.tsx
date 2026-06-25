import { 
  Table, 
  Button, 
  Tag, 
  Space, 
  Alert, 
  Progress, 
  Typography,
  Tooltip,
  Select,
} from 'antd';
import { 
  Play, 
  Pause, 
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Eye,
  Loader2,
  RefreshCw,
  Plus,
  Zap,
} from 'lucide-react';
import type { PipelineStage, StageInfo } from './pipelineUtils.js';
import { getStatusStyle, getStatusTagColor, estimateEta, formatDuration } from './pipelineUtils.js';
import type { ProcessingJob, IngestLog } from '@resomix/api-client';

const { Text } = Typography;
const { Option } = Select;

const STAGES_ORDER = [
  'RECEIVED',
  'VALIDATING',
  'MOVED',
  'PERSISTING',
  'TRANSCODING',
  'INGESTED',
  'EMBEDDING',
  'INDEXED',
  'FINALIZING',
  'READY',
];


// ─── Props ────────────────────────────────────────────────────

interface StagePanelProps {
  stage: StageInfo;
  // Ingestion-specific data
  ingestLogs: IngestLog[];
  ingestLoading: boolean;
  ingestPagination: { current: number; pageSize: number; total: number };
  onIngestPageChange: (page: number, pageSize: number) => void;
  onTriggerIngest: () => void;
  onRetryIngest: (logId: number) => void;
  onViewIngestErrors: (logId: number) => void;
  onRefreshIngestLog: (logId: number) => Promise<void>;
  refreshingLogId: number | null;
  // Processing jobs data (for transcode/embeddings/peaks/segments)
  jobs: ProcessingJob[];
  jobsLoading: boolean;
  jobsPagination: { current: number; pageSize: number; total: number };
  onJobsPageChange: (page: number, pageSize: number) => void;
  // Job actions
  onPauseJob: (jobId: number) => void;
  onResumeJob: (jobId: number) => void;
  onViewJobDetails: (job: ProcessingJob) => void;
  onRefreshJobs: () => void;
  onReTriggerJob?: (job: ProcessingJob) => void;
  // Trigger actions
  onTriggerEmbeddings: () => void;
  onTriggerPeaksSegments: () => void;
  // Partner lookup
  getPartnerName: (partnerId: number) => string;
  // Partners list for filter
  partners: Array<{ id: number; display_name: string }>;
  partnerFilter: number | undefined;
  onPartnerFilterChange: (value: number | undefined) => void;
  // Status filter
  ingestStatusFilter: string | undefined;
  onIngestStatusFilterChange: (value: string | undefined) => void;
  jobStatusFilter: string | undefined;
  onJobStatusFilterChange: (value: string | undefined) => void;
  // Ingest log refresh
  onRefreshIngestLogs: () => void;
  // Selected ingest log for detailed timeline view
  selectedLog?: IngestLog | null;
}


// ─── Sync Icon ────────────────────────────────────────────────

const SyncIcon = () => (
  <span className="inline-block animate-spin mr-1">
    <RotateCw size={12} />
  </span>
);

// ─── Status Header ────────────────────────────────────────────

function StageHeader({ stage }: { stage: StageInfo }) {
  const style = getStatusStyle(stage.status);
  const job = stage.latestJob;
  const eta = job ? estimateEta(job) : null;

  return (
    <div className="border border-default rounded-xl p-4 mb-4 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Status badge + label */}
        <div className="flex items-center gap-3">
          <Tag
            color={getStatusTagColor(stage.status)}
            className="text-xs font-semibold px-3 py-0.5 rounded-full uppercase"
          >
            {style.label}
          </Tag>
          <Text className="text-primary text-base font-semibold">{stage.label} Stage</Text>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-center">
            <Text className="text-secondary text-[10px] uppercase font-semibold">Total</Text>
            <Text strong className="text-primary text-lg">{stage.total}</Text>
          </div>
          <div className="flex flex-col items-center">
            <Text className="text-secondary text-[10px] uppercase font-semibold">Done</Text>
            <Text strong className="text-lg text-emerald-500">{stage.processed}</Text>
          </div>
          <div className="flex flex-col items-center">
            <Text className="text-secondary text-[10px] uppercase font-semibold">Failed</Text>
            <Text strong className={`text-lg ${stage.failed > 0 ? 'text-red-500' : 'text-secondary'}`}>
              {stage.failed}
            </Text>
          </div>
          {eta && (
            <div className="flex flex-col items-center">
              <Text className="text-secondary text-[10px] uppercase font-semibold">ETA</Text>
              <Text strong className="text-lg text-blue-500">{eta}</Text>
            </div>
          )}
        </div>

        {/* Timing */}
        {job && (
          <div className="flex items-center gap-4 text-xs text-secondary">
            {job.started_at && (
              <span>Started: {new Date(job.started_at).toLocaleString()}</span>
            )}
            {job.completed_at && job.started_at && (
              <span className="text-indigo-500 font-medium">
                Duration: {formatDuration(job.started_at, job.completed_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress bar for active jobs */}
      {stage.total > 0 && ['running', 'finalizing'].includes(stage.status) && (
        <div className="mt-3">
          <Progress
            percent={Math.round(((stage.processed + stage.failed) / stage.total) * 100)}
            status="active"
            size="small"
            strokeColor={style.color}
          />
        </div>
      )}

      {/* Halted banner */}
      {stage.status === 'halted' && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle size={16} />}
          message={
            <span className="font-semibold">
              Pipeline halted — {stage.total > 0 ? `${((stage.failed / stage.total) * 100).toFixed(1)}%` : 'N/A'} failure rate exceeds 5% threshold
            </span>
          }
          description="Review the failed tracks below. You can retry failed items or proceed manually."
          className="mt-3 rounded-xl"
        />
      )}

      {/* Skipped banner */}
      {stage.isSkipped && (
        <Alert
          type="info"
          showIcon
          message="This stage is not enabled for this partner configuration"
          description="Peaks and Segments are only generated for partners with the similarity_playback access level."
          className="mt-3 rounded-xl"
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function StagePanel(props: StagePanelProps) {
  const { stage } = props;

  if (stage.isSkipped) {
    return (
      <div className="py-4">
        <StageHeader stage={stage} />
        <div className="text-center py-12 text-secondary">
          This stage is skipped for the current partner configuration.
        </div>
      </div>
    );
  }

  if (stage.id === 'ingestion') {
    return <IngestionPanel {...props} />;
  }

  return <ProcessingPanel {...props} />;
}

// ─── Ingestion Panel ──────────────────────────────────────────

function IngestionPanel(props: StagePanelProps) {
  const {
    stage,
    ingestLogs,
    ingestLoading,
    ingestPagination,
    onIngestPageChange,
    onTriggerIngest,
    onRetryIngest,
    onViewIngestErrors,
    onRefreshIngestLog,
    refreshingLogId,
    getPartnerName,
    partners,
    partnerFilter,
    onPartnerFilterChange,
    ingestStatusFilter,
    onIngestStatusFilterChange,
    onRefreshIngestLogs,
    selectedLog,
  } = props;


  const getIngestStatusTag = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Tag color="success" icon={<CheckCircle2 size={12} className="inline mr-1" />}>COMPLETED</Tag>;
      case 'FAILED':
        return <Tag color="error" icon={<AlertTriangle size={12} className="inline mr-1" />}>FAILED</Tag>;
      case 'PROCESSING':
        return <Tag color="processing" icon={<SyncIcon />}>PROCESSING</Tag>;
      default:
        return <Tag color="default" icon={<Clock size={12} className="inline mr-1" />}>{status}</Tag>;
    }
  };

  const ingestColumns = [
    {
      title: 'Run ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: number) => <span className="font-mono text-xs">#{id}</span>,
    },
    {
      title: 'Partner',
      dataIndex: 'partner_id',
      key: 'partner_id',
      render: (partnerId: number) => <Text strong>{getPartnerName(partnerId)}</Text>,
    },
    {
      title: 'Party ID',
      dataIndex: 'party_id',
      key: 'party_id',
      render: (text: string) => text ? <span className="font-mono text-xs">{text}</span> : <Text className="text-secondary">—</Text>,
    },
    {
      title: 'Filename',
      dataIndex: 'batch_filename',
      key: 'batch_filename',
      render: (text: string) => <span className="font-mono text-xs">{text}</span>,
    },
    {
      title: 'Tracks',
      dataIndex: 'track_count',
      key: 'track_count',
      align: 'center' as const,
      render: (count: number) => <Text>{count}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getIngestStatusTag(status),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
      render: (stageVal: string | null) => {
        if (!stageVal) return <Text className="text-secondary">—</Text>;
        const stageColor = stageVal === 'READY' ? 'success'
          : stageVal.startsWith('FAILED') ? 'error'
          : 'processing';
        return <Tag color={stageColor} className="text-[10px]">{stageVal}</Tag>;
      },
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'PROCESSING' && (
            <Tooltip title="Force Refresh Status">
              <Button
                icon={refreshingLogId === record.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <RefreshCw size={14} />}
                disabled={refreshingLogId === record.id}
                onClick={async () => { await onRefreshIngestLog(record.id); }}
                className="flex items-center"
              />
            </Tooltip>
          )}
          {record.status === 'FAILED' && (
            <>
              <Tooltip title="View Error Details">
                <Button
                  icon={<Eye size={14} />}
                  onClick={() => onViewIngestErrors(record.id)}
                  className="flex items-center"
                />
              </Tooltip>
              <Tooltip title="Retry Batch Ingestion">
                <Button
                  icon={<Play size={14} />}
                  type="primary"
                  onClick={() => onRetryIngest(record.id)}
                  className="flex items-center"
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="py-4">
      <StageHeader stage={stage} />

      {/* Ingest Stage Timeline */}
      {selectedLog && (
        <div className="macro-timeline-container shadow-sm border border-default rounded-xl p-6 bg-surface mb-6">
          <div className="macro-timeline-header flex justify-between items-center mb-4 pb-3 border-b border-default">
            <div>
              <Text className="text-secondary text-xs uppercase font-semibold block mb-0.5">Ingest Run Timeline</Text>
              <Text strong className="text-primary text-base">Run #{selectedLog.id} ({getPartnerName(selectedLog.partner_id)})</Text>
            </div>
            <div className="text-right">
              <Text className="text-secondary text-xs block">Current Stage</Text>
              <Tag color={selectedLog.stage === 'READY' ? 'success' : selectedLog.stage?.startsWith('FAILED') ? 'error' : 'processing'} className="m-0 font-semibold text-xs">
                {selectedLog.stage || 'RECEIVED'}
              </Tag>
            </div>
          </div>
          
          <div className="macro-timeline-steps flex items-center justify-between gap-2 overflow-x-auto py-4">
            {STAGES_ORDER.map((stageName, index) => {
              const currentStage = selectedLog.stage || 'RECEIVED';
              const timelineMap = selectedLog.stage_timeline || {};
              const isFailed = currentStage.startsWith('FAILED') || selectedLog.status === 'FAILED';
              
              let stepStatus: 'completed' | 'active' | 'failed' | 'pending' = 'pending';
              
              if (timelineMap[stageName]) {
                stepStatus = 'completed';
              } else if (currentStage === stageName) {
                stepStatus = isFailed ? 'failed' : 'active';
              } else if (isFailed) {
                // If failed, highlight the failure point
                const enteredStages = Object.keys(timelineMap);
                const lastEnteredIndex = enteredStages.length > 0
                  ? STAGES_ORDER.indexOf(enteredStages[enteredStages.length - 1])
                  : -1;
                const failureIndex = lastEnteredIndex + 1;
                if (currentStage === 'FAILED_VALIDATION' && stageName === 'VALIDATING') {
                  stepStatus = 'failed';
                } else if (index === failureIndex) {
                  stepStatus = 'failed';
                }
              }
              
              const stepTime = timelineMap[stageName];
              
              return (
                <div key={stageName} className={`macro-timeline-step ${stepStatus}`}>
                  <div className="macro-timeline-dot" />
                  <div className="macro-timeline-connector" />
                  <span className="macro-timeline-label">{stageName}</span>
                  {stepTime && (
                    <span className="macro-timeline-time">
                      {new Date(stepTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter bar + action */}
      <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 items-center">

        <Space wrap size={16}>
          <Select
            placeholder="Filter by Partner"
            allowClear
            style={{ width: 200 }}
            value={partnerFilter}
            onChange={onPartnerFilterChange}
          >
            {partners.map(p => (
              <Option key={p.id} value={p.id}>{p.display_name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Filter by Status"
            allowClear
            style={{ width: 180 }}
            value={ingestStatusFilter}
            onChange={onIngestStatusFilterChange}
          >
            <Option value="PENDING">Pending</Option>
            <Option value="PROCESSING">Processing</Option>
            <Option value="COMPLETED">Completed</Option>
            <Option value="FAILED">Failed</Option>
          </Select>
          <Button
            icon={<RefreshCw size={14} />}
            onClick={onRefreshIngestLogs}
            className="flex items-center gap-1"
          >
            Refresh
          </Button>
        </Space>

        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={onTriggerIngest}
          className="flex items-center gap-1"
        >
          Trigger Ingestion
        </Button>
      </div>

      <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
        <Table
          columns={ingestColumns}
          dataSource={ingestLogs}
          rowKey="id"
          loading={ingestLoading}
          pagination={{
            current: ingestPagination.current,
            pageSize: ingestPagination.pageSize,
            total: ingestPagination.total,
            onChange: onIngestPageChange,
          }}
        />
      </div>
    </div>
  );
}

// ─── Processing Jobs Panel ────────────────────────────────────

function ProcessingPanel(props: StagePanelProps) {
  const {
    stage,
    jobs,
    jobsLoading,
    jobsPagination,
    onJobsPageChange,
    onPauseJob,
    onResumeJob,
    onViewJobDetails,
    onRefreshJobs,
    onReTriggerJob,
    onTriggerEmbeddings,
    onTriggerPeaksSegments,
    getPartnerName,
    partners,
    partnerFilter,
    onPartnerFilterChange,
    jobStatusFilter,
    onJobStatusFilterChange,
  } = props;


  // Filter jobs by stage type
  const stageJobTypeMap: Record<PipelineStage, string> = {
    ingestion: '',
    transcode: 'transcode',
    embeddings: 'embeddings',
    peaks: 'peaks',
    segments: 'segments',
  };

  const filteredJobs = jobs.filter(j => j.job_type === stageJobTypeMap[stage.id]);

  const getJobStatusTag = (status: string) => {
    switch (status) {
      case 'completed':
        return <Tag color="success">COMPLETED</Tag>;
      case 'failed':
        return <Tag color="error">FAILED</Tag>;
      case 'partial':
        return <Tag color="warning">PARTIAL</Tag>;
      case 'running':
        return <Tag color="processing" icon={<SyncIcon />}>RUNNING</Tag>;
      case 'paused':
        return <Tag color="orange">PAUSED</Tag>;
      case 'finalizing':
        return <Tag color="purple" icon={<SyncIcon />}>FINALIZING</Tag>;
      default:
        return <Tag color="default">{status.toUpperCase()}</Tag>;
    }
  };

  const jobColumns = [
    {
      title: 'Job ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: number) => <span className="font-mono text-xs">#{id}</span>,
    },
    {
      title: 'Partner',
      dataIndex: 'partner_id',
      key: 'partner_id',
      render: (partnerId: number) => <Text strong>{getPartnerName(partnerId)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getJobStatusTag(status),
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 250,
      render: (_: any, record: ProcessingJob) => {
        const total = record.total_tracks || 0;
        const processed = record.processed_tracks || 0;
        const failed = record.failed_tracks || 0;
        const percent = total > 0 ? Math.round(((processed + failed) / total) * 100) : 0;

        return (
          <div className="flex flex-col gap-1 w-full">
            <Progress
              percent={percent}
              size="small"
              status={record.status === 'failed' ? 'exception' : record.status === 'paused' ? 'normal' : percent === 100 ? 'success' : 'active'}
            />
            <div className="flex justify-between text-[10px] text-secondary">
              <span>Processed: {processed}/{total}</span>
              {failed > 0 && <span className="text-red-500 font-medium">Failed: {failed}</span>}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Triggered By',
      dataIndex: 'triggered_by',
      key: 'triggered_by',
      render: (user: string) => user ? <Text className="text-secondary text-xs">{user}</Text> : <Text className="text-secondary">—</Text>,
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: ProcessingJob) => (
        <Space>
          {record.status === 'running' && (
            <Tooltip title="Pause Job">
              <Button
                icon={<Pause size={14} />}
                onClick={() => onPauseJob(record.id)}
                className="flex items-center"
              />
            </Tooltip>
          )}
          {record.status === 'paused' && record.job_type === 'embeddings' && (
            <Tooltip title="Resume Job">
              <Button
                icon={<Play size={14} />}
                type="primary"
                onClick={() => onResumeJob(record.id)}
                className="flex items-center"
              />
            </Tooltip>
          )}
          {record.status === 'paused' && record.job_type !== 'embeddings' && onReTriggerJob && (
            <Tooltip title="Re-trigger Job">
              <Button
                icon={<Play size={14} />}
                type="primary"
                onClick={() => onReTriggerJob(record)}
                className="flex items-center"
              />
            </Tooltip>
          )}
          {record.status === 'failed' && onReTriggerJob && (
            <Tooltip title="Re-trigger Failed Job">
              <Button
                icon={<RotateCw size={14} />}
                onClick={() => onReTriggerJob(record)}
                className="flex items-center"
              />
            </Tooltip>
          )}
          <Tooltip title="View Job Details">
            <Button
              icon={<Eye size={14} />}
              onClick={() => onViewJobDetails(record)}
              className="flex items-center"
            />
          </Tooltip>
        </Space>
      ),
    },

  ];

  // Determine which trigger button(s) to show
  const renderTriggerButton = () => {
    switch (stage.id) {
      case 'embeddings':
        return (
          <Button
            type="primary"
            icon={<Zap size={16} />}
            onClick={onTriggerEmbeddings}
            className="flex items-center gap-1"
          >
            Trigger Embeddings Job
          </Button>
        );
      case 'peaks':
      case 'segments':
        return (
          <Button
            type="primary"
            icon={<Zap size={16} />}
            onClick={onTriggerPeaksSegments}
            className="flex items-center gap-1"
          >
            Trigger {stage.label} Job
          </Button>
        );
      case 'transcode':
        return (
          <Tag color="blue" className="text-xs">
            Auto-spawned after ingestion
          </Tag>
        );
      default:
        return null;
    }
  };

  return (
    <div className="py-4">
      <StageHeader stage={stage} />

      {/* Filter bar + actions */}
      <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 items-center">
        <Space wrap size={16}>
          <Select
            placeholder="Filter by Partner"
            allowClear
            style={{ width: 200 }}
            value={partnerFilter}
            onChange={onPartnerFilterChange}
          >
            {partners.map(p => (
              <Option key={p.id} value={p.id}>{p.display_name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Filter by Status"
            allowClear
            style={{ width: 180 }}
            value={jobStatusFilter}
            onChange={onJobStatusFilterChange}
          >
            <Option value="pending">Pending</Option>
            <Option value="running">Running</Option>
            <Option value="completed">Completed</Option>
            <Option value="partial">Partial</Option>
            <Option value="failed">Failed</Option>
          </Select>
          <Button
            icon={<RefreshCw size={14} />}
            onClick={onRefreshJobs}
            className="flex items-center gap-1"
          >
            Refresh
          </Button>
        </Space>

        {renderTriggerButton()}
      </div>

      <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
        <Table
          columns={jobColumns}
          dataSource={filteredJobs}
          rowKey="id"
          loading={jobsLoading}
          pagination={{
            current: jobsPagination.current,
            pageSize: jobsPagination.pageSize,
            total: filteredJobs.length,
            onChange: onJobsPageChange,
          }}
        />
      </div>
    </div>
  );
}
