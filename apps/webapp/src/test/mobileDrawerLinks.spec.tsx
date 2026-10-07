import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@resomix/stores';
import { MobileDrawer } from '../components/Navigation/MobileDrawer.tsx';
import { NAV_UTILITY_LINKS } from '../components/Navigation/betaNavConfig.ts';

/**
 * The drawer used to list the same destinations twice: once as a plain Library/Analysis pair above
 * the feedback CTA, and again below it as a column of icon buttons (Profile / Library / Analysis /
 * Logout), with Catalogue Pilot as yet another standalone button. Four routes, seven controls.
 *
 * Now the app destinations and the pilot share the utility grid — Library, Analysis, Profile,
 * Catalogue Pilot — each with a bare glyph (no circular bezel). Below them: the sign-in link (only
 * when signed out) sits ABOVE the Feedback CTA so it cannot be mistaken for the primary action, and
 * Logout (only when signed in) sits BELOW it.
 */

/** DOM position, for asserting "above"/"below" without depending on layout. */
const orderOf = (el: Element | null) => {
  expect(el).not.toBeNull();
  return [...document.querySelectorAll('*')].indexOf(el as Element);
};

const renderDrawer = () =>
  render(
    <MemoryRouter>
      <div id="webapp-page-root">
        <MobileDrawer isOpen onClose={vi.fn()} onNavigate={vi.fn()} />
      </div>
    </MemoryRouter>,
  );

/** Every control/link carrying this accessible name, so duplicates are visible. */
const named = (name: RegExp) => [
  ...screen.queryAllByRole('link', { name }),
  ...screen.queryAllByRole('button', { name }),
];

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: true });
});

describe('mobile drawer destinations', () => {
  it('lists each app destination exactly once', () => {
    renderDrawer();

    for (const label of [/^library$/i, /^analysis$/i, /^profile$/i, /^catalogue pilot$/i]) {
      expect(named(label)).toHaveLength(1);
    }
  });

  it('puts the four destinations in one grid, in reading order', () => {
    renderDrawer();

    // The grid is two columns filled row-wise, so DOM order IS the visual order:
    //   Library   Analysis
    //   Profile   Catalogue Pilot
    const grid = document.querySelector('.nav-util--app ul');
    expect(grid).not.toBeNull();
    const labels = [...(grid as HTMLElement).querySelectorAll('li')].map((li) =>
      li.textContent?.trim(),
    );
    expect(labels).toEqual(['Library', 'Analysis', 'Profile', 'Catalogue Pilot']);
  });

  it('gives every destination its own icon, with no circular bezel', () => {
    renderDrawer();

    const items = document.querySelectorAll('.nav-util--app li');
    expect(items).toHaveLength(4);
    for (const li of items) {
      expect(li.querySelector('.nav-util-icon svg')).not.toBeNull();
      // .nav-acct is the circular bezel used by the header buttons — not wanted here.
      expect(li.querySelector('.nav-acct')).toBeNull();
    }
  });

  it('puts Logout below Feedback when signed in', () => {
    renderDrawer();

    const feedback = screen.getByRole('button', { name: /feedback/i });
    const logout = screen.getByRole('button', { name: /^logout$/i });
    expect(orderOf(logout)).toBeGreaterThan(orderOf(feedback));
  });

  it('has no Logout when signed out', () => {
    useAuthStore.setState({ isAuthenticated: false });
    renderDrawer();

    expect(named(/^logout$/i)).toHaveLength(0);
  });

  it('signed out: shows only the pilot plus a way in', () => {
    useAuthStore.setState({ isAuthenticated: false });
    renderDrawer();

    expect(named(/^catalogue pilot$/i)).toHaveLength(1);
    for (const label of [/^library$/i, /^analysis$/i, /^profile$/i]) {
      expect(named(label)).toHaveLength(0);
    }
    // The sign-in link must survive the restructure — it is the only route out for a guest —
    // and must sit ABOVE Feedback, so it does not read as part of the footer.
    const signIn = screen.getByRole('link', { name: /account/i });
    const feedback = screen.getByRole('button', { name: /feedback/i });
    expect(orderOf(signIn)).toBeLessThan(orderOf(feedback));
  });

  it('routes a bare landing path through onNavigate instead of a hard location change', () => {
    // landingHref() is a bare path when VITE_BASE_LANDING_URL is unset. A hard
    // window.location.href then loads /about inside the webapp, where that route
    // does not exist. The drawer must hand it to onNavigate, same as the app links.
    const about = NAV_UTILITY_LINKS.find((link) => link.key === 'about');
    expect(about).toBeDefined();
    const original = about!.route;
    about!.route = '/about';

    const onNavigate = vi.fn();
    const onClose = vi.fn();
    try {
      render(
        <MemoryRouter>
          <div id="webapp-page-root">
            <MobileDrawer isOpen onClose={onClose} onNavigate={onNavigate} />
          </div>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('link', { name: /^about$/i }));
      expect(onNavigate).toHaveBeenCalledWith('/about');
      expect(onClose).toHaveBeenCalled();
      expect(window.location.pathname).not.toBe('/about');
    } finally {
      about!.route = original;
    }
  });
});
