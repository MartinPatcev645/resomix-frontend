import { useState, useEffect } from 'react';

declare global {
  interface Window {
    silktideConsentManager?: {
      init: (config: any) => void;
    };
  }
}

// Initialized via explicit call as per GitHub README
export const useSilktide = (config: any) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Prevent double initialization
    if (document.getElementById('resomix-consent-script')) {
      // If script is already there, it might have auto-init or we might need to re-init
      // Typical for SPAs is to init once.
      setLoaded(true);
      return;
    }

    // 1. Inject CSS (OS version relies on external CSS)
    const styleId = 'resomix-consent-style';
    if (!document.getElementById(styleId)) {
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = '/scripts/resomix-consent.css';
      document.head.appendChild(link);
    }

    // 2. Inject JS
    const script = document.createElement('script');
    script.id = 'resomix-consent-script';
    script.src = '/scripts/resomix-consent.js';
    script.async = true;

    script.onload = () => {
      // 3. EXPLICIT INIT (Specific requirement of the Open Source Repo version)
      if (window.silktideConsentManager) {
        window.silktideConsentManager.init(config);
        setLoaded(true);
        // console.log('Silktide Consent Manager initialized (GitHub OS version)');
      }
    };

    script.onerror = () => console.error('Failed to load Silktide script');

    document.body.appendChild(script);
  }, [config]);

  return { loaded };
};
