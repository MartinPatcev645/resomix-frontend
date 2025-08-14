import axiosInstance, { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";

interface FeedbackData {
  satisfaction: number;
  recommendation: number;
  feedback: string;
  category?: string;
  user_id?: string;
}

export const submitFeedback = async (feedbackData: FeedbackData) => {
  try {
    const dataWithCategory = { ...feedbackData, category: feedbackData.category || "general" };
    const data = await axiosWrapper<any>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.FEEDBACK, dataWithCategory),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to submit feedback.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as any);
  }
};

interface ContactData {
  name: string;
  email: string;
  message: string;
  subject?: string;
  phone?: string;
  user_id?: string;
}

export const submitContactForm = async (contactData: ContactData) => {
  try {
    const data = await axiosWrapper<any>(
      axiosInstance.post(API_CONFIG.ENDPOINTS.CONTACT, contactData),
    );

    if (data.success === true) return data;
    return {
      success: false,
      error: data.error || "Failed to submit contact form.",
      details: data.details ?? null,
    };
  } catch (error) {
    return handleApiError(error as any);
  }
}; 