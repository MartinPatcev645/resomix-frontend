import React from "react";

interface CartIconProps {
  className?: string;
  customWidth?: string;
  customHeight?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** Number of items in the cart. Renders a badge when > 0 */
  itemCount?: number;
}

/**
 * Shopping cart icon with an optional count badge.
 * Follows the same prop pattern as ProfileIcon.
 */
export const CartIcon: React.FC<CartIconProps> = ({
  className = "",
  customWidth = "26",
  customHeight = "26",
  onClick,
  itemCount = 0,
}) => {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`Shopping cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
    >
      <svg
        width={customWidth}
        height={customHeight}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.2998 5H22L20 12H8.37675M21 16H9L7 3H4M4 8H2M5 11H2M6 14H2M10 20C10 20.5523 9.55228 21 9 21C8.44772 21 8 20.5523 8 20C8 19.4477 8.44772 19 9 19C9.55228 19 10 19.4477 10 20ZM21 20C21 20.5523 20.5523 21 20 21C19.4477 21 19 20.5523 19 20C19 19.4477 19.4477 19 20 19C20.5523 19 21 19.4477 21 20Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Badge */}
      {itemCount > 0 && (
        <span
          className="absolute flex items-center justify-center"
          style={{
            top: "-4px",
            right: "-6px",
            minWidth: "16px",
            height: "16px",
            borderRadius: "9999px",
            backgroundColor: "var(--color-primary, #000)",
            color: "var(--color-secondary, #fff)",
            fontSize: "10px",
            fontWeight: 700,
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </span>
  );
};
