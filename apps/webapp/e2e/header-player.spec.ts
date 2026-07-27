import { test, expect } from '@playwright/test'

const MOCK_PLAYLIST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const LONG_TITLE = 'GABRIELE MANCINO - A1 CANTICUM'

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

function playlistFixture(opts: {
  name?: string
  type?: string
  deepLinkUrl?: string | null
  playback?: string
}) {
  const {
    name = LONG_TITLE,
    type = 'internal',
    deepLinkUrl = 'https://music.apple.com/example',
    playback = type === 'upload' ? 'hls' : 'preview',
  } = opts
  return {
    success: true,
    data: {
      playlist: {
        id: MOCK_PLAYLIST_ID,
        name,
        is_public: false,
        is_owner: false,
        has_custom_cover: false,
      },
      queried_track: {
        rank: 0,
        score: 1,
        id: '100001',
        title: name,
        artist: 'Gabriele Mancino',
        year: 2024,
        duration: 402,
        label: 'Test Label',
        type,
        deep_link_url: deepLinkUrl,
        playback,
      },
      similar_tracks: [],
    },
  }
}

async function openPlaylist(page: import('@playwright/test').Page, fixture: ReturnType<typeof playlistFixture>) {
  await page.route('**/api/v1/playlists/similarity/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    }),
  )
  await page.goto(`/sonic-discovery?id=${MOCK_PLAYLIST_ID}`)
  await dismissConsent(page)
  const heading = page.locator('#playlist-results-heading')
  await heading.scrollIntoViewIfNeeded()
  await expect(heading).toContainText(fixture.data.playlist.name.slice(0, 12))
}

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
}

test.describe('header player card (Stage 4.7 desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedConsentStorage)
    await mockGuestSession(page)
  })

  for (const width of [1440, 1280, 1024]) {
    test(`long title truncates with ellipsis at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openPlaylist(page, playlistFixture({}))

      const heading = page.locator('#playlist-results-heading')
      await expect(heading).toHaveAttribute('title', LONG_TITLE)

      const truncated = await heading.evaluate((el) => {
        const style = getComputedStyle(el)
        return {
          overflow: style.overflow,
          textOverflow: style.textOverflow,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          endsWithEllipsis: el.textContent?.includes('…') || el.textContent?.endsWith('...') || el.scrollWidth > el.clientWidth,
        }
      })
      expect(truncated.overflow).toBe('hidden')
      expect(truncated.textOverflow).toBe('ellipsis')
      expect(truncated.endsWithEllipsis || truncated.scrollWidth >= truncated.clientWidth).toBeTruthy()
      await expect(heading).not.toContainText('A1 CANTI(')
    })
  }

  test('Apple Music badge in player row for catalogue seed with deep link', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openPlaylist(page, playlistFixture({ deepLinkUrl: 'https://music.apple.com/example' }))

    const player = page.getByTestId('input-player')
    const badge = player.getByRole('link', { name: 'Listen on Apple Music' })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveAttribute('href', 'https://music.apple.com/example')
  })

  test('no Apple Music badge for upload seed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openPlaylist(page, playlistFixture({ type: 'upload', deepLinkUrl: null }))

    const player = page.getByTestId('input-player')
    await expect(player.getByRole('link', { name: 'Listen on Apple Music' })).toHaveCount(0)
  })

  test('player row shows elapsed-only time (no total duration slash)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openPlaylist(page, playlistFixture({}))

    const player = page.getByTestId('input-player')
    const timeText = await player.locator('time').innerText()
    expect(timeText).toMatch(/^\d+:\d{2}$/)
    expect(timeText).not.toContain('/')
  })

  test('header player row anatomy at 1280', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openPlaylist(page, playlistFixture({}))

    const player = page.getByTestId('input-player')
    await expect(player.locator('#input-player-play-pause')).toBeVisible()
    await expect(player.getByRole('slider', { name: 'Seek' })).toBeVisible()
    await expect(player.locator('time')).toBeVisible()
    await expect(player.getByRole('button', { name: 'Skip back 10 seconds' })).toBeVisible()
    await expect(player.getByRole('button', { name: 'Skip forward 10 seconds' })).toBeVisible()
    await expect(player.getByRole('slider', { name: 'Volume' })).toBeVisible()
    await expect(player.getByRole('link', { name: 'Listen on Apple Music' })).toBeVisible()
  })
})

test.describe('header player card (Stage 4.8 mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedConsentStorage)
    await mockGuestSession(page)
  })

  for (const width of [393, 430]) {
    test(`mobile toolbar shows all five controls at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 852 })
      await openPlaylist(page, playlistFixture({ name: 'Nocturne Transit' }))

      await expect(page.locator('#playlist-hero-back-link')).toBeVisible()
      await expect(page.locator('#playlist-hero-autoplay-toggle')).toBeVisible()
      await expect(page.locator('#playlist-hero-rename-button')).toBeVisible()
      await expect(page.locator('#playlist-hero-export-button')).toBeVisible()
      await expect(page.locator('#playlist-hero-share-button')).toBeVisible()
      await expect(page.locator('#playlist-hero-more-100001')).toHaveCount(0)
      await assertNoHorizontalOverflow(page)
    })

    test(`mobile player two-row anatomy at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 852 })
      await openPlaylist(page, playlistFixture({ name: 'Nocturne Transit' }))

      const player = page.getByTestId('input-player')
      await expect(player.locator('#input-player-play-pause')).toBeVisible()
      await expect(player.getByRole('slider', { name: 'Seek' })).toBeVisible()
      await expect(player.locator('time')).toBeVisible()
      await expect(player.getByRole('button', { name: 'Skip back 10 seconds' })).toBeVisible()
      await expect(player.getByRole('button', { name: 'Skip forward 10 seconds' })).toBeVisible()
      await expect(player.getByRole('slider', { name: 'Volume' })).toBeVisible()
      await expect(player.getByRole('link', { name: 'Listen on Apple Music' })).toBeVisible()
    })
  }

  test('long title truncates on mobile 393 with heart and chip intact', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await openPlaylist(page, playlistFixture({}))

    const heading = page.locator('#playlist-results-heading')
    await heading.scrollIntoViewIfNeeded()

    const truncated = await heading.evaluate((el) => {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return {
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        width: rect.width,
        text: el.textContent,
      }
    })
    expect(truncated.width).toBeGreaterThan(0)
    expect(truncated.overflow).toBe('hidden')
    expect(truncated.textOverflow).toBe('ellipsis')
    expect(truncated.scrollWidth).toBeGreaterThanOrEqual(truncated.clientWidth)
    expect(truncated.text).toContain('GABRIELE MANCINO')
    expect(truncated.text).not.toMatch(/A1 CANTI\($/)

    await expect(page.locator('#playlist-hero-favorite-button')).toBeVisible()
    await expect(page.getByText('Private', { exact: true })).toBeVisible()
    await assertNoHorizontalOverflow(page)
  })

  test('no Apple Music badge for upload seed on mobile 393', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await openPlaylist(page, playlistFixture({ type: 'upload', deepLinkUrl: null, name: 'Upload Seed' }))

    const player = page.getByTestId('input-player')
    await expect(player.getByRole('link', { name: 'Listen on Apple Music' })).toHaveCount(0)
  })

  test('compact playback error in seek slot without single-letter truncation at 393', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('resomix-e2e-force-playback-error', '1')
    })

    await page.setViewportSize({ width: 393, height: 852 })
    await openPlaylist(page, playlistFixture({ name: 'Error Fixture' }))

    const player = page.getByTestId('input-player')
    const errorStatus = player.getByRole('status')
    await expect(errorStatus).toBeVisible()
    await expect(errorStatus).toContainText('Playback unavailable')
    await expect(errorStatus).not.toContainText('P…')

    const messageText = await errorStatus.locator('span').first().innerText()
    expect(messageText.toLowerCase()).toBe('playback unavailable')
    expect(messageText.length).toBeGreaterThan(1)

    await expect(player.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(player.getByRole('slider', { name: 'Volume' })).toBeVisible()
    await expect(player.getByRole('button', { name: 'Skip forward 10 seconds' })).toBeVisible()
  })

  test('rate control and meta toggle sit inline on mobile 393', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await openPlaylist(page, playlistFixture({ name: 'Nocturne Transit' }))

    const rating = page.locator('#playlist-hero-rating-button')
    const meta = page.locator('#playlist-hero-meta-toggle')
    await expect(rating).toBeVisible()
    await expect(meta).toBeVisible()

    const layout = await rating.evaluate((ratingEl) => {
      const metaEl = document.querySelector('#playlist-hero-meta-toggle')
      if (!metaEl) return null
      const ratingRect = ratingEl.getBoundingClientRect()
      const metaRect = metaEl.getBoundingClientRect()
      return {
        sameRow: Math.abs(ratingRect.top - metaRect.top) < 8,
        metaAfterRating: metaRect.left >= ratingRect.left,
      }
    })
    expect(layout?.sameRow).toBe(true)
    expect(layout?.metaAfterRating).toBe(true)
  })
})
