import { useEffect, useState } from "react";
import {checkGuardKey, setGuardKey} from "@resomix/hooks/Transfer/appleService.js";
import { APPLE_CONFIG } from "@resomix/api-client";

// Minimal MusicKit types for TS friendliness
declare global {
  interface Window {
    MusicKit?: {
      configure(config: {
        developerToken: string;
        app?: { name: string; build: string };
      }): void;
      getInstance(): {
        authorize(): Promise<string>;
      };
    };
  }
}

async function loadMusicKitSDK(): Promise<void> {
  if (window.MusicKit) return;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = APPLE_CONFIG.MUSIC_KIT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load MusicKit SDK"));
    document.head.appendChild(script);
  });

  // Wait for MusicKit to be initialized if needed
  if (!window.MusicKit) {
    throw new Error("MusicKit SDK failed to initialize");
  }
}

async function fetchDeveloperToken(): Promise<{ token: string; expires_at: number }> {
  const res = await fetch(APPLE_CONFIG.APPLE_AUTH_TOKEN, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch Apple Music developer token");
  }
  const json = (await res.json()) as { token: string; expires_at: number };
  if (!json?.token) {
    throw new Error("Developer token response malformed");
  }
  return json;
}

export function AppleRedirect() {
  const [canClose, setCanClose] = useState(true);
  const message = "Finishing Apple Music authentication…";

  useEffect(() => {
    (async () => {
      const inParams = new URLSearchParams(window.location.search);
      const state = inParams.get("state") || "";

      const finish = (payload: { success: boolean; music_user_token?: string; error?: string; expires_in?: number }) => {
        try {
          window.opener?.postMessage({ type: "APPLE_MUSIC_AUTH_RESULT", ...payload }, window.location.origin);
        } catch {
          /* empty */
        }
        try {
          // window.close();
        } catch {
          setCanClose(false);
        }
      };

      if (!state) {
        const errMsg = "Missing state parameter";
        localStorage.setItem("apple_last_error", errMsg);
        finish({ success: false, error: errMsg });
        return;
      }

      // Guard against double-processing
      if (checkGuardKey(state)) {
        return;
      }
      setGuardKey(state);

      try {
        // Load SDK
        await loadMusicKitSDK();

        // Fetch developer token from backend
        const { token: developerToken, expires_at } = await fetchDeveloperToken();

        // Configure MusicKit
        window.MusicKit?.configure({
          developerToken,
          app: {
            name: APPLE_CONFIG.APP_NAME || "ResomiX",
            build: APPLE_CONFIG.APP_BUILD || "1.0.0",
          },
        });

        const music = window.MusicKit?.getInstance();

        // Call authorize to get Apple Music User Token
        const musicUserToken: string | undefined = await music?.authorize();

        // Persist tokens locally
        localStorage.setItem("apple_music_user_token", musicUserToken || '');
        localStorage.setItem("apple_developer_token", developerToken);
        localStorage.setItem("apple_developer_token_expiry", String(expires_at));
        localStorage.setItem("apple_connected_at", String(Date.now()));

        // Return result to opener
        const ttlMs = Math.max(0, expires_at - Date.now());
        const ttlSec = Math.floor(ttlMs / 1000);

        finish({ success: true, music_user_token: musicUserToken, expires_in: ttlSec });
        return;
      } catch (e: unknown) {
        const errMsg =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Unexpected error during Apple Music authorization";
        localStorage.setItem("apple_last_error", errMsg);
        finish({ success: false, error: errMsg });
        return;
      }
    })();
  }, []);

  if (!canClose) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 8 }}>{message}</div>
        <button onClick={() => window.close()}>Close this window</button>
      </div>
    );
  }
  return <div>Finishing…</div>;
}
