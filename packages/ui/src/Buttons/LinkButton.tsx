import React from "react";

interface LinkButtonProps {
  text: string;
  path: string;
}

export const LinkButton: React.FC<LinkButtonProps> = ({ text, path }) => (
  <a 
    href={path}
    className="p-[var(--px-8)] opacity-70 flex justify-center items-center gap-[var(--px-8)] hover:opacity-100 transition-opacity cursor-pointer font-extralight"
  >
    <div className="justify-start text-[length:var(--px-10)] font-['Fira_Code']">[{text}]</div>
  </a>
);
