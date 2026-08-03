import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GlobalFooter, GlobalMobileFooter } from '@resomix/ui';

/**
 * The footer's legal entry pointed at support.resomix.com while calling itself `open('/support')` —
 * so there was no route to the legal library at all, and the label described the wrong destination.
 * Legal now goes to legal.resomix.com, and support is its own entry between legal and contact.
 *
 * Covered here because the footer is shared: one component pair serves landing AND webapp, desktop
 * and mobile, so a regression would land on every page of both apps at once.
 */

const LEGAL = 'https://legal.resomix.com';
const SUPPORT = 'https://support.resomix.com';

/** DOM position, to assert ordering without depending on layout. */
const orderOf = (el: Element) => [...document.querySelectorAll('*')].indexOf(el);

const variants = [
  ['desktop', GlobalFooter] as const,
  ['mobile', GlobalMobileFooter] as const,
];

describe.each(variants)('%s footer links', (_name, Footer) => {
  const renderFooter = () =>
    render(
      <MemoryRouter>
        <Footer baseUrl="https://resomix.com" onNavigate={vi.fn()} />
      </MemoryRouter>,
    );

  it('sends legal to the legal library, not support', () => {
    renderFooter();
    const legal = document.getElementById('footer-legal-link');
    expect(legal).not.toBeNull();
    expect(legal).toHaveAttribute('href', LEGAL);
  });

  it('has a separate support entry', () => {
    renderFooter();
    const support = document.getElementById('footer-support-link');
    expect(support).not.toBeNull();
    expect(support).toHaveAttribute('href', SUPPORT);
  });

  it('orders them legal → support → contact', () => {
    renderFooter();
    const legal = document.getElementById('footer-legal-link')!;
    const support = document.getElementById('footer-support-link')!;
    const contact = document.getElementById('footer-contact-link')!;
    expect(orderOf(legal)).toBeLessThan(orderOf(support));
    expect(orderOf(support)).toBeLessThan(orderOf(contact));
  });

  it('opens both external links in a new tab, safely', () => {
    renderFooter();
    for (const id of ['footer-legal-link', 'footer-support-link']) {
      const el = document.getElementById(id)!;
      expect(el).toHaveAttribute('target', '_blank');
      // Without noopener the opened page can reach back via window.opener.
      expect(el.getAttribute('rel') ?? '').toContain('noopener');
    }
  });

  it('gives each link a distinct accessible name', () => {
    renderFooter();
    const names = ['footer-legal-link', 'footer-support-link'].map(
      (id) => document.getElementById(id)!.getAttribute('aria-label'),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(names.every(Boolean)).toBe(true);
  });
});

describe('desktop footer labels', () => {
  it('describes the destination it actually opens', () => {
    render(
      <MemoryRouter>
        <GlobalFooter baseUrl="https://resomix.com" onNavigate={vi.fn()} />
      </MemoryRouter>,
    );
    // The label is the bug's most visible symptom: it said '/support' under "legal".
    expect(screen.getByText(/legal\.info\(\): open\('\/legal'\)/)).toBeInTheDocument();
    expect(screen.getByText(/support\.to\(\): open\('\/support'\)/)).toBeInTheDocument();
  });
});
