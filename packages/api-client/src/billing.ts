/**
 * Consumer billing client
 * =======================
 *
 * Drives the pricing page + the profile "Plan & Billing" card. Subscribe/manage use Stripe hosted
 * flows (Checkout / Customer Portal) — the backend returns a URL and we redirect to it.
 */

import authClient from "./authClient";
import { axiosWrapper, handleApiError } from "./utils";
import { API_CONFIG } from "./config";

export interface BillingPlanDisplay {
  code: string;
  name: string;
  is_free: boolean;
  unit_amount_cents: number | null;
  currency: string;
  interval: string;
  purchasable: boolean;
  coming_soon: boolean;
  is_current: boolean;
}

export interface BillingPlansResponse {
  currency: string;
  current_plan_code: string | null;
  plans: BillingPlanDisplay[];
}

export interface BillingUsageItem {
  feature: string;
  used: number;
  limit: number | null;
}

export interface BillingSubscription {
  status: string;
  currency: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
}

export interface BillingSubscriptionSummary {
  plan: { code: string; name: string } | null;
  subscription: BillingSubscription | null;
  usage: BillingUsageItem[];
}

export interface BillingInvoice {
  stripe_invoice_id: string;
  amount_paid_cents: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: string | null;
  paid_at: string | null;
}

// The backend wraps every payload as { success, data } (format_response); axiosWrapper returns that
// envelope, so the type param must include it.
type Envelope<T> = { success: boolean; data: T };

/** Plans for the pricing page (works logged-out too). */
export const getBillingPlans = async () => {
  try {
    return await axiosWrapper<Envelope<BillingPlansResponse>>(
      authClient.get(API_CONFIG.ENDPOINTS.BILLING_PLANS)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Current plan + subscription status + this period's usage (authed). */
export const getBillingSubscription = async () => {
  try {
    return await axiosWrapper<Envelope<BillingSubscriptionSummary>>(
      authClient.get(API_CONFIG.ENDPOINTS.BILLING_SUBSCRIPTION)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Billing history (authed). */
export const getBillingInvoices = async () => {
  try {
    return await axiosWrapper<Envelope<{ invoices: BillingInvoice[] }>>(
      authClient.get(API_CONFIG.ENDPOINTS.BILLING_INVOICES)
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Start a Stripe subscription Checkout; returns the hosted URL to redirect to. */
export const startBillingCheckout = async (planCode: string) => {
  try {
    return await axiosWrapper<Envelope<{ url: string }>>(
      authClient.post(API_CONFIG.ENDPOINTS.BILLING_CHECKOUT, { plan_code: planCode })
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};

/** Open the Stripe Customer Portal (manage/cancel/downgrade/card/invoices); returns the URL. */
export const openBillingPortal = async () => {
  try {
    return await axiosWrapper<Envelope<{ url: string }>>(
      authClient.post(API_CONFIG.ENDPOINTS.BILLING_PORTAL, {})
    );
  } catch (error) {
    return handleApiError(error as Error);
  }
};
