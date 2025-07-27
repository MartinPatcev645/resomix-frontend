import React from "react";

interface LinkButtonProps {
  text: string;
  path: string;
}

export const LinkButton: React.FC<LinkButtonProps> = ({ text, path }) => (
  <a 
    href={path}
    className="p-2 opacity-80 flex justify-center items-center gap-2 hover:opacity-100 transition-opacity cursor-pointer font-light hover:underline"
  >
    <div className="justify-start text-[10.37px] font-['Fira_Code']">[{text}]</div>
  </a>
);
