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
}

/** `dist/index.html` for `/`, `dist/about/index.html` for `/about`. Mirrors prerenderHead. */
function htmlPathFor(clientDir: string, route: string): string {
  return route === '/'
    ? path.resolve(clientDir, 'index.html')
    : path.resolve(clientDir, route.replace(/^\//, ''), 'index.html')
}

const ROOT_RE = /(<div id="root">)(<\/div>)/

export function prerenderBodies(
  options: PrerenderBodiesOptions,
): { name: string; apply: 'build'; closeBundle(): Promise<void> } {
  const { routes, clientDir, serverEntry, notFound } = options

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

      const targets = [
        ...routes.map((route) => ({ url: route, file: htmlPathFor(clientDir, route) })),
        ...(notFound ? [{ url: notFound.url, file: path.resolve(clientDir, '..', notFound.file) }] : []),
      ]

      let written = 0
      let bytes = 0
      const skipped: string[] = []

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

        const html = readFileSync(file, 'utf8')
        if (!ROOT_RE.test(html)) {
          skipped.push(`${url} (no empty #root to fill)`)
          continue
        }

        // Function replacer: rendered markup contains `$` sequences that a string replacement
        // would interpret ($&, $1 …) and silently corrupt.
        writeFileSync(file, html.replace(ROOT_RE, (_m, open: string, close: string) => open + markup + close))
        written++
        bytes += Buffer.byteLength(markup)
      }

      // eslint-disable-next-line no-console
      console.log(
        `  prerendered body   ${written}/${targets.length} routes, ${(bytes / 1024).toFixed(0)} KiB markup`,
      )
      if (skipped.length) {
        // Loud on purpose: a silently head-only route looks identical to a working one in `dist`.
        // eslint-disable-next-line no-console
        console.warn(`  prerender SKIPPED  ${skipped.join(', ')}`)
      }
    },
  }
}
