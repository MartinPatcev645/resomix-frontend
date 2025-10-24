import { ChangeEvent, useState } from "react";

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
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const getStrengthColor = () => {
    switch (strength) {
      case "weak":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "strong":
        return "bg-green-500";
      default:
        return "bg-gray-300";
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
    <div className="flex flex-col items-start gap-[var(--px-10)]">
      <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
        {label}
      </div>
      <div className="relative w-full">
        <input
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
          className={`w-full border ${
            error ? "border-red-500" : "border-slate-200"
          } border-dotted p-[var(--px-8)] pr-[var(--px-40)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          } focus:outline-none focus:border-[var(--color-primary)]`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-[var(--px-8)] top-1/2 -translate-y-1/2 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors text-[length:var(--px-12)] font-light font-helvetica"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      
      {showStrength && value.length > 0 && (
        <div className="w-full">
          <div className="w-full h-[var(--px-2)] bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}
            />
          </div>
          {strength && (
            <div className="text-[length:var(--px-10)] font-light font-helvetica mt-[var(--px-4)] capitalize">
              Password strength: {strength}
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="text-[length:var(--px-10)] text-red-500 mt-[-var(--px-4)] font-light font-helvetica">
          {error}
        </div>
      )}
    </div>
  );
};

