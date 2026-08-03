import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

/**
 * The embed's player: a WaveSurfer waveform over an Apple Music preview URL.
 *
 * Replaces the browser's default `<audio controls>`, whose chrome is unstyleable and looked
 * nothing like the rest of the widget.
 *
 * Apple's preview CDN serves `access-control-allow-origin: *`, so WaveSurfer can fetch and decode
 * the audio to draw a real waveform — no proxy, and no need for precomputed peaks.
 */

export interface WaveformHandle {
  /** Toggle play/pause on the track already loaded. */
  toggle: () => void
}

interface Props {
  /** Apple Music preview URL. Changing it loads and plays the new track. */
  url: string | null
  onPlayingChange: (playing: boolean) => void
}

/** Theme lifted from the webapp/landing: dim track, accent progress, thin bars. */
const WAVE_OPTIONS = {
  waveColor: 'rgba(243, 243, 243, 0.22)',
  progressColor: '#ee4a26',
  cursorColor: 'rgba(243, 243, 243, 0.55)',
  cursorWidth: 1,
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  height: 34,
  normalize: true,
  /** The preview is short; letting it fill the bar reads better than a true-scale render. */
  fillParent: true,
} as const

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export const EmbedWaveform = forwardRef<WaveformHandle, Props>(function EmbedWaveform(
  { url, onPlayingChange },
  ref,
) {
  const holder = useRef<HTMLDivElement | null>(null)
  const ws = useRef<WaveSurfer | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Build once. Re-creating per track would re-attach listeners and flash the canvas.
  useEffect(() => {
    if (!holder.current) return
    const inst = WaveSurfer.create({ container: holder.current, ...WAVE_OPTIONS })
    ws.current = inst

    const sync = (v: boolean) => {
      setPlaying(v)
      onPlayingChange(v)
    }
    inst.on('play', () => sync(true))
    inst.on('pause', () => sync(false))
    inst.on('finish', () => sync(false))
    inst.on('ready', () => {
      setReady(true)
      setDuration(inst.getDuration())
    })
    inst.on('timeupdate', (t: number) => setTime(t))

    return () => {
      // Destroy aborts any in-flight fetch; the rejection is expected, not an error.
      try {
        inst.destroy()
      } catch {
        /* already torn down */
      }
      ws.current = null
    }
    // onPlayingChange is stable in practice; re-running would rebuild the instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load whenever the selected track changes, then start playing.
  useEffect(() => {
    const inst = ws.current
    if (!inst || !url) return
    setReady(false)
    setTime(0)
    setDuration(0)

    let cancelled = false
    inst
      .load(url)
      .then(() => {
        if (cancelled) return
        // Autoplay policies allow this because a track row click started the chain.
        void inst.play()?.catch(() => onPlayingChange(false))
      })
      .catch(() => {
        // Aborted by a newer load, or the preview failed to fetch. Either way there is nothing
        // to play; leave the bar idle rather than surfacing a raw error into someone's page.
        if (!cancelled) onPlayingChange(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useImperativeHandle(ref, () => ({
    toggle: () => {
      const inst = ws.current
      if (!inst || !ready) return
      void inst.playPause()
    },
  }))

  return (
    <div className="embed-wave">
      <button
        type="button"
        className="embed-wave-btn"
        onClick={() => ws.current && ready && void ws.current.playPause()}
        disabled={!ready}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        )}
      </button>

      <div className="embed-wave-canvas" ref={holder} />

      <span className="embed-wave-time">
        {fmt(time)} / {fmt(duration)}
      </span>
    </div>
  )
})
