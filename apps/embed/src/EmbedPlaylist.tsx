import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchPublicPlaylist,
  readPlaylistUuid,
  APP_URL,
  type EmbedPlaylistData,
  type EmbedTrack,
} from './api.ts'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; kind: 'not_found' | 'not_public' | 'network' | 'empty' | 'no_id' }
  | { status: 'ready'; data: EmbedPlaylistData }

function fmtDuration(d?: number | null): string {
  if (d == null || !isFinite(d) || d <= 0) return ''
  // The API sends seconds; guard in case a value ever arrives in ms.
  const secs = d > 10000 ? Math.round(d / 1000) : Math.round(d)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const ERROR_COPY: Record<string, string> = {
  not_found: 'This playlist could not be found.',
  not_public: 'This playlist is private. The owner needs to make it public to embed it.',
  network: 'Couldn’t load this playlist right now. Please try again.',
  empty: 'This playlist has no tracks yet.',
  no_id: 'No playlist specified.',
}

export default function EmbedPlaylist() {
  const uuid = useMemo(() => readPlaylistUuid(), [])
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // Single shared audio element for 30s Apple previews.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    if (!uuid) {
      setState({ status: 'error', kind: 'no_id' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetchPublicPlaylist(uuid).then((res) => {
      if (cancelled) return
      setState(res.ok ? { status: 'ready', data: res.data } : { status: 'error', kind: res.error })
    })
    return () => {
      cancelled = true
    }
  }, [uuid])

  // Reflect the loaded playlist in the tab title (falls back to the static title otherwise).
  useEffect(() => {
    if (state.status === 'ready' && state.data.name) {
      document.title = `${state.data.name} · Resomix Playlist`;
    } else {
      document.title = 'Resomix Embedded Playlist';
    }
  }, [state]);

  // Keep local play state in sync with the audio element.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onEnd = () => setPlayingId(null)
    a.addEventListener('ended', onEnd)
    a.addEventListener('pause', onEnd)
    return () => {
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('pause', onEnd)
    }
  }, [state.status])

  const togglePlay = (track: EmbedTrack) => {
    const a = audioRef.current
    if (!a || !track.preview_url) return
    if (playingId === track.id) {
      a.pause()
      setPlayingId(null)
      return
    }
    a.src = track.preview_url
    void a.play().then(() => setPlayingId(track.id)).catch(() => setPlayingId(null))
  }

  const fullUrl = uuid ? `${APP_URL}/sonic-discovery?id=${encodeURIComponent(uuid)}` : APP_URL

  return (
    <div className="embed">
      {/* Branding bar — pinned at top so it stays visible even if the frame is clipped. */}
      <header className="embed-brand">
        <a className="embed-brand-logo" href={APP_URL} target="_blank" rel="noopener noreferrer">
          <span className="embed-brand-mark">◆</span> RESOMIX
        </a>
        <a className="embed-brand-open" href={fullUrl} target="_blank" rel="noopener noreferrer">
          Open ↗
        </a>
      </header>

      {state.status === 'loading' && <div className="embed-msg">Loading playlist…</div>}

      {state.status === 'error' && <div className="embed-msg">{ERROR_COPY[state.kind]}</div>}

      {state.status === 'ready' && (
        <ReadyView
          data={state.data}
          playingId={playingId}
          onToggle={togglePlay}
          fullUrl={fullUrl}
        />
      )}

      {/* Hidden shared player. */}
      <audio ref={audioRef} preload="none" />
    </div>
  )
}

function ReadyView({
  data,
  playingId,
  onToggle,
  fullUrl,
}: {
  data: EmbedPlaylistData
  playingId: string | null
  onToggle: (t: EmbedTrack) => void
  fullUrl: string
}) {
  const cover = data.tracks.find((t) => t.artwork_url)?.artwork_url || null
  const title = data.name || 'Sonic Discovery'

  return (
    <>
      <div className="embed-head">
        <div className="embed-cover" aria-hidden="true">
          {cover ? <img src={cover} alt="" loading="lazy" draggable={false} /> : <span>◆</span>}
        </div>
        <div className="embed-head-meta">
          <div className="embed-eyebrow">Sonic Discovery</div>
          <a className="embed-title" href={fullUrl} target="_blank" rel="noopener noreferrer">
            {title}
          </a>
          <div className="embed-sub">{data.total} tracks · similarity playlist</div>
        </div>
      </div>

      <ol className="embed-list">
        {data.tracks.map((t, i) => {
          const playable = t.playback === 'preview' && !!t.preview_url
          const isPlaying = playingId === t.id
          return (
            <li key={t.id} className={`embed-row${isPlaying ? ' is-playing' : ''}`}>
              <button
                className="embed-play"
                onClick={() => onToggle(t)}
                disabled={!playable}
                aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                title={playable ? 'Play 30s preview' : 'Preview unavailable'}
              >
                {isPlaying ? '❚❚' : '►'}
              </button>
              <div className="embed-art" aria-hidden="true">
                {t.artwork_url ? (
                  <img src={t.artwork_url} alt="" loading="lazy" draggable={false} />
                ) : (
                  <span>{t.rank ?? i + 1}</span>
                )}
              </div>
              <div className="embed-info">
                <div className="embed-track-title" title={t.title || undefined}>
                  {t.title || 'Untitled'}
                </div>
                <div className="embed-track-artist" title={t.artist || undefined}>
                  {t.artist || '—'}
                </div>
              </div>
              <div className="embed-dur">{fmtDuration(t.duration)}</div>
            </li>
          )
        })}
      </ol>

      {data.hiddenCount > 0 && (
        <div className="embed-viewmore">
          <a className="embed-viewmore-btn" href={fullUrl} target="_blank" rel="noopener noreferrer">
            View more tracks ↗
          </a>
        </div>
      )}

      <footer className="embed-foot">
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          Powered by <strong>Resomix</strong>
        </a>
      </footer>
    </>
  )
}
