import { test, expect } from '@playwright/test'

test('homepage renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation').getByRole('link', { name: /resomix home/i })).toBeVisible()
})
