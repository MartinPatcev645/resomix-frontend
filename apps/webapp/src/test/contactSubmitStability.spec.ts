import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContactSubmit } from '@resomix/hooks';

/**
 * Regression guard for an infinite render loop on the contact page.
 *
 * ContactContent pre-fills a signed-in user's name/email from an effect that lists
 * `setFormValues` in its dependency array. While that function was rebuilt on every render, the
 * effect re-ran on every render → setForm produced a new object → re-render → a new function
 * again. React threw "Maximum update depth exceeded", the page froze, and router navigations away
 * from /contact never committed (the URL changed but the old page stayed on screen).
 *
 * So: `setFormValues` must keep the same identity across renders, including renders caused by its
 * own updates. Anything that makes it unstable again reintroduces the freeze.
 */
describe('useContactSubmit', () => {
  it('keeps setFormValues referentially stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useContactSubmit());
    const first = result.current.setFormValues;

    rerender();
    expect(result.current.setFormValues).toBe(first);
  });

  it('keeps setFormValues stable across the re-render its own call triggers', () => {
    const { result } = renderHook(() => useContactSubmit());
    const first = result.current.setFormValues;

    act(() => {
      result.current.setFormValues({ name: 'Ada', email: 'ada@example.com' });
    });

    // The state really changed — so this is a genuine re-render, not a no-op...
    expect(result.current.form.name).toBe('Ada');
    expect(result.current.form.email).toBe('ada@example.com');
    // ...and the function survived it unchanged. This is the exact cycle that used to run away.
    expect(result.current.setFormValues).toBe(first);
  });
});
