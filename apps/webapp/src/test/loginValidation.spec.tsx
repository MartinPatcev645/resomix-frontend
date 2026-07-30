import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import { LoginContent } from '@resomix/ui';

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    login: vi.fn().mockResolvedValue({ success: false, error: 'Invalid credentials.' }),
  };
});

const REQUIRED_MSG = /email or username is required/i;

const field = () => screen.getByRole('textbox', { name: /email or username/i });
const signInButton = () => screen.getByRole('button', { name: /^sign in$/i });

/**
 * jsdom does not run the form-submission algorithm when a submit button is clicked, so dispatch
 * the event on the form itself. That the button really IS a submit control inside the form — the
 * thing that makes a real browser (and the Enter key) reach this handler — is asserted separately
 * below, so no part of the fix goes unchecked.
 */
const submitForm = () => fireEvent.submit(signInButton().closest('form')!);

describe('LoginContent', () => {
  /**
   * The email field is autoFocused and useFormValidation validates on blur, so clicking anywhere
   * on the page used to blur it and immediately show "Email or username is required" — before the
   * user had typed anything.
   */
  describe('field validation timing', () => {
    it('shows no error on mount', () => {
      render(<LoginContent />);
      expect(screen.queryByText(REQUIRED_MSG)).not.toBeInTheDocument();
    });

    it('stays quiet when the autofocused field is blurred without typing', () => {
      render(<LoginContent />);

      // Exactly what "click somewhere else on the page" does to the focused input.
      fireEvent.blur(field());

      expect(screen.queryByText(REQUIRED_MSG)).not.toBeInTheDocument();
    });

    it('shows the error once the user actually submits an empty form', async () => {
      render(<LoginContent />);
      submitForm();

      expect(await screen.findByText(REQUIRED_MSG)).toBeVisible();
    });

    it('clears the error as the user types after a failed submit', async () => {
      render(<LoginContent />);
      submitForm();
      expect(await screen.findByText(REQUIRED_MSG)).toBeVisible();

      // Live-updating after a submit attempt is why handleSubmit marks every field touched.
      fireEvent.change(field(), { target: { value: 'ada@example.com' } });

      await waitFor(() => {
        expect(screen.queryByText(REQUIRED_MSG)).not.toBeInTheDocument();
      });
    });
  });

  describe('form wiring', () => {
    // The old button was a ButtonSleek, which hardcodes type="button" — the form had no submit
    // control at all, so pressing Enter in a field did nothing.
    it('makes Sign In a real submit control inside the form', () => {
      render(<LoginContent />);

      expect(signInButton()).toHaveAttribute('type', 'submit');
      expect(signInButton().closest('form')).not.toBeNull();
    });

    // Both fields labelled with <span> meant the inputs had no accessible name at all.
    it('gives both fields accessible names', () => {
      render(<LoginContent />);

      expect(field()).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });
  });
});
