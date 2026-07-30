import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.ts';
import { SiteHeader } from '../components/Navigation/SiteHeader.tsx';
import { BASE_BETA_URL } from '@resomix/config';
import { useAuthStore } from '@resomix/stores';

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
  return { ...actual, logout: vi.fn() };
});

function renderHeader(variant: 'desktop' | 'mobile', path = '/partners') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteHeader variant={variant} onNavigate={vi.fn()} />
    </MemoryRouter>,
  );
}

/**
 * The account control lives in a different rail per variant.
 *
 * Queried through the DOM rather than by ARIA role on purpose: vitest runs with `css: true`, and
 * `.nav-mrow` (the mobile row) is `display: none` in the base stylesheet — it is revealed by a
 * max-width media query that jsdom never applies. That makes the whole mobile header invisible to
 * `getByRole`, so role queries silently find nothing on the variant we most need to assert on.
 */
const rail = (variant: 'desktop' | 'mobile') =>
  document.querySelector<HTMLElement>(
    variant === 'mobile' ? '.nav-mrow-right' : '#site-header .nav-cl-right',
  )!;

/** Open the account dropdown in the given rail and return its item labels, in order. */
function openAccountMenu(variant: 'desktop' | 'mobile'): string[] {
  const trigger = rail(variant).querySelector<HTMLElement>('button.nav-acct')!;
  fireEvent.click(trigger);
  return Array.from(rail(variant).querySelectorAll('[role="menuitem"]')).map((el) =>
    (el.textContent ?? '').trim(),
  );
}

describe('landing header account control', () => {
  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null } as never);
  });

  describe('signed out', () => {
    beforeEach(() => {
      useAuthStore.setState({ isAuthenticated: false, user: null } as never);
    });

    // Signing in happens on the WEBAPP, and the post-login redirect is resolved by the webapp's
    // router — so it has to be a webapp path. Passing the current landing path (e.g. /partners)
    // used to drop people on beta.resomix.com/partners, a 404, right after a successful sign-in.
    it.each(['desktop', 'mobile'] as const)(
      'sends %s to the beta login and back to the workspace, not to a landing path',
      (variant) => {
        renderHeader(variant, '/partners');

        const href = rail(variant).querySelector('a.nav-acct')!.getAttribute('href')!;
        const url = new URL(href);

        expect(href.startsWith(BASE_BETA_URL)).toBe(true);
        expect(url.pathname).toBe('/auth/login');
        expect(url.searchParams.get('redirect')).toBe('/');
        expect(href).not.toContain('partners');
      },
    );
  });

  describe('signed in', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: 1, username: 'ada', email: 'ada@example.com' },
      } as never);
    });

    it('offers only Logout on mobile', () => {
      renderHeader('mobile');
      expect(openAccountMenu('mobile')).toEqual(['Logout']);
    });

    it('still offers the full menu on desktop', () => {
      renderHeader('desktop');
      const labels = openAccountMenu('desktop');

      expect(labels).toContain('Logout');
      expect(labels.length).toBeGreaterThan(1);
    });
  });
});
