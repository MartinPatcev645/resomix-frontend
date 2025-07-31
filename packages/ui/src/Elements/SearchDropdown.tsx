import React from "react";

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
              <div className="flex flex-col">
                <span className="uppercase font-auger text-[length:var(--px-11-7)] font-light leading-wide">
                  {item.title}
                </span>
                {item.artist && (
                  <span className="font-fira text-[length:var(--px-9-6)] font-light leading-normal">
                    {item.artist}
                  </span>
                )}
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
