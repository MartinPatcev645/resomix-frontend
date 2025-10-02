import { Table, Tag, Dropdown, Button, Modal, Descriptions, type MenuProps, type TableColumnsType } from 'antd'
import { MoreVertical, Eye } from 'lucide-react'
import { useState } from 'react'
import type { PlaylistDetailsResponse } from '@resomix/api-client'

type PlaylistData = NonNullable<PlaylistDetailsResponse['data']>
type TrackItem = PlaylistData['tracks'][number]

interface PlaylistTracksTableProps {
  tracks: TrackItem[]
}

export default function PlaylistTracksTable({ tracks }: PlaylistTracksTableProps) {
  const [viewingTrack, setViewingTrack] = useState<TrackItem | null>(null)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const handleViewTrack = (track: TrackItem) => {
    setViewingTrack(track)
  }

  const getActionMenu = (record: TrackItem): MenuProps['items'] => [
    {
      key: 'view-track',
      label: 'View Details',
      icon: <Eye size={16} />,
      onClick: () => handleViewTrack(record),
    },
  ]

  const columns: TableColumnsType<TrackItem> = [
    {
      title: '#',
      dataIndex: 'position',
      key: 'position',
      width: 60,
      fixed: 'left',
      render: (position: number) => <span className="font-semibold">{position}</span>,
    },
    {
      title: 'UUID',
      dataIndex: ['track', 'uuid'],
      key: 'uuid',
      width: 280,
      render: (uuid: string) => (
        <span className="font-mono text-xs break-all">{uuid}</span>
      ),
    },
    {
      title: 'Title',
      dataIndex: ['track', 'title'],
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Artists',
      dataIndex: ['track', 'artists'],
      key: 'artists',
      width: 180,
      ellipsis: true,
      render: (artists: string[]) => artists.join(', ') || 'N/A',
    },
    {
      title: 'Duration',
      dataIndex: ['track', 'duration_sec'],
      key: 'duration',
      width: 100,
      render: (duration: number) => formatDuration(duration),
    },
    {
      title: 'File Size',
      dataIndex: ['track', 'file_size'],
      key: 'file_size',
      width: 110,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: 'Type',
      dataIndex: ['track', 'type'],
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Tag color="cyan">{type}</Tag>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (score: number | null) => 
        score !== null ? (
          <Tag color="purple">{(score * 100).toFixed(1)}%</Tag>
        ) : (
          <span className="text-secondary">N/A</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 80,
      render: (_: unknown, record: TrackItem) => (
        <Dropdown menu={{ items: getActionMenu(record) }} trigger={['click']}>
          <Button
            type="text"
            icon={<MoreVertical size={16} />}
            className="flex items-center justify-center"
          />
        </Dropdown>
      ),
    },
  ]

  return (
    <>
      <Table
        columns={columns}
        dataSource={tracks}
        rowKey={(record) => `${record.position}-${record.track.id}`}
        pagination={{
          defaultPageSize: 30,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} tracks`,
          pageSizeOptions: ['10', '30', '50', '100'],
        }}
        scroll={{ x: 'max-content' }}
        size="small"
      />

      {/* View Track Details Modal */}
      <Modal
        title="Track Details"
        open={viewingTrack !== null}
        onCancel={() => setViewingTrack(null)}
        footer={[
          <Button key="close" onClick={() => setViewingTrack(null)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {viewingTrack && (
          <div className="space-y-4">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Position" span={1}>
                {viewingTrack.position}
              </Descriptions.Item>
              {viewingTrack.score !== null && (
                <Descriptions.Item label="Score" span={1}>
                  <Tag color="purple">{(viewingTrack.score * 100).toFixed(2)}%</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="ID" span={1}>
                {viewingTrack.track.id}
              </Descriptions.Item>
              <Descriptions.Item label="UUID" span={1}>
                <span className="font-mono text-xs break-all">{viewingTrack.track.uuid}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Title" span={2}>
                {viewingTrack.track.title}
              </Descriptions.Item>
              <Descriptions.Item label="Artists" span={2}>
                {viewingTrack.track.artists.join(', ') || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {formatDuration(viewingTrack.track.duration_sec)}
              </Descriptions.Item>
              <Descriptions.Item label="File Size">
                {formatFileSize(viewingTrack.track.file_size)}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color="cyan">{viewingTrack.track.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Genre">
                {viewingTrack.track.genre || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Label">
                {viewingTrack.track.label || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Album">
                {viewingTrack.track.album || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Year">
                {viewingTrack.track.year || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="BPM">
                {viewingTrack.track.bpm || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Key">
                {viewingTrack.track.musical_key || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="File Path" span={2}>
                <span className="font-mono text-xs break-all">{viewingTrack.track.file_path}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Preview Path" span={2}>
                <span className="font-mono text-xs break-all">
                  {viewingTrack.track.preview_path || 'N/A'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Created At" span={2}>
                {new Date(viewingTrack.track.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </>
  )
} 