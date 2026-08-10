import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DeleteAccountModal from '@/components/DeleteAccountModal.tsx';
import PendingDeletionsPanel from '@/components/PendingDeletionsPanel.tsx';
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
  Spin,
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
  Lock,
  Eye,
  Edit,
} from 'lucide-react';
import { useAdminUsers, useStatusModals } from '@resomix/hooks';
import { StatusModal } from '@resomix/ui';
import type { AdminUserSearchItem } from '@resomix/api-client';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * "3 days ago" beats a date here: the column exists to spot dormant and just-active accounts at a
 * glance, and a wall of identical-looking timestamps does not support that.
 */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

function UsersPage() {
  const navigate = useNavigate();
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
    systemPermissions,
    fetchUsers,
    createUser,
    assignRole,
    removeRole,
    toggleStatus,
    updateUser,
    getUserDetail,
    handlePageChange,
  } = useAdminUsers({
    onError: showErrorModal,
    onSuccess: showSuccessModal,
  });

  // ── Modal & Drawer Visibility ──────────────────────────────
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ── Selected / Loading State ───────────────────────────────
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserSearchItem | null>(null);
  const [roleModalLoading, setRoleModalLoading] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // ── Handlers ───────────────────────────────────────────────

  const handleCreateUser = async (values: any) => {
    const success = await createUser(values);
    if (success) {
      setCreateModalVisible(false);
      createForm.resetFields();
    }
  };

  const handleEditUser = (user: AdminUserSearchItem) => {
    setEditingUser(user);
    editForm.setFieldsValue({
      email: user.email,
      username: user.username,
      name: user.name,
    });
    setEditModalVisible(true);
  };

  const handleUpdateUser = async (values: any) => {
    if (!editingUser?.uuid) return;
    const success = await updateUser(editingUser.uuid, values);
    if (success) {
      setEditModalVisible(false);
      setEditingUser(null);
      editForm.resetFields();
    }
  };

  const handleOpenRoleModal = async (user: AdminUserSearchItem) => {
    setSelectedUser(user);
    setRoleModalVisible(true);
    if (!user.uuid) return;
    setRoleModalLoading(true);
    const result = await getUserDetail(user.uuid);
    if (result?.success && result.data) {
      setSelectedUser(result.data);
    }
    setRoleModalLoading(false);
  };

  const handleToggleStatus = (user: AdminUserSearchItem) => {
    if (!user.uuid) return;
    const isActive = user.is_active ?? true;
    const action = isActive ? 'Deactivate' : 'Activate';
    modal.confirm({
      title: `${action} User`,
      content: `Are you sure you want to ${action.toLowerCase()} ${user.username ?? 'this user'}?`,
      okText: action,
      okType: isActive ? 'danger' : 'primary',
      onOk: () => toggleStatus(user.uuid!, user.username ?? 'user'),
    });
  };

  const handleAssignRole = async (roleName: string) => {
    if (!selectedUser?.uuid) return;
    const success = await assignRole(selectedUser.uuid, roleName);
    if (success) {
      const result = await getUserDetail(selectedUser.uuid);
      if (result?.success && result.data) {
        setSelectedUser(result.data);
      }
    }
  };

  const handleRemoveRole = (roleName: string) => {
    if (!selectedUser?.uuid) return;
    modal.confirm({
      title: 'Remove Role',
      content: `Remove the "${roleName}" role from ${selectedUser.username}?`,
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        const success = await removeRole(selectedUser.uuid!, roleName);
        if (success) {
          const result = await getUserDetail(selectedUser.uuid!);
          if (result?.success && result.data) {
            setSelectedUser(result.data);
          }
        }
      },
    });
  };

  // ── Table Columns ──────────────────────────────────────────

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: AdminUserSearchItem) => (
        <Space size={12}>
          <Avatar icon={<User size={16} />} className="bg-primary/10 text-primary" />
          <div className="flex flex-col">
            <button
              className="text-left font-semibold text-primary hover:underline focus:outline-none"
              onClick={() => record.uuid && navigate(`/users/${record.uuid}`)}
            >
              {record.name || record.username || 'N/A'}
            </button>
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
      title: 'Status',
      key: 'status',
      render: (_: any, record: AdminUserSearchItem) => (
        <Space size={4}>
          <Tag color={record.is_active ?? true ? 'success' : 'error'} className="rounded-full px-3">
            {record.is_active ?? true ? 'Active' : 'Inactive'}
          </Tag>
          <Tag color={record.is_email_verified ? 'blue' : 'warning'} className="rounded-full px-3">
            {record.is_email_verified ? 'Verified' : 'Unverified'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Plan',
      key: 'plan',
      render: (_: any, record: AdminUserSearchItem) =>
        record.plan ? (
          <Tag
            color={record.plan.code === 'free' ? 'default' : 'gold'}
            className="rounded-full px-3"
          >
            {record.plan.name}
          </Tag>
        ) : (
          <Text className="text-secondary text-xs">—</Text>
        ),
    },
    {
      title: 'Last activity',
      dataIndex: 'last_seen_at',
      key: 'last_seen_at',
      render: (date: string | null) => (
        <Text className="text-secondary text-xs">{relativeTime(date)}</Text>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => (
        <Text className="text-secondary text-xs">
          {date ? new Date(date).toLocaleDateString() : 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: AdminUserSearchItem) => {
        const items: MenuProps['items'] = [
          {
            key: 'edit',
            label: 'Edit User',
            icon: <Edit size={14} />,
            onClick: () => handleEditUser(record),
          },
          {
            key: 'status',
            label: (record.is_active ?? true) ? 'Deactivate User' : 'Activate User',
            icon: (record.is_active ?? true) ? <UserX size={14} /> : <UserCheck size={14} />,
            onClick: () => handleToggleStatus(record),
          },
          { type: 'divider' },
          {
            key: 'delete',
            label: 'Delete User',
            icon: <Trash2 size={14} />,
            danger: true,
            // Opens the manifest-backed modal rather than a confirm dialog. The old one promised
            // "permanently delete... cannot be undone" and then did nothing at all — the endpoint
            // did not exist. Both halves of that were wrong: it exists now, and it removes the
            // person while KEEPING their playlists, activity and invoices.
            onClick: () => setDeletingUser(record),
          },
        ];

        return (
          <Space>
            <Tooltip title="Open full profile">
              <Button
                type="text"
                icon={<Eye size={16} />}
                onClick={() => record.uuid && navigate(`/users/${record.uuid}`)}
              />
            </Tooltip>
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

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
      {modalContextHolder}

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <Title level={2} className="!mb-1 !text-primary flex items-center gap-3">
            <span>User Management</span>
            <Tag color="blue" className="text-sm font-semibold rounded-full px-3 py-0.5 m-0">{pagination.total} users</Tag>
          </Title>
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

      {/* ── Pending deletions ──
          Above the table on purpose. Nothing scrubs on a timer and the user is told a window
          rather than a date, so this is the only place the one-month clock is visible. */}
      <div className="mb-8">
        <PendingDeletionsPanel />
      </div>

      {/* ── Filters ── */}
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
              {systemRoles.map((role) => (
                <Option key={role.id} value={role.id}>{role.name}</Option>
              ))}
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

      {/* ── Table ── */}
      <div className="bg-surface rounded-xl shadow-md border border-default overflow-hidden">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="uuid"
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


      {/* ── Create User Modal ── */}
      <Modal
        title="Create New User"
        open={createModalVisible}
        onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        okText="Create User"
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateUser} className="mt-4">
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<Mail size={14} className="text-secondary" />} placeholder="user@example.com" />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input prefix={<User size={14} className="text-secondary" />} placeholder="username" />
          </Form.Item>
          <Form.Item name="name" label="Full Name">
            <Input placeholder="John Doe" />
          </Form.Item>
          <Form.Item name="password" label="Initial Password" rules={[{ required: true, min: 8 }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Edit size={18} className="text-primary" />
            <span>Edit User: {editingUser?.username}</span>
          </div>
        }
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); setEditingUser(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateUser} className="mt-4">
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<Mail size={14} className="text-secondary" />} />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input prefix={<User size={14} className="text-secondary" />} />
          </Form.Item>
          <Form.Item name="name" label="Full Name">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Role Management Modal ── */}
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
          <Button key="close" onClick={() => setRoleModalVisible(false)}>Close</Button>,
        ]}
        width={620}
      >
        <div className="py-4">
          <Text className="text-secondary mb-4 block">
            Assign or remove roles for this user. Permissions are aggregated across all assigned roles.
          </Text>

          {/* Assign a new role */}
          <div className="mb-6">
            <Title level={5} className="!mb-3">Add Role</Title>
            <Select
              placeholder="Select a role to assign"
              className="w-full h-11"
              value={undefined as any}
              onSelect={(value: any) => { handleAssignRole(value); }}
            >
              {systemRoles.map((role) => (
                <Option key={role.name} value={role.name}>{role.name}</Option>
              ))}
            </Select>
          </div>

          {/* System permissions reference */}
          {systemPermissions && systemPermissions.length > 0 && (
            <div className="bg-background-secondary p-4 rounded-xl border border-default">
              <Title level={5} className="!mb-3 flex items-center gap-2">
                <Lock size={16} />
                <span>Available Permissions</span>
              </Title>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {systemPermissions.map((perm: any) => (
                  <Tag
                    key={perm.name ?? perm}
                    className="text-xs rounded bg-primary/5 border-primary/10 text-primary"
                  >
                    {perm.name ?? perm}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Remove role — only shown when we have detail data */}
          {selectedUser && (
            <div className="mt-6">
              <Title level={5} className="!mb-3">Remove Role</Title>
              {roleModalLoading ? (
                <div className="py-2"><Spin size="small" /></div>
              ) : selectedUser.roles && selectedUser.roles.length > 0 ? (
                <>
                  <Text className="text-secondary text-xs block mb-3">
                    Click a role tag below to remove it from this user.
                  </Text>
                  <Space wrap>
                    {selectedUser.roles.map((role: any) => {
                      const roleName = typeof role === 'string' ? role : role.name;
                      return (
                        <Tag
                          key={roleName}
                          closable
                          onClose={(e) => { e.preventDefault(); handleRemoveRole(roleName); }}
                          className="px-3 py-1 rounded-full text-sm cursor-pointer"
                          color="blue"
                        >
                          {roleName}
                        </Tag>
                      );
                    })}
                  </Space>
                </>
              ) : (
                <Text className="text-secondary text-xs italic block mb-3">
                  No roles assigned to this user.
                </Text>
              )}
            </div>
          )}
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

      <DeleteAccountModal
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        userUuid={deletingUser?.uuid || null}
        email={deletingUser?.email}
        onDeleted={() => void fetchUsers()}
      />
    </div>
  );
}

export default UsersPage;
