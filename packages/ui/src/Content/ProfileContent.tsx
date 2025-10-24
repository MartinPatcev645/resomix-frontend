import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { InputModal } from "../Modals/InputModal";
import { FormInput } from "../Elements/FormInput";
import { SineWaves } from "../Animations/SineWaves";

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
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    language: "",
    timezone: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);

  // Load user profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { getMyProfile } = await import("@resomix/api-client");
      const { useAuthStore } = await import("@resomix/stores");

      const result = await getMyProfile();

      if (result.success) {
        // Handle both possible response structures
        const userData = "user" in result.data ? result.data.user : result.data;
        setUser(userData);
        setForm({
          name: userData.name || "",
          language: userData.language || "",
          timezone: userData.timezone || "",
        });
        setTwoFactorEnabled(userData.is_two_factor_enabled || false);
        
        // Update store with fresh user data
        useAuthStore.getState().updateUser(userData);
      }
    } catch (error) {
      console.error("Profile load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (e?: FormEvent) => {
    e?.preventDefault();

    setSubmitting(true);
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Updating profile...");

    try {
      const { updateProfile } = await import("@resomix/api-client");
      const { useAuthStore } = await import("@resomix/stores");

      const result = await updateProfile(form);

      if (result.success) {
        // Handle both possible response structures
        const userData = "user" in result.data ? result.data.user : result.data;
        useAuthStore.getState().updateUser(userData);
        setUser(userData);
        setStatusType("success");
        setStatusMessage("Profile updated successfully!");
        setIsEditing(false);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable2FA = async (password: string) => {
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Disabling 2FA...");

    try {
      const { disable2FA } = await import("@resomix/api-client");
      
      const result = await disable2FA(password);

      if (result.success) {
        setTwoFactorEnabled(false);
        setStatusType("success");
        setStatusMessage("Two-factor authentication disabled");
        loadProfile(); // Reload to get updated user data
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Failed to disable 2FA");
      }
    } catch (error) {
      console.error("Disable 2FA error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    }
  };

  const handle2FAToggle = async () => {
    if (twoFactorEnabled) {
      // Show input modal for password
      setShowDisable2FAModal(true);
    } else {
      setStatusType("loading");
      setShowStatus(true);
      setStatusMessage("Enabling 2FA...");

      try {
        const { enable2FA } = await import("@resomix/api-client");
        
        const result = await enable2FA("email");

        if (result.success) {
          setTwoFactorEnabled(true);
          setStatusType("success");
          setStatusMessage("Two-factor authentication enabled! Check your email for verification.");
          loadProfile(); // Reload to get updated user data
        } else {
          const errorResult = result as { success: false; error: string };
          setStatusType("error");
          setStatusMessage(errorResult.error || "Failed to enable 2FA");
        }
      } catch (error) {
        console.error("2FA toggle error:", error);
        setStatusType("error");
        setStatusMessage("Network error. Please try again.");
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setStatusType("error");
      setShowStatus(true);
      setStatusMessage("Password is required to delete account");
      return;
    }

    setSubmitting(true);
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Deleting account...");

    try {
      const { deleteAccount } = await import("@resomix/api-client");
      const { useAuthStore } = await import("@resomix/stores");

      const result = await deleteAccount(deletePassword);

      if (result.success) {
        setStatusType("success");
        setStatusMessage("Account deleted successfully. Redirecting...");
        
        // Logout after delay
        setTimeout(() => {
          useAuthStore.getState().logout();
          onLogout?.();
        }, 2000);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Failed to delete account");
      }
    } catch (error) {
      console.error("Delete account error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
      setShowDeleteConfirm(false);
      setDeletePassword("");
    }
  };

  const handleLogout = async () => {
    try {
      const { logout } = await import("@resomix/api-client");
      const { useAuthStore } = await import("@resomix/stores");

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        await logout(refreshToken);
      }
      
      useAuthStore.getState().logout();
      onLogout?.();
    } catch (error) {
      console.error("Logout error:", error);
      // Logout locally anyway
      const { useAuthStore } = await import("@resomix/stores");
      useAuthStore.getState().logout();
      onLogout?.();
    }
  };

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
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Profile Settings
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Manage your account settings and preferences
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <a
              href={baseUrl}
              aria-label="Resomix home"
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors"
            >
              ← Back to Home
            </a>
          </div>

          {/* Profile Header */}
          <div className="mb-[var(--px-20)] pb-[var(--px-20)] border-b border-slate-200 border-dotted">
            <div className="flex items-center gap-[var(--px-20)]">
              <div className="w-[var(--px-60)] h-[var(--px-60)] bg-[var(--color-primary)] text-[var(--color-secondary)] rounded-full flex items-center justify-center text-[length:var(--px-24)] font-medium font-helvetica">
                {user.username?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <div className="text-[length:var(--px-18)] font-medium font-helvetica">
                  {user.username}
                </div>
                <div className="text-[length:var(--px-11)] font-light font-helvetica flex items-center gap-[var(--px-8)] mt-[var(--px-4)]">
                  {user.email}
                  {user.is_email_verified ? (
                    <span className="text-green-500 text-[length:var(--px-10)]">✓ Verified</span>
                  ) : (
                    <span className="text-yellow-500 text-[length:var(--px-10)]">⚠ Not Verified</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="mb-[var(--px-20)]">
            <div className="flex justify-between items-center mb-[var(--px-10)]">
              <h2 className="text-[length:var(--px-14)] font-medium font-helvetica">
                Personal Information
              </h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            <form onSubmit={handleUpdate} className="flex flex-col gap-[var(--px-10)]">
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
                  className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica disabled:opacity-50"
                >
                  <option value="">Select language</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <FormInput
                label="Timezone"
                name="timezone"
                type="text"
                value={form.timezone}
                onChange={handleChange}
                placeholder="e.g., America/New_York"
                optional
                disabled={!isEditing}
              />

              {isEditing && (
                <div className="flex gap-[var(--px-10)] mt-[var(--px-10)]">
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
                        timezone: user.timezone || "",
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

          {/* Security Settings */}
          <div className="mb-[var(--px-20)] pt-[var(--px-20)] border-t border-slate-200 border-dotted">
            <h2 className="text-[length:var(--px-14)] font-medium font-helvetica mb-[var(--px-10)]">
              Security
            </h2>

            <div className="flex flex-col gap-[var(--px-10)]">
              <div className="flex justify-between items-center p-[var(--px-10)] border border-slate-200 border-dotted">
                <div>
                  <div className="text-[length:var(--px-11)] font-light font-helvetica">
                    Two-Factor Authentication
                  </div>
                  <div className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80">
                    {twoFactorEnabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
                <button
                  onClick={handle2FAToggle}
                  className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                >
                  {twoFactorEnabled ? "Disable" : "Enable"}
                </button>
              </div>

              <button
                onClick={onNavigateChangePassword}
                className="flex justify-between items-center p-[var(--px-10)] border border-slate-200 border-dotted hover:bg-gray-50 transition-colors"
              >
                <div className="text-[length:var(--px-11)] font-light font-helvetica text-left">
                  Change Password
                </div>
                <span className="text-[var(--color-primary)]">→</span>
              </button>

              <button
                onClick={onNavigateSessions}
                className="flex justify-between items-center p-[var(--px-10)] border border-slate-200 border-dotted hover:bg-gray-50 transition-colors"
              >
                <div className="text-[length:var(--px-11)] font-light font-helvetica text-left">
                  Active Sessions
                </div>
                <span className="text-[var(--color-primary)]">→</span>
              </button>
            </div>
          </div>

          {/* Account Actions */}
          <div className="pt-[var(--px-20)] border-t border-slate-200 border-dotted">
            <div className="flex flex-col gap-[var(--px-10)]">
              <button
                onClick={handleLogout}
                className="px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted text-[length:var(--px-11)] font-light font-helvetica hover:bg-gray-100 transition-colors"
              >
                Logout
              </button>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-[var(--px-20)] py-[var(--px-10)] border border-red-500 text-red-500 text-[length:var(--px-11)] font-light font-helvetica hover:bg-red-50 transition-colors"
                >
                  Delete Account
                </button>
              ) : (
                <div className="border border-red-500 p-[var(--px-10)]">
                  <p className="text-[length:var(--px-11)] font-light font-helvetica text-red-500 mb-[var(--px-10)]">
                    This action cannot be undone. Enter your password to confirm:
                  </p>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-11)] font-light font-helvetica mb-[var(--px-10)]"
                  />
                  <div className="flex gap-[var(--px-10)]">
                    <button
                      onClick={handleDeleteAccount}
                      className="px-[var(--px-20)] py-[var(--px-10)] bg-red-500 text-white text-[length:var(--px-11)] font-light font-helvetica hover:bg-red-600 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                      }}
                      className="px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted text-[length:var(--px-11)] font-light font-helvetica hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
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
      </div>
    </section>
  );
}

