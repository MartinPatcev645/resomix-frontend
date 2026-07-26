import { test, expect } from '@playwright/test';

async function dismissConsent(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.getElementById('stcm-wrapper')?.remove();
    document.getElementById('stcm-backdrop')?.remove();
  });
}

test('homepage renders', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('silktideCookieBanner_closed', '1');
  });
  await page.goto('/');
  await dismissConsent(page);
  await expect(page.locator('.nav-hlogo a[aria-label="Resomix home"]')).toBeVisible();
});
