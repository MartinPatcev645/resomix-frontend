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
  Card,
  Typography,
  Descriptions,
  Spin,
  Row,
  Col,
  message
} from 'antd';
import { 
  Logs, 
  Globe, 
  RotateCw, 
  Play, 
  Eye, 
  Shield,
  Activity,
  FileText,
  Terminal
} from 'lucide-react';
import { useAdminLogs } from '@resomix/hooks';

const { Title, Text } = Typography;
const { Option } = Select;

function LogsPage() {
  const [activeTab, setActiveTab] = useState('1');
  const [, modalContextHolder] = Modal.useModal();

  // Filter forms
  const [systemFilterForm] = Form.useForm();
  const [auditFilterForm] = Form.useForm();

  // Modals visibility
  const [systemDetailVisible, setSystemDetailVisible] = useState(false);
  const [operationDetailVisible, setOperationDetailVisible] = useState(false);
  const [webhookDetailVisible, setWebhookDetailVisible] = useState(false);
  const [selectedWebhookLog, setSelectedWebhookLog] = useState<any | null>(null);

  // Load hooks for system & operation logs
  const {
    webhookLogs,
    logsLoading: webhooksLoading,
    fetchWebhookLogs,
    retryWebhook,

    // System Logs
    systemLogs,
    systemLogsLoading,
    systemLogsPagination,
    systemLogsStats,
    selectedSystemLog,
    setSelectedSystemLog,
    systemLogDetailLoading,
    fetchSystemLogs,
    fetchSystemLogDetail,
    fetchSystemLogsStats,

    // Operation Logs
    operationLogs,
    operationLogsLoading,
    operationLogsPagination,
    selectedOperationLog,
    setSelectedOperationLog,
    operationLogDetailLoading,
    fetchOperationLogs,
    fetchOperationLogDetail,
  } = useAdminLogs();

  // Filters state
  const [systemLogsFilters, setSystemLogsFilters] = useState<any>({
    page: 1,
    page_size: 50,
  });

  const [auditLogsFilters, setAuditLogsFilters] = useState<any>({
    page: 1,
    page_size: 50,
  });

  // Fetch stats on mount
  useEffect(() => {
    fetchSystemLogsStats();
  }, [fetchSystemLogsStats]);

  // Fetch logs when tab or filters change
  useEffect(() => {
    if (activeTab === '1') {
      fetchSystemLogs(systemLogsFilters);
    }
  }, [activeTab, systemLogsFilters, fetchSystemLogs]);

  useEffect(() => {
    if (activeTab === '2') {
      fetchOperationLogs(auditLogsFilters);
    }
  }, [activeTab, auditLogsFilters, fetchOperationLogs]);

  useEffect(() => {
    if (activeTab === '3') {
      fetchWebhookLogs();
    }
  }, [activeTab, fetchWebhookLogs]);

  const handleViewSystemDetail = async (id: number) => {
    setSystemDetailVisible(true);
    await fetchSystemLogDetail(id);
  };

  const handleViewOperationDetail = async (id: number) => {
    setOperationDetailVisible(true);
    await fetchOperationLogDetail(id);
  };

  const handleViewWebhookDetail = (log: any) => {
    setSelectedWebhookLog(log);
    setWebhookDetailVisible(true);
  };

  const handleRetryWebhook = async (logId: number) => {
    await retryWebhook(logId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const handleCorrelationIdClick = (corrId: string) => {
    // Cross filter both views
    const sysUpdate = { ...systemLogsFilters, correlation_id: corrId, page: 1 };
    const auditUpdate = { ...auditLogsFilters, correlation_id: corrId, page: 1 };
    
    setSystemLogsFilters(sysUpdate);
    setAuditLogsFilters(auditUpdate);
    
    systemFilterForm.setFieldsValue({ correlation_id: corrId });
    auditFilterForm.setFieldsValue({ correlation_id: corrId });

    message.success(`Filtered logs by correlation ID: ${corrId}`);
  };

  // ─── Table Columns ─────────────────────────────────────────

  const systemColumns = [
    {
      title: 'Timestamp',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (date: string) => <span className="font-mono text-xs text-secondary">{new Date(date).toLocaleString()}</span>
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 110,
      render: (level: string) => (
        <Tag color={
          level === 'DEBUG' ? 'blue' :
          level === 'INFO' ? 'green' :
          level === 'WARNING' ? 'orange' :
          level === 'ERROR' ? 'red' : 'purple'
        } className="font-medium text-xs">
          {level}
        </Tag>
      )
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (text: string) => <Tag className="bg-primary/5 text-primary border-primary/10">{text}</Tag>
    },
    {
      title: 'Action / Route',
      key: 'action_route',
      render: (_: unknown, record: any) => (
        <Space direction="vertical" size={2}>
          <Text strong className="text-sm text-primary">{record.action}</Text>
          {record.endpoint && <span className="font-mono text-[11px] text-secondary">{record.endpoint}</span>}
        </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status_code',
      key: 'status_code',
      width: 90,
      render: (code: number | null) => code ? (
        <Tag color={code >= 500 ? 'red' : code >= 400 ? 'orange' : 'green'}>
          {code}
        </Tag>
      ) : <span className="text-secondary">—</span>
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 100,
      render: (ms: number | null) => ms !== null ? (
        <span className={ms > 1000 ? "text-amber-500 font-semibold" : "text-primary"}>{ms.toFixed(0)} ms</span>
      ) : <span className="text-secondary">—</span>
    },
    {
      title: 'Correlation ID',
      dataIndex: 'correlation_id',
      key: 'correlation_id',
      width: 160,
      render: (corrId: string | null) => corrId ? (
        <a 
          onClick={(e) => {
            e.stopPropagation();
            handleCorrelationIdClick(corrId);
          }}
          className="font-mono text-[11px] hover:underline cursor-pointer"
        >
          {corrId.substring(0, 8)}...
        </a>
      ) : <span className="text-secondary">—</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'right' as const,
      render: (_: unknown, record: any) => (
        <Button 
          icon={<Eye size={14} />} 
          onClick={(e) => {
            e.stopPropagation();
            handleViewSystemDetail(record.id);
          }}
          className="flex items-center"
        />
      )
    }
  ];

  const auditColumns = [
    {
      title: 'Timestamp',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (date: string) => <span className="font-mono text-xs text-secondary">{new Date(date).toLocaleString()}</span>
    },
    {
      title: 'Admin User',
      key: 'admin_user',
      render: (_: unknown, record: any) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.admin_email}</Text>
          <span className="text-secondary text-[11px]">ID: #{record.admin_user_id}</span>
        </Space>
      )
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (text: string) => <span className="font-semibold text-primary">{text}</span>
    },
    {
      title: 'Target',
      key: 'target',
      render: (_: unknown, record: any) => (
        <Space size={4}>
          <Tag color="blue" className="text-xs uppercase">{record.target_type}</Tag>
          <span className="font-mono text-xs text-secondary">#{record.target_id}</span>
        </Space>
      )
    },
    {
      title: 'Client IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (ip: string) => <span className="font-mono text-xs">{ip}</span>
    },
    {
      title: 'Correlation ID',
      dataIndex: 'correlation_id',
      key: 'correlation_id',
      width: 160,
      render: (corrId: string | null) => corrId ? (
        <a 
          onClick={(e) => {
            e.stopPropagation();
            handleCorrelationIdClick(corrId);
          }}
          className="font-mono text-[11px] hover:underline cursor-pointer"
        >
          {corrId.substring(0, 8)}...
        </a>
      ) : <span className="text-secondary">—</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'right' as const,
      render: (_: unknown, record: any) => (
        <Button 
          icon={<Eye size={14} />} 
          onClick={(e) => {
            e.stopPropagation();
            handleViewOperationDetail(record.id);
          }}
          className="flex items-center"
        />
      )
    }
  ];

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

  const items = [
    {
      key: '1',
      label: (
        <span className="flex items-center gap-2">
          <FileText size={16} />
          <span>System Logs</span>
        </span>
      ),
      children: (
        <div className="py-4">
          {/* Stats widgets */}
          {systemLogsStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="border-default rounded-xl shadow-sm bg-surface">
                <div className="flex justify-between items-start">
                  <div>
                    <Text className="text-secondary text-xs font-semibold uppercase tracking-wider block">Total Log Events</Text>
                    <Title level={3} className="!m-0 !mt-1 text-primary">{systemLogsStats.total_logs?.toLocaleString()}</Title>
                  </div>
                  <div className="p-2 bg-primary/5 text-primary rounded-lg">
                    <Logs size={18} />
                  </div>
                </div>
                <div className="mt-2">
                  <Text className="text-secondary text-[11px]">Recorded in last {systemLogsStats.period_hours}h</Text>
                </div>
              </Card>

              <Card className="border-default rounded-xl shadow-sm bg-surface">
                <div className="flex justify-between items-start">
                  <div>
                    <Text className="text-secondary text-xs font-semibold uppercase tracking-wider block">System Error Rate</Text>
                    <Title level={3} className={`!m-0 !mt-1 ${systemLogsStats.error_rate_percent > 5 ? 'text-error' : 'text-primary'}`}>
                      {systemLogsStats.error_rate_percent?.toFixed(1)}%
                    </Title>
                  </div>
                  <div className={`p-2 rounded-lg ${systemLogsStats.error_rate_percent > 5 ? 'bg-error/5 text-error' : 'bg-success/5 text-success'}`}>
                    <Activity size={18} />
                  </div>
                </div>
                <div className="mt-2">
                  <Text className="text-secondary text-[11px]">{systemLogsStats.level_distribution?.ERROR || 0} error events logged</Text>
                </div>
              </Card>

              <Card className="border-default rounded-xl shadow-sm bg-surface">
                <div className="flex justify-between items-start">
                  <div>
                    <Text className="text-secondary text-xs font-semibold uppercase tracking-wider block">API Requests</Text>
                    <Title level={3} className="!m-0 !mt-1 text-primary">{systemLogsStats.total_requests?.toLocaleString()}</Title>
                  </div>
                  <div className="p-2 bg-blue-500/5 text-blue-500 rounded-lg">
                    <Terminal size={18} />
                  </div>
                </div>
                <div className="mt-2">
                  <Text className="text-secondary text-[11px]">HTTP endpoints hit</Text>
                </div>
              </Card>

              <Card className="border-default rounded-xl shadow-sm bg-surface">
                <div className="flex justify-between items-start">
                  <div>
                    <Text className="text-secondary text-xs font-semibold uppercase tracking-wider block">Failed Requests</Text>
                    <Title level={3} className="!m-0 !mt-1 text-error">{systemLogsStats.error_requests?.toLocaleString()}</Title>
                  </div>
                  <div className="p-2 bg-error/5 text-error rounded-lg">
                    <Activity size={18} />
                  </div>
                </div>
                <div className="mt-2">
                  <Text className="text-secondary text-[11px]">Returned 5xx server status</Text>
                </div>
              </Card>
            </div>
          )}

          {/* Search Filters */}
          <Card className="mb-6 bg-surface border-default shadow-sm rounded-xl overflow-hidden">
            <Form
              form={systemFilterForm}
              layout="vertical"
              onFinish={(values) => {
                setSystemLogsFilters((prev: any) => ({
                  ...prev,
                  ...values,
                  page: 1
                }));
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="q" label={<Text className="font-semibold text-secondary text-xs">Search Text</Text>} className="!mb-0">
                    <Input placeholder="Message, action, etc." className="h-10 rounded-lg" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="level" label={<Text className="font-semibold text-secondary text-xs">Level</Text>} className="!mb-0">
                    <Select placeholder="All Levels" className="h-10 rounded-lg" allowClear>
                      <Option value="DEBUG">DEBUG</Option>
                      <Option value="INFO">INFO</Option>
                      <Option value="WARNING">WARNING</Option>
                      <Option value="ERROR">ERROR</Option>
                      <Option value="CRITICAL">CRITICAL</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="category" label={<Text className="font-semibold text-secondary text-xs">Category</Text>} className="!mb-0">
                    <Select placeholder="All Categories" className="h-10 rounded-lg" allowClear>
                      <Option value="REQUEST">REQUEST</Option>
                      <Option value="PARTNER">PARTNER</Option>
                      <Option value="AUTH">AUTH</Option>
                      <Option value="SYSTEM">SYSTEM</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="start_date" label={<Text className="font-semibold text-secondary text-xs">Start Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="end_date" label={<Text className="font-semibold text-secondary text-xs">End Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>

                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="status_code" label={<Text className="font-semibold text-secondary text-xs">Status Code</Text>} className="!mb-0">
                    <Input placeholder="e.g. 500" type="number" className="h-10 rounded-lg" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="correlation_id" label={<Text className="font-semibold text-secondary text-xs">Correlation ID</Text>} className="!mb-0">
                    <Input placeholder="Trace ID" className="h-10 rounded-lg font-mono" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="client_ip" label={<Text className="font-semibold text-secondary text-xs">Client IP</Text>} className="!mb-0">
                    <Input placeholder="IP Address" className="h-10 rounded-lg font-mono" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="action" label={<Text className="font-semibold text-secondary text-xs">Action Match</Text>} className="!mb-0">
                    <Input placeholder="e.g. rotate_api_key" className="h-10 rounded-lg" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6} className="flex items-end gap-2 pt-6">
                  <Button type="primary" htmlType="submit" className="h-10 px-6 rounded-lg font-semibold w-full">
                    Apply Filters
                  </Button>
                  <Button 
                    onClick={() => {
                      systemFilterForm.resetFields();
                      setSystemLogsFilters({
                        page: 1,
                        page_size: 50,
                      });
                    }}
                    className="h-10 px-4 rounded-lg"
                  >
                    Reset
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* Table list */}
          <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
            <Table
              columns={systemColumns}
              dataSource={systemLogs}
              rowKey="id"
              loading={systemLogsLoading}
              onRow={(record) => ({
                onClick: () => {
                  handleViewSystemDetail(record.id);
                },
                className: 'cursor-pointer'
              })}
              pagination={{
                current: systemLogsPagination?.page || 1,
                pageSize: systemLogsPagination?.size || 50,
                total: systemLogsPagination?.total || 0,
                onChange: (page, pageSize) => {
                  setSystemLogsFilters((prev: any) => ({
                    ...prev,
                    page,
                    page_size: pageSize
                  }));
                },
                showSizeChanger: true,
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
          <Shield size={16} />
          <span>Audit Trail</span>
        </span>
      ),
      children: (
        <div className="py-4">
          {/* Audit Search Filters */}
          <Card className="mb-6 bg-surface border-default shadow-sm rounded-xl overflow-hidden">
            <Form
              form={auditFilterForm}
              layout="vertical"
              onFinish={(values) => {
                setAuditLogsFilters((prev: any) => ({
                  ...prev,
                  ...values,
                  page: 1
                }));
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item name="action" label={<Text className="font-semibold text-secondary text-xs">Action Match</Text>} className="!mb-0">
                    <Input placeholder="e.g. partner.rotate_api_key" className="h-10 rounded-lg" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="target_type" label={<Text className="font-semibold text-secondary text-xs">Target Type</Text>} className="!mb-0">
                    <Select placeholder="All Targets" className="h-10 rounded-lg" allowClear>
                      <Option value="partner">partner</Option>
                      <Option value="api_key">api_key</Option>
                      <Option value="sftp_user">sftp_user</Option>
                      <Option value="user">user</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="target_id" label={<Text className="font-semibold text-secondary text-xs">Target ID</Text>} className="!mb-0">
                    <Input placeholder="e.g. 42" className="h-10 rounded-lg" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="start_date" label={<Text className="font-semibold text-secondary text-xs">Start Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={5}>
                  <Form.Item name="end_date" label={<Text className="font-semibold text-secondary text-xs">End Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>

                <Col xs={12} sm={6} md={6}>
                  <Form.Item name="correlation_id" label={<Text className="font-semibold text-secondary text-xs">Correlation ID</Text>} className="!mb-0">
                    <Input placeholder="Trace ID" className="h-10 rounded-lg font-mono" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="admin_user_id" label={<Text className="font-semibold text-secondary text-xs">Admin User ID</Text>} className="!mb-0">
                    <Input placeholder="e.g. 1" type="number" className="h-10 rounded-lg" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} md={14} className="flex items-end gap-2 pt-6">
                  <Button type="primary" htmlType="submit" className="h-10 px-6 rounded-lg font-semibold w-full md:w-48">
                    Apply Filters
                  </Button>
                  <Button 
                    onClick={() => {
                      auditFilterForm.resetFields();
                      setAuditLogsFilters({
                        page: 1,
                        page_size: 50,
                      });
                    }}
                    className="h-10 px-4 rounded-lg"
                  >
                    Reset
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* Audit trail list */}
          <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-sm">
            <Table
              columns={auditColumns}
              dataSource={operationLogs}
              rowKey="id"
              loading={operationLogsLoading}
              onRow={(record) => ({
                onClick: () => {
                  handleViewOperationDetail(record.id);
                },
                className: 'cursor-pointer'
              })}
              pagination={{
                current: operationLogsPagination?.page || 1,
                pageSize: operationLogsPagination?.size || 50,
                total: operationLogsPagination?.total || 0,
                onChange: (page, pageSize) => {
                  setAuditLogsFilters((prev: any) => ({
                    ...prev,
                    page,
                    page_size: pageSize
                  }));
                },
                showSizeChanger: true,
              }}
            />
          </div>
        </div>
      )
    },
    {
      key: '3',
      label: (
        <span className="flex items-center gap-2">
          <Globe size={16} />
          <span>Webhook Deliveries</span>
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
    }
  ];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}
      <div className="mb-6">
        <Title level={2} className="!mb-1 !text-primary">Logs & Audit Trail</Title>
        <Text className="text-secondary text-base">Observe system application traces, endpoint executions, and administrative operation audits.</Text>
      </div>

      <div className="bg-surface border border-default rounded-xl p-4 md:p-6 shadow-sm animate-fade-in">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
      </div>

      {/* ── System Log Detail Modal ── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Logs size={18} />
            <span>System Log Detail (ID: #{selectedSystemLog?.id})</span>
          </div>
        }
        open={systemDetailVisible}
        onCancel={() => { setSystemDetailVisible(false); setSelectedSystemLog(null); }}
        footer={[
          <Button key="close" onClick={() => { setSystemDetailVisible(false); setSelectedSystemLog(null); }}>Close</Button>
        ]}
        width={850}
      >
        {systemLogDetailLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : selectedSystemLog && (
          <div className="py-4">
            <Descriptions bordered column={2} size="small" className="mb-6">
              <Descriptions.Item label="Timestamp">{new Date(selectedSystemLog.created_at).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Level">
                <Tag color={
                  selectedSystemLog.level === 'DEBUG' ? 'blue' :
                  selectedSystemLog.level === 'INFO' ? 'green' :
                  selectedSystemLog.level === 'WARNING' ? 'orange' :
                  selectedSystemLog.level === 'ERROR' ? 'red' : 'purple'
                }>
                  {selectedSystemLog.level}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category">{selectedSystemLog.category}</Descriptions.Item>
              <Descriptions.Item label="Action">{selectedSystemLog.action}</Descriptions.Item>
              <Descriptions.Item label="Endpoint">{selectedSystemLog.endpoint || '—'}</Descriptions.Item>
              <Descriptions.Item label="Status Code">
                {selectedSystemLog.status_code ? (
                  <Tag color={selectedSystemLog.status_code >= 500 ? 'red' : selectedSystemLog.status_code >= 400 ? 'orange' : 'green'}>
                    {selectedSystemLog.status_code}
                  </Tag>
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">{selectedSystemLog.duration_ms !== null ? `${selectedSystemLog.duration_ms.toFixed(1)} ms` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Client IP">{selectedSystemLog.client_ip || '—'}</Descriptions.Item>
              <Descriptions.Item label="Correlation ID" span={2}>
                <span className="font-mono text-xs">{selectedSystemLog.correlation_id || '—'}</span>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} className="!mb-2">Log Message</Title>
            <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[150px] overflow-y-auto">
              <Text className="font-mono text-xs text-primary whitespace-pre-wrap">{selectedSystemLog.message}</Text>
            </div>

            {selectedSystemLog.log_metadata && (
              <>
                <Title level={5} className="!mb-2">Log Metadata</Title>
                <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[200px] overflow-y-auto">
                  <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{JSON.stringify(selectedSystemLog.log_metadata, null, 2)}</pre>
                </div>
              </>
            )}

            {selectedSystemLog.query_params && (
              <>
                <Title level={5} className="!mb-2">Query Parameters</Title>
                <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[150px] overflow-y-auto">
                  <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{selectedSystemLog.query_params}</pre>
                </div>
              </>
            )}

            {selectedSystemLog.user_agent && (
              <>
                <Title level={5} className="!mb-2">User Agent</Title>
                <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[100px] overflow-y-auto">
                  <Text className="font-mono text-xs text-primary whitespace-pre-wrap">{selectedSystemLog.user_agent}</Text>
                </div>
              </>
            )}

            {selectedSystemLog.stack_trace && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <Title level={5} className="!m-0">Stack Trace</Title>
                  <Button size="small" onClick={() => copyToClipboard(selectedSystemLog.stack_trace || '')}>Copy Stack Trace</Button>
                </div>
                <div className="border border-default p-4 rounded-xl bg-background-secondary max-h-[300px] overflow-y-auto border-red-200">
                  <pre className="font-mono text-xs text-red-500 whitespace-pre-wrap">{selectedSystemLog.stack_trace}</pre>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Operation Log Detail Modal ── */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Shield size={18} />
            <span>Operation Audit Log Detail (ID: #{selectedOperationLog?.id})</span>
          </div>
        }
        open={operationDetailVisible}
        onCancel={() => { setOperationDetailVisible(false); setSelectedOperationLog(null); }}
        footer={[
          <Button key="close" onClick={() => { setOperationDetailVisible(false); setSelectedOperationLog(null); }}>Close</Button>
        ]}
        width={850}
      >
        {operationLogDetailLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : selectedOperationLog && (
          <div className="py-4">
            <Descriptions bordered column={2} size="small" className="mb-6">
              <Descriptions.Item label="Timestamp">{new Date(selectedOperationLog.created_at).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Admin Email">{selectedOperationLog.admin_email}</Descriptions.Item>
              <Descriptions.Item label="Admin User ID">{selectedOperationLog.admin_user_id}</Descriptions.Item>
              <Descriptions.Item label="Action">{selectedOperationLog.action}</Descriptions.Item>
              <Descriptions.Item label="Target Type">{selectedOperationLog.target_type}</Descriptions.Item>
              <Descriptions.Item label="Target ID">{selectedOperationLog.target_id}</Descriptions.Item>
              <Descriptions.Item label="IP Address">{selectedOperationLog.ip_address}</Descriptions.Item>
              <Descriptions.Item label="Correlation ID">
                <span className="font-mono text-xs">{selectedOperationLog.correlation_id || '—'}</span>
              </Descriptions.Item>
            </Descriptions>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Title level={5} className="!mb-2">Before State</Title>
                <div className="border border-default p-4 rounded-xl bg-background-secondary max-h-[400px] overflow-y-auto">
                  {selectedOperationLog.before_state ? (
                    <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{JSON.stringify(selectedOperationLog.before_state, null, 2)}</pre>
                  ) : (
                    <Text className="text-secondary italic">No state recorded (NULL)</Text>
                  )}
                </div>
              </div>
              <div>
                <Title level={5} className="!mb-2">After State</Title>
                <div className="border border-default p-4 rounded-xl bg-background-secondary max-h-[400px] overflow-y-auto">
                  {selectedOperationLog.after_state ? (
                    <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{JSON.stringify(selectedOperationLog.after_state, null, 2)}</pre>
                  ) : (
                    <Text className="text-secondary italic">No state recorded (NULL)</Text>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

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
                <Tag color={selectedWebhookLog.response_status >= 500 ? 'red' : selectedWebhookLog.response_status >= 400 ? 'orange' : 'green'}>
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
