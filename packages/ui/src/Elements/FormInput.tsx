import { ChangeEvent } from "react";

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  optional?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  error,
  optional = false,
  disabled = false,
  autoFocus = false,
  autoComplete,
}) => {
  return (
    <div className="flex flex-col items-start gap-[var(--px-10)]">
      <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
        {label}
        {optional && (
          <span className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] lg:opacity-80 font-extralight font-helvetica ml-[var(--px-4)]">
            (optional)
          </span>
        )}
      </div>
      <input
        name={name}
        type={type}
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
        } border-dotted p-[var(--px-8)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        } focus:outline-none focus:border-[var(--color-primary)]`}
      />
      {error && (
        <div className="text-[length:var(--px-10)] text-red-500 mt-[-var(--px-4)] font-light font-helvetica">
          {error}
        </div>
      )}
    </div>
  );
};

