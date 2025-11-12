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
    const resolveEnvelope = (raw: string | null): Envelope | null => {
      if (!raw) return null;
      const envelope = unwrapEnvelope(raw);
      if (envelope) return envelope;
      return { ts: 0, tabId: 'legacy', payload: raw };
    };

    let candidate: Envelope | null = null;

    try {
      const localValue = localStorage.getItem(name);
      candidate = resolveEnvelope(localValue);
    } catch (e) {
      console.warn('localStorage not available:', e);
    }
    
    if (!candidate) {
      const cookieValue = getCookie(name);
      candidate = resolveEnvelope(cookieValue);
    }

    return candidate ? candidate.payload : null;
  },
  
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') {
      performWrite(name, value);
      return;
    }

    const existingTimer = pendingWrites.get(name);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      performWrite(name, value);
      pendingWrites.delete(name);
    }, WRITE_DEBOUNCE_MS);

    pendingWrites.set(name, timer);
  },
  
  removeItem: (name: string): void => {
    deleteCookie(name);
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('localStorage not available:', e);
    }
  }
};

interface Envelope {
  ts: number;
  tabId: string;
  payload: string;
}

const TAB_ID = (() => {
  const generate = () => `${Math.random().toString(36).slice(2)}${Date.now()}`;
  if (typeof window === 'undefined') return generate();
  try {
    const existing = window.sessionStorage.getItem('resomix-tab-id');
    if (existing) return existing;
    const fresh = generate();
    window.sessionStorage.setItem('resomix-tab-id', fresh);
    return fresh;
  } catch {
    return generate();
  }
})();

const wrapEnvelope = (payload: string): string =>
  JSON.stringify({ ts: Date.now(), tabId: TAB_ID, payload });

const unwrapEnvelope = (raw: string): Envelope | null => {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.payload === 'string' &&
      typeof parsed.ts === 'number'
    ) {
      return {
        ts: parsed.ts,
        tabId: typeof parsed.tabId === 'string' ? parsed.tabId : 'unknown',
        payload: parsed.payload
      };
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

const sanitisePayloadForCookie = (payload: string): string => {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object') return payload;

    const state = (parsed as any).state;
    if (!state || typeof state !== 'object') return payload;

    const safeState: Record<string, unknown> = { ...state };

    if (state.user && typeof state.user === 'object') {
      const { id, uuid, email, username, is_email_verified } = state.user as Record<string, unknown>;
      safeState.user = { id, uuid, email, username, is_email_verified };
    }

    safeState.isAuthenticated = !!state.isAuthenticated;

    return JSON.stringify({ ...parsed, state: safeState });
  } catch {
    return payload;
  }
};

const WRITE_DEBOUNCE_MS = 100;
const pendingWrites = typeof window === 'undefined' ? new Map<string, number>() : new Map<string, number>();

const performWrite = (name: string, value: string) => {
  const envelope = wrapEnvelope(value);

  try {
    const existing = localStorage.getItem(name);
    if (existing !== envelope) {
      localStorage.setItem(name, envelope);
    }
  } catch (e) {
    console.warn('localStorage not available:', e);
  }

  const cookieEnvelope = wrapEnvelope(sanitisePayloadForCookie(value));
  const existingCookie = getCookie(name);

  if (existingCookie !== cookieEnvelope) {
    setCookie(name, cookieEnvelope, {
      maxAge: 30 * 24 * 60 * 60,
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
      sameSite: 'lax'
    });
  }
};

