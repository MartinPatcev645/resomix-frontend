// Dev/preview localhost proxy (zero production impact):
//   VITE_SERVER_BACKEND= VITE_SERVER_MEDIA=. pnpm dev
// For preview on a fixed port:
//   VITE_SERVER_MEDIA=. pnpm preview --host 127.0.0.1 --port 5190
//
// Media auth note (403 diagnosis): peaks and signed-audio requests use a playback JWT appended
// as ?token= (see peaksCache / HLS session). With VITE_SERVER_MEDIA empty, those paths are
// same-origin via this proxy (changeOrigin → media.resomix.com) — a 403 is a rejected/expired
// token, not a localhost Host mismatch. Apple preview_url playback bypasses the proxy entirely.
// If 403 persists on beta.resomix.com for the same track after re-login, report as backend media-auth.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { ROUTE_SEO, SITEMAP_DEFAULTS, SITE_ORIGIN } from './src/routes/seoConfig.ts'
import { prerenderHead } from '../../tooling/prerenderHead.ts'

const BACKEND_TARGET = 'https://bserver.resomix.com'
const MEDIA_TARGET = 'https://media.resomix.com'

/** Dev/preview only — forwards API + media paths so JWT auth and playback work on localhost. */
const devProxy = {
  '/api': { target: BACKEND_TARGET, changeOrigin: true, secure: true },
  '/signed-audio': { target: MEDIA_TARGET, changeOrigin: true, secure: true },
  '/peaks': { target: MEDIA_TARGET, changeOrigin: true, secure: true },
  '/peaks-rich': { target: MEDIA_TARGET, changeOrigin: true, secure: true },
  '/cover-image': { target: MEDIA_TARGET, changeOrigin: true, secure: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      /* Sitemap is GENERATED from seoConfig, never hand-edited.
         The committed one listed /sonic-discovery, /library and /analysis while index.html declared
         the whole app noindex,nofollow and robots.txt disallowed every subpage — it advertised URLs
         that three other signals forbade. Deriving it from the same config that drives the head
         means the sitemap can only ever contain pages we actually want indexed. */
      name: 'generate-sitemap',
      apply: 'build',
      closeBundle() {
        const today = new Date().toISOString().slice(0, 10)
        const entries = Object.entries(ROUTE_SEO).filter(
          // A canonical pointing at another origin means we want THAT page indexed, not this one.
          ([, seo]) => !seo.noindex && !seo.canonical,
        )
        const urls = entries
          .map(([routePath, seo]) => {
            const loc = routePath === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${routePath}`
            const changefreq = seo.changefreq ?? SITEMAP_DEFAULTS.changefreq
            const priority = (seo.priority ?? SITEMAP_DEFAULTS.priority).toFixed(1)
            return [
              '  <url>',
              `    <loc>${loc}</loc>`,
              `    <lastmod>${today}</lastmod>`,
              `    <changefreq>${changefreq}</changefreq>`,
              `    <priority>${priority}</priority>`,
              '  </url>',
            ].join('\n')
          })
          .join('\n')

        writeFileSync(
          path.resolve(__dirname, 'dist/sitemap.xml'),
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            urls +
            '\n</urlset>\n',
        )
        // eslint-disable-next-line no-console
        console.log(`  sitemap.xml  ${Object.keys(ROUTE_SEO).length} routes -> ${entries.length} indexed`)
      },
    },
    react(), 
    tailwindcss(),
    /* Bakes each route's head into its own HTML file. Link-preview scrapers do not run JS, so a
       shared beta URL previewed as the app home whatever page it pointed at. */
    prerenderHead({
      routes: ROUTE_SEO,
      origin: SITE_ORIGIN,
      outDir: path.resolve(__dirname, 'dist'),
    }),
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
  server: { proxy: devProxy },
  preview: { proxy: devProxy },
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
      '@resomix/stores':    path.resolve(__dirname, '../../packages/stores/src'),
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
