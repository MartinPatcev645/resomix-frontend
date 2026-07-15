import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'

// Touch config early to validate env at startup
import { CONFIG } from '@resomix/config'
void CONFIG;

// Compute the guest device signal early (fire-and-forget) so the first gated request already
// carries X-Device-Hash. Degrades silently if the fingerprint script is blocked.
//
// PRIVACY (Phase 8.3): this is anti-abuse / fair-usage enforcement processed under **legitimate
// interest**, disclosed in the "Essential" consent category (see config/consentConfig.ts). It is
// intentionally NOT gated behind the optional Analytics consent — do not move it inside a consent
// check, or fair-usage limits would silently stop working when analytics is declined.
import { initDeviceHash } from '@resomix/api-client'
void initDeviceHash();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
)
