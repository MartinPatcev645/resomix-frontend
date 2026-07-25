import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const visibleMain = (page: import('@playwright/test').Page) =>
  page.locator('.hidden.lg\\:block main.page-transition');

async function dismissConsent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
  });
}

test.describe('/partners', () => {
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

  test('keyboard-selects junction route and updates outcome', async ({ page }) => {
    await page.goto('/partners');
    await dismissConsent(page);
    const main = visibleMain(page);

    await expect(
      main.getByRole('heading', { level: 1, name: /three ways to work with resomix/i }),
    ).toBeVisible();

    const pilotRoute = main.locator('.pn-junction svg g[role="button"]').first();
    await pilotRoute.focus();
    await page.keyboard.press('Enter');

    await expect(main.locator('.pn-junct-foot .pn-interp')).toContainText(/private catalogue pilot/i);
    await expect(main.locator('#path-pilot')).toHaveAttribute('data-active', 'true');
  });

  test('audience chip lights the route', async ({ page }) => {
    await page.goto('/partners');
    await dismissConsent(page);
    const main = visibleMain(page);

    await main.getByRole('button', { name: /02 · api \+ ingestion/i }).click();
    await expect(main.locator('#path-api')).toHaveAttribute('data-active', 'true');
  });

  test('completes form and shows success panel', async ({ page }) => {
    await page.goto('/partners');
    await dismissConsent(page);
    const main = visibleMain(page);
    await main.locator('#contact').scrollIntoViewIfNeeded();

    await main.locator('#pn-f-email').fill('partner@example.com');
    await main.locator('#pn-f-name').fill('Test User');
    await main.locator('#pn-f-company').fill('Test Company');
    await main.locator('#pn-f-type').selectOption({ label: 'Label / label group' });
    await main.locator('#pn-f-path').selectOption({ label: 'Private Catalogue Pilot' });

    await main.getByRole('button', { name: /contact partnerships/i }).click();

    await expect(main.getByText(/thanks — your request was submitted/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText(/2–5 business days/i)).toBeVisible();
  });

  test('has no critical a11y violations', async ({ page }) => {
    await page.goto('/partners');
    await dismissConsent(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
