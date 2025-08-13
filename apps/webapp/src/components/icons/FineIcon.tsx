import React from 'react';

interface FineIconProps extends React.SVGProps<SVGSVGElement> {
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

export function FineIcon({
  color,
  selected = false,
  className = '',
  style,
  ...rest
}: FineIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 47"
      fill="none"
      className={`${className}`.trim()}
      style={{ ...(color ? { color } : {}), ...style }}
      {...rest}
    >
      {/* Background fill when selected */}
      {selected && (
        <path d="M23.9167 46.4168C36.5735 46.4168 46.8333 36.157 46.8333 23.5002C46.8333 10.8433 36.5735 0.583496 23.9167 0.583496C11.2598 0.583496 1 10.8433 1 23.5002C1 36.157 11.2598 46.4168 23.9167 46.4168Z" fill="currentColor"/>
      )}
      
      {/* Eye dots */}
      <path d="M15.8958 16.6252C15.5919 16.6252 15.3005 16.5044 15.0856 16.2896C14.8707 16.0747 14.75 15.7832 14.75 15.4793C14.75 15.1754 14.8707 14.884 15.0856 14.6691C15.3005 14.4542 15.5919 14.3335 15.8958 14.3335C16.1997 14.3335 16.4912 14.4542 16.7061 14.6691C16.9209 14.884 17.0417 15.1754 17.0417 15.4793C17.0417 15.7832 16.9209 16.0747 16.7061 16.2896C16.4912 16.5044 16.1997 16.6252 15.8958 16.6252ZM31.9375 16.6252C31.6336 16.6252 31.3422 16.5044 31.1273 16.2896C30.9124 16.0747 30.7917 15.7832 30.7917 15.4793C30.7917 15.1754 30.9124 14.884 31.1273 14.6691C31.3422 14.4542 31.6336 14.3335 31.9375 14.3335C32.2414 14.3335 32.5328 14.4542 32.7477 14.6691C32.9626 14.884 33.0833 15.1754 33.0833 15.4793C33.0833 15.7832 32.9626 16.0747 32.7477 16.2896C32.5328 16.5044 32.2414 16.6252 31.9375 16.6252Z" fill={selected ? "black" : "currentColor"} stroke={selected ? "black" : "currentColor"} strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Circle outline */}
      <path d="M23.9167 46.4168C36.5735 46.4168 46.8333 36.157 46.8333 23.5002C46.8333 10.8433 36.5735 0.583496 23.9167 0.583496C11.2598 0.583496 1 10.8433 1 23.5002C1 36.157 11.2598 46.4168 23.9167 46.4168Z" stroke={selected ? "black" : "currentColor"} strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Straight mouth line */}
      <line x1="12.957" y1="29.875" x2="34.8737" y2="29.875" stroke={selected ? "black" : "currentColor"} strokeLinecap="round"/>
    </svg>
  );
}
