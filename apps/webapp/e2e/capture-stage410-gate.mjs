/**
 * Stage 4.10 workspace parity gate captures at 1440 / 1920 / 2560.
 * Usage: BASE_URL=http://127.0.0.1:5191 node e2e/capture-stage410-gate.mjs
 */
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../../docs/page-demos/workspace/stage410-gate');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5190';
const MOCK_PLAYLIST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

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
    entitlements: { dropdown_max_tracks: 20, max_tracks_per_playlist: 10 },
  },
};

async function seed(page) {
  await page.addInitScript(({ keys }) => {
    for (const key of keys) localStorage.setItem(key, 'true');
    localStorage.setItem('demo_stage_notice_dismissed', 'true');
    localStorage.setItem('workspace_loop_strip_dismissed', 'true');
    document.cookie = 'resomix_terms_accepted=1; path=/; SameSite=Lax';
  }, { keys: CONSENT_KEYS });
  await page.route('**/api/v1/entitlements/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GUEST_ENTITLEMENTS) }),
  );
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false }) }),
  );
}

async function installPlaylist(page) {
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          playlist: { id: MOCK_PLAYLIST_ID, name: 'Nocturne Transit', is_public: false, is_owner: false, has_custom_cover: false },
          queried_track: { rank: 0, score: 1, id: '100001', title: 'Nocturne Transit', artist: 'Vela Kasm', year: 2024, duration: 402, label: 'Vireo Ltd', type: 'internal', deep_link_url: 'https://music.apple.com/example' },
          similar_tracks: Array.from({ length: 8 }, (_, i) => ({
            rank: i + 1,
            score: 0.98 - i * 0.01,
            id: String(200001 + i),
            title: `Fixture ${i + 1}`,
            artist: 'Fixture Artist',
            year: 2024,
            duration: 240,
            label: 'Vireo Ltd',
            type: 'internal',
            playback: 'preview',
          })),
        },
      }),
    }),
  );
}

const WIDTHS = [1440, 1920, 2560];
const TARGETS = [
  ...WIDTHS.map((w) => ({ file: `gate-discovery-empty-${w}.png`, url: '/sonic-discovery', width: w, setup: 'empty' })),
  ...WIDTHS.map((w) => ({ file: `gate-discovery-reference-${w}.png`, url: '/sonic-discovery', width: w, setup: 'reference' })),
  ...WIDTHS.map((w) => ({ file: `gate-playlist-${w}.png`, url: `/sonic-discovery?id=${MOCK_PLAYLIST_ID}`, width: w, setup: 'playlist' })),
  { file: 'gate-discovery-empty-1280.png', url: '/sonic-discovery', width: 1280, setup: 'empty' },
  { file: 'gate-mobile-discovery-393.png', url: '/sonic-discovery', width: devices['iPhone 13'].viewport.width, height: devices['iPhone 13'].viewport.height, setup: 'empty', mobile: true },
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const manifest = [];

for (const target of TARGETS) {
  const viewport = target.mobile
    ? { width: target.width, height: target.height }
    : { width: target.width, height: 900 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await seed(page);
  if (target.setup === 'playlist') await installPlaylist(page);

  await page.goto(`${BASE_URL}${target.url}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
  });
  await page.waitForTimeout(600);

  if (target.setup === 'reference') {
    await page.getByRole('button', { name: /try an example/i }).click();
    await page.getByText(/log in to unlock deeper results/i).waitFor({ state: 'visible' });
  } else if (target.setup === 'playlist') {
    await page.getByRole('heading', { name: /nocturne transit/i }).waitFor({ state: 'visible' });
  }

  const metrics = await page.evaluate(() => {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const container = document.querySelector('.webapp-approved-container');
    const box = container?.getBoundingClientRect();
    return {
      rootFontPx: root,
      containerWidth: box?.width ?? null,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  await page.screenshot({ path: path.join(OUT_DIR, target.file), fullPage: target.mobile });
  manifest.push({ file: target.file, ...metrics });
  await context.close();
}

await browser.close();
await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
