import { useState, useEffect } from "react";

export function useResponsive() {
  const [isDesktop, setIsDesktop] = useState(() => {
    // Initial check on mount - default to desktop if window is not available (SSR)
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isDesktop, isMobile: !isDesktop };
}
