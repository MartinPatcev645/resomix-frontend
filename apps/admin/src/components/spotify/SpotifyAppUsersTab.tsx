import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import {
  AutoComplete,
  Button,
  Form,
  Input,
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
import { useSpotifyAppUsers } from '@/hooks/useSpotifyAppUsers.ts'
import { useSpotifyApps } from '@/hooks/useSpotifyApps.ts'
import { getUserOperationLimits, type AdminUserOperationLimit } from '@resomix/api-client'
import type {
  AdminSpotifyAppUser,
  AdminSpotifyAppUserUpsertRequest,
} from '@resomix/api-client'

const { Paragraph, Text } = Typography

interface SpotifyAppUsersTabProps {
  onError: (title: string, message: string) => void
  onSuccess: (title: string, message: string) => void
}

interface EditingContext {
  userIdentifier: string
}

interface UpsertFormValues {
  user_identifier: string
  spotify_app_id: number
}

const defaultFormValues: Partial<UpsertFormValues> = {
  user_identifier: '',
  spotify_app_id: undefined,
}

const pickUserIdentifier = (record: AdminSpotifyAppUser): string =>
  record.user_email ||
  record.user_username ||
  record.user_uuid ||
  String(record.user_id)

function SpotifyAppUsersTab({ onError, onSuccess }: SpotifyAppUsersTabProps) {
  const {
    data,
    loading,
    pagination,
    search,
    spotifyAppId,
    refresh,
    setPage,
    setSearch,
    setSpotifyAppId,
    clearFilters,
    upsertUser,
    deleteUser,
    loadUser,
  } = useSpotifyAppUsers({ onError, onSuccess })

  const {
    apps: spotifyApps,
    loading: appsLoading,
    refresh: refreshApps,
  } = useSpotifyApps({ onError, onSuccess })

  const [form] = Form.useForm<UpsertFormValues>()
  const userIdentifierValue = Form.useWatch('user_identifier', form)
  const [modalVisible, setModalVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingContext, setEditingContext] = useState<EditingContext | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [searchInput, setSearchInput] = useState(search)
  const [userOptions, setUserOptions] = useState<Array<{ label: string | ReactNode; value: string; disabled?: boolean }>>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { confirmDelete } = useConfirmDialog()

  // Filter to show only active apps
  const activeApps = useMemo(
    () => spotifyApps.filter((app) => app.is_active),
    [spotifyApps]
  )

  const appOptions = useMemo(
    () =>
      activeApps.map((app) => ({
        label: `${app.name} (${app.user_count} users)`,
        value: app.id,
      })),
    [activeApps]
  )

  // Search users using the operation limits API (same as operations tab uses)
  const searchUsers = useCallback(async (searchText: string) => {
    if (!searchText || searchText.trim().length < 2) {
      setUserOptions([])
      return
    }

    setUserSearchLoading(true)
    try {
      const result = await getUserOperationLimits({
        page: 1,
        page_size: 50,
        search: searchText.trim(),
      })

      if (result.success && result.data) {
        // Extract unique users from the results
        const userMap = new Map<string, { label: string | ReactNode; value: string; disabled?: boolean }>()
        
        result.data.forEach((record: AdminUserOperationLimit) => {
          const identifier = 
            record.user_email || 
            record.user_username || 
            record.user_uuid || 
            String(record.user_id)
          
          // Determine primary display name (email > username > UUID > ID)
          const primaryDisplay = 
            record.user_email || 
            record.user_username || 
            record.user_uuid || 
            `ID ${record.user_id}`
          
          // Build description with all available identifiers (similar to operation type description)
          const identifiers: string[] = []
          if (record.user_email) identifiers.push(`Email: ${record.user_email}`)
          if (record.user_username) identifiers.push(`Username: ${record.user_username}`)
          if (record.user_uuid) identifiers.push(`UUID: ${record.user_uuid}`)
          identifiers.push(`ID: ${record.user_id}`)
          
          // Format similar to operation types: "Primary — Email: x, Username: y, ID: z"
          const label = identifiers.length > 1
            ? `${primaryDisplay} — ${identifiers.join(', ')}`
            : primaryDisplay
          
          if (!userMap.has(identifier)) {
            userMap.set(identifier, { label, value: identifier })
          }
        })
        
        const options = Array.from(userMap.values()).sort((a, b) => {
          const labelA = typeof a.label === 'string' ? a.label : ''
          const labelB = typeof b.label === 'string' ? b.label : ''
          return labelA.localeCompare(labelB)
        })
        
        setUserOptions(options)
      } else {
        setUserOptions([])
      }
    } catch (error) {
      console.error('Error searching users:', error)
      setUserOptions([])
    } finally {
      setUserSearchLoading(false)
    }
  }, [])

  // Debounced user search handler
  const handleUserSearch = useCallback((searchText: string) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Debounce the API call
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchText)
    }, 300) // 300ms debounce
  }, [searchUsers])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

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
    setUserOptions([])
    if (spotifyAppId) {
      form.setFieldsValue({
        spotify_app_id: spotifyAppId,
      } as Partial<UpsertFormValues>)
    }
    setModalVisible(true)
  }

  const handleOpenEdit = async (record: AdminSpotifyAppUser) => {
    const userIdentifier = pickUserIdentifier(record)
    setIsEditing(true)
    setEditingContext({
      userIdentifier,
    })
    setModalVisible(true)
    setFormLoading(true)
    setUserOptions([])

    const existing = await loadUser(userIdentifier)

    if (!existing) {
      setModalVisible(false)
      setEditingContext(null)
      setIsEditing(false)
      setFormLoading(false)
      return
    }

    form.setFieldsValue({
      user_identifier: userIdentifier,
      spotify_app_id: existing.spotify_app_id,
    })

    setFormLoading(false)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setIsEditing(false)
    setEditingContext(null)
    setUserOptions([])
    resetForm()
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitLoading(true)

      const payload: AdminSpotifyAppUserUpsertRequest = {
        user_identifier: values.user_identifier.trim(),
        spotify_app_id: values.spotify_app_id,
      }

      const success = await upsertUser(payload)

      if (success) {
        handleCloseModal()
        // Refresh apps to update user counts
        await refreshApps()
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = (record: AdminSpotifyAppUser) => {
    const identifier = pickUserIdentifier(record)
    confirmDelete({
      title: 'Delete User Association',
      content: (
        <div className="space-y-2">
          <p>
            Are you sure you want to remove the association for user{' '}
            <strong>{identifier}</strong>?
          </p>
          <p className="text-sm text-secondary">
            App: {record.spotify_app_name}
          </p>
        </div>
      ),
      onOk: async () => {
        const success = await deleteUser(identifier)
        if (success) {
          // Refresh apps to update user counts
          await refreshApps()
        }
      },
    })
  }

  const handleRefresh = async () => {
    await refresh()
  }

  const handleRefreshApps = async () => {
    await refreshApps()
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

  const handleSpotifyAppIdChange = (value?: number) => {
    setSpotifyAppId(value)
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

  const columns: TableColumnsType<AdminSpotifyAppUser> = [
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
      title: 'Spotify App',
      dataIndex: 'spotify_app_name',
      key: 'spotify_app',
      width: 250,
      render: (name: string, record) => (
        <div className="space-y-1">
          <span className="font-medium text-primary">{name}</span>
          <span className="text-xs text-secondary">App ID: {record.spotify_app_id}</span>
        </div>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (value: string) => (
        <span className="text-secondary text-sm">{new Date(value).toLocaleString()}</span>
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
            <h2 className="text-xl font-semibold text-primary">User Associations</h2>
            <p className="text-secondary text-sm">
              Manage user associations with Spotify apps.
            </p>
          </div>
          <Space wrap>
            <Tooltip title="Refresh associations">
              <Button
                icon={<RefreshCw size={16} />}
                loading={loading}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </Tooltip>
            <Tooltip title="Reload apps">
              <Button
                icon={<RefreshCw size={16} />}
                loading={appsLoading}
                onClick={handleRefreshApps}
              >
                Reload Apps
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              Add Association
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
            placeholder="Filter by Spotify app"
            loading={appsLoading}
            options={appOptions}
            value={spotifyAppId}
            onChange={handleSpotifyAppIdChange}
            optionFilterProp="label"
          />
          <Button onClick={handleClearFilters}>Clear Filters</Button>
        </div>

        <Paragraph type="secondary" className="text-sm">
          Associate users with Spotify apps. Each user can only be associated with one app at a
          time. Only active apps are shown in the dropdown.
        </Paragraph>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record) => `${pickUserIdentifier(record)}-${record.spotify_app_id}`}
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
        title={isEditing ? 'Edit User Association' : 'Add User Association'}
        open={modalVisible}
        onCancel={handleCloseModal}
        onOk={handleSubmit}
        okText={isEditing ? 'Save Changes' : 'Create Association'}
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
              <AutoComplete
                options={
                  userSearchLoading
                    ? [
                        {
                          label: (
                            <div className="p-2 text-center">
                              <Spin size="small" /> <span className="ml-2">Searching users...</span>
                            </div>
                          ),
                          value: '__loading__',
                          disabled: true,
                        },
                      ]
                    : userOptions
                }
                onSearch={handleUserSearch}
                placeholder="Email, username, UUID, or numeric ID"
                allowClear
                notFoundContent={
                  userIdentifierValue && userIdentifierValue.length > 0 && userIdentifierValue.length < 2 ? (
                    <div className="p-2 text-secondary text-sm">
                      Type at least 2 characters to search for users
                    </div>
                  ) : userIdentifierValue && typeof userIdentifierValue === 'string' && userIdentifierValue.trim().length >= 2 ? (
                    <div className="p-2 text-secondary text-sm">
                      No matching users found. You can type an email, username, UUID, or numeric ID to create a new association.
                    </div>
                  ) : (
                    <div className="p-2 text-secondary text-sm">
                      Start typing to search for users...
                    </div>
                  )
                }
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              label="Spotify App"
              name="spotify_app_id"
              rules={[{ required: true, message: 'Please select a Spotify app' }]}
            >
              <Select
                showSearch
                placeholder="Select Spotify app"
                options={appOptions}
                loading={appsLoading}
                optionFilterProp="label"
              />
            </Form.Item>

            {isEditing && editingContext && (
              <div
                className="rounded-md border border-dashed border-default p-3"
                style={{ backgroundColor: 'var(--opacity-10)' }}
              >
                <Text type="secondary" className="text-xs">
                  Editing association for {editingContext.userIdentifier}. Changing the app will
                  update the association.
                </Text>
              </div>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default SpotifyAppUsersTab

