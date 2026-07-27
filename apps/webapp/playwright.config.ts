import { defineConfig, devices } from '@playwright/test'

const WEBAPP_PORT = 5190
const WEBAPP_HOST = '127.0.0.1'
const WEBAPP_BASE_URL = process.env.BASE_URL || `http://${WEBAPP_HOST}:${WEBAPP_PORT}`

export default defineConfig({
  timeout: 30_000,
  testDir: 'e2e',
  // Dedicated webapp preview port — never reuse landing's default 5173.
  webServer: {
    command: `pnpm run preview --host ${WEBAPP_HOST} --port ${WEBAPP_PORT}`,
    url: WEBAPP_BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: WEBAPP_BASE_URL,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } }
  ]
})
