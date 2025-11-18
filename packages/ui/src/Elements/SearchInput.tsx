import React from "react";

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  width?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, onFocus, placeholder = "Search Now", width = "w-[var(--px-588)]" }) => (
  <div className="flex items-center w-full">
    <div className="relative bg-[var(--color-primary)] rounded-3xl outline outline-[0.50px] outline-offset-[-0.50px] outline-[var(--color-primary)] overflow-hidden p-[var(--px-10)]">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="4 2 16 16" fill="none">
        <path d="M17.8983 11.1113H5.30566" stroke="black" strokeWidth="0.592593" strokeLinecap="square" />
        <path d="M13.4541 15.5558C13.4541 13.271 15.4663 11.1113 17.8985 11.1113" stroke="black" strokeWidth="0.592593" strokeLinecap="square" />
        <path d="M13.4541 6.6665C13.4541 8.95133 15.4663 11.1109 17.8985 11.1109" stroke="black" strokeWidth="0.592593" strokeLinecap="square" />
      </svg>
    </div>
    <input
      type="text"
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      placeholder={placeholder}
      className={`h-[var(--px-34)] py-[var(--px-8-889)] px-[var(--px-19-259)] bg-[var(--color-primary)] rounded-[30px] outline outline-[0.50px] outline-offset-[-0.50px] outline-[var(--color-primary)] text-[var(--color-text-primary)] text-[length:var(--px-16)] font-fira inline-flex justify-center items-center gap-[var(--px-10)] ${width}`}
    />
  </div>
);
