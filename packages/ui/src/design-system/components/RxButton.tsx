import React from "react";

type RxButtonVariant = "primary" | "secondary" | "ghost";

type RxButtonProps = {
  children: React.ReactNode;
  variant?: RxButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  className?: string;
  leadingIcon?: React.ReactNode;
};

export function RxButton({
  children,
  variant = "secondary",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  ariaLabel,
  className,
  leadingIcon,
}: RxButtonProps) {
  return (
    <button
      type={type}
      className={["rx-button", `rx-button--${variant}`, className].filter(Boolean).join(" ")}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="rx-button__spinner" aria-hidden="true" /> : null}
      {!loading && leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export type { RxButtonProps, RxButtonVariant };
