import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { ROUTE_SEO } from './src/routes/seoConfig.ts'
import { PAGE_MODULES } from './src/routes/pageModules.ts'
import { prerenderBodies } from '../../tooling/prerenderBodies.ts'

/**
 * Second build pass: renders each route's BODY into the HTML files the client build produced.
 *
 * Run after `vite build`, never instead of it — it rewrites files in `dist/` that the client build
 * creates. See package.json's `build` script.
 *
 * The client build already emits one HTML file per route with the right <head>
 * (tooling/prerenderHead.ts). This pass compiles `src/entry-server.tsx` to `dist-ssr/`, then uses it
 * to render the real React tree for each route and injects the markup into `#root` — so the page's
 * H1, copy and internal links are in the response instead of being assembled by JavaScript.
 *
 * `dist-ssr/` is a build artefact and is never deployed.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    prerenderBodies({
      /* Redirect and hand-off shells are deliberately absent: they carry no content of their own,
         and they are noindex. Head-only remains correct for them. */
      routes: Object.keys(ROUTE_SEO).filter((route) => route !== '/404'),
      clientDir: path.resolve(__dirname, 'dist'),
      serverEntry: path.resolve(__dirname, 'dist-ssr/entry-server.js'),
      /* Each page owns a stylesheet that Vite would otherwise inject only when its JS loads —
         which, now that the markup ships in the HTML, means painting the page unstyled first. */
      routeModules: PAGE_MODULES,
      /* Three blocking stylesheets = three round trips before first paint. On the throttled mobile
         profile Lighthouse attributed 1,160-1,510 ms to them, with FCP stuck at 3.2 s. */
      inlineCss: true,
      /* The catch-all route renders the 404 page, so ask for a path that matches nothing else. */
      notFound: { url: '/404', file: 'dist/404.html' },
    }),
  ],
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
    ssr: path.resolve(__dirname, 'src/entry-server.tsx'),
    outDir: path.resolve(__dirname, 'dist-ssr'),
    emptyOutDir: true,
    /* Nothing here reaches a user, so minifying it only makes prerender stack traces unreadable. */
    minify: false,
  },
})
