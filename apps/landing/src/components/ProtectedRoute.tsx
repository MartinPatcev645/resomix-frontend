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
    // Redirect to login, save intended destination
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  // User is authenticated, render child routes
  return <Outlet />;
};

