import { useState, useEffect } from 'react';
import { 
  Tabs, 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  Select, 
  Switch, 
  Tooltip, 
  Alert, 
  Progress,
  Typography,
  List,
  Input
} from 'antd';
import { 
  Play, 
  Pause,
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  GitBranch, 
  Cpu, 
  RefreshCw, 
  Eye,
  Loader2
} from 'lucide-react';
import { usePipeline, usePartners } from '@resomix/hooks';

const { Title, Text } = Typography;
const { Option } = Select;

function PipelinePage() {
  const [activeTab, setActiveTab] = useState('1');
  const [ingestModalVisible, setIngestModalVisible] = useState(false);
  const [embeddingsModalVisible, setEmbeddingsModalVisible] = useState(false);
  const [peaksSegmentsModalVisible, setPeaksSegmentsModalVisible] = useState(false);
  const [refreshingLogId, setRefreshingLogId] = useState<number | null>(null);
  
  // Row Error modal
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorLogDetails, setErrorLogDetails] = useState<any | null>(null);
  const [errorsLoading, setErrorsLoading] = useState(false);

  // Job Details modal
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  const [ingestForm] = Form.useForm();
  const [embeddingsForm] = Form.useForm();
  const [peaksSegmentsForm] = Form.useForm();

  // Load pipeline hooks
  const {
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
  } = usePipeline();

  // Load partners hook to populate partner select list
  const { partners, fetchPartners } = usePartners();

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const onTriggerIngest = async (values: any) => {
    const success = await triggerIngest(values.partner_id, values.env);
    if (success) {
      setIngestModalVisible(false);
      ingestForm.resetFields();
    }
  };

  const onTriggerEmbeddings = async (values: any) => {
    const success = await triggerEmbeddings({
      partner_id: values.partner_id,
      env: values.env,
      ingest_log_id: values.ingest_log_id ? parseInt(values.ingest_log_id, 10) : null,
      index_after: values.index_after ?? true,
      only_pending: values.only_pending ?? true,
    });
    if (success) {
      setEmbeddingsModalVisible(false);
      embeddingsForm.resetFields();
    }
  };

  const handleViewErrors = async (logId: number) => {
    setErrorsLoading(true);
    setErrorModalVisible(true);
    const result = await getIngestLogDetail(logId);
    if (result) {
      setErrorLogDetails(result);
    }
    setErrorsLoading(false);
  };

  const handleViewJobDetails = (job: any) => {
    setSelectedJob(job);
    setJobModalVisible(true);
  };

  // Active Polling when jobs or ingestion is in progress
  useEffect(() => {
    const hasActiveIngest = ingestLogs.some(log => log.status === 'PROCESSING');
    const hasActiveJob = processingJobs.some(job => job.status === 'running' || job.status === 'finalizing');
    
    if (hasActiveIngest || hasActiveJob) {
      const interval = setInterval(() => {
        if (hasActiveIngest) {
          fetchIngestLogs();
        }
        if (hasActiveJob) {
          fetchProcessingJobs();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [ingestLogs, processingJobs, fetchIngestLogs, fetchProcessingJobs]);

  const getPartnerName = (partnerId: number) => {
    const partner = partners.find(p => p.id === partnerId);
    return partner ? partner.display_name : `Partner #${partnerId}`;
  };

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

  const SyncIcon = () => (
    <span className="inline-block animate-spin mr-1">
      <RotateCw size={12} />
    </span>
  );

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
        return <Tag color="processing" icon={<SyncIcon />}>FINALIZING</Tag>;
      default:
        return <Tag color="default">{status.toUpperCase()}</Tag>;
    }
  };

  // Ingest logs columns
  const ingestColumns = [
    {
      title: 'Run ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: number) => <span className="font-mono text-xs">#{id}</span>
    },
    {
      title: 'Partner',
      dataIndex: 'partner_id',
      key: 'partner_id',
      render: (partnerId: number) => <Text strong>{getPartnerName(partnerId)}</Text>
    },
    {
      title: 'Party ID',
      dataIndex: 'party_id',
      key: 'party_id',
      render: (text: string) => text ? <span className="font-mono text-xs">{text}</span> : <Text className="text-secondary">—</Text>
    },
    {
      title: 'Filename',
      dataIndex: 'batch_filename',
      key: 'batch_filename',
      render: (text: string) => <span className="font-mono text-xs">{text}</span>
    },
    {
      title: 'Tracks count',
      dataIndex: 'track_count',
      key: 'track_count',
      align: 'center' as const,
      render: (count: number) => <Text>{count}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getIngestStatusTag(status)
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'N/A'
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
      render: (stage: string | null, _record: any) => {
        if (!stage) return <Text className="text-secondary">—</Text>;
        const stageColor = stage === 'READY' ? 'success' 
          : stage.startsWith('FAILED') ? 'error' 
          : 'processing';
        return <Tag color={stageColor} className="text-[10px]">{stage}</Tag>;
      }
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
                onClick={async () => {
                  setRefreshingLogId(record.id);
                  await refreshIngestLog(record.id);
                  setRefreshingLogId(null);
                }}
                className="flex items-center"
              />
            </Tooltip>
          )}
          {record.status === 'FAILED' && (
            <>
              <Tooltip title="View Error Details">
                <Button 
                  icon={<Eye size={14} />} 
                  onClick={() => handleViewErrors(record.id)}
                  className="flex items-center"
                />
              </Tooltip>
              <Tooltip title="Retry Batch Ingestion">
                <Button 
                  icon={<Play size={14} />} 
                  type="primary"
                  onClick={() => retryIngest(record.id)}
                  className="flex items-center"
                />
              </Tooltip>
            </>
          )}
        </Space>
      )
    }
  ];

  // Processing jobs columns
  const jobColumns = [
    {
      title: 'Job ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: number) => <span className="font-mono text-xs">#{id}</span>
    },
    {
      title: 'Partner',
      dataIndex: 'partner_id',
      key: 'partner_id',
      render: (partnerId: number) => <Text strong>{getPartnerName(partnerId)}</Text>
    },
    {
      title: 'Job Type',
      dataIndex: 'job_type',
      key: 'job_type',
      render: (type: string) => <Tag color="blue">{type.toUpperCase()}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getJobStatusTag(status)
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 250,
      render: (_: any, record: any) => {
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
      }
    },
    {
      title: 'Triggered By',
      dataIndex: 'triggered_by',
      key: 'triggered_by',
      render: (user: string) => user ? <Text className="text-secondary text-xs">{user}</Text> : <Text className="text-secondary">—</Text>
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'N/A'
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'running' && (
            <Tooltip title="Pause Job">
              <Button 
                icon={<Pause size={14} />} 
                onClick={() => pauseJob(record.id)}
                className="flex items-center"
              />
            </Tooltip>
          )}
          {record.status === 'paused' && (
            <Tooltip title="Resume Job">
              <Button 
                icon={<Play size={14} />} 
                type="primary"
                onClick={() => resumeJob(record.id)}
                className="flex items-center"
              />
            </Tooltip>
          )}
          <Tooltip title="View Job Details">
            <Button 
              icon={<Eye size={14} />} 
              onClick={() => handleViewJobDetails(record)}
              className="flex items-center"
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const items = [
    {
      key: '1',
      label: (
        <span className="flex items-center gap-2">
          <GitBranch size={16} />
          <span>SFTP Ingestion runs</span>
        </span>
      ),
      children: (
        <div className="py-4">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 items-center">
            <Space wrap size={16}>
              <Select
                placeholder="Filter by Partner"
                allowClear
                style={{ width: 200 }}
                value={partnerFilter}
                onChange={setPartnerFilter}
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
                onChange={setIngestStatusFilter}
              >
                <Option value="PENDING">Pending</Option>
                <Option value="PROCESSING">Processing</Option>
                <Option value="COMPLETED">Completed</Option>
                <Option value="FAILED">Failed</Option>
              </Select>
              <Button 
                icon={<RefreshCw size={14} />} 
                onClick={fetchIngestLogs}
                className="flex items-center gap-1"
              >
                Refresh
              </Button>
            </Space>

            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setIngestModalVisible(true)}
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
                onChange: handleIngestPageChange
              }}
            />
          </div>
        </div>
      )
    },
    {
      key: '2',
      label: (
        <span className="flex items-center gap-2">
          <Cpu size={16} />
          <span>Processing Jobs</span>
        </span>
      ),
      children: (
        <div className="py-4">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 items-center">
            <Space wrap size={16}>
              <Select
                placeholder="Filter by Partner"
                allowClear
                style={{ width: 200 }}
                value={partnerFilter}
                onChange={setPartnerFilter}
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
                onChange={setJobStatusFilter}
              >
                <Option value="pending">Pending</Option>
                <Option value="running">Running</Option>
                <Option value="completed">Completed</Option>
                <Option value="partial">Partial</Option>
                <Option value="failed">Failed</Option>
              </Select>
              <Button 
                icon={<RefreshCw size={14} />} 
                onClick={fetchProcessingJobs}
                className="flex items-center gap-1"
              >
                Refresh
              </Button>
            </Space>

            <Space wrap>
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => setEmbeddingsModalVisible(true)}
                className="flex items-center gap-1"
              >
                Trigger Embeddings Job
              </Button>
              <Button
                icon={<Plus size={16} />}
                onClick={() => setPeaksSegmentsModalVisible(true)}
                className="flex items-center gap-1"
              >
                Trigger Peaks / Segments
              </Button>
            </Space>
          </div>

          <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
            <Table
              columns={jobColumns}
              dataSource={processingJobs}
              rowKey="id"
              loading={jobsLoading}
              pagination={{
                current: jobsPagination.current,
                pageSize: jobsPagination.pageSize,
                total: jobsPagination.total,
                onChange: handleJobsPageChange
              }}
            />
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      <div className="mb-6">
        <Title level={2} className="!mb-1 !text-primary">Pipeline Status</Title>
        <Text className="text-secondary text-base">Monitor and control SFTP ingestion pipelines and embeddings generation jobs.</Text>
      </div>

      <div className="bg-surface border border-default rounded-xl p-4 md:p-6 shadow-sm">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
      </div>

      {/* Manual Ingestion Trigger Modal */}
      <Modal
        title="Trigger SFTP Ingestion"
        open={ingestModalVisible}
        onCancel={() => { setIngestModalVisible(false); ingestForm.resetFields(); }}
        onOk={() => ingestForm.submit()}
        okText="Trigger Run"
      >
        <Form form={ingestForm} layout="vertical" onFinish={onTriggerIngest} className="mt-4">
          <Form.Item
            name="partner_id"
            label={<Text strong>Select Partner</Text>}
            rules={[{ required: true, message: 'Please select a partner' }]}
          >
            <Select placeholder="Choose partner to ingest">
              {partners.map(p => (
                <Option key={p.id} value={p.id}>{p.display_name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="env" 
            label={<Text strong>Environment Run Mode</Text>}
            initialValue="live"
          >
            <Select>
              <Option value="live">Live (Persist tracks to DB & Media server)</Option>
              <Option value="test">Test Dry-Run (Validate files only, save nothing)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Manual Embeddings Job Trigger Modal */}
      <Modal
        title="Trigger Embeddings Generation"
        open={embeddingsModalVisible}
        onCancel={() => { setEmbeddingsModalVisible(false); embeddingsForm.resetFields(); }}
        onOk={() => embeddingsForm.submit()}
        okText="Start Job"
      >
        <Alert
          type="warning"
          showIcon
          message="Resource Intensive Operation"
          description="Generating embeddings is a CPU and memory intensive background operation that can run for an extended duration."
          className="mt-4 mb-2 rounded-xl"
        />
        <Form form={embeddingsForm} layout="vertical" onFinish={onTriggerEmbeddings} className="mt-4" initialValues={{ env: 'live', index_after: true, only_pending: true }}>
          <Form.Item
            name="partner_id"
            label={<Text strong>Select Partner</Text>}
            rules={[{ required: true, message: 'Please select a partner' }]}
          >
            <Select placeholder="Choose partner">
              {partners.map(p => (
                <Option key={p.id} value={p.id}>{p.display_name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="env" 
            label={<Text strong>Run Mode</Text>}
          >
            <Select>
              <Option value="live">Live (Save embeddings + Index into FAISS)</Option>
              <Option value="test">Test (Dry-run generate, nothing saved)</Option>
            </Select>
          </Form.Item>

          <Form.Item 
            name="ingest_log_id" 
            label={<Text strong>Ingest Log ID (Optional)</Text>}
            extra="Restrict embeddings generation to tracks from this specific ingest run. Leave blank to process all pending tracks."
          >
            <Input placeholder="e.g. 5" type="number" />
          </Form.Item>

          <div className="flex flex-col gap-4 border border-default p-4 rounded-xl bg-background-secondary mb-4">
            <Form.Item name="index_after" label="Automatically index into FAISS search engines" valuePropName="checked" className="!mb-0">
              <Switch />
            </Form.Item>

            <Form.Item name="only_pending" label="Skip tracks that already have embeddings" valuePropName="checked" className="!mb-0">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Peaks / Segments Job Trigger Modal */}
      <Modal
        title="Trigger Peaks / Segments Job"
        open={peaksSegmentsModalVisible}
        onCancel={() => { setPeaksSegmentsModalVisible(false); peaksSegmentsForm.resetFields(); }}
        onOk={() => peaksSegmentsForm.submit()}
        okText="Start Job"
      >
        <Alert
          type="info"
          showIcon
          message="Playback Asset Generation"
          description="Generates waveform peaks or HLS segments for partner tracks. Normally auto-spawned after transcode — use this for manual backfills."
          className="mt-4 mb-2 rounded-xl"
        />
        <Form
          form={peaksSegmentsForm}
          layout="vertical"
          className="mt-4"
          initialValues={{ stage: 'peaks', env: 'live', only_pending: true }}
          onFinish={async (values: any) => {
            const success = await triggerPeaksSegments(values.stage, {
              partner_id: values.partner_id,
              env: values.env,
              ingest_log_id: values.ingest_log_id ? parseInt(values.ingest_log_id, 10) : null,
              only_pending: values.only_pending ?? true,
            });
            if (success) {
              setPeaksSegmentsModalVisible(false);
              peaksSegmentsForm.resetFields();
            }
          }}
        >
          <Form.Item
            name="partner_id"
            label={<Text strong>Select Partner</Text>}
            rules={[{ required: true, message: 'Please select a partner' }]}
          >
            <Select placeholder="Choose partner">
              {partners.map(p => (
                <Option key={p.id} value={p.id}>{p.display_name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="stage"
            label={<Text strong>Job Stage</Text>}
          >
            <Select>
              <Option value="peaks">Peaks (Waveform data)</Option>
              <Option value="segments">Segments (HLS playback chunks)</Option>
            </Select>
          </Form.Item>

          <Form.Item 
            name="env" 
            label={<Text strong>Environment</Text>}
          >
            <Select>
              <Option value="live">Live</Option>
              <Option value="test">Test</Option>
            </Select>
          </Form.Item>

          <Form.Item 
            name="ingest_log_id" 
            label={<Text strong>Ingest Log ID (Optional)</Text>}
            extra="Restrict to tracks from one ingest batch. Leave blank for all pending tracks."
          >
            <Input placeholder="e.g. 5" type="number" />
          </Form.Item>

          <div className="flex flex-col gap-4 border border-default p-4 rounded-xl bg-background-secondary mb-4">
            <Form.Item name="only_pending" label="Skip tracks whose asset already exists" valuePropName="checked" className="!mb-0">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Ingestion Errors Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle size={20} />
            <span>Ingestion Row Errors (Run #{errorLogDetails?.log?.id})</span>
          </div>
        }
        open={errorModalVisible}
        onCancel={() => { setErrorModalVisible(false); setErrorLogDetails(null); }}
        footer={[
          <Button key="close" onClick={() => { setErrorModalVisible(false); setErrorLogDetails(null); }}>Close</Button>
        ]}
        width={750}
      >
        {errorsLoading ? (
          <div className="flex items-center justify-center py-12">
            <RotateCw size={24} className="animate-spin text-primary" />
          </div>
        ) : errorLogDetails && errorLogDetails.errors && errorLogDetails.errors.length > 0 ? (
          <div className="py-4">
            <Alert 
              type="error" 
              showIcon 
              message={`The metadata CSV batch failed with ${errorLogDetails.errors.length} parsing errors.`}
              className="mb-4 rounded-xl"
            />
            <div className="max-h-[350px] overflow-y-auto border border-default rounded-xl bg-background-secondary p-2">
              <List
                dataSource={errorLogDetails.errors}
                renderItem={(err: any) => (
                  <List.Item className="border-b border-default last:border-0 p-3">
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex justify-between">
                        <Text strong className="text-red-500 font-mono text-xs">{err.error_code}</Text>
                        <Tag color={err.error_severity === 'CRITICAL' ? 'red' : 'orange'}>{err.error_severity}</Tag>
                      </div>
                      <Text className="text-primary text-sm">{err.error_message}</Text>
                      {err.reference_node && (
                        <Text className="text-[10px] text-secondary font-mono">Reference Row: {err.reference_node}</Text>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-secondary">
            No errors returned for this log batch run.
          </div>
        )}
      </Modal>

      {/* Job Details Inspector Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary">
            <Cpu size={20} />
            <span>Job Details (Job #{selectedJob?.id})</span>
          </div>
        }
        open={jobModalVisible}
        onCancel={() => { setJobModalVisible(false); setSelectedJob(null); }}
        footer={[
          <Button key="close" onClick={() => { setJobModalVisible(false); setSelectedJob(null); }}>Close</Button>
        ]}
        width={650}
      >
        {selectedJob && (() => {
          const total = selectedJob.total_tracks || 0;
          const processed = selectedJob.processed_tracks || 0;
          const failed = selectedJob.failed_tracks || 0;
          const percent = total > 0 ? Math.round(((processed + failed) / total) * 100) : 0;
          
          const getErrorDescription = (err: any) => {
            if (!err) return "No detailed error logs were reported by the backend worker.";
            return typeof err === 'object' 
              ? "See system error logs below for detailed JSON feedback." 
              : err;
          };

          return (
            <div className="py-4 flex flex-col gap-6">
              {/* Status & Metadata Alert */}
              {selectedJob.status === 'failed' && (
                <Alert 
                  type="error"
                  showIcon
                  message="This processing job failed to complete successfully."
                  description={getErrorDescription(selectedJob.error_details)}
                  className="rounded-xl"
                />
              )}

              {selectedJob.status === 'paused' && (
                <Alert 
                  type="warning"
                  showIcon
                  message="This processing job is currently paused."
                  description="You can resume this job from the actions menu."
                  className="rounded-xl"
                />
              )}

              {selectedJob.status === 'partial' && (
                <Alert 
                  type="warning"
                  showIcon
                  message="This processing job completed with partial failures."
                  description={getErrorDescription(selectedJob.error_details)}
                  className="rounded-xl"
                />
              )}

              {selectedJob.status === 'completed' && (
                <Alert 
                  type="success"
                  showIcon
                  message="Job completed successfully!"
                  className="rounded-xl"
                />
              )}

              {selectedJob.status === 'finalizing' && (
                <Alert 
                  type="info"
                  showIcon
                  message="Finalizing — media work is done, applying per-track results."
                  description="This is a transient state. The job will complete shortly."
                  className="rounded-xl"
                />
              )}

              {/* Main info panel */}
              <div className="grid grid-cols-2 gap-6 border border-default p-4 rounded-xl bg-background-secondary">
                <div>
                  <Text className="text-secondary text-[10px] uppercase block font-semibold mb-0.5">Partner</Text>
                  <Text strong className="text-sm text-primary">{getPartnerName(selectedJob.partner_id)}</Text>
                </div>

                <div>
                  <Text className="text-secondary text-[10px] uppercase block font-semibold mb-0.5">Job Type</Text>
                  <Tag color="blue" className="uppercase font-mono text-xs">{selectedJob.job_type}</Tag>
                </div>

                <div>
                  <Text className="text-secondary text-[10px] uppercase block font-semibold mb-0.5">Status</Text>
                  <span className="mt-0.5 block">{getJobStatusTag(selectedJob.status)}</span>
                </div>

                <div>
                  <Text className="text-secondary text-[10px] uppercase block font-semibold mb-0.5">Triggered By</Text>
                  <Text className="text-sm font-medium">{selectedJob.triggered_by || 'System Automatic'}</Text>
                </div>

                <div>
                  <Text className="text-secondary text-[10px] uppercase block font-semibold mb-0.5">Ingest Run Reference</Text>
                  <Text className="text-sm font-mono">{selectedJob.ingest_log_id ? `#${selectedJob.ingest_log_id}` : 'All pending tracks'}</Text>
                </div>
              </div>

              {/* Progress breakdown */}
              <div>
                <Title level={5} className="!mb-2 !text-primary">Progress Breakdown</Title>
                <div className="border border-default p-4 rounded-xl bg-surface">
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <Text className="text-secondary">Overall Progress</Text>
                      <Text strong className="text-primary">{percent}%</Text>
                    </div>
                    <Progress 
                      percent={percent} 
                      status={selectedJob.status === 'failed' ? 'exception' : selectedJob.status === 'completed' ? 'success' : 'active'}
                      size="small"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center mt-2">
                    <div className="border-r border-default">
                      <Text className="text-secondary text-[10px] uppercase block">Total Tracks</Text>
                      <Text strong className="text-lg text-primary">{total}</Text>
                    </div>
                    <div className="border-r border-default">
                      <Text className="text-secondary text-[10px] uppercase block">Processed</Text>
                      <Text strong className="text-lg text-success">{processed}</Text>
                    </div>
                    <div>
                      <Text className="text-secondary text-[10px] uppercase block">Failed</Text>
                      <Text strong className={`text-lg ${failed > 0 ? 'text-red-500' : 'text-secondary'}`}>{failed}</Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timing analysis */}
              <div>
                <Title level={5} className="!mb-2 !text-primary">Timing Analysis</Title>
                <div className="border border-default p-4 rounded-xl bg-surface flex flex-col gap-3">
                  <div className="flex justify-between text-sm">
                    <Text className="text-secondary">Created At:</Text>
                    <Text className="text-primary font-medium">{new Date(selectedJob.created_at).toLocaleString()}</Text>
                  </div>
                  <div className="flex justify-between text-sm">
                    <Text className="text-secondary">Started At:</Text>
                    <Text className="text-primary font-medium">
                      {selectedJob.started_at ? new Date(selectedJob.started_at).toLocaleString() : 'Pending start...'}
                    </Text>
                  </div>
                  <div className="flex justify-between text-sm">
                    <Text className="text-secondary">Completed At:</Text>
                    <Text className="text-primary font-medium">
                      {selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleString() : 'In progress/incomplete'}
                    </Text>
                  </div>
                  {selectedJob.finalizing_at && (
                    <div className="flex justify-between text-sm">
                      <Text className="text-secondary">Finalizing At:</Text>
                      <Text className="text-primary font-medium">
                        {new Date(selectedJob.finalizing_at).toLocaleString()}
                      </Text>
                    </div>
                  )}
                  {selectedJob.started_at && selectedJob.completed_at && (
                    <div className="flex justify-between text-sm border-t border-default pt-2 mt-1">
                      <Text strong className="text-secondary">Total Duration:</Text>
                      <Text strong className="text-indigo-500">
                        {(() => {
                          const start = new Date(selectedJob.started_at).getTime();
                          const end = new Date(selectedJob.completed_at).getTime();
                          const diffSecs = Math.floor((end - start) / 1000);
                          if (diffSecs < 60) return `${diffSecs}s`;
                          const mins = Math.floor(diffSecs / 60);
                          const secs = diffSecs % 60;
                          return `${mins}m ${secs}s`;
                        })()}
                      </Text>
                    </div>
                  )}
                </div>
              </div>

              {/* Error logs raw container if present */}
              {selectedJob.error_details && (
                <div>
                  <Title level={5} className="!mb-2 !text-red-500">System Error Logs</Title>
                  <div className="max-h-[250px] overflow-y-auto border border-red-200 dark:border-red-900 rounded-xl bg-red-50 dark:bg-red-950 p-3 font-mono text-xs text-red-600 dark:text-red-300">
                    <pre className="whitespace-pre-wrap m-0 font-mono">
                      {typeof selectedJob.error_details === 'object' 
                        ? JSON.stringify(selectedJob.error_details, null, 2) 
                        : selectedJob.error_details}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

export default PipelinePage;
