import { useEffect, useState } from "react";
import type {
  BillingSubscriptionSummary,
  BillingInvoice,
  BillingUsageItem,
} from "@resomix/api-client";
import {
  PAGE_BTN_PRIMARY,
  PAGE_BTN_SECONDARY,
  PAGE_INSET_ROW,
  PAGE_KICKER,
  PAGE_PANEL,
  PAGE_ROW_META,
  PAGE_ROW_TITLE,
  PAGE_SUBLABEL,
} from "../Content/pageChrome";

/**
 * "Plan & Billing" card for the profile screen: current plan + status, this month's usage,
 * Upgrade (→ Stripe Checkout) / Manage (→ Stripe Customer Portal), and billing history.
 * Hosted Stripe flows: the backend returns a URL and we redirect. Matches the profile card styling.
 */

const FEATURE_LABELS: Record<string, string> = {
  // `search_playlists_per_month` kept its key when the window went daily (pricing v2.1 Q3), so the
  // label has to say what it actually is — the key can't be trusted to read correctly.
  search_playlists_per_month: "Sonic searches (today)",
  uploads_per_month: "Uploads (this month)",
  exports_per_day: "Exports (today)",
  library_playlists_max: "Playlists in your Library",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
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
  // `null` used means NOT KNOWN — an unreadable counter. Rendering it as 0 would tell someone they
  // had spent nothing when we simply could not find out.
  const known = typeof item.used === "number";
  const used = known ? (item.used as number) : 0;
  const limit = item.limit;
  const unlimited = limit === null || (typeof limit === "number" && limit < 0);
  const pct = !known || unlimited || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="flex flex-col gap-[var(--px-6)]">
      <div className="flex justify-between gap-[var(--px-10)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)]">
        <span className="min-w-0 truncate text-[var(--rx-color-text-secondary)]">{label}</span>
        <span className="shrink-0 tabular-nums text-[var(--rx-color-text-primary)]">
          {!known ? "—" : unlimited ? `${used} / ∞` : `${used} / ${limit ?? 0}`}
        </span>
      </div>
      {/* Square meter on a token border — same treatment as the playlist match meter. */}
      <div className="h-[var(--px-4)] w-full overflow-hidden rounded-[var(--px-2)] border border-[var(--rx-color-border-default)]">
        <div
          className="h-full bg-[var(--rx-color-accent)] transition-[width] duration-300"
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
    <div className={PAGE_PANEL}>
      <h2 className={`${PAGE_KICKER} mb-[var(--px-16)]`}>Plan &amp; Billing</h2>

      {justSubscribed && (
        <div className="mb-[var(--px-14)] border border-[var(--rx-color-success,#63d28f)] bg-[rgba(99,210,143,0.08)] p-[var(--px-10)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-success,#63d28f)]">
          You're subscribed — thank you! It may take a moment to reflect.
        </div>
      )}

      {loading ? (
        <div className={PAGE_SUBLABEL}>Loading…</div>
      ) : (
        <div className="flex flex-col gap-[var(--px-18)]">
          <div className={`${PAGE_INSET_ROW} !items-start`}>
            <div className="min-w-0">
              <div className={PAGE_ROW_TITLE}>
                {planName}
                {status === "past_due" ? " (past due)" : ""}
              </div>
              {statusLine && <div className={PAGE_ROW_META}>{statusLine}</div>}
            </div>
            <div className="shrink-0">
              {isPaid ? (
                <button type="button" onClick={goPortal} disabled={busy} className={PAGE_BTN_SECONDARY}>
                  {busy ? "Opening…" : "Manage"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/subscribe";
                  }}
                  disabled={busy}
                  className={PAGE_BTN_PRIMARY}
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>

          {summary?.usage?.length ? (
            <div className="flex flex-col gap-[var(--px-12)]">
              <div className={PAGE_SUBLABEL}>Your usage</div>
              {summary.usage.map((u) => (
                <UsageMeter key={u.feature} item={u} />
              ))}
            </div>
          ) : null}

          {invoices.length > 0 && (
            <div className="flex flex-col gap-[var(--px-8)]">
              <div className={PAGE_SUBLABEL}>Billing history</div>
              <div className="flex flex-col gap-[var(--px-6)]">
                {invoices.slice(0, 6).map((inv) => (
                  <div
                    key={inv.stripe_invoice_id}
                    className={`${PAGE_INSET_ROW} !p-[var(--px-10)] gap-[var(--px-10)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)]`}
                  >
                    <span className="shrink-0 tabular-nums text-[var(--rx-color-text-secondary)]">
                      {fmtDate(inv.created_at)}
                    </span>
                    <span className="min-w-0 truncate text-[var(--rx-color-text-primary)]">
                      {fmtMoney(inv.amount_paid_cents, inv.currency)} · {inv.status}
                    </span>
                    {inv.hosted_invoice_url ? (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[var(--rx-color-text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--rx-color-accent)]"
                      >
                        View
                      </a>
                    ) : (
                      <span className="shrink-0 opacity-40">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlanBillingCard;
