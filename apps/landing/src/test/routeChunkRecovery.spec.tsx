import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Suspense } from 'react';
import { lazyRoute, clearChunkReloadGuard } from '@/routes/lazyRoute.ts';
import { routeKeyOf } from '@/routes/pageLoaders.ts';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary.tsx';

/**
 * Navigation on resomix.com silently died after a deploy: a tab open across a release still asked
 * for the previous build's hash-named chunk, the import 404'd, and with no error boundary the click
 * simply did nothing. React.lazy also memoises the settled promise, so the route stayed dead for
 * the rest of the session.
 *
 * These cover the recovery contract, which is the part that cannot be checked by eye — it only
 * misbehaves against a real CDN mid-deploy.
 */

const Ok = () => <p>loaded</p>;
const okModule = { default: Ok };

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

const renderRoute = (loader: () => Promise<{ default: React.ComponentType }>) => {
  const Page = lazyRoute(loader);
  return render(
    <RouteErrorBoundary resetKey="/test">
      <Suspense fallback={<p>loading</p>}>
        <Page />
      </Suspense>
    </RouteErrorBoundary>,
  );
};

describe('chunk load recovery', () => {
  it('renders normally when the chunk downloads', async () => {
    renderRoute(() => Promise.resolve(okModule));
    expect(await screen.findByText('loaded')).toBeInTheDocument();
  });

  it('retries once, so a dropped request on a weak connection still lands', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(okModule);

    renderRoute(load);

    expect(await screen.findByText('loaded')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    // A recoverable blip must not cost the user a page reload.
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once when the chunk is genuinely gone (deploy replaced the hash)', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Failed to fetch dynamically imported module'));

    renderRoute(load);

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not reload a second time — a broken build must not become a reload loop', async () => {
    const load = vi.fn().mockRejectedValue(new Error('404'));

    renderRoute(load); // spends the session's single reload
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    reload.mockClear();
    renderRoute(load); // same session, guard already set

    // Instead of reloading again it must surface a recoverable error.
    expect(await screen.findByText(/page failed to load/i)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('re-arms the reload after any successful load, so the NEXT deploy can recover too', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('404'));
    renderRoute(failing);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    // A later successful navigation proves the document is current again.
    renderRoute(() => Promise.resolve(okModule));
    expect(await screen.findByText('loaded')).toBeInTheDocument();

    reload.mockClear();
    renderRoute(failing);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('shows a recoverable error rather than a blank screen when recovery is exhausted', async () => {
    sessionStorage.setItem('rx-chunk-reload', '1');
    renderRoute(() => Promise.reject(new Error('boom')));

    expect(await screen.findByText(/page failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('survives sessionStorage being unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    renderRoute(() => Promise.resolve(okModule));
    expect(await screen.findByText('loaded')).toBeInTheDocument();
  });
});

describe('clearChunkReloadGuard', () => {
  it('re-arms recovery', () => {
    sessionStorage.setItem('rx-chunk-reload', '1');
    clearChunkReloadGuard();
    expect(sessionStorage.getItem('rx-chunk-reload')).toBeNull();
  });
});

describe('prefetch target resolution', () => {
  it('maps real nav hrefs to loaders', () => {
    expect(routeKeyOf('/product/sonic-discovery')).toBe('/product/sonic-discovery');
    expect(routeKeyOf('/')).toBe('/');
  });

  it('ignores the hash and query a nav target may carry', () => {
    expect(routeKeyOf('/product#compare')).toBe('/product');
    expect(routeKeyOf('/trust?ref=nav')).toBe('/trust');
  });

  it('accepts absolute URLs on this origin', () => {
    expect(routeKeyOf(`${window.location.origin}/developers`)).toBe('/developers');
  });

  it('refuses cross-origin and non-routes, so prefetch never fires a stray request', () => {
    expect(routeKeyOf('https://beta.resomix.com/upload')).toBeNull();
    expect(routeKeyOf('#contact')).toBeNull();
    expect(routeKeyOf('/nope')).toBeNull();
    expect(routeKeyOf('')).toBeNull();
  });
});
