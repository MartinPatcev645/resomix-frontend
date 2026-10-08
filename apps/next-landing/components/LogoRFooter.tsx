import React from 'react';

interface LogoRFooterProps extends React.SVGProps<SVGSVGElement> {
  /**
   * SVG fill color. Defaults to `currentColor` so it inherits from parent text color.
   */
  color?: string;
  /**
   * Additional Tailwind / custom classes.
   */
  className?: string;
}

export function LogoRFooter({
  color,
  className = '',
  style,
  ...rest
}: LogoRFooterProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 27 27"
      fill="none"
      className={`fill-current ${className}`.trim()}
      style={{ ...(color ? { color } : {}), ...style }}
      {...rest}
    >
      <path
        d="M26.6615 6.33734L21.4673 0.828125C21.4673 0.828125 21.4673 8.97756 21.4448 10.4758H13.7023L8.14058 15.4956L5.92602 15.5387V10.4777L5.92039 5.97168C11.0902 6.06169 16.3031 5.85917 21.4692 5.97168C21.5123 4.26529 21.4411 2.5364 21.4692 0.830002H5.84539V5.72604L0.741211 5.65102V26.5384H5.92602V16.255C11.0958 16.3451 21.3098 16.2494 21.3098 16.2494C21.3098 16.2494 21.5498 23.1256 21.4692 26.5421H26.654V21.2542L22.6712 16.2532V16.2625L22.6993 15.0606L26.6578 10.9971L26.6671 6.33546"
        fill="currentColor"
      />
    </svg>
  );
}
