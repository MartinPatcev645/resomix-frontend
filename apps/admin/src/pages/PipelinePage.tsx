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
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  GitBranch, 
  Cpu, 
  RefreshCw, 
  Eye 
} from 'lucide-react';
import { usePipeline, usePartners } from '@resomix/hooks';

const { Title, Text } = Typography;
const { Option } = Select;

function PipelinePage() {
  const [activeTab, setActiveTab] = useState('1');
  const [ingestModalVisible, setIngestModalVisible] = useState(false);
  const [embeddingsModalVisible, setEmbeddingsModalVisible] = useState(false);
  
  // Row Error modal
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorLogDetails, setErrorLogDetails] = useState<any | null>(null);
  const [errorsLoading, setErrorsLoading] = useState(false);

  const [ingestForm] = Form.useForm();
  const [embeddingsForm] = Form.useForm();

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
    getIngestLogDetail,
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
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
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
              status={record.status === 'failed' ? 'exception' : percent === 100 ? 'success' : 'active'}
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
          <span>Embeddings Processing Jobs</span>
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

            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={() => setEmbeddingsModalVisible(true)}
              className="flex items-center gap-1"
            >
              Trigger Embeddings Job
            </Button>
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
    </div>
  );
}

export default PipelinePage;
