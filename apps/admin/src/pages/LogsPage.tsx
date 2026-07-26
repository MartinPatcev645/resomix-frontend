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
  FileText
} from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { useAdminLogs } from '@resomix/hooks';

dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;
const { Option } = Select;

// ── Log time zones ──────────────────────────────────────────────────────────
// Log timestamps are written by the DB with CURRENT_TIMESTAMP and the server runs on UTC
// (`timedatectl` → Etc/UTC), so the raw values are naive UTC. We interpret them as UTC and render
// in the admin's chosen zone, DST-aware (dayjs timezone plugin uses the IANA database).
const LOG_SOURCE_TZ = 'UTC';
const LOG_TZ_STORAGE_KEY = 'admin_logs_display_tz';

const LOG_TIMEZONES: { value: string; label: string }[] = [
  { value: 'Europe/Athens', label: 'Greece — Athens' },
  { value: 'Asia/Karachi', label: 'Pakistan — Karachi' },
  { value: 'UTC', label: 'UTC (server time)' },
  { value: 'Asia/Kolkata', label: 'India — Kolkata' },
  { value: 'Asia/Dubai', label: 'UAE — Dubai' },
  { value: 'Europe/London', label: 'UK — London' },
  { value: 'Europe/Berlin', label: 'Germany — Berlin' },
  { value: 'America/New_York', label: 'US — Eastern' },
  { value: 'America/Los_Angeles', label: 'US — Pacific' },
];
const LOG_TZ_VALUES = LOG_TIMEZONES.map((t) => t.value);

/** Naive server log timestamp → 'YYYY-MM-DD HH:mm:ss' in the given zone (DST-aware). */
const formatLogTime = (value?: string | null, tz: string = 'UTC'): string => {
  if (!value) return 'N/A';
  const d = dayjs.tz(value, LOG_SOURCE_TZ);
  return d.isValid() ? d.tz(tz).format('YYYY-MM-DD HH:mm:ss') : 'N/A';
};

/** Compact 'HH:mm' variant for dense timelines. */
const formatLogTimeShort = (value?: string | null, tz: string = 'UTC'): string => {
  if (!value) return '';
  const d = dayjs.tz(value, LOG_SOURCE_TZ);
  return d.isValid() ? d.tz(tz).format('HH:mm') : '';
};

/**
 * Combine a filter date + time (both entered in the admin's DISPLAY zone) into a naive-UTC ISO
 * string for the backend (whose `created_at` is naive UTC). Returns undefined when neither is set.
 *   • date given, time blank  → that date at 00:00 (start) / 23:59:59 (end)
 *   • time given, date blank  → TODAY (in the display zone) at that time
 */
const toUtcBound = (
  dateStr: string | undefined,
  timeStr: string | undefined,
  tz: string,
  edge: 'start' | 'end',
): string | undefined => {
  if (!dateStr && !timeStr) return undefined;
  const date = dateStr || dayjs().tz(tz).format('YYYY-MM-DD');
  const time = timeStr || (edge === 'end' ? '23:59:59' : '00:00:00');
  const wall = dayjs.tz(`${date}T${time}`, tz);
  return wall.isValid() ? wall.utc().format('YYYY-MM-DDTHH:mm:ss') : undefined;
};

const renderJsonOrString = (val: any): string => {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(val);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // Fall through
      }
    }
    return val;
  }
  return String(val);
};

function LogsPage() {
  const [activeTab, setActiveTab] = useState('1');
  const [overviewHours, setOverviewHours] = useState<number>(24);
  const [, modalContextHolder] = Modal.useModal();

  // Filter forms
  const [systemFilterForm] = Form.useForm();
  const [auditFilterForm] = Form.useForm();

  // Zone the admin views/filters logs in (persisted). Defaults to Greece.
  const [displayTz, setDisplayTz] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOG_TZ_STORAGE_KEY);
      return saved && LOG_TZ_VALUES.includes(saved) ? saved : 'Europe/Athens';
    } catch {
      return 'Europe/Athens';
    }
  });
  const changeDisplayTz = (tz: string) => {
    setDisplayTz(tz);
    try { localStorage.setItem(LOG_TZ_STORAGE_KEY, tz); } catch { /* noop */ }
  };

  /**
   * Turn raw filter form values into backend params: combine start/end date+time (entered in the
   * display zone) into naive-UTC bounds and validate them. Returns the params to apply, or an error
   * string to surface (blocking the apply).
   */
  const resolveLogFilters = (values: any): { params: any } | { error: string } => {
    const { start_date, start_time, end_date, end_time, ...rest } = values;
    const startUtc = toUtcBound(start_date, start_time, displayTz, 'start');
    const endUtc = toUtcBound(end_date, end_time, displayTz, 'end');
    if (startUtc && dayjs.utc(startUtc).isAfter(dayjs.utc())) {
      return { error: 'Start date/time cannot be in the future.' };
    }
    if (startUtc && endUtc && dayjs.utc(endUtc).isBefore(dayjs.utc(startUtc))) {
      return { error: 'End date/time cannot be before the start date/time.' };
    }
    return { params: { ...rest, start_date: startUtc, end_date: endUtc } };
  };

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
    systemOverview,
    systemOverviewLoading,
    selectedSystemLog,
    setSelectedSystemLog,
    systemLogDetailLoading,
    fetchSystemLogs,
    fetchSystemLogDetail,
    fetchSystemLogsOverview,

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



  useEffect(() => {
    fetchSystemLogsOverview(overviewHours);
  }, [overviewHours, fetchSystemLogsOverview]);

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
      render: (date: string) => <span className="font-mono text-xs text-secondary">{formatLogTime(date, displayTz)}</span>
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
      render: (date: string) => <span className="font-mono text-xs text-secondary">{formatLogTime(date, displayTz)}</span>
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
      render: (date: string) => formatLogTime(date, displayTz)
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
          {systemLogsPagination?.total !== undefined && (
            <Tag color="blue" className="text-[10px] font-semibold rounded-full px-2 py-0.5 m-0">
              {systemLogsPagination.total}
            </Tag>
          )}
        </span>
      ),
      children: (
        <div className="py-4">
          {/* Stats widgets removed in favor of Overview Dashboard */}

          {/* Search Filters */}
          <Card className="mb-6 bg-surface border-default shadow-sm rounded-xl overflow-hidden">
            <Form
              form={systemFilterForm}
              layout="vertical"
              onFinish={(values) => {
                const res = resolveLogFilters(values);
                if ('error' in res) { message.error(res.error); return; }
                setSystemLogsFilters((prev: any) => ({ ...prev, ...res.params, page: 1 }));
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
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="start_date" label={<Text className="font-semibold text-secondary text-xs">Start Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Item name="start_time" label={<Text className="font-semibold text-secondary text-xs">Start Time</Text>} className="!mb-0">
                    <Input type="time" step={1} className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="end_date" label={<Text className="font-semibold text-secondary text-xs">End Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Item name="end_time" label={<Text className="font-semibold text-secondary text-xs">End Time</Text>} className="!mb-0">
                    <Input type="time" step={1} className="h-10 rounded-lg" />
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
          {operationLogsPagination?.total !== undefined && (
            <Tag color="blue" className="text-[10px] font-semibold rounded-full px-2 py-0.5 m-0">
              {operationLogsPagination.total}
            </Tag>
          )}
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
                const res = resolveLogFilters(values);
                if ('error' in res) { message.error(res.error); return; }
                setAuditLogsFilters((prev: any) => ({ ...prev, ...res.params, page: 1 }));
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
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="start_date" label={<Text className="font-semibold text-secondary text-xs">Start Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Item name="start_time" label={<Text className="font-semibold text-secondary text-xs">Start Time</Text>} className="!mb-0">
                    <Input type="time" step={1} className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={4}>
                  <Form.Item name="end_date" label={<Text className="font-semibold text-secondary text-xs">End Date</Text>} className="!mb-0">
                    <Input type="date" className="h-10 rounded-lg" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6} md={3}>
                  <Form.Item name="end_time" label={<Text className="font-semibold text-secondary text-xs">End Time</Text>} className="!mb-0">
                    <Input type="time" step={1} className="h-10 rounded-lg" />
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
          {webhookLogs !== undefined && (
            <Tag color="blue" className="text-[10px] font-semibold rounded-full px-2 py-0.5 m-0">
              {webhookLogs.length}
            </Tag>
          )}
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Title level={2} className="!mb-1 !text-primary">Logs & Audit Trail</Title>
          <Text className="text-secondary text-base">Observe system application traces, endpoint executions, and administrative operation audits.</Text>
        </div>
        <div className="flex flex-col gap-1 min-w-[240px]">
          <Text className="font-semibold text-secondary text-xs flex items-center gap-1">
            <Globe size={12} /> Display time zone
          </Text>
          <Select
            value={displayTz}
            onChange={changeDisplayTz}
            className="h-10 w-full"
            options={LOG_TIMEZONES}
            showSearch
            optionFilterProp="label"
          />
          <Text className="text-secondary text-[10px]">Log times are stored in UTC and shown/filtered in this zone (DST-aware).</Text>
        </div>
      </div>

      {/* System Health & Overview Dashboard Widget */}
      <Card 
        className="mb-8 border-default rounded-2xl shadow-sm overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-4 border-b border-default">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="text-primary animate-pulse" size={20} />
              <Text className="text-primary font-semibold text-base block">System Health & Overview</Text>
            </div>
            <Text className="text-secondary text-xs">Derived from system exceptions and admin activities in the selected window.</Text>
          </div>
          <div className="flex items-center gap-2 self-stretch lg:self-auto">
            <Select 
              value={overviewHours} 
              onChange={(val) => setOverviewHours(val)}
              className="w-40 h-9"
            >
              <Option value={1}>Last hour</Option>
              <Option value={24}>Last 24 hours</Option>
              <Option value={72}>Last 3 days</Option>
              <Option value={168}>Last week</Option>
              <Option value={720}>Last month</Option>
              <Option value={2160}>Last 3 months</Option>
              <Option value={4320}>Last 6 months</Option>
              <Option value={8760}>Last year</Option>
              <Option value={0}>All time</Option>
            </Select>
            <Button 
              icon={<RotateCw size={14} className={systemOverviewLoading ? "animate-spin" : ""} />} 
              onClick={() => fetchSystemLogsOverview(overviewHours)}
              className="h-9 flex items-center justify-center"
            />
          </div>
        </div>

        {systemOverviewLoading ? (
          <div className="flex justify-center items-center py-12">
            <Spin size="large" tip="Loading system health overview..." />
          </div>
        ) : systemOverview ? (
          <Row gutter={[20, 20]}>
            {/* System Health Card */}
            <Col xs={24} md={12} lg={6}>
              <div className="p-5 rounded-xl bg-background-secondary border border-default h-full flex flex-col justify-between relative overflow-hidden">
                {/* Glowing Accent Gradient Background */}
                <div 
                  className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-[40px] opacity-20 -mr-10 -mt-10 ${
                    systemOverview.status === 'healthy' ? 'bg-emerald-500' :
                    systemOverview.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-secondary text-xs font-semibold uppercase tracking-wider">Status</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full animate-ping ${
                        systemOverview.status === 'healthy' ? 'bg-emerald-500' :
                        systemOverview.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                      <span className={`w-2 h-2 rounded-full -ml-3.5 ${
                        systemOverview.status === 'healthy' ? 'bg-emerald-500' :
                        systemOverview.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                      <Tag color={
                        systemOverview.status === 'healthy' ? 'success' :
                        systemOverview.status === 'degraded' ? 'warning' : 'error'
                      } className="font-bold uppercase tracking-wider text-xs border-0 px-2.5 py-0.5 rounded-full">
                        {systemOverview.status}
                      </Tag>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-[11px] text-secondary">System Logs: </span>
                    <span className="font-semibold text-primary">{systemOverview.system_logs?.total_in_window?.toLocaleString() || 0}</span>
                    <span className="text-secondary text-[11px]"> events</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[11px] text-secondary">Exceptions/Errors: </span>
                    <span className="font-semibold text-rose-500">{systemOverview.system_logs?.error_count || 0}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[11px] text-secondary">Warnings: </span>
                    <span className="font-semibold text-amber-500">{systemOverview.system_logs?.warning_count || 0}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-default/60">
                  <Row gutter={8}>
                    <Col span={12}>
                      <Text className="text-[10px] text-secondary uppercase tracking-wider block">Avg Latency</Text>
                      <Text className="text-primary font-bold text-sm">
                        {systemOverview.system_logs?.avg_duration_ms ? `${systemOverview.system_logs.avg_duration_ms.toFixed(1)}ms` : '—'}
                      </Text>
                    </Col>
                    <Col span={12}>
                      <Text className="text-[10px] text-secondary uppercase tracking-wider block">Error Rate</Text>
                      <Text className={`font-bold text-sm ${systemOverview.system_logs?.error_rate_percent > 5 ? 'text-error' : 'text-primary'}`}>
                        {systemOverview.system_logs?.error_rate_percent ? `${systemOverview.system_logs.error_rate_percent.toFixed(1)}%` : '0%'}
                      </Text>
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>

            {/* Timeseries Sparkline Custom SVG flex bar chart */}
            <Col xs={24} md={12} lg={8}>
              <div className="p-5 rounded-xl bg-background-secondary border border-default h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-secondary text-xs font-semibold uppercase tracking-wider">Activity Timeseries</span>
                  <span className="text-[10px] text-secondary bg-primary/5 px-2 py-0.5 rounded border border-default/50 uppercase">
                    {systemOverview.system_logs?.timeseries?.length > 0 ? `By ${systemOverview.system_logs.timeseries[0].bucket.includes(':') ? 'Hour' : systemOverview.system_logs.timeseries[0].bucket.length === 7 ? 'Month' : 'Day'}` : 'N/A'}
                  </span>
                </div>

                {/* Sparkline Custom SVG Bar Chart */}
                <div className="h-28 flex items-end justify-between gap-1 pt-2 pb-1 px-1 relative">
                  {systemOverview.system_logs?.timeseries?.length > 0 ? (
                    (() => {
                      const timeseries = systemOverview.system_logs.timeseries;
                      const maxCount = Math.max(...timeseries.map(t => t.total), 1);
                      return timeseries.map((bucket, idx) => {
                        const totalHeightPercent = (bucket.total / maxCount) * 100;
                        const errorPercent = bucket.total > 0 ? (bucket.errors / bucket.total) * 100 : 0;
                        const warningPercent = bucket.total > 0 ? (bucket.warnings / bucket.total) * 100 : 0;
                        const infoPercent = bucket.total > 0 ? Math.max(0, 100 - errorPercent - warningPercent) : 0;

                        return (
                          <Tooltip 
                            key={idx}
                            title={
                              <div className="text-xs p-1">
                                <div className="font-semibold mb-1 text-[11px] border-b border-white/20 pb-0.5">{bucket.bucket}</div>
                                <div>Total: <span className="font-semibold">{bucket.total}</span></div>
                                <div>Errors: <span className="font-semibold text-rose-400">{bucket.errors}</span></div>
                                <div>Warnings: <span className="font-semibold text-amber-400">{bucket.warnings}</span></div>
                              </div>
                            }
                          >
                            <div 
                              className="flex-1 min-w-[6px] max-w-[24px] bg-transparent flex flex-col justify-end hover:brightness-110 transition-all cursor-pointer relative rounded-t-sm overflow-hidden h-full"
                            >
                              <div 
                                className="w-full flex flex-col justify-end h-full"
                                style={{ height: `${totalHeightPercent}%` }}
                              >
                                {/* Stacked segments */}
                                <div className="w-full bg-rose-500 rounded-t-sm" style={{ height: `${errorPercent}%` }} />
                                <div className="w-full bg-amber-500" style={{ height: `${warningPercent}%` }} />
                                <div className="w-full bg-primary/30" style={{ height: `${infoPercent}%` }} />
                              </div>
                            </div>
                          </Tooltip>
                        );
                      });
                    })()
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-secondary italic">No timeseries data available</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center text-[10px] text-secondary mt-1 px-1">
                  <span>{systemOverview.system_logs?.timeseries?.[0]?.bucket || 'Start'}</span>
                  <span>{systemOverview.system_logs?.timeseries?.[systemOverview.system_logs.timeseries.length - 1]?.bucket || 'End'}</span>
                </div>
              </div>
            </Col>

            {/* Recent Attention List */}
            <Col xs={24} md={12} lg={6}>
              <div className="p-5 rounded-xl bg-background-secondary border border-default h-full flex flex-col">
                <span className="text-secondary text-xs font-semibold uppercase tracking-wider block mb-3">Recent Attention</span>
                <div className="flex-1 overflow-y-auto max-h-[140px] pr-1 flex flex-col gap-2">
                  {systemOverview.system_logs?.recent_attention && systemOverview.system_logs.recent_attention.length > 0 ? (
                    systemOverview.system_logs.recent_attention.map((log) => (
                      <div 
                        key={log.id} 
                        onClick={() => handleViewSystemDetail(log.id)}
                        className="p-2 rounded bg-surface border border-default hover:border-primary/30 transition-all cursor-pointer flex items-start justify-between gap-2 group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Tag color={log.level === 'CRITICAL' ? 'purple' : 'red'} className="text-[9px] font-bold px-1.5 m-0 leading-tight">
                              {log.level}
                            </Tag>
                            <span className="text-[10px] text-secondary font-mono">{log.category}</span>
                          </div>
                          <div className="text-[11px] text-primary truncate font-semibold font-mono group-hover:text-primary">{log.action}</div>
                          <div className="text-[10px] text-secondary truncate">{log.message}</div>
                        </div>
                        <span className="text-[10px] text-secondary font-mono self-start whitespace-nowrap">{formatLogTimeShort(log.created_at, displayTz)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full py-6">
                      <span className="text-xs text-secondary italic">No items require attention</span>
                    </div>
                  )}
                </div>
              </div>
            </Col>

            {/* Top Admin Activities / Operations Stats */}
            <Col xs={24} md={12} lg={4}>
              <div className="p-5 rounded-xl bg-background-secondary border border-default h-full flex flex-col justify-between">
                <div>
                  <span className="text-secondary text-xs font-semibold uppercase tracking-wider block mb-2">Admin Activities</span>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-secondary">Total Actions</span>
                    <span className="font-semibold text-primary">{systemOverview.operations?.total_in_window || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs mb-3">
                    <span className="text-secondary">Active Admins</span>
                    <span className="font-semibold text-primary">{systemOverview.operations?.active_admins || 0}</span>
                  </div>
                </div>
                
                <div className="overflow-y-auto max-h-[85px] pr-1 flex flex-wrap gap-1.5 pt-2 border-t border-default/60">
                  {systemOverview.operations?.top_actions && systemOverview.operations.top_actions.length > 0 ? (
                    systemOverview.operations.top_actions.map((act, idx) => (
                      <Tooltip key={idx} title={`${act.count} executions`}>
                        <Tag className="bg-primary/5 text-primary border-primary/10 text-[10px] m-0 max-w-full truncate font-semibold cursor-default">
                          {act.action.replace('partner.', '')}: {act.count}
                        </Tag>
                      </Tooltip>
                    ))
                  ) : (
                    <span className="text-[10px] text-secondary italic">No operations recorded</span>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        ) : (
          <div className="flex justify-center py-6">
            <span className="text-secondary text-sm">Failed to load system overview stats</span>
          </div>
        )}
      </Card>

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
              <Descriptions.Item label="Timestamp">{formatLogTime(selectedSystemLog.created_at, displayTz)}</Descriptions.Item>
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
                  <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{renderJsonOrString(selectedSystemLog.log_metadata)}</pre>
                </div>
              </>
            )}

            {selectedSystemLog.query_params && (
              <>
                <Title level={5} className="!mb-2">Query Parameters</Title>
                <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[150px] overflow-y-auto">
                  <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{renderJsonOrString(selectedSystemLog.query_params)}</pre>
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
              <Descriptions.Item label="Timestamp">{formatLogTime(selectedOperationLog.created_at, displayTz)}</Descriptions.Item>
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
                    <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{renderJsonOrString(selectedOperationLog.before_state)}</pre>
                  ) : (
                    <Text className="text-secondary italic">No state recorded (NULL)</Text>
                  )}
                </div>
              </div>
              <div>
                <Title level={5} className="!mb-2">After State</Title>
                <div className="border border-default p-4 rounded-xl bg-background-secondary max-h-[400px] overflow-y-auto">
                  {selectedOperationLog.after_state ? (
                    <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{renderJsonOrString(selectedOperationLog.after_state)}</pre>
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
                {formatLogTime(selectedWebhookLog.delivered_at, displayTz)}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} className="!mb-2">Request Headers</Title>
            <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[150px] overflow-y-auto">
              <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{renderJsonOrString(selectedWebhookLog.request_headers) || 'None'}</pre>
            </div>

            <Title level={5} className="!mb-2">Webhook JSON Payload</Title>
            <div className="border border-default p-4 rounded-xl bg-background-secondary mb-4 max-h-[200px] overflow-y-auto">
              <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{renderJsonOrString(selectedWebhookLog.payload) || 'None'}</pre>
            </div>

            <Title level={5} className="!mb-2">Response Body</Title>
            <div className="border border-default p-4 rounded-xl bg-background-secondary max-h-[200px] overflow-y-auto">
              <pre className="font-mono text-xs text-primary whitespace-pre-wrap">{renderJsonOrString(selectedWebhookLog.response_body) || 'None'}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default LogsPage;
