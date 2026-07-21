import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { InputModal } from "../Modals/InputModal";
import { FormInput } from "../Elements/FormInput";
import { SineWaves } from "../Animations/SineWaves";
import { ProfileIcon } from "../Vectors/ProfileIcon";
import { PlanBillingCard } from "../Billing/PlanBillingCard";
import { useProfileSettings } from "@resomix/hooks";

interface ProfileContentProps {
  baseUrl?: string;
  onNavigateChangePassword?: () => void;
  onNavigateSessions?: () => void;
  onLogout?: () => void;
}

export default function ProfileContent({
  baseUrl = "https://resomix.com",
  onNavigateChangePassword,
  onNavigateSessions,
  onLogout,
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
      <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <div className="flex justify-center items-center h-[200px] w-full max-w-[var(--px-300)]">
            <SineWaves />
          </div>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <p>Unable to load profile. Please try again.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Profile Settings
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Manage your account settings and preferences
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-[var(--px-24)] px-[var(--px-20)] lg:px-0">
            <a
              href={baseUrl}
              aria-label="Resomix home"
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
            >
              ← Back to Home
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[clamp(260px,22vw,340px)_1fr] gap-[var(--px-24)] px-[var(--px-20)] lg:px-0 items-start">
            <aside className="space-y-[var(--px-20)] lg:sticky lg:top-[var(--px-120)] h-max">
              <div className="p-[var(--px-16)] border border-slate-200 border-dotted rounded-lg">
                <div className="flex items-center gap-[var(--px-12)]">
                  <ProfileIcon
                    className="text-[var(--color-primary-hover)]"
                    customWidth="40"
                    customHeight="40"
                  />
                  {/* min-w-0 lets the truncated children actually shrink inside the flex row —
                      without it a long username/email pushes past the card border. */}
                  <div className="w-full min-w-0">
                    <div
                      className="text-[length:var(--px-18)] font-medium font-helvetica truncate"
                      title={user.username}
                    >
                      {user.username}
                    </div>
                    {/* Email-verified row — its own labelled line between username and email,
                        with a neutral tick/cross (no traffic-light colours). */}
                    <div className="flex items-center justify-between gap-[var(--px-8)] mt-[var(--px-4)]">
                      <span className="flex items-center gap-[var(--px-6)] text-[length:var(--px-10)] font-light font-fira uppercase tracking-[var(--px-0-5)] text-[var(--color-primary-hover)] whitespace-nowrap">
                        Email verified:
                        {user.is_email_verified ? (
                          <svg viewBox="0 0 24 24" aria-label="Verified" className="w-[var(--px-11)] h-[var(--px-11)] text-[var(--color-primary)]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" aria-label="Not verified" className="w-[var(--px-11)] h-[var(--px-11)] text-[var(--color-primary)] opacity-80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        )}
                      </span>
                      {!user.is_email_verified && (
                        <ButtonSleek
                          text={resendingVerification ? "Sending..." : "Verify"}
                          onClick={handleResendVerification}
                          customWidth="min-w-[var(--px-60)]"
                          transparent={true}
                          disabled={resendingVerification}
                        />
                      )}
                    </div>
                    <div
                      className="text-[length:var(--px-11)] font-light font-helvetica truncate mt-[var(--px-4)]"
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
                className="p-[var(--px-8)] lg:p-[var(--px-12)] border border-slate-200 border-dotted rounded-lg grid grid-cols-3 gap-[var(--px-6)] lg:flex lg:flex-col lg:gap-[var(--px-4)]"
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
                      className={`text-center lg:text-left px-[var(--px-8)] py-[var(--px-8)] lg:px-[var(--px-10)] lg:py-[var(--px-8)] rounded-xs transition-all cursor-pointer lg:border-l-2 lg:rounded-none ${
                        active
                          ? "bg-[var(--color-primary)]/10 lg:bg-white/5 lg:border-[var(--color-primary)]"
                          : "opacity-50 hover:opacity-90 lg:border-transparent"
                      }`}
                    >
                      {/* Mobile: compact label only. Desktop: full label + hint. */}
                      <span className="block lg:hidden text-[length:var(--px-11)] font-medium font-helvetica whitespace-nowrap">
                        {t.label}
                      </span>
                      <span className="hidden lg:block min-w-0">
                        <span className="block text-[length:var(--px-12)] font-medium font-helvetica truncate">{t.labelLg}</span>
                        <span className="block text-[length:var(--px-10)] font-helvetica opacity-60 truncate">{t.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <button
                onClick={handleLogout}
                className="w-full px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted text-[length:var(--px-11)] font-light font-helvetica hover:bg-gray-100 hover:text-[var(--color-secondary)] transition-colors cursor-pointer rounded"
              >
                Logout
              </button>
            </aside>

            <main className="space-y-[var(--px-20)] min-w-0">
              {activeTab === "personal" && (
              <>
              <div className="p-[var(--px-16)] border border-slate-200 border-dotted rounded-lg">
                <div className="flex justify-between items-center mb-[var(--px-10)]">
                  <h2 className="text-[length:var(--px-14)] font-medium font-helvetica">
                    Personal Information
                  </h2>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--px-12)]">
                  <FormInput
                    label="Name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    optional
                    disabled={!isEditing}
                  />

                  <div className="flex flex-col gap-[var(--px-10)]">
                    <label className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                      Language <span className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] lg:opacity-80 font-extralight font-helvetica">(optional)</span>
                    </label>
                    <select
                      name="language"
                      value={form.language}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica disabled:opacity-50 bg-black text-slate-100"
                    >
                      <option value="">Select language</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="flex flex-col gap-[var(--px-10)]">
                      <label className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                        Timezone
                      </label>
                      <select
                        name="timezone"
                        value={form.timezone}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica disabled:opacity-50 bg-black text-slate-100"
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
                    <div className="lg:col-span-2 flex gap-[var(--px-10)] mt-[var(--px-10)] justify-end">
                      <ButtonSleek
                        text={submitting ? "Saving..." : "Save Changes"}
                        onClick={handleUpdate}
                      />
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
                        className="px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted text-[length:var(--px-11)] font-light font-helvetica hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-[var(--px-16)] border border-slate-200 border-dotted rounded-lg">
                <h2 className="text-[length:var(--px-14)] font-medium font-helvetica mb-[var(--px-10)]">
                  Security
                </h2>

                {/* Each row: text block (truncating, min-w-0) + a proper compact button pinned
                    right with a guaranteed gap — the bare "Change →" text link used to float
                    mid-row and crowd the description. */}
                <div className="flex flex-col gap-[var(--px-10)]">
                  <div className="flex justify-between items-center gap-[var(--px-16)] p-[var(--px-10)] border border-slate-200 border-dotted rounded">
                    <div className="min-w-0">
                      <div className="text-[length:var(--px-11)] font-light font-helvetica">
                        Password
                      </div>
                      <div className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80 truncate">
                        Change your account password
                      </div>
                    </div>
                    <div className="shrink-0">
                      <ButtonSleek
                        text="Change"
                        onClick={onNavigateChangePassword ?? (() => {})}
                        customWidth="min-w-[var(--px-70)]"
                        transparent={true}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-[var(--px-16)] p-[var(--px-10)] border border-slate-200 border-dotted rounded">
                    <div className="min-w-0">
                      <div className="text-[length:var(--px-11)] font-light font-helvetica">
                        Two-Factor Authentication
                      </div>
                      <div className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80 truncate">
                        {twoFactorEnabled ? "Enabled" : "Disabled"}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <ButtonSleek
                        text={twoFactorEnabled ? "Disable" : "Enable"}
                        onClick={handle2FAToggle}
                        customWidth="min-w-[var(--px-70)]"
                        transparent={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
              </>
              )}

              {activeTab === "billing" && <PlanBillingCard />}

              {activeTab === "account" && (
              <>
              <div className="p-[var(--px-16)] border border-[var(--color-neon-orange)] border-dotted rounded-lg">
                <h3 className="text-[length:var(--px-14)] font-medium font-helvetica mb-[var(--px-10)] text-[var(--color-neon-orange)]">
                  Danger Zone
                </h3>

                <div className="flex flex-col gap-[var(--px-10)]">
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-[var(--px-20)] py-[var(--px-10)] border border-[var(--color-neon-orange)] text-[var(--color-neon-orange)] text-[length:var(--px-11)] font-light font-helvetica hover:bg-white/10 transition-colors cursor-pointer rounded"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div className="border border-[var(--color-neon-orange)] p-[var(--px-10)] rounded">
                      <p className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-neon-orange)] mb-[var(--px-10)]">
                        This action cannot be undone. Enter your password to confirm:
                      </p>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-11)] font-light font-helvetica mb-[var(--px-10)] rounded"
                      />
                      <div className="flex gap-[var(--px-10)]">
                        <button
                          onClick={handleDeleteAccount}
                          className="px-[var(--px-20)] py-[var(--px-10)] bg-red-500 text-white text-[length:var(--px-11)] font-light font-helvetica hover:bg-red-600 transition-colors rounded"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeletePassword("");
                          }}
                          className="px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted text-[length:var(--px-11)] font-light font-helvetica hover:bg-gray-100 transition-colors rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </>
              )}
            </main>
          </div>
        </div>

        <StatusMessage
          isOpen={showStatus}
          onClose={() => setShowStatus(false)}
          status={statusType}
          message={statusMessage}
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