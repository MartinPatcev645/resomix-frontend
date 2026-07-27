import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Import the admin auth store early so it registers itself as the api-client's auth store.
import { useAdminAuthStore } from './store/adminAuthStore.ts'
import App from './App.tsx'

// Definitive registration (after all imports evaluate): the shared api-client authenticates and
// refreshes against the ADMIN session, never the main site's — regardless of module-load order.
;(globalThis as unknown as Record<string, unknown>).__RESOMIX_AUTH_STORE__ = useAdminAuthStore
;(globalThis as unknown as Record<string, unknown>).__RESOMIX_AUTH_REFRESH_PATH__ = '/api/v1/admin/auth/refresh'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
