import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { ROUTE_SEO, SITEMAP_DEFAULTS, SITE_ORIGIN } from './src/routes/seoConfig.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    {
      /* Sitemap is GENERATED, never hand-edited.
         The old public/sitemap.xml had drifted badly — it advertised /terms and /privacy, which are
         not routes, and listed one of the seventeen marketing pages. Deriving it from the same
         config that drives the document head means a page cannot ship indexed-but-missing, or
         listed-but-deleted. */
      name: 'generate-sitemap',
      apply: 'build',
      closeBundle() {
        const today = new Date().toISOString().slice(0, 10)
        const urls = Object.entries(ROUTE_SEO)
          .filter(([, seo]) => !seo.noindex)
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

        const xml =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls +
          '\n</urlset>\n'

        writeFileSync(path.resolve(__dirname, 'dist/sitemap.xml'), xml)
        // eslint-disable-next-line no-console
        console.log(`  sitemap.xml  ${Object.keys(ROUTE_SEO).length} routes -> ${urls.split('<url>').length - 1} indexed`)
      },
    },
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
