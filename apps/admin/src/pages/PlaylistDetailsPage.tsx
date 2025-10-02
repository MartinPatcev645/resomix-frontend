import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { App, Spin, Button, Tag, Descriptions } from 'antd'
import { ArrowLeft, RefreshCw, Lock, Unlock } from 'lucide-react'
import { getPlaylistDetails, type PlaylistDetailsResponse } from '@resomix/api-client'
import PlaylistTracksTable from '@/components/playlist/PlaylistTracksTable.tsx'
import { useStatusModals } from '@resomix/hooks'
import { StatusModal } from '@resomix/ui'

function PlaylistDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [playlistData, setPlaylistData] = useState<PlaylistDetailsResponse['data'] | null>(null)
  
  const {
    errorModalVisible,
    errorDetails,
    showErrorModal,
    closeErrorModal,
  } = useStatusModals()

  const fetchPlaylistDetails = async () => {
    if (!id) return
    
    setLoading(true)
    try {
      const numericId = parseInt(id, 10)
      if (isNaN(numericId)) {
        showErrorModal('Invalid Playlist ID', 'The playlist ID must be a valid number.')
        setLoading(false)
        return
      }

      const result = await getPlaylistDetails(numericId)
      
      if (result.success && 'data' in result && result.data) {
        setPlaylistData(result.data)
      } else {
        showErrorModal(
          'Failed to Load Playlist',
          'error' in result ? result.error || 'Could not fetch playlist details.' : 'Failed to load playlist.'
        )
      }
    } catch (error) {
      console.error('Error fetching playlist details:', error)
      showErrorModal(
        'Error',
        error instanceof Error ? error.message : 'An error occurred while fetching playlist details.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlaylistDetails()
  }, [id])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'custom':
        return 'blue'
      case 'similarity':
        return 'purple'
      case 'waiting_segments':
        return 'orange'
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'custom':
        return 'Custom'
      case 'similarity':
        return 'Similarity'
      case 'waiting_segments':
        return 'Waiting Segments'
      default:
        return type
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <Spin size="large" />
      </div>
    )
  }

  if (!playlistData) {
    return (
      <div className="w-full">
        <Button 
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/playlists')}
          className="mb-4"
        >
          Back to Playlists
        </Button>
        <div className="bg-surface rounded-lg shadow border border-default p-6 text-center">
          <p className="text-secondary">Playlist not found</p>
        </div>
      </div>
    )
  }

  const { playlist, seed_track, tracks } = playlistData

  return (
    <div className="w-full">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-4">
          <Button 
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/playlists')}
          >
            Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">{playlist.name}</h1>
        </div>
        <Button
          icon={<RefreshCw size={16} />}
          onClick={fetchPlaylistDetails}
        >
          Refresh
        </Button>
      </div>

      {/* Playlist Details Card */}
      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-4 md:p-6 mb-6 overflow-hidden">
        <h2 className="text-xl font-semibold text-primary mb-4">Playlist Information</h2>
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 2 }}>
          <Descriptions.Item label="ID">{playlist.id}</Descriptions.Item>
          <Descriptions.Item label="UUID">
            <span className="font-mono text-xs break-all">{playlist.uuid}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag color={getTypeColor(playlist.type)}>
              {getTypeLabel(playlist.type)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Visibility">
            <Tag 
              color={playlist.is_public ? 'green' : 'default'} 
              icon={playlist.is_public ? <Unlock size={12} /> : <Lock size={12} />}
              style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', justifyContent: 'evenly', gap: '4px' }}
            >
              {playlist.is_public ? 'Public' : 'Private'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Total Tracks">{playlist.track_count}</Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(playlist.created_at).toLocaleString()}
          </Descriptions.Item>
          {playlist.user_id && (
            <Descriptions.Item label="User ID" span={2}>
              <span className="font-mono text-xs break-all">{playlist.user_id}</span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>

      {/* Seed Track Card (if exists) */}
      {seed_track && (
        <div className="bg-surface rounded-lg shadow border border-default transition-colors p-4 md:p-6 mb-6 overflow-hidden">
          <h2 className="text-xl font-semibold text-primary mb-4">Seed Track</h2>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Title">{seed_track.title}</Descriptions.Item>
            <Descriptions.Item label="Artists">
              {seed_track.artists.join(', ')}
            </Descriptions.Item>
            <Descriptions.Item label="Duration">
              {formatDuration(seed_track.duration_sec)}
            </Descriptions.Item>
            {seed_track.genre && (
              <Descriptions.Item label="Genre">{seed_track.genre}</Descriptions.Item>
            )}
            {seed_track.label && (
              <Descriptions.Item label="Label">{seed_track.label}</Descriptions.Item>
            )}
            {seed_track.year && (
              <Descriptions.Item label="Year">{seed_track.year}</Descriptions.Item>
            )}
            {seed_track.bpm && (
              <Descriptions.Item label="BPM">{seed_track.bpm}</Descriptions.Item>
            )}
            {seed_track.musical_key && (
              <Descriptions.Item label="Key">{seed_track.musical_key}</Descriptions.Item>
            )}
          </Descriptions>
        </div>
      )}

      {/* Tracks Table */}
      <div className="bg-surface rounded-lg shadow border border-default transition-colors p-4 md:p-6 overflow-hidden">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Tracks ({tracks.length})
        </h2>
        <PlaylistTracksTable tracks={tracks} />
      </div>

      {/* Status Modals */}
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

export default function PlaylistDetailsPageWrapper() {
  return (
    <App>
      <PlaylistDetailsPage />
    </App>
  )
}
