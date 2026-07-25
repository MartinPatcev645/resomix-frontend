import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import '../i18n.ts';
import PartnersPilotPage from '../pages/PartnersPilotPage.tsx';
import { LandingLayout } from '../components/Layout/LandingLayout.tsx';
import { PpApplyForm } from '../sections/partners-pilot/PpApplyForm.tsx';
import { submitContactForm } from '@resomix/api-client';

vi.mock('@resomix/api-client', () => ({
  submitContactForm: vi.fn(),
  resendVerification: vi.fn(),
}));

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

describe('PartnersPilotPage', () => {
  it('renders the hero H1', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PartnersPilotPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /test resomix on your own catalogue/i }),
    ).toBeInTheDocument();
  });
});

describe('App routing', () => {
  it('renders /partners/pilot with navbar chrome', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <LandingLayout />,
          children: [{ path: '/partners/pilot', element: <PartnersPilotPage /> }],
        },
      ],
      { initialEntries: ['/partners/pilot'] },
    );

    render(<RouterProvider router={router} />);

    const navs = await screen.findAllByRole('navigation');
    expect(navs.length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('heading', {
        level: 1,
        name: /test resomix on your own catalogue/i,
      }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('contentinfo').length).toBeGreaterThan(0);
  });
});

describe('PpApplyForm', () => {
  const mockedSubmit = vi.mocked(submitContactForm);

  beforeEach(() => {
    mockedSubmit.mockReset();
  });

  it('shows required errors on empty submit and does not call API', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PpApplyForm />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /request pilot review/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid work email address/i)).toBeVisible();
    });
    expect(mockedSubmit).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('pp-f-email');
  });

  it('shows email error for invalid email', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PpApplyForm />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/partner type/i), {
      target: { value: 'Label / label group' },
    });
    fireEvent.change(screen.getByLabelText(/primary pilot question/i), {
      target: { value: 'Can we surface older tracks?' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /request pilot review/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid work email address/i)).toBeVisible();
    });
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit when rights unchecked with all else valid', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PpApplyForm />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/partner type/i), {
      target: { value: 'Distributor' },
    });
    fireEvent.change(screen.getByLabelText(/primary pilot question/i), {
      target: { value: 'Can we surface older tracks?' },
    });

    fireEvent.click(screen.getByRole('button', { name: /request pilot review/i }));

    await waitFor(() => {
      expect(screen.getByText(/rights confirmation is required/i)).toBeVisible();
    });
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it('submits valid form and shows success panel', async () => {
    mockedSubmit.mockResolvedValue({ success: true });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PpApplyForm />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme Records' } });
    fireEvent.change(screen.getByLabelText(/partner type/i), {
      target: { value: 'Label / label group' },
    });
    fireEvent.change(screen.getByLabelText(/primary pilot question/i), {
      target: { value: 'Can current references surface relevant tracks from our 2010–2016 catalogue?' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /request pilot review/i }));

    await waitFor(() => {
      expect(mockedSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = mockedSubmit.mock.calls[0][0];
    expect(payload.contact_type).toBe('partner');
    expect(payload.message).toContain('PILOT INQUIRY');
    expect(payload.email).toBe('jane@example.com');
    expect(payload.name).toBe('Jane Doe');
    expect(payload.company_name).toBe('Acme Records');

    await waitFor(() => {
      expect(screen.getByText(/inquiry received/i)).toBeInTheDocument();
      expect(
        screen.getByText(/resomix reviews fit against the qualification principles above/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/ingestion begins only after approval/i)).toBeInTheDocument();
    });
  });
});
