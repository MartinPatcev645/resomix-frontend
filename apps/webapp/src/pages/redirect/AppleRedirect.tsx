import { useCallback, useEffect, useRef, useState } from "react";
import { checkGuardKey, setGuardKey } from "@resomix/hooks/Transfer/appleService.js";
import { API_CONFIG, APPLE_CONFIG } from "@resomix/api-client";

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

// ABSOLUTE backend URL — the popup runs on the web origin (e.g. beta.resomix.com) but the API lives
// on a different host (API_CONFIG.BASE_URL). A relative fetch would hit the wrong host and 404.
const DEV_TOKEN_URL = `${API_CONFIG.BASE_URL}${APPLE_CONFIG.APPLE_AUTH_TOKEN}`;

async function loadMusicKitSDK(): Promise<void> {
  if (window.MusicKit) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = APPLE_CONFIG.MUSIC_KIT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load MusicKit SDK (${APPLE_CONFIG.MUSIC_KIT_SRC})`));
    document.head.appendChild(script);
  });
  if (!window.MusicKit) throw new Error("MusicKit SDK loaded but window.MusicKit is undefined");
}

async function fetchDeveloperToken(): Promise<{ token: string; expires_at: number }> {
  const res = await fetch(DEV_TOKEN_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`developer-token HTTP ${res.status} (${body.slice(0, 140)})`);
  }
  const json = (await res.json()) as { token?: string; expires_at?: number };
  if (!json?.token) throw new Error("developer-token response had no token");
  return { token: json.token, expires_at: json.expires_at ?? 0 };
}

const errText = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "Unexpected error";

export function AppleRedirect() {
  // authorize() must run from a USER GESTURE (a click) — an auto-triggered auth popup is rejected by
  // browsers/content-blockers. So: load + configure MusicKit on mount, then authorize on button click.
  const [phase, setPhase] = useState<"loading" | "ready" | "authorizing" | "success" | "error">("loading");
  const [log, setLog] = useState<string[]>([]);
  const musicRef = useRef<MusicKitInstance | null>(null);
  const devTokenRef = useRef<{ token: string; expires_at: number } | null>(null);
  const stateRef = useRef<string>("");

  const pushLog = useCallback((line: string) => {
    // eslint-disable-next-line no-console
    console.info("[apple-redirect]", line);
    setLog((prev) => {
      const next = [...prev, `${new Date().toISOString().slice(11, 23)}  ${line}`];
      try { localStorage.setItem("apple_debug_log", JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  const fail = useCallback((msg: string) => {
    pushLog(`ERROR: ${msg}`);
    localStorage.setItem("apple_last_error", msg);
    setPhase("error");
    try {
      window.opener?.postMessage({ type: "APPLE_MUSIC_AUTH_RESULT", success: false, error: msg }, window.location.origin);
    } catch { /* noopener */ }
  }, [pushLog]);

  // Step 1 (on mount, no gesture): load SDK + developer token + configure MusicKit.
  useEffect(() => {
    (async () => {
      const state = new URLSearchParams(window.location.search).get("state") || "";
      stateRef.current = state;
      try { localStorage.removeItem("apple_debug_log"); } catch { /* */ }
      pushLog(`redirect opened (state=${state ? "present" : "MISSING"})`);
      if (!state) { fail("Missing state parameter"); return; }
      if (checkGuardKey(state)) { pushLog("guard already set — skipping (refresh of a completed auth)"); return; }
      try {
        pushLog("loading MusicKit SDK…");
        await loadMusicKitSDK();
        pushLog("MusicKit SDK loaded");
        pushLog(`fetching developer token → ${DEV_TOKEN_URL}`);
        devTokenRef.current = await fetchDeveloperToken();
        pushLog("developer token OK");
        pushLog("configuring MusicKit…");
        const configured = await window.MusicKit?.configure({
          developerToken: devTokenRef.current.token,
          app: { name: APPLE_CONFIG.APP_NAME || "ResomiX", build: APPLE_CONFIG.APP_BUILD || "1.0.0" },
        });
        musicRef.current = (configured as MusicKitInstance) || window.MusicKit?.getInstance() || null;
        if (!musicRef.current) throw new Error("MusicKit unavailable after configure");
        pushLog("MusicKit configured — ready to authorize");
        setPhase("ready");
      } catch (e) {
        fail(errText(e));
      }
    })();
  }, [fail, pushLog]);

  // Step 2 (USER GESTURE): authorize → persist the Music-User-Token → hand back to the opener.
  const onAuthorize = useCallback(async () => {
    const music = musicRef.current;
    const dev = devTokenRef.current;
    if (!music || !dev) return;
    setPhase("authorizing");
    pushLog("authorize() — opening Apple sign-in…");
    try {
      const mut = await music.authorize();
      if (!mut) throw new Error("authorize() returned an empty token (sign-in dismissed or no subscription)");
      setGuardKey(stateRef.current); // guard only a COMPLETED auth so a failed one can be retried
      localStorage.setItem("apple_music_user_token", mut);
      localStorage.setItem("apple_developer_token", dev.token);
      localStorage.setItem("apple_developer_token_expiry", String(dev.expires_at));
      localStorage.setItem("apple_connected_at", String(Date.now()));
      pushLog("authorized — token stored, notifying opener");
      try {
        window.opener?.postMessage({ type: "APPLE_MUSIC_AUTH_RESULT", success: true }, window.location.origin);
      } catch { /* noopener */ }
      setPhase("success");
      window.setTimeout(() => { try { window.close(); } catch { /* blocked */ } }, 1500);
    } catch (e) {
      fail(errText(e));
    }
  }, [fail, pushLog]);

  const wrap: React.CSSProperties = { padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 460, margin: "32px auto" };
  const btn: React.CSSProperties = { padding: "8px 18px", cursor: "pointer", border: "1px solid #888", borderRadius: 6, background: "#fff", fontSize: 14 };
  const logStyle: React.CSSProperties = {
    marginTop: 16, padding: 10, background: "#111", color: "#9fe", fontFamily: "ui-monospace, monospace",
    fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", borderRadius: 6, maxHeight: 220, overflowY: "auto",
  };

  const heading =
    phase === "success" ? "Connected to Apple Music ✓"
      : phase === "error" ? "Couldn’t connect to Apple Music"
        : phase === "ready" ? "Connect Apple Music"
          : phase === "authorizing" ? "Opening Apple sign-in…"
            : "Preparing Apple Music…";

  return (
    <div style={wrap}>
      <div style={{ fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{heading}</div>
      {phase === "ready" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 12 }}>
            You’ll be asked to sign in with your Apple ID. An active Apple Music subscription is required.
          </div>
          <button style={btn} onClick={onAuthorize} id="apple-redirect-authorize">Sign in to Apple Music</button>
        </div>
      )}
      {(phase === "error" || phase === "success") && (
        <div style={{ textAlign: "center" }}>
          <button style={btn} onClick={() => window.close()}>Close this window</button>
        </div>
      )}
      {/* Always-visible trace so the exact failing step is readable (and copyable) even in the popup. */}
      <pre style={logStyle}>{log.join("\n")}</pre>
    </div>
  );
}
