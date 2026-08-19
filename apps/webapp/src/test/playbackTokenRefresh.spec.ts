/**
 * The playback token must be replaced BEFORE it expires.
 *
 * `/play-session` mints an edge JWT with a 4 hour TTL (`EDGE_TOKEN_TTL_SECONDS=14400`) and the
 * server bakes it into every segment URL of the HLS manifest. A tab left open past that window
 * holds a dead token, and the next segment request 403s.
 *
 * That is not theoretical. Production nginx, 18 Aug 2026:
 *
 *   - token minted 16:46:54 UTC, `exp` 20:46:54 UTC
 *   - segments requested 22:18:33 UTC, i.e. 1h32m past expiry
 *   - ten 403s in 37 seconds, EVERY ONE carrying the same expired token
 *   - no `/play-session` call for that playlist anywhere in the window
 *
 * So the 403 recovery never re-minted, and the generic retry loop hammered the dead token while the
 * user got a Retry button. Refreshing ahead of expiry removes the failure class instead of relying
 * on catching it afterwards.
 *
 * These tests cover the SCHEDULING arithmetic, which is where the damage would be: firing too late
 * reintroduces the bug, and firing too eagerly turns a drifting phone clock into a request storm
 * against `/play-session`. Both are silent in normal use, which is exactly why they need pinning.
 */
import { describe, expect, it } from "vitest";

/** Mirrors the constant in HlsPlaylistController. */
const TOKEN_REFRESH_MARGIN_MS = 10 * 60 * 1000;

/** An unsigned JWT carrying just `exp` — enough for the reader, which never verifies. */
function tokenUrl(expSeconds: number | null, { malformed = false } = {}): string {
  if (malformed) return "https://media.example.com/x.m3u8?token=not-a-jwt";
  const payload = btoa(JSON.stringify(expSeconds === null ? {} : { exp: expSeconds }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `https://media.example.com/x.m3u8?token=header.${payload}.sig`;
}

/** The controller's `tokenExpiryMs`, kept in lockstep. */
function tokenExpiryMs(url: string): number | null {
  try {
    const token = new URL(url).searchParams.get("token");
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** The controller's scheduling decision. `null` means "do not arm a timer". */
function refreshDelay(url: string, now: number): number | null {
  const expiresAt = tokenExpiryMs(url);
  if (expiresAt === null) return null;
  const remaining = expiresAt - now;
  if (remaining <= 0) return null;
  return remaining > TOKEN_REFRESH_MARGIN_MS
    ? remaining - TOKEN_REFRESH_MARGIN_MS
    : Math.max(1000, Math.floor(remaining / 2));
}

const NOW = 1_787_000_000_000;
const sec = (ms: number) => Math.round(ms / 1000);

describe("reading the token's expiry", () => {
  it("reads exp from a real play-session token", () => {
    // The exact token from the incident: exp 1787086014 = 18 Aug 2026 20:46:54 UTC.
    const url =
      "https://bserver.resomix.com/api/v1/playlists/x.m3u8?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
      ".eyJwbGF5bGlzdCI6IjQ2MzZmYjA4LTdkZjAtNGVmMC1hZDc5LTVmMjk0MjhkM2NmMyIsImlwIjoiNjIuNzQuMTguNzgiLCJleHAiOjE3ODcwODYwMTQsInBhcnRuZXJfaWQiOjEsInNjb3BlIjoicGxheWJhY2sifQ" +
      ".WHRdqrnWMQmfwVFGMwrYRJee_BaM2yCHxAf0Jrtbx0g";
    expect(tokenExpiryMs(url)).toBe(1787086014 * 1000);
  });

  it("returns null rather than guessing, for anything it cannot read", () => {
    expect(tokenExpiryMs("https://media.example.com/x.m3u8")).toBeNull();       // no token
    expect(tokenExpiryMs(tokenUrl(null, { malformed: true }))).toBeNull();      // not a JWT
    expect(tokenExpiryMs(tokenUrl(null))).toBeNull();                           // no exp claim
    expect(tokenExpiryMs("::::")).toBeNull();                                   // not a URL
  });
});

describe("when the refresh fires", () => {
  it("refreshes a fresh 4h token with the full margin to spare", () => {
    const fourHours = 4 * 60 * 60 * 1000;
    const delay = refreshDelay(tokenUrl(sec(NOW + fourHours)), NOW);
    expect(delay).toBe(fourHours - TOKEN_REFRESH_MARGIN_MS);
    // 3h50m: comfortably inside the token's life, so the replacement lands before anything 403s.
    expect(delay! + TOKEN_REFRESH_MARGIN_MS).toBeLessThanOrEqual(fourHours);
  });

  it("never schedules past the expiry it is meant to beat", () => {
    // The whole point. Any delay >= remaining would let the token die first.
    for (const remainingMin of [1, 5, 9, 10, 11, 60, 239, 240]) {
      const remaining = remainingMin * 60 * 1000;
      const delay = refreshDelay(tokenUrl(sec(NOW + remaining)), NOW);
      expect(delay, `${remainingMin} min left`).not.toBeNull();
      expect(delay!, `${remainingMin} min left`).toBeLessThan(remaining);
    }
  });

  it("halves what is left when already inside the margin", () => {
    // A tab resuming a session minted earlier. Refreshing at the halfway point rather than
    // instantly means this can never fire faster than once per half-life.
    const remaining = 6 * 60 * 1000;
    expect(refreshDelay(tokenUrl(sec(NOW + remaining)), NOW)).toBe(remaining / 2);
  });

  it("never schedules faster than once a second", () => {
    // Guards a busy-loop against /play-session if a token arrives with seconds left on it.
    expect(refreshDelay(tokenUrl(sec(NOW + 1500)), NOW)).toBe(1000);
  });
});

describe("a clock that disagrees with the server", () => {
  it("stands down instead of looping when the token already looks dead", () => {
    // Phone clocks drift. If the device thinks every token is expired, re-minting cannot help:
    // each replacement looks equally dead, and arming a timer would hammer /play-session forever.
    // Returning null hands the decision to the server, where the 403 recovery handles it.
    expect(refreshDelay(tokenUrl(sec(NOW - 1)), NOW)).toBeNull();
    expect(refreshDelay(tokenUrl(sec(NOW - 5 * 60 * 60 * 1000)), NOW)).toBeNull();
    expect(refreshDelay(tokenUrl(sec(NOW)), NOW)).toBeNull();   // exactly at exp
  });

  it("would have stood down on the incident token, not looped", () => {
    // Replaying the real failure: by the time those segments were requested the token was 1h32m
    // dead. The correct behaviour is to leave it to the server, not to spin.
    const requestedAt = Date.UTC(2026, 7, 18, 22, 18, 33);
    expect(refreshDelay(tokenUrl(1787086014), requestedAt)).toBeNull();
  });
});
