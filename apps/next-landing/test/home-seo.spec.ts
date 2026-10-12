import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertLastmod, canonicalUrl, sitemapRoutes } from '../lib/seo'

/**
 * SEO and accessibility checks against the static export.
 * Route-specific cases are scoped to `/`.
 * TODO: extend to later routes when they are added to this app.
 */

const ROOT = process.cwd()
const OUT = resolve(ROOT, 'out')
const htmlPath = resolve(OUT, 'index.html')

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

const html = existsSync(htmlPath) ? read(htmlPath) : ''

function meta(name: string, attr: 'name' | 'property' = 'name'): string | undefined {
  const re = new RegExp(`<meta\\b[^>]*${attr}="${name}"[^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  if (!tag) {
    const swapped = new RegExp(`<meta\\b[^>]*content="([^"]*)"[^>]*${attr}="${name}"`, 'i')
    return html.match(swapped)?.[1]
  }
  return tag.match(/content="([^"]*)"/)?.[1]
}

function jsonLdBlocks(): unknown[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  return blocks.map((match) => JSON.parse(match[1] ?? '{}') as unknown)
}

function graphs(): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []
  for (const block of jsonLdBlocks()) {
    if (!block || typeof block !== 'object') continue
    const graph = (block as { '@graph'?: unknown })['@graph']
    if (Array.isArray(graph)) nodes.push(...(graph as Record<string, unknown>[]))
  }
  return nodes
}

describe('exported homepage', () => {
  it('writes out/index.html', () => {
    expect(existsSync(htmlPath), 'run next build before these tests').toBe(true)
  })

  it('sets lang, title, description, canonical, robots and theme-color', () => {
    expect(html).toMatch(/<html[^>]*lang="en"/)
    expect(html).toContain('<title>Resomix: Find &amp; Analyse Electronic Music by Sound</title>')
    expect(meta('description')).toBe(
      'Resomix finds electronic music by how it sounds. Drop one track and its PYXIS-1 engine returns a ranked shortlist, reads one recording or searches a catalogue.',
    )
    expect(html).toMatch(/<link[^>]*rel="canonical"[^>]*href="https:\/\/resomix\.com\/"/)
    expect(meta('robots')).toMatch(/index,\s*follow/)
    expect(meta('theme-color')).toBe('#000000')
  })

  it('ships Open Graph and Twitter cards with an absolute image', () => {
    expect(meta('og:title', 'property')).toBe('Resomix: Find &amp; Analyse Electronic Music by Sound')
    expect(meta('og:url', 'property')).toBe('https://resomix.com/')
    expect(meta('og:description', 'property')).toContain('PYXIS-1')
    expect(meta('og:image', 'property')).toBe('https://resomix.com/og-cover.png')
    expect(meta('twitter:card')).toBe('summary_large_image')
    expect(meta('twitter:title')).toContain('Resomix')
  })

  it('escapes the ampersand in the title', () => {
    expect(html).toContain('Find &amp; Analyse')
    expect(html).not.toMatch(/<title>[^<]*Find & Analyse/)
  })

  it('points the icon at the png logo', () => {
    expect(html).toMatch(/rel="icon"[^>]*href="\/logo\.png"|href="\/logo\.png"[^>]*rel="icon"/)
  })

  it('has one h1, a main landmark, and the hero figure name', () => {
    const h1s = html.match(/<h1\b/g) ?? []
    expect(h1s).toHaveLength(1)
    expect(html).toMatch(/<h1[^>]*>[\s\S]*what belongs next/)
    expect(html).toMatch(/<main\b/)
    expect(html).toContain('One piece of music enters Resomix')
  })

  it('renders FAQ copy that matches the FAQPage JSON-LD', () => {
    // TODO: homepage FAQ answers contain no internal hrefs. When they do, assert the
    // href shape. Do not require the target HTML file — those routes are not exported yet.
    const faq = graphs().find((node) => node['@type'] === 'FAQPage')
    expect(faq).toBeTruthy()
    const entities = faq?.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>
    expect(entities.length).toBeGreaterThan(0)
    for (const item of entities) {
      expect(html).toContain(item.name)
      expect(html).toContain(item.acceptedAnswer.text.slice(0, 40))
    }
    expect(graphs().some((node) => node['@type'] === 'BreadcrumbList')).toBe(false)
  })

  it('includes Organization and WebSite nodes and valid JSON-LD', () => {
    expect(jsonLdBlocks().length).toBeGreaterThan(0)
    const types = graphs().map((node) => node['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
    expect(types).toContain('WebPage')
  })

  it('exposes named navigation links, including /about', () => {
    expect(html).toMatch(/<nav\b[^>]*aria-label="Primary"/)
    expect(html).toContain('href="/about"')
    expect(html).toContain('About Resomix')
    const internal = [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1])
    expect(internal.filter((href) => !href.startsWith('/_next') && !href.startsWith('/fonts')).length).toBeGreaterThan(5)
  })

  it('does not leak raw translation keys or relative asset urls', () => {
    expect(html).not.toContain('home.hero.')
    expect(html).not.toMatch(/(src|href)="\.\.?\/[^"]*assets/)
    expect(html).toMatch(/(src|href)="\//)
  })

  it('preloads the three first-paint font files', () => {
    const preloads = [...html.matchAll(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g)].map((match) => match[0])
    expect(preloads.length).toBeGreaterThanOrEqual(3)
    const joined = preloads.join('\n')
    expect(joined).toMatch(/benzin-bold\.latin|Benzin/i)
    expect(joined).toMatch(/HelveticaNeueLight\.latin|Helvetica/i)
    expect(joined).toMatch(/FiraCode-Medium\.latin|Fira/i)
    expect(joined).toMatch(/crossorigin/i)
  })
})

describe('sitemap and robots', () => {
  it('lists every indexable ROUTE_SEO entry with its content lastmod', () => {
    const xml = read(resolve(OUT, 'sitemap.xml'))
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1])
    const routes = sitemapRoutes()
    expect(locs).toEqual(routes.map((route) => canonicalUrl(route.path)))
    expect(locs).toContain('https://resomix.com/')
    for (const route of routes) expect(xml).toContain(`<lastmod>${route.lastmod}</lastmod>`)
  })

  it('guards lastmod against missing, malformed and future dates', () => {
    const today = '2026-10-08'
    expect(() => assertLastmod('/x', undefined, today)).toThrow(/needs a lastmod/)
    expect(() => assertLastmod('/x', '2026-10-8', today)).toThrow(/needs a lastmod/)
    expect(() => assertLastmod('/x', '2026-10-09', today)).toThrow(/in the future/)
    expect(assertLastmod('/x', '2026-10-08', today)).toBe('2026-10-08')
  })

  it('gives every registered route a lastmod', () => {
    const today = new Date().toISOString().slice(0, 10)
    for (const route of sitemapRoutes()) expect(() => assertLastmod(route.path, route.lastmod, today)).not.toThrow()
  })

  it('allows crawling and points at the sitemap', () => {
    const txt = read(resolve(OUT, 'robots.txt'))
    expect(txt).toMatch(/Allow:\s*\//)
    expect(txt).toContain('Sitemap: https://resomix.com/sitemap.xml')
  })
})

describe('third-party staging', () => {
  const layout = read(resolve(ROOT, 'app/layout.tsx'))

  it('keeps gtm.js out of the static HTML', () => {
    expect(html).not.toContain('googletagmanager.com/gtm.js')
  })

  it('injects GTM through the staged client component instead', () => {
    // Without this, "gtm.js absent" would also pass if GTM never loaded at all.
    expect(layout).toMatch(/<GoogleTagManager\s*\/>/)
    const component = read(resolve(ROOT, 'components/GoogleTagManager.tsx'))
    expect(component).toContain('useGoogleTagManager(GTM_ID, analyticsReady)')
  })

  it('ships inline Consent Mode defaults and the noscript fallback with one container id', () => {
    expect(html).toMatch(/gtag\(\s*"consent"\s*,\s*"default"/)
    expect(html).toMatch(/analytics_storage:\s*"denied"/)
    expect(html).toContain('ns.html?id=GTM-PD9XQZRV')
    expect(layout).not.toContain('GTM-PD9XQZRV')
  })
})

describe('beta stage notice', () => {
  it('ships the banner in the exported HTML', () => {
    expect(html).toContain('data-demo-banner')
    expect(html).toContain('Beta Stage Notice')
  })

  it('hides a dismissed banner before first paint', () => {
    expect(html).toMatch(/localStorage\.getItem\("demo_stage_notice_dismissed"\)/)
    expect(html).toMatch(/\[data-demo-dismissed\]\s*\[data-demo-banner\]\s*\{\s*display:\s*none/)
  })
})

describe('security headers file', () => {
  const headers = read(resolve(ROOT, 'public/_headers'))

  it('forces HTTPS, blocks sniffing, and frames the page same-origin', () => {
    expect(headers).toMatch(/Strict-Transport-Security:\s*max-age=\d+/)
    expect(headers).toContain('includeSubDomains')
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('X-Frame-Options: SAMEORIGIN')
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin')
    expect(headers).toContain('Content-Security-Policy-Report-Only:')
  })
})
