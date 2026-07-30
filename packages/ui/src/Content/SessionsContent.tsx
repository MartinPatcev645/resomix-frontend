import { useState, useEffect } from "react";
import { StatusMessage } from "../Elements/StatusMessage";
import { ConfirmModal } from "../Modals/ConfirmModal";
import { SineWaves } from "../Animations/SineWaves";
import { AuthScreen } from "./AuthScreen";
import {
  PAGE_BTN_DANGER as BTN_DANGER,
  PAGE_BTN_SECONDARY as BTN_SECONDARY,
  PAGE_ROW_META,
  PAGE_ROW_TITLE,
  PAGE_SUBLABEL as SUBLABEL,
} from "./pageChrome";

/**
 * Active sessions list, on the shared AuthScreen shell. Session rows use the same inset-row chrome
 * as the Profile page's panels. Revoke / logout-all behaviour is unchanged.
 */

interface UserSession {
  session_id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
}

interface SessionsContentProps {
  baseUrl?: string;
  onNavigateProfile?: () => void;
}

export default function SessionsContent({
  baseUrl = "https://resomix.com",
  onNavigateProfile,
}: SessionsContentProps) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingRef, setIsLoadingRef] = useState(false);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [showConfirmLogoutAll, setShowConfirmLogoutAll] = useState(false);

  useEffect(() => {
    // Prevent duplicate requests on mount
    if (!isLoadingRef) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessions = async () => {
    // Prevent duplicate requests
    if (isLoadingRef) {
      // console.log('[SessionsContent] Request already in progress, skipping');
      return;
    }
    
    setLoading(true);
    setIsLoadingRef(true);
    try {
      const { getMySessions } = await import("@resomix/api-client");

      const result = await getMySessions();

      if (result.success) {
        // Handle both response formats: direct array or wrapped in {sessions: [...]}
        if (Array.isArray(result.data)) {
          setSessions(result.data);
        } else if (result.data && Array.isArray(result.data.sessions)) {
          setSessions(result.data.sessions);
        } else {
          console.error("Invalid sessions data format:", result);
          setSessions([]);
        }
      }
    } catch (error) {
      console.error("Sessions load error:", error);
      setStatusType("error");
      setShowStatus(true);
      setStatusMessage("Failed to load sessions");
      setSessions([]); // Ensure sessions is always an array
    } finally {
      setLoading(false);
      setIsLoadingRef(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Revoking session...");

    try {
      const { revokeSession } = await import("@resomix/api-client");

      const result = await revokeSession(sessionId);

      if (result.success) {
        setStatusType("success");
        setStatusMessage("Session revoked successfully");
        
        // Reload sessions
        await loadSessions();
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Failed to revoke session");
      }
    } catch (error) {
      console.error("Revoke session error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    }
  };

  const confirmLogoutAll = () => {
    setShowConfirmLogoutAll(true);
  };

  const handleLogoutAll = async () => {
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Logging out from all devices...");

    try {
      const { logoutAll } = await import("@resomix/api-client");

      const result = await logoutAll();

      if (result.success) {
        setStatusType("success");
        setStatusMessage("Logged out from all other devices");
        
        // Reload sessions
        await loadSessions();
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Failed to logout all devices");
      }
    } catch (error) {
      console.error("Logout all error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const maskIP = (ip: string | null) => {
    if (!ip) return "Unknown";
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip;
  };

  if (loading) {
    // Same shell as the loaded state, so the header and frame don't jump when the list arrives.
    return (
      <AuthScreen
        eyebrow="Account // Sessions"
        title="Active Sessions"
        lead="Manage the devices signed in to your account."
        panelLabel="Loading"
      >
        <div className="flex items-center justify-center p-[var(--px-28)]">
          <div className="h-[var(--px-120)] w-full max-w-[var(--px-300)]">
            <SineWaves />
          </div>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      eyebrow="Account // Sessions"
      title="Active Sessions"
      lead="Manage the devices signed in to your account."
      backControl={
        <button type="button" onClick={onNavigateProfile} className={`${BTN_SECONDARY} gap-[var(--px-6)]`}>
          <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Profile
        </button>
      }
      panelLabel="Signed-in devices"
      panelNote={`${sessions.length} active`}
    >
      <div className="flex flex-col gap-[var(--px-14)] p-[var(--px-20)]">
        <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-80">
          These devices have logged into your account. Revoke any session you do not recognise.
        </p>

        {sessions.length === 0 ? (
          <p className={`${SUBLABEL} py-[var(--px-28)] text-center`}>No active sessions found</p>
        ) : (
          <div className="flex flex-col gap-[var(--px-10)]">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className="flex items-start justify-between gap-[var(--px-16)] border border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,0.02)] p-[var(--px-12)]"
              >
                <div className="min-w-0 flex-1">
                  <div className={`${PAGE_ROW_TITLE} truncate`} title={session.user_agent || "Unknown Device"}>
                    {session.user_agent || "Unknown Device"}
                  </div>
                  <div className={PAGE_ROW_META}>IP: {maskIP(session.ip_address)}</div>
                  <div className={PAGE_ROW_META}>Created: {formatDate(session.created_at)}</div>
                  <div className={PAGE_ROW_META}>Expires: {formatDate(session.expires_at)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRevokeSession(session.session_id)}
                  className={`${BTN_DANGER} shrink-0`}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {sessions.length > 1 && (
        <div className="flex flex-col items-stretch gap-[var(--px-8)] border-t border-dotted border-[var(--rx-color-border-subtle)] p-[var(--px-20)]">
          <button
            type="button"
            onClick={confirmLogoutAll}
            className={`${BTN_DANGER} w-full !min-h-[var(--px-44)]`}
          >
            Logout All Other Devices
          </button>
          <p className={`${SUBLABEL} text-center`}>
            Signs you out everywhere except this device
          </p>
        </div>
      )}

      <StatusMessage
        isOpen={showStatus}
        onClose={() => setShowStatus(false)}
        status={statusType}
        message={statusMessage}
      />

      <ConfirmModal
        isOpen={showConfirmLogoutAll}
        onClose={() => setShowConfirmLogoutAll(false)}
        onConfirm={handleLogoutAll}
        title="Logout All Devices"
        message="Are you sure you want to logout from all other devices? You will need to login again on those devices."
        confirmText="Logout All"
        cancelText="Cancel"
        confirmDanger={true}
      />
    </AuthScreen>
  );
}

