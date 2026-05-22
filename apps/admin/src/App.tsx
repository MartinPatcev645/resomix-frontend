import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import DashboardLayout from '@/layouts/DashboardLayout.tsx'
import FeedbackPage from '@/pages/FeedbackPage.tsx'
import ContactPage from '@/pages/ContactPage.tsx'
import WaitlistPage from '@/pages/WaitlistPage.tsx'
import PipelinePage from '@/pages/PipelinePage.tsx'
import AnalyticsPage from '@/pages/AnalyticsPage.tsx'
import PlaylistsPage from '@/pages/PlaylistsPage.tsx'
import PlaylistDetailsPage from '@/pages/PlaylistDetailsPage.tsx'
import TracksPage from '@/pages/TracksPage.tsx'
import LogsPage from '@/pages/LogsPage.tsx'
import OperationsPage from '@/pages/OperationsPage.tsx'
import SpotifyAppsPage from '@/pages/SpotifyAppsPage.tsx'
import PartnersPage from '@/pages/PartnersPage.tsx'
import PartnerDetailsPage from '@/pages/PartnerDetailsPage.tsx'
import UsersPage from '@/pages/UsersPage.tsx'
import LoginPage from '@/pages/LoginPage.tsx'
import { useTheme } from '@/hooks/useTheme.ts'
import { lightTheme, darkTheme } from '@/lib/antdTheme.ts'
import { useAuthStore } from '@resomix/stores'

// Route guard for authenticated admin sessions
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Route guard for anonymous/guest sessions
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/feedback" replace />
  }

  return <>{children}</>
}

function App() {
  const { theme } = useTheme()
  
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
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="playlists/:uuid" element={<PlaylistDetailsPage />} />
              <Route path="tracks" element={<TracksPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="operations" element={<OperationsPage />} />
              <Route path="spotify-apps" element={<SpotifyAppsPage />} />
              <Route path="partners" element={<PartnersPage />} />
              <Route path="partners/:id" element={<PartnerDetailsPage />} />
              <Route path="users" element={<UsersPage />} />
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
