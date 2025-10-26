import React from "react";

interface HeartStrokeIconProps {
  className?: string;
  customWidth?: string;
  customHeight?: string;
  onClick?: () => void;
  disableHover?: boolean;
}

export const HeartStrokeIcon: React.FC<HeartStrokeIconProps> = ({ className = "", customWidth = "24", customHeight = "24", onClick, disableHover = false }) => {
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
        <path d="M4.42602 12.3115L12 19.8854L19.574 12.3115C21.4753 10.4101 21.4753 7.32738 19.574 5.42602C17.6726 3.52466 14.5899 3.52466 12.6885 5.42602L12 6.11456L11.3115 5.42602C9.4101 3.52466 6.32738 3.52466 4.42602 5.42602C2.52466 7.32738 2.52466 10.4101 4.42602 12.3115Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      </svg>
    </button>
  );
};
