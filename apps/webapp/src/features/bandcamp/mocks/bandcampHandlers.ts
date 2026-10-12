/**
 * MSW handlers implementing the Bandcamp contract, for local development and tests.
 *
 * Choosing an error case:
 *   - by username on the connect form: `notfound` (404), `private` (403), `artist` (422),
 *     `ratelimited` (429), `syncfail` (job fails part-way), `empty` (no public items);
 *   - for every request: `localStorage.bandcampMockScenario = "network" | "expired" | "slow"`
 *     ("expired" answers 401, which runs the app's real session-expired flow).
 *
 * State lives in localStorage so a reload resumes the sync or shows the imported collection.
 */
import { delay, http, HttpResponse } from "msw";
import type { RawCollectionItem } from "../api/bandcampApi.ts";

const STATE_KEY = "bandcampMockState";
const SCENARIO_KEY = "bandcampMockScenario";

interface MockState {
  username: string;
  jobId: string;
  /** Polls answered so far; progress is derived from it. */
  polls: number;
  total: number;
  failAt: number | null;
}

let memoryState: MockState | null = null;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function loadState(): MockState | null {
  const raw = storage()?.getItem(STATE_KEY);
  if (!raw) return memoryState;
  try {
    return JSON.parse(raw) as MockState;
  } catch {
    return null;
  }
}

function saveState(state: MockState | null) {
  memoryState = state;
  const store = storage();
  if (!store) return;
  if (state) store.setItem(STATE_KEY, JSON.stringify(state));
  else store.removeItem(STATE_KEY);
}

export function resetBandcampMock() {
  saveState(null);
  storage()?.removeItem(SCENARIO_KEY);
}

const ARTISTS = [
  "Floating Points", "Kara-Lis Coverdale", "Yu Su", "Bicep", "DJ Python", "Nala Sinephro",
  "Huerco S.", "Laurel Halo", "Moin", "Skee Mask", "Loraine James", "Ana Roxanne",
];
const WORDS = ["Night", "Drift", "Signal", "Glass", "Tide", "Ember", "Static", "Bloom", "Orbit", "Haze"];

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildItems(): RawCollectionItem[] {
  return Array.from({ length: 30 }, (_, i) => {
    const artist = ARTISTS[i % ARTISTS.length];
    const isAlbum = i % 4 === 0;
    const title = `${WORDS[i % WORDS.length]} ${WORDS[(i * 3 + 1) % WORDS.length]}`;
    const album = `${WORDS[(i + 4) % WORDS.length]} Sessions`;
    const matched = !isAlbum && i % 3 !== 0;
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    return {
      id: `bc-${i + 1}`,
      item_type: isAlbum ? "album" : "track",
      artist,
      title: isAlbum ? album : title,
      album: isAlbum ? null : album,
      artwork_url: i % 7 === 6 ? null : `${origin}/__bandcamp-mock/artwork/${i + 1}.svg`,
      source_url: `https://${slug(artist)}.bandcamp.com/${isAlbum ? "album" : "track"}/${slug(isAlbum ? album : title)}`,
      resomix_track_id: matched ? String(1000 + i) : null,
    };
  });
}

const ITEMS = buildItems();

function itemsFor(state: MockState) {
  return state.username === "empty" ? [] : ITEMS;
}

/** Job status in the backend's vocabulary: queued | running | done | failed. */
function progress(state: MockState) {
  const processed = Math.min(state.total, state.polls * 6);
  if (state.failAt !== null && processed >= state.failAt) {
    return { status: "failed", processed: state.failAt, total: state.total, error: "Bandcamp stopped responding part-way through the import." };
  }
  if (state.total === 0) return { status: "done", processed: 0, total: 0, error: null };
  if (state.polls === 0) return { status: "queued", processed: 0, total: 0, error: null };
  if (processed >= state.total) return { status: "done", processed: state.total, total: state.total, error: null };
  return { status: "running", processed, total: state.polls < 2 ? 0 : state.total, error: null };
}

/** Applies the global scenario; returns a response to short-circuit with, if any. */
async function globalScenario() {
  const scenario = storage()?.getItem(SCENARIO_KEY);
  if (scenario === "slow") await delay(1500);
  if (scenario === "network") return HttpResponse.error();
  if (scenario === "expired") return fail("Not authenticated", 401);
  return null;
}

/** Same envelope as the real backend's `format_response`. */
const ok = (data: unknown, status = 200) => HttpResponse.json({ success: true, data } as Record<string, unknown>, { status });
const fail = (error: string, status: number) => HttpResponse.json({ success: false, error }, { status });

export const bandcampHandlers = [
  http.post("*/api/v1/bandcamp/connect", async ({ request }) => {
    const short = await globalScenario();
    if (short) return short;
    await delay(400);
    const body = (await request.json().catch(() => ({}))) as { username?: string };
    const username = (body.username ?? "").toLowerCase();
    if (!username || username === "artist") return fail("That is an artist page. Enter your Bandcamp fan username instead.", 422);
    if (username === "notfound") return fail("Bandcamp user not found.", 404);
    if (username === "private") return fail("This Bandcamp collection is private.", 403);
    if (username === "ratelimited") return fail("Bandcamp is rate limiting requests.", 429);

    const current = loadState();
    const currentStatus = current ? progress(current).status : null;
    if (current && current.username === username && (currentStatus === "queued" || currentStatus === "running")) {
      return ok({ job_id: current.jobId }, 202);
    }
    // `syncfail` fails once; the Retry after it succeeds, so both paths can be seen.
    const retryAfterFailure = current?.username === username && currentStatus === "failed";
    const state: MockState = {
      username,
      jobId: `job-${Date.now()}`,
      polls: 0,
      total: username === "empty" ? 0 : ITEMS.length,
      failAt: username === "syncfail" && !retryAfterFailure ? 12 : null,
    };
    saveState(state);
    return ok({ job_id: state.jobId }, 202);
  }),

  http.get("*/api/v1/bandcamp/connection", async () => {
    const short = await globalScenario();
    if (short) return short;
    await delay(200);
    const state = loadState();
    if (!state) {
      return ok({
        connected: false,
        username: null,
        status: "none",
        last_synced_at: null,
        active_job_id: null,
        item_count: 0,
        matched_count: 0,
        error_message: null,
      });
    }
    const job = progress(state);
    const active = job.status === "queued" || job.status === "running";
    const status = { queued: "pending", running: "syncing", done: "ready", failed: "failed" }[job.status];
    const imported = itemsFor(state).slice(0, job.status === "done" ? itemsFor(state).length : job.processed);
    return ok({
      connected: true,
      username: state.username,
      status,
      last_synced_at: job.status === "done" ? new Date().toISOString() : null,
      active_job_id: active ? state.jobId : null,
      item_count: job.status === "done" ? itemsFor(state).length : job.processed,
      matched_count: imported.filter((item) => item.resomix_track_id).length,
      error_message: job.status === "failed" ? job.error : null,
    });
  }),

  http.get("*/api/v1/bandcamp/sync/:jobId", async ({ params }) => {
    const short = await globalScenario();
    if (short) return short;
    const state = loadState();
    if (!state || state.jobId !== params.jobId) return fail("Sync job not found.", 404);
    const next = { ...state, polls: state.polls + 1 };
    saveState(next);
    return ok(progress(next));
  }),

  http.get("*/api/v1/bandcamp/collection", async ({ request }) => {
    const short = await globalScenario();
    if (short) return short;
    await delay(250);
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get("page_size")) || 50);
    const state = loadState();
    // Like the real backend: no connection is an empty 200, not a 404.
    if (!state) return ok({ items: [], total: 0, page, page_size: pageSize });
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const matchedOnly = url.searchParams.get("matched") === "true";
    const visible = progress(state).status === "done" ? itemsFor(state) : itemsFor(state).slice(0, Math.min(state.total, state.polls * 6));
    const searched = q
      ? visible.filter((item) => [item.artist, item.title, item.album].some((v) => v?.toLowerCase().includes(q)))
      : visible;
    const filtered = matchedOnly ? searched.filter((item) => item.resomix_track_id) : searched;
    const start = (page - 1) * pageSize;
    return ok({ items: filtered.slice(start, start + pageSize), total: filtered.length, page, page_size: pageSize });
  }),

  http.delete("*/api/v1/bandcamp/connection", async () => {
    const short = await globalScenario();
    if (short) return short;
    await delay(300);
    const state = loadState();
    if (!state) return fail("No Bandcamp account is connected.", 404);
    saveState(null);
    return ok({ connected: false, removed_items: itemsFor(state).length });
  }),

  http.get("*/__bandcamp-mock/artwork/:file", ({ params }) => {
    const n = Number(String(params.file).replace(/\D/g, "")) || 1;
    const hue = (n * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${hue} 45% 22%)"/><circle cx="50" cy="50" r="${18 + (n % 5) * 5}" fill="none" stroke="hsl(${(hue + 40) % 360} 80% 60%)" stroke-width="2"/></svg>`;
    return new HttpResponse(svg, { headers: { "Content-Type": "image/svg+xml" } });
  }),
];

