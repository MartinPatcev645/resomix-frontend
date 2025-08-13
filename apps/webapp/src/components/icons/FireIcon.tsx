import React from 'react';

interface FireIconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * SVG fill color. Defaults to `currentColor` so it inherits from parent text color.
   */
  color?: string;
  selected?: boolean;
  /**
   * Additional Tailwind / custom classes.
   */
  className?: string;
}

export function FireIcon({
  color,
  selected = false,
  className = '',
  style,
  ...rest
}: FireIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 48"
      fill="none"
      className={`${className}`.trim()}
      style={{ ...(color ? { color } : {}), ...style }}
      {...rest}
    >
      {/* Background fill when selected */}
      {selected && (
        <path d="M18 47C27.333 47 35 39.4951 35 29.8627C35 27.4983 34.881 24.9637 33.589 21.0238C32.297 17.0839 32.0375 16.5756 30.6718 14.1422C30.0881 19.1068 26.9658 21.1768 26.1725 21.7955C26.1725 21.1515 24.2843 14.0364 21.4204 9.77795C18.6086 5.6 14.7847 2.85955 12.543 1C12.543 4.5305 11.5649 9.7791 10.163 12.454C8.7622 15.1277 8.49927 15.2255 6.74827 17.215C4.99727 19.2045 4.19487 19.8197 2.7306 22.2347C1.26633 24.6497 1 27.8663 1 30.2307C1 39.8631 8.667 47 18 47Z" fill="currentColor"/>
      )}
      
      {/* Fire outline */}
      <path d="M18 47C27.333 47 35 39.4951 35 29.8627C35 27.4983 34.881 24.9637 33.589 21.0238C32.297 17.0839 32.0375 16.5756 30.6718 14.1422C30.0881 19.1068 26.9658 21.1768 26.1725 21.7955C26.1725 21.1515 24.2843 14.0364 21.4204 9.77795C18.6086 5.6 14.7847 2.85955 12.543 1C12.543 4.5305 11.5649 9.7791 10.163 12.454C8.7622 15.1277 8.49927 15.2255 6.74827 17.215C4.99727 19.2045 4.19487 19.8197 2.7306 22.2347C1.26633 24.6497 1 27.8663 1 30.2307C1 39.8631 8.667 47 18 47Z" stroke={selected ? "black" : "currentColor"} strokeLinejoin="round"/>
    </svg>
  );
}
