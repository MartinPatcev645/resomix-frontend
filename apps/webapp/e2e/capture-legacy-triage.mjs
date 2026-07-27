/**
 * Stage 4.10 legacy page triage captures at 1920.
 * Usage: BASE_URL=http://127.0.0.1:5190 node e2e/capture-legacy-triage.mjs pre|post
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../../docs/page-demos/workspace/stage410-legacy-triage');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5190';
const label = process.argv[2] || 'post';

const CONSENT_KEYS = [
  'silktideCookieBanner_closed',
  'stcm.consent.essential',
  'stcm.consent.analytics',
  'stcm.consent.functional',
];

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
    for (const key of keys) localStorage.setItem(key, 'true');
    localStorage.setItem('demo_stage_notice_dismissed', 'true');
    localStorage.setItem('workspace_loop_strip_dismissed', 'true');
    document.cookie = 'resomix_terms_accepted=1; path=/; SameSite=Lax';
    if (authUser && authToken) {
      sessionStorage.setItem('resomix-access-token', authToken);
      localStorage.setItem(
        'resomix-auth-storage',
        JSON.stringify({ ts: Date.now(), tabId: 'capture', payload: JSON.stringify({ state: { user: authUser, isAuthenticated: true }, version: 1 }) }),
      );
    }
  }, { keys: CONSENT_KEYS, authUser: signedIn ? CAPTURE_USER : null, authToken: signedIn ? makeJwt(CAPTURE_USER.uuid) : null });
}

async function installMocks(page, { signedIn = false } = {}) {
  await page.route('**/api/v1/entitlements/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          is_frontend: true,
          is_guest: !signedIn,
          plan: { code: signedIn ? 'free' : 'guest', name: signedIn ? 'Free' : 'Guest', is_default: !signedIn },
          entitlements: { dropdown_max_tracks: 50, max_tracks_per_playlist: 20 },
        },
      }),
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
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user: CAPTURE_USER } }) }),
    );
    await page.route('**/api/v1/users/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: CAPTURE_USER }) }),
    );
    await page.route('**/api/v1/tracks/my-tracks**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
    );
  }
}

const TARGETS = [
  { file: `${label}-library-1920.png`, url: '/library', signedIn: true },
  { file: `${label}-auth-login-1920.png`, url: '/auth/login', signedIn: false },
  { file: `${label}-profile-1920.png`, url: '/profile', signedIn: true },
  { file: `${label}-sessions-1920.png`, url: '/sessions', signedIn: true },
  { file: `${label}-analysis-full-1920.png`, url: '/analysis?id=f47ac10b-58cc-4372-a567-0e02b2c3d479', signedIn: true, analysis: true },
  { file: `${label}-contact-1920.png`, url: '/contact', signedIn: false },
];

const MOCK_ANALYSIS = {
  identity: { input_filename: 'gate-fixture.wav', duration_ms: 444000, sample_rate_hz: 44100, bit_rate: 320000, channel_count: 2, codec: 'wav' },
  technical: { integrated_loudness_lufs: -8.2, loudness_range_lu: 6.4, true_peak_dbtp: -1.2 },
  rhythm: { bpm: 126, confidence: 0.94, beat_times_seconds: [], bar_count: 32 },
  tonality: { key: 'G', scale: 'minor', strength: 0.9, camelot: '6A', chromagram: { data: [] } },
  energy: { energy_curve: { values: [0.2, 0.5, 0.8], hop_ms: 500 }, structure_segments: [], bass_entry_ms: 48000, onset_times_seconds: [] },
  semantics: { genre_top: [{ label: 'Electronic---Deep House', score: 0.72 }], style_maest_top: [], mood_theme_top: [], instrument_top: [], mood_dimensions: { energy: 0.68 }, danceability: 0.79, approachability: 0.5, voice_instrumental: 'instrumental', voice_score: 0.14, timbre_bright: 0.5, timbre_dark: 0.5, mood_acoustic: 0.2, mood_electronic: 0.8, valence: 0.42, arousal: 0.71 },
  spectral: { centroid_curve: { values: [] }, rolloff_curve: { values: [] }, flatness_curve: { values: [] }, bandwidth_curve: { values: [] }, zcr_curve: { values: [] }, mel_spectrogram: { data: [] } },
  timeline: { genre_over_time: { series: [], hop_ms: 30000 }, mood_over_time: { series: [], hop_ms: 30000 }, instrument_over_time: { series: [], hop_ms: 30000 }, voice_regions: [] },
  composition: { stems: {}, vocal_regions: [] },
  readings: { for_dj: 'Fixture reading.', for_producers: 'Fixture reading.', for_curators: 'Fixture reading.' },
};

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

for (const target of TARGETS) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await seedProfile(page, { signedIn: target.signedIn });
  await installMocks(page, { signedIn: target.signedIn });
  if (target.analysis) {
    const id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    await page.route(`**/api/v1/analysis/${id}/status`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { state: 'succeeded', part1_ready: true, progress: { percent: 100 } } }) }),
    );
    await page.route(`**/api/v1/analysis/${id}/result`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: MOCK_ANALYSIS }) }),
    );
    await page.route(`**/api/v1/analysis/${id}/token`, (route) => route.fulfill({ status: 404, body: '{}' }));
  }
  await page.goto(`${BASE_URL}${target.url}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, target.file), fullPage: true });
  await context.close();
}

await browser.close();
console.log(`Legacy triage ${label} captures written to ${OUT_DIR}`);
