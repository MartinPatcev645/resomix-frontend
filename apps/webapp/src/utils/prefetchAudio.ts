// Warm an audio URL in the background so playback is snappy when the user actually clicks.
//
// Apple Music previews (~1–2 MB .m4a) are served from Apple's CDN; the 2–3 s "wait" before playback
// is the initial fetch. Injecting a `<link rel="prefetch" as="audio">` on hover downloads it into
// the HTTP cache ahead of time — no CORS involved (unlike fetch()), and the subsequent <audio> play
// reads straight from cache. Called on row hover in the playlist tables.

const warmed = new Set<string>()

export function prefetchAudio(url?: string | null): void {
  if (!url || warmed.has(url) || typeof document === 'undefined') return
  warmed.add(url)
  try {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'audio'
    link.href = url
    document.head.appendChild(link)
  } catch {
    // Best-effort only — a failed prefetch never blocks playback.
  }
}
