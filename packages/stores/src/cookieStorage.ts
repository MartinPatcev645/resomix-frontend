/**
 * Cookie-based storage for cross-subdomain authentication
 * This allows auth state to persist across all subdomains (landing, webapp, admin)
 */

interface CookieOptions {
  domain?: string;
  path?: string;
  maxAge?: number;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Set a cookie with cross-subdomain support
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  const {
    domain = getDomain(),
    path = '/',
    maxAge = 30 * 24 * 60 * 60, // 30 days default
    secure = true,
    sameSite = 'lax'
  } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookieString += `; path=${path}`;
  
  if (domain) {
    cookieString += `; domain=${domain}`;
  }
  
  if (maxAge) {
    cookieString += `; max-age=${maxAge}`;
  }
  
  if (secure) {
    cookieString += '; secure';
  }
  
  cookieString += `; samesite=${sameSite}`;

  document.cookie = cookieString;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  const nameEQ = encodeURIComponent(name) + '=';
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(nameEQ)) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  
  return null;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
  setCookie(name, '', {
    maxAge: -1,
    domain: getDomain()
  });
}

/**
 * Get the root domain for cross-subdomain cookies
 * Returns .resomix.com for production or localhost for local development
 */
function getDomain(): string {
  if (typeof window === 'undefined') return '';
  
  const hostname = window.location.hostname;
  
  // For localhost/local development, don't set domain
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    return '';
  }
  
  // For production, use .resomix.com to share across all subdomains
  if (hostname.includes('resomix.com')) {
    return '.resomix.com';
  }
  
  // Default: extract root domain (e.g., example.com from beta.example.com)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  
  return '';
}

/**
 * Cookie storage adapter for Zustand persist middleware
 * This allows Zustand to use cookies instead of localStorage
 */
export const cookieStorage = {
  getItem: (name: string): string | null => {
    const value = getCookie(name);
    return value;
  },
  
  setItem: (name: string, value: string): void => {
    setCookie(name, value, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      secure: window.location.protocol === 'https:',
      sameSite: 'lax'
    });
  },
  
  removeItem: (name: string): void => {
    deleteCookie(name);
  }
};

/**
 * Hybrid storage adapter that uses both cookies and localStorage
 * Cookies for cross-subdomain support, localStorage for faster access
 */
export const hybridStorage = {
  getItem: (name: string): string | null => {
    // Read cookie first to check if we have cross-domain data
    const cookieValue = getCookie(name);
    
    // Try localStorage (faster, same domain)
    try {
      const localValue = localStorage.getItem(name);
      if (localValue) {
        // If both exist, prefer localStorage but ensure cookie is in sync
        // Only sync if cookie is missing or different (prevents loops)
        if (!cookieValue || cookieValue !== localValue) {
          // Silently update cookie in background without triggering re-reads
          setCookie(name, localValue, {
            maxAge: 30 * 24 * 60 * 60,
            secure: window.location.protocol === 'https:',
            sameSite: 'lax'
          });
        }
        return localValue;
      }
    } catch (e) {
      console.warn('localStorage not available:', e);
    }
    
    // Fallback to cookies (cross-domain support)
    if (cookieValue) {
      // Cookie exists but localStorage doesn't - sync localStorage in background
      try {
        localStorage.setItem(name, cookieValue);
      } catch (e) {
        // localStorage might not be available, that's okay
      }
      return cookieValue;
    }
    
    return null;
  },
  
  setItem: (name: string, value: string): void => {
    // Write to cookie first (ensures cross-domain availability)
    setCookie(name, value, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      secure: window.location.protocol === 'https:',
      sameSite: 'lax'
    });
    
    // Then write to localStorage (for faster future reads)
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn('localStorage not available:', e);
    }
  },
  
  removeItem: (name: string): void => {
    // Remove from cookie first
    deleteCookie(name);
    
    // Then remove from localStorage
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('localStorage not available:', e);
    }
  }
};

