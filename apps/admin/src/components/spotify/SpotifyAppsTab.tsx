import { useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tooltip,
  Typography,
  Tag,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { Plus, RefreshCw, Trash2, Pencil } from 'lucide-react'
import { useConfirmDialog } from '@resomix/hooks'
import { useSpotifyApps } from '@/hooks/useSpotifyApps.ts'
import type {
  AdminSpotifyApp,
  AdminSpotifyAppCreateRequest,
  AdminSpotifyAppUpdateRequest,
} from '@resomix/api-client'

const { TextArea } = Input
const { Text } = Typography

interface SpotifyAppsTabProps {
  onError: (title: string, message: string) => void
  onSuccess: (title: string, message: string) => void
}

interface EditingContext {
  appId: number
}

interface AppFormValues {
  name: string
  description: string
  client_id: string
  client_secret: string
  is_active: boolean
}

const defaultFormValues: Partial<AppFormValues> = {
  name: '',
  description: '',
  client_id: '',
  client_secret: '',
  is_active: true,
}

function SpotifyAppsTab({ onError, onSuccess }: SpotifyAppsTabProps) {
  const {
    apps,
    loading,
    pagination,
    isActive,
    search,
    lastUpdated,
    refresh,
    setPage,
    setIsActive,
    setSearch,
    clearFilters,
    createApp,
    updateApp,
    deleteApp,
    loadApp,
  } = useSpotifyApps({ onError, onSuccess })

  const [form] = Form.useForm<AppFormValues>()
  const [modalVisible, setModalVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingContext, setEditingContext] = useState<EditingContext | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [searchInput, setSearchInput] = useState(search)

  const { confirmDelete } = useConfirmDialog()

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  const resetForm = () => {
    form.resetFields()
    form.setFieldsValue(defaultFormValues)
  }

  const handleOpenCreate = () => {
    setIsEditing(false)
    setEditingContext(null)
    resetForm()
    setModalVisible(true)
  }

  const handleOpenEdit = async (record: AdminSpotifyApp) => {
    setIsEditing(true)
    setEditingContext({ appId: record.id })
    setModalVisible(true)
    setFormLoading(true)

    const existing = await loadApp(record.id, true)

    if (!existing) {
      setModalVisible(false)
      setEditingContext(null)
      setIsEditing(false)
      setFormLoading(false)
      return
    }

    form.setFieldsValue({
      name: existing.name,
      description: existing.description || '',
      client_id: existing.client_id,
      client_secret: existing.client_secret || '',
      is_active: existing.is_active,
    })

    setFormLoading(false)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setIsEditing(false)
    setEditingContext(null)
    resetForm()
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitLoading(true)

      if (isEditing && editingContext) {
        // Build update payload - all fields are optional per API spec
        const updatePayload: AdminSpotifyAppUpdateRequest = {
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          client_id: values.client_id.trim(),
          is_active: values.is_active,
        }

        // Only include client_secret if provided (not empty) to preserve current value
        const clientSecret = values.client_secret.trim()
        if (clientSecret) {
          updatePayload.client_secret = clientSecret
        }

        const success = await updateApp(editingContext.appId, updatePayload)

        if (success) {
          handleCloseModal()
        }
      } else {
        const payload: AdminSpotifyAppCreateRequest = {
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          client_id: values.client_id.trim(),
          client_secret: values.client_secret.trim(),
          is_active: values.is_active,
        }

        const success = await createApp(payload)

        if (success) {
          handleCloseModal()
        }
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = (record: AdminSpotifyApp) => {
    const hasUsers = record.user_count > 0

    confirmDelete({
      title: 'Delete Spotify App',
      content: (
        <div className="space-y-2">
          <p>
            Are you sure you want to delete <strong>{record.name}</strong>?
          </p>
          {hasUsers && (
            <p className="text-sm text-secondary">
              This app has {record.user_count} associated user(s). You may need to use cascade
              deletion to remove the app with its associations.
            </p>
          )}
        </div>
      ),
      onOk: async () => {
        // If app has users, ask for cascade confirmation
        if (hasUsers) {
          confirmDelete({
            title: 'Confirm Cascade Deletion',
            content: (
              <div className="space-y-2">
                <p>
                  This will delete the app and all user associations. This action cannot be undone.
                </p>
              </div>
            ),
            onOk: async () => {
              await deleteApp(record.id, { cascade: true })
            },
          })
        } else {
          await deleteApp(record.id)
        }
      },
    })
  }

  const handleRefresh = async () => {
    await refresh()
  }

  const handleSearchSubmit = (value: string) => {
    setSearch(value)
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (!value) {
      setSearch('')
    }
  }

  const handleIsActiveChange = (value?: boolean) => {
    setIsActive(value)
  }

  const handleClearFilters = () => {
    setSearchInput('')
    clearFilters()
  }

  const handleTableChange = (tablePagination: any) => {
    const nextPage = tablePagination.current ?? 1
    const nextPageSize = tablePagination.pageSize ?? pagination.pageSize
    setPage(nextPage, nextPageSize)
  }

  const columns: TableColumnsType<AdminSpotifyApp> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (value: number) => <span className="font-mono text-sm text-primary">{value}</span>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => <span className="font-medium text-primary">{name}</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string | null) => {
        if (!description) return <span className="text-secondary">—</span>
        const truncated = description.length > 30 ? `${description.substring(0, 30)}...` : description
        return <span className="text-secondary" title={description}>{truncated}</span>
      },
    },
    {
      title: 'Client ID',
      dataIndex: 'client_id',
      key: 'client_id',
      width: 200,
      render: (clientId: string) => (
        <span className="font-mono text-sm text-primary">{clientId}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Users',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 80,
      render: (count: number) => <span className="text-primary">{count}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_: unknown, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="default" icon={<Pencil size={16} />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              danger
              icon={<Trash2 size={16} />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary">Spotify Apps</h2>
            <p className="text-secondary text-sm">
              Manage Spotify apps and their configurations.
            </p>
            {lastUpdated && (
              <p className="text-xs text-secondary mt-1">
                Last updated {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <Space wrap>
            <Tooltip title="Refresh apps">
              <Button icon={<RefreshCw size={16} />} loading={loading} onClick={handleRefresh}>
                Refresh
              </Button>
            </Tooltip>
            <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
              Add App
            </Button>
          </Space>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(150px,200px)_auto] md:items-center">
          <Input.Search
            placeholder="Search by app name"
            allowClear
            value={searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
            onSearch={handleSearchSubmit}
          />
          <Select
            allowClear
            placeholder="Filter by status"
            value={isActive}
            onChange={handleIsActiveChange}
            options={[
              { label: 'Active', value: true },
              { label: 'Inactive', value: false },
            ]}
          />
          <Button onClick={handleClearFilters}>Clear Filters</Button>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={apps}
        rowKey={(record) => record.id}
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['50', '100', '200', '500'],
          showTotal: (totalCount, range) => (
            <span className="text-secondary text-sm">
              Showing {range[0]}-{range[1]} of {totalCount} entries
            </span>
          ),
        }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={isEditing ? 'Edit Spotify App' : 'Add Spotify App'}
        open={modalVisible}
        onCancel={handleCloseModal}
        onOk={handleSubmit}
        okText={isEditing ? 'Save Changes' : 'Create App'}
        confirmLoading={submitLoading}
        destroyOnHidden
        width={600}
      >
        {formLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : (
          <Form<AppFormValues>
            form={form}
            layout="vertical"
            initialValues={defaultFormValues}
          >
            <Form.Item
              label="App Name"
              name="name"
              rules={[
                { required: true, message: 'App name is required' },
                { max: 100, message: 'App name must be 100 characters or less' },
              ]}
            >
              <Input placeholder="Resomix Production App" />
            </Form.Item>

            <Form.Item
              label="Description"
              name="description"
              rules={[{ max: 255, message: 'Description must be 255 characters or less' }]}
            >
              <TextArea rows={3} placeholder="Main production Spotify app" />
            </Form.Item>

            <Form.Item
              label="Client ID"
              name="client_id"
              rules={[{ required: true, message: 'Client ID is required' }]}
            >
              <Input placeholder="abc123def456" />
            </Form.Item>

            <Form.Item
              label="Client Secret"
              name="client_secret"
              rules={isEditing ? [] : [{ required: true, message: 'Client secret is required' }]}
            >
              <Input.Password placeholder="secret123" />
            </Form.Item>

            <Form.Item label="Active" name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>

            {isEditing && editingContext && (
              <div
                className="rounded-md border border-dashed border-default p-3"
                style={{ backgroundColor: 'var(--opacity-10)' }}
              >
                <Text type="secondary" className="text-xs">
                  Editing app ID {editingContext.appId}. Leave client secret empty to keep current
                  value.
                </Text>
              </div>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default SpotifyAppsTab

