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
    <div 
      className="text-[length:var(--px-10)] text-red-500 mt-[var(--px-4)] font-light font-helvetica"
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  );
};

