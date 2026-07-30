interface FormErrorProps {
  message?: string;
  visible?: boolean;
}

export const FormError: React.FC<FormErrorProps> = ({ 
  message, 
  visible = true 
}) => {
  if (!visible || !message) return null;

  return (
    // Matches the inline errors rendered by FormInput / PasswordInput, so a form-level message and
    // a field-level one read as the same thing.
    <div
      className="mt-[var(--px-4)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]"
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  );
};

