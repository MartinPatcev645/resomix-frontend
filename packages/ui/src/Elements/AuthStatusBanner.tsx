import { useState } from "react";

interface AuthStatusBannerProps {
  onResendVerification: () => void;
  onDismiss: () => void;
}

export const AuthStatusBanner: React.FC<AuthStatusBannerProps> = ({
  onResendVerification,
  onDismiss,
}) => {
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await onResendVerification();
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full bg-[var(--color-secondary)] border-l-4 border-yellow-400 p-[var(--px-12)] mb-[var(--px-20)] flex items-center justify-between gap-[var(--px-10)] relative z-10">
      <div className="flex items-center gap-[var(--px-10)] flex-1">
        <span className="text-yellow-400 text-[length:var(--px-18)] flex-shrink-0">⚠</span>
        <div className="flex-1">
          <p className="text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-light font-helvetica text-[var(--color-text-secondary)]">
            <span className="font-medium">Please verify your email</span> to access all features.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-[var(--px-8)] flex-shrink-0">
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-[length:var(--px-11)] lg:text-[length:var(--px-10)] font-light font-helvetica text-yellow-400 hover:text-yellow-300 underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resending ? "Sending..." : "Resend Email"}
        </button>
        <button
          onClick={onDismiss}
          className="text-[length:var(--px-14)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors ml-[var(--px-8)]"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

