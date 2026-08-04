import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Lighthouse's "Trust and Safety" group listed five unset headers: CSP, HSTS, COOP, clickjacking
 * protection and Trusted Types. They are informational (unscored) but they are the difference
 * between a site that resists an injected script and one that does not.
 *
 * The CSP ships as **Report-Only** deliberately. It has to cover Google Tag Manager plus whatever
 * GTM injects — PostHog today, anything tomorrow — and a CSP that is even slightly wrong takes the
 * site down. Report-Only surfaces violations without blocking, so it can be tuned against real
 * traffic and then enforced by renaming one header.
 *
 * The embed app is deliberately excluded from the frame rules: being iframed on other sites is its
 * entire purpose.
 */

const ROOT = resolve(process.cwd(), '../..');
const headers = (app: string) => readFileSync(resolve(ROOT, `apps/${app}/public/_headers`), 'utf8');

describe.each(['landing', 'webapp'])('%s security headers', (app) => {
  const h = headers(app);

  it('forces HTTPS with HSTS', () => {
    expect(h).toMatch(/Strict-Transport-Security:\s*max-age=\d+/);
    expect(h).toContain('includeSubDomains');
  });

  it('blocks MIME sniffing', () => {
    expect(h).toContain('X-Content-Type-Options: nosniff');
  });

  it('mitigates clickjacking two ways', () => {
    // XFO for older browsers, frame-ancestors for the rest.
    expect(h).toContain('X-Frame-Options: SAMEORIGIN');
    expect(h).toContain("frame-ancestors 'self'");
  });

  it('does not leak full URLs cross-origin', () => {
    expect(h).toContain('Referrer-Policy: strict-origin-when-cross-origin');
  });

  it('drops capabilities the site never uses', () => {
    expect(h).toMatch(/Permissions-Policy:.*camera=\(\)/);
    expect(h).toMatch(/Permissions-Policy:.*microphone=\(\)/);
  });

  it('ships the CSP as Report-Only, not enforced', () => {
    // Enforcing a wrong CSP is a site outage. Flip this deliberately, after watching reports.
    expect(h).toContain('Content-Security-Policy-Report-Only:');
    expect(h).not.toMatch(/^\s*Content-Security-Policy:/m);
  });

  it('allows the third parties that are actually loaded', () => {
    const csp = h.match(/Content-Security-Policy-Report-Only: (.+)/)![1];
    for (const origin of [
      'https://www.googletagmanager.com',
      'https://accounts.google.com',
      'https://eu.i.posthog.com',
      'https://bserver.resomix.com',
    ]) {
      expect(csp, `${origin} is loaded but not allowed`).toContain(origin);
    }
  });

  it('forbids plugins and restricts form targets', () => {
    const csp = h.match(/Content-Security-Policy-Report-Only: (.+)/)![1];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('omits upgrade-insecure-requests while the policy is report-only', () => {
    // Chrome ignores this directive in a report-only policy and logs an error saying so — once per
    // document, which was five console errors and a Best Practices failure. It goes back when the
    // header is renamed to the enforced `Content-Security-Policy`.
    const csp = h.match(/Content-Security-Policy-Report-Only: (.+)/)![1];
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('allows what the live console proved is needed', () => {
    const csp = h.match(/Content-Security-Policy-Report-Only: (.+)/)![1];
    // Cloudflare injects its analytics beacon at the EDGE, so it appears in no source file here.
    expect(csp, 'Cloudflare beacon').toContain('https://static.cloudflareinsights.com');
    // PostHog's session recorder builds a Worker from a blob: URL; without this it falls back to
    // script-src and trips.
    expect(csp, 'blob worker').toMatch(/worker-src [^;]*blob:/);
  });

  it('keeps hashed assets immutable and HTML revalidated', () => {
    expect(h).toMatch(/\/assets\/\*\n\s*Cache-Control: public, max-age=31536000, immutable/);
    expect(h).toMatch(/\/index\.html\n\s*Cache-Control: public, max-age=0, must-revalidate/);
  });
});

describe('embed stays embeddable', () => {
  const h = headers('embed');

  it('never sets X-Frame-Options', () => {
    // The widget exists to be framed on third-party sites. Comment lines stripped first: the file
    // explains by name that it deliberately does not set this header.
    const live = h.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    expect(live).not.toContain('X-Frame-Options');
  });

  it('explicitly permits framing', () => {
    expect(h).toMatch(/frame-ancestors \*/);
  });
});

describe('social card', () => {
  it.each(['landing', 'webapp'])('%s ships a 1200x630 og-cover', (app) => {
    const file = resolve(ROOT, `apps/${app}/public/og-cover.png`);
    expect(existsSync(file)).toBe(true);
    // PNG IHDR: width and height are big-endian uint32 at bytes 16..24.
    const buf = readFileSync(file);
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
  });

  it.each(['landing', 'webapp'])('%s points its OG tags at it, absolutely', (app) => {
    const html = readFileSync(resolve(ROOT, `apps/${app}/index.html`), 'utf8');
    const imgs = [...html.matchAll(/(?:og:image|twitter:image)" content="([^"]+)"/g)].map((m) => m[1]);
    expect(imgs.length).toBeGreaterThan(0);
    for (const src of imgs) {
      expect(src).toMatch(/^https:\/\/.*og-cover\.png$/);
    }
    // The square logo cropped to a small thumbnail on every platform.
    expect(html).not.toMatch(/(?:og:image|twitter:image)" content="[^"]*logo\.png"/);
  });
});
