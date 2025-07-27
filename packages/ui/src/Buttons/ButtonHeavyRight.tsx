import React from "react";
import { IconComp } from "../Elements/IconComp";

interface ButtonHeavyRightProps {
  text: string;
  onClick: () => void;
}

export const ButtonHeavyRight: React.FC<ButtonHeavyRightProps> = ({ text, onClick }) => (
  <div className='flex justify-center items-center cursor-pointer' onClick={onClick}>
    <div className="w-40 h-9 px-5 py-2 bg-white rounded-3xl outline outline-[0.37px] outline-offset-[-0.37px] outline-white inline-flex justify-center items-center gap-2">
      <div className="justify-start text-black text-[10.37px] font-light font-['Fira_Code']">{text}</div>
    </div>
    <IconComp 
      svg={
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M20.2498 12H4.25" stroke="black" strokeWidth="0.8" strokeLinecap="square" />
          <path d="M14.5898 17.66C14.5898 14.7503 17.1524 12 20.2499 12" stroke="black" strokeWidth="0.8" strokeLinecap="square" />
          <path d="M14.5898 6.33995C14.5898 9.2497 17.1524 12 20.2499 12" stroke="black" strokeWidth="0.8" strokeLinecap="square" />
        </svg>
      }
      size="24"
      padding="p-1.5"
      backgroundColor="bg-white"
      borderColor="outline-white"
      strokeColor="black"
      width="36px"
      height="36px"
    />
  </div>
);
