import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { App, Spin, Button, Tag, Table, Tooltip, Empty } from 'antd'
import type { TableColumnsType } from 'antd'
import { ArrowLeft, RefreshCw, Star, ThumbsUp, ThumbsDown, Crown } from 'lucide-react'
import {
  getPlaylistRatings,
  type AdminPlaylistRatingsDetail,
  type AdminPlaylistRatingEntry,
  type AdminTrackRatingRow,
} from '@resomix/api-client'
import { useStatusModals } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

/** Small inline star row for a 0–3 rating. */
function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-secondary">—</span>
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          size={14}
          className={i < value ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}
          fill={i < value ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}

function raterName(r: AdminPlaylistRatingEntry): string {
  if (r.name) return r.name
  if (r.email) return r.email
  if (r.user_id != null) return `User #${r.user_id}`
  if (r.visitor_id) return `Guest ${r.visitor_id.slice(0, 8)}`
  return 'Unknown'
}

function PlaylistRatingsPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AdminPlaylistRatingsDetail | null>(null)

  const { errorModalVisible, errorDetails, showErrorModal, closeErrorModal } = useStatusModals()

  const fetchRatings = async () => {
    if (!uuid) return
    setLoading(true)
    try {
      const res = await getPlaylistRatings(uuid)
      if (res.success && 'data' in res && res.data) {
        setData(res.data as AdminPlaylistRatingsDetail)
      } else {
        setData(null)
        showErrorModal(
          'Failed to Load Ratings',
          'error' in res ? res.error || 'Could not fetch playlist ratings.' : 'Failed to load ratings.',
        )
      }
    } catch (err) {
      setData(null)
      showErrorModal('Error', err instanceof Error ? err.message : 'An error occurred while loading ratings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRatings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid])

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <Spin size="large" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full">
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/playlists')} className="mb-4">
          Back to Playlists
        </Button>
        <div className="bg-surface rounded-lg shadow border border-default p-6 text-center">
          <p className="text-secondary">No ratings data found for this playlist.</p>
        </div>
      </div>
    )
  }

  const { playlist, playlist_ratings, playlist_rating_summary, tracks } = data
  const creatorLabel = playlist.creator
    ? playlist.creator.name || playlist.creator.email || `User #${playlist.creator.user_id}`
    : 'Unknown / guest'

  // ----- Playlist-level ratings table -----
  const playlistRatingColumns: TableColumnsType<AdminPlaylistRatingEntry> = [
    {
      title: 'Rater',
      key: 'rater',
      render: (_, r) => (
        <span className="inline-flex items-center gap-2">
          {r.is_creator && (
            <Tooltip title="Playlist creator">
              <Crown size={14} className="text-amber-500" />
            </Tooltip>
          )}
          <span className={r.is_creator ? 'font-semibold text-primary' : 'text-primary'}>{raterName(r)}</span>
          {r.is_creator && <Tag color="gold">Creator</Tag>}
        </span>
      ),
    },
    { title: 'Stars', key: 'stars', width: 120, render: (_, r) => <Stars value={r.rating} /> },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (m: string | null) => (m ? <span className="text-primary">{m}</span> : <span className="text-secondary">—</span>),
    },
    {
      title: 'Rated',
      dataIndex: 'rated_at',
      key: 'rated_at',
      width: 180,
      render: (d: string | null) => (d ? new Date(d).toLocaleString() : '—'),
    },
  ]

  // ----- Per-track ratings table -----
  const trackColumns: TableColumnsType<AdminTrackRatingRow> = [
    {
      title: '#',
      key: 'idx',
      width: 48,
      render: (_, __, index) => <span className="text-secondary">{index + 1}</span>,
    },
    {
      title: 'Track',
      key: 'track',
      render: (_, t) => (
        <div className="min-w-0">
          <div className="text-primary truncate">{t.title || '—'}</div>
          <div className="text-secondary text-xs truncate">{t.artist || '—'}</div>
        </div>
      ),
    },
    {
      title: (
        <span className="inline-flex items-center gap-1">
          <ThumbsUp size={14} /> Up
        </span>
      ),
      key: 'plus',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.plus - b.plus,
      render: (_, t) => <Tag color={t.plus > 0 ? 'green' : 'default'}>{t.plus}</Tag>,
    },
    {
      title: (
        <span className="inline-flex items-center gap-1">
          <ThumbsDown size={14} /> Down
        </span>
      ),
      key: 'minus',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.minus - b.minus,
      render: (_, t) => <Tag color={t.minus > 0 ? 'red' : 'default'}>{t.minus}</Tag>,
    },
    {
      title: (
        <span className="inline-flex items-center gap-1">
          <Crown size={14} className="text-amber-500" /> Creator
        </span>
      ),
      key: 'creator',
      width: 120,
      align: 'center',
      render: (_, t) =>
        t.creator_rating == null ? (
          <span className="text-secondary">—</span>
        ) : t.creator_rating === 1 ? (
          <Tag color="gold" icon={<ThumbsUp size={12} />} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Up
          </Tag>
        ) : (
          <Tag color="volcano" icon={<ThumbsDown size={12} />} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Down
          </Tag>
        ),
    },
  ]

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-4">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/playlists')}>
            Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
              <Star size={22} className="text-amber-400" />
              {playlist.name}
            </h1>
            <p className="text-secondary text-sm mt-1">
              Ratings · created by <span className="font-medium">{creatorLabel}</span> · {playlist.num_tracks} tracks
            </p>
          </div>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={fetchRatings}>
          Refresh
        </Button>
      </div>

      {/* Playlist ratings */}
      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-4 md:p-6 mb-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-semibold text-primary">Playlist ratings</h2>
          <div className="flex items-center gap-3 text-sm text-secondary">
            <span className="inline-flex items-center gap-1">
              Average: <Stars value={playlist_rating_summary.average != null ? Math.round(playlist_rating_summary.average) : null} />
              {playlist_rating_summary.average != null && (
                <span className="text-primary font-medium">{playlist_rating_summary.average.toFixed(2)}</span>
              )}
            </span>
            <Tag color="blue">{playlist_rating_summary.count} rating(s)</Tag>
          </div>
        </div>
        {playlist_ratings.length === 0 ? (
          <Empty description="No one has rated this playlist yet." />
        ) : (
          <Table
            rowKey={(r) => `${r.user_id ?? 'v'}-${r.visitor_id ?? ''}-${r.rated_at ?? ''}`}
            columns={playlistRatingColumns}
            dataSource={playlist_ratings}
            pagination={false}
            size="middle"
            rowClassName={(r) => (r.is_creator ? 'bg-amber-50 dark:bg-amber-500/10' : '')}
            scroll={{ x: 'max-content' }}
          />
        )}
      </div>

      {/* Per-track ratings */}
      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-4 md:p-6 overflow-hidden">
        <h2 className="text-xl font-semibold text-primary mb-4">Track ratings ({tracks.length})</h2>
        {tracks.length === 0 ? (
          <Empty description="This playlist has no tracks." />
        ) : (
          <Table
            rowKey="track_id"
            columns={trackColumns}
            dataSource={tracks}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
          />
        )}
      </div>

      <StatusModal
        type="error"
        visible={errorModalVisible}
        title={errorDetails?.title || 'Error'}
        message={errorDetails?.message || ''}
        onClose={closeErrorModal}
      />
    </div>
  )
}

export default function PlaylistRatingsPageWrapper() {
  return (
    <App>
      <PlaylistRatingsPage />
    </App>
  )
}
