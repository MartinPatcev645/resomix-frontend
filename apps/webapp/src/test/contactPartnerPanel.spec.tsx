import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';
import { ContactContent } from '@resomix/ui';

/**
 * The contact page is shared by landing AND the webapp, but `/partners` only exists on landing.
 *
 * This suite lives in the WEBAPP on purpose: here `ContactContent` receives `baseUrl={BASE_BETA_URL}`,
 * so building the link from that prop would produce beta.resomix.com/partners#contact — a route that
 * does not exist. The panel must always point at the landing origin.
 */

const renderContact = () =>
  render(
    <MemoryRouter>
      <ContactContent baseUrl={BASE_BETA_URL} />
    </MemoryRouter>,
  );

const partnerLink = () => screen.getByRole('link', { name: /partnership form/i });

describe('contact page partnership panel', () => {
  it('links to the partners form, ignoring the page baseUrl prop', () => {
    // A distinctive origin: locally both VITE_BASE_BETA_URL and VITE_BASE_LANDING_URL are
    // http://localhost:5173, so comparing against BASE_BETA_URL could not tell the two apart.
    // Passing a sentinel proves the href is built from the landing config, not the prop.
    render(
      <MemoryRouter>
        <ContactContent baseUrl="https://prop-must-be-ignored.example" />
      </MemoryRouter>,
    );
    const href = partnerLink().getAttribute('href') ?? '';

    expect(href).toMatch(/\/partners#contact$/);
    expect(href).not.toContain('prop-must-be-ignored.example');
  });

  it('never emits a bare path, even if the landing origin is unset', () => {
    renderContact();
    const href = partnerLink().getAttribute('href') ?? '';
    // A relative "/partners#contact" would 404 inside the webapp.
    expect(href).toMatch(/^https?:\/\//);
  });

  it('is a real anchor, not a router link', () => {
    renderContact();
    // Cross-origin: client-side routing cannot reach the landing app.
    expect(partnerLink().tagName).toBe('A');
  });

  it('sits after the support channel', () => {
    renderContact();
    const order = [...document.querySelectorAll('*')];
    const kickers = screen.getAllByText(/customer support|partnerships/i);
    const positions = kickers.map((k) => order.indexOf(k));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(kickers).toHaveLength(2);
  });

  it('has no Business Inquiries panel', () => {
    // Removed once the partnership panel shipped: it routed to the same support@resomix.com as
    // Customer Support, so it was a third box that told the reader nothing new.
    renderContact();
    expect(screen.queryByText(/business inquiries/i)).not.toBeInTheDocument();
  });

  it('explains what a partner would actually be asking for', () => {
    renderContact();
    expect(screen.getByText(/api access|catalogue integration|private pilot/i)).toBeInTheDocument();
  });
});
