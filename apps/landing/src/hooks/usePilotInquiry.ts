import { useState, useCallback } from 'react';
import { submitContactForm } from '@resomix/api-client';

export interface PilotFormState {
  email: string;
  name: string;
  company: string;
  role: string;
  partnerType: string;
  catalogSize: string;
  sampleAvailability: string;
  primaryQuestion: string;
  workflow: string;
  integrationInterest: string;
  message: string;
  rightsConfirmed: boolean;
}

const initialFormState: PilotFormState = {
  email: '',
  name: '',
  company: '',
  role: '',
  partnerType: '',
  catalogSize: '',
  sampleAvailability: '',
  primaryQuestion: '',
  workflow: '',
  integrationInterest: '',
  message: '',
  rightsConfirmed: false,
};

export interface FieldErrors {
  email?: string;
  name?: string;
  company?: string;
  partnerType?: string;
  primaryQuestion?: string;
  rights?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function buildMessage(data: PilotFormState): string {
  const lines = [
    'PILOT INQUIRY',
    '',
    `Role: ${data.role.trim() || '—'}`,
    `Partner type: ${data.partnerType.trim()}`,
    `Catalogue-size band: ${data.catalogSize.trim() || '—'}`,
    `Sample availability: ${data.sampleAvailability.trim() || '—'}`,
    '',
    `Primary pilot question:`,
    data.primaryQuestion.trim(),
  ];

  if (data.workflow.trim()) {
    lines.push('', `Intended workflow: ${data.workflow.trim()}`);
  }
  if (data.integrationInterest.trim()) {
    lines.push(`Technical integration interest: ${data.integrationInterest.trim()}`);
  }
  if (data.message.trim()) {
    lines.push('', `Additional message:`, data.message.trim());
  }

  lines.push('', 'Rights confirmation: confirmed');

  return lines.join('\n');
}

export function usePilotInquiry() {
  const [formData, setFormData] = useState<PilotFormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const updateField = useCallback(
    (name: keyof PilotFormState, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        const key = name === 'rightsConfirmed' ? 'rights' : name;
        if (key in next) delete next[key as keyof FieldErrors];
        return next;
      });
    },
    [],
  );

  const validate = useCallback((): { valid: boolean; errors: FieldErrors; firstInvalid?: keyof FieldErrors } => {
    const errors: FieldErrors = {};

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
    if (!formData.primaryQuestion.trim()) {
      errors.primaryQuestion = 'Tell us the question the pilot should answer.';
    }
    if (!formData.rightsConfirmed) {
      errors.rights = 'Rights confirmation is required.';
    }

    const firstInvalid = (Object.keys(errors)[0] ?? undefined) as keyof FieldErrors | undefined;
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
        catalog_size: formData.catalogSize.trim() || undefined,
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
