import { AppBackground } from '@/components/Layout/AppBackground.tsx';
import { SineWaves } from '@resomix/ui';

/**
 * Shown while a page chunk downloads and there is no previous page to keep on screen — a cold load
 * or a direct deep link. The Suspense fallback used to be `null`, which rendered a blank document
 * for the whole download on a slow connection.
 *
 * Deliberately the same treatment as the auth boot screen in App.tsx, so the first paint of a deep
 * link looks like the product rather than a second, different loading style.
 */
export function RouteFallback() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[var(--color-secondary)]"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <AppBackground />
      <div className="relative z-30 w-full max-w-[300px] p-5">
        <SineWaves />
      </div>
    </div>
  );
}
