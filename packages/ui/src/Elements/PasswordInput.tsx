import { ChangeEvent, useState } from "react";
import { PAGE_FIELD, PAGE_FIELD_LABEL } from "../Content/pageChrome";

interface PasswordInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  showStrength?: boolean;
  strength?: "weak" | "medium" | "strong";
  /** Overrides the generated input id — only needed if two fields share a `name` on one page. */
  id?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  error,
  disabled = false,
  autoFocus = false,
  autoComplete,
  showStrength = false,
  strength,
  id,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  // Matches FormInput: a real <label for> so the input has an accessible name.
  const inputId = id ?? `field-${name}`;

  const getStrengthColor = () => {
    switch (strength) {
      case "weak":
        return "bg-[var(--rx-color-error)]";
      case "medium":
        return "bg-[#e0a33c]";
      case "strong":
        return "bg-[var(--rx-color-success)]";
      default:
        return "bg-[var(--rx-color-border-strong)]";
    }
  };

  const getStrengthWidth = () => {
    switch (strength) {
      case "weak":
        return "w-1/3";
      case "medium":
        return "w-2/3";
      case "strong":
        return "w-full";
      default:
        return "w-0";
    }
  };

  return (
    <div className="flex w-full flex-col items-start gap-[var(--px-8)]">
      <label htmlFor={inputId} className={PAGE_FIELD_LABEL}>{label}</label>
      <div className="relative w-full">
        <input
          id={inputId}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          className={`${PAGE_FIELD} pr-[var(--px-52)] ${error ? "!border-[var(--rx-color-error)]" : ""}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-[var(--px-10)] top-1/2 -translate-y-1/2 cursor-pointer font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)] transition-colors hover:text-[var(--rx-color-text-primary)]"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      
      {showStrength && value.length > 0 && (
        <div className="w-full">
          <div className="h-[var(--px-4)] w-full overflow-hidden rounded-[var(--px-2)] border border-[var(--rx-color-border-default)]">
            <div
              className={`h-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}
            />
          </div>
          {strength && (
            <div className="mt-[var(--px-6)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">
              Password strength: {strength}
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div
          role="alert"
          className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]"
        >
          {error}
        </div>
      )}
    </div>
  );
};

