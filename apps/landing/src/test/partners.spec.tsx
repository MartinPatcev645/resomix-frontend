import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import '../i18n.ts';
import PartnersPage from '../pages/PartnersPage.tsx';
import PartnersPilotPage from '../pages/PartnersPilotPage.tsx';
import { LandingLayout } from '../components/Layout/LandingLayout.tsx';
import { PnContactForm } from '../sections/partners/PnContactForm.tsx';
import { submitContactForm } from '@resomix/api-client';
import { softHyphenName } from './matchers.ts';

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

describe('PartnersPage', () => {
  it('renders the new H1 and junction', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PartnersPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /make your catalogue part of sound-first discovery/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /partner junction diagram/i })).toBeInTheDocument();
  });

  it('contains zero legacy sandbox console or carousel content', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PartnersPage />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain('rmx_sandbox_demo');
    expect(text).not.toContain('Try the Sandbox Catalog');
    expect(text).not.toContain('8-Slide Onboarding Journey');
    expect(text).not.toContain('B2B PARTNERS');
    expect(text).not.toContain('Developer Sandbox');
  });

  it('/partners/pilot still renders its own page', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PartnersPilotPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: softHyphenName(/test pyxis-1 on the music that matters to your team/i) }),
    ).toBeInTheDocument();
  });
});

describe('App routing — /partners', () => {
  it('renders /partners with navbar chrome', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <LandingLayout />,
          children: [{ path: '/partners', element: <PartnersPage /> }],
        },
      ],
      { initialEntries: ['/partners'] },
    );

    render(<RouterProvider router={router} />);

    await screen.findAllByRole('navigation');
    expect(
      screen.getAllByRole('heading', {
        level: 1,
        name: /make your catalogue part of sound-first discovery/i,
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe('PnContactForm', () => {
  const mockedSubmit = vi.mocked(submitContactForm);

  beforeEach(() => {
    mockedSubmit.mockReset();
  });

  it('shows required errors on empty submit and does not call API', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PnContactForm />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /contact partnerships/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid work email address/i)).toBeVisible();
    });
    expect(mockedSubmit).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('pn-f-email');
  });

  it('sends every qualification answer as its own field, not flattened into the message', async () => {
    mockedSubmit.mockResolvedValue({ success: true });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PnContactForm />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'partner@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme Label' } });
    fireEvent.change(screen.getByLabelText(/partner type/i), {
      target: { value: 'Label / label group' },
    });
    fireEvent.change(screen.getByLabelText(/preferred path/i), {
      target: { value: 'Private Catalogue Pilot' },
    });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'Head of Catalogue' } });
    fireEvent.change(screen.getByLabelText(/catalogue or product context/i), {
      target: { value: '~40k tracks, own storefront' },
    });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Free text only.' } });

    fireEvent.click(screen.getByRole('button', { name: /contact partnerships/i }));

    await waitFor(() => {
      expect(mockedSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockedSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_type: 'partner',
        name: 'Jane Doe',
        email: 'partner@example.com',
        company_name: 'Acme Label',
        role: 'Head of Catalogue',
        partner_type: 'Label / label group',
        preferred_path: 'Private Catalogue Pilot',
        catalog_context: '~40k tracks, own storefront',
        // `message` is the submitter's free text and nothing else — the answers above used to be
        // pasted into it as a "PARTNER INQUIRY" blob, which left them unqueryable in admin.
        message: 'Free text only.',
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /thanks, your request was submitted\. check your email for confirmation; we'll get back to you in 2–5 business days\./i,
        ),
      ).toBeVisible();
    });
  });
});
