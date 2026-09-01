import { Alert, Button, Card, Select, Space, Table, Tag, Typography } from 'antd'
import type { TableProps } from 'antd'
import { RefreshCw } from 'lucide-react'
import type { BackupServerRole, BackupSnapshot } from '@resomix/api-client'
import { formatBytes, formatServerDateTime } from './backupUtils.js'

const { Text } = Typography

interface Props {
  snapshots: BackupSnapshot[]
  loading: boolean
  role: BackupServerRole
  error: string | null
  onRoleChange: (role: BackupServerRole) => void
  onRefresh: () => void
}

/**
 * The repository's own inventory, read live from restic rather than from our
 * tables.
 *
 * Our run history says what we believe happened. This says what is actually
 * recoverable. The panel exists for the case where the two disagree, so it must
 * never be served from the same source as the table above it.
 */
function BackupSnapshotsPanel({ snapshots, loading, role, error, onRoleChange, onRefresh }: Props) {
  const columns: TableProps<BackupSnapshot>['columns'] = [
    {
      title: 'Snapshot',
      dataIndex: 'short_id',
      width: 120,
      render: (shortId: string | undefined, snapshot) => (
        <Text className="text-xs font-mono">{shortId || snapshot.id?.slice(0, 8)}</Text>
      ),
    },
    {
      title: 'Taken',
      dataIndex: 'time',
      width: 180,
      render: (value: string) => formatServerDateTime(value),
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      width: 220,
      render: (tags: string[] | undefined) => (
        <Space size={4} wrap>
          {(tags || []).map((tag) => (
            <Tag key={tag} className="!mr-0">
              {tag}
            </Tag>
          ))}
          {!tags?.length && <Text type="secondary" className="text-xs">untagged</Text>}
        </Space>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      width: 100,
      render: (value: number | undefined) => (value ? formatBytes(value) : '—'),
    },
    {
      title: 'Paths',
      dataIndex: 'paths',
      render: (paths: string[] | undefined) => (
        <Text type="secondary" className="text-xs break-all">
          {(paths || []).join(', ') || '—'}
        </Text>
      ),
    },
  ]

  return (
    <Card
      size="small"
      title="Repository inventory"
      extra={
        <Space>
          <Select
            size="small"
            style={{ width: 170 }}
            value={role}
            onChange={onRoleChange}
            options={[
              { value: 'alwyzon', label: 'Alwyzon' },
              { value: 'media', label: 'Media server' },
            ]}
          />
          <Button size="small" icon={<RefreshCw size={14} />} onClick={onRefresh}>
            Refresh
          </Button>
        </Space>
      }
    >
      {error ? (
        <Alert
          type="info"
          showIcon
          message="Inventory unavailable"
          description={`${error}. Run history and status above are unaffected: they are recorded in the database and do not depend on reaching the server.`}
        />
      ) : (
        <Table
          rowKey={(snapshot) => snapshot.id}
          size="small"
          columns={columns}
          dataSource={snapshots}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'No snapshots in this repository' }}
        />
      )}
    </Card>
  )
}

export default BackupSnapshotsPanel
