import { useEffect, useState, type ReactNode } from "react";
import { StatusMessage } from "../Elements/StatusMessage";
import { ConfirmDialog } from "../Modals/ConfirmDialog";
import { InputModal } from "../Modals/InputModal";
import { SineWaves } from "../Animations/SineWaves";
import { ProfileIcon } from "../Vectors/ProfileIcon";
import { PlanBillingCard } from "../Billing/PlanBillingCard";
import { useProfileSettings } from "@resomix/hooks";

import {
  PAGE_BTN_BASE as BTN_BASE,
  PAGE_BTN_DANGER as BTN_DANGER,
  PAGE_BTN_PRIMARY as BTN_PRIMARY,
  PAGE_BTN_SECONDARY as BTN_SECONDARY,
  PAGE_FIELD as FIELD,
  PAGE_FIELD_LABEL as FIELD_LABEL,
  PAGE_INSET_ROW as INSET_ROW,
  PAGE_KICKER as KICKER,
  PAGE_PANEL as PANEL,
  PAGE_PANEL_PLAIN as PANEL_PLAIN,
  PAGE_ROW_META,
  PAGE_ROW_TITLE,
} from "./pageChrome";

interface ProfileContentProps {
  baseUrl?: string;
  onNavigateChangePassword?: () => void;
  onNavigateSessions?: () => void;
  onLogout?: () => void;
  /** Rendered in the Account tab ABOVE Danger Zone. The webapp passes the Linked Accounts panel
   *  here (Google/Apple connect + disconnect); omit it and the tab is unchanged. */
  linkedAccounts?: ReactNode;
}

/**
 * Delete-account confirmation.
 *
 * Two deliberate frictions on an irreversible action:
 *
 * - a **4-second countdown** on the confirm button, matching the delete-track dialog so the app
 *   has one destructive-action idiom rather than a different one per screen;
 * - the consequences spelled out as a list, including the part people most need to hear — the
 *   account is recoverable for 30 days, so this is not the cliff edge it feels like.
 *
 * The password field appears only for accounts that HAVE a password. A Google-only sign-up has
 * none, and asking for one made deletion impossible for those users.
 */
function DeleteAccountDialog({
  isOpen,
  onClose,
  onConfirm,
  hasPassword,
  password,
  onPasswordChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  hasPassword: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
}) {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(4);
      return;
    }
    // Keyed on the open cycle only: re-renders (typing a password) must not restart the clock.
    const id = setInterval(() => setCountdown((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  const blocked = countdown > 0 || (hasPassword && !password);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      tone="danger"
      title="Delete your account"
      message="Your account will be deactivated immediately and permanently deleted after 30 days."
      detailsTitle="You will lose:"
      details={[
        "Access to your account — you'll be signed out everywhere and won't be able to sign in",
        "Every playlist you've created",
        "Every track you've uploaded, and its analysis",
        "Any active subscription, cancelled with no refund for the remaining period",
      ]}
      confirmLabel={countdown > 0 ? `Delete account (${countdown}s)` : "Delete account"}
      confirmDisabled={blocked}
      cancelLabel="Keep my account"
    >
      <p className="mb-[var(--px-12)] font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)]">
        Nothing is deleted for 30 days. Contact us before then and we&rsquo;ll restore your account
        exactly as you left it.
      </p>
      {hasPassword && (
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Enter your password to confirm"
          aria-label="Password"
          className={FIELD}
        />
      )}
    </ConfirmDialog>
  );
}

export default function ProfileContent({
  baseUrl = "https://resomix.com",
  onNavigateChangePassword,
  onNavigateSessions,
  onLogout,
  linkedAccounts,
}: ProfileContentProps) {
  // ALL behaviour (profile load, edit form, 2FA, verification, delete, logout, tabs, status
  // banner) lives in the hook — this component only renders. See useProfileSettings.
  const {
    user,
    form,
    setForm,
    isEditing,
    setIsEditing,
    loading,
    twoFactorEnabled,
    showStatus,
    setShowStatus,
    statusType,
    statusMessage,
    submitting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deletePassword,
    setDeletePassword,
    showDisable2FAModal,
    setShowDisable2FAModal,
    timezones,
    resendingVerification,
    activeTab,
    setActiveTab,
    handleChange,
    handleUpdate,
    handleDisable2FA,
    handle2FAToggle,
    handleDeleteAccount,
    handleResendVerification,
    handleLogout,
  } = useProfileSettings({ onLogout });

  if (loading) {
    return (
      <section className="px-[var(--px-12)] pt-[var(--px-16)] pb-[var(--px-40)] tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--rx-color-text-primary)]">
          <div className="flex justify-center items-center h-[200px] w-full max-w-[var(--px-300)]">
            <SineWaves />
          </div>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="px-[var(--px-12)] pt-[var(--px-16)] pb-[var(--px-40)] tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--rx-color-text-primary)]">
          <p className="font-helvetica text-[length:var(--px-15)] font-light">
            Unable to load profile. Please try again.
          </p>
        </div>
      </section>
    );
  }

  return (
    // Spacing matches the workspace shell: a small inset from the vertical side lines (px-12) and
    // no oversized top pad — the layout's <main> already offsets the header.
    <section className="px-[var(--px-12)] pt-[var(--px-16)] pb-[var(--px-40)] tracking-[var(--px-1)]">
      <div className="mx-auto w-full max-w-6xl text-[var(--rx-color-text-primary)]">
        {/* Header — accent rule + mono kicker, then a left-aligned heading, as on the workspace. */}
        <header className="mb-[var(--px-24)]">
          <p className="mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-32)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
            Account // Settings
          </p>
          <h1 className="m-0 font-helvetica text-[length:var(--px-28)] font-medium uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
            Profile Settings
          </h1>
          <p className="mt-[var(--px-12)] font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)] opacity-70">
            Manage your account settings and preferences
          </p>
        </header>

        {/* Same control and label as the Library's back button, so both account pages exit the
            same way (baseUrl is the beta workspace in both apps). */}
        <div className="mb-[var(--px-24)]">
          <a href={baseUrl} aria-label="Sonic Discovery" className={`${BTN_SECONDARY} gap-[var(--px-6)]`}>
            <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Sonic Discovery
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[clamp(260px,22vw,340px)_1fr] gap-[var(--px-24)] items-start">
          <aside className="space-y-[var(--px-16)] lg:sticky lg:top-[var(--px-120)] h-max">
            <div className={PANEL}>
              <div className="flex items-center gap-[var(--px-12)]">
                <ProfileIcon
                  className="text-[var(--rx-color-accent)]"
                  customWidth="40"
                  customHeight="40"
                />
                {/* min-w-0 lets the truncated children actually shrink inside the flex row —
                    without it a long username/email pushes past the card border. */}
                <div className="w-full min-w-0">
                  <div
                    className="font-helvetica text-[length:var(--px-16)] font-medium truncate"
                    title={user.username}
                  >
                    {user.username}
                  </div>
                  {/* Email-verified row — its own labelled line between username and email,
                      with a neutral tick/cross (no traffic-light colours). */}
                  <div className="flex items-center justify-between gap-[var(--px-8)] mt-[var(--px-6)]">
                    <span className="flex items-center gap-[var(--px-6)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)] whitespace-nowrap">
                      Email verified:
                      {user.is_email_verified ? (
                        <svg viewBox="0 0 24 24" aria-label="Verified" className="w-[var(--px-11)] h-[var(--px-11)] text-[var(--rx-color-text-primary)]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-label="Not verified" className="w-[var(--px-11)] h-[var(--px-11)] text-[var(--rx-color-text-primary)] opacity-80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      )}
                    </span>
                    {!user.is_email_verified && (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendingVerification}
                        className={`${BTN_SECONDARY} shrink-0`}
                      >
                        {resendingVerification ? "Sending..." : "Verify"}
                      </button>
                    )}
                  </div>
                  <div
                    className="mt-[var(--px-6)] font-helvetica text-[length:var(--px-11)] font-light truncate text-[var(--rx-color-text-secondary)] opacity-80"
                    title={user.email}
                  >
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab nav — TABS, not feature boxes. Mobile: the three sit side-by-side as a
                segmented row (active highlighted, others dimmed). Desktop: same column position
                as before, but plain rows with a left indicator bar instead of bordered boxes,
                so they read as navigation rather than actions. */}
            <nav
              aria-label="Profile sections"
              className={`${PANEL_PLAIN} !p-[var(--px-8)] lg:!p-[var(--px-10)] grid grid-cols-3 gap-[var(--px-6)] lg:flex lg:flex-col lg:gap-[var(--px-2)]`}
            >
              {([
                { id: "personal", label: "Personal", labelLg: "Personal Information", hint: "Profile, password & security" },
                { id: "billing", label: "Billing", labelLg: "Billing & Subscription", hint: "Plan, usage & invoices" },
                { id: "account", label: "Account", labelLg: "Account", hint: "Delete account" },
              ] as const).map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    aria-current={active ? "page" : undefined}
                    className={`cursor-pointer px-[var(--px-8)] py-[var(--px-8)] text-center transition-colors duration-[var(--rx-duration-base)] lg:border-l-2 lg:px-[var(--px-12)] lg:text-left ${
                      active
                        ? "bg-[var(--rx-color-accent-soft,rgba(238,74,38,0.14))] lg:border-[var(--rx-color-accent)] lg:bg-[rgba(255,255,255,0.04)]"
                        : "opacity-55 hover:opacity-100 lg:border-transparent"
                    }`}
                  >
                    {/* Mobile: compact label only. Desktop: full label + hint. */}
                    <span className="block lg:hidden font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] whitespace-nowrap">
                      {t.label}
                    </span>
                    <span className="hidden lg:block min-w-0">
                      <span className="block font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] truncate">
                        {t.labelLg}
                      </span>
                      <span className="mt-[var(--px-2)] block font-helvetica text-[length:var(--px-11)] font-light text-[var(--rx-color-text-secondary)] opacity-60 truncate">
                        {t.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <button onClick={handleLogout} className={`${BTN_SECONDARY} w-full`}>
              Logout
            </button>
          </aside>

          <main className="space-y-[var(--px-16)] min-w-0">
            {activeTab === "personal" && (
            <>
            <div className={PANEL}>
              <div className="flex justify-between items-center mb-[var(--px-16)] gap-[var(--px-12)]">
                <h2 className={KICKER}>Personal Information</h2>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className={`${BTN_SECONDARY} shrink-0`}
                  >
                    Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--px-14)]">
                <div className="flex flex-col gap-[var(--px-8)]">
                  <label htmlFor="profile-name" className={FIELD_LABEL}>
                    Name <span className="opacity-70">(optional)</span>
                  </label>
                  <input
                    id="profile-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    disabled={!isEditing}
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-[var(--px-8)]">
                  <label htmlFor="profile-language" className={FIELD_LABEL}>
                    Language <span className="opacity-70">(optional)</span>
                  </label>
                  <select
                    id="profile-language"
                    name="language"
                    value={form.language}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`${FIELD} cursor-pointer`}
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="">Select language</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <div className="flex flex-col gap-[var(--px-8)]">
                    <label htmlFor="profile-timezone" className={FIELD_LABEL}>
                      Timezone
                    </label>
                    <select
                      id="profile-timezone"
                      name="timezone"
                      value={form.timezone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`${FIELD} cursor-pointer`}
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="">Select timezone</option>
                      {timezones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isEditing && (
                  <div className="lg:col-span-2 flex gap-[var(--px-10)] mt-[var(--px-6)] justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setForm({
                          name: user.name || "",
                          language: user.language || "",
                          timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
                        });
                      }}
                      className={BTN_SECONDARY}
                    >
                      Cancel
                    </button>
                    {/* type="button" + onClick, as before: the form's onSubmit is the same handler,
                        so a submit button would run handleUpdate twice per click. */}
                    <button type="button" onClick={handleUpdate} className={BTN_PRIMARY}>
                      {submitting ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className={PANEL}>
              <h2 className={`${KICKER} mb-[var(--px-16)]`}>Security</h2>

              {/* Each row: text block (truncating, min-w-0) + a proper compact button pinned
                  right with a guaranteed gap — the bare "Change →" text link used to float
                  mid-row and crowd the description. */}
              <div className="flex flex-col gap-[var(--px-10)]">
                <div className={INSET_ROW}>
                  <div className="min-w-0">
                    <div className={PAGE_ROW_TITLE}>
                      Password
                    </div>
                    <div className={`${PAGE_ROW_META} truncate`}>
                      {/* Social-login accounts (has_password === false) haven't set one yet. */}
                      {user.has_password === false
                        ? "Set a password for your account"
                        : "Change your account password"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onNavigateChangePassword ?? (() => {})}
                    className={`${BTN_SECONDARY} shrink-0`}
                  >
                    {user.has_password === false ? "Set" : "Change"}
                  </button>
                </div>
                <div className={INSET_ROW}>
                  <div className="min-w-0">
                    <div className={PAGE_ROW_TITLE}>
                      Two-Factor Authentication
                    </div>
                    <div className={`${PAGE_ROW_META} truncate`}>
                      {twoFactorEnabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handle2FAToggle}
                    className={`${BTN_SECONDARY} shrink-0`}
                  >
                    {twoFactorEnabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            </div>
            </>
            )}

            {activeTab === "billing" && <PlanBillingCard />}

            {activeTab === "account" && (
            <>
            {/* Linked accounts (Google / Apple) — provided by the app; sits above Danger Zone. */}
            {linkedAccounts}

            <div className="relative border border-[var(--rx-color-error)] bg-[var(--rx-color-surface)] p-[var(--px-18)] before:absolute before:left-[var(--px-20)] before:top-0 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--rx-color-error)] before:content-['']">
              <h3 className={`${KICKER} mb-[var(--px-16)] !text-[var(--rx-color-error)]`}>
                Danger Zone
              </h3>

              <div className="flex flex-col gap-[var(--px-10)]">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className={`${BTN_DANGER} self-start`}
                >
                  Delete Account
                </button>
                <p className="font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-secondary)]">
                  Your account is deactivated straight away and permanently deleted after 30 days.
                  You can ask us to restore it any time before then.
                </p>
              </div>
            </div>
            </>
            )}
          </main>
        </div>

        <StatusMessage
          isOpen={showStatus}
          onClose={() => setShowStatus(false)}
          status={statusType}
          message={statusMessage}
        />

        <DeleteAccountDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setDeletePassword("");
          }}
          onConfirm={handleDeleteAccount}
          hasPassword={!!user?.has_password}
          password={deletePassword}
          onPasswordChange={setDeletePassword}
        />

        <InputModal
          isOpen={showDisable2FAModal}
          onClose={() => setShowDisable2FAModal(false)}
          onSubmit={handleDisable2FA}
          title="Disable 2FA"
          message="For security, please enter your password to disable two-factor authentication."
          inputLabel="Password"
          inputType="password"
          inputPlaceholder="Enter your password"
          confirmText="Disable 2FA"
          cancelText="Cancel"
          required={true}
          minLength={8}
        />
      </div>
    </section>
  );
}
