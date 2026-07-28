import React from "react";
import { RxBadge } from "./RxBadge";

export type RxModeOption = {
  id: string;
  title: string;
  description: string;
  output: string;
};

type RxModeSelectorProps = {
  label: string;
  options: RxModeOption[];
  value: string;
  onChange?: (value: string) => void;
};

export function RxModeSelector({ label, options, value, onChange }: RxModeSelectorProps) {
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );

  const selectIndex = (index: number) => {
    onChange?.(options[index].id);
    // Keep DOM focus aligned with the roving tabindex so the focused card is
    // never the one that just became tabIndex={-1}.
    optionRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!options.length) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectIndex(options.length - 1);
      return;
    }

    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;

    if (!direction) {
      return;
    }

    event.preventDefault();
    selectIndex((activeIndex + direction + options.length) % options.length);
  };

  return (
    <div className="rx-stack">
      <div className="rx-label">{label}</div>
      <div className="rx-mode-selector" role="radiogroup" aria-label={label} onKeyDown={handleKeyDown}>
        {options.map((option, index) => {
          const selected = option.id === value;

          return (
            <button
              key={option.id}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              className={["rx-mode-card", selected ? "rx-ticks" : ""].filter(Boolean).join(" ")}
              data-selected={selected}
              tabIndex={selected || (!value && index === 0) ? 0 : -1}
              onClick={() => onChange?.(option.id)}
            >
              <RxBadge tone={selected ? "accent" : "neutral"}>
                {selected ? "Active task" : "Available"}
              </RxBadge>
              <h3 className="rx-mode-card__title">{option.title}</h3>
              <p className="rx-body">{option.description}</p>
              <div className="rx-mode-card__output">
                <div className="rx-eyebrow">{option.output}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { RxModeSelectorProps };
