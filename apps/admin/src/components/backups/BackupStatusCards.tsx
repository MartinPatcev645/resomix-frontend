import { Alert, Button, Card, Popconfirm, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { HardDriveDownload, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import type { BackupServerRole, BackupStatus } from '@resomix/api-client'
import {
  componentLabel,
  formatAge,
  formatBytes,
  formatDuration,
  formatServerDateTime,
  healthColor,
  healthLabel,
  roleLabel,
  runStatusColor,
} from './backupUtils.js'

const { Text, Title } = Typography

interface Props {
  status: BackupStatus | null
  loading: boolean
  triggering: string | null
  onRun: (role: BackupServerRole) => void
  onVerify: (role: BackupServerRole, full: boolean) => void
  onRefresh: () => void
}

/**
 * The health card: per server and per component, how old is the newest usable
 * restore point.
 *
 * It reports per COMPONENT rather than per run on purpose. "Last night's run
 * succeeded" is no comfort if the database component inside it has been failing
 * for a week, and a single run-level light hides exactly that.
 */
function BackupStatusCards({ status, loading, triggering, onRun, onVerify, onRefresh }: Props) {
  if (loading && !status) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Title level={4} className="!mb-0">
            Restore points
          </Title>
          <Tag color={healthColor(status.overall_health === 'ok' ? 'ok' : status.overall_health === 'never' ? 'never' : 'stale')}>
            {status.overall_health === 'ok'
              ? 'All current'
              : status.overall_health === 'never'
              ? 'No backups recorded'
              : 'Attention needed'}
          </Tag>
        </div>
        <Space>
          <Text type="secondary" className="text-xs">
            Checked {formatServerDateTime(status.generated_at)}
          </Text>
          <Button icon={<RefreshCw size={14} />} onClick={onRefresh} size="small">
            Refresh
          </Button>
        </Space>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {status.roles.map((role) => {
          const busy = triggering === `run:${role.server_role}`
          const verifying = triggering === `verify:${role.server_role}`
          const serverRole = role.server_role as BackupServerRole

          return (
            <Card
              key={role.server_role}
              size="small"
              title={
                <div className="flex items-center gap-2">
                  <HardDriveDownload size={16} />
                  <span>{roleLabel(role.server_role)}</span>
                  {role.running && <Tag color="processing">Running</Tag>}
                </div>
              }
              extra={
                <Space>
                  <Popconfirm
                    title="Start a backup now?"
                    description="Runs the same job the nightly timer runs."
                    onConfirm={() => onRun(serverRole)}
                    okText="Start"
                  >
                    <Button
                      size="small"
                      type="primary"
                      icon={<Play size={13} />}
                      loading={busy}
                      disabled={role.running || verifying}
                    >
                      Run now
                    </Button>
                  </Popconfirm>
                  <Tooltip title="Re-read a subset of the repository and confirm it is readable">
                    <Button
                      size="small"
                      icon={<ShieldCheck size={13} />}
                      loading={verifying}
                      disabled={role.running || busy}
                      onClick={() => onVerify(serverRole, false)}
                    >
                      Verify
                    </Button>
                  </Tooltip>
                </Space>
              }
            >
              {!role.agent_configured && (
                <Alert
                  type="info"
                  showIcon
                  className="mb-3"
                  message="No backup agent connected on this server"
                  description="History and status below are recorded normally. Starting a run from here will be refused until the agent is deployed."
                />
              )}

              <div className="space-y-2">
                {role.components.map((component) => (
                  <div
                    key={component.component}
                    className="flex items-center justify-between gap-3 py-1 border-b border-default last:border-0"
                  >
                    <Text className="text-sm">{componentLabel(component.component)}</Text>
                    <Space size={8}>
                      <Text type="secondary" className="text-xs">
                        {formatAge(component.age_hours)}
                      </Text>
                      <Tag color={healthColor(component.health)} className="!mr-0">
                        {healthLabel(component.health)}
                      </Tag>
                    </Space>
                  </div>
                ))}
              </div>

              {role.last_run ? (
                <div className="mt-3 pt-3 border-t border-default flex items-center justify-between gap-2 flex-wrap">
                  <Space size={8}>
                    <Text type="secondary" className="text-xs">
                      Last run
                    </Text>
                    <Tag color={runStatusColor(role.last_run.status)} className="!mr-0">
                      {role.last_run.status}
                    </Tag>
                    <Text type="secondary" className="text-xs">
                      {formatServerDateTime(role.last_run.started_at)}
                    </Text>
                  </Space>
                  <Space size={12}>
                    <Text type="secondary" className="text-xs">
                      {formatDuration(role.last_run.duration_s)}
                    </Text>
                    <Tooltip title="Stored after compression and deduplication, which is what the Storage Box actually holds">
                      <Text type="secondary" className="text-xs">
                        {formatBytes(role.last_run.bytes_stored)}
                      </Text>
                    </Tooltip>
                  </Space>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-default">
                  <Text type="secondary" className="text-xs">
                    No runs recorded for this server yet.
                  </Text>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default BackupStatusCards
