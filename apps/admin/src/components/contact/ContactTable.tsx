import { useState } from 'react'
import { Table, Tag, Dropdown, Button, App, Modal, Input } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { CheckCircle, XCircle, Trash2, MoreVertical, Eye } from 'lucide-react'
import type { ContactItem } from '@/hooks/useContact.ts'
import { useConfirmDialog } from '@resomix/hooks'

const { TextArea } = Input

/**
 * The B2B qualification answers, in the order the /partners form asks them, with the
 * unanswered ones dropped.
 *
 * The two landing partner forms collect different subsets — /partners asks role, partner type,
 * preferred path and catalogue context; /partners-pilot asks role, partner type and catalogue
 * size — so a blank is normal, not missing data, and is simply not rendered.
 */
interface PartnerField {
  label: string
  value: string
  /** Free text — give it the full row rather than half of one. */
  wide?: boolean
}

const partnerFields = (c: ContactItem): PartnerField[] => {
  const all: { label: string; value: string | null; wide?: boolean }[] = [
    { label: 'Company', value: c.company_name },
    { label: 'Role', value: c.role },
    { label: 'Partner type', value: c.partner_type },
    { label: 'Preferred path', value: c.preferred_path },
    { label: 'Catalogue / product context', value: c.catalog_context, wide: true },
    { label: 'Estimated catalogue size', value: c.catalog_size },
    { label: 'Estimated monthly calls', value: c.estimated_calls },
  ]
  return all.flatMap((f) => (f.value ? [{ ...f, value: f.value }] : []))
}

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
  const [viewingContact, setViewingContact] = useState<ContactItem | null>(null)
  const partnerDetails = viewingContact ? partnerFields(viewingContact) : []

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

  const handleViewContact = (record: ContactItem) => {
    setViewingContact(record)
  }

  const handleCloseContactModal = () => {
    setViewingContact(null)
  }

  const handleMarkStatusFromModal = async (status: 'open' | 'resolved') => {
    if (viewingContact) {
      await onMarkStatus(viewingContact.id, status)
      setViewingContact(null)
    }
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
      onClick: () => handleViewContact(record),
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

  const handleTableChange = (_pagination: any, _filters: any, sorter: any) => {
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
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email: string | null) => (
        <span className="text-secondary">
          {email || '-'}
        </span>
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

      {/* View Contact Modal */}
      <Modal
        title={
          <div className="flex items-center gap-4">
            <span>Contact Details</span>
            {viewingContact && (
              <Tag color={viewingContact.status === 'open' ? 'orange' : 'green'}>
                {viewingContact.status.charAt(0).toUpperCase() + viewingContact.status.slice(1)}
              </Tag>
            )}
          </div>
        }
        open={viewingContact !== null}
        onCancel={handleCloseContactModal}
        centered
        width={600}
        footer={[
          <Button key="close" onClick={handleCloseContactModal}>
            Close
          </Button>,
          viewingContact && (
            <Button
              key="mark-status"
              type="primary"
              icon={viewingContact.status === 'open' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              onClick={() => handleMarkStatusFromModal(viewingContact.status === 'open' ? 'resolved' : 'open')}
            >
              Mark as {viewingContact.status === 'open' ? 'Resolved' : 'Open'}
            </Button>
          ),
        ]}
      >
        {viewingContact && (
          <div className="space-y-4">
            {/* Contact details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
              <div>
                <p className="text-sm text-secondary">ID</p>
                <p className="font-mono text-sm text-primary">{viewingContact.id}</p>
              </div>
              {viewingContact.name && (
                <div>
                  <p className="text-sm text-secondary">Name</p>
                  <p className="text-primary">{viewingContact.name}</p>
                </div>
              )}
              {viewingContact.email && (
                <div>
                  <p className="text-sm text-secondary">Email</p>
                  <p className="text-primary">{viewingContact.email}</p>
                </div>
              )}
              {viewingContact.phone && (
                <div>
                  <p className="text-sm text-secondary">Phone</p>
                  <p className="text-primary">{viewingContact.phone}</p>
                </div>
              )}
              {viewingContact.subject && (
                <div className="col-span-2">
                  <p className="text-sm text-secondary">Subject</p>
                  <p className="text-primary">{viewingContact.subject}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-secondary">Type</p>
                <Tag color={viewingContact.contact_type === 'partner' ? 'blue' : 'default'}>
                  {viewingContact.contact_type === 'partner' ? 'Partner' : 'Consumer'}
                </Tag>
              </div>
              {viewingContact.submitted_at && (
                <div>
                  <p className="text-sm text-secondary">Submitted</p>
                  <p className="text-primary text-sm">
                    {new Date(viewingContact.submitted_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Partner qualification — its own section so the B2B answers don't get lost among the
                generic contact details. Every field is optional: the two landing partner forms ask
                different questions, so only what was actually answered is rendered. */}
            {viewingContact.contact_type === 'partner' && partnerDetails.length > 0 && (
              <div>
                <p className="text-sm text-secondary mb-2">Partner qualification</p>
                <div
                  className="grid grid-cols-2 gap-4 p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--color-background-secondary)' }}
                >
                  {partnerDetails.map(({ label, value, wide }) => (
                    <div key={label} className={wide ? 'col-span-2' : undefined}>
                      <p className="text-sm text-secondary">{label}</p>
                      <p className="text-primary">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message */}
            <div>
              <p className="text-sm text-secondary mb-2">Message</p>
              <TextArea
                value={viewingContact.message || 'No message provided'}
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

export default ContactTable
