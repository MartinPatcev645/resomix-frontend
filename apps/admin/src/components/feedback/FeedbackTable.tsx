import { useState } from 'react'
import { Table, Tag, Dropdown, Button, App, Modal, Input } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { CheckCircle, XCircle, Trash2, MoreVertical, Eye } from 'lucide-react'
import type { FeedbackItem } from '@/hooks/useFeedback.ts'

const { TextArea } = Input

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
  const { modal } = App.useApp()
  const [viewingMessage, setViewingMessage] = useState<FeedbackItem | null>(null)

  const handleDeleteSingle = (record: FeedbackItem) => {
    modal.confirm({
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
      okText: 'Delete',
      okType: 'danger',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
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

  const handleViewMessage = (record: FeedbackItem) => {
    setViewingMessage(record)
  }

  const handleCloseMessageModal = () => {
    setViewingMessage(null)
  }

  const handleMarkStatusFromModal = async (status: 'open' | 'resolved') => {
    if (viewingMessage) {
      await onMarkStatus(viewingMessage.id, status)
      setViewingMessage(null)
    }
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
      onClick: () => handleViewMessage(record),
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
    <>
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

      {/* View Message Modal */}
      <Modal
        title={
          <div className="flex items-center gap-4">
            <span>Feedback Message</span>
            {viewingMessage && (
              <Tag color={viewingMessage.status === 'open' ? 'orange' : 'green'}>
                {viewingMessage.status.charAt(0).toUpperCase() + viewingMessage.status.slice(1)}
              </Tag>
            )}
          </div>
        }
        open={viewingMessage !== null}
        onCancel={handleCloseMessageModal}
        centered
        width={600}
        footer={[
          <Button key="close" onClick={handleCloseMessageModal}>
            Close
          </Button>,
          viewingMessage && (
            <Button
              key="mark-status"
              type="primary"
              icon={viewingMessage.status === 'open' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              onClick={() => handleMarkStatusFromModal(viewingMessage.status === 'open' ? 'resolved' : 'open')}
            >
              Mark as {viewingMessage.status === 'open' ? 'Resolved' : 'Open'}
            </Button>
          ),
        ]}
      >
        {viewingMessage && (
          <div className="space-y-4">
            {/* Feedback details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
              <div>
                <p className="text-sm text-secondary">ID</p>
                <p className="font-mono text-sm text-primary">{viewingMessage.id}</p>
              </div>
              {viewingMessage.satisfaction !== null && (
                <div>
                  <p className="text-sm text-secondary">Satisfaction</p>
                  <p className="text-primary">{viewingMessage.satisfaction}/10</p>
                </div>
              )}
              {viewingMessage.recommendation !== null && (
                <div>
                  <p className="text-sm text-secondary">Recommendation</p>
                  <p className="text-primary">{viewingMessage.recommendation}/10</p>
                </div>
              )}
              {viewingMessage.category && (
                <div>
                  <p className="text-sm text-secondary">Category</p>
                  <p className="text-primary">{viewingMessage.category}</p>
                </div>
              )}
              {viewingMessage.submitted_at && (
                <div>
                  <p className="text-sm text-secondary">Submitted</p>
                  <p className="text-primary text-sm">
                    {new Date(viewingMessage.submitted_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <p className="text-sm text-secondary mb-2">Message</p>
              <TextArea
                value={viewingMessage.message || 'No message provided'}
                readOnly
                autoSize={{ minRows: 4, maxRows: 12 }}
                className="font-sans"
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default FeedbackTable
