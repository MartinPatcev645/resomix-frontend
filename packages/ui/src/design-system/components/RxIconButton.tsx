import React from "react";

type RxIconButtonProps = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** Use only for identity avatars; transport/actions stay square. */
  shape?: "square" | "circle";
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export function RxIconButton({
  label,
  icon,
  active = false,
  disabled = false,
  shape = "square",
  className,
  onClick,
}: RxIconButtonProps) {
  return (
    <button
      type="button"
      className={[
        "rx-icon-button",
        shape === "circle" ? "rx-icon-button--circle" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      data-active={active || undefined}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

export type { RxIconButtonProps };
