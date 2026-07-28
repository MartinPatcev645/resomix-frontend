// Minimal, dependency-free client for the ONE public endpoint the embed needs.
// The endpoint allows anonymous access (falls back to public Partner 1) and only ever returns
// PUBLIC playlists — so no auth, no API key, no cookies.

const API_BASE: string =
  (import.meta.env.VITE_SERVER_BACKEND as string | undefined)?.replace(/\/$/, '') ||
  'https://bserver.resomix.com'

/** Where the "open the full playlist" links point (the main webapp). */
export const APP_URL: string =
  (import.meta.env.VITE_BASE_BETA_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://beta.resomix.com'

export interface EmbedTrack {
  id: string
  rank?: number
  score?: number
  title?: string | null
  artist?: string | null
  duration?: number | null
  year?: number | null
  album?: string | null
  genre?: string | null
  label?: string | null
  playback?: 'preview' | 'hls'
  preview_url?: string | null
  artwork_url?: string | null
  deep_link_url?: string | null
}

export interface EmbedPlaylistData {
  uuid: string
  name?: string | null
  /** The seed/reference track the playlist was built from (playable when it has an Apple preview). */
  reference: EmbedTrack | null
  /** Total tracks in the playlist (incl. any locked for anonymous viewers). */
  total: number
  /** Real, playable tracks shown in the widget. */
  tracks: EmbedTrack[]
  /** How many tracks are locked/redacted for anonymous viewers (shown as a CTA, not rows). */
  hiddenCount: number
}

type Result =
  | { ok: true; data: EmbedPlaylistData }
  | { ok: false; error: 'not_found' | 'not_public' | 'network' | 'empty' }

// The similarity endpoint redacts locked tracks for anonymous viewers into placeholder rows that
// all share this fake id (no preview/art). We drop those and surface a "+N more" CTA instead.
const isRedacted = (t: EmbedTrack): boolean => !t?.id || String(t.id).startsWith('dEm0')

/** Fetch a public playlist's tracks by UUID. */
export async function fetchPublicPlaylist(uuid: string): Promise<Result> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/playlists/similarity/${encodeURIComponent(uuid)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (res.status === 403) return { ok: false, error: 'not_public' }
    if (res.status === 404) return { ok: false, error: 'not_found' }
    if (!res.ok) return { ok: false, error: 'network' }

    const body = await res.json()
    if (!body || body.success === false) {
      return { ok: false, error: body?.reason === 'not_public' ? 'not_public' : 'not_found' }
    }

    // The payload is nested under `data` ({ success, data: { queried_track, similar_tracks, playlist } }).
    const payload = body.data ?? body
    const playlist = payload.playlist ?? {}
    const all: EmbedTrack[] = Array.isArray(payload.similar_tracks) ? payload.similar_tracks : []
    if (!all.length) return { ok: false, error: 'empty' }

    const reference: EmbedTrack | null =
      payload.queried_track && !isRedacted(payload.queried_track) ? payload.queried_track : null
    const tracks = all.filter((t) => !isRedacted(t))
    return {
      ok: true,
      data: {
        uuid,
        name: playlist.name ?? null,
        reference,
        total: all.length,
        tracks,
        hiddenCount: all.length - tracks.length,
      },
    }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Read the playlist UUID from the URL: supports `?id=<uuid>` and `/playlist/<uuid>`. */
export function readPlaylistUuid(): string | null {
  const q = new URLSearchParams(window.location.search).get('id')
  if (q) return q.trim()
  const m = window.location.pathname.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  return m ? m[1] : null
}

/** Theme from the URL (`?theme=light`), defaulting to dark. Passed by the embedder via the src. */
export function readTheme(): 'dark' | 'light' {
  return new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark'
}
