import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Minify the hand-written assets under `public/scripts/`.
 *
 * Anything in `public/` is copied verbatim — Vite never processes it — so `resomix-consent.js` was
 * shipping unminified. Lighthouse flagged it: 11.9 KiB transferred, 5.3 KiB of that recoverable.
 *
 * Minifying at build time keeps the readable, commented source in the repo while shipping the
 * compact version. The consent banner is loaded at runtime by `useSilktide`, which injects a
 * <script src="/scripts/resomix-consent.js">, so the filename must not change.
 *
 * `transform` is injected by the caller rather than imported here. This file lives outside any app,
 * where pnpm's isolated store makes both `esbuild` and `vite` unresolvable; each app passes Vite's
 * own `transformWithEsbuild`.
 */

type Transform = (
  code: string,
  filename: string,
  options?: { minify?: boolean; target?: string },
) => Promise<{ code: string }>

export function minifyPublicScripts(options: { outDir: string; transform: Transform }): {
  name: string
  apply: 'build'
  closeBundle(): Promise<void>
} {
  return {
    name: 'minify-public-scripts',
    apply: 'build',
    async closeBundle() {
      const { outDir, transform } = options
      const dir = path.resolve(outDir, 'scripts')
      if (!existsSync(dir)) return

      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.js') && !file.endsWith('.css')) continue
        const full = path.join(dir, file)
        const source = readFileSync(full, 'utf8')
        // The consent banner runs for every visitor, including older mobile browsers.
        const { code } = await transform(source, full, { minify: true, target: 'es2017' })
        writeFileSync(full, code)
        // eslint-disable-next-line no-console
        console.log(
          `  minified          scripts/${file}  ` +
            `${(source.length / 1024).toFixed(1)}K -> ${(code.length / 1024).toFixed(1)}K`,
        )
      }
    },
  }
}
