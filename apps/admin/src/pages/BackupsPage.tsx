import { useState } from 'react'
import { Typography } from 'antd'
import type { BackupRun } from '@resomix/api-client'
import {
  BackupRunDrawer,
  BackupRunsTable,
  BackupSnapshotsPanel,
  BackupStatsBar,
  BackupStatusCards,
} from '@/components/backups/index.js'
import { useBackups } from '@/hooks/useBackups.js'

const { Title, Text } = Typography

function BackupsPage() {
  const backups = useBackups()
  const [selectedRun, setSelectedRun] = useState<BackupRun | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <Title level={3} className="!mb-1">
          Backups
        </Title>
        <Text type="secondary">
          Nightly off-site backups of the database, partner media and encrypted secrets. Health is
          reported per component, because a run that succeeded overall can still be missing a piece.
        </Text>
      </div>

      <BackupStatusCards
        status={backups.status}
        loading={backups.statusLoading}
        triggering={backups.triggering}
        onRun={backups.runBackup}
        onVerify={backups.verifyRepository}
        onRefresh={backups.refreshAll}
      />

      <BackupStatsBar
        stats={backups.stats}
        days={backups.statsDays}
        onDaysChange={backups.setStatsDays}
      />

      <BackupRunsTable
        runs={backups.runs}
        loading={backups.loading}
        filters={backups.filters}
        pagination={backups.pagination}
        onFiltersChange={backups.setFilters}
        onPageChange={(current, pageSize) =>
          backups.setPagination((p) => ({ ...p, current, pageSize }))
        }
        onView={setSelectedRun}
      />

      <BackupSnapshotsPanel
        snapshots={backups.snapshots}
        loading={backups.snapshotsLoading}
        role={backups.snapshotsRole}
        error={backups.snapshotsError}
        onRoleChange={backups.setSnapshotsRole}
        onRefresh={() => backups.fetchSnapshots(backups.snapshotsRole)}
      />

      <BackupRunDrawer
        run={selectedRun}
        open={!!selectedRun}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  )
}

export default BackupsPage
