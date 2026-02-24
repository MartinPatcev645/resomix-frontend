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
  /** Enables special loading effect triggered by <|>pattern<|> markers */
  loadingEffect?: boolean;
  /** Number of seconds (integer) the loading effect should run – the string inside the markers is appended once per second */
  loadingEffectDelay?: number;
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
  loadingEffect = false,
  loadingEffectDelay = 5,
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

  // Normalised text respecting multiline (<br> → \n)
  const effectiveText = React.useMemo(() => {
    if (!multiline) return rawText;
    return rawText.replace(/<br\s*\/?>/gi, "\n");
  }, [rawText, multiline]);

  // Typing effect
  React.useEffect(() => {
    if (!isVisible || !rawText) return;

    setDisplay("");

    // Helper to clear an array of timeouts
    const timeouts: NodeJS.Timeout[] = [];
    const addTimeout = (t: NodeJS.Timeout) => {
      timeouts.push(t);
    };

    const charsPerMs = speed / 1000;

    if (!loadingEffect) {
      // Original behaviour
      let lineIndex = 0;
      let charIndex = 0;

      function step() {
        const currentLine = lines[lineIndex] ?? "";
        if (charIndex < currentLine.length) {
          const nextChar = currentLine.charAt(charIndex);
          if (nextChar) {
            setDisplay((prev) => prev + nextChar);
          }
          charIndex += 1;
          addTimeout(setTimeout(step, 1 / charsPerMs));
        } else {
          if (multiline && lineIndex < lines.length - 1) {
            lineIndex += 1;
            charIndex = 0;
            setDisplay((prev) => prev + "\n");
            addTimeout(setTimeout(step, 1 / charsPerMs));
          }
        }
      }

      // Respect initial delay
      addTimeout(setTimeout(step, delay));
    } else {
      // Loading effect enabled – build action queue
      type Action = { type: "char"; value: string } | { type: "loading"; value: string };
      const actions: Action[] = [];
      const pattern = /<\|>(.*?)<\|>/gs;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(effectiveText)) !== null) {
        if (match.index > lastIndex) {
          const normalChunk = effectiveText.slice(lastIndex, match.index);
          for (const ch of normalChunk) {
            actions.push({ type: "char", value: ch });
          }
        }
        const inner = match[1] ?? "";
        actions.push({ type: "loading", value: inner });
        lastIndex = pattern.lastIndex;
      }
      // Push remaining normal text
      if (lastIndex < effectiveText.length) {
        const tail = effectiveText.slice(lastIndex);
        for (const ch of tail) {
          actions.push({ type: "char", value: ch });
        }
      }

      const runActions = (idx: number) => {
        if (idx >= actions.length) return;
        const action = actions[idx];
        if (action.type === "char") {
          setDisplay((prev) => prev + action.value);
          addTimeout(setTimeout(() => runActions(idx + 1), 1 / charsPerMs));
        } else if (action.type === "loading") {
          let count = 0;
          const repeat = () => {
            if (count < loadingEffectDelay) {
              setDisplay((prev) => prev + action.value);
              count += 1;
              addTimeout(setTimeout(repeat, 1000));
            } else {
              runActions(idx + 1);
            }
          };
          repeat();
        }
      };

      // Respect initial delay
      addTimeout(setTimeout(() => runActions(0), delay));
    }

    // Cleanup
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isVisible, rawText, lines, effectiveText, speed, multiline, delay, loadingEffect, loadingEffectDelay]);

  return (
    <div ref={containerRef} className={className} style={{ whiteSpace: "pre-wrap" }}>
      {display}
    </div>
  );
};
