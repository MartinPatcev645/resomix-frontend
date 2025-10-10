import React, { useCallback, useMemo, useState } from "react";

interface ToggleButtonProps {
  text: string;
  onClick?: () => void; // kept for backward compatibility
  onToggle?: (nextValue: boolean) => void;
  isOn?: boolean; // if provided, component becomes controlled
  className?: string;
  customWidth?: string;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  text,
  onClick,
  onToggle,
  isOn,
  className,
  customWidth,
}) => {
  const isControlled = typeof isOn === "boolean";
  const [internalOn, setInternalOn] = useState<boolean>(false);
  const value = isControlled ? (isOn as boolean) : internalOn;

  const handleToggle = useCallback(() => {
    const next = !value;
    if (!isControlled) setInternalOn(next);
    if (onToggle) onToggle(next);
    if (onClick) onClick();
  }, [value, isControlled, onToggle, onClick]);

  const trackClasses = useMemo(() => {
    const base = [
      "relative",
      "h-[var(--px-16)] lg:h-[var(--px-17)]",
      "w-[var(--px-30)] lg:w-[var(--px-35)]",
      "rounded-full",
      "outline",
      "outline-[var(--px-1)]",
      "outline-[var(--color-primary)]",
      "transition-colors",
    ];

    if (value) {
      // on
      base.push("bg-[var(--color-primary)]", "group-hover:bg-[var(--color-primary-hover)]");
    } else {
      // off
      base.push("bg-transparent");
    }

    return base.join(" ");
  }, [value]);

  const knobClasses = useMemo(() => {
    const base = [
      "absolute",
      "top-1/2",
      "-translate-y-1/2",
      "h-[var(--px-10)] lg:h-[var(--px-12)]",
      "w-[var(--px-10)] lg:w-[var(--px-12)]",
      "rounded-full",
      "transition-all",
      "duration-200",
      "ease-in-out",
    ];

    if (value) {
      // on: knob is secondary (black)
      base.push("bg-[var(--color-primary-background)]");
      base.push("right-[var(--px-4)]");
    } else {
      // off: knob is primary (white), hover -> primary-hover
      base.push("bg-[var(--color-primary)]", "group-hover:bg-[var(--color-primary-hover)]");
      base.push("left-[var(--px-4)]");
    }

    return base.join(" ");
  }, [value]);

  return (
    <div className="flex justify-center items-center cursor-pointer group" id={`${text}-toggle-button`} onClick={handleToggle}>
      <div
        className={`h-[var(--px-20)] lg:h-[var(--px-25)] pl-[var(--px-5)] lg:pl-[var(--px-6)] py-[var(--px-8)] rounded-3xl outline outline-[var(--px-1)] outline-offset-[-var(--px-1)] outline-[var(--color-primary)] group-hover:outline-[var(--color-primary-hover)] transition-colors inline-flex justify-center items-center gap-[var(--px-12)] bg-transparent ${className ? className : ""} ${customWidth ? customWidth : "min-w-[var(--px-160)]"}`}
      >
        <div className={"tracking-normal whitespace-nowrap text-[length:var(--px-10)] lg:text-[length:var(--px-10-37)] font-light font-fira text-[var(--color-text-secondary)]"}>
          {text}
        </div>
        <div className={trackClasses}>
          <div className={knobClasses} />
        </div>
      </div>
    </div>
  );
};
