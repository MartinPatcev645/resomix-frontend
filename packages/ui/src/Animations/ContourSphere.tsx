import { useEffect, useRef } from "react";
import "./contourSphere.css";
import { initContourSphere } from "./raw/contourSphere";

/**
 * ContourSphere – wrapper component that provides the minimal HTML & CSS
 * structure (canvas + full-viewport sections) expected by the standalone
 * Three.js / GSAP script the design team provided.
 *
 * The heavy lifting (WebGL rendering + ScrollTrigger timelines) still lives in
 * the original plain-JS file that your app includes globally. All we do here is
 * make sure the DOM looks exactly the way that script expects so you can drop
 * this component anywhere in your React tree and get the full experience.
 */
export const ContourSphere: React.FC<{
  /**
   * How many placeholder sections to render to create scroll length.
   * Defaults to 4 which matches the original demo.
   */
  sections?: number;
  /**
   * If true, ScrollTrigger is tied to this component's wrapper instead of the
   * full document. Useful when you only want the animation to run while this
   * section is on screen.
   */
  localScroll?: boolean;
  /** Fixed square dimension in pixels when localScroll. Default 500. */
  size?: number;
  /**
   * Total scroll distance in pixels for the animation when localScroll is
   * enabled. Graphic stays centred inside this area. Default 3 × size.
   */
  scrollAreaHeight?: number;
}> = ({ sections = 4, localScroll = false, size = 500, scrollAreaHeight }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Clean-up: when the component unmounts remove any canvas the external script
  // added so React pages that navigate away don't leak WebGL contexts.
  useEffect(() => {
    if (!wrapperRef.current) return;
    const triggerEl = localScroll ? scrollAreaRef.current! : "body";

    const dispose = initContourSphere(wrapperRef.current, {
      trigger: triggerEl,
      useContainerSize: localScroll,
    });
    return dispose;
  }, [localScroll, scrollAreaHeight]);

  // Build the placeholder sections – their actual content can be replaced by
  // whatever you need via later composition, but we provide sensible defaults
  // to keep GSAP timelines happy.
  const renderedSections = Array.from({ length: sections }).map((_, i) => (
    <section key={i} className="contour_sphere_section">
      <div className="contour_sphere_section_inner">
        <h1 className="contour_sphere_title">&nbsp;</h1>
        <p className="contour_sphere_description">&nbsp;</p>
      </div>
    </section>
  ));

  // derive wrapper class
  const wrapperClass = `contour_sphere_wrapper${localScroll ? " local" : ""}`;

  const wrapperStyle: React.CSSProperties | undefined = localScroll
    ? {
        width: size,
        height: size,
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }
    : undefined;

  if (localScroll) {
    const areaStyle: React.CSSProperties = {
      height: scrollAreaHeight ?? size * 3,
      position: "relative",
    };

    return (
      <div ref={scrollAreaRef} style={areaStyle}>
        <div ref={wrapperRef} className={wrapperClass} style={wrapperStyle}>
          <div className="content">{renderedSections}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={wrapperClass} style={wrapperStyle}>
      <div className="content">{renderedSections}</div>
    </div>
  );
}; 