import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// SideLines renders page content twice (desktop + mobile blocks) — target the visible tree.
const visibleMain = (page: import('@playwright/test').Page) =>
  page.locator('.hidden.lg\\:block main.page-transition');

async function dismissConsent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
  });
}

test.describe('/partners/pilot', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('silktideCookieBanner_closed', '1');
    });

    await page.route('**/contact**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('loads page and keyboard-operates protocol station', async ({ page }) => {
    await page.goto('/partners/pilot');
    await dismissConsent(page);
    const main = visibleMain(page);
    await expect(
      main.getByRole('heading', { level: 1, name: /test resomix on your own catalogue/i }),
    ).toBeVisible();

    const station = main.locator('.pp-proto-node').first();
    await station.focus();
    await page.keyboard.press('Enter');

    await expect(main.locator('#method .pp-stagebtn[aria-pressed="true"]').first()).toHaveText(
      /01 scope/i,
    );
  });

  test('completes form and shows success panel', async ({ page }) => {
    await page.goto('/partners/pilot');
    await dismissConsent(page);
    const main = visibleMain(page);
    await main.locator('#apply').scrollIntoViewIfNeeded();

    await main.locator('#pp-f-email').fill('pilot@example.com');
    await main.locator('#pp-f-name').fill('Test User');
    await main.locator('#pp-f-company').fill('Test Label');
    await main.locator('#pp-f-type').selectOption({ label: 'Label / label group' });
    await main.locator('#pp-f-question').fill('Can we test similarity on our catalogue sample?');
    await main.locator('#pp-f-rights').check();

    await main.getByRole('button', { name: /request pilot review/i }).click();

    await expect(main.getByText(/inquiry received/i)).toBeVisible({ timeout: 10000 });
    await expect(main.getByText(/ingestion begins only after approval/i)).toBeVisible();
  });

  test('has no critical a11y violations', async ({ page }) => {
    await page.goto('/partners/pilot');
    await dismissConsent(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
