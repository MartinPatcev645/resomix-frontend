import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@resomix/stores";
import { getPostAuthRedirect } from "@/utils/authRedirect.ts";
import type { ReactNode } from "react";

interface GuestRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Guest Route Guard
 * Redirects authenticated users away from auth pages (login, register).
 *
 * On login the auth store flips `isAuthenticated` before the success handler's own navigation
 * commits, so THIS guard is what actually moves the just-logged-in user off `/auth/login`. It must
 * therefore send them to where they came from (the `?redirect=` / router-state / persisted target —
 * e.g. a shared playlist's `?id=`), NOT a hard-coded home. Sending them home was the "beta home for
 * a couple of seconds, then the playlist" bounce. Falls back to `/` only when nothing is set.
 */
export const GuestRoute = ({ children, redirectTo }: GuestRouteProps) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    const fromState = (location.state as { from?: string })?.from;
    const fromQuery = new URLSearchParams(location.search).get("redirect");
    const target = redirectTo || fromState || fromQuery || getPostAuthRedirect() || "/";
    return <Navigate to={target} replace />;
  }

  // User is not authenticated, allow access to auth pages
  return <>{children}</>;
};
