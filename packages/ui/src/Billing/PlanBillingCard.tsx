import { useEffect, useState } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import type {
  BillingSubscriptionSummary,
  BillingInvoice,
  BillingUsageItem,
} from "@resomix/api-client";

/**
 * "Plan & Billing" card for the profile screen: current plan + status, this month's usage,
 * Upgrade (→ Stripe Checkout) / Manage (→ Stripe Customer Portal), and billing history.
 * Hosted Stripe flows: the backend returns a URL and we redirect. Matches the profile card styling.
 */

const FEATURE_LABELS: Record<string, string> = {
  uploads_per_month: "Uploads",
  search_playlists_per_month: "Similarity playlists",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function fmtMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(
      (cents || 0) / 100
    );
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

function UsageMeter({ item }: { item: BillingUsageItem }) {
  const label = FEATURE_LABELS[item.feature] || item.feature;
  const used = item.used || 0;
  const limit = item.limit;
  const unlimited = limit === null || (typeof limit === "number" && limit < 0);
  const pct = unlimited || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="flex flex-col gap-[var(--px-4)]">
      <div className="flex justify-between text-[length:var(--px-10)] font-light font-helvetica">
        <span>{label}</span>
        <span className="lg:opacity-80">{unlimited ? `${used} / ∞` : `${used} / ${limit ?? 0}`}</span>
      </div>
      <div className="w-full h-[var(--px-4)] bg-white/10 rounded-full overflow-hidden outline outline-white/20 outline-dotted">
        <div
          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PlanBillingCard() {
  const [summary, setSummary] = useState<BillingSubscriptionSummary | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubscribed, setJustSubscribed] = useState(false);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("checkout") === "success") {
        setJustSubscribed(true);
      }
    } catch {
      /* noop */
    }
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { getBillingSubscription, getBillingInvoices } = await import("@resomix/api-client");
      const [sub, inv] = await Promise.all([getBillingSubscription(), getBillingInvoices()]);
      if (sub.success) setSummary(sub.data as BillingSubscriptionSummary);
      if (inv.success) setInvoices((inv.data as { invoices: BillingInvoice[] }).invoices || []);
    } catch {
      /* leave defaults */
    } finally {
      setLoading(false);
    }
  };

  const redirectTo = async (
    call: () => Promise<{ success: boolean; data?: { url?: string }; error?: string } | any>,
    failMsg: string
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await call();
      if (res?.success && res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError(res?.error || failMsg);
    } catch {
      setError(failMsg);
    }
    setBusy(false);
  };

  const goPortal = () =>
    redirectTo(
      async () => (await import("@resomix/api-client")).openBillingPortal(),
      "Couldn't open the billing portal. Please try again."
    );

  const planName = summary?.plan?.name || "Free";
  const planCode = summary?.plan?.code || "free";
  const sub = summary?.subscription || null;
  const isPaid = planCode !== "free" && planCode !== "guest";
  const status = sub?.status;

  let statusLine: string | null = null;
  if (sub) {
    if (sub.cancel_at_period_end && sub.current_period_end) {
      statusLine = `Cancels on ${fmtDate(sub.current_period_end)} — you keep ${planName} until then`;
    } else if (status === "active" && sub.current_period_end) {
      statusLine = `Renews on ${fmtDate(sub.current_period_end)}`;
    } else if (status === "trialing" && sub.trial_end) {
      statusLine = `Trial ends ${fmtDate(sub.trial_end)}`;
    } else if (status === "past_due") {
      statusLine = "Payment issue — please update your payment method";
    } else if (status) {
      statusLine = status;
    }
  }

  return (
    <div className="p-[var(--px-16)] border border-slate-200 border-dotted rounded-lg">
      <h2 className="text-[length:var(--px-14)] font-medium font-helvetica mb-[var(--px-10)]">Plan & Billing</h2>

      {justSubscribed && (
        <div className="mb-[var(--px-10)] p-[var(--px-8)] border border-green-500 border-dotted rounded text-[length:var(--px-10)] font-light font-helvetica text-green-500">
          You're subscribed — thank you! It may take a moment to reflect.
        </div>
      )}

      {loading ? (
        <div className="text-[length:var(--px-11)] font-light font-helvetica lg:opacity-80">Loading…</div>
      ) : (
        <div className="flex flex-col gap-[var(--px-14)]">
          <div className="flex justify-between items-start gap-[var(--px-10)] p-[var(--px-10)] border border-slate-200 border-dotted rounded">
            <div>
              <div className="text-[length:var(--px-12)] font-medium font-helvetica">
                {planName}
                {status === "past_due" ? " (past due)" : ""}
              </div>
              {statusLine && (
                <div className="text-[length:var(--px-10)] font-extralight font-helvetica lg:opacity-80 mt-[var(--px-4)]">
                  {statusLine}
                </div>
              )}
            </div>
            <div className="shrink-0">
              {isPaid ? (
                <ButtonSleek text={busy ? "Opening…" : "Manage"} onClick={goPortal} transparent disabled={busy} />
              ) : (
                <ButtonSleek
                  text="Upgrade"
                  onClick={() => {
                    window.location.href = "/subscribe";
                  }}
                  disabled={busy}
                />
              )}
            </div>
          </div>

          {summary?.usage?.length ? (
            <div className="flex flex-col gap-[var(--px-10)]">
              <div className="text-[length:var(--px-11)] font-light font-helvetica">This month's usage</div>
              {summary.usage.map((u) => (
                <UsageMeter key={u.feature} item={u} />
              ))}
            </div>
          ) : null}

          {invoices.length > 0 && (
            <div className="flex flex-col gap-[var(--px-8)]">
              <div className="text-[length:var(--px-11)] font-light font-helvetica">Billing history</div>
              <div className="flex flex-col gap-[var(--px-4)]">
                {invoices.slice(0, 6).map((inv) => (
                  <div
                    key={inv.stripe_invoice_id}
                    className="flex justify-between items-center gap-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica p-[var(--px-6)] border border-slate-200 border-dotted rounded"
                  >
                    <span>{fmtDate(inv.created_at)}</span>
                    <span className="lg:opacity-80">
                      {fmtMoney(inv.amount_paid_cents, inv.currency)} · {inv.status}
                    </span>
                    {inv.hosted_invoice_url ? (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
                      >
                        View
                      </a>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="text-[length:var(--px-10)] font-light font-helvetica text-red-500">{error}</div>}
        </div>
      )}
    </div>
  );
}

export default PlanBillingCard;
