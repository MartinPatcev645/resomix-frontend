export const consentConfig = {
  // 1. Branding & Layout
  prompt: {
    position: 'center', // Modal layout
  },
  backdrop: {
    show: true,
    opacity: 0.7
  },
  eventName: 'stcm_consent_update', 

  // 2. Consent Types (Refined for GDPR/Data Governance)
  consentTypes: [
    {
      id: 'essential',
      label: 'Essential',
      description: 'Strictly necessary for the application to function. This includes resomix-auth-storage (login sync) and refresh_token (session management).',
      required: true,
      defaultValue: true,
    },
    {
      id: 'analytics',
      label: 'Analytics & Tracking',
      description: 'Used for Posthog (feature tracking), Google Analytics, and Google Tag Manager to help us improve the experience.',
      defaultValue: true,
      gtag: 'analytics_storage', 
    },
    {
      id: 'functional',
      label: 'Functional Storage',
      description: 'Used to remember your preferences like "Beta Stage" dismissals etc.',
      defaultValue: true,
      gtag: ['ad_storage', 'ad_user_data', 'ad_personalization'], 
    }
  ]
};
