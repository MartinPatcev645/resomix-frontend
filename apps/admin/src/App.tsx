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
import { useTheme } from '@/hooks/useTheme.ts'
import { lightTheme, darkTheme } from '@/lib/antdTheme.ts'

function App() {
  const { theme } = useTheme()
  
  return (
    <ConfigProvider theme={theme === 'light' ? lightTheme : darkTheme}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<DashboardLayout />}>
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
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
