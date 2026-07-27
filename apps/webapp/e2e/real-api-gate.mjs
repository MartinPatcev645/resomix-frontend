/**
 * Real-API gate captures — requires live backend via Vite proxy.
 * Usage (from apps/webapp, with test account in env — never commit credentials):
 *   VITE_SERVER_BACKEND= VITE_SERVER_MEDIA=. pnpm dev --host 127.0.0.1 --port 5190
 *   RESOMIX_GATE_EMAIL=… RESOMIX_GATE_PASSWORD=… BASE_URL=http://127.0.0.1:5190 node e2e/real-api-gate.mjs analysis
 *   RESOMIX_GATE_EMAIL=… RESOMIX_GATE_PASSWORD=… BASE_URL=http://127.0.0.1:5190 node e2e/real-api-gate.mjs playback
 */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../../docs/page-demos/workspace/baseline-captures');
const FIXTURE_DIR = path.resolve(__dirname, 'fixtures');
const FIXTURE_WAV = path.join(FIXTURE_DIR, 'gate-upload.wav');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5190';
const EMAIL = process.env.RESOMIX_GATE_EMAIL || '';
const PASSWORD = process.env.RESOMIX_GATE_PASSWORD || '';
const mode = process.argv[2] || 'analysis';
const APP_TITLE = 'Resomix Sonic Discovery - Beta';

const CONSENT_KEYS = [
  'silktideCookieBanner_closed',
  'stcm.consent.essential',
  'stcm.consent.analytics',
  'stcm.consent.functional',
];

const created = { playlists: [], tracks: [], analyses: [] };

async function ensureFixtureWav() {
  if (existsSync(FIXTURE_WAV)) return;
  await mkdir(FIXTURE_DIR, { recursive: true });
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=8" -ar 44100 -ac 2 "${FIXTURE_WAV}"`,
    { stdio: 'pipe' },
  );
}

async function apiLogin() {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_or_username: EMAIL, password: PASSWORD }),
  });
  const body = await res.json();
  if (!body.success || !body.data?.access_token) {
    throw new Error(`Login failed (${res.status}): ${body.error || JSON.stringify(body)}`);
  }
  return body.data;
}

async function apiGet(pathname, token) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  return res.json();
}

async function apiDelete(pathname, token) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return res.json();
}

async function seedSession(page, auth) {
  await page.addInitScript(({ keys, user, token }) => {
    for (const key of keys) localStorage.setItem(key, 'true');
    localStorage.setItem('demo_stage_notice_dismissed', 'true');
    localStorage.setItem('workspace_loop_strip_dismissed', 'true');
    document.cookie = 'resomix_terms_accepted=1; path=/; SameSite=Lax';
    sessionStorage.setItem('resomix-access-token', token);
    localStorage.setItem(
      'resomix-auth-storage',
      JSON.stringify({
        ts: Date.now(),
        tabId: 'real-api-gate',
        payload: JSON.stringify({ state: { user, isAuthenticated: true }, version: 1 }),
      }),
    );
  }, { keys: CONSENT_KEYS, user: auth.user, token: auth.access_token });
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
    document.querySelectorAll('[aria-label="Dismiss beta stage notice"]').forEach((el) => el.click());
    document.querySelectorAll('[aria-label="Dismiss loop strip"]').forEach((el) => el.click());
  });
}

async function labelAndShot(page, filePath, url, { fullPage = false } = {}) {
  await page.evaluate((captureUrl) => {
    const existing = document.getElementById('gate-capture-url-label');
    existing?.remove();
    const label = document.createElement('div');
    label.id = 'gate-capture-url-label';
    label.textContent = captureUrl;
    Object.assign(label.style, {
      position: 'fixed',
      left: '8px',
      bottom: '8px',
      zIndex: '999999',
      padding: '4px 8px',
      background: 'rgba(0,0,0,0.82)',
      color: '#fff',
      font: '11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace',
      pointerEvents: 'none',
      border: '1px dotted rgba(255,255,255,0.35)',
    });
    document.body.appendChild(label);
  }, url);
  await page.screenshot({ path: filePath, fullPage });
}

async function waitForText(page, pattern, timeout = 120_000) {
  await page.getByText(pattern).first().waitFor({ state: 'visible', timeout });
}

async function captureAnalysisPass(browser, auth, viewport, suffix, manifest) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await seedSession(page, auth);
  await page.goto(`${BASE_URL}/analysis`, { waitUntil: 'networkidle' });
  if ((await page.title()) !== APP_TITLE) throw new Error('Wrong app on BASE_URL');
  await dismissOverlays(page);

  await page.getByText(/drop a track to analyse/i).waitFor({ state: 'visible' });
  const shot = async (state, file) => {
    await page.waitForTimeout(600);
    const outPath = path.join(OUT_DIR, file);
    await labelAndShot(page, outPath, page.url());
    manifest.push({ file, url: page.url(), state, viewport });
  };

  await shot('upload', `real-api-analysis-upload-${suffix}.png`);

  await page.getByRole('region', { name: 'Analyse a track' }).locator('input[type="file"]').setInputFiles(FIXTURE_WAV);
  await page.getByRole('button', { name: /analyse track/i }).click();
  await waitForText(page, /queued/i, 60_000);
  await shot('queued', `real-api-analysis-queued-${suffix}.png`);

  await waitForText(page, /pyxis-1 full analysis/i, 180_000);
  await shot('processing', `real-api-analysis-processing-${suffix}.png`);

  await waitForText(page, /analysis complete/i, 300_000);
  await shot('summary', `real-api-analysis-summary-${suffix}.png`);

  const findSimilar = page.getByRole('button', { name: /find similar tracks/i });
  await findSimilar.click();
  await page.waitForURL(/\/sonic-discovery\?id=/, { timeout: 60_000 });
  await page.getByText(/matched by pyxis-1/i).waitFor({ state: 'visible', timeout: 60_000 });
  const playlistUuid = new URL(page.url()).searchParams.get('id');
  await shot('playlist', `real-api-analysis-sibling-playlist-${suffix}.png`);

  await context.close();
  return playlistUuid;
}

async function runAnalysisJourney(auth) {
  await ensureFixtureWav();
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const manifest = [];
  let playlistUuid = null;
  let analysisId = null;
  let trackUuid = null;

  playlistUuid = await captureAnalysisPass(
    browser,
    auth,
    { width: 1440, height: 900 },
    '1440',
    manifest,
  );
  await captureAnalysisPass(browser, auth, devices['iPhone 13'].viewport, '393', manifest);

  const tracksResp = await apiGet('/api/v1/tracks/my-tracks?page=1&page_size=5', auth.access_token);
  if (tracksResp.success && Array.isArray(tracksResp.data)) {
    for (const row of tracksResp.data.slice(0, 2)) {
      if (row.analysis_uuid) created.analyses.push(row.analysis_uuid);
      if (row.uuid) created.tracks.push(row.uuid);
    }
    const latest = tracksResp.data[0];
    if (latest) {
      trackUuid = latest.uuid;
      analysisId = latest.analysis_uuid;
    }
  }
  if (playlistUuid) created.playlists.push(playlistUuid);

  await browser.close();
  await writeFile(
    path.join(OUT_DIR, 'real-api-analysis-manifest.json'),
    JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, playlistUuid, analysisId, trackUuid, shots: manifest }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, playlistUuid, analysisId, manifest }, null, 2));
}

async function runPlaybackMatrix(auth) {
  await ensureFixtureWav();
  await mkdir(OUT_DIR, { recursive: true });
  const videoDir = path.join(OUT_DIR, 'real-api-playback-matrix');
  await mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await seedSession(page, auth);
  await page.goto(`${BASE_URL}/sonic-discovery`, { waitUntil: 'networkidle' });
  await dismissOverlays(page);

  const log = (msg) => page.evaluate((m) => console.log(`[playback-matrix] ${m}`), msg);

  // 1) Mixed list via example reference (catalogue previews)
  await log('Scenario 1: catalogue reference → mixed preview list');
  await page.getByRole('button', { name: /try an example/i }).click();
  await page.getByRole('button', { name: 'Find similar tracks', exact: true }).click();
  await page.waitForURL(/\/sonic-discovery\?id=/, { timeout: 120_000 });
  await page.getByText(/matched by pyxis-1/i).waitFor({ state: 'visible', timeout: 120_000 });
  const playlistA = new URL(page.url()).searchParams.get('id');
  if (playlistA) created.playlists.push(playlistA);

  // 2) Preview seek on first row
  await log('Scenario 2: preview seek');
  const firstPlay = page.locator('[id^="playlist-table-row-"]').first().getByRole('button', { name: /play/i }).first();
  if (await firstPlay.count()) {
    await firstPlay.click();
    await page.waitForTimeout(2000);
    const seek = page.locator('[role="slider"][aria-label*="Seek" i], [role="slider"][aria-label*="seek" i]').first();
    if (await seek.count()) {
      await seek.click({ position: { x: 80, y: 5 } });
      await page.waitForTimeout(1500);
    }
  }

  // 3) Apple badge gating — icon only when deep_link present
  await log('Scenario 3: Apple badge visibility');
  await page.waitForTimeout(1000);

  // 4) HLS teardown mid-nav — upload reference then navigate away
  await log('Scenario 4: HLS teardown mid-nav');
  await page.goto(`${BASE_URL}/sonic-discovery`, { waitUntil: 'networkidle' });
  await dismissOverlays(page);
  await page.getByRole('tab', { name: /upload a reference/i }).click();
  const uploadInput = page.locator('input[type="file"]').first();
  await uploadInput.setInputFiles(FIXTURE_WAV);
  await page.getByRole('button', { name: 'Find similar tracks', exact: true }).click();
  await page.waitForTimeout(3000);
  await page.goto(`${BASE_URL}/analysis`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 5) Refresh / Library recovery
  await log('Scenario 5: refresh + Library recovery');
  await page.goto(`${BASE_URL}/library`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /^library$/i }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  if (playlistA) {
    await page.goto(`${BASE_URL}/sonic-discovery?id=${playlistA}`, { waitUntil: 'networkidle' });
    await page.getByText(/matched by pyxis-1/i).waitFor({ state: 'visible', timeout: 60_000 });
  }

  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  await browser.close();

  let videoPath = null;
  if (video) {
    videoPath = await video.path();
    const dest = path.join(OUT_DIR, 'real-api-playback-matrix.webm');
    await writeFile(dest, await readFile(videoPath));
    videoPath = dest;
  }

  await writeFile(
    path.join(OUT_DIR, 'real-api-playback-matrix-manifest.json'),
    JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, video: videoPath, scenarios: 5 }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, video: videoPath }, null, 2));
}

async function cleanup(auth) {
  const report = { deleted: { playlists: [], tracks: [] }, errors: [] };
  for (const uuid of [...new Set(created.playlists)]) {
    const resp = await apiDelete(`/api/v1/playlists/${uuid}`, auth.access_token);
    if (resp.success) report.deleted.playlists.push(uuid);
    else report.errors.push({ type: 'playlist', uuid, error: resp.error });
  }
  for (const uuid of [...new Set(created.tracks)]) {
    const resp = await apiDelete(`/api/v1/tracks/my-tracks/${uuid}`, auth.access_token);
    if (resp.success) report.deleted.tracks.push(uuid);
    else report.errors.push({ type: 'track', uuid, error: resp.error });
  }
  return report;
}

async function quotaReport(token) {
  const ent = await apiGet('/api/v1/entitlements/me', token);
  const tracks = await apiGet('/api/v1/tracks/my-tracks?page=1&page_size=1', token);
  const playlists = await apiGet('/api/v1/playlists/get-all-playlists/?page=1&page_size=1', token);
  return {
    entitlements: ent.success ? ent.data : ent,
    trackTotal: tracks.total ?? tracks.data?.length ?? null,
    playlistTotal: playlists.total ?? playlists.data?.length ?? null,
  };
}

if (!EMAIL || !PASSWORD) {
  console.error('Set RESOMIX_GATE_EMAIL and RESOMIX_GATE_PASSWORD (never commit these).');
  process.exit(1);
}

const auth = await apiLogin();
console.log(`Logged in as ${auth.user.email} via proxy`);

const quotaBefore = await quotaReport(auth.access_token);

if (mode === 'analysis') {
  await runAnalysisJourney(auth);
} else if (mode === 'playback') {
  await runPlaybackMatrix(auth);
} else if (mode === 'cleanup') {
  const report = await cleanup(auth);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
} else {
  console.error(`Unknown mode: ${mode}. Use analysis | playback | cleanup`);
  process.exit(1);
}

const cleanupReport = await cleanup(auth);
const quotaAfter = await quotaReport(auth.access_token);

await writeFile(
  path.join(OUT_DIR, 'real-api-quota-report.json'),
  JSON.stringify({ capturedAt: new Date().toISOString(), before: quotaBefore, after: quotaAfter, cleanup: cleanupReport, created }, null, 2),
);

console.log(JSON.stringify({ cleanup: cleanupReport, quotaAfter }, null, 2));
