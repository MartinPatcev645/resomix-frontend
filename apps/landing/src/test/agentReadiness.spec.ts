import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    it('is published and says the things an agent must not assume', () => {
      expect(existsSync(resolve(DIST, 'auth.md')), 'auth.md is not in the build').toBe(true);
      const txt = read('auth.md');
      expect(txt.length, 'auth.md is a stub').toBeGreaterThan(800);

      /* The three claims that keep this page honest. If the product ever changes any of them, this
         file has to change with it, and failing here is how that gets noticed. */
      expect(txt, 'must say there is no public sandbox').toMatch(/no public sandbox/i);
      expect(txt, 'must say bulk account creation is not permitted').toMatch(
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
      expect(headers()).toMatch(/\/auth\.md\s*\n\s*Content-Type:\s*text\/markdown/);
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

  it('still publishes everything the Link header promises', () => {
    for (const file of ['sitemap.xml', 'llms.txt', '.well-known/api-catalog']) {
      expect(existsSync(resolve(DIST, file)), `${file} is advertised but not published`).toBe(true);
    }
  });
});
