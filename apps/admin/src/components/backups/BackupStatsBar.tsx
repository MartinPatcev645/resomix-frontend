import { Card, Select, Statistic, Tooltip, Typography } from 'antd'
import type { BackupStats } from '@resomix/api-client'
import { formatBytes, formatDuration } from './backupUtils.js'

const { Text } = Typography

interface Props {
  stats: BackupStats | null
  days: number
  onDaysChange: (days: number) => void
}

/**
 * Counters for the window, plus a small bar of daily stored bytes.
 *
 * The chart is deliberately plain divs rather than a chart library: this is one
 * series of at most 90 points and the admin bundle does not need a charting
 * dependency for it.
 */
function BackupStatsBar({ stats, days, onDaysChange }: Props) {
  const daily = stats?.daily || []
  const peak = daily.reduce((max, point) => Math.max(max, point.bytes_stored), 0)
  const byStatus = stats?.runs_by_status || {}

  return (
    <Card
      size="small"
      title="Activity"
      extra={
        <Select
          size="small"
          style={{ width: 130 }}
          value={days}
          onChange={onDaysChange}
          options={[
            { value: 7, label: 'Last 7 days' },
            { value: 30, label: 'Last 30 days' },
            { value: 90, label: 'Last 90 days' },
          ]}
        />
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Statistic title="Runs" value={stats?.runs_total ?? 0} />
        <Statistic
          title="Succeeded"
          value={(byStatus.succeeded ?? 0) + (byStatus.partial ?? 0)}
          suffix={
            byStatus.partial ? (
              <Text type="secondary" className="text-xs">
                incl. {byStatus.partial} partial
              </Text>
            ) : undefined
          }
        />
        <Statistic
          title="Failed"
          value={byStatus.failed ?? 0}
          valueStyle={byStatus.failed ? { color: 'var(--ant-color-error, #cf1322)' } : undefined}
        />
        <Tooltip title="After compression and deduplication, which is what the Storage Box actually holds">
          <Statistic title="Stored" value={formatBytes(stats?.bytes_stored)} />
        </Tooltip>
      </div>

      {daily.length > 0 && (
        <div className="mt-4">
          <Text type="secondary" className="text-xs">
            Stored per day
          </Text>
          <div className="flex items-end gap-[2px] h-16 mt-2">
            {daily.map((point) => (
              <Tooltip
                key={point.date}
                title={`${point.date}: ${formatBytes(point.bytes_stored)} across ${point.runs} run(s)`}
              >
                <div
                  className="flex-1 min-w-[3px] rounded-t"
                  style={{
                    // A day with a run but nothing new to store is still a day
                    // that ran; a floor of 2px keeps it visible instead of
                    // reading as a gap in coverage.
                    height: `${peak ? Math.max(2, (point.bytes_stored / peak) * 100) : 2}%`,
                    backgroundColor: 'var(--color-primary)',
                    opacity: point.bytes_stored ? 0.85 : 0.3,
                  }}
                />
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {stats?.avg_duration_s ? (
        <div className="mt-3">
          <Text type="secondary" className="text-xs">
            Average run {formatDuration(stats.avg_duration_s)}
          </Text>
        </div>
      ) : null}
    </Card>
  )
}

export default BackupStatsBar
