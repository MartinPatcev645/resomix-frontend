'use client'

import { useEffect } from 'react'

const consentConfig = {
  prompt: { position: 'center' },
  backdrop: { show: true, opacity: 0.7 },
  eventName: 'stcm_consent_update',
  consentTypes: [
    {
      id: 'essential',
      label: 'Essential',
      description:
        'Strictly necessary for the application to function. This includes resomix-auth-storage (login sync) and refresh_token (session management).',
      required: true,
      defaultValue: true,
    },
    {
      id: 'analytics',
      label: 'Analytics & Tracking',
      description:
        'Used for Posthog (feature tracking), Google Analytics, and Google Tag Manager to help us improve the experience.',
      defaultValue: true,
      gtag: 'analytics_storage',
    },
    {
      id: 'functional',
      label: 'Functional Storage',
      description: 'Used to remember your preferences like "Beta Stage" dismissals etc.',
      defaultValue: true,
      gtag: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    },
  ],
}

type ConsentWindow = Window & {
  silktideConsentManager?: { init: (config: typeof consentConfig) => void }
}

/** Loads the existing Silktide script after paint. The stylesheet is already in the document head. */
export function ConsentBanner() {
  useEffect(() => {
    if (document.getElementById('resomix-consent-script')) return
    const script = document.createElement('script')
    script.id = 'resomix-consent-script'
    script.src = '/scripts/resomix-consent.js'
    script.async = true
    script.onload = () => {
      ;(window as ConsentWindow).silktideConsentManager?.init(consentConfig)
    }
    document.body.appendChild(script)
  }, [])
  return null
}
