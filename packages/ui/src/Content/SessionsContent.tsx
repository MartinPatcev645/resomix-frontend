import { useState, useEffect } from "react";
import { StatusMessage } from "../Elements/StatusMessage";
import { ConfirmModal } from "../Modals/ConfirmModal";
import { SineWaves } from "../Animations/SineWaves";

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

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [showConfirmLogoutAll, setShowConfirmLogoutAll] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
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
      const { useAuthStore } = await import("@resomix/stores");

      const user = useAuthStore.getState().user;
      if (!user || !user.id) return;

      const result = await logoutAll(user.id);

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

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Active Sessions
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Manage your active login sessions
          </p>
        </header>

        <div className="max-w-[var(--px-550)] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <button
              onClick={onNavigateProfile}
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors"
            >
              ← Back to Profile
            </button>
          </div>

          <p className="text-[length:var(--px-11)] font-extralight font-helvetica lg:opacity-80 mb-[var(--px-20)]">
            This is a list of devices that have logged into your account. Revoke any sessions that
            you do not recognize.
          </p>

          {sessions.length === 0 ? (
            <div className="text-center py-[var(--px-40)]">
              <p className="text-[length:var(--px-14)] font-light font-helvetica">
                No active sessions found
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--px-10)]">
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  className="p-[var(--px-12)] border border-slate-200 border-dotted"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-[var(--px-8)] mb-[var(--px-4)]">
                        <div className="text-[length:var(--px-12)] font-medium font-helvetica">
                          {session.user_agent || "Unknown Device"}
                        </div>
                      </div>
                      <div className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80">
                        IP: {maskIP(session.ip_address)}
                      </div>
                      <div className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80">
                        Expires: {formatDate(session.expires_at)}
                      </div>
                      <div className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80">
                        Created: {formatDate(session.created_at)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeSession(session.session_id)}
                      className="text-[length:var(--px-10)] font-light font-helvetica text-red-500 hover:text-red-700 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sessions.length > 1 && (
            <div className="mt-[var(--px-20)] pt-[var(--px-20)] border-t border-slate-200 border-dotted">
              <button
                onClick={confirmLogoutAll}
                className="w-full px-[var(--px-20)] py-[var(--px-10)] border border-red-500 text-red-500 text-[length:var(--px-11)] font-light font-helvetica hover:bg-red-50 transition-colors"
              >
                Logout All Other Devices
              </button>
              <p className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80 text-center mt-[var(--px-8)]">
                This will sign you out from all devices except this one
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
        </div>
      </div>
    </section>
  );
}

