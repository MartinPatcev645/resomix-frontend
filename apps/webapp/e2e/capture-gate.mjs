/**
 * Workspace gate captures — webapp only.
 * Usage (from apps/webapp):
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage1
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage2
 *   BASE_URL=http://127.0.0.1:5191 node e2e/capture-gate.mjs baseline
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage3
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage3.1
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage4
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage4.3
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage4.5
 *   BASE_URL=http://127.0.0.1:5190 node e2e/capture-gate.mjs stage4.8
 */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../../docs/page-demos/workspace/baseline-captures');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5190';
const mode = process.argv[2] || 'stage1';
const APP_TITLE = 'Resomix Sonic Discovery - Beta';

const CONSENT_KEYS = [
  'silktideCookieBanner_closed',
  'stcm.consent.essential',
  'stcm.consent.analytics',
  'stcm.consent.functional',
];

const GUEST_ENTITLEMENTS = {
  success: true,
  data: {
    is_frontend: true,
    is_guest: true,
    plan: { code: 'guest', name: 'Guest', is_default: true },
    entitlements: {
      dropdown_max_tracks: 20,
      max_tracks_per_playlist: 10,
      search_playlists_per_month: 3,
      uploads_per_month: 0,
      can_similarity_upload: false,
    },
  },
};

const FREE_ENTITLEMENTS = {
  success: true,
  data: {
    is_frontend: true,
    is_guest: false,
    plan: { code: 'free', name: 'Free', is_default: false },
    entitlements: {
      dropdown_max_tracks: 50,
      max_tracks_per_playlist: 20,
      search_playlists_per_month: 10,
      uploads_per_month: 3,
      can_similarity_upload: true,
    },
  },
};

const CAPTURE_USER = {
  id: 1,
  uuid: '00000000-0000-4000-8000-000000000001',
  email: 'capture@test.local',
  username: 'capture',
  is_email_verified: true,
};

function makeJwt(sub) {
  const b64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 86400 * 365;
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub, exp })}.capture`;
}

async function seedProfile(page, { signedIn = false } = {}) {
  await page.addInitScript(({ keys, authUser, authToken }) => {
    for (const key of keys) {
      localStorage.setItem(key, 'true');
    }
    localStorage.setItem('demo_stage_notice_dismissed', 'true');
    localStorage.setItem('workspace_loop_strip_dismissed', 'true');
    document.cookie = 'resomix_terms_accepted=1; path=/; SameSite=Lax';

    if (authUser && authToken) {
      sessionStorage.setItem('resomix-access-token', authToken);
      const payload = JSON.stringify({
        state: { user: authUser, isAuthenticated: true },
        version: 1,
      });
      localStorage.setItem(
        'resomix-auth-storage',
        JSON.stringify({ ts: Date.now(), tabId: 'capture', payload }),
      );
    } else {
      sessionStorage.removeItem('resomix-access-token');
      localStorage.removeItem('resomix-auth-storage');
    }
  }, {
    keys: CONSENT_KEYS,
    authUser: signedIn ? CAPTURE_USER : null,
    authToken: signedIn ? makeJwt(CAPTURE_USER.uuid) : null,
  });
}

async function installApiMocks(page, { signedIn = false } = {}) {
  const entitlements = signedIn ? FREE_ENTITLEMENTS : GUEST_ENTITLEMENTS;

  await page.route('**/api/v1/entitlements/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(entitlements),
    }),
  );

  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      contentType: 'application/json',
      body: JSON.stringify(
        signedIn
          ? { success: true, data: { access_token: makeJwt(CAPTURE_USER.uuid) } }
          : { success: false, error: 'No session' },
      ),
    }),
  );

  if (signedIn) {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { user: CAPTURE_USER } }),
      }),
    );
    await page.route('**/api/v1/users/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: CAPTURE_USER }),
      }),
    );
    await page.route('**/api/v1/tracks/my-tracks**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      }),
    );
  }
}

async function assertAppFingerprint(page) {
  const title = await page.title();
  if (title !== APP_TITLE) {
    throw new Error(
      `App fingerprint mismatch: expected title "${APP_TITLE}", got "${title}" — wrong server/port?`,
    );
  }
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
    document.querySelectorAll('[aria-label="Dismiss beta stage notice"]').forEach((el) => {
      el.click();
    });
    document.querySelectorAll('[aria-label="Dismiss loop strip"]').forEach((el) => {
      el.click();
    });
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

async function selectReferenceExample(page, { signedIn = false } = {}) {
  await page.getByRole('button', { name: /try an example/i }).click();
  await page.getByRole('button', { name: 'Find similar tracks', exact: true }).waitFor({ state: 'visible' });
  await page
    .getByText(signedIn ? 'Subscribe to unlock deeper results' : 'Log in to unlock deeper results')
    .waitFor({ state: 'visible' });
}

async function showProcessingPanel(page) {
  let resolveHang;
  const hang = new Promise((resolve) => {
    resolveHang = resolve;
  });
  await page.route('**/api/v1/similarity/search', async (route) => {
    await hang;
    await route.abort();
  });

  await selectReferenceExample(page);
  await page.getByRole('button', { name: 'Find similar tracks', exact: true }).click();
  await page.locator('[role="status"][aria-busy="true"]').waitFor({ state: 'visible' });

  setTimeout(() => resolveHang(), 30_000);
}

const MOCK_PLAYLIST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const MOCK_PLAYLIST_RESPONSE = {
  success: true,
  data: {
    playlist: {
      id: MOCK_PLAYLIST_ID,
      name: 'Nocturne Transit',
      is_public: false,
      is_favorite: false,
      has_custom_cover: false,
      is_owner: false,
    },
    queried_track: {
      rank: 0,
      score: 1,
      id: '100001',
      title: 'Nocturne Transit',
      artist: 'Vela Kasm',
      year: 2024,
      duration: 402,
      label: 'Vireo Ltd',
      type: 'internal',
      deep_link_url: 'https://music.apple.com/example',
    },
    similar_tracks: Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      score: 0.98 - i * 0.012,
      id: String(200001 + i),
      title: ['Halide Drift', 'Glass Meridian', 'Nightshift Cartography', 'Low Tide Relay', 'Static Bloom'][i],
      artist: ['Lune Arcadia', 'Vela Kasm', 'Kasm & Field', 'Meridian Unit', 'Arcadia Lab'][i],
      year: 2023 + (i % 2),
      duration: 240 + i * 15,
      label: 'Vireo Ltd',
      type: i % 2 === 0 ? 'internal' : 'internal',
      deep_link_url: i % 2 === 0 ? 'https://music.apple.com/example' : null,
      genre: 'Electronic---Deep House',
      playback: i === 2 ? 'hls' : 'preview',
    })),
  },
};

async function installSignedInPlaylistMock(page, trackCount = 12) {
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_PLAYLIST_RESPONSE,
        data: {
          ...MOCK_PLAYLIST_RESPONSE.data,
          similar_tracks: Array.from({ length: trackCount }, (_, i) => ({
            rank: i + 1,
            score: 0.98 - i * 0.012,
            id: String(200001 + i),
            title: ['Halide Drift', 'Glass Meridian', 'Nightshift Cartography', 'Low Tide Relay', 'Static Bloom', 'Paper Cities', 'Glow Machine Hours', 'Ferrous', 'Undertow Protocol', 'Blue Hour Freight', 'Meridian Static', 'Cassia Line'][i] ?? `Fixture ${i + 1}`,
            artist: ['Lune Arcadia', 'Vela Kasm', 'Kasm & Field', 'Meridian Unit', 'Arcadia Lab', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist'][i] ?? 'Fixture Artist',
            year: 2023 + (i % 2),
            duration: 240 + i * 15,
            label: 'Vireo Ltd',
            type: 'internal',
            deep_link_url: i % 2 === 0 ? 'https://music.apple.com/example' : null,
            genre: 'Electronic---Deep House',
            playback: i === 2 ? 'hls' : 'preview',
          })),
        },
      }),
    }),
  );
}

async function playlistResultsLocator(page) {
  return page.locator('[aria-label="Similar tracks"]').first();
}

async function scrollPlaylistTableIntoView(page) {
  const table = await playlistResultsLocator(page);
  await table.waitFor({ state: 'visible' });
  await table.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
}

async function assertDesktopPlaylistRowsHorizontal(page) {
  const table = await playlistResultsLocator(page);
  const rows = table.getByRole('row');
  const count = await rows.count();
  if (count < 9) {
    throw new Error(`Expected at least 9 table rows (header + 8 data), got ${count}`);
  }
  const sample = rows.nth(1);
  const box = await sample.boundingBox();
  if (!box || box.height > 80) {
    throw new Error(`Playlist data row appears stacked (height ${box?.height ?? 'null'}px, expected single-line row)`);
  }
  const gridColumns = await sample.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  if (!gridColumns || gridColumns.split(' ').length < 8) {
    throw new Error(`Playlist row grid not applied: gridTemplateColumns="${gridColumns}"`);
  }
}

async function seedPlayingRow(page, trackId = '200001') {
  await page.evaluate((id) => {
    const stores = window.__RESOMIX_STORES__;
    if (stores?.player) {
      stores.player.getState().setCurrentTrackId(id);
      stores.player.getState().setIsPlaying(true);
    }
  }, trackId).catch(() => {});
  await page.evaluate((id) => {
    sessionStorage.setItem('resomix-player-debug', JSON.stringify({ currentTrackId: id, isPlaying: true }));
  }, trackId);
  const firstPlay = page.locator('[id^="playlist-table-play-button-"]').first();
  if (await firstPlay.isVisible()) {
    await firstPlay.click({ force: true });
    await page.waitForTimeout(600);
  }
}

async function installGuestPlaylistMock(page) {
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_PLAYLIST_RESPONSE,
        data: {
          ...MOCK_PLAYLIST_RESPONSE.data,
          similar_tracks: Array.from({ length: 15 }, (_, i) => ({
            rank: i + 1,
            score: 0.98 - i * 0.012,
            id: String(200001 + i),
            title: ['Halide Drift', 'Glass Meridian', 'Nightshift Cartography', 'Low Tide Relay', 'Static Bloom', 'Paper Cities', 'Glow Machine Hours', 'Ferrous', 'Undertow Protocol', 'Blue Hour Freight', 'Meridian Static', 'Cassia Line', 'Nightshift Cartography', 'Halide Drift II', 'Glass Meridian II'][i],
            artist: ['Lune Arcadia', 'Vela Kasm', 'Kasm & Field', 'Meridian Unit', 'Arcadia Lab', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist', 'Fixture Artist'][i],
            year: 2023 + (i % 2),
            duration: 240 + i * 15,
            label: 'Vireo Ltd',
            type: 'internal',
            deep_link_url: i % 2 === 0 ? 'https://music.apple.com/example' : null,
            genre: 'Electronic---Deep House',
            playback: i === 2 ? 'hls' : 'preview',
          })),
        },
      }),
    }),
  );
}

async function installPlaylistMock(page) {
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PLAYLIST_RESPONSE),
    }),
  );
}

function bodyRenderOk(bodyText, setup) {
  const body = bodyText.toLowerCase();
  if (body.includes('page not found') || body.includes('hear the invisible')) {
    return false;
  }
  switch (setup) {
    case 'shell':
      return (
        body.includes('start with a track') ||
        body.includes('no track in mind') ||
        body.includes('do you have a track in mind')
      );
    case 'analysis-gate':
      return body.includes('sign in to analyse a track');
    case 'reference-depth-guest':
      return (
        body.includes('harry mcfly') &&
        body.includes('log in to unlock deeper results') &&
        body.includes('find similar tracks')
      );
    case 'reference-depth-signed-in':
      return (
        body.includes('harry mcfly') &&
        body.includes('subscribe to unlock deeper results') &&
        body.includes('find similar tracks')
      );
    case 'processing':
      return body.includes('preparing reference') && body.includes('searching the index');
    case 'analysis-signed-in':
      return body.includes('drop a track to analyse') || body.includes('analyse track');
    case 'analysis-processing':
      return body.includes('queued') && body.includes('pyxis-1 full analysis');
    case 'analysis-summary':
      return body.includes('analysis complete') && body.includes('find similar tracks') && body.includes('for djs');
    case 'analysis-failed':
      return body.includes('analysis failed') && body.includes('try again');
    case 'analysis-full-id':
      return body.includes('analysis') && (body.includes('upload a track') || body.includes('tempo'));
    case 'playlist-results-guest':
      return body.includes('nocturne transit') && body.includes('matched by pyxis-1') && body.includes('create free account');
    case 'playlist-results-signed-in':
      return body.includes('nocturne transit') && body.includes('matched by pyxis-1');
    case 'playlist-playing':
      return body.includes('nocturne transit') && body.includes('matched by pyxis-1');
    case 'discovery-input-search':
      return body.includes('search a known track') && body.includes('no track in mind');
    case 'discovery-input-upload':
      return (
        body.includes('upload a reference') &&
        body.includes('drop a reference file') &&
        body.includes('mp3 · wav · flac · aiff')
      );
    case 'discovery-input-height':
      return body.includes('start with a track') && body.includes('no track in mind');
    case 'analysis-summary-long':
      return (
        body.includes('analysis complete') &&
        body.includes('117.9') &&
        body.includes('for djs') &&
        !body.includes('conf -0.04')
      );
    case 'analysis-summary-legacy':
      return body.includes('analysis complete') && body.includes('no sibling similarity playlist');
    case 'playlist-upload-seed':
      return body.includes('upload reference') && body.includes('matched by pyxis-1');
    case 'playlist-long-title':
      return body.includes('gabriele mancino') && body.includes('matched by pyxis-1');
    case 'playlist-playback-error':
      return body.includes('playback unavailable') && body.includes('retry');
    default:
      return true;
  }
}

const STAGE1_TARGETS = [
  { file: 'stage1-workspace-discovery-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'shell', signedIn: false },
  { file: 'stage1-workspace-discovery-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'shell', signedIn: false },
  { file: 'stage1-workspace-analysis-gate-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-gate', signedIn: false },
  { file: 'stage1-workspace-analysis-gate-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-gate', signedIn: false },
];

const STAGE2_TARGETS = [
  { file: 'stage2-discovery-reference-depth-guest-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'reference-depth-guest', signedIn: false },
  { file: 'stage2-discovery-reference-depth-guest-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'reference-depth-guest', signedIn: false },
  { file: 'stage2-discovery-reference-depth-signed-in-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'reference-depth-signed-in', signedIn: true },
  { file: 'stage2-discovery-reference-depth-signed-in-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'reference-depth-signed-in', signedIn: true },
  { file: 'stage2-discovery-processing-guest-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'processing', signedIn: false },
  { file: 'stage2-discovery-processing-guest-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'processing', signedIn: false },
  { file: 'stage2-analysis-gate-guest-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-gate', signedIn: false },
  { file: 'stage2-analysis-gate-guest-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-gate', signedIn: false },
  { file: 'stage2-analysis-signed-in-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-signed-in', signedIn: true },
  { file: 'stage2-analysis-signed-in-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-signed-in', signedIn: true },
];

const STAGE3_TARGETS = [
  { file: 'stage3-playlist-results-guest-1440.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1440, height: 900 }, setup: 'playlist-results', signedIn: false },
  { file: 'stage3-playlist-results-guest-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-results', signedIn: false },
];

const STAGE31_TARGETS = [
  { file: 'stage31-discovery-search-guest-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'discovery-input-search', signedIn: false, sourceTab: 'search' },
  { file: 'stage31-discovery-search-guest-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'discovery-input-search', signedIn: false, sourceTab: 'search' },
  { file: 'stage31-discovery-upload-guest-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'discovery-input-upload', signedIn: false, sourceTab: 'upload' },
  { file: 'stage31-discovery-upload-guest-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'discovery-input-upload', signedIn: false, sourceTab: 'upload' },
  { file: 'stage31-discovery-search-signed-in-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'discovery-input-search', signedIn: true, sourceTab: 'search' },
  { file: 'stage31-discovery-search-signed-in-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'discovery-input-search', signedIn: true, sourceTab: 'search' },
  { file: 'stage31-discovery-upload-signed-in-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'discovery-input-upload', signedIn: true, sourceTab: 'upload' },
  { file: 'stage31-discovery-upload-signed-in-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'discovery-input-upload', signedIn: true, sourceTab: 'upload' },
  { file: 'stage31-discovery-empty-height-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'discovery-input-height', signedIn: false, sourceTab: 'search', fullPage: true },
];

const MOCK_ANALYSIS_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const MOCK_PLAYLIST_FROM_ANALYSIS = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

const MOCK_ANALYSIS_RESULT = {
  identity: {
    input_filename: 'glasshouse_ext_master.wav',
    duration_ms: 444000,
    sample_rate_hz: 44100,
    bit_rate: 320000,
    channel_count: 2,
    codec: 'wav',
  },
  technical: {
    integrated_loudness_lufs: -8.2,
    loudness_range_lu: 6.4,
    true_peak_dbtp: -1.2,
    average_loudness_db: -12,
    crest_factor: 8,
    loudness_curve: { values: [0.2, 0.4, 0.6, 0.5, 0.8, 0.7], hop_ms: 500 },
    rms_energy_curve: { values: [0.1, 0.3, 0.5, 0.4, 0.7, 0.6], hop_ms: 500 },
  },
  rhythm: { bpm: 126, confidence: 0.94, beat_times_seconds: [], bar_count: 32 },
  tonality: { key: 'G', scale: 'minor', strength: 0.9, camelot: '6A', chromagram: { data: [] } },
  energy: {
    energy_curve: { values: [0.2, 0.35, 0.5, 0.4, 0.85, 0.6, 0.3], hop_ms: 500 },
    structure_segments: [
      { start_ms: 0, end_ms: 48000, label: 'intro', confidence: 0.91 },
      { start_ms: 48000, end_ms: 130000, label: 'build', confidence: 0.86 },
      { start_ms: 130000, end_ms: 206000, label: 'breakdown', confidence: 0.93 },
      { start_ms: 206000, end_ms: 340000, label: 'drop', confidence: 0.95 },
      { start_ms: 340000, end_ms: 444000, label: 'outro', confidence: 0.89 },
    ],
    bass_entry_ms: 48000,
    onset_times_seconds: [],
  },
  semantics: {
    genre_top: [{ label: 'Electronic---Deep House', score: 0.72 }],
    style_top: [],
    mood_theme_top: [],
    instrument_top: [],
    mood_dimensions: { energy: 0.68 },
    danceability: 0.79,
    approachability: 0.5,
    voice_instrumental: 'instrumental',
    voice_score: 0.14,
    timbre_bright: 0.5,
    timbre_dark: 0.5,
    mood_acoustic: 0.2,
    mood_electronic: 0.8,
    valence: 0.42,
    arousal: 0.71,
  },
  spectral: {
    centroid_curve: { values: [] },
    rolloff_curve: { values: [] },
    flatness_curve: { values: [] },
    bandwidth_curve: { values: [] },
    zcr_curve: { values: [] },
    mel_spectrogram: { data: [] },
  },
  timeline: {
    genre_over_time: { series: [], hop_ms: 30000 },
    mood_over_time: { series: [], hop_ms: 30000 },
    instrument_over_time: { series: [], hop_ms: 30000 },
    voice_regions: [],
  },
  composition: { stems: {}, vocal_regions: [] },
  readings: {
    for_dj:
      'Long intro with a patient build to 2:10; the breakdown resets before a sustained peak from 3:26 to 5:40, then a clean two-minute outro. Tonal centre G minor (6A), steady 126 BPM.',
    for_producers:
      'Arrangement holds one harmonic centre and develops through texture and intensity rather than key movement; dynamics stay controlled (LRA 6.4) with the crest in the drop.',
    for_curators:
      'Reads as late-night and driving rather than euphoric: moderate valence, high arousal, instrumental. Pacing suits a sustained mid-set or focused playlist context.',
  },
};

const MOCK_ANALYSIS_RESULT_LONG = {
  ...MOCK_ANALYSIS_RESULT,
  identity: {
    ...MOCK_ANALYSIS_RESULT.identity,
    input_filename: 'undapartii_ambient_master.wav',
    duration_ms: 1_498_000,
  },
  rhythm: { bpm: 117.9, confidence: -0.04, beat_times_seconds: [], bar_count: 64 },
  energy: {
    energy_curve: {
      values: Array.from({ length: 120 }, (_, i) => 0.2 + 0.6 * Math.sin(i / 8)),
      hop_ms: 12_500,
    },
    structure_segments: Array.from({ length: 14 }, (_, i) => ({
      start_ms: i * 107_000,
      end_ms: (i + 1) * 107_000,
      label: i % 3 === 0 ? 'main' : i % 3 === 1 ? 'build' : 'breakdown',
      confidence: i === 2 ? -0.04 : 0.85,
    })),
    bass_entry_ms: 107_000,
    onset_times_seconds: [],
  },
  readings: { for_dj: '', for_producers: '', for_curators: '' },
};

async function installAnalysisMocks(page, { mode = 'idle', fixture = 'default' } = {}) {
  await page.route('**/api/v1/analysis/upload', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { analysis_id: MOCK_ANALYSIS_ID, track_uuid: '00000000-0000-4000-8000-000000000099' },
      }),
    }),
  );

  if (mode === 'processing') {
    await page.route(`**/api/v1/analysis/${MOCK_ANALYSIS_ID}/status`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { state: 'running', part1_ready: false, progress: { percent: 45 } },
        }),
      }),
    );
    return;
  }

  if (mode === 'failed') {
    await page.route(`**/api/v1/analysis/${MOCK_ANALYSIS_ID}/status`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { state: 'failed', error: 'Unsupported audio format for this test fixture.' },
        }),
      }),
    );
    return;
  }

  if (mode === 'summary' || mode === 'full-id') {
    await page.route(`**/api/v1/analysis/${MOCK_ANALYSIS_ID}/status`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            state: 'succeeded',
            part1_ready: true,
            progress: { percent: 100 },
            playlist_uuid: fixture === 'legacy' ? null : MOCK_PLAYLIST_FROM_ANALYSIS,
          },
        }),
      }),
    );
    const payload = fixture === 'long' ? MOCK_ANALYSIS_RESULT_LONG : MOCK_ANALYSIS_RESULT;
    await page.route(`**/api/v1/analysis/${MOCK_ANALYSIS_ID}/result`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: payload }),
      }),
    );
    await page.route(`**/api/v1/analysis/${MOCK_ANALYSIS_ID}/token`, (route) =>
      route.fulfill({ status: 404, body: '{}' }),
    );
  }
}

async function triggerAnalysisUpload(page) {
  await page.getByRole('region', { name: 'Analyse a track' }).locator('input[type="file"]').setInputFiles({
    name: 'gate-fixture.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF'),
  });
  await page.getByRole('button', { name: /analyse track/i }).click();
}

const STAGE4_TARGETS = [
  { file: 'stage4-discovery-input-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'discovery-input-search', signedIn: false, sourceTab: 'search' },
  { file: 'stage4-discovery-input-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'discovery-input-search', signedIn: false, sourceTab: 'search' },
  { file: 'stage4-analysis-upload-signed-in-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-signed-in', signedIn: true },
  { file: 'stage4-analysis-upload-signed-in-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-signed-in', signedIn: true },
  { file: 'stage4-analysis-processing-signed-in-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-processing', signedIn: true, analysisMode: 'processing' },
  { file: 'stage4-analysis-processing-signed-in-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-processing', signedIn: true, analysisMode: 'processing' },
  { file: 'stage4-analysis-summary-signed-in-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-summary', signedIn: true, analysisMode: 'summary' },
  { file: 'stage4-analysis-summary-signed-in-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-summary', signedIn: true, analysisMode: 'summary' },
  { file: 'stage4-analysis-failed-signed-in-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-failed', signedIn: true, analysisMode: 'failed' },
  { file: 'stage4-analysis-full-id-1440.png', url: `/analysis?id=${MOCK_ANALYSIS_ID}`, viewport: { width: 1440, height: 900 }, setup: 'analysis-full-id', signedIn: true, analysisMode: 'full-id' },
  { file: 'stage4-mobile-playlist-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-results', signedIn: false },
  { file: 'stage4-mobile-analysis-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-signed-in', signedIn: true },
];

const LONG_TITLE_FIXTURE = {
  ...MOCK_PLAYLIST_RESPONSE,
  data: {
    ...MOCK_PLAYLIST_RESPONSE.data,
    playlist: {
      ...MOCK_PLAYLIST_RESPONSE.data.playlist,
      name: 'GABRIELE MANCINO - A1 CANTICUM',
    },
    queried_track: {
      ...MOCK_PLAYLIST_RESPONSE.data.queried_track,
      title: 'GABRIELE MANCINO - A1 CANTICUM',
      artist: 'Gabriele Mancino',
    },
    similar_tracks: [],
  },
};

const UPLOAD_SEED_FIXTURE = {
  ...MOCK_PLAYLIST_RESPONSE,
  data: {
    ...MOCK_PLAYLIST_RESPONSE.data,
    playlist: { ...MOCK_PLAYLIST_RESPONSE.data.playlist, name: 'Upload Reference' },
    queried_track: {
      ...MOCK_PLAYLIST_RESPONSE.data.queried_track,
      title: 'Upload Reference',
      type: 'upload',
      deep_link_url: null,
      playback: 'hls',
    },
    similar_tracks: [],
  },
};

async function installLongTitlePlaylistMock(page) {
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LONG_TITLE_FIXTURE),
    }),
  );
}

async function installUploadSeedPlaylistMock(page) {
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(UPLOAD_SEED_FIXTURE),
    }),
  );
}

const STAGE48_TARGETS = [
  { file: 'stage48-mobile-header-healthy-guest-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-results-guest', signedIn: false, headerCapture: true },
  { file: 'stage48-mobile-header-healthy-guest-430.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 430, height: 932 }, setup: 'playlist-results-guest', signedIn: false, headerCapture: true },
  { file: 'stage48-mobile-header-healthy-signed-in-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-results-signed-in', signedIn: true, headerCapture: true },
  { file: 'stage48-mobile-header-long-title-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-long-title', signedIn: false, headerCapture: true },
  { file: 'stage48-mobile-header-error-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-playback-error', signedIn: false, headerCapture: true },
  { file: 'stage48-mobile-header-upload-no-apple-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-upload-seed', signedIn: false, headerCapture: true },
  { file: 'stage48-desktop-header-unchanged-1440.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1440, height: 900 }, setup: 'playlist-results-signed-in', signedIn: true, headerCapture: true },
];

const STAGE45_TARGETS = [
  { file: 'stage45-playlist-signed-in-1440.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1440, height: 1200 }, setup: 'playlist-results-signed-in', signedIn: true, trackCount: 12 },
  { file: 'stage45-playlist-signed-in-1280.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1280, height: 1200 }, setup: 'playlist-results-signed-in', signedIn: true, trackCount: 12 },
  { file: 'stage45-playlist-signed-in-1920.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1920, height: 1200 }, setup: 'playlist-results-signed-in', signedIn: true, trackCount: 12 },
  { file: 'stage45-playlist-guest-1440.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1440, height: 1200 }, setup: 'playlist-results-guest', signedIn: false },
  { file: 'stage45-playlist-playing-1440.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1440, height: 1200 }, setup: 'playlist-playing', signedIn: true, trackCount: 12 },
  { file: 'stage45-playlist-mobile-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-results-guest', signedIn: false, fullPage: true },
];

const STAGE43_TARGETS = [
  { file: 'stage43-playlist-results-guest-1440.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1440, height: 900 }, setup: 'playlist-results-guest', signedIn: false },
  { file: 'stage43-playlist-results-guest-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-results-guest', signedIn: false, fullPage: true },
  { file: 'stage43-playlist-results-signed-in-1440.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: { width: 1440, height: 900 }, setup: 'playlist-results', signedIn: true },
  { file: 'stage43-playlist-results-signed-in-393.png', url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, viewport: devices['iPhone 13'].viewport, setup: 'playlist-results', signedIn: true, fullPage: true },
];

const STAGE42_TARGETS = [
  ...STAGE4_TARGETS.map((t) => ({
    ...t,
    file: t.file.replace(/^stage4-/, 'stage42-'),
  })),
  {
    file: 'stage42-analysis-summary-long-track-1440.png',
    url: '/analysis',
    viewport: { width: 1440, height: 900 },
    setup: 'analysis-summary-long',
    signedIn: true,
    analysisMode: 'summary',
    analysisFixture: 'long',
  },
  {
    file: 'stage42-analysis-summary-legacy-sibling-1440.png',
    url: '/analysis',
    viewport: { width: 1440, height: 900 },
    setup: 'analysis-summary-legacy',
    signedIn: true,
    analysisMode: 'summary',
    analysisFixture: 'legacy',
  },
  {
    file: 'stage42-search-overlay-1440.png',
    url: '/sonic-discovery',
    viewport: { width: 1440, height: 900 },
    setup: 'search-overlay',
    signedIn: true,
  },
];

const STAGE5_TARGETS = [
  { file: 'stage5-workspace-rail-signed-in-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'shell', signedIn: true },
  { file: 'stage5-workspace-rail-signed-in-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'shell', signedIn: true },
];

const BASELINE_TARGETS = [
  { file: 'baseline-discovery-1440.png', url: '/', viewport: { width: 1440, height: 900 }, setup: 'shell', signedIn: false },
  { file: 'baseline-discovery-393.png', url: '/', viewport: devices['iPhone 13'].viewport, setup: 'shell', signedIn: false },
  { file: 'baseline-playlist-empty-1440.png', url: '/sonic-discovery', viewport: { width: 1440, height: 900 }, setup: 'shell', signedIn: false },
  { file: 'baseline-playlist-empty-393.png', url: '/sonic-discovery', viewport: devices['iPhone 13'].viewport, setup: 'shell', signedIn: false },
  { file: 'baseline-analysis-redirect-1440.png', url: '/analysis', viewport: { width: 1440, height: 900 }, setup: 'analysis-gate', signedIn: false },
  { file: 'baseline-analysis-redirect-393.png', url: '/analysis', viewport: devices['iPhone 13'].viewport, setup: 'analysis-gate', signedIn: false },
];

const targets =
  mode === 'baseline'
    ? BASELINE_TARGETS
    : mode === 'stage4.8'
      ? STAGE48_TARGETS
    : mode === 'stage4.5'
      ? STAGE45_TARGETS
    : mode === 'stage4.3'
      ? STAGE43_TARGETS
    : mode === 'stage4.2'
      ? STAGE42_TARGETS
      : mode === 'stage4'
        ? STAGE4_TARGETS
        : mode === 'stage5'
        ? STAGE5_TARGETS
        : mode === 'stage3.1'
        ? STAGE31_TARGETS
        : mode === 'stage3'
          ? STAGE3_TARGETS
          : mode === 'stage2'
            ? STAGE2_TARGETS
            : STAGE1_TARGETS;

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const manifest = [];

for (const target of targets) {
  const context = await browser.newContext({ viewport: target.viewport });
  const page = await context.newPage();
  await seedProfile(page, { signedIn: target.signedIn });
  await installApiMocks(page, { signedIn: target.signedIn });
  if (target.setup === 'playlist-results' || target.setup === 'playlist-results-guest' || target.setup === 'playlist-results-signed-in' || target.setup === 'playlist-playing' || target.setup === 'playlist-long-title' || target.setup === 'playlist-upload-seed' || target.setup === 'playlist-playback-error') {
    if (target.setup === 'playlist-results-guest' || (target.setup === 'playlist-playing' && !target.signedIn) || target.setup === 'playlist-playback-error') {
      if (target.setup === 'playlist-playback-error') {
        await installGuestPlaylistMock(page);
        await page.addInitScript(() => {
          sessionStorage.setItem('resomix-e2e-force-playback-error', '1');
        });
      } else {
        await installGuestPlaylistMock(page);
      }
    } else if (target.setup === 'playlist-results-signed-in' || target.setup === 'playlist-playing') {
      await installSignedInPlaylistMock(page, target.trackCount ?? 12);
    } else if (target.setup === 'playlist-long-title') {
      await installLongTitlePlaylistMock(page);
    } else if (target.setup === 'playlist-upload-seed') {
      await installUploadSeedPlaylistMock(page);
    } else {
      await installPlaylistMock(page);
    }
  }
  if (target.analysisMode) {
    await installAnalysisMocks(page, { mode: target.analysisMode, fixture: target.analysisFixture || 'default' });
  } else if (target.setup?.startsWith('analysis-') && target.signedIn && target.setup !== 'analysis-gate') {
    await installAnalysisMocks(page, { mode: 'idle' });
  }

  const fullUrl = `${BASE_URL}${target.url}`;
  await page.goto(fullUrl, { waitUntil: 'networkidle' });
  await assertAppFingerprint(page);
  await page.waitForTimeout(800);
  await dismissOverlays(page);

  if (target.setup === 'reference-depth-guest' || target.setup === 'reference-depth-signed-in') {
    await selectReferenceExample(page, { signedIn: target.signedIn });
  } else if (target.setup === 'processing') {
    await showProcessingPanel(page);
  } else if (target.setup === 'playlist-results' || target.setup === 'playlist-results-guest' || target.setup === 'playlist-results-signed-in' || target.setup === 'playlist-playing' || target.setup === 'playlist-long-title' || target.setup === 'playlist-upload-seed' || target.setup === 'playlist-playback-error') {
    const headingPattern =
      target.setup === 'playlist-long-title'
        ? /gabriele mancino/i
        : target.setup === 'playlist-upload-seed'
          ? /upload reference/i
          : /nocturne transit/i;
    await page.getByRole('heading', { name: headingPattern }).waitFor({ state: 'visible' });
    if (target.headerCapture) {
      const heading = page.locator('#playlist-results-heading');
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    } else if (target.setup !== 'playlist-playback-error') {
      await scrollPlaylistTableIntoView(page);
    } else {
      await page.locator('#playlist-results-heading').scrollIntoViewIfNeeded();
    }
    if (target.viewport.width >= 768 && target.setup !== 'playlist-playing') {
      await assertDesktopPlaylistRowsHorizontal(page);
    }
    if (target.setup === 'playlist-playing') {
      await seedPlayingRow(page);
      await scrollPlaylistTableIntoView(page);
    }
    await page.waitForTimeout(800);
  } else if (target.setup === 'analysis-processing' || target.setup === 'analysis-failed') {
    await page.getByRole('region', { name: 'Analyse a track' }).getByText(/drop a track to analyse/i).waitFor({ state: 'visible' });
    await triggerAnalysisUpload(page);
    if (target.setup === 'analysis-processing') {
      await page.getByText(/pyxis-1 full analysis/i).first().waitFor({ state: 'visible' });
    } else {
      await page.getByText(/analysis failed/i).first().waitFor({ state: 'visible' });
    }
    await page.waitForTimeout(600);
  } else if (target.setup === 'analysis-summary' || target.setup === 'analysis-summary-long' || target.setup === 'analysis-summary-legacy') {
    await page.getByRole('region', { name: 'Analyse a track' }).getByText(/drop a track to analyse/i).waitFor({ state: 'visible' });
    await triggerAnalysisUpload(page);
    await page.getByText(/analysis complete/i).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(800);
  } else if (target.setup === 'search-overlay') {
    await page.route('**/api/v1/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tracks: Array.from({ length: 35 }, (_, i) => ({
              id: 9000 + i,
              title: `Fixture Track ${i + 1}`,
              artist: 'Gate Artist',
              duration: 240 + i,
            })),
          },
        }),
      }),
    );
    const search = page.getByRole('combobox', { name: /search the resomix index/i });
    await search.fill('hi');
    await page.getByRole('listbox', { name: 'Matches' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
  } else if (target.setup === 'analysis-full-id') {
    await page.getByText(/analysis/i).first().waitFor({ state: 'visible' });
    await page.waitForTimeout(1500);
  } else if (target.sourceTab === 'upload') {
    await page.getByRole('tab', { name: /upload a reference/i }).click();
    await page.getByText(/drop a reference file/i).waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
  } else {
    await page.waitForTimeout(400);
  }

  const outPath = path.join(OUT_DIR, target.file);
  await labelAndShot(page, outPath, fullUrl, { fullPage: !!target.fullPage });

  const bodyText = await page.locator('body').innerText();
  manifest.push({
    file: target.file,
    url: fullUrl,
    viewport: target.viewport,
    title: await page.title(),
    setup: target.setup,
    signedIn: target.signedIn,
    renderOk: bodyRenderOk(bodyText, target.setup),
  });

  await context.close();
}

await browser.close();
await writeFile(
  path.join(OUT_DIR, `${mode}-capture-manifest.json`),
  JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl: BASE_URL, mode, appTitle: APP_TITLE, shots: manifest }, null, 2),
);

const failed = manifest.filter((shot) => !shot.renderOk);
if (failed.length > 0) {
  console.error(JSON.stringify({ failed, manifest }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(manifest, null, 2));
