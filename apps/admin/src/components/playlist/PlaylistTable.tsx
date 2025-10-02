import { useState } from 'react'
import { Table, Tag, Dropdown, Button, Modal } from 'antd'
import type { TableColumnsType, MenuProps } from 'antd'
import { Trash2, MoreVertical, Eye, Lock, Unlock, Expand } from 'lucide-react'
import type { PlaylistItem } from '@/hooks/usePlaylist.ts'
import { useConfirmDialog } from '@resomix/hooks'

interface PlaylistTableProps {
  data: PlaylistItem[]
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
  onPageChange: (page: number, pageSize: number) => void
  onSortChange: (sortBy: 'id' | 'created_at' | undefined, sortOrder: 'asc' | 'desc' | undefined) => void
}

function PlaylistTable({
  data,
  loading,
  selectedRowKeys,
  pagination,
  sortBy,
  sortOrder,
  onSelectionChange,
  onDelete,
  onPageChange,
  onSortChange,
}: PlaylistTableProps) {
  const { confirmDelete } = useConfirmDialog()
  const [viewingPlaylist, setViewingPlaylist] = useState<PlaylistItem | null>(null)

  const handleDeleteSingle = (record: PlaylistItem) => {
    confirmDelete({
      title: 'Delete Playlist',
      content: (
        <div>
          <p>Are you sure you want to delete this playlist?</p>
          <p className="mt-2 text-sm text-secondary">
            <strong>Name:</strong> {record.name}
          </p>
          <p className="mt-1 text-sm text-secondary">
            <strong>UUID:</strong> {record.uuid}
          </p>
          <p className="mt-2 text-sm text-red-600">This action cannot be undone.</p>
        </div>
      ),
      onOk: async () => {
        await onDelete([record.id])
      },
    })
  }

  const handleViewPlaylist = (record: PlaylistItem) => {
    setViewingPlaylist(record)
  }

  const handleClosePlaylistModal = () => {
    setViewingPlaylist(null)
  }

  const getActionMenu = (record: PlaylistItem): MenuProps['items'] => [
    {
      key: 'view-playlist',
      label: 'View Details',
      icon: <Eye size={16} />,
      onClick: () => handleViewPlaylist(record),
    },
    {
      key: 'expand-playlist',
      label: 'Expand Playlist',
      icon: <Expand size={16} />,
      onClick: () => {
        window.open(`/playlists/${record.uuid}`, '_blank')
      },
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'custom':
        return 'blue'
      case 'similarity':
        return 'purple'
      case 'waiting_segments':
        return 'orange'
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'custom':
        return 'Custom'
      case 'similarity':
        return 'Similarity'
      case 'waiting_segments':
        return 'Waiting Segments'
      default:
        return type
    }
  }

  const columns: TableColumnsType<PlaylistItem> = [
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
      title: 'UUID',
      dataIndex: 'uuid',
      key: 'uuid',
      width: 200,
      render: (uuid: string) => (
        <span className="font-mono text-xs text-secondary">{uuid}</span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (name: string) => (
        <span className="text-primary font-medium">{name}</span>
      ),
    },
    {
      title: 'Visibility',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 140,
      render: (is_public: boolean) => (
        <Tag 
          color={is_public ? 'green' : 'default'} 
          icon={is_public ? <Unlock size={12} /> : <Lock size={12} />}
          style={{ minWidth: '90px', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', justifyContent: 'evenly', gap: '4px' }}
        >
          {is_public ? 'Public' : 'Private'}
        </Tag>
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

      {/* View Playlist Modal */}
      <Modal
        title={
          <div className="flex items-center gap-4">
            <span>Playlist Details</span>
            {viewingPlaylist && (
              <Tag color={getTypeColor(viewingPlaylist.type)}>
                {getTypeLabel(viewingPlaylist.type)}
              </Tag>
            )}
          </div>
        }
        open={viewingPlaylist !== null}
        onCancel={handleClosePlaylistModal}
        centered
        width={600}
        footer={[
          <Button key="close" onClick={handleClosePlaylistModal}>
            Close
          </Button>,
        ]}
      >
        {viewingPlaylist && (
          <div className="space-y-4">
            {/* Playlist details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
              <div>
                <p className="text-sm text-secondary">ID</p>
                <p className="font-mono text-sm text-primary">{viewingPlaylist.id}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-secondary">UUID</p>
                <p className="font-mono text-xs text-primary break-all">{viewingPlaylist.uuid}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-secondary">Name</p>
                <p className="text-primary font-medium">{viewingPlaylist.name}</p>
              </div>
              {viewingPlaylist.user_id && (
                <div className="col-span-2">
                  <p className="text-sm text-secondary">User ID</p>
                  <p className="font-mono text-xs text-primary break-all">{viewingPlaylist.user_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-secondary">Type</p>
                <Tag color={getTypeColor(viewingPlaylist.type)}>
                  {getTypeLabel(viewingPlaylist.type)}
                </Tag>
              </div>
              <div>
                <p className="text-sm text-secondary">Visibility</p>
                <Tag 
                  color={viewingPlaylist.is_public ? 'green' : 'default'} 
                  icon={viewingPlaylist.is_public ? <Unlock size={12} /> : <Lock size={12} />}
                  className="mt-1"
                  style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
                >
                  {viewingPlaylist.is_public ? 'Public' : 'Private'}
                </Tag>
              </div>
              {viewingPlaylist.seed_track_id && (
                <div>
                  <p className="text-sm text-secondary">Seed Track ID</p>
                  <p className="font-mono text-sm text-primary">{viewingPlaylist.seed_track_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-secondary">Created At</p>
                <p className="text-primary text-sm">
                  {new Date(viewingPlaylist.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default PlaylistTable
