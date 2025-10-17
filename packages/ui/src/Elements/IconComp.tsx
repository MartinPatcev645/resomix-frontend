import React from "react";

interface IconCompProps {
  svg: React.ReactNode;
  padding?: string;
  size?: string;
  width?: string;
  height?: string;
  backgroundColor?: string;
  borderColor?: string;
  strokeColor?: string;
  className?: string;
  onClick?: () => void;
  id?: string;
  href?: string; // when provided, render as <a>
  target?: string; // e.g. _blank
  rel?: string; // e.g. noopener noreferrer
  ariaLabel?: string;
  // Optional data attributes to forward to the rendered element (e.g., data-track-id)
  dataAttributes?: Record<string, string>;
  // Only for button rendering: when true, set aria-hidden and omit aria-label
  ariaHidden?: boolean;
  // When true, render as non-interactive div (not focusable, for decorative icons within links)
  asDiv?: boolean;
}

export const IconComp: React.FC<IconCompProps> = ({ 
  svg, 
  padding = "p-[var(--px-6)]",
  width, 
  height, 
  backgroundColor = "bg-[var(--color-primary)]",
  borderColor = "outline-[var(--color-primary)]", 
  strokeColor = "stroke-[var(--color-primary)]",
  className = "",
  onClick = () => {},
  id,
  href,
  target,
  rel,
  ariaLabel,
  dataAttributes,
  ariaHidden,
  asDiv = false,
}) => {
  const containerStyle = {
    width: width,
    height: height,
  };

  const dataAttrs = dataAttributes ?? undefined;

  // Render as non-interactive div (decorative, not focusable)
  if (asDiv) {
    return (
      <div
        aria-hidden="true"
        className={`relative ${backgroundColor} rounded-2xl outline outline-[var(--px-1)] outline-offset-[-var(--px-1)] ${borderColor} group-hover:outline-[var(--color-primary-hover)] overflow-hidden ${padding} ${className}`}
        style={containerStyle as React.CSSProperties}
        {...(dataAttrs as Record<string, string> | undefined)}
      >
        {React.cloneElement(svg as React.ReactElement<any>, {
          width: width,
          height: height,
          style: { stroke: strokeColor }
        })}
      </div>
    );
  }

  return (
    href ? (
      <a
        href={href}
        target={target}
        rel={rel}
        aria-label={ariaLabel || id}
        className={`relative cursor-pointer ${backgroundColor} rounded-2xl outline outline-[var(--px-1)] outline-offset-[-var(--px-1)] ${borderColor} group-hover:outline-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] transition-colors overflow-hidden ${padding} ${className}`}
        style={containerStyle as React.CSSProperties}
        onClick={onClick}
        id={id}
        {...(dataAttrs as Record<string, string> | undefined)}
      >
        {React.cloneElement(svg as React.ReactElement<any>, {
          width: width,
          height: height,
          style: { stroke: strokeColor }
        })}
      </a>
    ) : (
      <button 
        type="button"
        {...(ariaLabel && !ariaHidden ? { 'aria-label': ariaLabel } : {})}
        {...(!ariaLabel && ariaHidden ? { 'aria-hidden': true } : {})}
        className={`relative cursor-pointer ${backgroundColor} rounded-2xl outline outline-[var(--px-1)] outline-offset-[-var(--px-1)] ${borderColor} group-hover:outline-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] transition-colors overflow-hidden ${padding} ${className}`}
        style={containerStyle as React.CSSProperties}
        onClick={onClick}
        id={id}
        {...(dataAttrs as Record<string, string> | undefined)}
      >
        {React.cloneElement(svg as React.ReactElement<any>, {
          width: width,
          height: height,
          style: { stroke: strokeColor }
        })}
      </button>
    )
  );
};
