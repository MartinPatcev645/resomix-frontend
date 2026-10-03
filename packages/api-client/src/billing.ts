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

/**
 * One buyable interval for a plan. Only intervals with an ACTIVE price appear, so a monthly/yearly
 * toggle can never offer something checkout would then refuse.
 */
export interface BillingPlanOffer {
  interval: string;
  unit_amount_cents: number | null;
  currency: string;
  is_founding_price: boolean;
  /** The undiscounted price, sent only when it differs from what is charged. */
  list_unit_amount_cents: number | null;
}

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
  /** What the plan actually gives. Absent from an older server — render defensively. */
  limits?: BillingPlanLimits;
  /** True when the price shown is the founding rate rather than the standing one. */
  is_founding_price?: boolean;
  /** The undiscounted price, for a struck-through comparison. Sent ONLY when it differs from
   *  what is being charged, so the card can never advertise a saving of zero. */
  list_unit_amount_cents?: number | null;
  /** Every interval this plan can be bought at. Drives a monthly/yearly toggle when one exists. */
  offers?: BillingPlanOffer[];
}

/**
 * A plan's limits, resolved from the same rows that enforce them.
 *
 * `null` = unlimited (the server maps its `-1` sentinel, so nothing here can print "-1 a day").
 * `0` is a real limit meaning "not included" — that is how the free row says what it does not have,
 * so it must not be treated as falsy-unlimited.
 */
export interface BillingPlanLimits {
  searches_per_day: number | null;
  uploads_per_month: number | null;
  /** Tracks unlocked in a result. */
  top_sk_max: number | null;
  /** Tracks selectable in the depth dropdown. */
  dropdown_max_tracks: number | null;
  library_playlists_max: number | null;
  exports_per_day: number | null;
  export_track_limit: number | null;
  can_view_full_analysis: boolean;
  /** Download Track Intelligence as a PDF report (Pro). */
  can_export_analysis_pdf: boolean;
  can_similarity_upload: boolean;
}

/** The founding-offer window. `founding_active` is the SERVER's answer — a client clock can be
 *  wrong, and a countdown that disagrees with what checkout will sell is worse than none. */
export interface BillingBetaWindow {
  end_date: string | null;
  founding_active: boolean;
}

export interface BillingPlansResponse {
  currency: string;
  current_plan_code: string | null;
  plans: BillingPlanDisplay[];
  beta?: BillingBetaWindow;
}

export interface BillingUsageItem {
  feature: string;
  used: number;
  limit: number | null;
}

/**
 * Server's verdict on whether this subscription is cancelling, and when access stops.
 *
 * BRANCH ON THIS, never on the raw fields below it. Stripe expresses a cancellation in more than
 * one way — `cancel_at_period_end` is set only for a plain cancel on an unmanaged subscription,
 * while a schedule-managed one (every founding subscriber) records it as `cancel_at` or on the
 * schedule itself. Reading the boolean alone is what made the profile screen tell customers who
 * had just cancelled that their plan would renew.
 *
 * `null` means there is nothing to report: no subscription, or one running normally.
 */
export interface BillingCancellation {
  /** Cancelling, but access continues until `effective_at`. */
  pending: boolean;
  /** Access has already stopped. */
  ended: boolean;
  /** ISO-8601. Null when no boundary is known — still show the cancellation, just without a date. */
  effective_at: string | null;
  /** cancellation_requested | payment_failed | payment_disputed | refunded | disputed | admin */
  reason: string | null;
}

export interface BillingSubscription {
  status: string;
  currency: string | null;
  current_period_end: string | null;
  /** Raw Stripe fields — kept for support tooling. For display logic use `cancellation`. */
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  canceled_at: string | null;
  ended_at: string | null;
  cancellation_reason: string | null;
  trial_end: string | null;
  cancellation: BillingCancellation | null;
}

/**
 * A complimentary plan an admin granted — NOT a subscription.
 *
 * There is no Stripe object, no card, and nothing to cancel. Surfaced separately so the UI can
 * say "you have Pro, free, until X" instead of offering to manage a subscription that does not
 * exist.
 */
export interface BillingGrant {
  plan_code: string | null;
  plan_name: string | null;
  reason: string;
  note: string | null;
  starts_at: string;
  ends_at: string;
  /** Rounded up — something with hours left still reads as "1 day". */
  days_remaining: number;
}

export interface BillingSubscriptionSummary {
  plan: { code: string; name: string } | null;
  subscription: BillingSubscription | null;
  grant: BillingGrant | null;
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
/**
 * Start a subscription checkout.
 *
 * `consent` is the EU 14-day withdrawal waiver and the server **refuses without it** — it writes an
 * audit row before calling Stripe, so a session cannot exist with no record behind it. Passing it
 * here is the caller asserting the user ticked the box; never default it to true.
 */
export const startBillingCheckout = async (
  planCode: string,
  consent: boolean,
  /** "month" | "year". Must match an interval present in the plan's `offers`. */
  interval: string = "month",
) => {
  try {
    return await axiosWrapper<Envelope<{ url: string }>>(
      authClient.post(API_CONFIG.ENDPOINTS.BILLING_CHECKOUT, {
        plan_code: planCode,
        consent,
        interval,
      })
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
