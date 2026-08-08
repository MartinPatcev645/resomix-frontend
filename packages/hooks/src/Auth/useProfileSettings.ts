/**
 * useProfileSettings
 * ==================
 *
 * ALL of the profile page's behaviour — profile load/refresh, edit form, 2FA enable/disable,
 * resend-verification, delete-account, logout, the status banner and the active tab — extracted
 * from `ProfileContent.tsx` so the component is render-only (repo convention: functionality lives
 * in hooks, components render). Moved verbatim from the component on 2026-07-22; no behaviour
 * change intended. Auth-sensitive: touch with care.
 */

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";

/** Profile tabs — also the accepted values for the `?tab=` deep-link. */
export type ProfileTab = "personal" | "billing" | "account";
const PROFILE_TABS: ProfileTab[] = ["personal", "billing", "account"];

export type TimezoneOption = {
  value: string;
  label: string;
  offset: number;
};

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
];

function formatOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

function getOffsetMinutes(timeZone: string, date = new Date()): number {
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const zoned = new Date(date.toLocaleString("en-US", { timeZone }));
  return Math.round((zoned.getTime() - utc.getTime()) / 60000);
}

function buildTimezones(): TimezoneOption[] {
  const zones =
    typeof (Intl as any).supportedValuesOf === "function"
      ? ((Intl as any).supportedValuesOf("timeZone") as string[])
      : COMMON_TIMEZONES;
  const now = new Date();
  const options = zones.map((tz) => {
    const offset = getOffsetMinutes(tz, now);
    return {
      value: tz,
      offset,
      label: `(${formatOffset(offset)}) ${tz}`,
    };
  });
  options.sort((a, b) => a.offset - b.offset || a.value.localeCompare(b.value));
  return options;
}

export interface UseProfileSettingsOptions {
  /** Called after a successful logout / account deletion (routes back home). */
  onLogout?: () => void;
}

export function useProfileSettings({ onLogout }: UseProfileSettingsOptions = {}) {
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
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [activeTab, setActiveTabState] = useState<ProfileTab>(() => {
    // Precedence: returning from Stripe Checkout (?checkout=success|cancelled) forces Billing so the
    // updated plan + confirmation banner show first; otherwise honour ?tab=; else Personal.
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout")) return "billing";
      const tab = params.get("tab") as ProfileTab | null;
      return tab && PROFILE_TABS.includes(tab) ? tab : "personal";
    } catch {
      return "personal";
    }
  });

  // Switch tabs AND reflect it in the URL (?tab=…) so tabs are shareable/deep-linkable, mirroring the
  // library page. Uses replaceState (no history spam). Drops the one-shot ?checkout marker.
  const setActiveTab = useCallback((tab: ProfileTab) => {
    setActiveTabState(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    setTimezones(buildTimezones());
  }, []);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { useAuthStore } = await import("@resomix/stores");
      const store = useAuthStore.getState();
      const { getMyProfile } = await import("@resomix/api-client");

      // Always fetch the latest profile so fields that only live on /me — has_password,
      // auth_providers (linked accounts), and verification status — are current. Fall back to the
      // store copy only if the request fails.
      const result = await getMyProfile();

      if (result.success) {
        const userData = "user" in result.data ? result.data.user : result.data;
        setUser(userData);
        setForm({
          name: userData.name || "",
          language: userData.language || "",
          timezone: userData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        });
        setTwoFactorEnabled(userData.is_two_factor_enabled || false);
        useAuthStore.getState().updateUser(userData);
      } else if (store.user) {
        setUser(store.user);
        setForm({
          name: store.user.name || "",
          language: store.user.language || "",
          timezone: store.user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        });
        setTwoFactorEnabled(store.user.is_two_factor_enabled || false);
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
        const responseData = "user" in result.data ? result.data.user : result.data;

        // Extract only the fields that should be updated (exclude 'message' and other non-user fields)
        const fieldsToUpdate: Partial<typeof user> = {};

        // Only update fields that are present in the response and are part of the user object
        if (responseData.email !== undefined) fieldsToUpdate.email = responseData.email;
        if (responseData.username !== undefined) fieldsToUpdate.username = responseData.username;
        if (responseData.name !== undefined) fieldsToUpdate.name = responseData.name;
        if (responseData.profile_picture !== undefined) fieldsToUpdate.profile_picture = responseData.profile_picture;
        if (responseData.language !== undefined) fieldsToUpdate.language = responseData.language;
        if (responseData.timezone !== undefined) fieldsToUpdate.timezone = responseData.timezone;

        // Update only the specified fields in the store (preserves other fields like is_email_verified, etc.)
        useAuthStore.getState().updateUser(fieldsToUpdate);

        // Update local state with merged data from store
        const updatedUser = useAuthStore.getState().user;
        if (updatedUser) {
          setUser(updatedUser);
        }

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
      const { useAuthStore } = await import("@resomix/stores");

      const result = await disable2FA(password);

      if (result.success) {
        setTwoFactorEnabled(false);
        setUser((prev: any) => {
          const updated = prev ? { ...prev, is_two_factor_enabled: false } : prev;
          if (updated) useAuthStore.getState().updateUser(updated);
          return updated;
        });
        setStatusType("success");
        setStatusMessage("Two-factor authentication disabled");
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
      setShowDisable2FAModal(true);
    } else {
      // Check email verification before enabling 2FA
      const { useAuthStore } = await import("@resomix/stores");
      const store = useAuthStore.getState();
      const currentUser = store.user || user;

      if (!currentUser?.is_email_verified) {
        setStatusType("error");
        setShowStatus(true);
        setStatusMessage("Please verify your email address before enabling two-factor authentication.");
        return;
      }

      setStatusType("loading");
      setShowStatus(true);
      setStatusMessage("Enabling 2FA...");

      try {
        const { enable2FA } = await import("@resomix/api-client");

        const result = await enable2FA("email");

        if (result.success) {
          setTwoFactorEnabled(true);
          setUser((prev: any) => {
            const updated = prev ? { ...prev, is_two_factor_enabled: true } : prev;
            if (updated) useAuthStore.getState().updateUser(updated);
            return updated;
          });
          setStatusType("success");
          setStatusMessage("Two-factor authentication enabled!");
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
    // A password is required only when the account HAS one. A Google-only sign-up has no password
    // hash, and demanding one made deletion impossible for those users — the server now decides,
    // and `hasPassword` mirrors that rule here so the dialog asks for the right thing.
    const hasPassword = !!user?.has_password;
    if (hasPassword && !deletePassword) {
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

      const result = await deleteAccount(deletePassword || undefined);

      if (result.success) {
        // Deletion is SCHEDULED, not immediate — there is a 30-day grace period in which the
        // account can be restored. Saying "deleted successfully" would misstate that, and the
        // date is the single most useful thing to put in front of someone having second thoughts.
        const purgeDate = (result as { data?: { purge_due_at?: string } }).data?.purge_due_at;
        const when = purgeDate
          ? new Date(purgeDate).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : null;
        setStatusType("success");
        setStatusMessage(
          when
            ? `Your account is deactivated and will be permanently deleted on ${when}. We've emailed you the details — contact us before then if you change your mind.`
            : "Your account is deactivated and scheduled for deletion. Check your email for the details."
        );
        setTimeout(() => {
          useAuthStore.getState().logout();
          onLogout?.();
        }, 4000);
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

  const handleResendVerification = async () => {
    if (!user?.email) {
      setStatusType("error");
      setShowStatus(true);
      setStatusMessage("Email address not found.");
      return;
    }

    setResendingVerification(true);
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Sending verification email...");

    try {
      const { resendVerification } = await import("@resomix/api-client");
      const result = await resendVerification(user.email);

      if (result.success) {
        setStatusType("success");
        setStatusMessage("Verification email sent! Please check your inbox.");
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Failed to send verification email.");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { logout } = await import("@resomix/api-client");
      const { useAuthStore } = await import("@resomix/stores");

      // Server reads refresh token from HttpOnly cookie
      await logout();

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

  return {
    // State
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
    // Actions
    handleChange,
    handleUpdate,
    handleDisable2FA,
    handle2FAToggle,
    handleDeleteAccount,
    handleResendVerification,
    handleLogout,
  };
}
