import type { SilktideConfig } from '@resomix/hooks';

export const consentConfig: SilktideConfig = {
  // 1. MITIGATION: Modal Layout (prevents layout shift)
  prompt: {
    position: 'center', 
  },
  backdrop: {
    show: true,
    opacity: 0.6
  },

  // 2. Branding
  theme: {
    primary: '#EE4A26', // Resomix Neon Orange (confirmed from CSS)
  },

  // 3. Google Consent Mode v2 Mapping
  cookieTypes: [
    {
      id: 'analytics',
      label: 'Analytics',
      // Silktide maps these to gtag('consent', 'update') automatically
      gtag: ['analytics_storage'], 
    },
    {
      id: 'marketing',
      label: 'Marketing',
      // GCM v2 requires these three for ad personalization
      gtag: ['ad_storage', 'ad_user_data', 'ad_personalization'], 
    }
  ]
};
