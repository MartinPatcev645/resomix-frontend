import React, { useState, useRef, useEffect, useCallback } from "react";

interface ProfileDropdownItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  id: string;
  /** If set, the item renders as a real <a> so right-click / ⌘-click / middle-click open a new
   *  tab; a plain click is intercepted for SPA navigation. Action-only items (e.g. Logout) omit it
   *  and render as a <button>. */
  href?: string;
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
    }, 400);
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

      {/* Dropdown panel. The outer wrapper carries the visual offset as PADDING (pt), not a
          margin — so the gap between the trigger and the card is inside the hover region and the
          pointer never leaves it on the way down. This is what keeps the menu stable across
          browsers (Firefox in particular closed the menu mid-gap with a margin). */}
      {isOpen && (
        <div
          className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} pt-[var(--px-10)] z-[60]`}
          role="presentation"
        >
          <div
            className="relative min-w-[var(--px-200)] bg-[#0c0c0c] border border-solid border-[rgba(255,255,255,0.14)] rounded-md shadow-[0_1.5rem_3rem_rgba(0,0,0,0.5)] overflow-hidden animate-[fadeSlideIn_0.15s_ease-out]"
            role="menu"
            aria-label="Account menu"
          >
            {/* Orange accent tick — mirrors the mega-menu panel (.nav-mm-panel::before) */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[var(--px-16)] top-0 h-px w-[1.75rem] bg-[var(--color-primary,#ee4a26)]"
            />
            {items.map((item, index) => {
              const inner = (
                <>
                  <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center text-[#8a8a8a] transition-colors duration-150 group-hover:text-[var(--color-primary,#ee4a26)]">
                    {item.icon}
                  </span>
                  <span className="text-[length:var(--px-12)] font-light font-helvetica whitespace-nowrap leading-none text-[#e9e9e9] transition-colors duration-150 group-hover:text-white">
                    {item.label}
                  </span>
                </>
              );
              const itemClass = "group w-full flex items-center gap-[var(--px-14)] px-[var(--px-20)] py-[var(--px-12)] no-underline hover:bg-white/[0.045] active:bg-white/[0.07] transition-colors duration-150 cursor-pointer";
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && (
                    <div className={`border-t border-dotted ${item.separated ? 'border-[rgba(255,255,255,0.16)]' : 'border-[rgba(255,255,255,0.06)]'} mx-[var(--px-12)]`} />
                  )}
                  {item.href ? (
                    <a
                      id={item.id}
                      role="menuitem"
                      href={item.href}
                      onClick={(e) => {
                        // Modifier / non-left click → let the browser open a new tab natively.
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                        e.preventDefault();
                        item.onClick();
                        setIsOpen(false);
                      }}
                      className={itemClass}
                    >
                      {inner}
                    </a>
                  ) : (
                    <button
                      type="button"
                      id={item.id}
                      role="menuitem"
                      onClick={() => {
                        item.onClick();
                        setIsOpen(false);
                      }}
                      className={itemClass}
                    >
                      {inner}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
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
