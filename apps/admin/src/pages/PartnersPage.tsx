import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Card, 
  Typography, 
  Tooltip, 
  Alert,
  message,
  List,
  Badge
} from 'antd';
import { 
  Plus, 
  Key, 
  RotateCw, 
  Ban, 
  Copy, 
  CheckCircle2,
  Edit,
  Trash2,
  Calendar,
  Shield,
  Clock,
  AlertTriangle,
  Check
} from 'lucide-react';
import { useStatusModals, usePartners } from '@resomix/hooks';
import { StatusModal } from '@resomix/ui';
import type { 
  Partner, 
  PartnerApiKey, 
  PartnerTier, 
  PartnerCreateRequest, 
  ApiKeyIssueRequest 
} from '@resomix/api-client';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

function PartnersPage() {
  const [modal, modalContextHolder] = Modal.useModal();
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
    partners,
    loading,
    pagination,
    tierFilter,
    activeFilter,
    setTierFilter,
    setActiveFilter,
    selectedPartner,
    setSelectedPartner,
    apiKeys,
    keysLoading,
    fetchPartners,
    fetchApiKeys,
    createPartner,
    issueApiKey,
    revokeKey,
    rotateKey,
    updatePartner,
    deletePartner,
    handlePageChange,
  } = usePartners({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  });

  // Modals visibility
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [keysModalVisible, setKeysModalVisible] = useState(false);
  const [issueKeyModalVisible, setIssueKeyModalVisible] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ plaintext_key: string; label: string } | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [copied, setCopied] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [issueKeyForm] = Form.useForm();

  const handleCreatePartner = async (values: PartnerCreateRequest) => {
    const success = await createPartner(values);
    if (success) {
      setCreateModalVisible(false);
      createForm.resetFields();
    }
  };

  const handleEditPartner = (partner: Partner) => {
    setEditingPartner(partner);
    editForm.setFieldsValue(partner);
    setEditModalVisible(true);
  };

  const onUpdatePartner = async (values: Partial<PartnerCreateRequest>) => {
    if (!editingPartner) return;
    const success = await updatePartner(editingPartner.id, values);
    if (success) {
      setEditModalVisible(false);
      setEditingPartner(null);
    }
  };

  const handleDeletePartner = (partner: Partner) => {
    modal.confirm({
      title: 'Delete Partner',
      content: `Are you sure you want to delete ${partner.display_name}? This will revoke all associated API keys and remove all data.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        await deletePartner(partner.id);
      }
    });
  };

  const handleIssueKey = async (values: Omit<ApiKeyIssueRequest, 'partner_id'>) => {
    if (!selectedPartner) return;
    const payload = {
      partner_id: selectedPartner.id,
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
          message.error('Please provide a reason (min 5 chars)');
          return Promise.reject();
        }
        await revokeKey(key.id, reason);
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns = [
    {
      title: 'Partner',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text: string, record: Partner) => (
        <Space direction="vertical" size={2}>
          <Link to={`/partners/${record.id}`}>
            <Text strong className="text-primary text-base hover:underline cursor-pointer">{text}</Text>
          </Link>
          <Text className="text-secondary text-xs">{record.legal_name}</Text>
        </Space>
      ),
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      render: (tier: PartnerTier) => {
        const colors: Record<PartnerTier, string> = {
          sandbox: 'default',
          starter: 'blue',
          growth: 'green',
          enterprise: 'purple'
        };
        return <Tag color={colors[tier]}>{tier.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'error'}>
          {active ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      ),
    },
    {
      title: 'Contact',
      dataIndex: 'contact_email',
      key: 'contact_email',
      render: (email: string) => (
        <Text copyable={{ text: email }}>{email}</Text>
      ),
    },
    {
      title: 'Onboarded',
      dataIndex: 'onboarded_at',
      key: 'onboarded_at',
      render: (date: string) => <Text className="text-secondary">{new Date(date).toLocaleDateString()}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: Partner) => (
        <Space>
          <Tooltip title="Manage API Keys">
            <Button 
              icon={<Key size={16} />} 
              onClick={() => {
                setSelectedPartner(record);
                fetchApiKeys(record.id);
                setKeysModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit Partner">
            <Button 
              icon={<Edit size={16} />} 
              onClick={() => handleEditPartner(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Partner">
            <Button 
              danger
              icon={<Trash2 size={16} />} 
              onClick={() => handleDeletePartner(record)}
            />
          </Tooltip>
          <Link to={`/partners/${record.id}`}>
            <Button 
              type="default" 
              icon={<Shield size={16} />}
              className="flex items-center gap-2 border-default hover:border-primary hover:text-primary"
            >
              View Details
            </Button>
          </Link>
        </Space>
      ),
    },
  ];
  
  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <Title level={2} className="!mb-1 !text-primary">Partner Management</Title>
          <Text className="text-secondary text-base">Manage B2B tenants and their API access keys.</Text>
        </div>
        <Button 
          type="primary" 
          size="large"
          icon={<Plus size={18} />} 
          onClick={() => setCreateModalVisible(true)}
          className="h-12 px-6 rounded-lg shadow-sm"
        >
          Add Partner
        </Button>
      </div>

      <Card className="mb-8 bg-surface border-default shadow-sm rounded-xl overflow-hidden">
        <Space wrap size={24} className="w-full">
          <div className="flex flex-col gap-1.5">
            <Text className="text-secondary text-xs font-medium uppercase tracking-wider">Filter by Tier</Text>
            <Select 
              placeholder="All Tiers" 
              allowClear 
              style={{ width: 180 }}
              className="h-10"
              value={tierFilter}
              onChange={setTierFilter}
            >
              <Option value="sandbox">Sandbox</Option>
              <Option value="starter">Starter</Option>
              <Option value="growth">Growth</Option>
              <Option value="enterprise">Enterprise</Option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Text className="text-secondary text-xs font-medium uppercase tracking-wider">Status</Text>
            <Select 
              placeholder="All Status" 
              allowClear 
              style={{ width: 160 }}
              className="h-10"
              value={activeFilter}
              onChange={setActiveFilter}
            >
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </div>
          <div className="flex items-end h-full pt-6">
            <Button 
              icon={<RotateCw size={16} />} 
              onClick={() => void fetchPartners()}
              className="h-10 border-default hover:border-primary flex items-center gap-2"
            >
              Refresh
            </Button>
          </div>
        </Space>
      </Card>

      <div className="bg-surface rounded-xl shadow-md border border-default overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={partners} 
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
            showSizeChanger: true,
          }}
        />
      </div>

      {/* Edit Partner Modal */}
      <Modal
        title="Edit Partner"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        okText="Update Partner"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={onUpdatePartner}
          className="mt-4"
        >
          <Form.Item
            name="display_name"
            label={<Text className="font-medium text-primary">Display Name</Text>}
            rules={[{ required: true, message: 'Please enter display name' }]}
          >
            <Input placeholder="e.g. Acme Corp" className="h-11 rounded-lg" />
          </Form.Item>
          <Form.Item
            name="legal_name"
            label={<Text className="font-medium text-primary">Legal Entity Name</Text>}
            rules={[{ required: true, message: 'Please enter legal name' }]}
          >
            <Input placeholder="e.g. Acme Corporation Ltd." className="h-11 rounded-lg" />
          </Form.Item>
          <Form.Item
            name="contact_email"
            label={<Text className="font-medium text-primary">Primary Contact Email</Text>}
            rules={[
              { required: true, message: 'Please enter contact email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="admin@acme.com" className="h-11 rounded-lg" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="tier" label={<Text className="font-medium text-primary">Partnership Tier</Text>}>
              <Select className="h-11 rounded-lg">
                <Option value="sandbox">Sandbox</Option>
                <Option value="starter">Starter</Option>
                <Option value="growth">Growth</Option>
                <Option value="enterprise">Enterprise</Option>
              </Select>
            </Form.Item>
            <Form.Item name="country_code" label={<Text className="font-medium text-primary">Country (ISO)</Text>}>
              <Input placeholder="US, GB, etc." maxLength={2} className="h-11 rounded-lg" />
            </Form.Item>
          </div>
          <Form.Item name="vat_number" label={<Text className="font-medium text-primary">VAT / Tax ID (Optional)</Text>}>
            <Input placeholder="EU123456789" className="h-11 rounded-lg" />
          </Form.Item>
          <Form.Item name="is_active" label={<Text className="font-medium text-primary">Status</Text>}>
            <Select className="h-11 rounded-lg">
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Register New Partner"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => createForm.submit()}
        okText="Create Partner"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreatePartner}
          initialValues={{ tier: 'sandbox' }}
          className="mt-4"
        >
          <Form.Item
            name="display_name"
            label={<Text className="font-medium text-primary">Display Name</Text>}
            rules={[{ required: true, message: 'Please enter display name' }]}
          >
            <Input placeholder="e.g. Acme Corp" className="h-11 rounded-lg" />
          </Form.Item>
          <Form.Item
            name="legal_name"
            label={<Text className="font-medium text-primary">Legal Entity Name</Text>}
            rules={[{ required: true, message: 'Please enter legal name' }]}
          >
            <Input placeholder="e.g. Acme Corporation Ltd." className="h-11 rounded-lg" />
          </Form.Item>
          <Form.Item
            name="contact_email"
            label={<Text className="font-medium text-primary">Primary Contact Email</Text>}
            rules={[
              { required: true, message: 'Please enter contact email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="admin@acme.com" className="h-11 rounded-lg" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="tier" label={<Text className="font-medium text-primary">Partnership Tier</Text>}>
              <Select className="h-11 rounded-lg">
                <Option value="sandbox">Sandbox</Option>
                <Option value="starter">Starter</Option>
                <Option value="growth">Growth</Option>
                <Option value="enterprise">Enterprise</Option>
              </Select>
            </Form.Item>
            <Form.Item name="country_code" label={<Text className="font-medium text-primary">Country (ISO)</Text>}>
              <Input placeholder="US, GB, etc." maxLength={2} className="h-11 rounded-lg" />
            </Form.Item>
          </div>
          <Form.Item name="vat_number" label="VAT / Tax ID (Optional)">
            <Input placeholder="EU123456789" />
          </Form.Item>
          <Form.Item name="notes" label="Internal Notes">
            <Input.TextArea placeholder="Any specific requirements or context..." rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Manage Keys Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3 py-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Key size={20} className="text-primary" />
            </div>
            <Title level={4} className="!m-0 !text-primary">API Keys for {selectedPartner?.display_name}</Title>
          </div>
        }
        open={keysModalVisible}
        onCancel={() => setKeysModalVisible(false)}
        width={960}
        centered
        footer={[
          <Button key="close" size="large" onClick={() => setKeysModalVisible(false)} className="rounded-lg">Close</Button>,
          <Button 
            key="issue" 
            type="primary" 
            size="large"
            icon={<Plus size={18} />}
            onClick={() => setIssueKeyModalVisible(true)}
            className="rounded-lg shadow-sm"
          >
            Issue New Key
          </Button>
        ]}
      >
        <div className="py-2">
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
                  className={`mb-4 border-default rounded-xl shadow-sm hover:shadow-md transition-shadow ${!key.is_active ? 'opacity-75 grayscale-[0.5]' : ''}`}
                  styles={{ body: { padding: '20px' } }}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Title level={4} className="!m-0 !text-primary">{key.label}</Title>
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
      </Modal>

      {/* Issue Key Modal */}
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
            label: 'Production Key', 
            scopes: ['search:read'],
            rate_limit_rps: 10,
            rate_limit_monthly: 100000
          }}
        >
          <Form.Item
            name="label"
            label="Key Label"
            rules={[{ required: true, message: 'Please enter key label' }]}
          >
            <Input placeholder="e.g. Website Integration" />
          </Form.Item>
          <Form.Item
            name="scopes"
            label="Authorized Scopes"
            rules={[{ required: true, message: 'Select at least one scope' }]}
          >
            <Select mode="multiple">
              <Option value="search:read">search:read</Option>
              <Option value="ingest:write">ingest:write</Option>
              <Option value="metadata:read">metadata:read</Option>
              <Option value="analytics:read">analytics:read</Option>
            </Select>
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="rate_limit_rps" label="Rate Limit (RPS)">
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item name="rate_limit_monthly" label="Monthly Quota">
              <Input type="number" min={0} />
            </Form.Item>
          </div>
          <Form.Item name="expires_at" label="Expiration Date (Optional)">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Revealed Key Modal (Plaintext) */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-success" />
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
          <Text className="text-secondary">Key Label</Text>
          <Text strong className="text-primary">{revealedKey?.label}</Text>
        </div>
      </Modal>

      {/* Status Modals */}
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

export default PartnersPage;
