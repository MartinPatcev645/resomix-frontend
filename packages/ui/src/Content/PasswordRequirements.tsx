import { PAGE_FIELD_LABEL } from "./pageChrome";

/**
 * The live "password requirements" checklist under a new-password field.
 *
 * Shared by Register and Reset Password, which each had their own copy with a green "✓" / grey "○".
 * Met vs unmet now reads from the glyph and text emphasis instead of a traffic-light palette the
 * theme doesn't have.
 */

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

function RequirementMark({ met }: { met: boolean }) {
  return met ? (
    <svg
      viewBox="0 0 24 24"
      className="h-[var(--px-11)] w-[var(--px-11)] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-[var(--px-11)] w-[var(--px-11)] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

export function PasswordRequirements({ requirements }: { requirements: PasswordRequirement[] }) {
  return (
    <div className="mt-[var(--px-10)] flex flex-col gap-[var(--px-6)]">
      <span className={PAGE_FIELD_LABEL}>Password requirements</span>
      {requirements.map((req) => (
        <div
          key={req.label}
          className={`flex items-center gap-[var(--px-8)] font-helvetica text-[length:var(--px-11)] font-light ${
            req.met
              ? "text-[var(--rx-color-text-primary)]"
              : "text-[var(--rx-color-text-secondary)] opacity-60"
          }`}
        >
          <RequirementMark met={req.met} />
          <span>{req.label}</span>
        </div>
      ))}
    </div>
  );
}

export default PasswordRequirements;
