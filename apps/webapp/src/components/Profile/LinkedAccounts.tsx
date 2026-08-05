import React from "react";
import {
  ConfirmDialog,
  GoogleSignInButton,
  PAGE_BTN_PRIMARY,
  PAGE_BTN_SECONDARY,
  PAGE_INSET_ROW,
  PAGE_KICKER,
  PAGE_PANEL,
  PAGE_ROW_META,
  PAGE_ROW_TITLE,
} from "@resomix/ui";
import { getMyProfile, unlinkProvider, linkGoogleProvider } from "@resomix/api-client";
import { useAppleTransfer } from "@resomix/hooks";

/**
 * LinkedAccounts
 * ==============
 *
 * The Account tab's "Linked Accounts" panel (rendered above Danger Zone via ProfileContent's
 * `linkedAccounts` slot). Shows the two accounts we integrate with and their role:
 *   • Google — used for sign-in (authentication).
 *   • Apple Music — used for playlist transfer/export.
 *
 * Each row shows connected / not-connected and a Connect or Disconnect action, reusing the SAME
 * flows used elsewhere: Google via the GIS sign-in button (links by matching email), Apple via
 * `useAppleTransfer` (MusicKit connect + saved server-side connection).
 *
 * Google-disconnect guard: a Google-only account (no password) can't be unlinked or it would be
 * locked out — so we show a "set a password first" notice (the backend enforces the same rule).
 */

type Notice = { kind: "success" | "error" | "info"; text: string } | null;

/** Small monochrome status dot. */
function Dot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        "inline-block w-[var(--px-6)] h-[var(--px-6)] rounded-full shrink-0 " +
        (on ? "bg-[var(--rx-color-success)]" : "bg-[var(--rx-color-border-strong)]")
      }
    />
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="15" height="18" viewBox="0 0 14 17" fill="currentColor" aria-hidden="true" className="shrink-0 text-[var(--rx-color-text-primary)]">
      <path d="M11.6 9c0-1.5.7-2.6 2-3.3-.7-1-1.8-1.6-3.2-1.7-1.4-.1-2.8.8-3.4.8-.6 0-1.8-.8-2.9-.8C2.7 4 1.3 4.9.6 6.3c-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.7 2.7-.7 1.3 0 1.6.7 2.7.6 1.1-.02 1.8-1 2.5-2 .5-.8.9-1.6 1.1-2.5-1.4-.5-2.4-1.9-2.4-3.3zM9.5 2.9c.6-.7 1-1.7.9-2.7-.9.04-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .08 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

/** One provider row. */
function ProviderRow({
  icon,
  name,
  role,
  connected,
  detail,
  busy,
  action,
}: {
  icon: React.ReactNode;
  name: string;
  role: string;
  connected: boolean;
  detail?: string;
  busy?: boolean;
  action: React.ReactNode;
}) {
  return (
    <div className={`${PAGE_INSET_ROW} flex-wrap`}>
      <div className="flex items-center gap-[var(--px-10)] min-w-0">
        {icon}
        <div className="min-w-0">
          <div className={`${PAGE_ROW_TITLE} flex items-center gap-[var(--px-8)]`}>
            {name}
            <span className="rounded-[var(--rx-radius-tag,2px)] border border-[var(--rx-color-border-default)] px-[var(--px-6)] py-[var(--px-1)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">
              {role}
            </span>
          </div>
          <div className={`${PAGE_ROW_META} flex items-center gap-[var(--px-6)]`}>
            <Dot on={connected} />
            <span className="truncate">{busy ? "Working…" : connected ? detail || "Connected" : "Not connected"}</span>
          </div>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export const LinkedAccounts: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [hasPassword, setHasPassword] = React.useState<boolean | undefined>(undefined);
  const [googleLinked, setGoogleLinked] = React.useState(false);
  const [googleBusy, setGoogleBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [showSetPw, setShowSetPw] = React.useState(false);
  const mounted = React.useRef(true);

  // Apple = the existing MusicKit connect/disconnect + server-saved connection.
  const apple = useAppleTransfer({ active: true });

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadGoogle = React.useCallback(async () => {
    const res = await getMyProfile();
    if (!mounted.current) return;
    if (res.success) {
      const data = ("user" in res.data ? res.data.user : res.data) as {
        has_password?: boolean;
        auth_providers?: string[];
      };
      setHasPassword(data.has_password);
      setGoogleLinked((data.auth_providers || []).includes("google"));
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { void loadGoogle(); }, [loadGoogle]);

  // Connect Google = LINK the identity to THIS account (never a login/session switch). The GIS
  // button hands us the raw credential; the backend links it or rejects it (409) if that Google
  // account already belongs to someone else.
  const linkGoogle = React.useCallback(async (credential: string) => {
    setNotice(null);
    setGoogleBusy(true);
    const res = await linkGoogleProvider(credential);
    if (!mounted.current) return;
    setGoogleBusy(false);
    if (res && (res as { success?: boolean }).success) {
      setGoogleLinked(true);
      setNotice({ kind: "success", text: "Google connected." });
      void loadGoogle();
    } else {
      setNotice({
        kind: "error",
        text: (res as { error?: string })?.error || "Couldn’t connect Google. Please try again.",
      });
    }
  }, [loadGoogle]);

  const disconnectGoogle = async () => {
    setNotice(null);
    // Lock-out guard: a Google-only account (no local password) must set one first.
    if (hasPassword === false) {
      setShowSetPw(true);
      return;
    }
    setGoogleBusy(true);
    const res = await unlinkProvider("google");
    if (!mounted.current) return;
    setGoogleBusy(false);
    if (res && (res as { success?: boolean }).success) {
      setGoogleLinked(false);
      setNotice({ kind: "success", text: "Google has been disconnected." });
    } else {
      setNotice({
        kind: "error",
        text: (res as { error?: string })?.error || "Couldn’t disconnect Google. Please try again.",
      });
    }
  };

  const disconnectApple = async () => {
    setNotice(null);
    await apple.disconnect();
  };

  return (
    <div className={PAGE_PANEL}>
      <h3 className={PAGE_KICKER}>Linked Accounts</h3>
      <p className="mb-[var(--px-16)] mt-[var(--px-8)] font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-70">
        Connect your accounts to sign in and export playlists. You can disconnect any of them at any time.
      </p>

      <div className="flex flex-col gap-[var(--px-10)]">
        {/* Google — authentication */}
        <ProviderRow
          icon={<GoogleG />}
          name="Google"
          role="Sign-in"
          connected={googleLinked}
          detail="Connected"
          busy={googleBusy || loading}
          action={
            googleLinked ? (
              <button
                type="button"
                onClick={disconnectGoogle}
                disabled={googleBusy}
                className={PAGE_BTN_SECONDARY}
              >
                Disconnect
              </button>
            ) : loading ? null : (
              <GoogleSignInButton
                label="Connect Google"
                width={210}
                className="mx-0"
                onCredential={linkGoogle}
              />
            )
          }
        />

        {/* Apple Music — playlist transfer */}
        <ProviderRow
          icon={<AppleLogo />}
          name="Apple Music"
          role="Transfer"
          connected={apple.connected}
          detail={apple.storefront ? `Connected · ${apple.storefront.toUpperCase()}` : "Connected"}
          busy={apple.statusLoading || apple.connectLoading}
          action={
            apple.connected ? (
              <button
                type="button"
                onClick={disconnectApple}
                disabled={apple.connectLoading || apple.statusLoading}
                className={PAGE_BTN_SECONDARY}
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setNotice(null); void apple.connect(); }}
                disabled={apple.connectLoading || apple.statusLoading || !apple.ready}
                className={PAGE_BTN_PRIMARY}
              >
                {apple.connectLoading ? "Connecting…" : apple.ready ? "Connect" : "Preparing…"}
              </button>
            )
          }
        />
      </div>

      {/* Inline status (Google actions + Apple notices) */}
      {(notice || apple.notice) && (
        <div
          role="status"
          className={
            "mt-[var(--px-14)] border px-[var(--px-10)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase leading-[var(--px-15)] tracking-[var(--px-1)] " +
            ((notice?.kind ?? apple.notice?.kind) === "success"
              ? "border-[var(--rx-color-success)] bg-[rgba(99,210,143,0.08)] text-[var(--rx-color-success)]"
              : (notice?.kind ?? apple.notice?.kind) === "error"
                ? "border-[var(--rx-color-error)] bg-[rgba(255,118,96,0.08)] text-[var(--rx-color-error)]"
                : "border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)]")
          }
        >
          {notice?.text || apple.notice?.text}
        </div>
      )}

      {/* "Set a password first" — Google is the only sign-in and there's no password. Acknowledge
          only: there is nothing to confirm, so the single button just closes. */}
      <ConfirmDialog
        isOpen={showSetPw}
        onClose={() => setShowSetPw(false)}
        onConfirm={() => setShowSetPw(false)}
        acknowledgeOnly
        eyebrow="Account // Security"
        title="Set a password first"
        message={<>
          Google is currently your only way to sign in. Set a password on your account first
          (Personal → Password → <strong className="font-medium text-[var(--rx-color-text-primary)]">Set</strong>)
          so you don’t get locked out. Then you can disconnect Google.
        </>}
        confirmLabel="Got it"
      />
    </div>
  );
};

export default LinkedAccounts;
