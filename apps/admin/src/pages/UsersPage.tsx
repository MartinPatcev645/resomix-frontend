import { useState } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Typography, 
  Card,
  Input,
  Select,
  Tag,
  Avatar,
  Modal,
  Form,
  Tooltip,
  Dropdown,
  message
} from 'antd';
import type { MenuProps } from 'antd';
import { 
  Plus, 
  Search, 
  RefreshCw,
  User,
  Shield,
  MoreVertical,
  Mail,
  UserCheck,
  UserX,
  Trash2,
  Lock
} from 'lucide-react';
import { useAdminUsers, useStatusModals } from '@resomix/hooks';
import { StatusModal } from '@resomix/ui';
import type { AdminUserSearchItem } from '@resomix/api-client';

const { Title, Text } = Typography;
const { Option } = Select;

function UsersPage() {
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
    users,
    loading,
    pagination,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    systemRoles,
    fetchUsers,
    createUser,
    assignRole,
    handlePageChange,
  } = useAdminUsers({
    onError: showErrorModal,
    onSuccess: showSuccessModal
  });

  // Modal Visibility
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserSearchItem | null>(null);
  const [createForm] = Form.useForm();

  const handleCreateUser = async (values: any) => {
    const success = await createUser(values);
    if (success) {
      setCreateModalVisible(false);
      createForm.resetFields();
    }
  };

  const handleOpenRoleModal = (user: AdminUserSearchItem) => {
    setSelectedUser(user);
    setRoleModalVisible(true);
  };

  const handleToggleStatus = (user: AdminUserSearchItem) => {
    const action = user.is_email_verified ? 'Deactivate' : 'Activate';
    modal.confirm({
      title: `${action} User`,
      content: `Are you sure you want to ${action.toLowerCase()} user ${user.username}?`,
      onOk: () => {
        message.info(`${action} logic will be implemented in next step`);
      }
    });
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: AdminUserSearchItem) => (
        <Space size={12}>
          <Avatar icon={<User size={16} />} className="bg-primary/10 text-primary" />
          <div className="flex flex-col">
            <Text strong className="text-primary">{record.name || record.username || 'N/A'}</Text>
            <Text className="text-secondary text-xs">{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <Text className="font-mono text-xs">{text}</Text>,
    },
    {
      title: 'Roles',
      key: 'roles',
      render: () => (
        <Space wrap size={4}>
          <Tag color="blue" className="rounded-full">Customer</Tag>
          {/* Map actual roles here once backend supports it */}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean = true) => (
        <Tag color={active ? 'success' : 'error'} className="rounded-full px-3">
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => <Text className="text-secondary text-xs">{date ? new Date(date).toLocaleDateString() : 'N/A'}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: AdminUserSearchItem) => {
        const items: MenuProps['items'] = [
          {
            key: 'status',
            label: record.is_email_verified ? 'Deactivate User' : 'Activate User',
            icon: record.is_email_verified ? <UserX size={14} /> : <UserCheck size={14} />,
            onClick: () => handleToggleStatus(record)
          },
          {
            key: 'reset',
            label: 'Reset Password',
            icon: <Lock size={14} />,
          },
          {
            type: 'divider',
          },
          {
            key: 'delete',
            label: 'Delete User',
            icon: <Trash2 size={14} />,
            danger: true,
          },
        ];

        return (
          <Space>
            <Tooltip title="Manage Roles">
              <Button 
                type="text" 
                icon={<Shield size={16} />} 
                onClick={() => handleOpenRoleModal(record)} 
              />
            </Tooltip>
            <Dropdown menu={{ items }} trigger={['click']}>
              <Button type="text" icon={<MoreVertical size={16} />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <Title level={2} className="!mb-1 !text-primary">User Management</Title>
          <Text className="text-secondary text-base">Oversee platform users, roles, and security permissions.</Text>
        </div>
        <Button 
          type="primary" 
          size="large"
          icon={<Plus size={18} />} 
          onClick={() => setCreateModalVisible(true)}
          className="h-12 px-6 rounded-lg shadow-sm"
        >
          Create User
        </Button>
      </div>

      <Card className="mb-8 bg-surface border-default shadow-sm rounded-xl overflow-hidden">
        <Space wrap size={24} className="w-full">
          <div className="flex flex-col gap-1.5">
            <Text className="text-secondary text-xs font-medium uppercase tracking-wider">Search</Text>
            <Input 
              placeholder="Email or username..." 
              prefix={<Search size={14} className="text-secondary" />}
              className="h-10 w-64 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Text className="text-secondary text-xs font-medium uppercase tracking-wider">Role</Text>
            <Select 
              placeholder="All Roles" 
              allowClear 
              style={{ width: 180 }}
              className="h-10"
              value={roleFilter}
              onChange={setRoleFilter}
            >
              {systemRoles.map(role => (
                <Option key={role.name} value={role.name}>{role.name}</Option>
              ))}
              <Option value="admin">Admin</Option>
              <Option value="partner">Partner</Option>
              <Option value="customer">Customer</Option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Text className="text-secondary text-xs font-medium uppercase tracking-wider">Status</Text>
            <Select 
              placeholder="All Status" 
              allowClear 
              style={{ width: 140 }}
              className="h-10"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </div>
          <div className="flex items-end h-full pt-6">
            <Button 
              icon={<RefreshCw size={16} />} 
              onClick={() => void fetchUsers()}
              className="h-10 border-default hover:border-primary flex items-center gap-2 rounded-lg"
            >
              Refresh
            </Button>
          </div>
        </Space>
      </Card>

      <div className="bg-surface rounded-xl shadow-md border border-default overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={users} 
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
            showSizeChanger: true,
          }}
          className="custom-table"
        />
      </div>

      {/* Create User Modal */}
      <Modal
        title="Create New User"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => createForm.submit()}
        okText="Create User"
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
          className="mt-4"
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input prefix={<Mail size={14} className="text-secondary" />} placeholder="user@example.com" />
          </Form.Item>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true }]}
          >
            <Input prefix={<User size={14} className="text-secondary" />} placeholder="username" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Full Name"
          >
            <Input placeholder="John Doe" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Initial Password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Role Management Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            <span>Manage Roles: {selectedUser?.username}</span>
          </div>
        }
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setRoleModalVisible(false)}>Close</Button>
        ]}
        width={600}
      >
        <div className="py-4">
          <Text className="text-secondary mb-4 block">Assign or remove roles for this user. Permissions are aggregated across all assigned roles.</Text>
          
          <div className="mb-6">
            <Title level={5} className="!mb-3">Active Roles</Title>
            <Space wrap>
              <Tag 
                color="blue" 
                closable 
                onClose={() => message.info('Role removal logic will be implemented')}
                className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
              >
                Customer
              </Tag>
            </Space>
          </div>

          <div className="mb-6">
            <Title level={5} className="!mb-3">Add Role</Title>
            <Select 
              placeholder="Select a role to add" 
              className="w-full h-11"
              onSelect={(value: string) => assignRole(selectedUser!.uuid!, value)}
            >
              {systemRoles.map(role => (
                <Option key={role.name} value={role.name}>{role.name}</Option>
              ))}
            </Select>
          </div>

          <div className="bg-background-secondary p-4 rounded-xl border border-default">
            <Title level={5} className="!mb-3 flex items-center gap-2">
              <Lock size={16} />
              <span>Permission Preview</span>
            </Title>
            <div className="grid grid-cols-2 gap-2">
              <Text className="text-xs text-secondary italic">List of aggregated permissions will appear here...</Text>
            </div>
          </div>
        </div>
      </Modal>

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

export default UsersPage;
