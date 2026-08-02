import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.ts';
import { SiteHeader } from '../components/Navigation/SiteHeader.tsx';

/**
 * Picking a destination from a desktop dropdown navigated the page but left the panel open on top
 * of it.
 *
 * The close mechanism existed all along — NavPanelContent's row handler calls `onClose?.()` — but
 * `onClose` is optional and only the mobile drawer ever passed one, so on desktop it resolved to
 * undefined and did nothing. The hook's outside-pointerdown listener could not save it either: a
 * link inside the panel is inside the nav, so it is not an "outside" click.
 */

vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>();
  return {
    ...actual,
    useAuthInit: () => ({ isInitialized: true, isLoading: false }),
    useSilktide: () => ({ loaded: false }),
  };
});

/** Open a dropdown by clicking its trigger (pins it open, same as hover-then-click). */
function openFirstDropdown() {
  const trigger = screen.getAllByRole('button', { name: /^product/i })[0];
  fireEvent.click(trigger);
  return trigger;
}

describe('desktop mega menu closes on navigation', () => {
  it('dismisses the panel when a destination inside it is chosen', async () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <SiteHeader variant="desktop" onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    const trigger = openFirstDropdown();
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));

    // Any link inside the open panel.
    const panel = document.querySelector('.nav-mm-pop') as HTMLElement;
    expect(panel).not.toBeNull();
    const link = within(panel).getAllByRole('link')[0];
    fireEvent.click(link);

    // It must both navigate AND close — the bug was that it did only the first.
    expect(onNavigate).toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it('still closes on an outside click', async () => {
    render(
      <MemoryRouter>
        <SiteHeader variant="desktop" onNavigate={vi.fn()} />
      </MemoryRouter>,
    );

    const trigger = openFirstDropdown();
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));

    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });
});
