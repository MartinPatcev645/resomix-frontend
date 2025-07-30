export function initGoldenSpiral(container: HTMLElement): () => void {
  // Configuration constants
  const N = 600; // total dots
  const DOT_RADIUS = 2; // px
  const MARGIN = 2; // px padding
  const DURATION = 3; // seconds per pulse cycle
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 2π/φ²

  // Resolve the square size from the container (use the smaller side)
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 400;
  const SIZE = Math.min(width, height);
  const CENTER = SIZE / 2;
  const MAX_RADIUS = CENTER - MARGIN - DOT_RADIUS;

  const svgNS = "http://www.w3.org/2000/svg";

  // Create and configure the SVG root
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  container.appendChild(svg);

  // Helper to create an <animate> element
  const createAnim = (
    attribute: string,
    values: string,
    begin: string
  ): SVGAnimateElement => {
    const anim = document.createElementNS(svgNS, "animate") as SVGAnimateElement;
    anim.setAttribute("attributeName", attribute);
    anim.setAttribute("values", values);
    anim.setAttribute("dur", `${DURATION}s`);
    anim.setAttribute("begin", begin);
    anim.setAttribute("repeatCount", "indefinite");
    anim.setAttribute("calcMode", "spline");
    anim.setAttribute("keySplines", "0.4 0 0.6 1;0.4 0 0.6 1");
    return anim;
  };

  // Generate and animate dots
  for (let i = 0; i < N; i++) {
    const idx = i + 0.5;
    const frac = idx / N;
    const r = Math.sqrt(frac) * MAX_RADIUS;
    const theta = idx * GOLDEN_ANGLE;
    const x = CENTER + r * Math.cos(theta);
    const y = CENTER + r * Math.sin(theta);

    const circle = document.createElementNS(svgNS, "circle") as SVGCircleElement;
    circle.setAttribute("cx", x.toString());
    circle.setAttribute("cy", y.toString());
    circle.setAttribute("r", DOT_RADIUS.toString());
    circle.setAttribute("fill", "#ffffff");
    circle.setAttribute("opacity", "0.6");

    // Radius pulse animation
    circle.appendChild(
      createAnim(
        "r",
        `${DOT_RADIUS * 0.5};${DOT_RADIUS * 1.5};${DOT_RADIUS * 0.5}`,
        `${frac * DURATION}s`
      )
    );

    // Opacity pulse animation
    circle.appendChild(
      createAnim("opacity", "0.3;1;0.3", `${frac * DURATION}s`)
    );

    svg.appendChild(circle);
  }

  // Return disposer for React unmount
  return () => {
    if (container.contains(svg)) {
      container.removeChild(svg);
    }
  };
}
