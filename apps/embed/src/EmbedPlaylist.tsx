import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchPublicPlaylist,
  readEmbedToken,
  readPlaylistUuid,
  APP_URL,
  type EmbedPlaylistData,
  type EmbedTrack,
} from './api.ts'
import { EmbedWaveform, type WaveformHandle } from './EmbedWaveform'
import appleMusicIcon from './assets/apple-music.svg'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; kind: 'not_found' | 'not_public' | 'network' | 'empty' | 'no_id' }
  | { status: 'ready'; data: EmbedPlaylistData }

function fmtDuration(d?: number | null): string {
  if (d == null || !isFinite(d) || d <= 0) return ''
  const secs = d > 10000 ? Math.round(d / 1000) : Math.round(d)
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`
}

/** "House | Music | Dance" → "House" (drop the generic "Music" segment). */
function cleanGenre(g?: string | null): string {
  if (!g) return ''
  const parts = g.split('|').map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== 'music')
  return parts[0] || ''
}

/** Secondary meta line: genre · year · album (whatever's present). */
function metaLine(t: EmbedTrack): string {
  return [cleanGenre(t.genre), t.year ? String(t.year) : '', t.album].filter(Boolean).join(' · ')
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
  // Owner-minted authorisation for THIS playlist to be embedded (G1).
  const token = useMemo(() => readEmbedToken(), [])
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // One shared WaveSurfer player in the bottom bar; it owns the audio element internally.
  const waveRef = useRef<WaveformHandle | null>(null)
  const [current, setCurrent] = useState<EmbedTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Prefetch de-dupe — we warm each preview at most once.
  const prefetched = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!uuid) {
      setState({ status: 'error', kind: 'no_id' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetchPublicPlaylist(uuid, token).then((res) => {
      if (cancelled) return
      setState(res.ok ? { status: 'ready', data: res.data } : { status: 'error', kind: res.error })
    })
    return () => {
      cancelled = true
    }
  }, [uuid, token])

  // Reflect the loaded playlist in the tab title.
  useEffect(() => {
    document.title =
      state.status === 'ready' && state.data.name
        ? `${state.data.name} · Resomix Playlist`
        : 'Resomix Embedded Playlist'
  }, [state])

  // Warm the first couple of previews once loaded, so the first click is instant.
  useEffect(() => {
    if (state.status !== 'ready') return
    if (state.data.reference) prefetch(state.data.reference)
    state.data.tracks.slice(0, 2).forEach(prefetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  /** Background-download a preview (link rel=prefetch — no CORS, warms the HTTP cache). */
  const prefetch = (t?: EmbedTrack | null) => {
    if (!t?.preview_url || prefetched.current.has(t.id)) return
    prefetched.current.add(t.id)
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'audio'
    link.href = t.preview_url
    document.head.appendChild(link)
  }

  const selectTrack = (t: EmbedTrack) => {
    if (!t.preview_url) return
    // Same track: hand the toggle to the player. Different track: swapping `current` changes the
    // url prop, which the player loads and starts on its own.
    if (current?.id === t.id) {
      waveRef.current?.toggle()
      return
    }
    setCurrent(t)
  }

  const fullUrl = uuid ? `${APP_URL}/sonic-discovery?id=${encodeURIComponent(uuid)}` : APP_URL

  return (
    <div className="embed">
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
          currentId={current?.id ?? null}
          isPlaying={isPlaying}
          onPlay={selectTrack}
          onPrefetch={prefetch}
          fullUrl={fullUrl}
        />
      )}

      {/* Standard player bar (native controls) — persists across renders so playback isn't cut. */}
      <div className={`embed-player${current ? ' is-active' : ''}`}>
        {current && (
          <div className="embed-player-meta">
            {current.artwork_url && (
              <img className="embed-player-art" src={current.artwork_url} alt="" draggable={false} />
            )}
            <div className="embed-player-txt">
              <div className="embed-player-title" title={current.title || undefined}>
                {current.title}
              </div>
              <div className="embed-player-artist" title={current.artist || undefined}>
                {current.artist}
              </div>
            </div>
          </div>
        )}
        <EmbedWaveform
          ref={waveRef}
          url={current?.preview_url ?? null}
          onPlayingChange={setIsPlaying}
        />
      </div>

      <footer className="embed-foot">
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          Powered by <strong>Resomix</strong>
        </a>
      </footer>
    </div>
  )
}

function TrackRow({
  t,
  index,
  isReference,
  isCurrent,
  isPlaying,
  onPlay,
  onPrefetch,
}: {
  t: EmbedTrack
  index: number
  isReference?: boolean
  isCurrent: boolean
  isPlaying: boolean
  onPlay: (t: EmbedTrack) => void
  onPrefetch: (t: EmbedTrack) => void
}) {
  const playable = !!t.preview_url
  const meta = metaLine(t)
  return (
    <div
      className={`embed-row${isCurrent ? ' is-playing' : ''}${isReference ? ' is-ref' : ''}`}
      onMouseEnter={() => onPrefetch(t)}
    >
      <button
        className="embed-play"
        onClick={() => onPlay(t)}
        disabled={!playable}
        aria-label={isCurrent && isPlaying ? 'Pause' : 'Play preview'}
        title={playable ? 'Play 30s preview' : 'Preview unavailable'}
      >
        {isCurrent && isPlaying ? '❚❚' : '►'}
      </button>

      {t.deep_link_url ? (
        <a className="embed-art" href={t.deep_link_url} target="_blank" rel="noopener noreferrer" title="Open on Apple Music">
          {t.artwork_url ? <img src={t.artwork_url} alt="" loading="lazy" draggable={false} /> : <span>{t.rank ?? index + 1}</span>}
        </a>
      ) : (
        <div className="embed-art" aria-hidden="true">
          {t.artwork_url ? <img src={t.artwork_url} alt="" loading="lazy" draggable={false} /> : <span>{t.rank ?? index + 1}</span>}
        </div>
      )}

      <div className="embed-info">
        <div className="embed-track-title" title={t.title || undefined}>
          {isReference && <span className="embed-ref-tag">Reference</span>}
          {t.title || 'Untitled'}
        </div>
        <div className="embed-track-artist" title={t.artist || undefined}>{t.artist || '—'}</div>
        {meta && <div className="embed-track-meta" title={meta}>{meta}</div>}
      </div>

      <div className="embed-right">
        <span className="embed-dur">{fmtDuration(t.duration)}</span>
        {t.deep_link_url && (
          <a
            className="embed-apple"
            href={t.deep_link_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Listen on Apple Music"
            title="Listen on Apple Music"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={appleMusicIcon} alt="" draggable={false} />
          </a>
        )}
      </div>
    </div>
  )
}

function ReadyView({
  data,
  currentId,
  isPlaying,
  onPlay,
  onPrefetch,
  fullUrl,
}: {
  data: EmbedPlaylistData
  currentId: string | null
  isPlaying: boolean
  onPlay: (t: EmbedTrack) => void
  onPrefetch: (t: EmbedTrack) => void
  fullUrl: string
}) {
  const cover =
    data.reference?.artwork_url || data.tracks.find((t) => t.artwork_url)?.artwork_url || null
  const title = data.name || 'Sonic Discovery'

  return (
    <>
      <div className="embed-head">
        <div className="embed-cover" aria-hidden="true">
          {cover ? <img src={cover} alt="" loading="lazy" draggable={false} /> : <span>◆</span>}
        </div>
        <div className="embed-head-meta">
          <div className="embed-eyebrow">Sonic Discovery</div>
          <a className="embed-title" href={fullUrl} target="_blank" rel="noopener noreferrer">{title}</a>
          <div className="embed-sub">{data.total} tracks · similarity playlist</div>
        </div>
      </div>

      {data.reference && (
        <div className="embed-ref-wrap">
          <TrackRow
            t={data.reference}
            index={0}
            isReference
            isCurrent={currentId === data.reference.id}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onPrefetch={onPrefetch}
          />
        </div>
      )}

      <ol className="embed-list">
        {data.tracks.map((t, i) => (
          <li key={t.id}>
            <TrackRow
              t={t}
              index={i}
              isCurrent={currentId === t.id}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onPrefetch={onPrefetch}
            />
          </li>
        ))}
      </ol>

      {data.hiddenCount > 0 && (
        <div className="embed-viewmore">
          <a className="embed-viewmore-btn" href={fullUrl} target="_blank" rel="noopener noreferrer">
            View more tracks ↗
          </a>
        </div>
      )}
    </>
  )
}
