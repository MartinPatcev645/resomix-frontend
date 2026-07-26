import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import '../i18n.ts';
import TrustPage from '../pages/TrustPage.tsx';
import { LandingLayout } from '../components/Layout/LandingLayout.tsx';
import { TrRetention } from '../sections/trust/TrRetention.tsx';
import { TrLifecycles } from '../sections/trust/TrLifecycles.tsx';
import { LEGAL_LIBRARY_URL } from '../sections/trust/trData.ts';

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    submitContactForm: vi.fn(),
    resendVerification: vi.fn(),
  };
});

vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>();
  return {
    ...actual,
    useAuthInit: () => ({ isInitialized: true, isLoading: false }),
    useFirstVisit: () => ({ showWelcome: false, dismiss: vi.fn() }),
    useResponsive: () => ({ isDesktop: true, isMobile: false, isTablet: false }),
    useSilktide: () => {},
  };
});

const SOURCE_NOTE =
  'Reflects the Resomix production-beta policies effective 20 July 2026. The published legal documents control.';

describe('TrustPage routing', () => {
  it('renders /trust with H1, status legend, and source note', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <LandingLayout />,
          children: [{ path: '/trust', element: <TrustPage /> }],
        },
      ],
      { initialEntries: ['/trust'] },
    );

    render(<RouterProvider router={router} />);

    await screen.findAllByRole('navigation');
    expect(
      screen.getAllByRole('heading', {
        level: 1,
        name: /your audio\. your rights\. clear boundaries\./i,
      }).length,
    ).toBeGreaterThan(0);

    expect(screen.getAllByText('Current').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agreement-bound').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta control').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Roadmap').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not claimed').length).toBeGreaterThan(0);
    expect(screen.getAllByText(SOURCE_NOTE).length).toBeGreaterThanOrEqual(2);
  });
});

describe('TrustPage copy integrity', () => {
  it('ships the five highest-risk claims verbatim', () => {
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/trust', element: <TrustPage /> }], {
          initialEntries: ['/trust'],
        })}
      />,
    );

    expect(
      screen.getByText(
        'Uploaded source audio is deleted no later than 24 hours after upload or analysis.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'Partner catalogues are logically isolated and restricted to authorised partner access.',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('Resomix uses encrypted HLS for controlled media delivery.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Encrypted HLS for controlled media delivery. Media controls reduce unauthorised access risk; they do not make copying technically impossible.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('User and partner audio is not used to train or fine-tune PYXIS-1.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText(SOURCE_NOTE).length).toBeGreaterThanOrEqual(2);
  });
});

describe('TrustPage disclosure accessibility', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 393,
    });
    window.dispatchEvent(new Event('resize'));
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('lifecycle tabs switch via arrow keys', () => {
    render(<TrLifecycles />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('retention disclosure keeps status visible and opens on Enter', () => {
    render(<TrRetention />);

    const retentionSection = screen.getByRole('treegrid', {
      name: 'Retention register by data category',
    });
    const rows = within(retentionSection).getAllByRole('row');
    const firstRow = rows[0];

    expect(within(firstRow).getByText('Current')).toBeVisible();
    expect(firstRow).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(firstRow, { key: 'Enter' });
    expect(firstRow).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('TrustPage legal links', () => {
  it('uses the published legal library URL', () => {
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/trust', element: <TrustPage /> }], {
          initialEntries: ['/trust'],
        })}
      />,
    );

    const legalLinks = screen.getAllByRole('link', { name: /opens the resomix legal library/i });
    legalLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', LEGAL_LIBRARY_URL);
    });
  });
});
