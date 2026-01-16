import { useState, useEffect } from 'react';

// Typed strictly according to Silktide Docs
export interface SilktideConfig {
  prompt?: {
    position?: 'center' | 'bottomRight' | 'bottomLeft';
  };
  backdrop?: {
    show?: boolean;
    opacity?: number;
  };
  theme?: {
    primary?: string;
    text?: string;
  };
  text?: any;
  cookieTypes?: any[];
}

export const useSilktide = (config: SilktideConfig) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // 1. Mount Config to Window
    // @ts-ignore
    window.silktideCookieBannerConfig = config;

    // 2. Load Local Script (Cache-busting optional but recommended in prod)
    const scriptId = 'silktide-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = '/scripts/silktide-consent-manager.js'; // Points to public/scripts
      
      script.onload = () => {
        setLoaded(true);
        console.log('Silktide loaded locally');
      };
      
      script.onerror = () => console.error('Failed to load Silktide script');
      
      document.body.appendChild(script);
    } else {
      setLoaded(true);
    }

    // 3. Load Local CSS
    const styleId = 'silktide-style';
    if (!document.getElementById(styleId)) {
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = '/scripts/silktide-consent-manager.css';
      document.head.appendChild(link);
    }
  }, [config]);

  return { loaded };
};
