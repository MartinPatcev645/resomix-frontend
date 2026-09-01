import { useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import {
  getBackupRuns,
  getBackupSnapshots,
  getBackupStats,
  getBackupStatus,
  triggerBackupRun,
  triggerBackupVerify,
  type BackupRun,
  type BackupServerRole,
  type BackupRunStatus,
  type BackupSnapshot,
  type BackupStats,
  type BackupStatus,
  type ListBackupRunsParams,
} from '@resomix/api-client'

/**
 * State for the admin Backups page.
 *
 * Two behaviours here are deliberate:
 *
 * 1. **Polling only while something is running.** A backup takes minutes, so the
 *    page must move on its own after "Run now" is pressed. But polling a quiet
 *    page every few seconds forever is a request per user per interval for no
 *    information, so the interval is armed by `status.roles[].running` and
 *    disarmed the moment nothing is in flight.
 *
 * 2. **A refused trigger is surfaced, not swallowed.** The API answers 503 with
 *    a message when no agent is configured yet, and 409 when a run is already in
 *    progress. Both are useful answers and neither is an error the user caused,
 *    so they are shown as warnings rather than as failures.
 */

const POLL_INTERVAL_MS = 5000

export interface BackupFilters {
  server_role?: BackupServerRole
  status?: BackupRunStatus
  trigger?: 'scheduled' | 'manual'
  days?: number
}

export function useBackups() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [runs, setRuns] = useState<BackupRun[]>([])
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([])
  const [snapshotsRole, setSnapshotsRole] = useState<BackupServerRole>('alwyzon')
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [snapshotsLoading, setSnapshotsLoading] = useState(false)
  const [triggering, setTriggering] = useState<string | null>(null)

  const [filters, setFilters] = useState<BackupFilters>({ days: 30 })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 })
  const [statsDays, setStatsDays] = useState(30)

  // Held in a ref so the polling effect does not need `status` as a dependency,
  // which would tear the interval down and rebuild it on every tick.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await getBackupStatus()
      if (res.success) setStatus(res.data)
      else message.error(res.error || 'Failed to load backup status')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async (days: number) => {
    const res = await getBackupStats(days)
    if (res.success) setStats(res.data)
  }, [])

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    try {
      const params: ListBackupRunsParams = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ...filters,
      }
      const res = await getBackupRuns(params)
      if (res.success) {
        setRuns(res.data || [])
        setPagination((p) => ({ ...p, total: res.pagination?.total ?? 0 }))
      } else {
        message.error(res.error || 'Failed to load backup runs')
      }
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.current, pagination.pageSize])

  const fetchSnapshots = useCallback(async (role: BackupServerRole, tag?: string) => {
    setSnapshotsLoading(true)
    setSnapshotsError(null)
    try {
      const res = await getBackupSnapshots(role, tag)
      if (res.success) {
        setSnapshots(res.data?.snapshots || [])
      } else {
        // The repository is read live through the agent. "No agent deployed"
        // is a different answer from "no snapshots", and the panel has to be
        // able to say which.
        setSnapshots([])
        setSnapshotsError(res.error || 'Could not read the snapshot inventory')
      }
    } finally {
      setSnapshotsLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchRuns(), fetchStats(statsDays)])
  }, [fetchStatus, fetchRuns, fetchStats, statsDays])

  const runBackup = useCallback(
    async (role: BackupServerRole, components?: string[]) => {
      setTriggering(`run:${role}`)
      try {
        const res = await triggerBackupRun(role, components)
        if (res.success) {
          message.success(res.message || `Backup started on ${role}`)
        } else {
          // 503 (no agent yet) and 409 (already running) are informative
          // answers, not faults the user caused.
          message.warning(res.message || res.error || `Could not start the backup on ${role}`)
        }
        await Promise.all([fetchStatus(), fetchRuns()])
        return res
      } finally {
        setTriggering(null)
      }
    },
    [fetchStatus, fetchRuns]
  )

  const verifyRepository = useCallback(
    async (role: BackupServerRole, full = false) => {
      setTriggering(`verify:${role}`)
      try {
        const res = await triggerBackupVerify(role, full)
        if (res.success) message.success(res.message || `Verification started on ${role}`)
        else message.warning(res.message || res.error || `Could not start verification on ${role}`)
        await Promise.all([fetchStatus(), fetchRuns()])
        return res
      } finally {
        setTriggering(null)
      }
    },
    [fetchStatus, fetchRuns]
  )

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  useEffect(() => {
    fetchStats(statsDays)
  }, [fetchStats, statsDays])

  useEffect(() => {
    fetchSnapshots(snapshotsRole)
  }, [fetchSnapshots, snapshotsRole])

  // Poll only while a run is actually in flight. See the note at the top.
  const anyRunning = !!status?.roles?.some((r) => r.running)
  useEffect(() => {
    if (!anyRunning) {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
      return
    }
    pollTimer.current = setInterval(() => {
      fetchStatus()
      fetchRuns()
    }, POLL_INTERVAL_MS)
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [anyRunning, fetchStatus, fetchRuns])

  return {
    status,
    stats,
    runs,
    snapshots,
    snapshotsRole,
    snapshotsError,
    loading,
    statusLoading,
    snapshotsLoading,
    triggering,
    filters,
    pagination,
    statsDays,
    anyRunning,
    setFilters: (next: BackupFilters) => {
      setFilters(next)
      setPagination((p) => ({ ...p, current: 1 }))
    },
    setPagination,
    setStatsDays,
    setSnapshotsRole,
    fetchSnapshots,
    refreshAll,
    runBackup,
    verifyRepository,
  }
}
