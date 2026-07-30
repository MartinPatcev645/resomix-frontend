import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SineWaves } from '@resomix/ui';
import { BASE_BETA_URL } from '@resomix/config';
import { AppBackground } from './Layout/AppBackground.tsx';

/**
 * Auth and account screens live ONLY on the web app (beta). Anything under /auth on the marketing
 * site — plus /profile, /sessions and /change-password — forwards to the same path on beta.
 *
 * The path, query string and hash are all carried across, and that is load-bearing rather than
 * tidiness: the backend builds verification and password-reset emails from FRONTEND_URL, which is
 * the marketing host, so links already sitting in people's inboxes look like
 *
 *     https://resomix.com/auth/reset-password?token=…
 *     https://resomix.com/auth/verify-email?token=…
 *
 * Forwarding those to a bare login page would silently discard the token and leave the account
 * unverifiable / the password unresettable. Preserving the URL means every link ever sent keeps
 * working, whatever FRONTEND_URL is set to.
 *
 * `location.replace` rather than `assign` so the marketing URL leaves no history entry — otherwise
 * Back from beta would bounce straight into this redirect again.
 *
 * Nothing here touches how auth is managed: the session is shared across the two hosts already,
 * so this is purely a routing decision about where the screens are served from.
 */
export function BetaAuthRedirect() {
  const location = useLocation();

  useEffect(() => {
    const base = BASE_BETA_URL.replace(/\/$/, '');
    window.location.replace(`${base}${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);

  // Matches App.tsx's boot screen, so the hand-off doesn't flash a blank page.
  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[var(--color-secondary)]"
      role="status"
      aria-label="Redirecting to sign in"
    >
      <AppBackground />
      <div className="relative z-30 w-full max-w-[300px] p-5">
        <SineWaves />
      </div>
    </div>
  );
}

export default BetaAuthRedirect;
