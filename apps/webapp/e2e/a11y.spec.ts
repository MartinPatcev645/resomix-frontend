import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const APP_TITLE = 'Resomix Sonic Discovery - Beta'
const MOCK_PLAYLIST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

function seedConsentStorage() {
  localStorage.setItem('silktideCookieBanner_closed', '1')
  localStorage.setItem('demo_stage_notice_dismissed', 'true')
  localStorage.setItem('workspace_loop_strip_dismissed', 'true')
  document.cookie = 'resomix_terms_accepted=1; path=/; SameSite=Lax'
  for (const key of ['essential', 'analytics', 'functional']) {
    localStorage.setItem(`stcm.consent.${key}`, 'true')
  }
}

async function dismissConsent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove()
    document.getElementById('stcm-backdrop')?.remove()
  })
}

async function mockGuestSession(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'No session' }),
    }),
  )
  await page.route('**/api/v1/entitlements/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          is_frontend: true,
          is_guest: true,
          plan: { code: 'guest', name: 'Guest', is_default: true },
          entitlements: { dropdown_max_tracks: 20, max_tracks_per_playlist: 10 },
        },
      }),
    }),
  )
}

async function mockSignedInSession(page: import('@playwright/test').Page) {
  const user = {
    id: 1,
    uuid: '00000000-0000-4000-8000-000000000001',
    email: 'e2e@test.local',
    username: 'e2e',
    is_email_verified: true,
  }
  await page.addInitScript(({ u }) => {
    sessionStorage.setItem('resomix-access-token', 'e2e-test-token')
    localStorage.setItem(
      'resomix-auth-storage',
      JSON.stringify({
        ts: Date.now(),
        tabId: 'e2e',
        payload: JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 1 }),
      }),
    )
  }, { u: user })
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { access_token: 'e2e-test-token' } }),
    }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user } }),
    }),
  )
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: user }),
    }),
  )
  await page.route('**/api/v1/entitlements/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          is_frontend: true,
          is_guest: false,
          plan: { code: 'free', name: 'Free', is_default: false },
          entitlements: { max_tracks_per_playlist: 20, dropdown_max_tracks: 50 },
        },
      }),
    }),
  )
}

function guestPlaylistFixture(trackCount = 15) {
  return {
    success: true,
    data: {
      playlist: {
        id: MOCK_PLAYLIST_ID,
        name: 'Nocturne Transit',
        is_public: false,
        is_owner: false,
        has_custom_cover: false,
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
      similar_tracks: Array.from({ length: trackCount }, (_, i) => ({
        rank: i + 1,
        score: 0.98 - i * 0.012,
        id: String(300001 + i),
        title: `Match ${i + 1}`,
        artist: 'Fixture Artist',
        year: 2024,
        duration: 240,
        label: 'Vireo Ltd',
        type: 'internal',
        genre: 'Electronic---Deep House',
        deep_link_url: i % 2 === 0 ? 'https://music.apple.com/example' : null,
      })),
    },
  }
}

/** Pre-existing on playlist hero (heart icon inside gated favorite button) — not introduced by Stage 4.4. */
const PLAYLIST_BASELINE_IDS = new Set(['nested-interactive'])

function assertNoNewViolations(
  results: Awaited<ReturnType<AxeBuilder['analyze']>>,
  baselineIds: Set<string>,
) {
  const merged = new Set([...baselineIds, ...PLAYLIST_BASELINE_IDS])
  const novel = results.violations.filter((v) => !merged.has(v.id))
  expect(novel, JSON.stringify(novel, null, 2)).toEqual([])
}

test.describe.serial('workspace a11y gates', () => {
  const homeBaselineIds = new Set<string>()

  test('home route baseline', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    for (const v of results.violations) homeBaselineIds.add(v.id)
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('guest gated playlist has no new a11y violations', async ({ page }) => {
    await page.addInitScript(seedConsentStorage)
    await mockGuestSession(page)
    await page.route('**/api/v1/playlists/similarity/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(guestPlaylistFixture(15)),
      }),
    )
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto(`/sonic-discovery?id=${MOCK_PLAYLIST_ID}`)
    await expect(page).toHaveTitle(APP_TITLE)
    await dismissConsent(page)
    await expect(page.getByRole('region', { name: 'Similar tracks' })).toHaveCount(1)
    await expect(page.getByTestId('playlist-unlock-band')).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    assertNoNewViolations(results, homeBaselineIds)
  })

  test('signed-in playlist has no new a11y violations', async ({ page }) => {
    await page.addInitScript(seedConsentStorage)
    await mockSignedInSession(page)
    await page.route('**/api/v1/playlists/similarity/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...guestPlaylistFixture(8),
          data: {
            ...guestPlaylistFixture(8).data,
            playlist: {
              id: MOCK_PLAYLIST_ID,
              name: 'Nocturne Transit',
              is_public: false,
              is_owner: true,
              has_custom_cover: false,
              is_favorite: false,
            },
          },
        }),
      }),
    )
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto(`/sonic-discovery?id=${MOCK_PLAYLIST_ID}`)
    await expect(page).toHaveTitle(APP_TITLE)
    await dismissConsent(page)
    await expect(page.getByRole('region', { name: 'Similar tracks' })).toHaveCount(1)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    assertNoNewViolations(results, homeBaselineIds)
  })
})
