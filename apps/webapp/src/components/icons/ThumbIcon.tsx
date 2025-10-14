import React from 'react';

interface ThumbIconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * SVG color (currentColor). По умолчанию берётся из CSS (например, text-white).
   */
  color?: string;
  className?: string;
}

export function ThumbIcon({ color, className = '', style, ...rest }: ThumbIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={`stroke-current ${className}`.trim()}
      style={{ ...(color ? { color } : {}), ...style }}
      {...rest}
    >
      <path
        d="M7.24001 11V20H5.63001C4.73001 20 4.01001 19.28 4.01001 18.39V12.62C4.01001 11.73 4.74001 11 5.63001 11H7.24001ZM18.5 9.5H13.72V6C13.72 4.9 12.82 4 11.73 4H11.64C11.24 4 10.88 4.24 10.72 4.61L7.99001 11V20H17.19C17.92 20 18.54 19.48 18.67 18.76L19.99 11.26C20.15 10.34 19.45 9.5 18.51 9.5H18.5Z"
        stroke="currentColor"
        strokeWidth="1"
        className="transition-colors duration-200 ease-in-out"
      />
    </svg>
  );
}