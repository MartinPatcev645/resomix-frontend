import React from "react";

interface IconButtonProps {
  text: string;
  onClick: () => void;
  transparent?: boolean;
  className?: string;
  customWidth?: string;
  disabled?: boolean;
  mobile?: boolean;
  icon: React.ReactNode;
  hoverIcon?: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({ text, onClick, transparent = false, className, customWidth, icon, hoverIcon, mobile = false, disabled = false }) => (
  <div className={`flex justify-center items-center group ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={disabled ? undefined : onClick}>
    <div
      className={`rounded-3xl outline outline-[var(--px-1)] outline-offset-[-var(--px-1)] outline-[var(--color-primary)] group-hover:outline-[var(--color-primary-hover)] transition-colors inline-flex justify-center items-center gap-[var(--px-8)] ${transparent
        ? 'bg-transparent group-hover:bg-[var(--color-primary-hover)]'
        : 'bg-[var(--color-primary)] group-hover:bg-[var(--color-primary-hover)]'
        } ${className} ${customWidth ? customWidth : 'min-w-[var(--px-160)]'} ${mobile ? 'px-[var(--px-10)] py-[var(--px-3)] text-[length:var(--px-10)] leading-[var(--px-10)]' : 'px-[var(--px-20)] py-[var(--px-4)] text-[length:var(--px-10-37)]'}`}
    >
      {/* Display hover icon when hovering, else display normal icon */}
      <div className="block group-hover:hidden">{icon}</div>
      {hoverIcon && <div className="hidden group-hover:block">{hoverIcon}</div>}
      <div
        className={`tracking-normal whitespace-nowrap font-light font-fira ${transparent
          ? 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-primary)]'  
          }`}
      >
        {text}
      </div>
    </div>
  </div>
);
