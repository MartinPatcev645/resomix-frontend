import { useState } from 'react';
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

  const handleSubmit = async (): Promise<boolean> => {
    const error = validate();
    if (error) {
      alert(error);
      return false;
    }
    setSubmitting(true);
    try {
      const res = await submitContactForm({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        phone: form.phone.trim() || undefined,
        message: form.message.trim(),
      } as any);
      if (res.success) {
        alert('Message sent successfully!');
        setForm({ name: '', email: '', subject: '', phone: '', message: '' });
        return true;
      }
      alert(res.error || 'Failed to send message.');
    } catch (err) {
      console.error('submitContactForm error', err);
      alert('Unexpected error while sending message.');
    } finally {
      setSubmitting(false);
    }
    return false;
  };

  return { form, handleChange, handleSubmit, submitting };
}; 