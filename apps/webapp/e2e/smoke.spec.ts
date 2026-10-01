import { test, expect } from '@playwright/test'

const APP_TITLE = 'Resomix Sonic Discovery - Beta'

async function dismissConsent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove()
    document.getElementById('stcm-backdrop')?.remove()
  })
}

function seedConsentStorage() {
  localStorage.setItem('silktideCookieBanner_closed', '1')
  localStorage.setItem('demo_stage_notice_dismissed', 'true')
  localStorage.setItem('workspace_loop_strip_dismissed', 'true')
  document.cookie = 'resomix_terms_accepted=1; path=/; SameSite=Lax'
  for (const key of ['essential', 'analytics', 'functional']) {
    localStorage.setItem(`stcm.consent.${key}`, 'true')
  }
}

async function assertWebappFingerprint(page: import('@playwright/test').Page) {
  await expect(page).toHaveTitle(APP_TITLE)
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
          entitlements: { dropdown_max_tracks: 20 },
        },
      }),
    }),
  )
}

test('discovery workspace renders', async ({ page }) => {
  await page.addInitScript(seedConsentStorage)
  await mockGuestSession(page)
  await page.goto('/sonic-discovery')
  await assertWebappFingerprint(page)
  await dismissConsent(page)
  await expect(page.getByRole('heading', { name: /start with a track/i })).toBeVisible()
})

test('analysis gate sign-in preserves return path', async ({ page }) => {
  await page.addInitScript(seedConsentStorage)
  await mockGuestSession(page)
  await page.goto('/analysis')
  await assertWebappFingerprint(page)
  await dismissConsent(page)
  const signInLink = page.getByRole('link', { name: /sign in to analyse a track/i })
  await expect(signInLink).toBeVisible()
  await expect(signInLink).toHaveAttribute('href', '/auth/login?redirect=%2Fanalysis')
})

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
          entitlements: { uploads_per_month: 3, dropdown_max_tracks: 50 },
        },
      }),
    }),
  )
}

test('signed-in analysis workspace shows upload panel', async ({ page }) => {
  await page.addInitScript(seedConsentStorage)
  await mockSignedInSession(page)
  await page.goto('/analysis')
  await assertWebappFingerprint(page)
  await dismissConsent(page)
  await expect(page.getByRole('region', { name: 'Analyse a track' }).getByText(/drop a track to analyse/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /analyse track/i })).toBeVisible()
})

test('analysis deep link renders full dashboard outside workspace shell', async ({ page }) => {
  const analysisId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  await page.addInitScript(seedConsentStorage)
  await mockSignedInSession(page)
  await page.route(`**/api/v1/analysis/${analysisId}/status`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { state: 'failed', error: 'Fixture — not a real analysis' },
      }),
    }),
  )
  await page.goto(`/analysis?id=${analysisId}`)
  await assertWebappFingerprint(page)
  await dismissConsent(page)
  await expect(page.getByRole('heading', { name: /^analysis$/i })).toBeVisible()
  await expect(page.getByText(/start with a track/i)).not.toBeVisible()
})

test('playlist uuid deep link on sonic-discovery keeps workspace shell', async ({ page }) => {
  const playlistId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
  await page.addInitScript(seedConsentStorage)
  await mockGuestSession(page)
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          playlist: { id: playlistId, name: 'Gate Fixture', is_public: false, is_owner: false, has_custom_cover: false },
          queried_track: {
            rank: 0,
            score: 1,
            id: '100001',
            title: 'Gate Fixture',
            artist: 'Fixture Artist',
            year: 2024,
            duration: 240,
            label: 'Test',
            type: 'internal',
          },
          similar_tracks: [],
        },
      }),
    }),
  )
  await page.goto(`/sonic-discovery?id=${playlistId}`)
  await assertWebappFingerprint(page)
  await dismissConsent(page)
  await expect(page.getByRole('heading', { name: 'Start with a track.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /gate fixture/i })).toBeVisible()
})

test('analysis summary always shows reading tabs', async ({ page }) => {
  const analysisId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  await page.addInitScript(seedConsentStorage)
  await mockSignedInSession(page)
  await page.route('**/api/v1/analysis/upload', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { analysis_id: analysisId } }),
    }),
  )
  await page.route(`**/api/v1/analysis/${analysisId}/status`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { state: 'succeeded', part1_ready: true, progress: { percent: 100 }, playlist_uuid: null },
      }),
    }),
  )
  await page.route(`**/api/v1/analysis/${analysisId}/result`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          identity: { input_filename: 'gate.wav', duration_ms: 240000 },
          rhythm: { bpm: 120, confidence: -0.04 },
          tonality: { camelot: '8A', key: 'A', scale: 'minor', strength: 0.5, chromagram: { data: [] } },
          technical: { integrated_loudness_lufs: -10, loudness_range_lu: 5 },
          energy: { energy_curve: { values: [0.1, 0.5, 0.3], hop_ms: 80000 }, structure_segments: [] },
          semantics: { genre_top: [], style_top: [], mood_theme_top: [], instrument_top: [], mood_dimensions: {} },
          spectral: { centroid_curve: { values: [] }, rolloff_curve: { values: [] }, flatness_curve: { values: [] }, bandwidth_curve: { values: [] }, zcr_curve: { values: [] }, mel_spectrogram: { data: [] } },
          timeline: { genre_over_time: { series: [], hop_ms: 1 }, mood_over_time: { series: [], hop_ms: 1 }, instrument_over_time: { series: [], hop_ms: 1 }, voice_regions: [] },
          composition: { stems: {}, vocal_regions: [] },
          readings: { for_dj: '', for_producers: '', for_curators: '' },
        },
      }),
    }),
  )
  await page.goto('/analysis')
  await assertWebappFingerprint(page)
  await dismissConsent(page)
  await page.getByRole('region', { name: 'Analyse a track' }).locator('input[type="file"]').setInputFiles({
    name: 'gate.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF'),
  })
  await page.getByRole('button', { name: /analyse track/i }).click()
  await expect(page.getByText(/analysis complete/i)).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('tab', { name: /for djs/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Find similar tracks', exact: true })).toBeDisabled()
})

test('workspace search uses combobox overlay', async ({ page }) => {
  await page.addInitScript(seedConsentStorage)
  await mockGuestSession(page)
  await page.route('**/api/v1/search**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { tracks: [{ id: 1, title: 'Overlay Track', artist: 'Artist', duration: 200 }] },
      }),
    }),
  )
  await page.goto('/sonic-discovery')
  await dismissConsent(page)
  const combo = page.getByRole('combobox', { name: /search the resomix index/i })
  await combo.fill('hi')
  await expect(page.getByRole('listbox', { name: 'Matches' })).toBeVisible()
})

function guestPlaylistFixture(trackCount = 15) {
  const playlistId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
  return {
    playlistId,
    body: {
      success: true,
      data: {
        playlist: {
          id: playlistId,
          name: 'Gate Fixture',
          is_public: false,
          is_owner: false,
          has_custom_cover: false,
        },
        queried_track: {
          rank: 0,
          score: 1,
          id: '100001',
          title: 'Gate Fixture',
          artist: 'Fixture Artist',
          year: 2024,
          duration: 240,
          label: 'Test',
          type: 'internal',
        },
        similar_tracks: Array.from({ length: trackCount }, (_, i) => ({
          rank: i + 1,
          score: 0.95 - i * 0.01,
          id: String(300001 + i),
          title: `Match ${i + 1}`,
          artist: 'Fixture Artist',
          year: 2024,
          duration: 240,
          label: 'Test',
          type: 'internal',
          genre: 'Electronic---Deep House',
        })),
      },
    },
  }
}

test('guest playlist shows floating unlock panel over blurred locked rows', async ({ page }) => {
  const fixture = guestPlaylistFixture(15)
  await page.addInitScript(seedConsentStorage)
  await mockGuestSession(page)
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
          entitlements: {
            dropdown_max_tracks: 20,
            max_tracks_per_playlist: 10,
          },
        },
      }),
    }),
  )
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture.body),
    }),
  )
  await page.goto(`/sonic-discovery?id=${fixture.playlistId}`)
  await dismissConsent(page)
  const resultsTable = page.getByRole('table', { name: 'Similar tracks' })
  await expect(resultsTable).toHaveCount(1)
  await expect(page.getByTestId('playlist-unlock-panel')).toBeVisible()
  await expect(page.getByTestId('playlist-unlock-panel')).toHaveCount(1)
  await expect(page.getByTestId('playlist-unlock-band')).toHaveCount(0)
  await expect(page.getByTestId('playlist-locked-blur')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByRole('button', { name: /create free account/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^log in$/i })).toBeVisible()
  const blurContainer = page.getByTestId('playlist-locked-blur')
  await expect(blurContainer).toHaveCSS('filter', /blur/)
  await expect(resultsTable.locator('[id^="playlist-table-play-button-"]')).toHaveCount(10)
  const lockedRegion = page.getByTestId('playlist-locked-region')
  await expect(lockedRegion.locator('.playlist-play-button')).toHaveCount(5)
})

test('discovery submit surfaces session expired modal and keeps reference state', async ({ page }) => {
  await page.addInitScript(seedConsentStorage)
  await mockSignedInSession(page)
  let failRefresh = false
  await page.route('**/api/v1/auth/refresh', (route) => {
    if (failRefresh) {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Session expired' }),
      })
      return
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { access_token: 'e2e-test-token' } }),
    })
  })
  await page.route('**/api/v1/search**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          tracks: [{ id: 42, title: 'Hold State Track', artist: 'Artist', duration: 210, label: 'Test' }],
        },
      }),
    }),
  )
  await page.route('**/api/v1/similarity/search**', (route) => {
    failRefresh = true
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Unauthorized' }),
    })
  })
  await page.goto('/sonic-discovery')
  await dismissConsent(page)
  const combo = page.getByRole('combobox', { name: /search the resomix index/i })
  await combo.fill('hold')
  await expect(page.getByRole('listbox', { name: 'Matches' })).toBeVisible()
  await page.getByRole('option', { name: /hold state track/i }).click()
  await expect(page.getByText('Hold State Track')).toBeVisible()
  await page.getByRole('button', { name: 'Find similar tracks', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('Session expired')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Hold State Track')).toBeVisible()
  await expect(page.getByText(/monthly free limit reached/i)).not.toBeVisible()
})
