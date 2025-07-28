import React from "react";
import { IconComp } from "../Elements/IconComp";

interface ButtonHeavyRightProps {
  text: string;
  onClick: () => void;
  transparent?: boolean;
}

export const ButtonHeavyRight: React.FC<ButtonHeavyRightProps> = ({ text, onClick, transparent = false }) => (
  <div className='flex justify-center items-center cursor-pointer' onClick={onClick}>
    <div className={`w-40 h-9 px-5 py-2 rounded-3xl outline outline-[0.37px] outline-offset-[-0.37px] outline-[var(--color-primary)] inline-flex justify-center items-center gap-2 ${transparent ? 'bg-transparent' : 'bg-[var(--color-primary)]'}`}>
      <div className={`justify-start text-[10.37px] font-light font-['Fira_Code'] ${transparent ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}`}>{text}</div>
    </div>
    <IconComp className="ml-[1px]"
      svg={
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M20.2498 12H4.25" stroke={transparent ? "var(--color-text-secondary)" : "var(--color-text-primary)"} strokeWidth="0.8" strokeLinecap="square" />
          <path d="M14.5898 17.66C14.5898 14.7503 17.1524 12 20.2499 12" stroke={transparent ? "var(--color-text-secondary)" : "var(--color-text-primary)"} strokeWidth="0.8" strokeLinecap="square" />
          <path d="M14.5898 6.33995C14.5898 9.2497 17.1524 12 20.2499 12" stroke={transparent ? "var(--color-text-secondary)" : "var(--color-text-primary)"} strokeWidth="0.8" strokeLinecap="square" />
        </svg>
      }
      size="24"
      padding="p-1.5"
      backgroundColor={transparent ? "bg-transparent" : "bg-[var(--color-primary)]"}
      borderColor="outline-[var(--color-primary)]"
      strokeColor={transparent ? "var(--color-text-secondary)" : "var(--color-text-primary)"}
      width="36px"
      height="36px"
    />
  </div>
);
