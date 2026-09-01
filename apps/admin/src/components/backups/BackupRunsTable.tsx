import { Button, Card, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableProps } from 'antd'
import { Eye } from 'lucide-react'
import type { BackupRun, BackupServerRole, BackupRunStatus } from '@resomix/api-client'
import type { BackupFilters } from '@/hooks/useBackups.js'
import {
  formatBytes,
  formatDuration,
  formatNumber,
  formatServerDateTime,
  roleLabel,
  runStatusColor,
} from './backupUtils.js'

const { Text } = Typography

interface Props {
  runs: BackupRun[]
  loading: boolean
  filters: BackupFilters
  pagination: { current: number; pageSize: number; total: number }
  onFiltersChange: (next: BackupFilters) => void
  onPageChange: (page: number, pageSize: number) => void
  onView: (run: BackupRun) => void
}

function BackupRunsTable({
  runs,
  loading,
  filters,
  pagination,
  onFiltersChange,
  onPageChange,
  onView,
}: Props) {
  const columns: TableProps<BackupRun>['columns'] = [
    {
      title: 'Started',
      dataIndex: 'started_at',
      width: 180,
      render: (_: string, run) => (
        <div className="flex flex-col">
          <Text className="text-sm">{formatServerDateTime(run.started_at ?? run.created_at)}</Text>
          <Text type="secondary" className="text-xs font-mono">
            {run.run_uid}
          </Text>
        </div>
      ),
    },
    {
      title: 'Server',
      dataIndex: 'server_role',
      width: 190,
      render: (role: string) => <Text className="text-sm">{roleLabel(role)}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (status: string, run) => (
        <Tooltip title={run.error || undefined}>
          <Tag color={runStatusColor(status)}>{status}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Trigger',
      dataIndex: 'trigger',
      width: 100,
      render: (trigger: string) => (
        <Tag color={trigger === 'manual' ? 'blue' : 'default'}>{trigger}</Tag>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration_s',
      width: 100,
      render: (value: number | null) => <Text className="text-sm">{formatDuration(value)}</Text>,
    },
    {
      // Stored, not "added". restic's added figure is pre-compression and
      // labelling it as storage would overstate growth several times over.
      title: 'Stored',
      dataIndex: 'bytes_stored',
      width: 100,
      render: (value: number) => <Text className="text-sm">{formatBytes(value)}</Text>,
    },
    {
      title: 'Files',
      dataIndex: 'files_processed',
      width: 100,
      render: (value: number) => <Text className="text-sm">{formatNumber(value)}</Text>,
    },
    {
      title: 'Components',
      key: 'components',
      render: (_: unknown, run) => (
        <Space size={4} wrap>
          {(run.components || []).map((component) => (
            <Tooltip key={component.id} title={component.error || component.component}>
              <Tag color={runStatusColor(component.status)} className="!mr-0">
                {component.component}
              </Tag>
            </Tooltip>
          ))}
          {!run.components?.length && (
            <Text type="secondary" className="text-xs">
              none reported
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, run) => (
        <Button size="small" type="text" icon={<Eye size={15} />} onClick={() => onView(run)} />
      ),
    },
  ]

  return (
    <Card
      size="small"
      title="Run history"
      extra={
        <Space wrap>
          <Select
            size="small"
            style={{ width: 170 }}
            placeholder="All servers"
            allowClear
            value={filters.server_role}
            onChange={(value?: BackupServerRole) =>
              onFiltersChange({ ...filters, server_role: value })
            }
            options={[
              { value: 'alwyzon', label: 'Alwyzon' },
              { value: 'media', label: 'Media server' },
            ]}
          />
          <Select
            size="small"
            style={{ width: 130 }}
            placeholder="All statuses"
            allowClear
            value={filters.status}
            onChange={(value?: BackupRunStatus) => onFiltersChange({ ...filters, status: value })}
            options={[
              { value: 'succeeded', label: 'Succeeded' },
              { value: 'partial', label: 'Partial' },
              { value: 'failed', label: 'Failed' },
              { value: 'running', label: 'Running' },
              { value: 'pending', label: 'Pending' },
            ]}
          />
          <Select
            size="small"
            style={{ width: 130 }}
            placeholder="All triggers"
            allowClear
            value={filters.trigger}
            onChange={(value?: 'scheduled' | 'manual') =>
              onFiltersChange({ ...filters, trigger: value })
            }
            options={[
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'manual', label: 'Manual' },
            ]}
          />
          <Select
            size="small"
            style={{ width: 120 }}
            value={filters.days}
            onChange={(value?: number) => onFiltersChange({ ...filters, days: value })}
            allowClear
            placeholder="All time"
            options={[
              { value: 7, label: 'Last 7 days' },
              { value: 30, label: 'Last 30 days' },
              { value: 90, label: 'Last 90 days' },
            ]}
          />
        </Space>
      }
    >
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={runs}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['25', '50', '100'],
          showTotal: (total) => `${total} runs`,
          onChange: onPageChange,
        }}
      />
    </Card>
  )
}

export default BackupRunsTable
