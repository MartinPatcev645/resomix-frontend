import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  BillingPlanDisplay,
  BillingPlanOffer,
  BillingPlansResponse,
  BillingSubscriptionSummary,
} from "@resomix/api-client";
import { PricingButton } from "./PricingButton";
import {
  IntervalRadiogroup,
  PlanPanel,
  PriceSkeleton,
  QuietPanel,
  SaveTag,
  SoftPanel,
  TextLink,
  type BillingInterval,
} from "./PricingChrome";
import { PlanComparison, PlanComparisonSection } from "./PlanComparison";
import { PricingFaq } from "./PricingFaq";
import type { PricingVariant } from "./pricingVariant";
import { planFeatures } from "./planFeatures";
import {
  CARDS,
  CLOSING_CTA,
  CONSENT,
  ERRORS,
  FREE_CARD,
  COMPARE_LINK,
  GUEST_RAIL,
  INTERVAL,
  PAID_CHECKOUT,
  PAID_CHECKOUT_DISABLED_REASON,
  PAGE,
  PRO_CARD,
  SAMPLE_REPORT,
  SEE_PRO,
} from "./pricingCopy";

/**
 * Consumer plans — Free / Pro cards, interval control, guest rail, comparison, FAQ.
 * Fetches /billing/plans. Billing behaviour (checkout, portal, consent) is unchanged.
 * Coming-soon ladder tiers are filtered out of the public DOM entirely.
 */

/** British house style; no i18n on this surface — pin locale so QA is deterministic. */
const LOCALE = "en-GB";

function fmtMoney(cents: number | null | undefined, currency: string): string {
  if (cents == null) return "";
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function fmtDateLong(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(LOCALE, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function normalizeInterval(raw: string | undefined | null): BillingInterval | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "month" || v === "monthly") return "month";
  if (v === "year" || v === "yearly" || v === "annual" || v === "annually") return "year";
  return null;
}

function offerFor(plan: BillingPlanDisplay | undefined, interval: BillingInterval): BillingPlanOffer | null {
  if (!plan) return null;
  const offers = plan.offers || [];
  const hit = offers.find((o) => normalizeInterval(o.interval) === interval);
  if (hit) return hit;
  if (normalizeInterval(plan.interval) === interval) {
    return {
      interval,
      unit_amount_cents: plan.unit_amount_cents,
      currency: plan.currency,
      is_founding_price: !!plan.is_founding_price,
      list_unit_amount_cents: plan.list_unit_amount_cents ?? null,
    };
  }
  return null;
}

function annualSavingPercent(monthlyCents: number, yearlyCents: number): number | null {
  const full = monthlyCents * 12;
  if (full <= 0 || yearlyCents <= 0 || yearlyCents >= full) return null;
  return Math.round((1 - yearlyCents / full) * 100);
}

function perSuffix(interval: BillingInterval): string {
  return interval === "year" ? "/ year" : "/ month";
}

function publicPlans(plans: BillingPlanDisplay[]): {
  free: BillingPlanDisplay | undefined;
  pro: BillingPlanDisplay | undefined;
} {
  // Coming-soon ladder tiers never enter the DOM — filter by code, not CSS.
  return {
    free: plans.find((p) => p.code === "free"),
    pro: plans.find((p) => p.code === "pro"),
  };
}

export function ConsumerPricingContent({
  backSlot,
  compareUrl,
  baseUrl = "/",
  variant = "marketing",
  subscribeUrl,
}: {
  baseUrl?: string;
  variant?: PricingVariant;
  subscribeUrl?: string;
  /** Checkout only: the marketing page's comparison table. Omit to hide the signpost. */
  compareUrl?: string;
  /** Desktop-only Back control, placed on the interval row (mobile renders its own above). */
  backSlot?: ReactNode;
}) {
  // "marketing" is the public pricing page on the landing site: it explains and compares, and hands
  // the actual purchase to the app. "checkout" is the app's own /subscribe: it runs the real Stripe
  // flow and drops the comparison table and FAQ, which belong to the page that sells.
  const isMarketing = variant === "marketing";
  const toSubscribe = () => {
    window.location.href = subscribeUrl || "/subscribe";
  };
  const [data, setData] = useState<BillingPlansResponse | null>(null);
  const [subSummary, setSubSummary] = useState<BillingSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceFailed, setPriceFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("month");

  useEffect(() => {
    void (async () => {
      let isAuthed = false;
      try {
        const { useAuthStore } = await import("@resomix/stores");
        isAuthed = !!useAuthStore.getState().isAuthenticated;
        setAuthed(isAuthed);
      } catch {
        /* noop */
      }
      await load(isAuthed);
    })();
  }, []);

  const load = async (isAuthed: boolean) => {
    setLoading(true);
    setPriceFailed(false);
    try {
      const { getBillingPlans, getBillingSubscription } = await import("@resomix/api-client");
      const res = await getBillingPlans();
      if (res.success) {
        setData(res.data as BillingPlansResponse);
      } else {
        setPriceFailed(true);
      }
      if (isAuthed) {
        try {
          const sub = await getBillingSubscription();
          if (sub.success) setSubSummary(sub.data as BillingSubscriptionSummary);
        } catch {
          /* leave null */
        }
      }
    } catch {
      setPriceFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const { free, pro } = useMemo(() => publicPlans(data?.plans || []), [data]);

  const intervalOptions = useMemo(() => {
    const set = new Set<BillingInterval>();
    for (const o of pro?.offers || []) {
      const n = normalizeInterval(o.interval);
      if (n) set.add(n);
    }
    if (set.size === 0) {
      const n = normalizeInterval(pro?.interval);
      if (n) set.add(n);
    }
    const ordered: BillingInterval[] = [];
    if (set.has("month")) ordered.push("month");
    if (set.has("year")) ordered.push("year");
    return ordered;
  }, [pro]);

  // Keep selection valid when offers load.
  useEffect(() => {
    if (intervalOptions.length === 0) return;
    if (!intervalOptions.includes(interval)) setInterval(intervalOptions[0]);
  }, [intervalOptions, interval]);

  const selectedOffer = offerFor(pro, interval);
  const monthlyOffer = offerFor(pro, "month");
  const yearlyOffer = offerFor(pro, "year");

  const savePct =
    monthlyOffer?.unit_amount_cents != null && yearlyOffer?.unit_amount_cents != null
      ? annualSavingPercent(monthlyOffer.unit_amount_cents, yearlyOffer.unit_amount_cents)
      : null;

  const foundingActive = !!data?.beta?.founding_active;
  const endDateLabel = fmtDateLong(data?.beta?.end_date);
  const isFoundingOffer = foundingActive && !!selectedOffer?.is_founding_price;

  const amountLabel =
    selectedOffer?.unit_amount_cents != null
      ? fmtMoney(selectedOffer.unit_amount_cents, selectedOffer.currency || pro?.currency || "EUR")
      : pro?.unit_amount_cents != null
        ? fmtMoney(pro.unit_amount_cents, pro.currency)
        : null;

  const listAmountLabel =
    selectedOffer?.list_unit_amount_cents != null
      ? fmtMoney(selectedOffer.list_unit_amount_cents, selectedOffer.currency || pro?.currency || "EUR")
      : null;

  const unitSuffix = perSuffix(interval);
  const topSkMax = pro?.limits?.top_sk_max;

  const cardNote = (() => {
    if (!isFoundingOffer || !endDateLabel) return null;
    return (
      <>
        {PRO_CARD.foundingAvailableUntil(endDateLabel)} {PRO_CARD.deadlineNotBetaEnd}
      </>
    );
  })();

  const tablePrice = amountLabel ? `${amountLabel}${unitSuffix.replace(/^\//, " /")}` : "—";

  const closingSummary = (() => {
    if (!amountLabel) return null;
    if (isFoundingOffer && listAmountLabel && endDateLabel) {
      const period = interval === "year" ? "/ year" : "/ month";
      return (
        <>
          Founding offer {amountLabel} {period} + VAT · available until {endDateLabel}.{" "}
          {PRO_CARD.deadlineNotBetaEnd} Then {listAmountLabel} {period} + VAT · renews automatically
          until cancelled · cancel anytime and keep Pro until the end of the period you paid for.
        </>
      );
    }
    return `Pro at ${amountLabel}${unitSuffix.replace(/^\//, " /")} + VAT · renews automatically until cancelled · cancel anytime and keep Pro until the end of the period you paid for.`;
  })();

  const closingCtaLine = (() => {
    if (!amountLabel) return null;
    if (isFoundingOffer && listAmountLabel && endDateLabel) {
      const period = interval === "year" ? "/ year" : "/ month";
      return `${amountLabel} ${period} now · ${listAmountLabel} ${period} later · join by ${endDateLabel}`;
    }
    return `${amountLabel}${unitSuffix.replace(/^\//, " /")}`;
  })();

  // A complimentary plan an admin granted. Someone on one IS on Pro — but there is nothing to
  // manage in Stripe, so the card must not offer "Manage billing" for it.
  const grant = subSummary?.grant || null;

  const isCurrentPro = !!pro?.is_current;
  const isCurrentFree = !!free?.is_current;
  const sub = subSummary?.subscription;
  // Same rule as the profile card: the server decides whether this is cancelling, because
  // `cancel_at_period_end` alone misses the schedule-managed case that every founding subscriber
  // is in. The `??` keeps an older server working rather than silently dropping the notice.
  const cancellation =
    sub?.cancellation ??
    (sub?.cancel_at_period_end
      ? { pending: true, ended: false, effective_at: sub.current_period_end, reason: null }
      : null);
  const cancelAtEnd = !!cancellation?.pending;
  const activeUntilLabel =
    cancelAtEnd && cancellation?.effective_at ? fmtDateLong(cancellation.effective_at) : null;

  const goLogin = () => {
    window.location.href = `/auth/login?redirect=${encodeURIComponent("/subscribe")}`;
  };

  const subscribe = async (code: string) => {
    setError(null);
    if (!PAID_CHECKOUT.enabled) {
      setError(PAID_CHECKOUT_DISABLED_REASON);
      return;
    }
    if (!authed) {
      goLogin();
      return;
    }

    setBusy(code);
    try {
      const { startBillingCheckout } = await import("@resomix/api-client");
      // `true` because pressing this button IS the express request — the statement under the CTA
      // says so in the buyer's own reading order. The server still records a `billing_consents` row
      // against it, so the act stays auditable.
      const res: any = await startBillingCheckout(code, true, interval);
      if (res?.success && res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(res?.error || ERRORS.checkoutFailed);
    } catch {
      setError(ERRORS.checkoutFailed);
    }
    setBusy(null);
  };

  const manage = async () => {
    setError(null);
    setBusy("__manage__");
    try {
      const { openBillingPortal } = await import("@resomix/api-client");
      const res: any = await openBillingPortal();
      if (res?.success && res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(res?.error || ERRORS.portalFailed);
    } catch {
      setError(ERRORS.portalFailed);
    }
    setBusy(null);
  };

  const freeCta = () => {
    if (isMarketing) {
      toSubscribe();
      return;
    }
    if (!authed) {
      goLogin();
      return;
    }
  };

  const proCtaAction = () => {
    // The marketing page never opens Stripe and never reads a session: it sends the visitor to the
    // app, which checks whether they are signed in and then runs the flow.
    if (isMarketing) {
      toSubscribe();
      return;
    }
    if (isCurrentPro) {
      void manage();
      return;
    }
    if (!authed) {
      goLogin();
      return;
    }
    void subscribe(pro?.code || "pro");
  };

  const freeCtaLabel = !authed
    ? FREE_CARD.ctaStart
    : isCurrentFree
      ? FREE_CARD.ctaCurrent
      : FREE_CARD.ctaIncluded;

  const proCtaLabel = (() => {
    if (busy === "__manage__") return PRO_CARD.ctaBusyPortal;
    if (busy === pro?.code) return PRO_CARD.ctaBusyCheckout;
    if (isCurrentPro) return PRO_CARD.ctaManage;
    if (authed) return PRO_CARD.ctaUpgrade;
    return PRO_CARD.ctaChoose;
  })();

  const proPurchaseDisabled = isMarketing
    ? false
    : isCurrentPro
      ? !!busy
      : !PAID_CHECKOUT.enabled || priceFailed || loading || !!busy;

  const freeCtaDisabled = isMarketing ? false : authed || !!busy;


  return (
    <>
      {/* Hero subtitle — match count bound to Pro top_sk_max from the API. */}
      {typeof topSkMax === "number" && (
        <p className="mx-auto mt-[var(--px-14)] max-w-[40rem] text-center font-helvetica text-[length:var(--px-17)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
          {PAGE.subtitle(topSkMax)}
        </p>
      )}

      <section className="mt-[var(--px-28)] space-y-[var(--px-48)] lg:mt-[var(--px-36)] lg:space-y-[var(--px-72)]">
        {/* Interval control sits under the page header (PricingContent). */}
        {/* Constrained to the plan cards' own width and centred, so Back sits just left of the
            toggle rather than stranded against the viewport edge — the same arrangement the Library
            uses, where the row lives inside the content column instead of spanning the page. */}
        <div className="mx-auto grid w-full max-w-[52rem] grid-cols-[1fr_auto_1fr] items-start gap-[var(--px-10)]">
          <div className="flex justify-start">
            <div className="hidden md:block">{backSlot}</div>
          </div>
          {intervalOptions.length > 1 ? (
            /* Chip sits UNDER the control, not beside it. Beside it, switching to yearly widened
               the row and shifted the whole toggle sideways under the user's cursor. The reserved
               min-height keeps the layout still whether or not the chip is showing. */
            <div className="flex flex-col items-center gap-[var(--px-10)]">
              <IntervalRadiogroup
                aria-label={INTERVAL.groupLabel}
                value={interval}
                options={intervalOptions}
                onChange={setInterval}
              />
              <div className="flex min-h-[var(--px-30)] items-center justify-center">
                {savePct != null && interval === "year" && (
                  <SaveTag>{INTERVAL.saveAnnually(savePct)}</SaveTag>
                )}
              </div>
            </div>
          ) : (
            <div />
          )}
          <span aria-hidden="true" />
        </div>

        {/* Outside the Back/toggle grid — a full-width alert, not a third column. */}
        {priceFailed && (
          <div
            role="alert"
            className="mx-auto w-full max-w-[34rem] border border-white/13 bg-[#0c0c0d]/60 p-[var(--px-16)] text-left font-helvetica text-[length:var(--px-15)] font-light leading-[1.6] text-[var(--color-primary-hover)]"
          >
            {PAGE.pricesUnavailable}
          </div>
        )}

        {/* Plan cards */}
        <section aria-label="Plans" className="px-[2px] md:px-0">
          {loading ? (
            <div className="mx-auto grid max-w-[52rem] grid-cols-1 gap-[var(--px-14)] md:grid-cols-2">
              {[0, 1].map((i) => (
                <PlanPanel key={i} className="min-h-[var(--px-48)]">
                  <PriceSkeleton className="mb-[var(--px-12)] h-[var(--px-17)] w-[var(--px-48)]" />
                  <PriceSkeleton className="mb-[var(--px-12)] h-[var(--px-15)] w-3/4" />
                  <PriceSkeleton className="h-[var(--px-26)] w-[var(--px-36)]" />
                </PlanPanel>
              ))}
              <span className="sr-only">{PAGE.loading}</span>
            </div>
          ) : (
            <div className="mx-auto grid max-w-[52rem] grid-cols-1 items-stretch gap-[var(--px-14)] md:grid-cols-2">
              {/* Free */}
              {free && (
                <PlanPanel className="p-[var(--px-18)] md:p-[var(--px-19-259)]">
                  <div className="flex flex-1 flex-col">
                    <p className="m-0 font-helvetica text-[length:var(--px-17)] font-bold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">
                      {free.name}
                    </p>
                    <p className="m-0 mt-[var(--px-3)] font-helvetica text-[length:var(--px-15)] font-light text-[var(--color-primary-hover)]">
                      {FREE_CARD.tagline}
                    </p>
                    <p className="m-0 mt-[var(--px-11)] font-benzin text-[length:var(--px-26)] font-black leading-none text-[var(--color-text-secondary)]">
                      {fmtMoney(0, free.currency || data?.currency || "EUR")}
                    </p>
                    <p className="m-0 mt-[var(--px-6)] min-h-[2.2em] font-fira text-[length:var(--px-11)] leading-[1.5] tracking-[0.04em] text-[var(--color-primary-hover)]">
                      {FREE_CARD.note}
                    </p>
                    <div className="mt-[var(--px-13)]">
                      <PricingButton fullWidth onClick={freeCta} disabled={freeCtaDisabled}>
                        {freeCtaLabel}
                      </PricingButton>
                    </div>
                    <p className="m-0 mt-[var(--px-14)] border-t border-white/8 pt-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[0.16em] text-[var(--color-primary-hover)]">
                      {FREE_CARD.listHeading}
                    </p>
                    <ul className="m-0 mt-[var(--px-9-6)] grid list-none gap-[var(--px-6)] p-0">
                      {planFeatures(free.limits, { compact: true }).map((f) => (
                        <li
                          key={f.key}
                          className="relative pl-[var(--px-18)] font-helvetica text-[length:var(--px-15)] font-light leading-[1.45] text-[var(--color-primary-hover)]"
                        >
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-[0.62em] h-px w-[var(--px-6)] bg-[var(--color-neon-orange)]"
                          />
                          {f.text}
                        </li>
                      ))}
                    </ul>
                    {isMarketing && (
                      <p className="mb-0 mt-auto pt-[var(--px-13)]">
                        <TextLink href="#compare">{CARDS.seeComparison}</TextLink>
                      </p>
                    )}
                  </div>
                </PlanPanel>
              )}

              {/* Pro */}
              {pro && (
                <PlanPanel highlighted className="p-[var(--px-18)] md:p-[var(--px-19-259)]">
                  {isFoundingOffer && (
                    <span className="absolute -right-px -top-px bg-[var(--color-neon-orange)] px-[var(--px-11)] py-[var(--px-6)] font-fira text-[length:var(--px-11)] font-semibold uppercase tracking-[0.12em] text-[#101010]">
                      {PRO_CARD.flagFounding}
                    </span>
                  )}
                  {isCurrentPro && !isFoundingOffer && (
                    <span className="absolute -right-px -top-px bg-[var(--color-neon-orange)] px-[var(--px-11)] py-[var(--px-6)] font-fira text-[length:var(--px-11)] font-semibold uppercase tracking-[0.12em] text-[#101010]">
                      {PRO_CARD.flagYourPlan}
                    </span>
                  )}
                  <div className="flex flex-1 flex-col">
                    <p className="m-0 font-helvetica text-[length:var(--px-17)] font-bold uppercase tracking-[0.03em] text-[var(--color-text-secondary)]">
                      {pro.name}
                    </p>
                    <p className="m-0 mt-[var(--px-3)] font-helvetica text-[length:var(--px-15)] font-light text-[var(--color-primary-hover)]">
                      {PRO_CARD.tagline}
                    </p>
                    <p
                      className="m-0 mt-[var(--px-11)] flex flex-wrap items-baseline gap-[var(--px-6)] font-benzin text-[length:var(--px-26)] font-black leading-none text-[var(--color-text-secondary)]"
                      data-slot="amount-wrap"
                    >
                      {priceFailed || !amountLabel ? (
                        <span data-slot="amount">—</span>
                      ) : (
                        <>
                          <span data-slot="amount">{amountLabel}</span>
                          <span
                            data-slot="per"
                            className="font-fira text-[length:var(--px-11)] font-normal tracking-[0.06em] text-[var(--color-primary-hover)]"
                          >
                            {unitSuffix}
                          </span>
                        </>
                      )}
                    </p>
                    <p
                      className="m-0 mt-[var(--px-6)] min-h-[2.2em] font-fira text-[length:var(--px-11)] leading-[1.5] tracking-[0.04em] text-[var(--color-primary-hover)]"
                      data-slot="cardnote"
                    >
                      {PRO_CARD.vatNote}
                      {cardNote && (
                        <>
                          <br />
                          {cardNote}
                        </>
                      )}
                      {activeUntilLabel && (
                        <>
                          <br />
                          {PRO_CARD.activeUntil(activeUntilLabel)}
                        </>
                      )}
                      {grant && (
                        <>
                          <br />
                          {`You're on ${grant.plan_name || "Pro"} free until ${fmtDateLong(
                            grant.ends_at
                          )} — ${grant.days_remaining} day${
                            grant.days_remaining === 1 ? "" : "s"
                          } left. Subscribe to keep it after that.`}
                        </>
                      )}
                    </p>
                    <div className="mt-[var(--px-13)]">
                      <PricingButton
                        fullWidth
                        variant="primary"
                        onClick={proCtaAction}
                        disabled={isCurrentPro ? !!busy : proPurchaseDisabled}
                      >
                        {proCtaLabel}
                      </PricingButton>
                      {!isMarketing && !isCurrentPro && PAID_CHECKOUT.enabled && (
                        /* The EU withdrawal waiver. It has to be read BEFORE the act that relies on
                           it, so it sits under the CTA in the buyer's reading order rather than in
                           a tick-box further down the page. Pressing the button is the express
                           request; the server records it against a `billing_consents` row. */
                        <p className="m-0 mt-[var(--px-10)] font-helvetica text-[length:var(--px-12)] font-light leading-[1.55] text-[var(--color-primary-hover)] opacity-80">
                          {CONSENT}
                        </p>
                      )}
                      {!PAID_CHECKOUT.enabled && !isCurrentPro && (
                        <p
                          className="m-0 mt-[var(--px-8)] font-fira text-[length:var(--px-11)] leading-[1.5] tracking-[0.04em] text-[var(--color-primary-hover)] opacity-75"
                          data-testid="checkout-disabled-notice"
                        >
                          {PAID_CHECKOUT_DISABLED_REASON}
                        </p>
                      )}
                    </div>
                    <p className="m-0 mt-[var(--px-14)] border-t border-white/8 pt-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[0.16em] text-[var(--color-primary-hover)]">
                      {PRO_CARD.listHeading}
                    </p>
                    <ul className="m-0 mt-[var(--px-9-6)] grid list-none gap-[var(--px-6)] p-0">
                      {planFeatures(pro.limits, { compact: true }).map((f) => (
                        <li
                          key={f.key}
                          className="relative pl-[var(--px-18)] font-helvetica text-[length:var(--px-15)] font-light leading-[1.45] text-[var(--color-primary-hover)]"
                        >
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-[0.62em] h-px w-[var(--px-6)] bg-[var(--color-neon-orange)]"
                          />
                          {f.text}
                        </li>
                      ))}
                    </ul>
                    {isMarketing && (
                      <p className="mb-0 mt-auto pt-[var(--px-13)]">
                        <TextLink href="#compare">{CARDS.seeComparison}</TextLink>
                      </p>
                    )}
                  </div>
                </PlanPanel>
              )}
            </div>
          )}

          <p
            className="mx-auto mt-[var(--px-16)] max-w-[52rem] font-fira text-[length:var(--px-11)] leading-[1.75] tracking-[0.03em] text-[var(--color-primary-hover)] opacity-75"
            data-slot="finalline"
          >
            {closingSummary || CARDS.footnotePrefix}
            {isMarketing && foundingActive && (
              <>
                {" "}
                <TextLink href="#faq-h">{CARDS.footnoteFaqLink}</TextLink>
              </>
            )}
          </p>

          {/* Guest rail — never a third plan card, never priced. Marketing only: anyone on
              /subscribe is signed in, so "No account yet?" is nonsense there. */}
          {isMarketing && (
          <QuietPanel className="mt-[var(--px-26)]">
            <p className="m-0 font-fira text-[length:var(--px-11)] uppercase tracking-[0.16em] text-[var(--color-neon-orange)]">
              {GUEST_RAIL.label}
            </p>
            <div className="mt-[var(--px-9-6)] grid items-center gap-[var(--px-14)] min-[620px]:grid-cols-[minmax(0,1fr)_auto] min-[620px]:gap-[var(--px-26)]">
              <p className="m-0 font-helvetica text-[length:var(--px-15)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
                {GUEST_RAIL.body}
              </p>
              <PricingButton onClick={() => { window.location.href = baseUrl || "/"; }}>
                {GUEST_RAIL.cta}
              </PricingButton>
            </div>
          </QuietPanel>
          )}

          {/* Checkout only: the full comparison lives on the marketing page, so point at it rather
              than duplicating a 40-row table in front of someone who is mid-purchase. */}
          {!isMarketing && compareUrl && (
            <QuietPanel className="mt-[var(--px-26)]">
              <div className="grid items-center gap-[var(--px-14)] min-[620px]:grid-cols-[minmax(0,1fr)_auto] min-[620px]:gap-[var(--px-26)]">
                <p className="m-0 font-helvetica text-[length:var(--px-15)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
                  {COMPARE_LINK.body}
                </p>
                <PricingButton onClick={() => { window.location.href = compareUrl; }}>
                  {COMPARE_LINK.cta}
                </PricingButton>
              </div>
            </QuietPanel>
          )}
        </section>

        {/* See Pro band — gated until an approved demo track exists */}
        {SAMPLE_REPORT.enabled && (
          <SoftPanel className="grid items-center gap-[var(--px-19-259)] min-[900px]:grid-cols-[1fr_auto] min-[900px]:gap-[var(--px-32)]">
            <div>
              <p className="m-0 font-fira text-[length:var(--px-11)] uppercase tracking-[0.16em] text-[var(--color-neon-orange)]">
                {SEE_PRO.label}
              </p>
              <h2 className="m-0 mt-[var(--px-11)] font-helvetica text-[length:var(--px-17)] font-bold uppercase leading-[1.2] tracking-[0.03em] text-[var(--color-text-secondary)]">
                {SEE_PRO.heading}
              </h2>
              <p className="m-0 mt-[var(--px-11)] max-w-[42rem] font-helvetica text-[length:var(--px-15)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
                {SEE_PRO.body}
              </p>
            </div>
            <PricingButton
              variant="primary"
              onClick={() => {
                // BLOCKED // NEEDS RULING: no approved demo-track id — band stays gated.
                const root = (baseUrl || "/").replace(/\/$/, "");
                window.location.href = !root || root === "/" ? "/analysis" : `${root}/analysis`;
              }}
            >
              {SEE_PRO.cta}
            </PricingButton>
          </SoftPanel>
        )}

        {/* Comparison — marketing only, and only once plans have loaded so the #compare hash
            scroll lands on the final layout. */}
        {isMarketing && !loading && (
          <PlanComparisonSection>
            <PlanComparison
              freeLimits={free?.limits}
              proLimits={pro?.limits}
              proPriceLabel={tablePrice}
              freeCtaLabel={freeCtaLabel}
              proCtaLabel={isCurrentPro ? PRO_CARD.ctaManage : proCtaLabel}
              onFreeCta={freeCta}
              onProCta={proCtaAction}
              freeCtaDisabled={freeCtaDisabled}
              proCtaDisabled={isCurrentPro ? !!busy : proPurchaseDisabled}
              hidePurchaseCtas={isCurrentPro}
            />
          </PlanComparisonSection>
        )}

        {/* FAQ — marketing only; someone at checkout has already read it. */}
        {isMarketing && (
        <PricingFaq
          beta={{
            endDateLabel,
            foundingActive,
            monthlyFounding:
              monthlyOffer?.unit_amount_cents != null
                ? fmtMoney(monthlyOffer.unit_amount_cents, monthlyOffer.currency)
                : null,
            monthlyList:
              monthlyOffer?.list_unit_amount_cents != null
                ? fmtMoney(monthlyOffer.list_unit_amount_cents, monthlyOffer.currency)
                : null,
            yearlyFounding:
              yearlyOffer?.unit_amount_cents != null
                ? fmtMoney(yearlyOffer.unit_amount_cents, yearlyOffer.currency)
                : null,
            yearlyList:
              yearlyOffer?.list_unit_amount_cents != null
                ? fmtMoney(yearlyOffer.list_unit_amount_cents, yearlyOffer.currency)
                : null,
          }}
        />
        )}

        {/* Compact closing consumer CTA — between FAQ legal links and the partner banner */}
        {!isCurrentPro && amountLabel && (
          <div data-slot="closing-cta">
            <SoftPanel className="mx-auto max-w-[52rem]">
              <div className="flex flex-col items-stretch gap-[var(--px-14)] min-[620px]:flex-row min-[620px]:items-center min-[620px]:justify-between">
                <div className="min-w-0">
                  <p
                    className="m-0 font-fira text-[length:var(--px-11)] leading-[1.55] tracking-[0.04em] text-[var(--color-primary-hover)]"
                    data-slot="closing-price"
                  >
                    {closingCtaLine}
                  </p>
                  <p className="m-0 mt-[var(--px-6)] font-helvetica text-[length:var(--px-15)] font-light leading-[1.55] text-[var(--color-primary-hover)]">
                    {CLOSING_CTA.renewLine}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-[var(--px-10)] min-[420px]:flex-row min-[420px]:items-center">
                  <PricingButton
                    variant="primary"
                    onClick={proCtaAction}
                    disabled={proPurchaseDisabled}
                  >
                    {CLOSING_CTA.choosePro}
                  </PricingButton>
                  <PricingButton onClick={freeCta} disabled={freeCtaDisabled}>
                    {CLOSING_CTA.startFree}
                  </PricingButton>
                </div>
              </div>
            </SoftPanel>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em] text-[var(--color-neon-orange)]"
          >
            {error}
          </p>
        )}

      </section>
    </>
  );
}

export default ConsumerPricingContent;
