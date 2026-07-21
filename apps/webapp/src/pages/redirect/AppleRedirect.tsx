import { useCallback, useEffect, useRef, useState } from "react";
import {checkGuardKey, setGuardKey} from "@resomix/hooks/Transfer/appleService.js";
import { APPLE_CONFIG } from "@resomix/api-client";

// Minimal MusicKit types. `configure` is typed to allow `await` so this works whether the loaded
// SDK returns the instance synchronously (v1) or a promise (v3).
type MusicKitInstance = { authorize(): Promise<string> };
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

const errText = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "Unexpected error";

export function AppleRedirect() {
  // MusicKit's authorize() must run from a USER GESTURE (a click) — browsers/content-blockers reject
  // an auto-triggered auth popup. So we load + configure MusicKit on mount, then authorize on click.
  const [phase, setPhase] = useState<"loading" | "ready" | "authorizing" | "success" | "error">("loading");
  const [detail, setDetail] = useState<string>("");
  const musicRef = useRef<MusicKitInstance | null>(null);
  const devTokenRef = useRef<{ token: string; expires_at: number } | null>(null);
  const stateRef = useRef<string>("");

  const fail = useCallback((msg: string) => {
    localStorage.setItem("apple_last_error", msg);
    setDetail(msg);
    setPhase("error");
    try {
      window.opener?.postMessage({ type: "APPLE_MUSIC_AUTH_RESULT", success: false, error: msg }, window.location.origin);
    } catch { /* noopener */ }
  }, []);

  // Step 1 (on mount, no gesture): load SDK + developer token + configure MusicKit.
  useEffect(() => {
    (async () => {
      const state = new URLSearchParams(window.location.search).get("state") || "";
      stateRef.current = state;
      if (!state) { fail("Missing state parameter"); return; }
      if (checkGuardKey(state)) return; // a refresh of an already-completed redirect

      try {
        console.info("[apple-redirect] loading MusicKit SDK…");
        await loadMusicKitSDK();
        console.info("[apple-redirect] fetching developer token…");
        devTokenRef.current = await fetchDeveloperToken();
        console.info("[apple-redirect] configuring MusicKit…");
        const configured = await window.MusicKit?.configure({
          developerToken: devTokenRef.current.token,
          app: { name: APPLE_CONFIG.APP_NAME || "ResomiX", build: APPLE_CONFIG.APP_BUILD || "1.0.0" },
        });
        musicRef.current = (configured as MusicKitInstance) || window.MusicKit?.getInstance() || null;
        if (!musicRef.current) throw new Error("MusicKit unavailable after configure");
        console.info("[apple-redirect] ready — waiting for user to authorize");
        setPhase("ready");
      } catch (e) {
        console.error("[apple-redirect] setup failed:", e);
        fail(errText(e));
      }
    })();
  }, [fail]);

  // Step 2 (USER GESTURE): authorize → persist the Music-User-Token → hand back to the opener.
  const onAuthorize = useCallback(async () => {
    const music = musicRef.current;
    const dev = devTokenRef.current;
    if (!music || !dev) return;
    setPhase("authorizing");
    setDetail("");
    try {
      console.info("[apple-redirect] authorize()…");
      const mut = await music.authorize();
      if (!mut) throw new Error("Apple did not return a user token");
      setGuardKey(stateRef.current); // guard only a COMPLETED auth (so a failed one can be retried)
      localStorage.setItem("apple_music_user_token", mut);
      localStorage.setItem("apple_developer_token", dev.token);
      localStorage.setItem("apple_developer_token_expiry", String(dev.expires_at));
      localStorage.setItem("apple_connected_at", String(Date.now()));
      console.info("[apple-redirect] authorized — token stored, notifying opener");
      try {
        window.opener?.postMessage({ type: "APPLE_MUSIC_AUTH_RESULT", success: true }, window.location.origin);
      } catch { /* noopener */ }
      setDetail("Connected to Apple Music. You can close this window.");
      setPhase("success");
      window.setTimeout(() => { try { window.close(); } catch { /* blocked */ } }, 1200);
    } catch (e) {
      console.error("[apple-redirect] authorize failed:", e);
      fail(errText(e));
    }
  }, [fail]);

  const wrap: React.CSSProperties = { padding: 24, fontFamily: "system-ui, sans-serif", textAlign: "center", maxWidth: 360, margin: "40px auto" };
  const btn: React.CSSProperties = { padding: "8px 18px", cursor: "pointer", border: "1px solid #888", borderRadius: 6, background: "#fff" };

  if (phase === "success") {
    return <div style={wrap}><div style={{ fontWeight: 600, marginBottom: 8 }}>Connected to Apple Music ✓</div><div style={{ opacity: 0.7, fontSize: 14 }}>{detail}</div></div>;
  }
  if (phase === "error") {
    return (
      <div style={wrap}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Couldn’t connect to Apple Music</div>
        <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 16 }}>{detail}</div>
        <button style={btn} onClick={() => window.close()}>Close this window</button>
      </div>
    );
  }
  if (phase === "ready") {
    return (
      <div style={wrap}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Connect Apple Music</div>
        <div style={{ opacity: 0.7, fontSize: 14, marginBottom: 16 }}>You’ll be asked to sign in with your Apple ID. An active Apple Music subscription is required.</div>
        <button style={btn} onClick={onAuthorize} id="apple-redirect-authorize">Sign in to Apple Music</button>
      </div>
    );
  }
  return <div style={wrap}><div style={{ opacity: 0.7, fontSize: 14 }}>{phase === "authorizing" ? "Opening Apple sign-in…" : "Preparing Apple Music…"}</div></div>;
}
