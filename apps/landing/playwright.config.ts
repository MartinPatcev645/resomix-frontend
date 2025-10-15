import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  timeout: 30_000,
  testDir: 'e2e',
  // Uses vite preview locally; in CI we point BASE_URL to CF preview URL
  webServer: {
    command: 'pnpm run preview',
    port: 5173,
    reuseExistingServer: true
  },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } }
  ]
})
