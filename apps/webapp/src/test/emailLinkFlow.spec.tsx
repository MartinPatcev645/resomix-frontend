import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import { VerifyEmailContent, ResetPasswordContent } from '@resomix/ui';

const verifyEmail = vi.fn();

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    verifyEmail: (...args: unknown[]) => verifyEmail(...args),
    resendVerification: vi.fn().mockResolvedValue({ success: true }),
  };
});

const originalLocation = window.location;

/** Land the page at a URL the way the redirect from resomix.com would. */
function atUrl(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, search, href: `https://beta.resomix.com/auth${search}` },
  });
}

beforeEach(() => {
  verifyEmail.mockReset();
  verifyEmail.mockResolvedValue({ success: true, data: {} });
});

afterAll(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

/**
 * The receiving half of the resomix.com → beta.resomix.com auth redirect.
 *
 * Verification and password-reset emails are built from FRONTEND_URL (the marketing host), so an
 * emailed link arrives here only because the redirect carried `?token=` across. These assert the
 * webapp then actually consumes it — the redirect preserving the query is worthless if the landing
 * page ignores it.
 */
describe('emailed auth links', () => {
  describe('verify email', () => {
    it('verifies using the token from the URL', async () => {
      atUrl('?token=abc123');
      render(<VerifyEmailContent />);

      await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith('abc123'));
    });

    it('does not call verify when there is no token', async () => {
      atUrl('');
      render(<VerifyEmailContent />);

      await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument());
      expect(verifyEmail).not.toHaveBeenCalled();
    });

    it('verifies only once, so a one-time token is not burned twice', async () => {
      atUrl('?token=once-only');
      const { rerender } = render(<VerifyEmailContent />);
      rerender(<VerifyEmailContent />);

      await waitFor(() => expect(verifyEmail).toHaveBeenCalledTimes(1));
    });
  });

  describe('reset password', () => {
    it('accepts the token from the URL and shows the form', async () => {
      atUrl('?token=reset-me');
      render(<ResetPasswordContent />);

      expect(await screen.findByLabelText(/^new password$/i)).toBeInTheDocument();
      expect(screen.queryByText(/invalid reset link/i)).not.toBeInTheDocument();
    });

    it('shows the expired-link state when the token is missing', async () => {
      atUrl('');
      render(<ResetPasswordContent />);

      expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    });
  });
});
