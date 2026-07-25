type SvgTextProps = {
  x: number;
  y: number;
  className?: string;
  anchor?: 'start' | 'middle' | 'end';
  children: string;
};

export function SvgText({ x, y, className = 'ti-slbl-dim', anchor, children }: SvgTextProps) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor}>
      {children}
    </text>
  );
}
