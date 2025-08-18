import { useState } from 'react';
import { submitFeedback } from '@resomix/api-client';

interface UseFeedbackSubmitOptions {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export const useFeedbackSubmit = ({ onSuccess, onError }: UseFeedbackSubmitOptions = {}) => {
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [recommendation, setRecommendation] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!satisfaction || !recommendation) {
      return 'Please select both satisfaction and recommendation ratings (1-10).';
    }
    return null;
  };

  const handleSubmit = async (): Promise<{ success: boolean; message?: string }> => {
    const validationError = validate();
    if (validationError) {
      return { success: false, message: validationError };
    }

    setSubmitting(true);
    try {
      const res = await submitFeedback({
        satisfaction,
        recommendation,
        feedback: feedback.trim(),
      } as any);
      if (res.success) {
        return { success: true };
      }
      return { success: false, message: res.error || 'Failed to submit feedback.' };
    } catch (err) {
      console.error('submitFeedback error', err);
      return { success: false, message: 'Unexpected error while submitting feedback.' };
    } finally {
      setSubmitting(false);
    }
  };

  return {
    satisfaction,
    setSatisfaction,
    recommendation,
    setRecommendation,
    feedback,
    setFeedback,
    submitting,
    handleSubmit,
  };
};
