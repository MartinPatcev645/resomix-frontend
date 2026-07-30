import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.ts';
import { SiteHeader } from '../components/Navigation/SiteHeader.tsx';
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

/** Open the account dropdown and return its menu. */
function openAccountMenu() {
  fireEvent.click(screen.getByRole('button', { name: /account/i }));
  return screen.getByRole('menu', { name: /account menu/i });
}

describe('landing header account control', () => {
  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null } as never);
  });

  describe('signed out', () => {
    beforeEach(() => {
      useAuthStore.setState({ isAuthenticated: false, user: null } as never);
    });

    // Signing in happens on the webapp, and the post-login redirect is resolved by the WEBAPP's
    // router — so it must be a webapp path. Passing the landing path (e.g. /partners) used to
    // land people on beta.resomix.com/partners, a 404, right after a successful sign-in.
    it.each(['desktop', 'mobile'] as const)(
      'sends %s to the beta login and back to the workspace, not to a landing path',
      (variant) => {
        renderHeader(variant, '/partners');

        const href = screen
          .getAllByRole('link', { name: /account/i })[0]
          .getAttribute('href')!;
        const url = new URL(href);

        expect(url.host).toContain('beta');
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
      const menu = openAccountMenu();

      const labels = within(menu)
        .getAllByRole('menuitem')
        .map((el) => el.textContent?.trim());

      expect(labels).toEqual(['Logout']);
    });

    it('still offers the full menu on desktop', () => {
      renderHeader('desktop');
      const menu = openAccountMenu();

      expect(within(menu).getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
      expect(within(menu).getAllByRole('menuitem').length).toBeGreaterThan(1);
    });
  });
});
