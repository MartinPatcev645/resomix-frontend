import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '@/layouts/DashboardLayout.tsx'
import FeedbackPage from '@/pages/FeedbackPage.tsx'
import ContactPage from '@/pages/ContactPage.tsx'
import WaitlistPage from '@/pages/WaitlistPage.tsx'
import PipelinePage from '@/pages/PipelinePage.tsx'
import AnalyticsPage from '@/pages/AnalyticsPage.tsx'
import PlaylistsPage from '@/pages/PlaylistsPage.tsx'

function App() {
  return (
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
