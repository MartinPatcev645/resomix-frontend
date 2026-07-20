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
  server: {
    port: 5175,
  },
  resolve: {
    alias: {
      '@':                  path.resolve(__dirname, './src'),
      '@resomix/ui':        path.resolve(__dirname, '../../packages/ui/src'),
      '@resomix/hooks':     path.resolve(__dirname, '../../packages/hooks/src'),
      '@resomix/api-client':path.resolve(__dirname, '../../packages/api-client/src'),
      '@resomix/stores':    path.resolve(__dirname, '../../packages/stores/src'),
      '@resomix/config':     path.resolve(__dirname, '../../packages/config/src')
    },
    dedupe: ['react', 'react-dom']
  }
})
