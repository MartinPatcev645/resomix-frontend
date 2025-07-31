import React from "react";

const truncateText = (text: string | undefined, max: number) =>
  text && text.length > max ? `${text.slice(0, max)}…` : text;

interface SearchResult {
  id: string | number;
  title: string;
  artist?: string;
  duration?: string;
}

interface SearchDropdownProps {
  results: SearchResult[];
  show: boolean;
  onSelect?: (result: SearchResult) => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({ results, show, onSelect }) => {
  if (!show) return null;

  return (
    <div className="absolute right-0 top-[var(--px-34)] mt-[var(--px-4)] w-[var(--px-550)] bg-[var(--color-primary)] rounded-[12px] shadow-lg overflow-hidden z-30 outline outline-[0.5px] outline-[var(--color-primary)] text-black">
      {results.length === 0 ? (
        <div className="py-[var(--px-10)] px-[var(--px-19-259)] text-black text-[length:var(--px-11)] font-fira opacity-60">
          No results found.
        </div>
      ) : (
        <ul className="max-h-[var(--px-300)] overflow-y-auto divide-y divide-[rgba(0,0,0,0.05)]">
          {results.map((item) => (
            <li
              key={item.id}
              className="flex justify-between items-center py-[var(--px-12)] px-[var(--px-19-259)] hover:bg-[rgba(0,0,0,0.03)] cursor-pointer select-none shadow-md"
              onClick={() => onSelect?.(item)}
            >
              <div className="flex items-center">
                <svg className="w-[var(--px-12)] h-[var(--px-12)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="9 18 15 21 15 3 9 6 9 18" />
                  <circle cx="6" cy="20" r="3" />
                </svg>
                <div className="flex flex-col ml-[var(--px-30)]">
                  <span className="uppercase font-auger text-[length:var(--px-11-7)] font-light leading-wide">
                    {truncateText(item.title, 55)}
                  </span>
                  {item.artist && (
                    <span className="font-fira text-[length:var(--px-9-6)] font-light leading-normal">
                      {truncateText(item.artist, 70)}
                    </span>
                  )}
                </div>
              </div>
              {item.duration && (
                <span className="font-fira font-light text-[length:var(--px-8-889)]">
                  {item.duration}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
