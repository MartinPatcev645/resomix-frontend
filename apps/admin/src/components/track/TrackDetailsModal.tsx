import { useEffect, useState } from 'react'
import { Modal, Descriptions, Tag, Badge, Alert, Button, Typography, Spin } from 'antd'
import { Music } from 'lucide-react'
import { getAdminTrackDetail, type AdminTrackDetail } from '@resomix/api-client'

const { Title, Text } = Typography

interface TrackDetailsModalProps {
  /** Track id to load; null closes/clears. */
  trackId: number | null
  open: boolean
  onClose: () => void
  /** Optional resolved partner name (else the numeric partner_id is shown). */
  partnerName?: string
  /** Optional playlist context shown at the top (position / similarity score). */
  extra?: { position?: number; score?: number | null }
}

const dash = <Text type="secondary">—</Text>

function formatDuration(seconds?: number | null) {
  if (!seconds) return '—'
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s (${seconds}s)`
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Shared "Track Details" modal used by BOTH the admin Tracks panel and the playlist
 * tracks table. Fetches the full track detail (Apple + in-house metadata + processing
 * status) from GET /admin/tracks/{id}, so both places show the same complete data.
 */
export default function TrackDetailsModal({ trackId, open, onClose, partnerName, extra }: TrackDetailsModalProps) {
  const [track, setTrack] = useState<AdminTrackDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || trackId == null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setTrack(null)
    getAdminTrackDetail(trackId)
      .then((res) => {
        if (cancelled) return
        if (res && res.status === 'success' && res.track) setTrack(res.track)
        else setError('Failed to load track details.')
      })
      .catch(() => !cancelled && setError('Failed to load track details.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, trackId])

  const p = track?.processing

  return (
    <Modal
      title={
        <span className="flex items-center gap-2 text-primary font-semibold">
          <Music size={18} />
          <span>Track Details</span>
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={700}
      className="rounded-2xl overflow-hidden"
    >
      {loading && (
        <div className="py-10 flex justify-center">
          <Spin />
        </div>
      )}

      {!loading && error && <Alert type="error" showIcon message={error} className="rounded-xl" />}

      {!loading && !error && track && (
        <div className="py-2 flex flex-col gap-4">
          <Descriptions bordered column={2} size="small" className="rounded-xl overflow-hidden border-default bg-surface">
            {extra?.position !== undefined && (
              <Descriptions.Item label="Position" span={1}>
                <span className="font-semibold">{extra.position}</span>
              </Descriptions.Item>
            )}
            {extra?.score !== undefined && extra?.score !== null && (
              <Descriptions.Item label="Score" span={1}>
                <Tag color="purple">{(extra.score * 100).toFixed(2)}%</Tag>
              </Descriptions.Item>
            )}

            <Descriptions.Item label="Track ID" span={1}>{track.id}</Descriptions.Item>
            <Descriptions.Item label="UUID" span={1}><span className="font-mono text-xs">{track.uuid}</span></Descriptions.Item>

            <Descriptions.Item label="Title" span={2}><Text strong>{track.title}</Text></Descriptions.Item>
            <Descriptions.Item label="Artist" span={2}>
              {track.display_artist || (track.artists && track.artists.length ? track.artists.join(', ') : dash)}
            </Descriptions.Item>

            <Descriptions.Item label="ISRC" span={1}>{track.isrc ? <span className="font-mono">{track.isrc}</span> : dash}</Descriptions.Item>
            <Descriptions.Item label="Type" span={1}>{track.type ? <Tag>{track.type}</Tag> : dash}</Descriptions.Item>

            <Descriptions.Item label="Album / Release" span={1}>{track.album || track.release || dash}</Descriptions.Item>
            <Descriptions.Item label="Year" span={1}>{track.year || dash}</Descriptions.Item>

            <Descriptions.Item label="Genre" span={1}>{track.genre || dash}</Descriptions.Item>
            <Descriptions.Item label="Label" span={1}>{track.label || dash}</Descriptions.Item>

            <Descriptions.Item label="Duration" span={1}>{formatDuration(track.duration_seconds)}</Descriptions.Item>
            <Descriptions.Item label="BPM" span={1}>{track.bpm || dash}</Descriptions.Item>

            <Descriptions.Item label="Musical Key" span={1}>{track.musical_key || dash}</Descriptions.Item>
            <Descriptions.Item label="File Size" span={1}>{formatFileSize(track.file_size)}</Descriptions.Item>

            <Descriptions.Item label="Ingestion Source" span={1}>
              {track.ingestion_source ? (
                <Tag color={
                  track.ingestion_source === 'csv' ? 'blue' :
                  track.ingestion_source === 'cc_by' ? 'orange' :
                  track.ingestion_source === 'user_upload' ? 'purple' : 'default'
                }>
                  {track.ingestion_source}
                </Tag>
              ) : dash}
            </Descriptions.Item>
            <Descriptions.Item label="Search Status" span={1}>
              <Tag color={track.is_active ? 'success' : 'default'}>
                {track.is_active ? 'LIVE / ACTIVE' : 'STOPPED / INACTIVE'}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="Partner" span={1}>{partnerName || track.partner_id}</Descriptions.Item>
            <Descriptions.Item label="Audio File" span={1}>
              {track.audio_filename ? <span className="font-mono text-xs">{track.audio_filename}</span> : dash}
            </Descriptions.Item>

            <Descriptions.Item label="Created At" span={1}>
              {track.created_at ? new Date(track.created_at).toLocaleString() : dash}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At" span={1}>
              {track.updated_at ? new Date(track.updated_at).toLocaleString() : dash}
            </Descriptions.Item>
          </Descriptions>

          {p && (
            <div className="mt-2">
              <Title level={5} className="!mb-2 !text-primary">Processing Status</Title>
              <Descriptions bordered column={2} size="small" className="rounded-xl overflow-hidden border-default bg-surface">
                <Descriptions.Item label="Transcode" span={1}>
                  <Badge status={p.transcode_status === 'completed' ? 'success' : p.transcode_status === 'failed' ? 'error' : 'processing'} text={p.transcode_status || 'pending'} />
                </Descriptions.Item>
                <Descriptions.Item label="Embeddings" span={1}>
                  <Badge status={p.embedding_status === 'completed' ? 'success' : p.embedding_status === 'failed' ? 'error' : 'processing'} text={p.embedding_status || 'pending'} />
                </Descriptions.Item>
                <Descriptions.Item label="Peaks" span={1}>
                  <Badge status={p.peaks_status === 'completed' ? 'success' : p.peaks_status === 'failed' ? 'error' : 'processing'} text={p.peaks_status || 'pending'} />
                </Descriptions.Item>
                <Descriptions.Item label="Segments" span={1}>
                  <Badge status={p.segments_status === 'completed' ? 'success' : p.segments_status === 'failed' ? 'error' : 'processing'} text={p.segments_status || 'pending'} />
                </Descriptions.Item>
                <Descriptions.Item label="FAISS Indexed" span={1}>
                  <Badge status={p.faiss_indexed ? 'success' : 'default'} text={p.faiss_indexed ? 'YES' : 'NO'} />
                </Descriptions.Item>
                {p.sftp_env && (
                  <Descriptions.Item label="SFTP Env" span={1}>
                    <Tag color={p.sftp_env === 'live' ? 'success' : 'blue'}>{p.sftp_env.toUpperCase()}</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>

              {(p.transcode_error || p.embedding_error || p.peaks_error || p.segments_error) && (
                <Alert
                  type="error"
                  showIcon
                  className="rounded-xl mt-3"
                  message="Processing Errors"
                  description={
                    <div className="flex flex-col gap-1 mt-1">
                      {p.transcode_error && <Text type="danger" className="text-xs"><strong>Transcode:</strong> {p.transcode_error}</Text>}
                      {p.embedding_error && <Text type="danger" className="text-xs"><strong>Embedding:</strong> {p.embedding_error}</Text>}
                      {p.peaks_error && <Text type="danger" className="text-xs"><strong>Peaks:</strong> {p.peaks_error}</Text>}
                      {p.segments_error && <Text type="danger" className="text-xs"><strong>Segments:</strong> {p.segments_error}</Text>}
                    </div>
                  }
                />
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
