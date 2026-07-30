import type { ReactNode } from "react";

/**
 * Terminal state inside an AuthScreen panel — "check your email", "your email is verified",
 * "this link expired".
 *
 * Several auth screens end on a message plus one action, and each had hand-rolled it with a giant
 * green "✓" or red "✗" glyph. This is the one on-theme version: a square bezel with a drawn mark,
 * the message, then the caller's actions.
 */

export type AuthDoneTone = "success" | "error" | "info";

const TONE_COLOR: Record<AuthDoneTone, string> = {
  success: "var(--rx-color-success)",
  error: "var(--rx-color-error)",
  info: "var(--rx-color-accent)",
};

function ToneMark({ tone }: { tone: AuthDoneTone }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center border"
      style={{ borderColor: color, color }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[var(--px-20)] w-[var(--px-20)]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {tone === "success" ? (
          <path d="M20 6L9 17l-5-5" />
        ) : tone === "error" ? (
          <path d="M18 6L6 18M6 6l12 12" />
        ) : (
          <>
            <path d="M12 8h.01" />
            <path d="M11 12h1v5h1" />
          </>
        )}
      </svg>
    </span>
  );
}

export interface AuthDoneProps {
  tone?: AuthDoneTone;
  /** Short mono line above the message, e.g. "Status // Sent". */
  eyebrow?: string;
  message: ReactNode;
  /** Buttons / links below the message. */
  actions?: ReactNode;
}

export function AuthDone({ tone = "success", eyebrow, message, actions }: AuthDoneProps) {
  return (
    <div
      className="flex flex-col items-center gap-[var(--px-16)] p-[var(--px-28)] text-center"
      role="status"
    >
      <ToneMark tone={tone} />

      {eyebrow ? (
        <span className="font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">
          {eyebrow}
        </span>
      ) : null}

      {/* --px-400 (not 420): only tokens defined in BOTH apps' pixels.css are safe here, since
          this renders in the landing site and the webapp. */}
      <p className="m-0 max-w-[var(--px-400)] font-helvetica text-[length:var(--px-14)] font-light leading-[var(--px-21)] text-[var(--rx-color-text-secondary)]">
        {message}
      </p>

      {actions ? (
        <div className="mt-[var(--px-4)] flex flex-wrap items-center justify-center gap-[var(--px-12)]">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export default AuthDone;
