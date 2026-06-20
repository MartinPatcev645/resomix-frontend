import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    {
      name: 'remove-crossorigin-stylesheet',
      transformIndexHtml(html) {
        return html.replace(/<link\s+([^>]*?)crossorigin([^>]*?)>/g, (match, p1, p2) => {
          if (p1.includes('rel="stylesheet"') || p2.includes('rel="stylesheet"')) {
            return `<link ${p1} ${p2}>`.replace(/\s+/g, ' ').replace(' >', '>');
          }
          return match;
        });
      }
    }
  ],
  // server: {
  //   allowedHosts: ['ios-dev.fluxhub.ai'],
  //   hmr: {
  //     protocol: 'wss',
  //     host: 'ios-dev.fluxhub.ai',
  //     clientPort: 443,
  //   },
  // },
  resolve: {
    alias: {
      '@':                  path.resolve(__dirname, './src'),
      '@resomix/ui':        path.resolve(__dirname, '../../packages/ui/src'),
      '@resomix/hooks':     path.resolve(__dirname, '../../packages/hooks/src'),
      '@resomix/api-client':path.resolve(__dirname, '../../packages/api-client/src'),
      '@resomix/config':     path.resolve(__dirname, '../../packages/config/src')
    }
  },
  build: {
    sourcemap: false,  // set true if need to debug something
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Third-party libraries
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'router'
            if (id.includes('/three')) return 'three'
            if (id.includes('@react-three/fiber')) return 'r3f'
            if (id.includes('/react/') || id.includes('react-dom')) return 'react'
            return 'vendor'
          }
          // Internal workspaces
          if (id.includes('/packages/ui/')) return 'resomix-ui'
          if (id.includes('/packages/hooks/')) return 'resomix-hooks'
          if (id.includes('/packages/stores/')) return 'resomix-stores'
          if (id.includes('/packages/api-client/')) return 'resomix-api'
          if (id.includes('/packages/config/')) return 'resomix-config'
          return undefined
        }
      }
    }
  }
})
