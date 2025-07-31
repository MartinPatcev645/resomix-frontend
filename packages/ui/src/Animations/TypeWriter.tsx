import React from "react";

interface CodeTypingProps {
  /** Characters typed per second */
  speed?: number;
  /** If true, honours multiple lines (\n or <br/>) and types them sequentially */
  multiline?: boolean;
  /** Optional additional delay before starting typing, in ms */
  delay?: number;
  /** If true, animation restarts when element re-enters the viewport */
  replayOnView?: boolean;
  /** Text content – if omitted, component will attempt to stringify its children */
  text?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * CodeTyping – wrapper that reveals its provided text with a type-writer animation once it enters the viewport. No visual
 * styling is added; it simply outputs the animated text so you can style it externally.
 */
export const CodeTyping: React.FC<CodeTypingProps> = ({
  speed = 30,
  multiline = false,
  delay = 0,
  replayOnView = false,
  text,
  children,
  className = "",
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const [display, setDisplay] = React.useState<string>("");

  // Observe viewport visibility
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else if (replayOnView) {
          setIsVisible(false);
          setDisplay("");
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [replayOnView]);

  // Determine raw text to type
  const rawText = React.useMemo(() => {
    if (typeof text === "string") return text;
    // Attempt to stringify children
    if (typeof children === "string") return children;
    if (Array.isArray(children)) {
      return children.map((c) => (typeof c === "string" ? c : "")).join("\n");
    }
    return "";
  }, [text, children]);

  const lines = React.useMemo(() => {
    if (!multiline) return [rawText];
    // Split on <br> tags or newline characters
    return rawText
      .replace(/<br\s*\/?>/gi, "\n")
      .split(/\n+/)
      .map((l) => l.trim());
  }, [rawText, multiline]);

  // Typing effect
  React.useEffect(() => {
    if (!isVisible || !rawText) return;

    let timeout: NodeJS.Timeout;
    const startTyping = () => {
      let lineIndex = 0;
      let charIndex = 0;
      const charsPerMs = speed / 1000;

      function step() {
        const currentLine = lines[lineIndex] ?? "";
        if (charIndex < currentLine.length) {
          const nextChar = currentLine.charAt(charIndex);
          if (nextChar) {
            setDisplay((prev) => prev + nextChar);
          }
          charIndex += 1;
          timeout = setTimeout(step, 1 / charsPerMs);
        } else {
          if (multiline && lineIndex < lines.length - 1) {
            lineIndex += 1;
            charIndex = 0;
            setDisplay((prev) => prev + "\n");
            timeout = setTimeout(step, 1 / charsPerMs);
          }
        }
      }

      step();
    };

    const initialTimeout = setTimeout(startTyping, delay);
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeout);
    };
  }, [isVisible, rawText, lines, speed, multiline, delay]);

  return (
    <div ref={containerRef} className={className} style={{ whiteSpace: "pre-wrap" }}>
      {display}
    </div>
  );
};
