type SvgTextProps = {
  x: number;
  y: number;
  className?: string;
  anchor?: 'start' | 'middle' | 'end';
  children: string | number;
};

export function SvgText({ x, y, className = 'ci-slbl-dim', anchor, children }: SvgTextProps) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor}>
      {children}
    </text>
  );
}
