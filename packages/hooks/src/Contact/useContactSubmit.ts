import { useState, useCallback } from 'react';
import { submitContactForm } from '@resomix/api-client';

export interface ContactFormState {
  name: string;
  email: string;
  subject: string;
  phone: string;
  message: string;
}

export const useContactSubmit = () => {
  const [form, setForm] = useState<ContactFormState>({
    name: '',
    email: '',
    subject: '',
    phone: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Invalid email.';
    if (!form.message.trim()) return 'Message is required.';
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  /**
   * MUST stay referentially stable. ContactContent pre-fills the signed-in user's name/email from
   * an effect that lists this in its dependency array — when a fresh function was returned on every
   * render, that effect re-ran on every render, setForm produced a new object, and the re-render
   * produced another new function: an infinite loop ("Maximum update depth exceeded") that froze
   * the page and blocked router navigations away from it.
   *
   * The functional setState form means there is nothing to depend on, so `[]` is correct here.
   */
  const setFormValues = useCallback((values: Partial<ContactFormState>) => {
    setForm(prev => ({ ...prev, ...values }));
  }, []);

  const handleSubmit = async (): Promise<{ success: boolean; message?: string }> => {
    const error = validate();
    if (error) {
      return { success: false, message: error };
    }
    setSubmitting(true);
    try {
      const res = await submitContactForm({
        contact_type: "consumer",
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      } as any);
      if (res.success) {
        // success handled by caller
        setForm({ name: '', email: '', subject: '', phone: '', message: '' });
        return { success: true };
      }
      return { success: false, message: res.error || 'Failed to send message.' };
    } catch (err) {
      console.error('submitContactForm error', err);
      return { success: false, message: 'Unexpected error while sending message.' };
    } finally {
      setSubmitting(false);
    }
  };

  return { form, handleChange, handleSubmit, submitting, setFormValues };
}; 