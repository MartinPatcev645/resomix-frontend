import { useState } from 'react'
import { Table, Tag, Dropdown, Button, App } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { CheckCircle, XCircle, Trash2, MoreVertical, Eye, Mail } from 'lucide-react'
import type { FeedbackItem } from '@/hooks/useFeedback.ts'
import { useConfirmDialog } from '@resomix/hooks'
import { replyToFeedback } from '@resomix/api-client'
import SendMessageModal from '@/components/SendMessageModal.tsx'
import SubmissionDetailDrawer from '@/components/SubmissionDetailDrawer.tsx'

interface FeedbackTableProps {
  data: FeedbackItem[]
  loading: boolean
  selectedRowKeys: string[]
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  sortBy?: 'id' | 'submitted_at' | 'satisfaction' | 'recommendation'
  sortOrder?: 'asc' | 'desc'
  onSelectionChange: (keys: string[]) => void
  onDelete: (ids: string[]) => void
  onMarkStatus: (id: string, status: 'open' | 'resolved') => void
  onPageChange: (page: number, pageSize: number) => void
  onSortChange: (sortBy: 'id' | 'submitted_at' | 'satisfaction' | 'recommendation' | undefined, sortOrder: 'asc' | 'desc' | undefined) => void
}

function FeedbackTable({
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
}: FeedbackTableProps) {
  const { modal } = App.useApp()
  const { confirmDelete } = useConfirmDialog()
  const [replyTo, setReplyTo] = useState<FeedbackItem | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const handleDeleteSingle = (record: FeedbackItem) => {
    confirmDelete({
      title: 'Delete Feedback',
      content: (
        <div>
          <p>Are you sure you want to delete this feedback?</p>
          {record.message && (
            <p className="mt-2 text-sm text-secondary">
              <strong>Message:</strong> {record.message.substring(0, 100)}{record.message.length > 100 ? '...' : ''}
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

  const handleMarkStatus = (record: FeedbackItem, newStatus: 'open' | 'resolved') => {
    const action = newStatus === 'resolved' ? 'resolve' : 'reopen'
    const icon = newStatus === 'resolved' ? '✓' : '↻'
    
    modal.confirm({
      title: `${icon} Mark as ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      content: (
        <div>
          <p>Are you sure you want to {action} this feedback?</p>
          {record.message && (
            <p className="mt-2 text-sm text-secondary">
              <strong>Message:</strong> {record.message.substring(0, 100)}{record.message.length > 100 ? '...' : ''}
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

  const getActionMenu = (record: FeedbackItem): MenuProps['items'] => [
    {
      key: 'mark-status',
      label: record.status === 'open' ? 'Mark as Resolved' : 'Mark as Open',
      icon: record.status === 'open' ? <CheckCircle size={16} /> : <XCircle size={16} />,
      onClick: () => handleMarkStatus(record, record.status === 'open' ? 'resolved' : 'open'),
    },
    {
      key: 'view-message',
      label: 'View Message',
      icon: <Eye size={16} />,
      onClick: () => setDetailId(Number(record.id)),
    },
    {
      key: 'reply',
      label: 'Reply by email',
      icon: <Mail size={16} />,
      // Feedback is always tied to an account, so there is always an address — unlike a contact
      // form, which can be submitted by someone who is not signed in.
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

  const columns: TableColumnsType<FeedbackItem> = [
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
      title: 'From',
      key: 'from',
      width: 220,
      render: (_: any, record: FeedbackItem) => {
        // Feedback can be left by anyone; saying so plainly beats an empty cell that reads as
        // missing data.
        if (!record.user) {
          return <span className="text-secondary">{record.is_signed_in ? `User #${record.user_id}` : 'Anonymous'}</span>
        }
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {record.user.name || record.user.username || record.user.email}
              {!record.user.is_active && <Tag color="red" className="ml-2">Inactive</Tag>}
            </span>
            <span className="text-secondary text-xs">{record.user.email}</span>
          </div>
        )
      },
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (c: string | null) => (c ? <Tag>{c}</Tag> : <span className="text-secondary">-</span>),
    },
    {
      title: 'Satisfaction',
      dataIndex: 'satisfaction',
      key: 'satisfaction',
      width: 120,
      align: 'center',
      sorter: true,
      sortOrder: sortBy === 'satisfaction' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (satisfaction: number | null) => (
        satisfaction !== null ? (
          <div className="flex items-center justify-center gap-1">
            <span className="text-lg">{satisfaction}</span>
            <span className="text-sm text-secondary">/10</span>
          </div>
        ) : <span className="text-secondary">-</span>
      ),
    },
    {
      title: 'Recommendation',
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 150,
      align: 'center',
      sorter: true,
      sortOrder: sortBy === 'recommendation' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
      render: (recommendation: number | null) => (
        recommendation !== null ? (
          <div className="flex items-center justify-center gap-1">
            <span className="text-lg">{recommendation}</span>
            <span className="text-sm text-secondary">/10</span>
          </div>
        ) : <span className="text-secondary">-</span>
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
        kind="feedback"
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

      {/* No `recipientHint`: the feedback list carries no email — it is resolved server-side
          from the account. The preview shows the real recipient before anything is sent,
          which is the guard that matters. */}
      <SendMessageModal
        open={!!replyTo}
        onClose={() => setReplyTo(null)}
        channel="feedback"
        sourceId={replyTo ? Number(replyTo.id) : undefined}
        send={(body, subject) =>
          replyToFeedback(Number(replyTo!.id), body, subject) as Promise<any>
        }
      />
    </>
  )
}

export default FeedbackTable
