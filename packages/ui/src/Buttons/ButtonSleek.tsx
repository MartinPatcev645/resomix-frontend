import React from "react";

interface ButtonSleekProps {
  text: string;
  onClick: () => void;
  transparent?: boolean;
  className?: string;
}

export const ButtonSleek: React.FC<ButtonSleekProps> = ({ text, onClick, transparent = false, className }) => (
  <div className='flex justify-center items-center cursor-pointer group' onClick={onClick}>
    <div
      className={`min-w-[var(--px-160)] h-[var(--px-36)] px-[var(--px-20)] py-[var(--px-8)] rounded-3xl outline outline-[var(--px-1)] outline-offset-[-var(--px-1)] outline-[var(--color-primary)] group-hover:outline-[var(--color-primary-hover)] transition-colors inline-flex justify-center items-center gap-[var(--px-8)] ${transparent
        ? 'bg-transparent group-hover:bg-[var(--color-primary-hover)]'
        : 'bg-[var(--color-primary)] group-hover:bg-[var(--color-primary-hover)]'
        } ${className}`}
    >
      <div
        className={`tracking-normal whitespace-nowrap text-[length:var(--px-10-37)] font-light font-fira ${transparent
          ? 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-primary)]'
          }`}
      >
        {text}
      </div>
    </div>
  </div>
);
