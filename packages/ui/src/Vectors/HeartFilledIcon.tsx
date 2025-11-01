import React from "react";

interface HeartFilledIconProps {
  className?: string;
  customWidth?: string;
  customHeight?: string;
  onClick?: () => void;
  disableHover?: boolean;
}

export const HeartFilledIcon: React.FC<HeartFilledIconProps> = ({ className = "", customWidth = "24", customHeight = "24", onClick, disableHover = false }) => {
  return (
    <button
      onClick={onClick}
      className={`${disableHover ? '' : 'cursor-pointer transition-colors hover:text-[var(--color-primary-hover)]'} ${className}`}
      aria-label="Heart"
      type="button"
    >
      <svg
        width={customWidth}
        height={customHeight}
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-[var(--px-${customWidth})] h-[var(--px-${customHeight})]`}
      >
        <path d="M12.39 20.87a.696.696 0 0 1-.78 0C9.764 19.637 2 14.15 2 8.973c0-6.68 7.85-7.75 10-3.25 2.15-4.5 10-3.43 10 3.25 0 5.178-7.764 10.664-9.61 11.895z" fill="currentColor"/>
      </svg>
    </button>
  );
};
