import { useState } from 'react'
import { Table, Tag, Dropdown, Button, App, Modal } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { Trash2, MoreVertical, Eye, CircleDot } from 'lucide-react'
import type { WaitlistItem } from '@/hooks/useWaitlist.ts'
import { useConfirmDialog } from '@resomix/hooks'

interface WaitlistTableProps {
  data: WaitlistItem[]
  loading: boolean
  selectedRowKeys: string[]
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  sortBy?: 'id' | 'created_at'
  sortOrder?: 'asc' | 'desc'
  onSelectionChange: (keys: string[]) => void
  onDelete: (ids: string[]) => void
  onUpdateStatus: (id: string, status: 'pending' | 'approved' | 'rejected') => void
  onPageChange: (page: number, pageSize: number) => void
  onSortChange: (sortBy: 'id' | 'created_at' | undefined, sortOrder: 'asc' | 'desc' | undefined) => void
}

function WaitlistTable({
  data,
  loading,
  selectedRowKeys,
  pagination,
  sortBy,
  sortOrder,
  onSelectionChange,
  onDelete,
  onUpdateStatus,
  onPageChange,
  onSortChange,
}: WaitlistTableProps) {
  const { modal } = App.useApp()
  const { confirmDelete } = useConfirmDialog()
  const [viewingWaitlist, setViewingWaitlist] = useState<WaitlistItem | null>(null)

  const handleDeleteSingle = (record: WaitlistItem) => {
    confirmDelete({
      title: 'Delete Waitlist Entry',
      content: (
        <div>
          <p>Are you sure you want to delete this waitlist entry?</p>
          <p className="mt-2 text-sm text-secondary">
            <strong>Email:</strong> {record.email}
          </p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await onDelete([record.id])
      },
    })
  }

  const handleUpdateStatus = (record: WaitlistItem, newStatus: 'pending' | 'approved' | 'rejected') => {
    const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1)
    
    modal.confirm({
      title: `Mark as ${statusLabel}`,
      content: (
        <div>
          <p>Are you sure you want to mark this waitlist entry as {statusLabel}?</p>
          <p className="mt-2 text-sm text-secondary">
            <strong>Email:</strong> {record.email}
          </p>
        </div>
      ),
      okText: 'Confirm',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        await onUpdateStatus(record.id, newStatus)
      },
    })
  }

  const handleViewWaitlist = (record: WaitlistItem) => {
    setViewingWaitlist(record)
  }

  const handleCloseWaitlistModal = () => {
    setViewingWaitlist(null)
  }

  const getStatusColor = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'pending':
        return 'orange'
      case 'approved':
        return 'green'
      case 'rejected':
        return 'red'
      default:
        return 'default'
    }
  }

  const getStatusOptions = (currentStatus: 'pending' | 'approved' | 'rejected'): MenuProps['items'] => {
    const allStatuses: Array<'pending' | 'approved' | 'rejected'> = ['pending', 'approved', 'rejected']
    const otherStatuses = allStatuses.filter(s => s !== currentStatus)
    
    return otherStatuses.map(status => ({
      key: status,
      label: status.charAt(0).toUpperCase() + status.slice(1),
    }))
  }

  const getActionMenu = (record: WaitlistItem): MenuProps['items'] => [
    {
      key: 'mark-status',
      label: 'Mark as',
      icon: <CircleDot size={16} />,
      children: getStatusOptions(record.status),
      onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation()
        const newStatus = key as 'pending' | 'approved' | 'rejected'
        handleUpdateStatus(record, newStatus)
      },
    },
    {
      key: 'view-waitlist',
      label: 'View Details',
      icon: <Eye size={16} />,
      onClick: () => handleViewWaitlist(record),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 size={16} />,
      danger: true,
      onClick: () => handleDeleteSingle(record),
    },
  ]

  const handleTableChange = (_pagination: any, _filters: any, sorter: any, extra?: { action?: string }) => {
    // antd fires this for EVERY table change, including paging. Without the action guard, turning
    // the page called onSortChange(undefined, undefined) — which resets the page to 1 — so the
    // table snapped straight back to page one and pagination looked broken.
    if (extra?.action && extra.action !== 'sort') return

    if (sorter.columnKey) {
      const order = sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : undefined
      onSortChange(sorter.columnKey, order)
    } else {
      onSortChange(undefined, undefined)
    }
  }

  const columns: TableColumnsType<WaitlistItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: true,
      sortOrder: sortBy === 'id' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (id: string) => (
        <span className="font-mono text-sm text-primary">{id}</span>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 250,
      render: (email: string) => (
        <span className="text-secondary">{email}</span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: true,
      sortOrder: sortBy === 'created_at' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (created_at: string) => (
        <span className="text-secondary text-sm">
          {new Date(created_at).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: 'pending' | 'approved' | 'rejected') => (
        <Tag color={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Dropdown
          menu={{ items: getActionMenu(record) }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button
            type="text"
            icon={<MoreVertical size={16} />}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          />
        </Dropdown>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      onSelectionChange(keys as string[])
    },
  }

  return (
    <>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        onChange={handleTableChange}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total, range) => (
            <span className="text-secondary">
              {selectedRowKeys.length > 0 && (
                <span className="text-primary font-medium mr-4">
                  {selectedRowKeys.length} selected
                </span>
              )}
              {range[0]}-{range[1]} of {total} items
            </span>
          ),
          pageSizeOptions: ['10', '20', '30', '50', '100'],
          onChange: onPageChange,
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* View Waitlist Modal */}
      <Modal
        title={
          <div className="flex items-center gap-4">
            <span>Waitlist Details</span>
            {viewingWaitlist && (
              <Tag color={getStatusColor(viewingWaitlist.status)}>
                {viewingWaitlist.status.charAt(0).toUpperCase() + viewingWaitlist.status.slice(1)}
              </Tag>
            )}
          </div>
        }
        open={viewingWaitlist !== null}
        onCancel={handleCloseWaitlistModal}
        centered
        width={500}
        footer={[
          <Button key="close" onClick={handleCloseWaitlistModal}>
            Close
          </Button>,
        ]}
      >
        {viewingWaitlist && (
          <div className="space-y-4">
            {/* Waitlist details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
              <div>
                <p className="text-sm text-secondary">ID</p>
                <p className="font-mono text-sm text-primary">{viewingWaitlist.id}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-secondary">Email</p>
                <p className="text-primary">{viewingWaitlist.email}</p>
              </div>
              <div>
                <p className="text-sm text-secondary">Created At</p>
                <p className="text-primary text-sm">
                  {new Date(viewingWaitlist.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-secondary">Updated At</p>
                <p className="text-primary text-sm">
                  {new Date(viewingWaitlist.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default WaitlistTable
