import React from "react";

type RxSidebarItemProps = {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export function RxSidebarItem({ label, count, active = false, onClick }: RxSidebarItemProps) {
  return (
    <button
      type="button"
      className="rx-sidebar-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <span>{label}</span>
      {typeof count === "number" ? <span className="rx-meta">{count}</span> : null}
    </button>
  );
}

export type { RxSidebarItemProps };
