import { useEffect, useState } from "react";
import type { BillingPlansResponse } from "@resomix/api-client";
import { PricingButton } from "./PricingButton";
import { Chip, Eyebrow, PlanPanel, SectionBody, SectionHeading } from "./PricingChrome";
import { FoundingBadge } from "./FoundingBadge";
import { planFeatures } from "./planFeatures";

/**
 * Consumer plans — rendered as the FIRST section of the unified pricing page (`PricingContent`).
 * Fetches /billing/plans and renders Free / Pro (purchasable → Stripe Checkout) / Basic + Max
 * ("Coming soon"). Highlights the viewer's current plan; already-subscribed → Manage (Portal).
 * Section-only: no page chrome (heading/back-link live on the page). Works logged-out too.
 *
 * Presentation follows the marketing system (square hairline panels, mono labels, the landing
 * button). The billing behaviour below is unchanged.
 */

const PLAN_TAGLINES: Record<string, string> = {
  free: "Core matching with monthly limits — always free.",
  basic: "A step up from Free.",
  pro: "For power users — higher monthly limits and priority processing.",
  max: "Everything in Pro, at the highest limits.",
};

function fmtMoney(cents: number | null, currency: string): string {
  if (cents == null) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function ConsumerPricingContent() {
  const [data, setData] = useState<BillingPlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { useAuthStore } = await import("@resomix/stores");
        setAuthed(!!useAuthStore.getState().isAuthenticated);
      } catch {
        /* noop */
      }
      await load();
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { getBillingPlans } = await import("@resomix/api-client");
      const res = await getBillingPlans();
      if (res.success) setData(res.data as BillingPlansResponse);
    } catch {
      /* leave defaults */
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (code: string) => {
    setError(null);
    if (!authed) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent("/subscribe")}`;
      return;
    }
    setBusy(code);
    try {
      const { startBillingCheckout } = await import("@resomix/api-client");
      const res: any = await startBillingCheckout(code);
      if (res?.success && res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(res?.error || "Couldn't start checkout. Please try again.");
    } catch {
      setError("Couldn't start checkout. Please try again.");
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
      setError(res?.error || "Couldn't open the billing portal.");
    } catch {
      setError("Couldn't open the billing portal.");
    }
    setBusy(null);
  };

  const plans = data?.plans || [];

  return (
    <section className="space-y-[var(--px-32)]">
      <header>
        <Eyebrow>For Creators</Eyebrow>
        <SectionHeading>Simple monthly plans</SectionHeading>
        <SectionBody className="mt-[var(--px-14)] max-w-[52ch]">
          Simple monthly plans for individual creators. Upgrade, downgrade or cancel anytime.
        </SectionBody>
        {/* Only while the server says the founding window is open — see FoundingBadge. */}
        <FoundingBadge beta={data?.beta} className="mt-[var(--px-20)]" />
      </header>

      {loading ? (
        <p className="font-fira text-[length:var(--px-11)] uppercase tracking-[0.18em] text-[var(--color-primary-hover)]">
          Loading…
        </p>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-[var(--px-20)] md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = p.is_current;
            const price = p.is_free
              ? fmtMoney(0, p.currency)
              : p.unit_amount_cents != null
                ? fmtMoney(p.unit_amount_cents, p.currency)
                : null;
            return (
              <PlanPanel key={p.code} highlighted={!!isCurrent}>
                <div className="space-y-[var(--px-16)]">
                  <div className="flex items-center justify-between gap-[var(--px-8)]">
                    <h3 className="m-0 font-helvetica text-[length:var(--px-18)] font-bold uppercase tracking-[var(--px-1)] text-[var(--color-text-secondary)]">
                      {p.name}
                    </h3>
                    {isCurrent && <Chip>Your plan</Chip>}
                  </div>

                  <div className="border-y border-white/13 py-[var(--px-16)]">
                    {p.coming_soon ? (
                      <span className="font-fira text-[length:var(--px-13)] uppercase tracking-[0.14em] text-[var(--color-primary-hover)] opacity-70">
                        Coming soon
                      </span>
                    ) : (
                      <div className="flex items-baseline gap-[var(--px-4)]">
                        <span className="font-helvetica text-[length:var(--px-36)] font-bold leading-none tracking-tight text-[var(--color-text-secondary)]">
                          {price}
                        </span>
                        {!p.is_free && (
                          <span className="font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em] text-[var(--color-primary-hover)] opacity-70">
                            / {p.interval === "year" ? "yr" : "mo"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
                    {PLAN_TAGLINES[p.code] || ""}
                  </p>

                  {/* Rendered from the SAME rows that enforce these limits, so an admin raising a
                      cap updates this page too. Hard-coded copy starts lying the first time a plan
                      is edited — and nothing fails, which is why nobody notices. */}
                  <ul className="m-0 list-none space-y-[var(--px-8)] p-0">
                    {planFeatures(p.limits).map((f) => (
                      <li
                        key={f.key}
                        className={`flex items-start gap-[var(--px-8)] font-helvetica text-[length:var(--px-13)] font-light leading-[1.5] ${
                          f.included
                            ? "text-[var(--color-primary-hover)]"
                            : "text-[var(--color-primary-hover)] opacity-40"
                        }`}
                      >
                        <span aria-hidden="true" className="text-[var(--color-neon-orange)]">
                          {f.included ? "→" : "×"}
                        </span>
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-[var(--px-24)]">
                  {p.coming_soon ? (
                    <PricingButton fullWidth disabled>
                      Coming soon
                    </PricingButton>
                  ) : p.is_free ? (
                    <PricingButton fullWidth disabled>
                      {isCurrent ? "Your plan" : "Included"}
                    </PricingButton>
                  ) : isCurrent ? (
                    <PricingButton fullWidth onClick={manage} disabled={!!busy}>
                      {busy === "__manage__" ? "Opening…" : "Manage"}
                    </PricingButton>
                  ) : (
                    <PricingButton
                      fullWidth
                      variant="primary"
                      onClick={() => subscribe(p.code)}
                      disabled={!!busy}
                    >
                      {busy === p.code ? "Redirecting…" : authed ? "Subscribe" : "Sign in to subscribe"}
                    </PricingButton>
                  )}
                </div>
              </PlanPanel>
            );
          })}
        </div>
      )}

      {/* Required for EU consumer pricing: the figure shown must be the figure charged. Stripe
          resolves the exact rate at checkout, so this says VAT is included rather than quoting a
          percentage that would be wrong outside one country. */}
      <p className="m-0 max-w-[52ch] font-helvetica text-[length:var(--px-11)] font-light leading-[1.6] text-[var(--color-primary-hover)] opacity-70">
        Prices include VAT where applicable. Cancel anytime — your plan stays active until the end
        of the period you have paid for.
      </p>

      {error && (
        <p className="font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em] text-[var(--color-neon-orange)]">
          {error}
        </p>
      )}
    </section>
  );
}

export default ConsumerPricingContent;
