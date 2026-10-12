import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import "@resomix/stores";
import { server } from "./server.ts";
import {
  connectBandcamp,
  disconnectBandcamp,
  getBandcampCollection,
  getBandcampConnection,
  getBandcampSync,
  mapConnection,
  mapItem,
  mapSync,
} from "@/features/bandcamp/api/bandcampApi.ts";
import { bandcampHandlers, resetBandcampMock } from "@/features/bandcamp/mocks/bandcampHandlers.ts";

beforeEach(() => {
  // Skip fingerprinting in jsdom: the request interceptor awaits the device hash.
  window.localStorage.setItem("rmx_device_hash", "test-device");
  resetBandcampMock();
  server.use(...bandcampHandlers);
});

describe("connection state", () => {
  it("reads 'not connected' from the backend's 200", async () => {
    await expect(getBandcampConnection()).resolves.toEqual({
      connected: false,
      username: null,
      status: "none",
      lastSyncedAt: null,
      activeJobId: null,
      itemCount: 0,
      matchedCount: 0,
      errorMessage: null,
    });
  });

  it("reports the running job after a connect", async () => {
    const { jobId } = await connectBandcamp("coolfan");
    await expect(getBandcampConnection()).resolves.toMatchObject({
      connected: true,
      username: "coolfan",
      status: "pending",
      activeJobId: jobId,
    });
  });

  it("maps the backend shape", () => {
    expect(
      mapConnection({
        connected: true,
        username: "fan",
        status: "syncing",
        last_synced_at: "2026-10-10T17:00:00",
        active_job_id: "job-1",
        item_count: 12,
        matched_count: 4,
        error_message: "Bandcamp stopped responding after 4,000 items.",
      }),
    ).toEqual({
      connected: true,
      username: "fan",
      status: "syncing",
      lastSyncedAt: "2026-10-10T17:00:00",
      activeJobId: "job-1",
      itemCount: 12,
      matchedCount: 4,
      errorMessage: "Bandcamp stopped responding after 4,000 items.",
    });
  });

  it("never reports a job or username without a connection", () => {
    expect(mapConnection({ connected: false, username: "x", status: "ready", active_job_id: "j" })).toMatchObject({
      username: null,
      status: "none",
      activeJobId: null,
      matchedCount: null,
      errorMessage: null,
    });
  });
});

describe("connect error mapping", () => {
  it.each([
    ["notfound", "not_found", 404],
    ["private", "private", 403],
    ["artist", "invalid", 422],
    ["ratelimited", "rate_limited", 429],
  ])("%s -> %s", async (username, kind, status) => {
    await expect(connectBandcamp(username)).rejects.toMatchObject({ kind, status });
  });

  it("maps a dropped connection to a network error", async () => {
    server.use(http.post("*/api/v1/bandcamp/connect", () => HttpResponse.error()));
    await expect(connectBandcamp("coolfan")).rejects.toMatchObject({ kind: "network" });
  });

  it("maps 401 (when the session cannot be refreshed) to auth", async () => {
    server.use(http.post("*/api/v1/bandcamp/connect", () => HttpResponse.json({}, { status: 401 })));
    await expect(connectBandcamp("coolfan")).rejects.toMatchObject({ kind: "auth" });
  });

  it("maps 500 to unknown with the server's message", async () => {
    server.use(http.post("*/api/v1/bandcamp/connect", () => HttpResponse.json({ error: "boom" }, { status: 500 })));
    await expect(connectBandcamp("coolfan")).rejects.toMatchObject({ kind: "unknown", message: "boom" });
  });

  it.each([502, 503])("maps %s to unavailable, so the user knows it is Bandcamp's side", async (status) => {
    server.use(
      http.post("*/api/v1/bandcamp/connect", () => HttpResponse.json({ success: false, error: "blocked" }, { status })),
    );
    await expect(connectBandcamp("coolfan")).rejects.toMatchObject({ kind: "unavailable", status });
  });

  it("returns the job id on 202 and the same job when a sync is already running", async () => {
    const first = await connectBandcamp("coolfan");
    const again = await connectBandcamp("coolfan");
    expect(first.jobId).toMatch(/^job-/);
    expect(again.jobId).toBe(first.jobId);
  });
});

describe("collection and sync", () => {
  it("treats 404 on the collection as 'not connected', not 'user not found'", async () => {
    server.use(http.get("*/api/v1/bandcamp/collection", () => HttpResponse.json({ success: false }, { status: 404 })));
    await expect(getBandcampCollection({ page: 1, pageSize: 10 })).rejects.toMatchObject({ kind: "not_connected" });
  });

  it("unwraps the backend's { success, data } envelope, which is an empty page when not connected", async () => {
    await expect(getBandcampCollection({ page: 1, pageSize: 10 })).resolves.toMatchObject({ items: [], total: 0 });
  });

  it("sends page, page_size and q, and maps the page", async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get("*/api/v1/bandcamp/collection", ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json({
          success: true,
          data: {
            items: [{ id: 1, item_type: "track", artist: "A", title: "T", resomix_track_id: 5 }],
            total: 1,
            page: 2,
            page_size: 10,
          },
        });
      }),
    );
    const page = await getBandcampCollection({ page: 2, pageSize: 10, q: "  glass ", matched: true });
    expect(seen!.get("page")).toBe("2");
    expect(seen!.get("page_size")).toBe("10");
    expect(seen!.get("q")).toBe("glass");
    expect(seen!.get("matched")).toBe("true");
    expect(page.items[0]).toMatchObject({ id: "1", resomixTrackId: "5" });
    expect(page.items[0]).not.toHaveProperty("analysisStatus");
  });

  it("omits an empty q", async () => {
    let seen: URLSearchParams | null = null;
    server.use(
      http.get("*/api/v1/bandcamp/collection", ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json({ success: true, data: { items: [], total: 0, page: 1, page_size: 10 } });
      }),
    );
    await getBandcampCollection({ page: 1, pageSize: 10, q: "   " });
    expect(seen!.has("q")).toBe(false);
    expect(seen!.has("matched")).toBe(false);
  });

  it("rejects a response that is not the { success, data } envelope", async () => {
    server.use(http.get("*/api/v1/bandcamp/connection", () => HttpResponse.json({ connected: true, username: "fan" })));
    await expect(getBandcampConnection()).rejects.toMatchObject({ kind: "unknown" });
  });

  it("runs the mock sync through to a browsable collection, then disconnects", async () => {
    const { jobId } = await connectBandcamp("coolfan");
    let state = await getBandcampSync(jobId);
    for (let i = 0; i < 20 && state.status !== "ready"; i++) state = await getBandcampSync(jobId);
    expect(state).toMatchObject({ status: "ready", processed: 30, total: 30 });

    const page = await getBandcampCollection({ page: 1, pageSize: 24 });
    expect(page.total).toBe(30);
    expect(page.items.some((i) => i.itemType === "album")).toBe(true);
    expect(page.items.some((i) => i.resomixTrackId === null)).toBe(true);

    await disconnectBandcamp();
    await expect(getBandcampCollection({ page: 1, pageSize: 24 })).resolves.toMatchObject({ total: 0 });
  });
});

describe("mapItem", () => {
  it("fills safe defaults for missing fields", () => {
    expect(mapItem({ id: 9 })).toEqual({
      id: "9",
      itemType: "track",
      artist: "Unknown artist",
      title: "Untitled",
      album: null,
      artworkUrl: null,
      sourceUrl: null,
      resomixTrackId: null,
    });
  });

  it("drops non-http links", () => {
    const item = mapItem({
      id: "x",
      item_type: "album",
      source_url: "javascript:alert(1)",
      artwork_url: "data:image/png;base64,AAAA",
      resomix_track_id: "",
    });
    expect(item).toMatchObject({ itemType: "album", sourceUrl: null, artworkUrl: null, resomixTrackId: null });
  });
});

describe("mapSync", () => {
  it("treats a zero or missing total as unknown", () => {
    expect(mapSync({ status: "running", processed: 3, total: 0 }).total).toBeNull();
    expect(mapSync({ status: "running", processed: 3 }).total).toBeNull();
  });

  it.each([
    ["queued", "pending"],
    ["running", "syncing"],
    ["done", "ready"],
    ["failed", "failed"],
  ])("maps the backend status %s to %s", (raw, status) => {
    expect(mapSync({ status: raw }).status).toBe(status);
  });

  it.each(["pending", "syncing", "ready", "whatever"])("rejects a status the backend does not send: %s", (status) => {
    expect(() => mapSync({ status })).toThrow(/sync status/i);
  });
});
