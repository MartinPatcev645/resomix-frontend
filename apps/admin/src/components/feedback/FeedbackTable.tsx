import { Table, Tag, Dropdown, Button, Modal } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { CheckCircle, XCircle, Trash2, MoreVertical } from 'lucide-react'
import type { FeedbackItem } from '@/hooks/useFeedback.ts'

interface FeedbackTableProps {
  data: FeedbackItem[]
  loading: boolean
  selectedRowKeys: string[]
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  onSelectionChange: (keys: string[]) => void
  onDelete: (ids: string[]) => void
  onMarkStatus: (id: string, status: 'open' | 'resolved') => void
  onPageChange: (page: number, pageSize: number) => void
}

function FeedbackTable({
  data,
  loading,
  selectedRowKeys,
  pagination,
  onSelectionChange,
  onDelete,
  onMarkStatus,
  onPageChange,
}: FeedbackTableProps) {
  const handleDeleteSingle = (record: FeedbackItem) => {
    Modal.confirm({
      title: 'Delete Feedback',
      content: `Are you sure you want to delete this feedback?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => onDelete([record.id]),
    })
  }

  const handleMarkStatus = (record: FeedbackItem, newStatus: 'open' | 'resolved') => {
    const action = newStatus === 'resolved' ? 'resolve' : 'reopen'
    Modal.confirm({
      title: `Mark as ${newStatus}`,
      content: `Are you sure you want to ${action} this feedback?`,
      okText: 'Confirm',
      onOk: () => onMarkStatus(record.id, newStatus),
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

  const columns: TableColumnsType<FeedbackItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <span className="font-mono text-sm text-primary">{id}</span>
      ),
    },
    {
      title: 'Satisfaction',
      dataIndex: 'satisfaction',
      key: 'satisfaction',
      width: 120,
      align: 'center',
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
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (message: string | null) => (
        <span className="text-secondary" title={message || ''}>
          {message || '-'}
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
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      rowSelection={rowSelection}
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
      scroll={{ x: 800 }}
    />
  )
}

export default FeedbackTable
