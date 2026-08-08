import authClient from "../authClient";
import { axiosWrapper, handleApiError } from "../utils";

/**
 * Admin → user messaging.
 *
 * Reply to a contact submission, reply to feedback, or message a user directly. Every one of them
 * can be previewed first, and the preview is rendered by the SAME server-side code that sends —
 * so what an admin approves is byte-for-byte what the customer receives.
 */

export type MessageChannel = "contact" | "feedback" | "direct";

export interface MessagePreview {
  subject: string;
  /** Finished HTML. Render it in a sandboxed iframe — never with dangerouslySetInnerHTML. */
  html: string;
  recipient_email: string | null;
  recipient_name: string | null;
  /** False when there is no address to send to — refuse before the admin writes, not after. */
  can_send: boolean;
}

export interface SentMessage {
  id: number;
  subject: string;
  body: string;
  recipient_email: string;
  status: "sent" | "failed";
  created_at: string | null;
}

type Envelope<T> = { success: boolean; data?: T; message?: string; error?: string };

/** Render a message without sending it. */
export const previewAdminMessage = async (payload: {
  channel: MessageChannel;
  body: string;
  subject?: string;
  source_id?: number;
  user_uuid?: string;
}) => {
  try {
    return await axiosWrapper<Envelope<MessagePreview>>(
      authClient.post("/api/v1/admin/messages/preview", payload)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Reply to a contact submission. */
export const replyToContact = async (contactId: number, body: string, subject?: string) => {
  try {
    return await axiosWrapper<Envelope<{ recipient_email: string; subject: string }>>(
      authClient.post(`/api/v1/admin/messages/contact/${contactId}`, { body, subject })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Reply to submitted feedback. */
export const replyToFeedback = async (feedbackId: number, body: string, subject?: string) => {
  try {
    return await axiosWrapper<Envelope<{ recipient_email: string; subject: string }>>(
      authClient.post(`/api/v1/admin/messages/feedback/${feedbackId}`, { body, subject })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Message a user directly. Nothing is quoted — this answers nothing. */
export const messageUser = async (userUuid: string, body: string, subject?: string) => {
  try {
    return await axiosWrapper<Envelope<{ recipient_email: string; subject: string }>>(
      authClient.post(`/api/v1/admin/messages/user/${userUuid}`, { body, subject })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Replies already sent for this contact or feedback — stops two admins answering the same thread. */
export const getMessageHistory = async (channel: MessageChannel, sourceId: number) => {
  try {
    return await axiosWrapper<Envelope<SentMessage[]>>(
      authClient.get(`/api/v1/admin/messages/${channel}/${sourceId}/history`)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
