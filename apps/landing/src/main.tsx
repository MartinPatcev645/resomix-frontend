import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import './i18n.ts';
import { PAGE_LOADERS } from './routes/pageLoaders.ts'

// Touch config early to validate env at startup
import { CONFIG } from '@resomix/config'
void CONFIG;

const container = document.getElementById('root')!

const tree = (
  <StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>
)

/*
 * Hydrate the prerendered markup when there is some, otherwise render from scratch.
 *
 * The build writes real HTML into #root for every route (see entry-server.tsx). Hydration attaches
 * to that existing DOM instead of rebuilding it, so the page the visitor is already looking at
 * simply becomes interactive — no second paint, no layout shift.
 *
 * The empty-container path still matters: `vite dev` serves the plain shell, and Cloudflare rewrites
 * `/auth/*` to it (that route is a wildcard, so it cannot be a static file).
 */
if (container.hasChildNodes()) {
  /*
   * Wait for the current route's chunk before hydrating.
   *
   * The prerendered HTML contains the fully rendered page. If we hydrate before the lazy chunk has
   * arrived, React's first render hits the Suspense boundary, produces the fallback, and — finding
   * markup it did not expect — throws the prerendered page away. Awaiting the loader means the
   * component is ready on the very first attempt, so hydration matches.
   *
   * `pathname` alone is the key: PAGE_LOADERS is keyed by path, and a miss (a hash link, /auth/*)
   * resolves immediately.
   */
  const path = window.location.pathname.replace(/(.)\/$/, '$1')
  void Promise.resolve(PAGE_LOADERS[path]?.())
    .catch(() => undefined)
    .then(() => hydrateRoot(container, tree))
} else {
  createRoot(container).render(tree)
}
