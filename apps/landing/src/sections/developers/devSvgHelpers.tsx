type SvgTextProps = {
  x: number;
  y: number;
  className?: string;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  children: string | number;
};

export function SvgText({ x, y, className = 'dev-smicro', anchor, fill, children }: SvgTextProps) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor} fill={fill}>
      {children}
    </text>
  );
}
