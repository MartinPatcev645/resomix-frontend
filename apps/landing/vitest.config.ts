import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@resomix/hooks': path.resolve(__dirname, '../../packages/hooks/src'),
      '@resomix/config': path.resolve(__dirname, '../../packages/config/src'),
      '@resomix/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
      '@resomix/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@resomix/stores': path.resolve(__dirname, '../../packages/stores/src')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
    // Only pick unit/integration tests inside src/
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // Ignore Playwright e2e and its config
    exclude: [...configDefaults.exclude, 'e2e/**', 'playwright.config.*']
  }
})
