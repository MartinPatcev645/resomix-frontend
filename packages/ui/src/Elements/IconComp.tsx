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
}

export const IconComp: React.FC<IconCompProps> = ({ 
  svg, 
  padding = "p-[var(--px-6)]",
  width, 
  height, 
  backgroundColor = "bg-white", 
  borderColor = "outline-white", 
  strokeColor = "stroke-black",
  className = "",
  onClick = () => {},
}) => {
  const containerStyle = {
    width: width,
    height: height,
  };

  return (
    <div 
      className={`relative cursor-pointer ${backgroundColor} rounded-2xl outline outline-[0.37px] outline-offset-[-0.37px] ${borderColor} group-hover:outline-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] transition-colors overflow-hidden ${padding} ${className}`}
      style={containerStyle}
      onClick={onClick}
    >
      {React.cloneElement(svg as React.ReactElement, {
        width: width,
        height: height,
        style: { stroke: strokeColor }
      })}
    </div>
  );
};
