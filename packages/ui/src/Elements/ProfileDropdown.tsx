import React, { useState, useRef, useEffect, useCallback } from "react";

interface ProfileDropdownItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  id: string;
  /** If true, renders a visual separator above this item */
  separated?: boolean;
}

interface ProfileDropdownProps {
  items: ProfileDropdownItem[];
  trigger: React.ReactNode;
  /** Alignment of the dropdown relative to the trigger */
  align?: "left" | "right";
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  items,
  trigger,
  align = "right",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Click outside to close ---
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  // --- Escape to close ---
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleClickOutside, handleEscape]);

  // --- Cleanup timers on unmount ---
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // --- Hover handlers with delay ---
  const handleMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 150);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  }, []);

  // --- Toggle on click (for touch devices) ---
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <div
        onClick={handleToggle}
        className="cursor-pointer"
        role="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        {trigger}
      </div>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className={`absolute top-full mt-[var(--px-10)] ${align === "right" ? "right-0" : "left-0"} min-w-[var(--px-200)] bg-[var(--color-secondary)] border border-dotted border-slate-200/60 rounded-xs shadow-2xl z-[60] overflow-hidden animate-[fadeSlideIn_0.15s_ease-out]`}
          role="menu"
          aria-label="Account menu"
        >
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && (
                <div className={`border-t border-dotted ${item.separated ? 'border-slate-200/60' : 'border-slate-200/30'} mx-[var(--px-12)]`} />
              )}
              <button
                type="button"
                id={item.id}
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-[var(--px-14)] px-[var(--px-20)] py-[var(--px-12)] text-[var(--color-primary)] hover:bg-white/5 active:bg-white/10 transition-colors duration-150 cursor-pointer"
              >
                <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
                  {item.icon}
                </span>
                <span className="text-[length:var(--px-11)] font-light font-helvetica whitespace-nowrap leading-none">
                  {item.label}
                </span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Inline keyframes for the fade-slide animation */}
      {isOpen && (
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      )}
    </div>
  );
};

export default ProfileDropdown;
