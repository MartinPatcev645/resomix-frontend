import type {
  BackupComponentStatus,
  BackupHealth,
  BackupRunStatus,
} from '@resomix/api-client'

/** Human labels. The wire names are terse on purpose; these are not. */
export const COMPONENT_LABELS: Record<string, string> = {
  db: 'Database',
  secrets: 'Secrets bundle',
  'media-embeddings': 'Embeddings & indexes',
  'media-uploads': 'Uploads, previews & artwork',
  'analysis-results': 'Analysis results',
  verify: 'Repository verification',
  retention: 'Retention pass',
}

export const ROLE_LABELS: Record<string, string> = {
  alwyzon: 'Alwyzon (application)',
  media: 'Media server (Hetzner)',
}

export const componentLabel = (name: string) => COMPONENT_LABELS[name] ?? name
export const roleLabel = (name: string) => ROLE_LABELS[name] ?? name

/** `partial` is orange, not red. Some of the night landed, and colouring it the
 *  same as a total failure is what trains people to ignore the colour. */
export const runStatusColor = (status: BackupRunStatus | string): string => {
  switch (status) {
    case 'succeeded':
      return 'green'
    case 'partial':
      return 'orange'
    case 'failed':
      return 'red'
    case 'running':
      return 'processing'
    default:
      return 'default'
  }
}

export const componentStatusColor = (status: BackupComponentStatus | string): string => {
  switch (status) {
    case 'succeeded':
      return 'green'
    case 'failed':
      return 'red'
    case 'running':
      return 'processing'
    case 'skipped':
      return 'default'
    default:
      return 'blue'
  }
}

export const healthColor = (health: BackupHealth | string): string => {
  switch (health) {
    case 'ok':
      return 'green'
    case 'stale':
      return 'orange'
    // Never having run is a setup problem, and it is not the same shade of
    // wrong as a backup that used to work and stopped.
    case 'never':
      return 'red'
    default:
      return 'default'
  }
}

export const healthLabel = (health: BackupHealth | string): string => {
  switch (health) {
    case 'ok':
      return 'Up to date'
    case 'stale':
      return 'Stale'
    case 'never':
      return 'Never run'
    default:
      return 'Unknown'
  }
}

/** Binary units, because that is what restic and the Storage Box report. */
export const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : value >= 100 ? 0 : 1)} ${units[i]}`
}

export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export const formatNumber = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString()

/** The API returns naive UTC strings. Without the explicit Z the browser reads
 *  them as local time, which shifts every timestamp by the viewer's offset. */
export const parseServerDate = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const normalised = /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(normalised)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatServerDateTime = (value: string | null | undefined): string => {
  const date = parseServerDate(value)
  return date ? date.toLocaleString() : '—'
}

export const formatAge = (hours: number | null | undefined): string => {
  if (hours === null || hours === undefined) return 'never'
  if (hours < 1) return `${Math.round(hours * 60)}m ago`
  if (hours < 48) return `${hours.toFixed(1)}h ago`
  return `${Math.round(hours / 24)}d ago`
}
