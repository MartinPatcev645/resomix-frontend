import { ChangeEvent } from "react";
import { PAGE_FIELD, PAGE_FIELD_LABEL } from "../Content/pageChrome";

/**
 * Shared auth/form text field.
 *
 * Deliberately identical in structure and styling to PasswordInput — same label, same PAGE_FIELD
 * surface, same error treatment — so the two sit flush next to each other on the auth screens.
 * (PasswordInput was migrated to the precision-industrial theme first; this was left on dotted
 * slate borders, which made every login/register form look half-finished.)
 */
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
  /** Overrides the generated input id — only needed if two fields share a `name` on one page. */
  id?: string;
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
  id,
}) => {
  // A real <label for>, not a <span>: without it the input has NO accessible name, so assistive
  // tech announces an unlabelled text field and clicking the label doesn't focus it.
  const inputId = id ?? `field-${name}`;

  return (
    <div className="flex w-full flex-col items-start gap-[var(--px-8)]">
      <label htmlFor={inputId} className={PAGE_FIELD_LABEL}>
        {label}
        {optional && <span className="ml-[var(--px-6)] opacity-70">(optional)</span>}
      </label>
      <input
        id={inputId}
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
        aria-invalid={error ? true : undefined}
        className={`${PAGE_FIELD} ${error ? "!border-[var(--rx-color-error)]" : ""}`}
      />
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
