import { StrictMode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
/* MemoryRouter, not StaticRouter: `react-router-dom/server` is not resolvable as a subpath under
   this workspace's NodeNext setup, and for a build-time render at a fixed location the two produce
   identical markup — nothing here ever navigates. */
import { MemoryRouter } from 'react-router-dom';
import App from './App.tsx';
import './i18n.ts';
import { PAGE_LOADERS } from './routes/pageLoaders.ts';

/**
 * Build-time renderer. Never shipped to the browser — this module is compiled into its own bundle
 * (`vite.config.ssr.ts`) that only the build process loads.
 *
 * WHY THIS EXISTS
 * ---------------
 * `tooling/prerenderHead.ts` already gives every route its own HTML file with the correct <head>,
 * which fixed link previews. But the BODY of those files was still just `<div id="root"></div>` —
 * so anything that reads the response without executing JavaScript saw a page with no H1, no copy
 * and no internal links. Googlebot renders JS and was fine; LLM crawlers, AI answer engines and
 * anyone reading view-source were not.
 *
 * This renders the real React tree for each route at build time and bakes the result into that same
 * file, so the markup is in the response. The client then HYDRATES it (see main.tsx) rather than
 * rebuilding it, which also means the hero paints without waiting on JavaScript at all.
 *
 * THE HYDRATION CONTRACT
 * ----------------------
 * Whatever this produces, the browser's first render must reproduce exactly, or React discards the
 * markup and re-renders — slower than shipping no markup at all. Two things the build cannot know
 * are therefore rendered in a fixed "unknown" state here and corrected in a layout effect on the
 * client: the visitor's auth state and their viewport. See `useHydrated` / `useResponsive`.
 */

/** `prerenderToNodeStream` resolves lazy routes and Suspense boundaries; `renderToString` does not. */
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function renderRoute(url: string): Promise<string> {
  /*
   * Warm the route's chunk AND its locale slice before rendering.
   *
   * React would resolve the lazy component on its own, but the loader is also what registers the
   * page's i18n bundle (see pageLoaders.ts). Awaiting it here means the strings are in i18next
   * before the first render attempt, so no boundary ever renders with missing keys.
   */
  await PAGE_LOADERS[url]?.().catch(() => undefined);

  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <MemoryRouter
        initialEntries={[url]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>
    </StrictMode>,
    {
      onError(error) {
        // Surface the route that failed — a silent empty body would look like a successful build.
        console.error(`  prerender error on ${url}:`, error);
      },
    },
  );

  return streamToString(prelude);
}
