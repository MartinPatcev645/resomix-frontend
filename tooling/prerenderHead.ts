import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Emits one real HTML file per route, with that route's head tags baked in.
 *
 * WHY THIS EXISTS
 * ---------------
 * This is a single-page app: every URL is served the same `index.html`, and `RouteMeta` rewrites
 * the head in the browser once React boots. Googlebot executes JavaScript, so search was fine.
 * But the Open Graph scrapers behind WhatsApp, Slack, iMessage, LinkedIn, Facebook and Upwork do
 * NOT run JavaScript — they read the bytes the server returned. So every link, whatever page it
 * pointed at, previewed as the homepage.
 *
 * Rewriting the head at runtime cannot fix that; the tags have to already be in the response. This
 * writes `dist/<route>/index.html` for each route, identical to the SPA shell except for the head.
 * Cloudflare Pages serves a directory's `index.html` for that path, so `/solutions/producers` now
 * returns HTML that already says "Producers — …". The app itself is unchanged: same bundle, same
 * hydration, and the SPA fallback still covers anything not listed here.
 *
 * This is prerendering of the HEAD only, not the body — the visible page is still client-rendered.
 * That is all a link preview needs, and it avoids pulling in a full SSG pipeline.
 */

interface RouteSeoLike {
  title: string
  description: string
  noindex?: boolean
  canonical?: string
}

/** Escape for use inside a double-quoted HTML attribute. Titles contain & and — routinely. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape for use in element text (the <title>). */
function text(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Replace a tag's content attribute, tolerating both `>` and ` />` endings. */
function setMeta(html: string, attrName: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attrName}="${key}"\\s+content=")[^"]*(")`, 'i')
  if (re.test(html)) return html.replace(re, `$1${attr(value)}$2`)
  // Not in the shell yet — inject before </head> so the tag still ships.
  return html.replace('</head>', `  <meta ${attrName}="${key}" content="${attr(value)}" />\n</head>`)
}

/**
 * Readable breadcrumb labels. Slugs title-case cleanly except where they carry an acronym, an
 * ampersand, or the US spelling we kept in the URL for continuity.
 */
const CRUMB_NAMES: Record<string, string> = {
  product: 'Product',
  solutions: 'Solutions',
  partners: 'Partners',
  pilot: 'Guided Pilot',
  djs: 'DJs',
  'catalog-intelligence': 'Catalogue Intelligence',
  'music-libraries-sample-providers': 'Music Libraries & Sample Providers',
}

const titleCase = (slug: string) =>
  slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/**
 * Per-page JSON-LD: `WebPage` plus a `BreadcrumbList`.
 *
 * `Organization` and `WebSite` already ship in the shell, but they describe the SITE — every URL
 * was declaring the same two things and nothing about itself. This adds what the page IS, tied back
 * to the site node via `isPartOf`.
 *
 * It goes in the static HTML deliberately. No major AI crawler executes JavaScript (Vercel's
 * analysis of 500M+ GPTBot fetches found zero evidence of it), so anything rendered at runtime is
 * invisible to them — and structured data is the strongest signal they do read.
 */
function structuredData(seo: RouteSeoLike, url: string, origin: string, routePath: string): string {
  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: seo.title,
      description: seo.description,
      isPartOf: { '@id': `${origin}/#website` },
      about: { '@id': `${origin}/#organization` },
      inLanguage: 'en',
    },
  ]

  // Home has no trail worth stating; a single-item breadcrumb is noise.
  const segments = routePath.split('/').filter(Boolean)
  if (segments.length) {
    const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` }]
    let path = ''
    segments.forEach((segment, i) => {
      path += `/${segment}`
      items.push({
        '@type': 'ListItem',
        position: i + 2,
        name: CRUMB_NAMES[segment] ?? titleCase(segment),
        item: `${origin}${path}`,
      })
    })
    graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: items })
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
}

/** Rewrite the shell's head for one route. The body is untouched. */
function render(shell: string, seo: RouteSeoLike, url: string, origin = '', routePath = ''): string {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${text(seo.title)}</title>`)
  html = setMeta(html, 'name', 'description', seo.description)
  html = setMeta(html, 'name', 'robots', seo.noindex ? 'noindex, follow' : 'index, follow')
  html = setMeta(html, 'property', 'og:title', seo.title)
  html = setMeta(html, 'property', 'og:description', seo.description)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'name', 'twitter:title', seo.title)
  html = setMeta(html, 'name', 'twitter:description', seo.description)
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${attr(url)}$2`)

  // Per-page JSON-LD, alongside (not replacing) the site-level Organization/WebSite in the shell.
  if (origin && !seo.noindex) {
    const json = structuredData(seo, url, origin, routePath)
    html = html.replace(
      '</head>',
      `  <script type="application/ld+json">${json}</script>\n</head>`,
    )
  }

  return html
}

/**
 * Inline a stylesheet that was linked from the shell, removing a render-blocking request.
 *
 * Worth it only for small, always-needed CSS. The consent stylesheet qualifies: 3.9 KiB on the
 * wire but a full round trip on the critical path, and it cannot simply be deferred — `useSilktide`
 * used to inject it from an effect, which restyled the page a second after it had painted.
 */
function inlineStylesheet(html: string, outDir: string, id: string, href: string): string {
  const file = path.resolve(outDir, href.replace(/^\//, ''))
  if (!existsSync(file)) return html
  const css = readFileSync(file, 'utf8')
  const link = new RegExp(`<link id="${id}"[^>]*>`)
  if (!link.test(html)) return html
  return html.replace(link, `<style id="${id}">${css}</style>`)
}

export function prerenderHead(options: {
  routes: Record<string, RouteSeoLike>
  origin: string
  outDir: string
  /** Small stylesheets to inline rather than link, killing a render-blocking round trip each. */
  inlineCss?: Array<{ id: string; href: string }>
  /**
   * Real routes with no SEO entry — redirects and hand-offs to the other app. They still need a
   * shell, because emitting `404.html` (below) switches Cloudflare Pages off SPA-fallback: from
   * then on, any path without a file is a genuine 404. Without these, /pricing and /profile would
   * start 404ing.
   */
  extraRoutes?: string[]
}): { name: string; apply: 'build'; closeBundle(): void } {
  const { routes, origin, outDir, extraRoutes = [], inlineCss = [] } = options

  return {
    name: 'prerender-head',
    apply: 'build',
    closeBundle() {
      const shellPath = path.resolve(outDir, 'index.html')
      let shell = readFileSync(shellPath, 'utf8')
      // Done once, on the shell, so every route inherits it.
      for (const { id, href } of inlineCss) shell = inlineStylesheet(shell, outDir, id, href)
      let written = 0

      for (const [routePath, seo] of Object.entries(routes)) {
        // '/404' is a metadata entry, not a route — nothing serves it.
        if (routePath === '/404') continue

        const url = seo.canonical ?? (routePath === '/' ? `${origin}/` : `${origin}${routePath}`)
        const html = render(shell, seo, url, origin, routePath)

        if (routePath === '/') {
          writeFileSync(shellPath, html)
        } else {
          const dir = path.resolve(outDir, routePath.replace(/^\//, ''))
          mkdirSync(dir, { recursive: true })
          writeFileSync(path.join(dir, 'index.html'), html)
        }
        written++
      }

      // Shells for routes that carry no SEO entry. noindex: they are redirects or app hand-offs.
      for (const routePath of extraRoutes) {
        // Site-level metadata, not the 404 entry: these paths DO exist, they just redirect or hand
        // off. Titling them "Page not found" would tell a scraper something untrue.
        const html = render(shell, {
          title: routes['/']?.title ?? 'Resomix',
          description: routes['/']?.description ?? '',
          noindex: true,
        }, `${origin}${routePath}`)
        const dir = path.resolve(outDir, routePath.replace(/^\//, ''))
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, 'index.html'), html)
        written++
      }

      /*
       * A genuine 404.
       *
       * Cloudflare Pages serves index.html with a 200 for any unmatched path when no 404.html
       * exists — a soft 404. Lighthouse caught it via the llms.txt audit: it fetched /llms.txt,
       * got the SPA shell back with a 200, and tried to parse HTML as Markdown. Every non-existent
       * path behaved the same way, which also lets junk URLs into the index.
       *
       * Emitting 404.html switches Pages to returning a real 404 status. That is why every live
       * route above must have its own file.
       */
      const notFound = routes['/404']
      if (notFound) {
        writeFileSync(
          path.resolve(outDir, '404.html'),
          render(shell, { ...notFound, noindex: true }, `${origin}/404`),
        )
      }

      // eslint-disable-next-line no-console
      console.log(`  prerendered head   ${written} routes + 404.html`)
    },
  }
}
