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
}) => {
  const containerStyle = {
    width: width,
    height: height,
  };

  return (
    <div 
      className={`relative cursor-pointer ${backgroundColor} rounded-2xl outline outline-[var(--px-1)] outline-offset-[-var(--px-1)] ${borderColor} group-hover:outline-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] transition-colors overflow-hidden ${padding} ${className}`}
      style={containerStyle}
      onClick={onClick}
      id={id}
    >
      {React.cloneElement(svg as React.ReactElement<any>, {
        width: width,
        height: height,
        style: { stroke: strokeColor }
      })}
    </div>
  );
};
