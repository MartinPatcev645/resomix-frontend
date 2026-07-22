import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@resomix/stores";

/**
 * Protected Route Guard
 * Redirects to login if user is not authenticated
 * Saves intended destination for redirect after login
 */
export const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login, saving the intended destination (path + query) so login returns to the
    // exact view — e.g. /library?tab=tracks, not just /library.
    return <Navigate to="/auth/login" state={{ from: location.pathname + location.search }} replace />;
  }

  // User is authenticated, render child routes
  return <Outlet />;
};

