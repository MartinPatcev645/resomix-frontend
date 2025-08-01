import React from "react";
import { IconComp } from "../Elements/IconComp";

interface ButtonHeavyRightProps {
  text: string;
  onClick: () => void;
  transparent?: boolean;
}

export const ButtonHeavyRight: React.FC<ButtonHeavyRightProps> = ({ text, onClick, transparent = false }) => (
  <div className='flex justify-center items-center cursor-pointer group' onClick={onClick}>
    <div
      className={`min-w-[var(--px-160)] h-[var(--px-36)] px-[var(--px-20)] py-[var(--px-8)] rounded-3xl outline outline-[0.37px] outline-offset-[-0.37px] outline-[var(--color-primary)] group-hover:outline-[var(--color-primary-hover)] transition-colors inline-flex justify-center items-center gap-[var(--px-8)] ${
        transparent
          ? 'bg-transparent group-hover:bg-[var(--color-primary-hover)]'
          : 'bg-[var(--color-primary)] group-hover:bg-[var(--color-primary-hover)]'
      }`}
    >
      <div
        className={`tracking-normal whitespace-nowrap text-[length:var(--px-10-37)] font-light font-fira ${
          transparent
            ? 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-primary)]'
        }`}
      >
        {text}
      </div>
    </div>
    <IconComp
      className="ml-[var(--px-1)]"
      svg={
        <svg
          className={`w-[var(--px-24)] h-[var(--px-24)] ${
            transparent
              ? 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-primary)]'
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          {/* Default horizontal arrow icon */}
          <g className="group-hover:hidden">
            <path d="M20.2498 12H4.25" stroke="currentColor" strokeWidth="0.8" strokeLinecap="square" />
            <path d="M14.5898 17.66C14.5898 14.7503 17.1524 12 20.2499 12" stroke="currentColor" strokeWidth="0.8" strokeLinecap="square" />
            <path d="M14.5898 6.33995C14.5898 9.2497 17.1524 12 20.2499 12" stroke="currentColor" strokeWidth="0.8" strokeLinecap="square" />
          </g>

          {/* Hover vertical arrow icon */}
          <g className="hidden group-hover:block">  
            <svg
              className="w-[var(--px-24)] h-[var(--px-24)]"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 19 19"
              fill="none"
            >
              <path d="M9.33301 15.4072L9.33301 3.55554" stroke="currentColor" strokeWidth="0.592593" strokeLinecap="square" />
              <path d="M5.14042 11.2148C7.29575 11.2148 9.33301 13.1131 9.33301 15.4075" stroke="currentColor" strokeWidth="0.592593" strokeLinecap="square" />
              <path d="M13.5264 11.2148C11.371 11.2148 9.33374 13.1131 9.33374 15.4075" stroke="currentColor" strokeWidth="0.592593" strokeLinecap="square" />
              <line x1="2.66699" y1="17.889" x2="16.0003" y2="17.889" stroke="currentColor" strokeWidth="0.592593" />
            </svg>
          </g>
        </svg>
      }
      padding="p-1.5"
      backgroundColor={
        transparent
          ? 'bg-transparent group-hover:bg-[var(--color-primary-hover)] transition-colors'
          : 'bg-[var(--color-primary)] group-hover:bg-[var(--color-primary-hover)] transition-colors'
      }
      borderColor="outline-[var(--color-primary)]"
      /* strokeColor unused because paths use currentColor; kept for compatibility */
      strokeColor="currentColor"
    />
  </div>
);
