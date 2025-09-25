import { create } from "zustand";

const COOKIE_NAME = "resomix_terms_accepted";
const COOKIE_VALUE = "1";
const COOKIE_DOMAIN = ".resomix.com"; // applies to all sub-domains

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, domain?: string) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/`;
  if (domain) cookie += `; domain=${domain}`;
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + oneYearMs).toUTCString();
  cookie += `; Expires=${expires}; SameSite=Lax`;
  document.cookie = cookie;
}

interface TermsAcceptanceStore {
  showTerms: boolean;
  isAccepted: boolean;
  pendingResolve: ((value: boolean) => void) | null;
  setShowTerms: (show: boolean) => void;
  setIsAccepted: (accepted: boolean) => void;
  setPendingResolve: (resolve: ((value: boolean) => void) | null) => void;
}

const useTermsAcceptanceStore = create<TermsAcceptanceStore>((set) => ({
  showTerms: false,
  isAccepted: getCookie(COOKIE_NAME) === COOKIE_VALUE,
  pendingResolve: null,
  setShowTerms: (show) => set({ showTerms: show }),
  setIsAccepted: (accepted) => set({ isAccepted: accepted }),
  setPendingResolve: (resolve) => set({ pendingResolve: resolve }),
}));

/**
 * Hook to manage terms acceptance across *.resomix.com.
 * Returns whether the terms dialog should be shown, handlers, and acceptance status.
 */
export function useTermsAcceptance() {
  const { showTerms, isAccepted, pendingResolve, setShowTerms, setIsAccepted, setPendingResolve } = useTermsAcceptanceStore();

  const checkTermsAcceptance = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const currentStatus = getCookie(COOKIE_NAME) === COOKIE_VALUE;
      
      if (currentStatus) {
        setIsAccepted(true);
        resolve(true);
      } else {
        setShowTerms(true);
        // Store the resolve function in zustand store instead of window
        setPendingResolve(resolve);
      }
    });
  };

  const acceptTerms = () => {
    setCookie(COOKIE_NAME, COOKIE_VALUE, COOKIE_DOMAIN);
    setIsAccepted(true);
    setShowTerms(false);
    
    // Resolve the promise with true
    if (pendingResolve) {
      pendingResolve(true);
      setPendingResolve(null);
    }
  };

  const dismissTerms = () => {
    setShowTerms(false);
    // Resolve the promise with false
    if (pendingResolve) {
      pendingResolve(false);
      setPendingResolve(null);
    }
  };

  return { 
    showTerms, 
    isAccepted, 
    checkTermsAcceptance, 
    acceptTerms, 
    dismissTerms 
  } as const;
}
