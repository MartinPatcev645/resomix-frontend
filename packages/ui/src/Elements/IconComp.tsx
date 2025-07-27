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
  padding = "p-1.5", 
  size = "24", 
  width, 
  height, 
  backgroundColor = "bg-white", 
  borderColor = "outline-white", 
  strokeColor = "stroke-black",
  className = ""
}) => {
  const containerStyle = {
    width: width || `${size}px`,
    height: height || `${size}px`,
  };

  return (
    <div 
      className={`relative ${backgroundColor} rounded-2xl outline outline-[0.37px] outline-offset-[-0.37px] ${borderColor} overflow-hidden ${padding} ${className}`}
      style={containerStyle}
    >
      {React.cloneElement(svg as React.ReactElement, {
        width: size,
        height: size,
        style: { stroke: strokeColor }
      })}
    </div>
  );
};
