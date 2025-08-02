import { useState, useEffect } from "react";

/**
 * useOnScreen — detects if the referenced element is inside the viewport.
 *
 * Example:
 *   const ref = useRef(null);
 *   const visible = useOnScreen(ref, "-100px");
 *
 * @param ref React ref pointing to the element to observe
 * @param rootMargin Margin around the root. Can be used to trigger before the element comes fully into view.
 */
export function useOnScreen(
  ref: React.RefObject<Element | null>,
  rootMargin: string = "0px"
) {
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const current = ref.current;
    if (!current) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry.isIntersecting),
      { rootMargin }
    );

    observer.observe(current);

    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return isIntersecting;
}
