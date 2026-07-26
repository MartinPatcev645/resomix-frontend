import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.ts';
import { MobileDrawer } from '../components/Navigation/MobileDrawer.tsx';

vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>();
  return {
    ...actual,
    useAuthInit: () => ({ isInitialized: true, isLoading: false }),
    useSilktide: () => ({ loaded: false }),
  };
});

describe('MobileDrawer accordions', () => {
  it('opens one accordion at a time', () => {
    render(
      <MemoryRouter>
        <div id="landing-page-root">
          <MobileDrawer isOpen onClose={vi.fn()} onNavigate={vi.fn()} />
        </div>
      </MemoryRouter>,
    );

    const root = document.getElementById('landing-page-root');
    if (root && 'inert' in root) {
      (root as HTMLElement).inert = true;
    }

    const product = screen.getByRole('button', { name: /^product/i });
    const solutions = screen.getByRole('button', { name: /^solutions/i });

    fireEvent.click(product);
    expect(product).toHaveAttribute('aria-expanded', 'true');
    expect(solutions).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(solutions);
    expect(solutions).toHaveAttribute('aria-expanded', 'true');
    expect(product).toHaveAttribute('aria-expanded', 'false');
  });
});
