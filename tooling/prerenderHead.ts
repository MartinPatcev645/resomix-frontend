import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

/** Rewrite the shell's head for one route. The body is untouched. */
function render(shell: string, seo: RouteSeoLike, url: string): string {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${text(seo.title)}</title>`)
  html = setMeta(html, 'name', 'description', seo.description)
  html = setMeta(html, 'name', 'robots', seo.noindex ? 'noindex, follow' : 'index, follow')
  html = setMeta(html, 'property', 'og:title', seo.title)
  html = setMeta(html, 'property', 'og:description', seo.description)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'name', 'twitter:title', seo.title)
  html = setMeta(html, 'name', 'twitter:description', seo.description)
  return html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${attr(url)}$2`)
}

export function prerenderHead(options: {
  routes: Record<string, RouteSeoLike>
  origin: string
  outDir: string
  /**
   * Real routes with no SEO entry — redirects and hand-offs to the other app. They still need a
   * shell, because emitting `404.html` (below) switches Cloudflare Pages off SPA-fallback: from
   * then on, any path without a file is a genuine 404. Without these, /pricing and /profile would
   * start 404ing.
   */
  extraRoutes?: string[]
}): { name: string; apply: 'build'; closeBundle(): void } {
  const { routes, origin, outDir, extraRoutes = [] } = options

  return {
    name: 'prerender-head',
    apply: 'build',
    closeBundle() {
      const shellPath = path.resolve(outDir, 'index.html')
      const shell = readFileSync(shellPath, 'utf8')
      let written = 0

      for (const [routePath, seo] of Object.entries(routes)) {
        // '/404' is a metadata entry, not a route — nothing serves it.
        if (routePath === '/404') continue

        const url = seo.canonical ?? (routePath === '/' ? `${origin}/` : `${origin}${routePath}`)
        const html = render(shell, seo, url)

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
