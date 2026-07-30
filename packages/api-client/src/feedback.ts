import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";
import authClient from "./authClient";
import { RequestOptions } from "./types/api";

interface FeedbackData {
  satisfaction: number;
  recommendation: number;
  feedback: string;
  category?: string;
  user_id?: string;
}

export const submitFeedback = async (
  feedbackData: FeedbackData,
  options?: RequestOptions,
) => {
  try {
    const dataWithCategory = { ...feedbackData, category: feedbackData.category || "general" };
    const data = await axiosWrapper<any>(
      authClient.post(API_CONFIG.ENDPOINTS.FEEDBACK, dataWithCategory, {
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to submit feedback.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};

interface ContactData {
  name: string;
  email: string;
  message?: string;
  subject?: string;
  phone?: string;
  user_id?: string;
  /** Which form this came from — 'consumer' (default) or 'partner' (the landing partner forms). */
  contact_type?: "consumer" | "partner";
  /**
   * B2B partner-request fields — dropped server-side for consumer contacts. Each partner form
   * sends only what it asks: /partners sends role, partner_type, preferred_path and
   * catalog_context; /partners-pilot sends role, partner_type and catalog_size.
   */
  company_name?: string;
  role?: string;
  partner_type?: string;
  preferred_path?: string;
  catalog_context?: string;
  catalog_size?: string;
  estimated_calls?: string;
}

export const submitContactForm = async (
  contactData: ContactData,
  options?: RequestOptions,
) => {
  try {
    const data = await axiosWrapper<any>(
      authClient.post(API_CONFIG.ENDPOINTS.CONTACT, contactData, {
        ...(options?.idempotencyKey
          ? ({ idempotencyKey: options.idempotencyKey } as any)
          : {}),
      }),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to submit contact form.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as Error);
  }
};
