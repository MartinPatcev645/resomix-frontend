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

/**
 * The email field is autoFocused and useFormValidation validates on blur, so clicking anywhere on
 * the page used to blur it and immediately show "Email or username is required" — before the user
 * had typed anything. Errors must wait for a real submit attempt.
 */
describe('LoginContent field validation', () => {
  it('shows no error on mount', () => {
    render(<LoginContent />);
    expect(screen.queryByText(REQUIRED_MSG)).not.toBeInTheDocument();
  });

  it('stays quiet when the autofocused field is blurred without typing', () => {
    render(<LoginContent />);

    // Exactly what "click somewhere else on the page" does to the focused input.
    fireEvent.blur(screen.getByRole('textbox', { name: /email or username/i }));

    expect(screen.queryByText(REQUIRED_MSG)).not.toBeInTheDocument();
  });

  it('shows the error once the user actually submits an empty form', async () => {
    render(<LoginContent />);

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(REQUIRED_MSG)).toBeVisible();
  });

  it('clears the error as the user types after a failed submit', async () => {
    render(<LoginContent />);
    const field = screen.getByRole('textbox', { name: /email or username/i });

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(REQUIRED_MSG)).toBeVisible();

    // Live-updating after a submit attempt is the reason handleSubmit marks fields touched.
    fireEvent.change(field, { target: { value: 'ada@example.com' } });

    await waitFor(() => {
      expect(screen.queryByText(REQUIRED_MSG)).not.toBeInTheDocument();
    });
  });
});
