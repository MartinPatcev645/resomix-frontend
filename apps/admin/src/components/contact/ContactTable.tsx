import { useState } from 'react'
import { Table, Tag, Dropdown, Button, App } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { CheckCircle, XCircle, Trash2, MoreVertical, Eye, Mail } from 'lucide-react'
import type { ContactItem } from '@/hooks/useContact.ts'
import { useConfirmDialog } from '@resomix/hooks'
import { replyToContact } from '@resomix/api-client'
import SendMessageModal from '@/components/SendMessageModal.tsx'
import SubmissionDetailDrawer from '@/components/SubmissionDetailDrawer.tsx'

interface ContactTableProps {
  data: ContactItem[]
  loading: boolean
  selectedRowKeys: string[]
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  sortBy?: 'id' | 'submitted_at'
  sortOrder?: 'asc' | 'desc'
  onSelectionChange: (keys: string[]) => void
  onDelete: (ids: string[]) => void
  onMarkStatus: (id: string, status: 'open' | 'resolved') => void
  onPageChange: (page: number, pageSize: number) => void
  onSortChange: (sortBy: 'id' | 'submitted_at' | undefined, sortOrder: 'asc' | 'desc' | undefined) => void
}

function ContactTable({
  data,
  loading,
  selectedRowKeys,
  pagination,
  sortBy,
  sortOrder,
  onSelectionChange,
  onDelete,
  onMarkStatus,
  onPageChange,
  onSortChange,
}: ContactTableProps) {
  const { modal } = App.useApp()
  const { confirmDelete } = useConfirmDialog()
  const [replyTo, setReplyTo] = useState<ContactItem | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const handleDeleteSingle = (record: ContactItem) => {
    confirmDelete({
      title: 'Delete Contact',
      content: (
        <div>
          <p>Are you sure you want to delete this contact submission?</p>
          {record.email && (
            <p className="mt-2 text-sm text-secondary">
              <strong>Email:</strong> {record.email}
            </p>
          )}
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await onDelete([record.id])
      },
    })
  }

  const handleMarkStatus = (record: ContactItem, newStatus: 'open' | 'resolved') => {
    const action = newStatus === 'resolved' ? 'resolve' : 'reopen'
    const icon = newStatus === 'resolved' ? '✓' : '↻'
    
    modal.confirm({
      title: `${icon} Mark as ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      content: (
        <div>
          <p>Are you sure you want to {action} this contact submission?</p>
          {record.email && (
            <p className="mt-2 text-sm text-secondary">
              <strong>Email:</strong> {record.email}
            </p>
          )}
        </div>
      ),
      okText: 'Confirm',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        await onMarkStatus(record.id, newStatus)
      },
    })
  }

  const getActionMenu = (record: ContactItem): MenuProps['items'] => [
    {
      key: 'mark-status',
      label: record.status === 'open' ? 'Mark as Resolved' : 'Mark as Open',
      icon: record.status === 'open' ? <CheckCircle size={16} /> : <XCircle size={16} />,
      onClick: () => handleMarkStatus(record, record.status === 'open' ? 'resolved' : 'open'),
    },
    {
      key: 'view-contact',
      label: 'View Details',
      icon: <Eye size={16} />,
      onClick: () => setDetailId(Number(record.id)),
    },
    {
      key: 'reply',
      label: 'Reply by email',
      icon: <Mail size={16} />,
      onClick: () => setReplyTo(record),
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

  const columns: TableColumnsType<ContactItem> = [
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
      title: 'Type',
      dataIndex: 'contact_type',
      key: 'contact_type',
      width: 110,
      render: (t: 'consumer' | 'partner') => (
        <Tag color={t === 'partner' ? 'blue' : 'default'}>
          {t === 'partner' ? 'Partner' : 'Consumer'}
        </Tag>
      ),
    },
    {
      title: 'From',
      key: 'from',
      width: 260,
      render: (_: any, record: ContactItem) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {record.name || record.user?.name || '—'}
            {record.is_signed_in ? (
              <Tag color="green" className="ml-2">Account</Tag>
            ) : (
              <Tag className="ml-2">Guest</Tag>
            )}
          </span>
          <span className="text-secondary text-xs">{record.email || '-'}</span>
        </div>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 180,
      sorter: true,
      sortOrder: sortBy === 'submitted_at' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (submitted_at: string) => (
        <span className="text-secondary text-sm">
          {new Date(submitted_at).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: 'open' | 'resolved') => (
        <Tag color={status === 'open' ? 'orange' : 'green'}>
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

      <SubmissionDetailDrawer
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        kind="contact"
        id={detailId}
        onReply={() => {
          const row = data.find((d) => Number(d.id) === detailId)
          if (row) setReplyTo(row)
        }}
        onMarkStatus={(next) => {
          if (detailId !== null) {
            void onMarkStatus(String(detailId), next)
            setDetailId(null)
          }
        }}
      />

      <SendMessageModal
        open={!!replyTo}
        onClose={() => setReplyTo(null)}
        channel="contact"
        sourceId={replyTo ? Number(replyTo.id) : undefined}
        recipientHint={replyTo?.email || replyTo?.name || undefined}
        send={(body, subject) =>
          replyToContact(Number(replyTo!.id), body, subject) as Promise<any>
        }
      />
    </>
  )
}

export default ContactTable
