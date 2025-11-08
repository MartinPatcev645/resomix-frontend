import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { Plus, RefreshCw, Trash2, Pencil } from 'lucide-react'
import { useConfirmDialog } from '@resomix/hooks'
import { useUserOperationLimits } from '@/hooks/useUserOperationLimits.ts'
import type {
  AdminOperationType,
  AdminUserOperationLimit,
} from '@resomix/api-client'

const { Paragraph, Text } = Typography

interface UserOperationLimitsTabProps {
  operationTypes: AdminOperationType[]
  operationTypesLoading: boolean
  onRefreshOperationTypes: () => Promise<void>
  onError: (title: string, message: string) => void
  onSuccess: (title: string, message: string) => void
}

interface EditingContext {
  userIdentifier: string
  operationCode: string
}

interface UpsertFormValues {
  user_identifier: string
  operation_code: string
  limit_value: number
}

const defaultFormValues: Partial<UpsertFormValues> = {
  user_identifier: '',
  operation_code: undefined,
  limit_value: undefined,
}

const pickUserIdentifier = (record: AdminUserOperationLimit): string =>
  record.user_email ||
  record.user_username ||
  record.user_uuid ||
  String(record.user_id)

function UserOperationLimitsTab({
  operationTypes,
  operationTypesLoading,
  onRefreshOperationTypes,
  onError,
  onSuccess,
}: UserOperationLimitsTabProps) {
  const {
    data,
    loading,
    pagination,
    search,
    operationCode,
    refresh,
    setPage,
    setSearch,
    setOperationCode,
    clearFilters,
    upsertLimit,
    deleteLimit,
    loadLimit,
  } = useUserOperationLimits({ onError, onSuccess })

  const [form] = Form.useForm<UpsertFormValues>()
  const [modalVisible, setModalVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingContext, setEditingContext] = useState<EditingContext | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [searchInput, setSearchInput] = useState(search)

  const { confirmDelete } = useConfirmDialog()

  const operationTypeOptions = useMemo(
    () =>
      operationTypes.map((operation) => ({
        label: `${operation.code} — ${operation.description}`,
        value: operation.code,
      })),
    [operationTypes]
  )

  const operationDescriptionMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const operation of operationTypes) {
      map.set(operation.code, operation.description)
    }
    return map
  }, [operationTypes])

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
    if (operationCode) {
      form.setFieldsValue({
        operation_code: operationCode,
      } as Partial<UpsertFormValues>)
    }
    setModalVisible(true)
  }

  const handleOpenEdit = async (record: AdminUserOperationLimit) => {
    const userIdentifier = pickUserIdentifier(record)
    setIsEditing(true)
    setEditingContext({
      userIdentifier,
      operationCode: record.operation_code,
    })
    setModalVisible(true)
    setFormLoading(true)

    const existing = await loadLimit(userIdentifier, record.operation_code)

    if (!existing) {
      setModalVisible(false)
      setEditingContext(null)
      setIsEditing(false)
      setFormLoading(false)
      return
    }

    form.setFieldsValue({
      user_identifier: userIdentifier,
      operation_code: existing.operation_code,
      limit_value: existing.limit_value,
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

      const payload = {
        user_identifier: values.user_identifier.trim(),
        operation_code: values.operation_code,
        limit_value: Number(values.limit_value),
      }

      const success = await upsertLimit(payload)

      if (success) {
        handleCloseModal()
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = (record: AdminUserOperationLimit) => {
    const identifier = pickUserIdentifier(record)
    confirmDelete({
      title: 'Delete User Operation Limit',
      content: (
        <div className="space-y-2">
          <p>
            Are you sure you want to delete the limit for{' '}
            <strong>{record.operation_code}</strong>?
          </p>
          <p className="text-sm text-secondary">
            User: {identifier}
          </p>
        </div>
      ),
      onOk: async () => {
        await deleteLimit(identifier, record.operation_code)
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

  const handleOperationCodeChange = (value?: string) => {
    setOperationCode(value)
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

  const columns: TableColumnsType<AdminUserOperationLimit> = [
    {
      title: 'User',
      dataIndex: 'user_email',
      key: 'user',
      render: (_: unknown, record) => {
        const primary =
          record.user_email ||
          record.user_username ||
          record.user_uuid ||
          `ID ${record.user_id}`

        return (
          <div className="space-y-1">
            <span className="font-medium text-primary">{primary}</span>
            <div className="text-xs text-secondary space-x-3">
              {record.user_email && <span>Email: {record.user_email}</span>}
              {record.user_username && <span>Username: {record.user_username}</span>}
              {record.user_uuid && <span>UUID: {record.user_uuid}</span>}
              <span>ID: {record.user_id}</span>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Operation',
      dataIndex: 'operation_code',
      key: 'operation',
      width: 220,
      render: (code: string) => (
        <div className="space-y-1">
          <span className="font-medium text-primary uppercase tracking-wide">{code}</span>
          <span className="text-xs text-secondary">
            {operationDescriptionMap.get(code) || '—'}
          </span>
        </div>
      ),
    },
    {
      title: 'Limit',
      dataIndex: 'limit_value',
      key: 'limit_value',
      width: 100,
      render: (value: number) => <span className="font-medium text-primary">{value}</span>,
    },
    {
      title: 'Usage',
      dataIndex: 'playlist_count',
      key: 'playlist_count',
      width: 100,
      render: (value: number | null) =>
        value !== null && value !== undefined ? (
          <span>{value}</span>
        ) : (
          <span className="text-secondary">—</span>
        ),
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 200,
      render: (value: string) => (
        <span className="text-secondary text-sm">{new Date(value).toLocaleString()}</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_: unknown, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="default"
              icon={<Pencil size={16} />}
              onClick={() => handleOpenEdit(record)}
            />
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
            <h2 className="text-xl font-semibold text-primary">User Operation Limits</h2>
            <p className="text-secondary text-sm">
              Manage per-user limits for specific operations.
            </p>
          </div>
          <Space wrap>
            <Tooltip title="Refresh user limits">
              <Button
                icon={<RefreshCw size={16} />}
                loading={loading}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </Tooltip>
            <Tooltip title="Reload operation types">
              <Button
                icon={<RefreshCw size={16} />}
                loading={operationTypesLoading}
                onClick={onRefreshOperationTypes}
              >
                Reload Types
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              Add Limit
            </Button>
          </Space>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(200px,280px)_auto] md:items-center">
          <Input.Search
            placeholder="Search by user (email, username, UUID, ID)"
            allowClear
            value={searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
            onSearch={handleSearchSubmit}
          />
          <Select
            allowClear
            showSearch
            placeholder="Filter by operation"
            loading={operationTypesLoading}
            options={operationTypeOptions}
            value={operationCode}
            onChange={handleOperationCodeChange}
            optionFilterProp="label"
          />
          <Button onClick={handleClearFilters}>Clear Filters</Button>
        </div>

        <Paragraph type="secondary" className="text-sm">
          Use the operation list to understand available codes. When creating limits, provide a
          unique user identifier (email, username, UUID, or numeric ID).
        </Paragraph>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record) => `${pickUserIdentifier(record)}-${record.operation_code}`}
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '30', '50', '100'],
          showTotal: (totalCount, range) => (
            <span className="text-secondary text-sm">
              Showing {range[0]}-{range[1]} of {totalCount} entries
            </span>
          ),
        }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={isEditing ? 'Edit User Operation Limit' : 'Add User Operation Limit'}
        open={modalVisible}
        onCancel={handleCloseModal}
        onOk={handleSubmit}
        okText={isEditing ? 'Save Changes' : 'Create Limit'}
        confirmLoading={submitLoading}
        destroyOnClose
      >
        {formLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : (
          <Form<UpsertFormValues>
            form={form}
            layout="vertical"
            initialValues={defaultFormValues}
          >
            <Form.Item
              label="User Identifier"
              name="user_identifier"
              rules={[
                { required: true, message: 'User identifier is required' },
                {
                  validator: (_, value) => {
                    if (typeof value === 'string' && value.trim().length > 0) {
                      return Promise.resolve()
                    }
                    return Promise.reject(
                      new Error('Please enter an email, username, UUID, or numeric ID')
                    )
                  },
                },
              ]}
            >
              <Input placeholder="Email, username, UUID, or numeric ID" />
            </Form.Item>

            <Form.Item
              label="Operation Code"
              name="operation_code"
              rules={[{ required: true, message: 'Please select an operation' }]}
            >
              <Select
                showSearch
                placeholder="Select operation"
                options={operationTypeOptions}
                loading={operationTypesLoading}
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              label="Limit Value"
              name="limit_value"
              rules={[{ required: true, message: 'Limit value is required' }]}
            >
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>

            {isEditing && editingContext && (
              <div
                className="rounded-md border border-dashed border-default p-3"
                style={{ backgroundColor: 'var(--opacity-10)' }}
              >
                <Text type="secondary" className="text-xs">
                  Editing limit for {editingContext.userIdentifier} – {editingContext.operationCode}
                </Text>
              </div>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default UserOperationLimitsTab

