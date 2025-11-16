import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  AdminUserSearchItem,
} from '@resomix/api-client'
import { searchAdminUsers } from '@resomix/api-client'

const { Text } = Typography

type UserOption = {
  value: string
  label: ReactNode
  displayLabel: string
  raw: AdminUserSearchItem
}

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
  user_identifier: undefined,
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
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [userSearchError, setUserSearchError] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const userSearchTimeout = useRef<NodeJS.Timeout | null>(null)
  const selectedUserIdentifier = Form.useWatch('user_identifier', form)
  const isMountedRef = useRef(true)
  const currentUserSearchQuery = useRef('')
  const isUserSelected =
    typeof selectedUserIdentifier === 'string' && selectedUserIdentifier.trim().length > 0

const buildUserOption = useCallback((user: AdminUserSearchItem) => {
  const primary = user.email || user.username || (user.uuid ? `UUID: ${user.uuid}` : `ID: ${user.id}`)
  const secondaryParts: string[] = []
  if (user.username) secondaryParts.push(`Username: ${user.username}`)
  if (user.uuid) secondaryParts.push(`UUID: ${user.uuid}`)
  secondaryParts.push(`ID: ${user.id}`)

  return {
    value: user.email || user.username || (user.uuid ?? String(user.id)),
    label: (
      <div className="flex flex-col">
        <span className="font-medium text-primary break-all">{primary}</span>
        <span className="text-xs text-secondary">
          {secondaryParts.join(' • ')}
        </span>
      </div>
    ),
    displayLabel: user.email ?? primary,
    raw: user,
  }
}, [])

  const resetUserSearchState = useCallback(() => {
    if (userSearchTimeout.current) {
      clearTimeout(userSearchTimeout.current)
      userSearchTimeout.current = null
    }
    setUserOptions([])
    setUserSearchError(null)
    setUserSearchLoading(false)
    setUserQuery('')
    currentUserSearchQuery.current = ''
  }, [])

  const { confirmDelete } = useConfirmDialog()

  const operationTypeOptions = useMemo(
    () =>
      operationTypes.map((operation) => ({
        label: operation.code,
        value: operation.code,
      })),
    [operationTypes]
  )

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (userSearchTimeout.current) {
        clearTimeout(userSearchTimeout.current)
      }
    }
  }, [])

  const resetForm = () => {
    form.resetFields()
    form.setFieldsValue(defaultFormValues)
  }

  const handleOpenCreate = () => {
    setIsEditing(false)
    setEditingContext(null)
    resetForm()
    resetUserSearchState()
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
    resetUserSearchState()
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

    if (existing.user_email) {
      const option = buildUserOption({
        id: existing.user_id,
        uuid: existing.user_uuid,
        email: existing.user_email,
        username: existing.user_username,
        name: null,
        is_email_verified: null,
        created_at: existing.created_at,
      })
      setUserOptions([option])
      setUserSearchError(null)
    } else {
      resetUserSearchState()
    }

    setFormLoading(false)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setIsEditing(false)
    setEditingContext(null)
    resetForm()
    resetUserSearchState()
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

      const result = await upsertLimit(payload, isEditing ? { force: true } : undefined)

      if (result.ok) {
        handleCloseModal()
        return
      }

      if (!result.ok) {
        const errorMessage = result.error || 'Failed to save operation limit.'

        if (result.conflict) {
          const existing = result.conflict
          const conflictEmail =
            existing.user_email ||
            payload.user_identifier
          const existingLimit =
            existing.limit_value !== null && existing.limit_value !== undefined
              ? existing.limit_value
              : 'N/A'

          Modal.warning({
            title: 'Limit Already Exists',
            content: (
              <div className="space-y-2">
                <p>{errorMessage}</p>
                <p className="text-sm text-secondary">
                  Operation: <strong>{existing.operation_code}</strong>
                </p>
                <p className="text-sm text-secondary">
                  Current user limit for <strong>{conflictEmail}</strong>: <strong>{existingLimit}</strong>
                </p>
                <p className="text-sm text-secondary">
                  Search for this user and edit or delete the existing limit instead of creating a duplicate.
                </p>
              </div>
            ),
            centered: true,
            zIndex: 3000,
            getContainer: () => document.body,
          })
        } else {
          Modal.error({
            title: 'Unable to Save Limit',
            content: errorMessage,
            centered: true,
            zIndex: 3000,
            getContainer: () => document.body,
          })
        }
        return
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

  const handleUserSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    setUserQuery(value)
    currentUserSearchQuery.current = trimmed
    if (userSearchTimeout.current) {
      clearTimeout(userSearchTimeout.current)
      userSearchTimeout.current = null
    }

    if (!trimmed) {
      resetUserSearchState()
      return
    }

    if (trimmed.length < 2) {
      setUserOptions([])
      setUserSearchError('Enter at least 2 characters to search')
      return
    }

    setUserSearchLoading(true)
    setUserSearchError(null)
    setUserOptions([])

    const requestQuery = trimmed
    userSearchTimeout.current = setTimeout(async () => {
      try {
        const response = await searchAdminUsers(requestQuery, 10)
        if (!isMountedRef.current || currentUserSearchQuery.current !== requestQuery) return

        if (response.success && response.data) {
          const validUsers = response.data.filter((user) => Boolean(user.email))
          if (validUsers.length === 0) {
            setUserOptions([])
            setUserSearchError('No users found')
            return
          }
          setUserOptions(validUsers.map(buildUserOption))
          setUserSearchError(null)
        } else {
          setUserOptions([])
          setUserSearchError(response.error || 'Failed to search users')
        }
      } catch (error) {
        if (!isMountedRef.current) return
        setUserOptions([])
        setUserSearchError(
          error instanceof Error ? error.message : 'Unable to fetch users'
        )
      } finally {
        if (isMountedRef.current) {
          setUserSearchLoading(false)
        }
      }
    }, 300)
  }, [buildUserOption, resetUserSearchState])

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
        const email = record.user_email
        const uuid = record.user_uuid
        const username = record.user_username
        const primary =
          email ||
          (uuid ? `UUID: ${uuid}` : username ? `Username: ${username}` : `ID: ${record.user_id}`)

        return (
          <div className="space-y-1">
            <span className="font-medium text-primary break-all">{primary}</span>
            {uuid && (
              <div className="text-xs text-secondary">
                <span>UUID: {uuid}</span>
              </div>
            )}
            {(username || record.user_id) && (
              <div className="text-xs text-secondary flex flex-wrap gap-3">
                {username && <span>Username: {username}</span>}
                <span>ID: {record.user_id}</span>
              </div>
            )}
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
        <span className="font-medium text-primary uppercase tracking-wide">{code}</span>
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
      dataIndex: 'usage_count',
      key: 'usage_count',
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
            placeholder="Search by user (email, username, or UUID)"
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
        okButtonProps={{
          disabled: !isUserSelected || userSearchLoading || formLoading,
        }}
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
              label="User"
              name="user_identifier"
              rules={[{ required: true, message: 'Please select a user' }]}
            >
              <Select
                showSearch
                placeholder="Type to search users"
                options={userOptions}
                loading={userSearchLoading}
                filterOption={false}
                optionLabelProp="displayLabel"
                onSearch={(value) => {
                  if (!isEditing) {
                    handleUserSearch(value)
                  }
                }}
                onBlur={() => {
                  if (!isEditing && !selectedUserIdentifier) {
                    setUserOptions([])
                  }
                }}
                notFoundContent={
                  userSearchLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Spin size="small" />
                    </div>
                  ) : userQuery.trim().length === 0 ? (
                    <span className="text-secondary text-sm">Type to search users</span>
                  ) : userSearchError ? (
                    <span className="text-secondary text-sm">{userSearchError}</span>
                  ) : (
                    <span className="text-secondary text-sm">No users found</span>
                  )
                }
                onSelect={(_value, option) => {
                  const defaultOption = option as { raw?: AdminUserSearchItem }
                  if (defaultOption.raw) {
                    setUserOptions([buildUserOption(defaultOption.raw)])
                  }
                  setUserSearchError(null)
                  setUserQuery('')
                }}
                disabled={isEditing}
                allowClear={!isEditing}
                onClear={() => {
                  form.setFieldsValue({ user_identifier: undefined })
                  resetUserSearchState()
                }}
              />
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

