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
  Input, 
  Tooltip, 
  Alert, 
  Card,
  DatePicker,
  Typography,
  Descriptions,
  InputNumber
} from 'antd';
import { 
  Logs, 
  Globe, 
  Settings, 
  RotateCw, 
  Play, 
  Eye, 
  Database,
  Ticket
} from 'lucide-react';
import { useAdminLogs, usePipeline, usePartners } from '@resomix/hooks';

const { Title, Text } = Typography;
const { Option } = Select;

function LogsPage() {
  const [activeTab, setActiveTab] = useState('1');
  const [modal, modalContextHolder] = Modal.useModal();

  // Failed webhook details modal
  const [webhookDetailVisible, setWebhookDetailVisible] = useState(false);
  const [selectedWebhookLog, setSelectedWebhookLog] = useState<any | null>(null);

  // Rebuild index loading
  const [rebuildLoading, setRebuildLoading] = useState(false);

  const [promoForm] = Form.useForm();

  // Load hooks
  const {
    webhookLogs,
    logsLoading: webhooksLoading,
    fetchWebhookLogs,
    retryWebhook,
    rebuildIndex,
    createPromo,
  } = useAdminLogs();

  // Load pipeline ingest logs
  const {
    ingestLogs,
    ingestLoading,
    fetchIngestLogs
  } = usePipeline();

  // Load partners hook to match IDs with names
  const { partners, fetchPartners } = usePartners();

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleViewWebhookDetail = (log: any) => {
    setSelectedWebhookLog(log);
    setWebhookDetailVisible(true);
  };

  const handleRetryWebhook = async (logId: number) => {
    await retryWebhook(logId);
  };

  const handleRebuildIndex = () => {
    modal.confirm({
      title: 'Rebuild Similarity Search Index',
      content: (
        <div className="mt-2 flex flex-col gap-2">
          <Text>Are you sure you want to rebuild the similarity FAISS index? This is a high-memory, CPU-intensive background operation.</Text>
          <Alert 
            type="warning" 
            showIcon 
            message="This should only be run if search indices are corrupted or sync is broken." 
            className="rounded-xl mt-2"
          />
        </div>
      ),
      okText: 'Rebuild Index',
      okType: 'danger',
      onOk: async () => {
        setRebuildLoading(true);
        await rebuildIndex();
        setRebuildLoading(false);
      },
    });
  };

  const handleCreatePromo = async (values: any) => {
    const payload = {
      code: values.code,
      discount_type: values.discount_type,
      discount_value: Number(values.discount_value),
      max_uses: values.max_uses ? Number(values.max_uses) : undefined,
      expires_at: values.expires_at ? values.expires_at.format('YYYY-MM-DDTHH:mm:ss') : undefined
    };

    const success = await createPromo(payload);
    if (success) {
      promoForm.resetFields();
    }
  };

  const getPartnerName = (partnerId: number) => {
    const partner = partners.find(p => p.id === partnerId);
    return partner ? partner.display_name : `Partner #${partnerId}`;
  };

  // Webhooks table columns
  const webhookColumns = [
    {
      title: 'Log ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: number) => <span className="font-mono text-xs">#{id}</span>
    },
    {
      title: 'Webhook ID',
      dataIndex: 'webhook_id',
      key: 'webhook_id',
      width: 110,
      render: (id: number) => <span className="font-mono text-xs">#{id}</span>
    },
    {
      title: 'Event Type',
      dataIndex: 'event_type',
      key: 'event_type',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Status Code',
      dataIndex: 'response_status',
      key: 'response_status',
      width: 120,
      render: (code: number) => (
        <Tag color={code >= 500 ? 'red' : 'orange'}>
          {code || 'No Response'}
        </Tag>
      )
    },
    {
      title: 'Failures',
      dataIndex: 'consecutive_failures',
      key: 'consecutive_failures',
      width: 100,
      align: 'center' as const,
      render: (count: number) => <Text className="font-semibold text-red-500">{count}</Text>
    },
    {
      title: 'Delivered At',
      dataIndex: 'delivered_at',
      key: 'delivered_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'N/A'
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="View Payload & Response Body">
            <Button 
              icon={<Eye size={14} />} 
              onClick={() => handleViewWebhookDetail(record)}
              className="flex items-center"
            />
          </Tooltip>
          <Tooltip title="Retry Delivery">
            <Button 
              icon={<Play size={14} />} 
              type="primary"
              onClick={() => handleRetryWebhook(record.id)}
              className="flex items-center"
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // Ingestion history columns
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
      title: 'Filename',
      dataIndex: 'batch_filename',
      key: 'batch_filename',
      render: (text: string) => <span className="font-mono text-xs">{text}</span>
    },
    {
      title: 'Track count',
      dataIndex: 'track_count',
      key: 'track_count',
      align: 'center' as const,
      render: (count: number) => <Text>{count}</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'error' : 'processing'}>
          {status}
        </Tag>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'N/A'
    }
  ];

  const items = [
    {
      key: '1',
      label: (
        <span className="flex items-center gap-2">
          <Globe size={16} />
          <span>Failed Webhook Deliveries</span>
        </span>
      ),
      children: (
        <div className="py-4">
          <div className="flex justify-end mb-4">
            <Button 
              icon={<RotateCw size={14} />} 
              onClick={() => fetchWebhookLogs()}
              className="flex items-center gap-1"
            >
              Refresh Logs
            </Button>
          </div>

          <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
            <Table
              columns={webhookColumns}
              dataSource={webhookLogs}
              rowKey="id"
              loading={webhooksLoading}
              pagination={{ pageSize: 20 }}
            />
          </div>
        </div>
      )
    },
    {
      key: '2',
      label: (
        <span className="flex items-center gap-2">
          <Logs size={16} />
          <span>SFTP Ingestion Log History</span>
        </span>
      ),
      children: (
        <div className="py-4">
          <div className="flex justify-end mb-4">
            <Button 
              icon={<RotateCw size={14} />} 
              onClick={() => fetchIngestLogs()}
              className="flex items-center gap-1"
            >
              Refresh History
            </Button>
          </div>

          <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
            <Table
              columns={ingestColumns}
              dataSource={ingestLogs}
              rowKey="id"
              loading={ingestLoading}
              pagination={{ pageSize: 20 }}
            />
          </div>
        </div>
      )
    },
    {
      key: '3',
      label: (
        <span className="flex items-center gap-2">
          <Settings size={16} />
          <span>System Actions</span>
        </span>
      ),
      children: (
        <div className="py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Index Rebuild maintenance */}
            <Card
              title={<span className="flex items-center gap-2 text-primary font-semibold"><Database size={18} /><span>Rebuild Similarity Search Index</span></span>}
              className="border-default rounded-xl shadow-sm h-full"
            >
              <div className="flex flex-col gap-4">
                <Alert
                  type="warning"
                  showIcon
                  message="Critical administrative operation"
                  description="Rebuilding the FAISS similarity index is a long-running procedure that rebuilds representations for Maest & Discogs similarity search vectors. It will lock database components and consume high system resource pools during execution."
                  className="rounded-xl"
                />
                
                <Button 
                  danger 
                  type="primary" 
                  size="large"
                  onClick={handleRebuildIndex}
                  loading={rebuildLoading}
                  className="h-12 w-full font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  <RotateCw size={18} className={rebuildLoading ? "animate-spin" : ""} />
                  Rebuild Similarity Index
                </Button>
              </div>
            </Card>

            {/* Promo code generation */}
            <Card
              title={<span className="flex items-center gap-2 text-primary font-semibold"><Ticket size={18} /><span>Generate Promo Code</span></span>}
              className="border-default rounded-xl shadow-sm h-full"
            >
              <Form
                form={promoForm}
                layout="vertical"
                onFinish={handleCreatePromo}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item
                    name="code"
                    label={<Text strong>Code Name</Text>}
                    rules={[{ required: true, message: 'Please enter code (e.g. SUMMER50)' }]}
                  >
                    <Input placeholder="SUMMER50" className="h-11 rounded-lg font-mono uppercase" />
                  </Form.Item>

                  <Form.Item
                    name="discount_type"
                    label={<Text strong>Discount Type</Text>}
                    initialValue="percentage"
                  >
                    <Select className="h-11 rounded-lg">
                      <Option value="percentage">Percentage (%)</Option>
                      <Option value="fixed">Fixed (€)</Option>
                    </Select>
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Form.Item
                    name="discount_value"
                    label={<Text strong>Value</Text>}
                    rules={[{ required: true, message: 'Enter value' }]}
                  >
                    <InputNumber min={1} className="w-full h-11 rounded-lg flex items-center" placeholder="50" />
                  </Form.Item>

                  <Form.Item
                    name="max_uses"
                    label={<Text strong>Max Uses (Opt)</Text>}
                  >
                    <InputNumber min={1} className="w-full h-11 rounded-lg flex items-center" placeholder="100" />
                  </Form.Item>

                  <Form.Item
                    name="expires_at"
                    label={<Text strong>Expiry Date (Opt)</Text>}
                  >
                    <DatePicker className="w-full h-11 rounded-lg" format="YYYY-MM-DD" />
                  </Form.Item>
                </div>

                <Form.Item className="!mb-0 mt-4">
                  <Button type="primary" htmlType="submit" className="h-11 rounded-lg w-full font-semibold">
                    Create Promo Code
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}
      <div className="mb-6">
        <Title level={2} className="!mb-1 !text-primary">Logs & Maintenance</Title>
        <Text className="text-secondary text-base">Observe failed webhooks, sftp execution logs, and rebuild similarity search indices.</Text>
      </div>

      <div className="bg-surface border border-default rounded-xl p-4 md:p-6 shadow-sm">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
      </div>

      {/* Webhook Logs details modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Globe size={18} />
            <span>Webhook Delivery Log details (Log #{selectedWebhookLog?.id})</span>
          </div>
        }
        open={webhookDetailVisible}
        onCancel={() => { setWebhookDetailVisible(false); setSelectedWebhookLog(null); }}
        footer={[
          <Button key="retry" type="primary" icon={<Play size={14} />} onClick={() => { handleRetryWebhook(selectedWebhookLog.id); setWebhookDetailVisible(false); }}>Retry Delivery</Button>,
          <Button key="close" onClick={() => { setWebhookDetailVisible(false); setSelectedWebhookLog(null); }}>Close</Button>
        ]}
        width={750}
      >
        {selectedWebhookLog && (
          <div className="py-4">
            <Descriptions bordered column={2} size="small" className="mb-6">
              <Descriptions.Item label="Webhook ID">{selectedWebhookLog.webhook_id}</Descriptions.Item>
              <Descriptions.Item label="Event Type">
                <Tag color="blue">{selectedWebhookLog.event_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Response Status">
                <Tag color={selectedWebhookLog.response_status >= 500 ? 'red' : 'orange'}>
                  {selectedWebhookLog.response_status || 'No Response'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Delivered At">
                {selectedWebhookLog.delivered_at ? new Date(selectedWebhookLog.delivered_at).toLocaleString() : 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} className="!mb-2">Request Headers</Title>
            <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[150px] overflow-y-auto">
              <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{selectedWebhookLog.request_headers || 'None'}</pre>
            </div>

            <Title level={5} className="!mb-2">Webhook JSON Payload</Title>
            <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[200px] overflow-y-auto">
              <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{selectedWebhookLog.payload || 'None'}</pre>
            </div>

            <Title level={5} className="!mb-2">Response Body</Title>
            <div className="border border-default p-4 rounded-xl bg-background-secondary max-h-[200px] overflow-y-auto">
              <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{selectedWebhookLog.response_body || 'None'}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default LogsPage;
