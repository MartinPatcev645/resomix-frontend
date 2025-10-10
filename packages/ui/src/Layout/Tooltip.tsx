import React, { useState, useEffect } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  message: string;
  className?: string;
  customWidth?: string;
  /**
   * When true, the tooltip is shown only on click/tap (desktop & mobile).
   * Defaults to `false` which preserves the current behaviour: hover on desktop,
   * click/tap on mobile.
   */
  displayOnClick?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  message,
  className = '',
  customWidth = 'w-[var(--px-250)]',
  displayOnClick = false
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1023);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (displayOnClick || isMobile) {
      e.stopPropagation();
      setIsVisible((v) => !v);
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile && !displayOnClick) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && !displayOnClick) {
      setIsVisible(false);
    }
  };

  // Hide tooltip when user taps/clicks anywhere else on the page
  useEffect(() => {
    if (!isVisible) return

    const hide = () => setIsVisible(false)

    document.addEventListener('click', hide)
    document.addEventListener('touchstart', hide)

    return () => {
      document.removeEventListener('click', hide)
      document.removeEventListener('touchstart', hide)
    }
  }, [isVisible])

  return (
    <div className="relative inline-block">
      <span
        className={className}
        title={!isMobile && !displayOnClick ? message : undefined}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>

      {/* Custom tooltip: shown on mobile or when displayOnClick=true */}
      {isVisible && (isMobile || displayOnClick) && (
        <div
          className={`absolute z-100 px-3 py-2 text-sm rounded-md bg-[var(--color-primary-background)] text-[var(--color-primary)] ${customWidth}`}
          style={{
            boxShadow: '0 10px 15px -3px var(--color-primary), 0 4px 6px -2px var(--color-primary)',
            whiteSpace: 'normal',
            wordWrap: 'normal',
            overflowWrap: 'normal',
            left: '50%',
            transform: 'translateX(-100%)'
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
