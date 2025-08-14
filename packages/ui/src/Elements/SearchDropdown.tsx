import React from "react";

const truncateText = (text: string | undefined, max: number) =>
  text && text.length > max ? `${text.slice(0, max)}…` : text;

interface SearchResult {
  uuid: string | number;
  title: string;
  artist?: string;
  duration?: string;
}

interface SearchDropdownProps {
  results: SearchResult[];
  show: boolean;
  isLoading?: boolean;
  onSelect?: (result: SearchResult) => void;
  width?: string;
  truncateLength?: number;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({ results, show, isLoading = false, onSelect, width = "w-[var(--px-550)]", truncateLength = 50 }) => {
  if (!show) return null;

  return (
    <div className={`absolute right-0 top-[var(--px-34)] mt-[var(--px-4)] bg-[var(--color-primary)] rounded-[12px] shadow-lg overflow-hidden z-30 outline outline-[0.5px] outline-[var(--color-primary)] text-[var(--color-text-primary)] ${width}`}>
      {isLoading ? (
        <div className="py-[var(--px-10)] px-[var(--px-19-259)] text-[var(--color-text-primary)] text-[length:var(--px-11)] font-fira opacity-60">
          Searching...
        </div>
      ) : results.length === 0 ? (
        <div className="py-[var(--px-10)] px-[var(--px-19-259)] text-[var(--color-text-primary)] text-[length:var(--px-11)] font-fira opacity-60">
          No results found.
        </div>
      ) : (
        <ul className="max-h-[var(--px-300)] overflow-y-auto divide-y divide-[var(--opacity-10)]">
          {results.map((item) => (
            <li
              key={item.uuid}
              className="flex justify-between items-center py-[var(--px-12)] px-[var(--px-19-259)] hover:bg-[var(--color-primary-hover)] cursor-pointer select-none shadow-md"
              onClick={() => onSelect?.(item)}
            >
              <div className="flex items-center">
                <svg className="w-[var(--px-12)] h-[var(--px-12)] mx-[var(--px-10)]" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.85781 1.45529L5.10781 0.330285C5.05183 0.313479 4.99268 0.309995 4.93511 0.32011C4.87754 0.330225 4.82312 0.35366 4.77622 0.388544C4.72931 0.423428 4.69121 0.468794 4.66495 0.521022C4.6387 0.57325 4.62502 0.630892 4.625 0.689348V5.76404C4.24096 5.42054 3.75065 5.21925 3.23603 5.19383C2.72141 5.1684 2.21365 5.32037 1.79762 5.62434C1.38158 5.92832 1.08248 6.36587 0.9503 6.86387C0.818119 7.36188 0.860866 7.89017 1.0714 8.36044C1.28193 8.83072 1.64749 9.21449 2.10698 9.44761C2.56648 9.68074 3.09206 9.74909 3.5959 9.64126C4.09974 9.53342 4.5513 9.25593 4.87512 8.85515C5.19894 8.45437 5.3754 7.9546 5.375 7.43935V1.19325L8.64219 2.17341C8.68971 2.18889 8.73984 2.19471 8.78965 2.19054C8.83945 2.18636 8.88792 2.17228 8.9322 2.14911C8.97648 2.12593 9.01568 2.09414 9.0475 2.05561C9.07932 2.01707 9.10311 1.97256 9.11749 1.92469C9.13186 1.87682 9.13652 1.82657 9.13119 1.77687C9.12586 1.72718 9.11066 1.67906 9.08646 1.63532C9.06227 1.59159 9.02958 1.55314 8.99032 1.52222C8.95105 1.4913 8.906 1.46854 8.85781 1.45529Z" fill="black" />
                </svg>
                <div className="flex flex-col ml-[var(--px-20)]">
                  <span className="uppercase font-auger text-[length:var(--px-11-7)] font-light leading-wide">
                    {truncateText(item.title, truncateLength)}
                  </span>
                  {item.artist && (
                    <span className="font-fira text-[length:var(--px-9-6)] font-light leading-normal">
                      {truncateText(item.artist, truncateLength)}
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
