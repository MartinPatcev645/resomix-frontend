import React from "react";

interface LinkButtonProps {
  text: string;
  path: string;
  newTab?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const LinkButton: React.FC<LinkButtonProps> = ({ text, path, newTab = false, id, className, ariaLabel, onClick }) => (
  <a
    href={path}
    aria-label={ariaLabel || text}
    className={`p-[var(--px-8)] opacity-70 flex justify-center items-center gap-[var(--px-8)] hover:opacity-100 transition-opacity cursor-pointer font-extralight ${className}`}
    target={newTab ? "_blank" : ""}
    rel={newTab ? "noopener noreferrer" : ""}
    id={id}
    onClick={(e) => {
      if (onClick) {
        e.preventDefault();
        onClick(e);
      }
    }}
  >
    <div className="justify-start text-[length:var(--px-10)] font-['Fira_Code']">[{text}]</div>
  </a>
);
