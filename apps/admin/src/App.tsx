import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import DashboardLayout from '@/layouts/DashboardLayout.tsx'
import FeedbackPage from '@/pages/FeedbackPage.tsx'
import ContactPage from '@/pages/ContactPage.tsx'
import WaitlistPage from '@/pages/WaitlistPage.tsx'
import PipelinePage from '@/pages/PipelinePage.tsx'
import AnalyticsPage from '@/pages/AnalyticsPage.tsx'
import PlansPage from '@/pages/PlansPage.tsx'
import PlaylistsPage from '@/pages/PlaylistsPage.tsx'
import PlaylistDetailsPage from '@/pages/PlaylistDetailsPage.tsx'
import PlaylistRatingsPage from '@/pages/PlaylistRatingsPage.tsx'
import TracksPage from '@/pages/TracksPage.tsx'
import LogsPage from '@/pages/LogsPage.tsx'
import OperationsPage from '@/pages/OperationsPage.tsx'
import SpotifyAppsPage from '@/pages/SpotifyAppsPage.tsx'
import PartnersPage from '@/pages/PartnersPage.tsx'
import PartnerDetailsPage from '@/pages/PartnerDetailsPage.tsx'
import UsersPage from '@/pages/UsersPage.tsx'
import UserDetailsPage from '@/pages/UserDetailsPage.tsx'
import LoginPage from '@/pages/LoginPage.tsx'
import { useTheme } from '@/hooks/useTheme.ts'
import { lightTheme, darkTheme } from '@/lib/antdTheme.ts'
import { useAdminAuthStore } from '@/store/adminAuthStore.ts'
import { useAdminAuthInit } from '@/hooks/useAdminAuthInit.ts'

function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  )
}

// Route guard for authenticated admin sessions. While the on-load session check runs we show a
// loader (never a protected screen); an unauthenticated/expired session is sent to /login.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuthStore()

  if (isLoading) return <AuthLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Route guard for the login screen. Also waits for the session check so a valid session lands on the
// dashboard instead of flashing the login form.
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuthStore()

  if (isLoading) return <AuthLoader />
  if (isAuthenticated) return <Navigate to="/feedback" replace />
  return <>{children}</>
}

function App() {
  const { theme } = useTheme()
  // Validate the admin session on load; gates the whole app via the guards above.
  useAdminAuthInit()

  return (
    <ConfigProvider theme={theme === 'light' ? lightTheme : darkTheme}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            {/* Public Guest Routes */}
            <Route 
              path="/login" 
              element={
                <GuestRoute>
                  <LoginPage />
                </GuestRoute>
              } 
            />

            {/* Protected Administrative Dashboard Layout */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/feedback" replace />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="waitlist" element={<WaitlistPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="jobs" element={<Navigate to="/pipeline" replace />} />
              <Route path="processing-jobs" element={<Navigate to="/pipeline" replace />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="playlists/:uuid" element={<PlaylistDetailsPage />} />
              <Route path="playlists/:uuid/ratings" element={<PlaylistRatingsPage />} />
              <Route path="tracks" element={<TracksPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="operations" element={<OperationsPage />} />
              <Route path="spotify-apps" element={<SpotifyAppsPage />} />
              <Route path="partners" element={<PartnersPage />} />
              <Route path="partners/:id" element={<PartnerDetailsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:uuid" element={<UserDetailsPage />} />
            </Route>

            {/* Fallback Catch-All Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
