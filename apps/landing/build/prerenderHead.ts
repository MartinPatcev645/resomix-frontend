import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

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

export function prerenderHead(options: {
  routes: Record<string, RouteSeoLike>
  origin: string
  outDir: string
}): Plugin {
  const { routes, origin, outDir } = options

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

        let html = shell.replace(
          /<title>[\s\S]*?<\/title>/i,
          `<title>${text(seo.title)}</title>`,
        )
        html = setMeta(html, 'name', 'description', seo.description)
        html = setMeta(html, 'name', 'robots', seo.noindex ? 'noindex, follow' : 'index, follow')
        html = setMeta(html, 'property', 'og:title', seo.title)
        html = setMeta(html, 'property', 'og:description', seo.description)
        html = setMeta(html, 'property', 'og:url', url)
        html = setMeta(html, 'name', 'twitter:title', seo.title)
        html = setMeta(html, 'name', 'twitter:description', seo.description)
        html = html.replace(
          /(<link\s+rel="canonical"\s+href=")[^"]*(")/i,
          `$1${attr(url)}$2`,
        )

        if (routePath === '/') {
          writeFileSync(shellPath, html)
        } else {
          const dir = path.resolve(outDir, routePath.replace(/^\//, ''))
          mkdirSync(dir, { recursive: true })
          writeFileSync(path.join(dir, 'index.html'), html)
        }
        written++
      }

      // eslint-disable-next-line no-console
      console.log(`  prerendered head   ${written} routes`)
    },
  }
}
