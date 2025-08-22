import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['ios-dev.fluxhub.ai'],
    hmr: {
      protocol: 'wss',
      host: 'ios-dev.fluxhub.ai',
      clientPort: 443,
    },
  },
  resolve: {
    alias: {
      '@':                  path.resolve(__dirname, './src'),
      '@resomix/ui':        path.resolve(__dirname, '../../packages/ui/src'),
      '@resomix/hooks':     path.resolve(__dirname, '../../packages/hooks/src'),
      '@resomix/api-client':path.resolve(__dirname, '../../packages/api-client/src'),
      '@resomix/config':     path.resolve(__dirname, '../../packages/config/src')
    }
  }
})
