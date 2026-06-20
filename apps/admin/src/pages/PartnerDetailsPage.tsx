import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Spin, 
  Button, 
  Tag, 
  Descriptions, 
  Tabs, 
  Card, 
  Form, 
  Input, 
  InputNumber,
  Row,
  Col,
  Select, 
  Space, 
  Typography, 
  Tooltip, 
  Alert, 
  Badge, 
  Switch, 
  Modal, 
  List, 
  message 
} from 'antd';
import { 
  ArrowLeft, 
  RefreshCw, 
  Server, 
  Key, 
  User, 
  Shield, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Check, 
  Copy, 
  Ban, 
  RotateCw, 
  Edit, 
  Activity, 
  Terminal,
  Plus,
  CreditCard,
  Globe,
  Trash2
} from 'lucide-react';
import { useStatusModals, usePartners } from '@resomix/hooks';
import { StatusModal } from '@resomix/ui';
import type { 
  PartnerApiKey, 
  PartnerTier, 
  PartnerCreateRequest, 
  ApiKeyIssueRequest,
  SftpProvisionRequest,
  SftpLimitsUpdateRequest,
  WebhookConfig,
  WebhookDeliveryLog
} from '@resomix/api-client';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface SftpLimitsConfig {
  quota_gb: number;
  quota_files: number;
  upload_bandwidth: number;
  download_bandwidth: number;
  max_sessions: number;
  upload_data_transfer: number;
  download_data_transfer: number;
  total_data_transfer: number;
}

const SFTP_TIER_DEFAULTS: Record<PartnerTier, SftpLimitsConfig> = {
  sandbox: {
    quota_gb: 1,
    quota_files: 0,
    upload_bandwidth: 2048,
    download_bandwidth: 4096,
    max_sessions: 2,
    upload_data_transfer: 0,
    download_data_transfer: 0,
    total_data_transfer: 0,
  },
  starter: {
    quota_gb: 10,
    quota_files: 0,
    upload_bandwidth: 0,
    download_bandwidth: 0,
    max_sessions: 5,
    upload_data_transfer: 0,
    download_data_transfer: 0,
    total_data_transfer: 0,
  },
  growth: {
    quota_gb: 50,
    quota_files: 0,
    upload_bandwidth: 0,
    download_bandwidth: 0,
    max_sessions: 10,
    upload_data_transfer: 0,
    download_data_transfer: 0,
    total_data_transfer: 0,
  },
  enterprise: {
    quota_gb: 0,
    quota_files: 0,
    upload_bandwidth: 0,
    download_bandwidth: 0,
    max_sessions: 0,
    upload_data_transfer: 0,
    download_data_transfer: 0,
    total_data_transfer: 0,
  },
};

const getTierDefaults = (tier?: string): SftpLimitsConfig => {
  const normalized = (tier?.toLowerCase() || 'starter') as PartnerTier;
  return SFTP_TIER_DEFAULTS[normalized] || SFTP_TIER_DEFAULTS.starter;
};

const formatLimitValue = (
  fieldName: keyof SftpLimitsConfig,
  currentValBytesOrNum: number | null | undefined,
  tier?: string
) => {
  const defaults = getTierDefaults(tier);
  const isDefault = currentValBytesOrNum === null || currentValBytesOrNum === undefined;
  
  let activeValueNum: number;
  if (isDefault) {
    if (fieldName === 'quota_gb') {
      activeValueNum = defaults.quota_gb;
    } else {
      activeValueNum = defaults[fieldName];
    }
  } else {
    if (fieldName === 'quota_gb') {
      activeValueNum = currentValBytesOrNum! / 1073741824;
    } else {
      activeValueNum = currentValBytesOrNum!;
    }
  }

  let unit = '';
  if (fieldName === 'quota_gb') unit = ' GB';
  else if (fieldName === 'upload_bandwidth' || fieldName === 'download_bandwidth') unit = ' KB/s';
  else if (fieldName === 'upload_data_transfer' || fieldName === 'download_data_transfer' || fieldName === 'total_data_transfer') unit = ' MB';

  const valueStr = activeValueNum === 0 ? 'Unlimited' : `${activeValueNum}${unit}`;
  return isDefault ? `${valueStr} (Plan Default)` : valueStr;
};

function PartnerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const partnerId = /^\d+$/.test(id || '') ? parseInt(id!, 10) : NaN;
  
  const [modal, modalContextHolder] = Modal.useModal();
  const [activeTab, setActiveTab] = useState('1');

  // Robust Error/Success status modals
  const {
    errorModalVisible,
    errorDetails,
    showErrorModal,
    closeErrorModal,
    successModalVisible,
    successDetails,
    showSuccessModal,
    closeSuccessModal,
  } = useStatusModals();
  

  const {
    selectedPartner,
    setSelectedPartner,
    apiKeys,
    keysLoading,
    fetchApiKeys,
    issueApiKey,
    revokeKey,
    rotateKey,
    updatePartner,
    getPartnerDetail,
    provisionSftp,
    getSftpStatus,
    retrySftp,
    updateSftpLimits,
    webhooks,
    failedLogs,
    webhooksLoading,
    logsLoading,
    fetchPartnerWebhooks,
    saveWebhookConfig,
    deleteWebhook,
    fetchFailedWebhookLogs,
    retryWebhook,
    initiateB2bCheckout,
  } = usePartners({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  });

  // State Management
  const [pageLoading, setPageLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [sftpLoading, setSftpLoading] = useState(false);
  const [sftpData, setSftpData] = useState<any | null>(null);

  // Forms
  const [editForm] = Form.useForm();
  const [sftpForm] = Form.useForm();
  const [issueKeyForm] = Form.useForm();
  const [webhookForm] = Form.useForm();
  const [checkoutForm] = Form.useForm();

  // API Key Flow State
  const [issueKeyModalVisible, setIssueKeyModalVisible] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ plaintext_key: string; label: string } | null>(null);
  const [usePubKey, setUsePubKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // SFTP limits and allowed IP states
  const [editLimitsModalVisible, setEditLimitsModalVisible] = useState(false);
  const [showAdvancedLimits, setShowAdvancedLimits] = useState(false);
  const [editLimitsForm] = Form.useForm();
  const [retrySftpModalVisible, setRetrySftpModalVisible] = useState(false);
  const [retrySftpForm] = Form.useForm();

  // Load All Partner Details
  const fetchAllData = useCallback(async () => {
    if (isNaN(partnerId)) {
      showErrorModal('Invalid Partner ID', 'The requested partner ID is invalid.');
      setPageLoading(false);
      return;
    }

    setPageLoading(true);
    try {
      const detailRes = await getPartnerDetail(partnerId);
      if (detailRes && detailRes.success && detailRes.data) {
        setSelectedPartner(detailRes.data);
        editForm.setFieldsValue(detailRes.data);
      } else {
        showErrorModal('Error', detailRes?.error || 'Failed to retrieve partner profile.');
      }

      // Fetch keys
      await fetchApiKeys(partnerId);

      // Fetch SFTP status
      setSftpLoading(true);
      const sftpRes = await getSftpStatus(partnerId);
      if (sftpRes && sftpRes.success) {
        setSftpData(sftpRes.data);
      }

      // Fetch B2B webhooks & failed webhook delivery logs
      await fetchPartnerWebhooks(partnerId);
      await fetchFailedWebhookLogs(partnerId);
    } catch (err) {
      console.error(err);
      showErrorModal('Fetch Error', 'An error occurred while loading partner data.');
    } finally {
      setPageLoading(false);
      setSftpLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Actions handler
  const handleUpdateProfile = async (values: Partial<PartnerCreateRequest>) => {
    if (isNaN(partnerId)) return;
    const success = await updatePartner(partnerId, values);
    if (success) {
      setEditMode(false);
      const updated = await getPartnerDetail(partnerId);
      if (updated?.success && updated.data) {
        setSelectedPartner(updated.data);
      }
    }
  };

  const handleProvisionSftp = async (values: any) => {
    if (isNaN(partnerId)) return;
    setSftpLoading(true);
    try {
      const mapField = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        return Number(val);
      };

      const payload: SftpProvisionRequest = {
        partner_id: partnerId,
        password: values.password,
        use_public_key: usePubKey,
        public_key: usePubKey ? values.public_key : null,
        allowed_ip: values.allowed_ip || null,
        quota_bytes: values.quota_gb !== undefined && values.quota_gb !== null && values.quota_gb !== ''
          ? Math.round(Number(values.quota_gb) * 1073741824)
          : null,
        quota_files: mapField(values.quota_files),
        upload_bandwidth: mapField(values.upload_bandwidth),
        download_bandwidth: mapField(values.download_bandwidth),
        max_sessions: mapField(values.max_sessions),
        upload_data_transfer: mapField(values.upload_data_transfer),
        download_data_transfer: mapField(values.download_data_transfer),
        total_data_transfer: mapField(values.total_data_transfer),
      };

      const result = await provisionSftp(payload);
      if (result && result.success) {
        // Refresh SFTP status
        const status = await getSftpStatus(partnerId);
        if (status?.success) {
          setSftpData(status.data);
        }
        sftpForm.resetFields();
        setUsePubKey(false);
        setShowAdvancedLimits(false);
      }
    } finally {
      setSftpLoading(false);
    }
  };

  const handleUpdateSftpLimits = async (values: any) => {
    if (isNaN(partnerId)) return;
    setSftpLoading(true);
    try {
      const mapField = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        return Number(val);
      };

      const payload: SftpLimitsUpdateRequest = {
        quota_bytes: values.quota_gb !== undefined && values.quota_gb !== null && values.quota_gb !== ''
          ? Math.round(Number(values.quota_gb) * 1073741824)
          : null,
        quota_files: mapField(values.quota_files),
        upload_bandwidth: mapField(values.upload_bandwidth),
        download_bandwidth: mapField(values.download_bandwidth),
        max_sessions: mapField(values.max_sessions),
        upload_data_transfer: mapField(values.upload_data_transfer),
        download_data_transfer: mapField(values.download_data_transfer),
        total_data_transfer: mapField(values.total_data_transfer),
      };

      const result = await updateSftpLimits(partnerId, payload);
      if (result && result.success) {
        const status = await getSftpStatus(partnerId);
        if (status?.success) {
          setSftpData(status.data);
        }
        setEditLimitsModalVisible(false);
      }
    } finally {
      setSftpLoading(false);
    }
  };

  const handleRetrySftp = async (values: any) => {
    if (isNaN(partnerId)) return;
    setSftpLoading(true);
    try {
      const result = await retrySftp(partnerId, { password: values.password });
      if (result && result.success) {
        const status = await getSftpStatus(partnerId);
        if (status?.success) {
          setSftpData(status.data);
        }
        setRetrySftpModalVisible(false);
        retrySftpForm.resetFields();
      }
    } finally {
      setSftpLoading(false);
    }
  };

  const handleIssueKey = async (values: Omit<ApiKeyIssueRequest, 'partner_id'>) => {
    if (isNaN(partnerId)) return;
    const payload = {
      partner_id: partnerId,
      ...values,
      expires_at: values.expires_at ? `${values.expires_at}T23:59:59` : undefined
    };
    const result = await issueApiKey(payload);
    if (result) {
      setRevealedKey({ plaintext_key: result.plaintext_key, label: result.label });
      setNewKeyVisible(true);
      setIssueKeyModalVisible(false);
      issueKeyForm.resetFields();
    }
  };

  const handleRotateKey = (key: PartnerApiKey) => {
    modal.confirm({
      title: 'Rotate API Key',
      content: `Are you sure you want to rotate the key "${key.label}"? The old key will be revoked immediately and a new one will be issued.`,
      okText: 'Rotate',
      okType: 'danger',
      onOk: async () => {
        const result = await rotateKey(key.id);
        if (result) {
          setRevealedKey({ plaintext_key: result.plaintext_key, label: result.label });
          setNewKeyVisible(true);
        }
      }
    });
  };

  const handleRevokeKey = (key: PartnerApiKey) => {
    let reason = '';
    modal.confirm({
      title: 'Revoke API Key',
      content: (
        <div className="mt-4">
          <p>Are you sure you want to revoke the key "{key.label}"? This action cannot be undone.</p>
          <div className="mt-4">
            <Text strong>Reason for revocation:</Text>
            <Input 
              placeholder="e.g. Key compromised, Account closed" 
              className="mt-1"
              onChange={(e) => { reason = e.target.value; }}
            />
          </div>
        </div>
      ),
      okText: 'Revoke Key',
      okType: 'danger',
      onOk: async () => {
        if (!reason || reason.length < 5) {
          message.error('Please provide a reason (min 5 characters)');
          return Promise.reject();
        }
        await revokeKey(key.id, reason);
      }
    });
  };

  const handleSaveWebhook = async (values: any) => {
    if (isNaN(partnerId)) return;
    const webhookId = webhooks.length > 0 ? webhooks[0].id : null;
    const payload: WebhookConfig = {
      partner_id: partnerId,
      url: values.url,
      events: values.events || [],
      is_active: values.is_active !== undefined ? values.is_active : true,
    };
    await saveWebhookConfig(webhookId || null, payload);
  };

  const handleDeleteWebhook = () => {
    if (webhooks.length === 0 || !webhooks[0].id) return;
    const webhookId = webhooks[0].id;
    modal.confirm({
      title: 'Delete Webhook Configuration',
      content: 'Are you sure you want to delete this webhook configuration? You will stop receiving all event notifications.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        const success = await deleteWebhook(webhookId, partnerId);
        if (success) {
          webhookForm.resetFields();
        }
      }
    });
  };

  const handleTriggerCheckout = async (values: any) => {
    if (isNaN(partnerId)) return;
    await initiateB2bCheckout(partnerId, values);
  };

  useEffect(() => {
    if (webhooks.length > 0) {
      webhookForm.setFieldsValue({
        url: webhooks[0].url,
        events: webhooks[0].events,
        is_active: webhooks[0].is_active,
      });
    }
  }, [webhooks, webhookForm]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTierBadgeColor = (tier?: PartnerTier) => {
    switch (tier) {
      case 'sandbox': return 'default';
      case 'starter': return 'blue';
      case 'growth': return 'green';
      case 'enterprise': return 'purple';
      default: return 'default';
    }
  };

  if (pageLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <Spin size="large" tip="Loading Partner details..." />
      </div>
    );
  }

  if (!selectedPartner) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/partners')} className="mb-6">
          Back to Partners
        </Button>
        <Alert type="error" message="Partner not found" description="The partner profile could not be loaded." showIcon />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}

      {/* ── Page Header & Navigation ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/partners')} className="rounded-lg h-10" />
          <div>
            <div className="flex items-center gap-3">
              <Title level={2} className="!mb-0 !text-primary">{selectedPartner.display_name}</Title>
              <Tag color={getTierBadgeColor(selectedPartner.tier)} className="text-xs px-2.5 py-0.5 rounded font-medium">
                {selectedPartner.tier?.toUpperCase()}
              </Tag>
              <Tag color={selectedPartner.is_active ? 'success' : 'error'} className="text-xs px-2.5 py-0.5 rounded font-medium">
                {selectedPartner.is_active ? 'ACTIVE' : 'INACTIVE'}
              </Tag>
              <Tooltip title={
                selectedPartner.service_mode === 'similarity_playback'
                  ? "Stores embeddings + peaks + segments for full playback."
                  : "Stores preview + embedding. Cheapest; preview kept so playback can be enabled later."
              }>
                <Tag color={selectedPartner.service_mode === 'similarity_playback' ? 'green' : 'default'} className="text-xs px-2.5 py-0.5 rounded font-medium cursor-pointer">
                  {selectedPartner.service_mode === 'similarity_playback' ? 'SIMILARITY + PLAYBACK' : 'SIMILARITY ONLY'}
                </Tag>
              </Tooltip>
            </div>
            <Text className="text-secondary text-sm font-mono mt-1 block">
              UUID: {selectedPartner.partner_uuid}
            </Text>
          </div>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={fetchAllData} className="h-10 rounded-lg flex items-center gap-2 border-default">
          Refresh Data
        </Button>
      </div>

      {/* ── Main Tabbed Panel ── */}
      <Card className="bg-surface border-default shadow-md rounded-xl overflow-hidden" styles={{ body: { padding: '24px' } }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          className="custom-tabs"
          items={[
            {
              key: '1',
              label: (
                <span className="flex items-center gap-2">
                  <User size={16} />
                  <span>Profile Overview</span>
                </span>
              ),
              children: (
                <div className="py-4">
                  <div className="flex justify-between items-center mb-6">
                    <Title level={4} className="!m-0 !text-primary">Corporate Profile</Title>
                    <Button 
                      type={editMode ? 'default' : 'primary'}
                      icon={<Edit size={16} />}
                      onClick={() => setEditMode(!editMode)}
                      className="rounded-lg flex items-center gap-2"
                    >
                      {editMode ? 'Cancel Edit' : 'Edit Profile'}
                    </Button>
                  </div>

                  {!editMode ? (
                    <Descriptions bordered column={{ xs: 1, sm: 2, md: 2 }} size="middle" className="rounded-xl overflow-hidden border-default">
                      <Descriptions.Item label="Display Name" className="text-primary font-medium">{selectedPartner.display_name}</Descriptions.Item>
                      <Descriptions.Item label="Legal Entity Name">{selectedPartner.legal_name}</Descriptions.Item>
                      <Descriptions.Item label="Contact Email">{selectedPartner.contact_email}</Descriptions.Item>
                      <Descriptions.Item label="VAT / Tax ID">{selectedPartner.vat_number || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Country Code">{selectedPartner.country_code || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Onboarded Date">
                        {selectedPartner.onboarded_at ? new Date(selectedPartner.onboarded_at).toLocaleString() : '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Service Mode">
                        <Tooltip title={
                          selectedPartner.service_mode === 'similarity_playback'
                            ? "Stores embeddings + peaks + segments for full playback."
                            : "Stores preview + embedding. Cheapest; preview kept so playback can be enabled later."
                        }>
                          <Tag color={selectedPartner.service_mode === 'similarity_playback' ? 'green' : 'default'} className="cursor-pointer">
                            {selectedPartner.service_mode === 'similarity_playback' ? 'SIMILARITY + PLAYBACK' : 'SIMILARITY ONLY'}
                          </Tag>
                        </Tooltip>
                      </Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <Form
                      form={editForm}
                      layout="vertical"
                      onFinish={handleUpdateProfile}
                      className="max-w-[700px] border border-default p-6 rounded-xl bg-background-secondary"
                    >
                      <Form.Item
                        name="display_name"
                        label={<Text className="font-semibold text-primary">Display Name</Text>}
                        rules={[{ required: true, message: 'Please enter display name' }]}
                      >
                        <Input className="h-11 rounded-lg" />
                      </Form.Item>
                      <Form.Item
                        name="legal_name"
                        label={<Text className="font-semibold text-primary">Legal Name</Text>}
                        rules={[{ required: true, message: 'Please enter legal entity name' }]}
                      >
                        <Input className="h-11 rounded-lg" />
                      </Form.Item>
                      <Form.Item
                        name="contact_email"
                        label={<Text className="font-semibold text-primary">Primary Contact Email</Text>}
                        rules={[
                          { required: true, message: 'Please enter contact email' },
                          { type: 'email', message: 'Enter a valid email' }
                        ]}
                      >
                        <Input className="h-11 rounded-lg" />
                      </Form.Item>
                      <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="tier" label={<Text className="font-semibold text-primary">Tier</Text>}>
                          <Select className="h-11 rounded-lg">
                            <Option value="sandbox">Sandbox</Option>
                            <Option value="starter">Starter</Option>
                            <Option value="growth">Growth</Option>
                            <Option value="enterprise">Enterprise</Option>
                          </Select>
                        </Form.Item>
                        <Form.Item 
                          name="service_mode" 
                          label={<Text className="font-semibold text-primary">Service Mode</Text>}
                          extra={<span className="text-amber-500 font-medium text-[10px] leading-tight block mt-0.5">Note: Changing this records intent but won't reprocess existing tracks yet.</span>}
                        >
                          <Select className="h-11 rounded-lg">
                            <Option value="similarity_only">Similarity only</Option>
                            <Option value="similarity_playback">Similarity + Playback</Option>
                          </Select>
                        </Form.Item>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="country_code" label={<Text className="font-semibold text-primary">Country (ISO)</Text>}>
                          <Input maxLength={2} className="h-11 rounded-lg" placeholder="US" />
                        </Form.Item>
                        <Form.Item name="vat_number" label={<Text className="font-semibold text-primary">VAT / Tax ID</Text>}>
                          <Input className="h-11 rounded-lg" placeholder="e.g. EU123456789" />
                        </Form.Item>
                      </div>
                      <Form.Item name="is_active" label={<Text className="font-semibold text-primary">Active Status</Text>} valuePropName="checked">
                        <Switch className="bg-secondary" />
                      </Form.Item>
                      <Form.Item className="!mb-0">
                        <Space>
                          <Button type="primary" htmlType="submit" className="h-10 rounded-lg px-6 font-semibold">
                            Save Profile
                          </Button>
                          <Button onClick={() => setEditMode(false)} className="h-10 rounded-lg px-6">
                            Cancel
                          </Button>
                        </Space>
                      </Form.Item>
                    </Form>
                  )}
                </div>
              )
            },
            {
              key: '2',
              label: (
                <span className="flex items-center gap-2">
                  <Server size={16} />
                  <span>SFTP Provisioning</span>
                </span>
              ),
              children: (
                <div className="py-4">
                  {sftpLoading ? (
                    <div className="flex justify-center py-12">
                      <Spin size="large" tip="Querying SFTP status..." />
                    </div>
                  ) : sftpData && sftpData.provisioned ? (
                    <div className="max-w-[800px]">
                      <Alert
                        type="success"
                        showIcon
                        icon={<CheckCircle2Icon />}
                        className="py-4 px-5 rounded-xl bg-success/5 border-success/15 mb-6"
                        message={
                          <div>
                            <Title level={5} className="!m-0 !text-success">SFTP Access Provisioned</Title>
                            <Text className="text-secondary text-sm block mt-1">
                              SFTP credentials and environment have been successfully created on the secure Hetzner cloud storage server.
                            </Text>
                          </div>
                        }
                      />

                      <Card 
                        title={<span className="flex items-center gap-2 text-primary font-semibold"><Terminal size={18} /><span>Secure Credentials</span></span>}
                        className="border-default rounded-xl shadow-sm mb-6"
                      >
                        <Descriptions bordered column={1} size="middle" className="rounded-xl overflow-hidden border-default">
                          <Descriptions.Item label="Host Server">
                            <Space>
                              <Text strong className="font-mono text-sm">{sftpData.host || 'sftp.resomix.com'}</Text>
                              <Button size="small" type="text" icon={<Copy size={14} />} onClick={() => copyToClipboard(sftpData.host || 'sftp.resomix.com')} />
                            </Space>
                          </Descriptions.Item>
                          <Descriptions.Item label="SFTP Port">
                            <span className="font-mono">{sftpData.port || 22}</span>
                          </Descriptions.Item>
                          <Descriptions.Item label="SFTP Username">
                            <Space>
                              <Text strong className="font-mono text-sm">{sftpData.username}</Text>
                              <Button size="small" type="text" icon={<Copy size={14} />} onClick={() => copyToClipboard(sftpData.username)} />
                            </Space>
                          </Descriptions.Item>
                          <Descriptions.Item label="Last Provisioned">
                            {sftpData.last_provisioned_at ? new Date(sftpData.last_provisioned_at).toLocaleString() : '—'}
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>

                      <Card 
                        title={
                          <div className="flex justify-between items-center w-full">
                            <span className="flex items-center gap-2 text-primary font-semibold">
                              <Shield size={18} />
                              <span>Limits & Quotas</span>
                            </span>
                            <Button 
                              type="link" 
                              onClick={() => {
                                const limits = sftpData.limits || {};
                                editLimitsForm.setFieldsValue({
                                  quota_gb: limits.quota_bytes !== null && limits.quota_bytes !== undefined
                                    ? limits.quota_bytes / 1073741824
                                    : null,
                                  quota_files: limits.quota_files,
                                  upload_bandwidth: limits.upload_bandwidth,
                                  download_bandwidth: limits.download_bandwidth,
                                  max_sessions: limits.max_sessions,
                                  upload_data_transfer: limits.upload_data_transfer,
                                  download_data_transfer: limits.download_data_transfer,
                                  total_data_transfer: limits.total_data_transfer,
                                });
                                setEditLimitsModalVisible(true);
                              }}
                              className="p-0 h-auto"
                            >
                              Edit Limits
                            </Button>
                          </div>
                        }
                        className="border-default rounded-xl shadow-sm mb-6"
                      >
                        <Descriptions bordered column={1} size="middle" className="rounded-xl overflow-hidden border-default">
                          <Descriptions.Item label="Storage Quota">
                            {formatLimitValue('quota_gb', sftpData.limits?.quota_bytes, selectedPartner.tier)}
                          </Descriptions.Item>
                          <Descriptions.Item label="File Count Limit">
                            {formatLimitValue('quota_files', sftpData.limits?.quota_files, selectedPartner.tier)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Upload Bandwidth">
                            {formatLimitValue('upload_bandwidth', sftpData.limits?.upload_bandwidth, selectedPartner.tier)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Download Bandwidth">
                            {formatLimitValue('download_bandwidth', sftpData.limits?.download_bandwidth, selectedPartner.tier)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Max Sessions">
                            {formatLimitValue('max_sessions', sftpData.limits?.max_sessions, selectedPartner.tier)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Upload Data Transfer">
                            {formatLimitValue('upload_data_transfer', sftpData.limits?.upload_data_transfer, selectedPartner.tier)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Download Data Transfer">
                            {formatLimitValue('download_data_transfer', sftpData.limits?.download_data_transfer, selectedPartner.tier)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Total Data Transfer">
                            {formatLimitValue('total_data_transfer', sftpData.limits?.total_data_transfer, selectedPartner.tier)}
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>

                      <div className="bg-background-secondary border border-default rounded-xl p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <Title level={5} className="!mb-1 flex items-center gap-2 text-primary"><Activity size={16} /><span>Redeploy Server Access</span></Title>
                          <Text className="text-secondary text-xs">
                            Trigger standard configuration tasks again if connection details change or server encounters sync issues.
                          </Text>
                        </div>
                        <Button 
                          icon={<RotateCw size={16} />} 
                          onClick={() => setRetrySftpModalVisible(true)}
                          className="h-10 rounded-lg flex items-center gap-2 border-default hover:border-primary hover:text-primary font-medium"
                        >
                          Retry Provisioning
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[700px]">
                      <Alert
                        type="warning"
                        showIcon
                        className="py-4 px-5 rounded-xl bg-warning/5 border-warning/15 mb-6"
                        message={
                          <div>
                            <Title level={5} className="!m-0 !text-warning">SFTP Setup Pending</Title>
                            <Text className="text-secondary text-sm block mt-1">
                              This B2B Partner does not currently have SFTP access set up. Fill out the configuration below to provision secure cloud directory access immediately.
                            </Text>
                          </div>
                        }
                      />

                      <Card 
                        title={<span className="flex items-center gap-2 text-primary font-semibold"><Server size={18} /><span>Provision SFTP Credentials</span></span>}
                        className="border-default rounded-xl shadow-sm"
                      >
                        <Form
                          form={sftpForm}
                          layout="vertical"
                          onFinish={handleProvisionSftp}
                        >
                          <Form.Item
                            name="password"
                            label={<Text className="font-semibold text-primary">SFTP Password</Text>}
                            rules={[{ required: true, message: 'Password is required for credentials' }]}
                          >
                            <Input.Password className="h-11 rounded-lg" placeholder="••••••••••••" />
                          </Form.Item>

                          <Form.Item
                            name="allowed_ip"
                            label={<Text className="font-semibold text-primary">Allowed IP / CIDR Range (Optional)</Text>}
                            tooltip="Optional comma-separated list of IP addresses or CIDR blocks authorized to connect."
                          >
                            <Input className="h-11 rounded-lg font-mono" placeholder="e.g. 192.168.1.1, 10.0.0.0/24" />
                          </Form.Item>

                          <Form.Item className="mb-4">
                            <Space align="center">
                              <Switch checked={usePubKey} onChange={setUsePubKey} className="bg-secondary" />
                              <Text className="font-medium text-primary">Enable SSH Public Key Authentication</Text>
                            </Space>
                          </Form.Item>

                          {usePubKey && (
                            <Form.Item
                              name="public_key"
                              label={<Text className="font-semibold text-primary">SSH Public Key</Text>}
                              rules={[{ required: true, message: 'Please paste the partner SSH public key' }]}
                            >
                              <Input.TextArea 
                                placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC..." 
                                rows={4}
                                className="font-mono rounded-lg"
                              />
                            </Form.Item>
                          )}

                          <Form.Item className="mb-4">
                            <Space align="center">
                              <Switch checked={showAdvancedLimits} onChange={setShowAdvancedLimits} className="bg-secondary" />
                              <Text className="font-medium text-primary">Configure Custom Limits & Quotas</Text>
                            </Space>
                          </Form.Item>

                          {showAdvancedLimits && (
                            <div className="bg-background-secondary p-5 rounded-xl border border-default mb-4">
                              <Title level={5} className="!mb-4 text-primary">Custom Limit Overrides</Title>
                              <Row gutter={[16, 16]}>
                                <Col span={12}>
                                  <Form.Item
                                    name="quota_gb"
                                    label={<Text className="font-semibold text-primary">Storage Quota (GB)</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={1}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).quota_gb} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item
                                    name="quota_files"
                                    label={<Text className="font-semibold text-primary">File Count Limit</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={1}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).quota_files} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item
                                    name="upload_bandwidth"
                                    label={<Text className="font-semibold text-primary">Upload Bandwidth (KB/s)</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={128}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).upload_bandwidth} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item
                                    name="download_bandwidth"
                                    label={<Text className="font-semibold text-primary">Download Bandwidth (KB/s)</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={128}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).download_bandwidth} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item
                                    name="max_sessions"
                                    label={<Text className="font-semibold text-primary">Max Sessions</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={1}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).max_sessions} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item
                                    name="upload_data_transfer"
                                    label={<Text className="font-semibold text-primary">Upload Data Transfer (MB)</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={10}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).upload_data_transfer} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item
                                    name="download_data_transfer"
                                    label={<Text className="font-semibold text-primary">Download Data Transfer (MB)</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={10}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).download_data_transfer} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={12}>
                                  <Form.Item
                                    name="total_data_transfer"
                                    label={<Text className="font-semibold text-primary">Total Data Transfer (MB)</Text>}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={10}
                                      className="w-full h-11 rounded-lg flex items-center"
                                      placeholder={`${getTierDefaults(selectedPartner.tier).total_data_transfer} (Plan Default)`}
                                    />
                                  </Form.Item>
                                </Col>
                              </Row>
                            </div>
                          )}

                          <Form.Item className="!mb-0 mt-6">
                            <Button 
                              type="primary" 
                              htmlType="submit"
                              size="large"
                              className="w-full h-12 rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2"
                            >
                              <Server size={18} />
                              <span>Provision Secure Directory Access</span>
                            </Button>
                          </Form.Item>
                        </Form>
                      </Card>
                    </div>
                  )}
                </div>
              )
            },
            {
              key: '3',
              label: (
                <span className="flex items-center gap-2">
                  <Key size={16} />
                  <span>API Keys</span>
                </span>
              ),
              children: (
                <div className="py-4">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <Title level={4} className="!mb-1 !text-primary">B2B Integration Access Keys</Title>
                      <Text className="text-secondary text-sm">Issue and manage API integration credentials for partner services.</Text>
                    </div>
                    <Button 
                      type="primary" 
                      icon={<Plus size={18} />}
                      onClick={() => setIssueKeyModalVisible(true)}
                      className="h-10 rounded-lg flex items-center gap-2"
                    >
                      Issue New Key
                    </Button>
                  </div>

                  <List
                    dataSource={apiKeys}
                    loading={keysLoading}
                    rowKey="id"
                    renderItem={(key: PartnerApiKey) => {
                      const usage = key.usage_count || 0;
                      const limit = key.rate_limit_monthly || 0;
                      const percentage = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;
                      const isNearLimit = percentage > 80;

                      return (
                        <Card 
                          className={`mb-4 border-default rounded-xl shadow-sm hover:shadow-md transition-shadow ${!key.is_active ? 'opacity-70 bg-background-secondary grayscale-[0.3]' : ''}`}
                          styles={{ body: { padding: '20px' } }}
                        >
                          <div className="flex flex-col md:flex-row justify-between gap-6">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <Title level={5} className="!m-0 !text-primary">{key.label}</Title>
                                <Badge status={key.is_active ? 'success' : 'default'} text={key.is_active ? 'Active' : 'Revoked'} />
                                <code className="bg-background-secondary text-primary px-2 py-0.5 rounded text-xs font-mono border border-default">
                                  {key.key_prefix}...
                                </code>
                              </div>
                              
                              <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4">
                                <div className="flex items-center gap-2 text-secondary text-xs">
                                  <Calendar size={14} />
                                  <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-secondary text-xs">
                                  <Clock size={14} />
                                  <span>Last Used: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}</span>
                                </div>
                                {key.expires_at && (
                                  <div className="flex items-center gap-2 text-secondary text-xs">
                                    <AlertTriangle size={14} className={new Date(key.expires_at) < new Date() ? 'text-error' : 'text-warning'} />
                                    <span>Expires: {new Date(key.expires_at).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>

                              <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Shield size={14} className="text-secondary" />
                                  <Text className="text-xs font-medium text-secondary uppercase tracking-wider">Authorized Scopes</Text>
                                </div>
                                <Space wrap size={4}>
                                  {key.scopes?.map(scope => (
                                    <Tag key={scope} className="m-0 bg-primary/5 text-primary border-primary/10 px-2 py-0.5 rounded">
                                      {scope}
                                    </Tag>
                                  ))}
                                </Space>
                              </div>

                              {!key.is_active && key.revoked_at && (
                                <Alert
                                  type="error"
                                  showIcon
                                  className="py-2 px-3 rounded-lg bg-error/5 border-error/10"
                                  message={
                                    <div className="text-xs">
                                      <Text strong className="text-error">Revoked on {new Date(key.revoked_at).toLocaleString()}</Text>
                                      <div className="mt-1 text-secondary italic">Reason: {key.revoked_reason || 'No reason provided'}</div>
                                    </div>
                                  }
                                />
                              )}
                            </div>

                            <div className="md:w-64 flex flex-col justify-between border-l border-default pl-0 md:pl-6">
                              <div>
                                <Text className="text-xs font-medium text-secondary uppercase tracking-wider mb-2 block">Monthly Consumption</Text>
                                <div className="flex justify-between mb-1">
                                  <Text className="text-[10px] font-bold text-primary">
                                    {usage.toLocaleString()} / {limit.toLocaleString()}
                                  </Text>
                                  <Text className={`text-[10px] font-bold ${isNearLimit ? 'text-error' : 'text-primary'}`}>
                                    {Math.round(percentage)}%
                                  </Text>
                                </div>
                                <div className="h-2 w-full bg-background-secondary rounded-full overflow-hidden border border-default shadow-inner">
                                  <div 
                                    className={`h-full transition-all duration-500 ${isNearLimit ? 'bg-error' : 'bg-primary'}`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <Text className="text-[10px] text-secondary mt-1.5 block">Burst Rate Limit: <Text strong>{key.rate_limit_rps} RPS</Text></Text>
                              </div>

                              <div className="flex justify-end gap-2 mt-4">
                                {key.is_active && (
                                  <>
                                    <Button 
                                      type="default"
                                      icon={<RotateCw size={16} />} 
                                      onClick={() => handleRotateKey(key)}
                                      className="rounded-lg flex items-center gap-2"
                                    >
                                      Rotate
                                    </Button>
                                    <Button 
                                      danger
                                      icon={<Ban size={16} />} 
                                      onClick={() => handleRevokeKey(key)}
                                      className="rounded-lg flex items-center gap-2"
                                    >
                                      Revoke
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    }}
                  />
                </div>
              )
            },
            {
              key: '4',
              label: (
                <span className="flex items-center gap-2">
                  <CreditCard size={16} />
                  <span>Webhooks & Subscription</span>
                </span>
              ),
              children: (
                <div className="py-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Webhook Configuration Card */}
                    <Card
                      title={<span className="flex items-center gap-2 text-primary font-semibold"><Globe size={18} /><span>Webhook Configuration</span></span>}
                      className="border-default rounded-xl shadow-sm h-full"
                    >
                      <Form
                        form={webhookForm}
                        layout="vertical"
                        onFinish={handleSaveWebhook}
                      >
                        <Form.Item
                          name="url"
                          label={<Text className="font-semibold text-primary">Webhook Endpoint URL</Text>}
                          rules={[
                            { required: true, message: 'Please enter webhook endpoint URL' },
                            { type: 'url', message: 'Enter a valid URL (must start with https://)' }
                          ]}
                          extra="Your server must respond with a 2xx status code to acknowledge delivery."
                        >
                          <Input className="h-11 rounded-lg" placeholder="https://your-domain.com/webhooks/resomix" />
                        </Form.Item>

                        <Form.Item
                          name="events"
                          label={<Text className="font-semibold text-primary">Event Subscriptions</Text>}
                          rules={[{ required: true, message: 'Select at least one event type' }]}
                        >
                          <Select mode="multiple" className="rounded-lg min-h-11" placeholder="Select event types">
                            <Option value="ingestion.started">ingestion.started (SFTP Detected)</Option>
                            <Option value="ingestion.completed">ingestion.completed (CSV Processed)</Option>
                            <Option value="ingestion.failed">ingestion.failed (Ingestion Failed)</Option>
                            <Option value="track.indexed">track.indexed (Single Track Indexed)</Option>
                            <Option value="quota.warning">quota.warning (80% Quota reached)</Option>
                            <Option value="quota.exceeded">quota.exceeded (100% Quota exceeded)</Option>
                            <Option value="embedding.deleted">embedding.deleted (TTL Expired)</Option>
                          </Select>
                        </Form.Item>

                        <Form.Item name="is_active" label={<Text className="font-semibold text-primary">Webhook Status</Text>} valuePropName="checked">
                          <Switch className="bg-secondary" checkedChildren="Active" unCheckedChildren="Inactive" />
                        </Form.Item>

                        {webhooks.length > 0 && webhooks[0].signing_secret && (
                          <div className="mb-6 p-4 rounded-xl border border-default bg-background-secondary">
                            <Text className="text-secondary text-xs block mb-1">Webhook Signing Secret (HMAC-SHA256)</Text>
                            <Space className="w-full justify-between">
                              <code className="font-mono text-xs text-primary bg-surface/50 px-2 py-1 rounded border border-default">
                                {webhooks[0].signing_secret}
                              </code>
                              <Button size="small" type="text" icon={<Copy size={14} />} onClick={() => copyToClipboard(webhooks[0].signing_secret || '')} />
                            </Space>
                            <Text className="text-secondary text-[10px] block mt-1">Used to verify payloads in X-Resomix-Signature header.</Text>
                          </div>
                        )}

                        <Form.Item className="!mb-0">
                          <Space className="w-full flex">
                            <Button type="primary" htmlType="submit" loading={webhooksLoading} className="h-10 rounded-lg font-semibold flex-1">
                              Save Webhook Settings
                            </Button>
                            {webhooks.length > 0 && (
                              <Button 
                                danger 
                                type="default" 
                                icon={<Trash2 size={16} />} 
                                loading={webhooksLoading} 
                                onClick={handleDeleteWebhook} 
                                className="h-10 rounded-lg font-semibold flex-initial"
                              >
                                Delete
                              </Button>
                            )}
                          </Space>
                        </Form.Item>
                      </Form>
                    </Card>

                    {/* Stripe Billing Configuration Card */}
                    <Card
                      title={<span className="flex items-center gap-2 text-primary font-semibold"><CreditCard size={18} /><span>Stripe B2B Subscription</span></span>}
                      className="border-default rounded-xl shadow-sm h-full"
                    >
                      <Form
                        form={checkoutForm}
                        layout="vertical"
                        onFinish={handleTriggerCheckout}
                        initialValues={{ tier: 'starter', billing_cycle: 'monthly' }}
                      >
                        <Alert
                          type="info"
                          showIcon
                          className="py-3 px-4 rounded-xl bg-info/5 border-info/10 mb-6 text-sm"
                          message="Triggers a secure Stripe Billing onboarding checkout session with automatic EU Tax calculation and VIES B2B registration validation."
                        />

                        <Form.Item name="tier" label={<Text className="font-semibold text-primary">Subscription Plan</Text>}>
                          <Select className="h-11 rounded-lg">
                            <Option value="starter">Starter Monthly (€99/mo)</Option>
                            <Option value="growth">Growth Monthly (€299/mo)</Option>
                            <Option value="growth_annual">Growth Annual (€2,990/yr)</Option>
                            <Option value="enterprise">Enterprise Monthly (€999/mo)</Option>
                            <Option value="enterprise_annual">Enterprise Annual (€9,990/yr)</Option>
                          </Select>
                        </Form.Item>

                        <Form.Item name="billing_cycle" label={<Text className="font-semibold text-primary">Billing Cycle</Text>}>
                          <Select className="h-11 rounded-lg">
                            <Option value="monthly">Monthly Cycle</Option>
                            <Option value="annual">Annual Cycle (Save 2 Months)</Option>
                          </Select>
                        </Form.Item>

                        <Form.Item name="po_number" label={<Text className="font-semibold text-primary">Client Purchase Order (PO Number)</Text>}>
                          <Input className="h-11 rounded-lg font-mono" placeholder="e.g. PO-887766" />
                        </Form.Item>

                        <Form.Item className="!mb-0">
                          <Button type="primary" htmlType="submit" className="h-12 rounded-lg font-semibold w-full flex items-center justify-center gap-2 shadow-sm">
                            <CreditCard size={18} />
                            <span>Launch B2B Stripe Onboarding</span>
                          </Button>
                        </Form.Item>
                      </Form>
                    </Card>
                  </div>

                  {/* Webhook Delivery Logs Section */}
                  <div className="mt-8">
                    <Title level={4} className="!mb-3 !text-primary flex items-center gap-2"><Activity size={18} /><span>Failed Webhook Deliveries</span></Title>
                    <Text className="text-secondary text-sm block mb-6">Audit log of B2B webhook delivery failures. Manual retries use exponential-backoff triggers.</Text>

                    <Card className="border-default rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                      {logsLoading ? (
                        <div className="py-12 flex justify-center"><Spin tip="Loading delivery logs..." /></div>
                      ) : failedLogs.length === 0 ? (
                        <div className="py-12 text-center text-secondary text-sm">
                          <CheckCircle2Icon />
                          <div className="mt-2 font-medium text-secondary">All systems green! No failed webhook deliveries logged.</div>
                        </div>
                      ) : (
                        <List
                          dataSource={failedLogs}
                          renderItem={(log: WebhookDeliveryLog) => (
                            <div className="p-5 border-b border-default last:border-0 hover:bg-background-secondary transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Tag color="error" className="font-mono text-xs rounded">HTTP {log.response_status}</Tag>
                                  <Text strong className="text-primary text-sm font-mono">{log.event_type}</Text>
                                  <Text className="text-secondary text-xs font-mono">Log ID: {log.id}</Text>
                                </div>
                                <div className="text-xs text-secondary font-mono mb-2">
                                  Attempted At: {new Date(log.delivered_at).toLocaleString()}
                                </div>
                                <div className="p-3 bg-background-secondary/80 rounded border border-default font-mono text-[11px] text-secondary max-h-24 overflow-y-auto w-full">
                                  <strong>Response Body:</strong> {log.response_body || '—'}
                                </div>
                              </div>
                              <Button 
                                type="primary" 
                                icon={<RotateCw size={14} />} 
                                onClick={() => retryWebhook(log.id)}
                                className="h-9 rounded-lg flex items-center gap-1.5 font-medium text-xs shadow-sm"
                              >
                                Retry Delivery
                              </Button>
                            </div>
                          )}
                        />
                      )}
                    </Card>
                  </div>
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* ── Edit SFTP Limits Modal ── */}
      <Modal
        title="Edit SFTP Limits"
        open={editLimitsModalVisible}
        onCancel={() => setEditLimitsModalVisible(false)}
        onOk={() => editLimitsForm.submit()}
        width={650}
      >
        <Alert
          type="info"
          message="Custom Limit Overrides"
          description="Specify values here to override the default limits for this partner's tier. Enter 0 for Unlimited. Leave a field blank (or delete its value) to fall back to the plan defaults."
          showIcon
          className="mt-4 mb-6 rounded-lg"
        />
        <Form
          form={editLimitsForm}
          layout="vertical"
          onFinish={handleUpdateSftpLimits}
        >
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item
                name="quota_gb"
                label={<Text className="font-semibold text-primary">Storage Quota (GB)</Text>}
              >
                <InputNumber
                  min={0}
                  step={1}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).quota_gb} (Plan Default)`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="quota_files"
                label={<Text className="font-semibold text-primary">File Count Limit</Text>}
              >
                <InputNumber
                  min={0}
                  step={1}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).quota_files} (Plan Default)`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="upload_bandwidth"
                label={<Text className="font-semibold text-primary">Upload Bandwidth (KB/s)</Text>}
              >
                <InputNumber
                  min={0}
                  step={128}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).upload_bandwidth} (Plan Default)`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="download_bandwidth"
                label={<Text className="font-semibold text-primary">Download Bandwidth (KB/s)</Text>}
              >
                <InputNumber
                  min={0}
                  step={128}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).download_bandwidth} (Plan Default)`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_sessions"
                label={<Text className="font-semibold text-primary">Max Sessions</Text>}
              >
                <InputNumber
                  min={0}
                  step={1}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).max_sessions} (Plan Default)`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="upload_data_transfer"
                label={<Text className="font-semibold text-primary">Upload Data Transfer (MB)</Text>}
              >
                <InputNumber
                  min={0}
                  step={10}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).upload_data_transfer} (Plan Default)`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="download_data_transfer"
                label={<Text className="font-semibold text-primary">Download Data Transfer (MB)</Text>}
              >
                <InputNumber
                  min={0}
                  step={10}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).download_data_transfer} (Plan Default)`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="total_data_transfer"
                label={<Text className="font-semibold text-primary">Total Data Transfer (MB)</Text>}
              >
                <InputNumber
                  min={0}
                  step={10}
                  className="w-full h-11 rounded-lg flex items-center"
                  placeholder={`${getTierDefaults(selectedPartner.tier).total_data_transfer} (Plan Default)`}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Retry SFTP Provisioning Modal ── */}
      <Modal
        title="Retry SFTP Provisioning"
        open={retrySftpModalVisible}
        onCancel={() => setRetrySftpModalVisible(false)}
        onOk={() => retrySftpForm.submit()}
      >
        <Alert
          type="info"
          message="Password Required"
          description="To retry provisioning, you must enter the partner's SFTP password again. Plaintext passwords are not stored by the system."
          showIcon
          className="mt-4 mb-6 rounded-lg"
        />
        <Form
          form={retrySftpForm}
          layout="vertical"
          onFinish={handleRetrySftp}
        >
          <Form.Item
            name="password"
            label={<Text className="font-semibold text-primary">SFTP Password</Text>}
            rules={[{ required: true, message: 'Password is required to retry provisioning' }]}
          >
            <Input.Password className="h-11 rounded-lg" placeholder="••••••••••••" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Issue Key Modal ── */}
      <Modal
        title="Issue New API Key"
        open={issueKeyModalVisible}
        onCancel={() => setIssueKeyModalVisible(false)}
        onOk={() => issueKeyForm.submit()}
      >
        <Form
          form={issueKeyForm}
          layout="vertical"
          onFinish={handleIssueKey}
          initialValues={{ 
            label: 'Production Integration Key', 
            scopes: ['search:read'],
            rate_limit_rps: 10,
            rate_limit_monthly: 100000
          }}
          className="mt-4"
        >
          <Form.Item
            name="label"
            label={<Text className="font-semibold text-primary">Key Label</Text>}
            rules={[{ required: true, message: 'Please enter key label' }]}
          >
            <Input placeholder="e.g. Mobile App Integration" className="h-11 rounded-lg" />
          </Form.Item>
          <Form.Item
            name="scopes"
            label={<Text className="font-semibold text-primary">Authorized Scopes</Text>}
            rules={[{ required: true, message: 'Select at least one scope' }]}
          >
            <Select mode="multiple" className="rounded-lg min-h-11">
              <Option value="search:read">search:read</Option>
              <Option value="ingest:write">ingest:write</Option>
              <Option value="metadata:read">metadata:read</Option>
              <Option value="analytics:read">analytics:read</Option>
            </Select>
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="rate_limit_rps" label={<Text className="font-semibold text-primary">Rate Limit (RPS)</Text>}>
              <Input type="number" min={1} className="h-11 rounded-lg" />
            </Form.Item>
            <Form.Item name="rate_limit_monthly" label={<Text className="font-semibold text-primary">Monthly Quota</Text>}>
              <Input type="number" min={0} className="h-11 rounded-lg" />
            </Form.Item>
          </div>
          <Form.Item name="expires_at" label={<Text className="font-semibold text-primary">Expiration Date (Optional)</Text>}>
            <Input type="date" className="h-11 rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Revealed Key Modal (Plaintext) ── */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <Check size={24} className="text-success" />
            <Title level={4} className="!m-0">New API Key Generated</Title>
          </div>
        }
        open={newKeyVisible}
        onCancel={() => setNewKeyVisible(false)}
        centered
        footer={[
          <Button key="done" type="primary" size="large" onClick={() => setNewKeyVisible(false)} className="rounded-lg w-full mt-4">
            I have securely saved this key
          </Button>
        ]}
      >
        <Alert
          type="warning"
          message="Important Security Notice"
          description="For security reasons, we can only show this plaintext key once. Please copy and store it in a secure location immediately. If lost, you must rotate the key to generate a new one."
          showIcon
          className="mb-6 rounded-lg border-warning/20 bg-warning/5"
        />
        <div className="bg-surface-secondary p-6 rounded-xl relative group border border-default shadow-inner">
          <Paragraph className="!mb-0 text-primary font-mono text-lg leading-relaxed break-all pr-12 tracking-wide">
            {revealedKey?.plaintext_key}
          </Paragraph>
          <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
            <Button 
              className={`absolute top-6 right-6 flex items-center justify-center transition-all duration-300 ${
                copied 
                  ? 'bg-success/10 border-success text-success' 
                  : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary'
              }`}
              size="middle"
              icon={copied ? <Check size={18} /> : <Copy size={18} />}
              onClick={() => copyToClipboard(revealedKey?.plaintext_key || '')}
            />
          </Tooltip>
        </div>
        <div className="mt-6 flex justify-between items-center bg-background-secondary p-4 rounded-lg border border-default">
          <Text className="text-secondary text-sm">Key Label</Text>
          <Text strong className="text-primary text-sm">{revealedKey?.label}</Text>
        </div>
      </Modal>

      {/* ── Status Modals ── */}
      <StatusModal
        type="error"
        visible={errorModalVisible}
        title={errorDetails?.title || 'Error'}
        message={errorDetails?.message || ''}
        onClose={closeErrorModal}
      />
      <StatusModal
        type="success"
        visible={successModalVisible}
        title={successDetails?.title || 'Success'}
        message={successDetails?.message || ''}
        onClose={closeSuccessModal}
      />
    </div>
  );
}

// Inline replacement icon since CheckCircle2 isn't directly loaded
function CheckCircle2Icon() {
  return <Check size={20} className="text-success" />;
}

export default PartnerDetailsPage;
