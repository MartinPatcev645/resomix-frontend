import { Navigate } from "react-router-dom";
import { useAuthStore } from "@resomix/stores";
import type { ReactNode } from "react";

interface GuestRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Guest Route Guard
 * Redirects authenticated users away from auth pages (login, register)
 * Only allows access to unauthenticated users
 */
export const GuestRoute = ({ children, redirectTo = "/" }: GuestRouteProps) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    // User is already logged in, redirect them away from auth pages
    return <Navigate to={redirectTo} replace />;
  }

  // User is not authenticated, allow access to auth pages
  return <>{children}</>;
};

