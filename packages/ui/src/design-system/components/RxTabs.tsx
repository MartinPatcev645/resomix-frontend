import React from "react";

export type RxTabOption = {
  id: string;
  label: string;
};

type RxTabsProps = {
  label: string;
  tabs: RxTabOption[];
  activeTab: string;
  onChange?: (id: string) => void;
};

export function RxTabs({ label, tabs, activeTab, onChange }: RxTabsProps) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab),
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!tabs.length) {
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
    const nextIndex = (activeIndex + direction + tabs.length) % tabs.length;
    onChange?.(tabs[nextIndex].id);
  };

  return (
    <div className="rx-stack">
      <div className="rx-label">{label}</div>
      <div className="rx-tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
        {tabs.map((tab, index) => {
          const selected = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="rx-tab"
              aria-selected={selected}
              tabIndex={selected || (!activeTab && index === 0) ? 0 : -1}
              onClick={() => onChange?.(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { RxTabsProps };
