import { useEffect, useState } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import type { BillingPlansResponse } from "@resomix/api-client";

/**
 * Consumer plans — rendered as the FIRST section of the unified pricing page (`PricingContent`).
 * Fetches /billing/plans and renders Free / Pro (purchasable → Stripe Checkout) / Basic + Max
 * ("Coming soon"). Highlights the viewer's current plan; already-subscribed → Manage (Portal).
 * Section-only: no page chrome (heading/back-link live on the page). Works logged-out too.
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
    <section className="space-y-[var(--px-24)] lg:space-y-[var(--px-32)]">
      <header className="text-center">
        <h2 className="text-[length:var(--px-22)] lg:text-[length:var(--px-28)] font-medium uppercase tracking-wide">
          For Creators
        </h2>
        <p className="mt-[var(--px-6)] text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-extralight opacity-70 max-w-xl mx-auto">
          Simple monthly plans for individual creators. Upgrade, downgrade or cancel anytime.
        </p>
      </header>

      {loading ? (
        <div className="text-center text-[length:var(--px-11)] font-light lg:opacity-80">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[var(--px-20)] items-stretch">
          {plans.map((p) => {
            const isCurrent = p.is_current;
            const price = p.is_free
              ? fmtMoney(0, p.currency)
              : p.unit_amount_cents != null
                ? fmtMoney(p.unit_amount_cents, p.currency)
                : null;
            return (
              <div
                key={p.code}
                className={`bg-[var(--color-primary-background)]/30 backdrop-blur-md rounded-[var(--px-10)] p-[var(--px-24)] flex flex-col justify-between transition-all duration-300 ${
                  isCurrent
                    ? "border-2 border-[var(--color-primary)]"
                    : "border border-slate-200 border-dotted hover:border-zinc-500"
                }`}
              >
                <div className="space-y-[var(--px-16)]">
                  <div className="flex items-center justify-between gap-[var(--px-8)]">
                    <h3 className="text-[length:var(--px-20)] font-medium uppercase tracking-wide">{p.name}</h3>
                    {isCurrent && (
                      <span className="text-[length:var(--px-9)] uppercase font-fira px-[var(--px-8)] py-[var(--px-2)] rounded-full bg-[var(--color-primary)] text-[var(--color-secondary)]">
                        Your plan
                      </span>
                    )}
                  </div>

                  <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-16)]">
                    {p.coming_soon ? (
                      <span className="text-[length:var(--px-20)] font-medium opacity-60">Coming soon</span>
                    ) : (
                      <div className="flex items-baseline gap-[var(--px-4)]">
                        <span className="text-[length:var(--px-36)] leading-none font-medium tracking-tight">{price}</span>
                        {!p.is_free && (
                          <span className="text-[length:var(--px-11)] opacity-60 font-extralight">
                            / {p.interval === "year" ? "yr" : "mo"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-[length:var(--px-12)] font-extralight leading-[var(--px-16)] opacity-80">
                    {PLAN_TAGLINES[p.code] || ""}
                  </p>
                </div>

                <div className="mt-[var(--px-24)]">
                  {p.coming_soon ? (
                    <button
                      disabled
                      className="w-full px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted rounded text-[length:var(--px-11)] font-light opacity-50 cursor-not-allowed"
                    >
                      Coming soon
                    </button>
                  ) : p.is_free ? (
                    <button
                      disabled
                      className="w-full px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted rounded text-[length:var(--px-11)] font-light opacity-60"
                    >
                      {isCurrent ? "Your plan" : "Included"}
                    </button>
                  ) : isCurrent ? (
                    <ButtonSleek
                      text={busy === "__manage__" ? "Opening…" : "Manage"}
                      onClick={manage}
                      transparent
                      customWidth="w-full"
                      disabled={!!busy}
                    />
                  ) : (
                    <ButtonSleek
                      text={busy === p.code ? "Redirecting…" : authed ? "Subscribe" : "Sign in to subscribe"}
                      onClick={() => subscribe(p.code)}
                      customWidth="w-full"
                      disabled={!!busy}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="text-center text-[length:var(--px-10)] font-light text-red-500">{error}</div>}
    </section>
  );
}

export default ConsumerPricingContent;
