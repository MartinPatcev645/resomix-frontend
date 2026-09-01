import { Alert, Descriptions, Drawer, Empty, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableProps } from 'antd'
import type { BackupComponent, BackupRun } from '@resomix/api-client'
import {
  componentLabel,
  componentStatusColor,
  formatBytes,
  formatDuration,
  formatNumber,
  formatServerDateTime,
  roleLabel,
  runStatusColor,
} from './backupUtils.js'

const { Text } = Typography

interface Props {
  run: BackupRun | null
  open: boolean
  onClose: () => void
}

/**
 * One run, broken down by component.
 *
 * Both byte figures are shown side by side. `Added` is restic's logical,
 * pre-compression number and `Stored` is what actually reached the Storage Box;
 * on the database they differ by about 6x, so showing only one of them would
 * either overstate storage growth or understate how much data was handled.
 */
function BackupRunDrawer({ run, open, onClose }: Props) {
  const columns: TableProps<BackupComponent>['columns'] = [
    {
      title: 'Component',
      dataIndex: 'component',
      render: (name: string, component) => (
        <div className="flex flex-col">
          <Text className="text-sm">{componentLabel(name)}</Text>
          <Text type="secondary" className="text-xs font-mono">
            {component.snapshot_id || '—'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => <Tag color={componentStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Duration',
      dataIndex: 'duration_s',
      width: 100,
      render: (value: number | null) => formatDuration(value),
    },
    {
      title: 'Files',
      key: 'files',
      width: 160,
      render: (_: unknown, component) => (
        <Text type="secondary" className="text-xs">
          {formatNumber(component.files_processed)} seen · {formatNumber(component.files_new)} new ·{' '}
          {formatNumber(component.files_changed)} changed
        </Text>
      ),
    },
    {
      title: 'Added',
      dataIndex: 'bytes_added',
      width: 100,
      render: (value: number) => (
        <Tooltip title="restic's logical figure, before compression">
          <Text type="secondary" className="text-xs">
            {formatBytes(value)}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Stored',
      dataIndex: 'bytes_stored',
      width: 100,
      render: (value: number) => (
        <Tooltip title="What actually reached the Storage Box">
          <Text className="text-sm">{formatBytes(value)}</Text>
        </Tooltip>
      ),
    },
  ]

  return (
    <Drawer
      title={run ? `Backup run ${run.run_uid}` : 'Backup run'}
      width={900}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      {!run ? (
        <Empty description="No run selected" />
      ) : (
        <div className="space-y-4">
          {run.error && (
            <Alert
              type={run.status === 'partial' ? 'warning' : 'error'}
              showIcon
              message={run.status === 'partial' ? 'Completed with gaps' : 'Run failed'}
              description={run.error}
            />
          )}

          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Status">
              <Tag color={runStatusColor(run.status)}>{run.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Server">{roleLabel(run.server_role)}</Descriptions.Item>
            <Descriptions.Item label="Trigger">
              <Tag color={run.trigger === 'manual' ? 'blue' : 'default'}>{run.trigger}</Tag>
              {run.triggered_by_user_id ? (
                <Text type="secondary" className="text-xs ml-2">
                  by user #{run.triggered_by_user_id}
                </Text>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="Host">{run.hostname || '—'}</Descriptions.Item>
            <Descriptions.Item label="Started">
              {formatServerDateTime(run.started_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Finished">
              {formatServerDateTime(run.finished_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Duration">{formatDuration(run.duration_s)}</Descriptions.Item>
            <Descriptions.Item label="Stored">{formatBytes(run.bytes_stored)}</Descriptions.Item>
          </Descriptions>

          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={run.components || []}
            pagination={false}
            locale={{ emptyText: 'No component reported for this run' }}
            expandable={{
              // Only failures carry a message worth expanding for.
              rowExpandable: (component) => !!component.error,
              expandedRowRender: (component) => (
                <Text type="danger" className="text-xs whitespace-pre-wrap">
                  {component.error}
                </Text>
              ),
            }}
          />
        </div>
      )}
    </Drawer>
  )
}

export default BackupRunDrawer
