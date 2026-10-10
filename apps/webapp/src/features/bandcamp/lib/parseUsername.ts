/**
 * Turns whatever a user pastes into the field — `name`, `@name`, `bandcamp.com/name`,
 * `https://bandcamp.com/name?from=menubar` — into a Bandcamp fan username.
 *
 * Artist pages live on subdomains (`artist.bandcamp.com`) and are rejected here, before any
 * request, because a fan collection can only be read from `bandcamp.com/<fan>`.
 */

export type ParseUsernameResult =
  | { ok: true; username: string }
  | { ok: false; reason: "empty" | "artist_url" | "invalid" };

const USERNAME_RE = /^[a-z0-9_-]{1,64}$/i;

export function parseBandcampUsername(input: string): ParseUsernameResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^[^/\s]+\.[a-z]{2,}(\/|$)/i.test(trimmed);
  if (!looksLikeUrl) {
    const candidate = trimmed.replace(/^@/, "");
    return USERNAME_RE.test(candidate) ? { ok: true, username: candidate } : { ok: false, reason: "invalid" };
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "invalid" };

  const host = url.hostname.toLowerCase();
  if (host !== "bandcamp.com" && host !== "www.bandcamp.com") {
    return host.endsWith(".bandcamp.com") ? { ok: false, reason: "artist_url" } : { ok: false, reason: "invalid" };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return { ok: false, reason: "invalid" };
  const candidate = segments[0].replace(/^@/, "");
  return USERNAME_RE.test(candidate) ? { ok: true, username: candidate } : { ok: false, reason: "invalid" };
}
