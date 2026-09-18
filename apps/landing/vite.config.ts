import { defineConfig, loadEnv, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { ROUTE_SEO, SITEMAP_DEFAULTS, SITE_ORIGIN, type RouteSeo } from './src/routes/seoConfig.ts'
import { FAQ_ITEMS, FAQ_ORDER } from '../../packages/ui/src/Billing/pricingFaqCopy.ts'
import { prerenderHead } from '../../tooling/prerenderHead.ts'
import { minifyPublicScripts } from '../../tooling/minifyPublicScripts.ts'

/*
 * Visible question-and-answer copy and how-it-works steps are emitted as `FAQPage` and `HowTo`
 * structured data. They are read here from the very locale strings the pages render, so the markup
 * can never describe something a visitor cannot see, which is Google's rule for both types. The
 * copy stays in the locale files and out of seoConfig.ts, which holds metadata only.
 */
type Faq = Array<{ question: string; answer: string }>

type PrerenderRoute = RouteSeo & {
  faq?: Faq
  howTo?: { name: string; steps: Array<{ name: string; text: string }> }
}

/** A page's English copy, keyed by its locale namespace (which is also its file name). */
function pageCopy<T>(ns: string): T {
  const file = path.resolve(__dirname, `src/locales/en/pages/${ns}.json`)
  return (JSON.parse(readFileSync(file, 'utf8')) as Record<string, T>)[ns]
}

/** Routes whose page mounts `<FaqSection ns=…>`. The value is the page's locale namespace. */
const FAQ_ROUTES: Record<string, string> = {
  '/': 'home',
  '/product': 'product',
  '/product/sonic-discovery': 'sonicDiscovery',
  '/product/track-intelligence': 'trackIntelligence',
  '/product/catalog-intelligence': 'catalogueIntelligence',
  '/developers': 'developers',
  '/partners': 'partners',
  '/partners/pilot': 'partnersPilot',
  '/about': 'about',
  '/solutions/record-labels': 'recordLabels',
  '/solutions/music-publishers': 'musicPublishers',
  '/solutions/sync-agencies': 'syncAgencies',
  '/solutions/music-libraries-sample-providers': 'musicLibraries',
  '/solutions/djs': 'djs',
  '/solutions/music-curators': 'musicCurators',
  '/solutions/producers': 'producers',
}

function pageFaq(ns: string): Faq {
  const { faq } = pageCopy<{ faq?: { items?: Array<{ q: string; a: string }> } }>(ns)
  return (faq?.items ?? []).map(({ q, a }) => ({ question: q, answer: a }))
}

/** The trust page's rights section is an older Q&A with its own shape. One answer wraps a mailto
    link around the legal address, so the JSON stores it in two halves. */
function trustFaq(): Faq {
  const trust = pageCopy<{
    legalEmail: string
    rights: { qa: Array<{ question: string; answer?: string; answerBefore?: string; answerAfter?: string }> }
  }>('trust')
  return trust.rights.qa.map((item) => ({
    question: item.question,
    answer: item.answer ?? `${item.answerBefore ?? ''}${trust.legalEmail}${item.answerAfter ?? ''}`,
  }))
}

/** The pricing page's questions live in the shared billing package, because the same block renders
    inside the app at `beta.resomix.com/subscribe`. That file is copy only, with a single type-only
    import, so it reads here exactly as a locale file does. `FAQ_ORDER` leaves out the founding-offer
    question on purpose, since its answer is assembled at runtime from the billing API and there is
    no fixed text to declare. */
function pricingFaq(): Faq {
  const ids = [...FAQ_ORDER.plans, ...FAQ_ORDER.billing, ...FAQ_ORDER.managing]
  return ids.map((id) => ({ question: FAQ_ITEMS[id].q, answer: FAQ_ITEMS[id].a }))
}

function sonicDiscoveryHowTo(): NonNullable<PrerenderRoute['howTo']> {
  const { steps } = pageCopy<{
    steps: { title: string; items: Array<{ name: string; text: string }> }
  }>('sonicDiscovery')
  return { name: steps.title, steps: steps.items }
}

function routesWithPageCopy(): Record<string, PrerenderRoute> {
  const routes: Record<string, PrerenderRoute> = { ...ROUTE_SEO }
  for (const [route, ns] of Object.entries(FAQ_ROUTES)) {
    routes[route] = { ...routes[route], faq: pageFaq(ns) }
  }
  routes['/trust'] = { ...routes['/trust'], faq: trustFaq() }
  routes['/pricing'] = { ...routes['/pricing'], faq: pricingFaq() }
  routes['/product/sonic-discovery'] = {
    ...routes['/product/sonic-discovery'],
    howTo: sonicDiscoveryHowTo(),
  }
  return routes
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /* The official profiles are env, not source (VITE_FACEBOOK_URL and friends, the same values the
     footer links read). They are merged into the Organization node at build time, and an unset one
     is simply left out rather than emitted empty. */
  const env = loadEnv(mode, __dirname, 'VITE_')
  const sameAs = [env.VITE_FACEBOOK_URL, env.VITE_INSTAGRAM_URL, env.VITE_TWITTER_URL, env.VITE_SOUNDCLOUD_URL]
    .filter((url): url is string => Boolean(url))

  return {
    plugins: [
      react(),
      tailwindcss(),
      /* public/ is copied verbatim, so hand-written scripts there ship unminified. */
      minifyPublicScripts({ outDir: path.resolve(__dirname, 'dist'), transform: transformWithEsbuild }),
      /* Bakes each route's head into its own HTML file. Link-preview scrapers do not run JS, so
         the runtime RouteMeta never reaches them — every shared URL previewed as the homepage. */
      prerenderHead({
        routes: routesWithPageCopy(),
        origin: SITE_ORIGIN,
        outDir: path.resolve(__dirname, 'dist'),
        organization: { sameAs },
        /* 3.9 KiB, but a full render-blocking round trip on the critical path. It cannot simply be
           deferred: injecting it late is what made the page restyle itself a second after paint. */
        inlineCss: [{ id: 'resomix-consent-style', href: '/scripts/resomix-consent.css' }],
        /* Live routes with no SEO entry: two redirects and three hand-offs to the beta app. They
           need a shell because emitting 404.html turns off Cloudflare's SPA fallback — after that,
           a path with no file is a real 404. /auth/* is a wildcard and cannot be enumerated, so it
           is handled by public/_redirects instead. */
        extraRoutes: [
          '/subscribe',
          '/product/catalogue-intelligence',
          '/profile',
          '/sessions',
          '/change-password',
        ],
      }),
      {
        /* Sitemap is GENERATED, never hand-edited.
           The old public/sitemap.xml had drifted badly — it advertised /terms and /privacy, which are
           not routes, and listed one of the seventeen marketing pages. Deriving it from the same
           config that drives the document head means a page cannot ship indexed-but-missing, or
           listed-but-deleted. */
        name: 'generate-sitemap',
        apply: 'build' as const,
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
        transformIndexHtml(html: string) {
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
      /* Lighthouse Best Practices flags "Missing source maps for large first-party
         JavaScript". Maps are separate .map files, fetched only when DevTools is open, so
         they cost users nothing and make production stack traces readable. */
      sourcemap: true,
      /* Emits dist/.vite/manifest.json, which maps each page module to the CSS chunk it owns.
         The prerender pass needs it: pages are code-split, so each one has its own stylesheet that
         Vite normally injects only when the route's JS loads. Now that the page's MARKUP ships in the
         HTML, its CSS has to ship with it — otherwise the browser paints the content unstyled and
         restyles it once JS arrives. See tooling/prerenderBodies.ts. */
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
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
  }
})
