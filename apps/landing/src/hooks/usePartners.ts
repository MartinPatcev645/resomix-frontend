import { useState, useCallback } from 'react';
import { submitContactForm } from '@resomix/api-client';

export interface PartnerFormState {
  email: string;
  name: string;
  company: string;
  role: string;
  partnerType: string;
  preferredPath: string;
  context: string;
  message: string;
}

const initialFormState: PartnerFormState = {
  email: '',
  name: '',
  company: '',
  role: '',
  partnerType: '',
  preferredPath: '',
  context: '',
  message: '',
};

export interface PartnerFieldErrors {
  email?: string;
  name?: string;
  company?: string;
  partnerType?: string;
  preferredPath?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function buildMessage(data: PartnerFormState): string {
  const lines = [
    'PARTNER INQUIRY',
    '',
    `Role: ${data.role.trim() || '—'}`,
    `Partner type: ${data.partnerType.trim()}`,
    `Preferred path: ${data.preferredPath.trim()}`,
  ];

  if (data.context.trim()) {
    lines.push(`Catalogue or product context: ${data.context.trim()}`);
  }

  if (data.message.trim()) {
    lines.push('', 'Message:', data.message.trim());
  }

  return lines.join('\n');
}

export function usePartners() {
  const [formData, setFormData] = useState<PartnerFormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<PartnerFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const updateField = useCallback((name: keyof PartnerFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (name in next) delete next[name as keyof PartnerFieldErrors];
      return next;
    });
  }, []);

  const validate = useCallback((): {
    valid: boolean;
    errors: PartnerFieldErrors;
    firstInvalid?: keyof PartnerFieldErrors;
  } => {
    const errors: PartnerFieldErrors = {};

    if (!formData.email.trim() || !EMAIL_RE.test(formData.email.trim())) {
      errors.email = 'Enter a valid work email address.';
    }
    if (!formData.name.trim()) {
      errors.name = 'Enter your name.';
    }
    if (!formData.company.trim()) {
      errors.company = 'Enter your company.';
    }
    if (!formData.partnerType.trim()) {
      errors.partnerType = 'Select your partner type.';
    }
    if (!formData.preferredPath.trim()) {
      errors.preferredPath = 'Select a preferred path.';
    }

    const firstInvalid = (Object.keys(errors)[0] ?? undefined) as
      | keyof PartnerFieldErrors
      | undefined;
    return { valid: Object.keys(errors).length === 0, errors, firstInvalid };
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    setErrorMessage('');
    const { valid, errors, firstInvalid } = validate();
    setFieldErrors(errors);
    if (!valid) return { success: false, firstInvalid };

    setIsSubmitting(true);
    try {
      const result: { success?: boolean; error?: string } = await submitContactForm({
        contact_type: 'partner',
        name: formData.name.trim(),
        email: formData.email.trim(),
        company_name: formData.company.trim(),
        message: buildMessage(formData),
      });

      if (result?.success) {
        setIsSuccess(true);
        setFormData(initialFormState);
        return { success: true };
      }

      setErrorMessage(
        result?.error ||
          'Could not submit your request. Please try again, or email partners@resomix.com.',
      );
      return { success: false };
    } catch {
      setErrorMessage(
        'Could not submit your request. Please try again, or email partners@resomix.com.',
      );
      return { success: false };
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validate]);

  return {
    formData,
    fieldErrors,
    isSubmitting,
    isSuccess,
    errorMessage,
    updateField,
    validate,
    handleSubmit,
    setIsSuccess,
  };
}
