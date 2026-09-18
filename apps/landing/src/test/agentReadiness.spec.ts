import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTE_SEO } from '@/routes/seoConfig.ts';

/**
 * The files that exist only for automated clients.
 *
 * None of these are reachable from the site, nobody opens them by accident, and nothing on a page
 * breaks if one disappears. That is exactly why they need a test: a static file with no visible
 * consumer is the kind of thing that survives until someone tidies `public/` and then nobody
 * notices for a year.
 *
 * They come from Cloudflare's agent readiness scan, run on resomix.com in September 2026. The
 * findings and the reasoning are in docs/AGENT_READINESS_FINDINGS.md.
 *
 * These assertions read the BUILT output, because the point is what the deploy actually serves.
 */

const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const read = (file: string) => readFileSync(resolve(DIST, file), 'utf8');

/** Every host these files are allowed to point at. A typo to somewhere else should fail loudly. */
const ALLOWED_HOSTS = [
  'resomix.com',
  'api-docs.resomix.com',
  'beta.resomix.com',
  'legal.resomix.com',
  'blog.resomix.com',
];

const hostOf = (url: string) => new URL(url).host;

/**
 * Collapse newlines so a phrase can be matched regardless of where the prose happens to wrap.
 *
 * These files are hand-written and hard-wrapped at 100 columns, so a sentence moves across lines
 * whenever a word ahead of it changes. Matching the raw text means an assertion fails for reasons
 * that have nothing to do with what the file says, which is exactly what happened the first time
 * this suite ran.
 */
const prose = (text: string) => text.replace(/\s+/g, ' ');

describe.skipIf(!built)('files published for automated clients', () => {
  describe('robots.txt', () => {
    it('declares the content signals, inside the wildcard user-agent group', () => {
      const lines = read('robots.txt')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));

      const group = lines.indexOf('User-agent: *');
      const signal = lines.findIndex((l) => l.startsWith('Content-Signal:'));
      expect(group, 'no wildcard user-agent group').toBeGreaterThanOrEqual(0);
      expect(signal, 'no Content-Signal line').toBeGreaterThan(group);

      /* All three are yes, decided 18 September 2026. `ai-train` is the one that needed a call: it
         covers the marketing text only and is how an assistant knows the brand without searching. */
      expect(lines[signal]).toBe('Content-Signal: search=yes, ai-input=yes, ai-train=yes');
    });

    it('still allows crawling and still points at the sitemap', () => {
      // Cloudflare's Bot Preference Sync would rewrite this file from a dashboard setting and drop
      // every rule below the block it manages. This is the check that would catch that.
      const txt = read('robots.txt');
      expect(txt).toContain('Allow: /');
      expect(txt).toContain('Sitemap: https://resomix.com/sitemap.xml');
      expect(txt, 'nothing here may block a crawler wholesale').not.toMatch(/^Disallow:\s*\/\s*$/m);
    });
  });

  describe('the API catalogue, RFC 9727', () => {
    const path = '.well-known/api-catalog';

    it('is valid JSON in the linkset shape', () => {
      expect(existsSync(resolve(DIST, path)), `${path} is not in the build`).toBe(true);
      const doc = JSON.parse(read(path)) as { linkset: Array<Record<string, unknown>> };
      expect(Array.isArray(doc.linkset)).toBe(true);
      expect(doc.linkset.length).toBeGreaterThan(0);
      for (const entry of doc.linkset) {
        expect(typeof entry.anchor, 'every linkset entry needs an anchor').toBe('string');
      }
    });

    it('lists at least one API and points at documentation for it', () => {
      const doc = JSON.parse(read(path)) as {
        linkset: Array<{ anchor: string; item?: unknown[]; 'service-doc'?: unknown[] }>;
      };
      const catalogue = doc.linkset.find((e) => e.anchor.endsWith('/.well-known/api-catalog'));
      expect(catalogue?.item?.length, 'the catalogue names no API').toBeGreaterThan(0);
      const described = doc.linkset.some((e) => (e['service-doc']?.length ?? 0) > 0);
      expect(described, 'no API in the catalogue has documentation links').toBe(true);
    });

    it('points only at Resomix hosts, over https', () => {
      const urls = [...read(path).matchAll(/"href":\s*"([^"]+)"/g)].map((m) => m[1]);
      expect(urls.length).toBeGreaterThan(0);
      const offenders = urls.filter(
        (u) => !u.startsWith('https://') || !ALLOWED_HOSTS.includes(hostOf(u)),
      );
      expect(offenders, 'these are not Resomix https addresses').toEqual([]);
    });
  });

  describe('auth.md', () => {
    it('opens with an H1 naming the standard, which is what the scanner looks for', () => {
      // Cloudflare's scan reported "auth.md exists but is missing the expected Auth.md heading"
      // when this file led with a descriptive title instead. The check is on the first heading.
      const first = read('auth.md').split('\n').find((l) => l.startsWith('# '));
      expect(first, 'auth.md has no H1').toBeDefined();
      expect(first!.toLowerCase(), 'the H1 must contain "auth.md"').toContain('auth.md');
    });

    it('is published and says the things an agent must not assume', () => {
      expect(existsSync(resolve(DIST, 'auth.md')), 'auth.md is not in the build').toBe(true);
      const txt = read('auth.md');
      expect(txt.length, 'auth.md is a stub').toBeGreaterThan(800);

      /* Self-contained is the standard's fallback when there is no OAuth metadata to point at, and
         it is the branch we are on. It asks for the audience, the endpoints, the methods and how
         credentials are used. */
      expect(prose(txt), 'must name its audience').toMatch(/## Audience/i);
      expect(txt, 'must give the registration endpoint').toContain(
        'https://beta.resomix.com/auth/register',
      );
      expect(txt, 'must give the sign-in endpoint').toContain(
        'https://beta.resomix.com/auth/login',
      );
      expect(prose(txt), 'must say why no OAuth metadata is published').toMatch(
        /oauth-protected-resource/i,
      );

      /* The clause that keeps this page from contradicting the Terms. An auth.md that invited an
         agent to take someone's password would breach the same policy the pricing page states. */
      expect(prose(txt), 'must not invite credential sharing').toMatch(
        /sharing or transferring account credentials/i,
      );

      /* The three claims that keep this page honest. If the product ever changes any of them, this
         file has to change with it, and failing here is how that gets noticed. */
      expect(prose(txt), 'must say there is no public sandbox').toMatch(/no public sandbox/i);
      expect(prose(txt), 'must say bulk account creation is not permitted').toMatch(
        /automated or bulk account creation is not permitted/i,
      );
      expect(txt, 'must link the Terms, which is the governing document').toContain(
        'https://legal.resomix.com/legal/terms/',
      );
    });

    it('points only at Resomix hosts, over https', () => {
      const urls = [...read('auth.md').matchAll(/https?:\/\/[^\s)>,]+/g)].map((m) =>
        m[0].replace(/[.,]$/, ''),
      );
      const offenders = urls.filter(
        (u) => !u.startsWith('https://') || !ALLOWED_HOSTS.includes(hostOf(u)),
      );
      expect(offenders, 'these are not Resomix https addresses').toEqual([]);
    });
  });

  describe('_headers', () => {
    const headers = () => read('_headers');

    it('gives the extensionless catalogue and auth.md their media types', () => {
      // Neither has an extension Pages can infer a type from, and a catalogue served as text/plain
      // does not count as published.
      expect(headers()).toMatch(
        /\/\.well-known\/api-catalog\s*\n\s*Content-Type:\s*application\/linkset\+json/,
      );
      expect(headers()).toMatch(/\/\*\.md\s*\n\s*Content-Type:\s*text\/markdown/);
    });

    it('advertises the catalogue, the sitemap and llms.txt in the response', () => {
      const txt = headers();
      expect(txt).toMatch(/Link:\s*<\/\.well-known\/api-catalog>;\s*rel="api-catalog"/);
      expect(txt).toMatch(/Link:\s*<\/sitemap\.xml>;\s*rel="sitemap"/);
      expect(txt).toMatch(/Link:\s*<\/llms\.txt>;\s*rel="alternate"/);
    });

    it('keeps the headers that were already there', () => {
      // This file also carries HSTS, the report-only CSP and the caching rule that fixed navigation
      // breaking after a deploy. Anything added here is additive, never a rewrite.
      const txt = headers();
      expect(txt).toContain('Strict-Transport-Security:');
      expect(txt).toContain('Content-Security-Policy-Report-Only:');
      expect(txt).toMatch(/\/assets\/\*\s*\n\s*Cache-Control:\s*public, max-age=31536000, immutable/);
    });
  });

  describe('the Markdown twins', () => {
    /* Cloudflare sells this as a Pro switch. We generate the files at build time instead, from the
       prerendered HTML, so what an agent reads is a conversion of what a browser is served rather
       than a second rendering of the same data. See tooling/markdownForAgents.ts. */
    const ROUTES = Object.keys(ROUTE_SEO).filter(
      (route) => route !== '/404' && !ROUTE_SEO[route].noindex,
    );
    const fileFor = (route: string) => (route === '/' ? 'index' : route.replace(/^\//, ''));

    it('exists for every indexable route that has a page', () => {
      const missing = ROUTES.filter((route) => {
        const base = fileFor(route);
        /* Redirect and hand-off shells have no <main> and nothing to convert. */
        if (!existsSync(resolve(DIST, `${base}.html`))) return false;
        if (!readFileSync(resolve(DIST, `${base}.html`), 'utf8').includes('<main')) return false;
        return !existsSync(resolve(DIST, `${base}.md`));
      });
      expect(missing, 'these routes have no Markdown twin').toEqual([]);
    });

    it('carries the real prose, not an empty shell', () => {
      /*
       * A low floor on purpose. This catches a conversion that produced nothing, which is the
       * failure that matters and the one the first version of the converter actually hit. It is not
       * a rule about how long a page should be. `/waitlist` is 90 words because the page is a
       * heading, two sentences and a form, and dropping the form is deliberate.
       */
      const thin = ROUTES.filter((route) => {
        const file = resolve(DIST, `${fileFor(route)}.md`);
        if (!existsSync(file)) return false;
        const words = readFileSync(file, 'utf8').split(/\s+/).filter(Boolean).length;
        return words < 40;
      });
      expect(thin, 'these Markdown twins converted to nothing').toEqual([]);
    });

    it('keeps the page heading, so the twin is recognisably the same page', () => {
      const offenders: string[] = [];
      for (const route of ROUTES) {
        const base = fileFor(route);
        if (!existsSync(resolve(DIST, `${base}.md`))) continue;
        const html = readFileSync(resolve(DIST, `${base}.html`), 'utf8');
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
        const words = h1
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-z]+;/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3);
        if (!words.length) continue;
        const md = readFileSync(resolve(DIST, `${base}.md`), 'utf8');
        if (!words.some((w) => md.includes(w))) offenders.push(route);
      }
      expect(offenders, 'these twins do not contain their page heading').toEqual([]);
    });

    it('leaves no React comment separators in the output', () => {
      // React writes `<!-- -->` between adjacent text expressions. Left in, they read as literal
      // text in the Markdown, which is what the first version of the converter shipped.
      const dirty = ROUTES.filter((route) => {
        const file = resolve(DIST, `${fileFor(route)}.md`);
        return existsSync(file) && readFileSync(file, 'utf8').includes('<!-- -->');
      });
      expect(dirty, 'these twins contain React comment separators').toEqual([]);
    });

    it('is advertised from the HTML page it belongs to', () => {
      const unlinked = ROUTES.filter((route) => {
        const base = fileFor(route);
        if (!existsSync(resolve(DIST, `${base}.md`))) return false;
        return !readFileSync(resolve(DIST, `${base}.html`), 'utf8').includes(
          `<link rel="alternate" type="text/markdown" href="/${base}.md"`,
        );
      });
      expect(unlinked, 'these pages do not link their Markdown twin').toEqual([]);
    });

    it('is not indexable, because it duplicates a page that already has a canonical', () => {
      expect(read('_headers')).toMatch(/\/\*\.md[\s\S]{0,160}?X-Robots-Tag:\s*noindex/);
    });
  });

  it('still publishes everything the Link header promises', () => {
    for (const file of ['sitemap.xml', 'llms.txt', '.well-known/api-catalog']) {
      expect(existsSync(resolve(DIST, file)), `${file} is advertised but not published`).toBe(true);
    }
  });
});
