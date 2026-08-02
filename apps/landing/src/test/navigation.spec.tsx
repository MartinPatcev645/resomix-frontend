import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.ts';
import { SiteHeader } from '../components/Navigation/SiteHeader.tsx';
import { BASE_BETA_URL } from '@resomix/config';
import {
  NAV_TOP_GROUPS,
  ALLOWED_EXTERNAL_URLS,
  getNavSectionForPath,
} from '../components/Navigation/navData.ts';

vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>();
  return {
    ...actual,
    useAuthInit: () => ({ isInitialized: true, isLoading: false }),
    useFirstVisit: () => ({ showWelcome: false, dismiss: vi.fn() }),
    useResponsive: () => ({ isDesktop: true, isMobile: false, isTablet: false }),
    useSilktide: () => ({ loaded: false }),
  };
});

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    logout: vi.fn(),
  };
});

function renderHeader(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteHeader variant="desktop" onNavigate={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('SiteHeader render', () => {
  it('shows split nav clusters, centred logo, action rail, and account control', () => {
    renderHeader('/');

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    const continuedNav = screen.getByRole('navigation', { name: 'Primary continued' });

    expect(within(primaryNav).getByRole('button', { name: /^product/i })).toBeInTheDocument();
    expect(within(primaryNav).getByRole('button', { name: /^solutions/i })).toBeInTheDocument();
    expect(within(continuedNav).getByRole('button', { name: /^partners/i })).toBeInTheDocument();
    expect(within(continuedNav).getByRole('button', { name: /^developers/i })).toBeInTheDocument();

    expect(document.querySelectorAll('#site-header .nav-cl-logo a[aria-label="Resomix home"]')).toHaveLength(1);
    expect(document.querySelector('#site-header .nav-mrow-logo a[aria-label="Resomix home"]')).toBeInTheDocument();
    expect(document.querySelector('.nav-rail2 a.nav-cta-primary')).toBeInTheDocument();
    expect(document.querySelector('.nav-rail2 a.nav-cta-secondary')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /account/i }).length).toBeGreaterThan(0);
  });

  /**
   * Asserts against the CONFIGURED beta URL rather than the production literal. Hardcoding
   * 'https://beta.resomix.com' meant the test could only pass under a production env — vitest loads
   * .env, where the value is the local dev server — so it failed on every normal run.
   */
  it('Try Resomix CTA links to the configured beta URL', () => {
    renderHeader('/');
    expect(BASE_BETA_URL).toBeTruthy();
    expect(document.querySelector('.nav-rail2 a.nav-cta-primary')).toHaveAttribute(
      'href',
      BASE_BETA_URL,
    );
  });

  it('places product and solutions on the left, partners and developers on the right', () => {
    renderHeader('/');

    const leftNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(leftNav).queryByRole('button', { name: /^partners/i })).not.toBeInTheDocument();
    expect(within(leftNav).queryByRole('button', { name: /^developers/i })).not.toBeInTheDocument();

    const rightNav = screen.getByRole('navigation', { name: 'Primary continued' });
    expect(within(rightNav).queryByRole('button', { name: /^product/i })).not.toBeInTheDocument();
    expect(within(rightNav).queryByRole('button', { name: /^solutions/i })).not.toBeInTheDocument();
  });

  it('uses compact catalogue pilot label on the desktop action rail', () => {
    renderHeader('/');
    expect(document.querySelector('.nav-rail2 a.nav-cta-secondary')).toHaveTextContent(/catalogue pilot/i);
  });
});

describe('Mega menu disclosure a11y', () => {
  it('toggles aria-expanded, ArrowDown focuses first link, Escape closes', async () => {
    renderHeader('/');

    const productTrigger = screen.getByRole('button', { name: /^product/i });
    expect(productTrigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(productTrigger, { key: 'ArrowDown' });
    expect(productTrigger).toHaveAttribute('aria-expanded', 'true');

    const panel = document.getElementById('panel-product');
    expect(panel).toBeTruthy();
    const featuredLink = within(panel!).getByRole('link', { name: /resomix platform/i });
    await waitFor(() => {
      expect(document.activeElement).toBe(featuredLink);
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(productTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(productTrigger);
  });

  it('allows only one panel open at a time', () => {
    renderHeader('/');

    const productTrigger = screen.getByRole('button', { name: /^product/i });
    const partnersTrigger = screen.getByRole('button', { name: /^partners/i });

    fireEvent.click(productTrigger);
    expect(productTrigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(partnersTrigger);
    expect(partnersTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(productTrigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Navigation dead-link guard', () => {
  /**
   * Asserts the INVARIANT, not the current roster: a planned item must never render a link, and a
   * live one must. The previous version hardcoded "every Solutions item is live:false", which was
   * true when written and silently became a false failure the day those pages shipped.
   */
  it('renders links for live items and never for planned ones', () => {
    renderHeader('/');

    fireEvent.click(screen.getByRole('button', { name: /^solutions/i }));
    const panel = document.getElementById('panel-solutions');
    expect(panel).toBeTruthy();

    const solutions = NAV_TOP_GROUPS.find((g) => g.key === 'solutions');
    const items = solutions?.columns?.flatMap((c) => [
      ...(c.featured ? [c.featured] : []),
      ...c.items,
    ]) ?? [];
    expect(items.length).toBeGreaterThan(0);

    const hrefs = within(panel!).queryAllByRole('link').map((a) => a.getAttribute('href') ?? '');

    for (const item of items) {
      if (item.live) {
        expect(hrefs).toContain(item.route);
      } else {
        // A planned page may be listed, but never as something clickable.
        expect(hrefs).not.toContain(item.plannedRoute);
      }
    }
  });

  it('renders only live or allowed external hrefs in open product panel', () => {
    renderHeader('/');

    fireEvent.click(screen.getByRole('button', { name: /^product/i }));
    const links = within(document.getElementById('panel-product')!).getAllByRole('link');
    links.forEach((link) => {
      const href = link.getAttribute('href') ?? '';
      const isInternal = href.startsWith('/');
      const isAllowedExternal = ALLOWED_EXTERNAL_URLS.some((url) => href.startsWith(url));
      expect(isInternal || isAllowedExternal).toBe(true);
      expect(href).not.toMatch(/\/solutions\//);
      expect(href).not.toContain('/partners/integrations');
    });
  });
});

describe('Navigation current page', () => {
  it('marks sonic discovery as current and product as section', () => {
    renderHeader('/product/sonic-discovery');

    expect(getNavSectionForPath('/product/sonic-discovery')).toBe('product');
    expect(document.getElementById('mi-product')).toHaveClass('is-section');

    fireEvent.click(screen.getByRole('button', { name: /^product/i }));
    const currentLink = within(document.getElementById('panel-product')!).getByRole('link', {
      name: /sonic discovery/i,
    });
    expect(currentLink).toHaveAttribute('aria-current', 'page');
  });
});
