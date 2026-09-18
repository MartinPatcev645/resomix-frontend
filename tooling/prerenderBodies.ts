import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Injects each route's rendered markup into the HTML file that route already has.
 *
 * WHY
 * ---
 * `prerenderHead.ts` gave every route its own file with the correct <head>, which fixed link
 * previews. The body of those files was still `<div id="root"></div>`, so view-source showed no H1,
 * no copy and no internal links — the page only existed after JavaScript ran. Search was unaffected
 * (Googlebot renders JS) but LLM crawlers and AI answer engines were reading an empty document.
 *
 * This runs as the last step of the SSR build pass: it loads the compiled server entry, renders each
 * route, and writes the markup into that route's `#root`. The client hydrates it rather than
 * rebuilding it, so the content is both crawlable and painted before the app boots.
 *
 * A route that fails to render is left exactly as it was — head-only, client-rendered, which is
 * simply the previous behaviour. A broken prerender must never ship a broken page.
 */

interface PrerenderBodiesOptions {
  /** Route paths to render, e.g. `/`, `/about`. Each must already have an HTML file. */
  routes: string[]
  /** The client build's output directory, whose HTML files this rewrites. */
  clientDir: string
  /** Compiled `entry-server.js` — must export `renderRoute(url): Promise<string>`. */
  serverEntry: string
  /** The catch-all page. Its URL matches no route, so it renders whatever `*` renders. */
  notFound?: { url: string; file: string }
  /**
   * Inline every stylesheet into the document instead of linking it.
   *
   * Mobile sat at ~82 across three runs with FCP 3.2 s, and Lighthouse put 1,160–1,510 ms of that
   * on render-blocking CSS: three round trips that must all complete before anything paints, on a
   * connection with 150 ms of latency per trip.
   *
   * Inlining costs ~25 KiB gzipped in the document and removes all three. It is deliberately the
   * blunt version rather than critical-CSS extraction: a hand-rolled "which rules does this page
   * need" pass drops whatever it fails to match, and a missed rule is a visibly broken page.
   * Nothing here can be missed.
   */
  inlineCss?: boolean
  /**
   * Route → page module path, as the client manifest keys it. Used to link each route's own
   * stylesheet in its <head>.
   *
   * Without this the prerender actively makes things WORSE than no prerender: the markup paints
   * immediately from the HTML, but the page's CSS chunk is still injected by JavaScript, so the
   * visitor sees an unstyled page that restyles itself when the JS lands.
   */
  routeModules?: Record<string, string>
}

interface ManifestChunk {
  css?: string[]
  imports?: string[]
}

/**
 * Every stylesheet a route needs, following static imports so a shared section's CSS is included
 * too. Order is preserved and duplicates dropped — CSS cascade is order-sensitive.
 */
function cssFor(manifest: Record<string, ManifestChunk>, entry: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const walk = (key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) return
    for (const dep of chunk.imports ?? []) walk(dep)
    for (const href of chunk.css ?? []) if (!out.includes(href)) out.push(href)
  }

  walk(entry)
  return out
}

/**
 * `dist/index.html` for `/`, `dist/about.html` for `/about`. Mirrors prerenderHead, which explains
 * why it is `<route>.html` and not `<route>/index.html`: Pages serves the bare URL from the former
 * and redirects to the slashed URL for the latter, and the bare URL is the canonical.
 */
function htmlPathFor(clientDir: string, route: string): string {
  return route === '/'
    ? path.resolve(clientDir, 'index.html')
    : path.resolve(clientDir, `${route.replace(/^\//, '')}.html`)
}

const ROOT_RE = /(<div id="root">)(<\/div>)/

export function prerenderBodies(
  options: PrerenderBodiesOptions,
): { name: string; apply: 'build'; closeBundle(): Promise<void> } {
  const { routes, clientDir, serverEntry, notFound, routeModules = {}, inlineCss = false } = options

  return {
    name: 'prerender-bodies',
    apply: 'build',
    async closeBundle() {
      if (!existsSync(serverEntry)) {
        throw new Error(`prerender-bodies: no server entry at ${serverEntry}`)
      }

      const { renderRoute } = (await import(pathToFileURL(serverEntry).href)) as {
        renderRoute: (url: string) => Promise<string>
      }

      const manifestPath = path.resolve(clientDir, '.vite/manifest.json')
      const manifest: Record<string, ManifestChunk> = existsSync(manifestPath)
        ? JSON.parse(readFileSync(manifestPath, 'utf8'))
        : {}
      if (Object.keys(routeModules).length && !Object.keys(manifest).length) {
        throw new Error(
          `prerender-bodies: no manifest at ${manifestPath} — set build.manifest in the client config`,
        )
      }

      const targets = [
        ...routes.map((route) => ({ url: route, file: htmlPathFor(clientDir, route) })),
        ...(notFound ? [{ url: notFound.url, file: path.resolve(clientDir, '..', notFound.file) }] : []),
      ]

      let written = 0
      let bytes = 0
      let inlined = 0
      const skipped: string[] = []
      /** Routes whose page module owns no CSS at all — legitimate, but worth seeing. */
      const cssless: string[] = []
      const linkedAny = new Set<string>()

      for (const { url, file } of targets) {
        if (!existsSync(file)) {
          skipped.push(`${url} (no HTML file)`)
          continue
        }

        let markup: string
        try {
          markup = await renderRoute(url)
        } catch (error) {
          // Leave the file head-only: that is the previous behaviour, and it still works.
          skipped.push(`${url} (${(error as Error).message})`)
          continue
        }

        if (!markup.trim()) {
          skipped.push(`${url} (empty render)`)
          continue
        }

        let html = readFileSync(file, 'utf8')
        if (!ROOT_RE.test(html)) {
          skipped.push(`${url} (no empty #root to fill)`)
          continue
        }

        /*
         * Link this route's own stylesheet, after the global ones so the cascade matches what the
         * runtime injection used to produce. Anything already in the head is skipped — the entry's
         * CSS is linked by Vite itself.
         */
        const moduleKey = routeModules[url]
        if (moduleKey) {
          const links = cssFor(manifest, moduleKey)
            .filter((href) => !html.includes(`/${href}"`))
            .map((href) => `    <link rel="stylesheet" href="/${href}">`)
          if (links.length) html = html.replace('</head>', `${links.join('\n')}\n  </head>`)
          else if (!linkedAny.has(moduleKey)) cssless.push(url)
          linkedAny.add(moduleKey)
        }

        // Function replacer: rendered markup contains `$` sequences that a string replacement
        // would interpret ($&, $1 …) and silently corrupt.
        /* Swap every <link rel=stylesheet> for its contents. Done AFTER the per-route link is
           added above, so the page's own sheet is inlined too — it styles the hero, so deferring
           it would just move the unstyled-paint problem rather than fix it. */
        if (inlineCss) {
          html = html.replace(
            /<link rel="stylesheet" href="([^"]+)">/g,
            (whole, href: string) => {
              const asset = path.resolve(clientDir, href.replace(/^\//, ''))
              if (!existsSync(asset)) return whole
              inlined += Buffer.byteLength(readFileSync(asset))
              return `<style>${readFileSync(asset, 'utf8')}</style>`
            },
          )
        }

        writeFileSync(file, html.replace(ROOT_RE, (_m, open: string, close: string) => open + markup + close))
        written++
        bytes += Buffer.byteLength(markup)
      }

      // eslint-disable-next-line no-console
      console.log(
        `  prerendered body   ${written}/${targets.length} routes, ${(bytes / 1024).toFixed(0)} KiB markup` +
          (inlined ? `, ${(inlined / 1024).toFixed(0)} KiB CSS inlined` : ''),
      )
      if (cssless.length) {
        // eslint-disable-next-line no-console
        console.log(`  (no page CSS chunk: ${cssless.join(', ')})`)
      }
      if (skipped.length) {
        // Loud on purpose: a silently head-only route looks identical to a working one in `dist`.
        // eslint-disable-next-line no-console
        console.warn(`  prerender SKIPPED  ${skipped.join(', ')}`)
      }
    },
  }
}
