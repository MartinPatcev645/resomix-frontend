import "@resomix/ui/styles.css";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import './i18n.ts';

// Touch config early to validate env at startup
import { CONFIG } from '@resomix/config'
void CONFIG;

// PostHog
import { PostHogProvider } from 'posthog-js/react'
const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} options={options}>
        <App />
      </PostHogProvider>
    </BrowserRouter>
  </StrictMode>,
)
