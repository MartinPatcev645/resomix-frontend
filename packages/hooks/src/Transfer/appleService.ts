/**
 * Apple Music (MusicKit) — in-page connect helpers
 * ================================================
 * MusicKit is pure client-side JS: `authorize()` opens Apple's own sign-in window and resolves with
 * the Music-User-Token right here. So there is NO need for an app-owned redirect page (that pattern
 * only exists for Spotify, which is a server-side OAuth redirect flow).
 *
 * IMPORTANT: `authorize()` must be invoked from a USER GESTURE. Browsers drop "user activation"
 * across awaits, so callers must `prepareMusicKit()` up front (load SDK + developer token +
 * configure) and then call `authorize()` directly in the click handler with nothing awaited before it.
 */
import { API_CONFIG, APPLE_CONFIG } from "@resomix/api-client";

export type MusicKitInstance = { authorize(): Promise<string> };

declare global {
  interface Window {
    MusicKit?: {
      configure(config: {
        developerToken: string;
        app?: { name: string; build: string };
      }): MusicKitInstance | Promise<MusicKitInstance> | void;
      getInstance(): MusicKitInstance;
    };
  }
}

// ABSOLUTE backend URL — the web origin and the API are different hosts, so a relative fetch
// would hit the wrong one.
const DEV_TOKEN_URL = `${API_CONFIG.BASE_URL}${APPLE_CONFIG.APPLE_AUTH_TOKEN}`;

/** Inject Apple's MusicKit SDK (once). */
export const loadMusicKit = async (): Promise<void> => {
  if (window.MusicKit) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${APPLE_CONFIG.MUSIC_KIT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load the Apple Music SDK")));
      return;
    }
    const script = document.createElement("script");
    script.src = APPLE_CONFIG.MUSIC_KIT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Apple Music SDK"));
    document.head.appendChild(script);
  });
  if (!window.MusicKit) throw new Error("Apple Music SDK loaded but unavailable");
};

/** Fetch the backend-minted developer token (JWT ES256). */
export const fetchAppleDeveloperToken = async (): Promise<string> => {
  const res = await fetch(DEV_TOKEN_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`developer-token HTTP ${res.status}`);
  const json = (await res.json()) as { token?: string };
  if (!json?.token) throw new Error("developer-token response had no token");
  return json.token;
};

/**
 * Load the SDK + developer token and configure MusicKit. Call this BEFORE the user clicks connect,
 * so the click handler can call `authorize()` immediately on a live user gesture.
 */
export const prepareMusicKit = async (): Promise<MusicKitInstance> => {
  await loadMusicKit();
  const developerToken = await fetchAppleDeveloperToken();
  const configured = await window.MusicKit?.configure({
    developerToken,
    app: { name: APPLE_CONFIG.APP_NAME || "ResomiX", build: APPLE_CONFIG.APP_BUILD || "1.0.0" },
  });
  const instance = (configured as MusicKitInstance) || window.MusicKit?.getInstance();
  if (!instance) throw new Error("Apple Music unavailable after configure");
  return instance;
};
