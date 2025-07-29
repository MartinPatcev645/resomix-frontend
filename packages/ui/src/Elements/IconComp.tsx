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
}

export const IconComp: React.FC<IconCompProps> = ({ 
  svg, 
  padding = "p-[var(--px-6)]",
  width, 
  height, 
  backgroundColor = "bg-white", 
  borderColor = "outline-white", 
  strokeColor = "stroke-black",
  className = ""
}) => {
  const containerStyle = {
    width: width,
    height: height,
  };

  return (
    <div 
      className={`relative ${backgroundColor} rounded-2xl outline outline-[0.37px] outline-offset-[-0.37px] ${borderColor} overflow-hidden ${padding} ${className}`}
      style={containerStyle}
    >
      {React.cloneElement(svg as React.ReactElement, {
        width: width,
        height: height,
        style: { stroke: strokeColor }
      })}
    </div>
  );
};
