import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('has no critical a11y violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a','wcag2aa'])
    .analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})
