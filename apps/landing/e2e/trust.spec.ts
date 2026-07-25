import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LEGAL_LIBRARY_URL, LEGAL_EMAIL, PRIVACY_EMAIL } from '../src/sections/trust/trData.ts';

const visibleMain = (page: import('@playwright/test').Page, mobile = false) =>
  mobile
    ? page.locator('.block.lg\\:hidden main.page-transition')
    : page.locator('.hidden.lg\\:block main.page-transition');

async function dismissConsent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
  });
}

test.describe('/trust', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('silktideCookieBanner_closed', '1');
    });
  });

  test('keyboard-walks tabs and disclosures', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 900 });
    await page.goto('/trust');
    await dismissConsent(page);
    const main = visibleMain(page, true);

    await expect(
      main.getByRole('heading', { level: 1, name: /your audio\. your rights\. clear boundaries\./i }),
    ).toBeVisible();

    const tabs = main.getByRole('tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

    const retentionLedger = main.getByRole('treegrid', {
      name: 'Retention register by data category',
    });
    const firstRow = retentionLedger.locator('.tr-lrow').first();
    await firstRow.focus();
    await page.keyboard.press('Enter');
    await expect(firstRow).toHaveAttribute('aria-expanded', 'true');
  });

  test('external links use the published legal library and mailtos', async ({ page }) => {
    await page.goto('/trust');
    await dismissConsent(page);
    const main = visibleMain(page);

    const libraryLinks = main.locator(`a[href="${LEGAL_LIBRARY_URL}"]`);
    await expect(libraryLinks).toHaveCount(12);

    await expect(main.locator(`a[href="mailto:${PRIVACY_EMAIL}"]`)).toHaveCount(1);
    await expect(main.locator(`a[href="mailto:${LEGAL_EMAIL}"]`)).toHaveCount(2);
  });

  test('has no critical a11y violations', async ({ page }) => {
    await page.goto('/trust');
    await dismissConsent(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('has no horizontal overflow at 393px', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 900 });
    await page.goto('/trust');
    await dismissConsent(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth).toBe(overflow.clientWidth);
  });
});
