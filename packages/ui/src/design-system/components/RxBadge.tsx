import React from "react";
import type { RxStatusTone } from "../types";

type RxBadgeProps = {
  children: React.ReactNode;
  tone?: RxStatusTone;
};

export function RxBadge({ children, tone = "neutral" }: RxBadgeProps) {
  return (
    <span className="rx-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export type { RxBadgeProps };
