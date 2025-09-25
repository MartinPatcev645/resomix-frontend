export function initWaveformLoader(container: HTMLElement): () => void {
  // ---------------------------------------------------------------------
  // SVG setup tied to the container
  // ---------------------------------------------------------------------
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.border = "0px solid grey";
  
  container.appendChild(svg);

  // Animation configuration ------------------------------------------------
  let width = 0;
  let height = 0;
  const colors = ['#E6E6E6', '#51A1DC', '#F94B4C', '#666'];
  const angles: number[] = [];
  
  // Generate angles array (equivalent to d3.range(0, 7*Math.PI, Math.PI / 3))
  for (let i = 0; i < 7 * Math.PI; i += Math.PI / 3) {
    angles.push(i);
  }

  // Create group element
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("fill", "none");
  group.setAttribute("stroke-width", "3");
  svg.appendChild(group);

  // Create paths for each color
  const paths: SVGPathElement[] = [];
  colors.forEach((color, index) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke", color);
    path.style.opacity = "0.9";
    path.style.mixBlendMode = "lighten";
    group.appendChild(path);
    paths.push(path);
  });

  // Resize function --------------------------------------------------------
  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    
    svg.setAttribute("width", width.toString());
    svg.setAttribute("height", height.toString());
    group.setAttribute("transform", `translate(${width/96}, ${height/2})`);
  }

  // Helper functions -------------------------------------------------------
  function scaleX(angleValue: number): number {
    // Scale angles to full width (matching d3's x(angles / 14))
    return (angleValue / 14) * width;
  }

  function generatePathData(colorIndex: number, time: number): string {
    const points: [number, number][] = [];
    
    angles.forEach(angle => {
      const x = scaleX(angle);
      const y = Math.cos(angle * 4 - colorIndex * 2 * Math.PI / 4 + time) * 
                Math.pow((2 + Math.cos(angle - time)) / 2, 4) * 5;
      points.push([x, y]);
    });

    // Create smooth curve path (approximating d3.curveBasisOpen)
    if (points.length < 2) return "";
    
    let pathData = `M ${points[0][0]} ${points[0][1]}`;
    
    // Use smooth curves to connect points
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i];
      if (i === 1) {
        pathData += ` L ${x} ${y}`;
      } else {
        // Create smooth curves using cubic bezier
        const [prevX, prevY] = points[i - 1];
        const [prevPrevX, prevPrevY] = points[i - 2] || points[i - 1];
        
        const cp1x = prevX + (x - prevPrevX) / 6;
        const cp1y = prevY + (y - prevPrevY) / 6;
        const cp2x = x - (points[i + 1]?.[0] - prevX || 0) / 6;
        const cp2y = y - (points[i + 1]?.[1] - prevY || 0) / 6;
        
        pathData += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`;
      }
    }
    
    return pathData;
  }

  function update() {
    const time = Date.now() / 1000; // Convert to seconds like d3.now() / 1000
    
    paths.forEach((path, index) => {
      const pathData = generatePathData(index, time);
      path.setAttribute("d", pathData);
    });
  }

  // Animation loop ---------------------------------------------------------
  let rafId: number;
  function loop() {
    update();
    rafId = requestAnimationFrame(loop);
  }

  // Kick things off --------------------------------------------------------
  resize(); // Initial resize
  loop();

  // Listen for resize events
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------------
  // Disposer – remove SVG, cancel animation frame & listeners
  // ---------------------------------------------------------------------
  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    if (container.contains(svg)) {
      container.removeChild(svg);
    }
  };
}
