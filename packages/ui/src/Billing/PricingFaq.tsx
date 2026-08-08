import { useState, type ReactNode } from "react";
import { FAQ, FAQ_ITEMS, LEGAL_BASE, LEGAL_LINKS, PRO_CARD } from "./pricingCopy";

export interface FoundingOfferCopy {
  /** Formatted offer-entry deadline from `data.beta.end_date`, or null when closed. */
  endDateLabel: string | null;
  monthlyFounding: string | null;
  monthlyList: string | null;
  yearlyFounding: string | null;
  yearlyList: string | null;
  foundingActive: boolean;
}

/** @deprecated Use FoundingOfferCopy — kept as an alias for existing call sites. */
export type BetaPriceCopy = FoundingOfferCopy;

interface FaqItem {
  id: string;
  q: string;
  a: ReactNode;
}

function Disc({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="rx-faq-disc group border-t border-white/8 last:border-b">
      <summary className="relative cursor-pointer list-none py-[var(--px-16)] pr-[var(--px-32)] font-helvetica text-[length:var(--px-16)] font-light text-[var(--color-text-secondary)] [&::-webkit-details-marker]:hidden">
        {q}
        <span
          aria-hidden="true"
          className="absolute right-[var(--px-3)] top-1/2 -translate-y-1/2 font-fira text-[length:var(--px-20)] leading-none text-[var(--color-neon-orange)] group-open:hidden"
        >
          +
        </span>
        <span
          aria-hidden="true"
          className="absolute right-[var(--px-3)] top-1/2 hidden -translate-y-1/2 font-fira text-[length:var(--px-20)] leading-none text-[var(--color-neon-orange)] group-open:inline"
        >
          –
        </span>
      </summary>
      <div className="max-w-[52rem] pb-[var(--px-18)] font-helvetica text-[length:var(--px-15)] font-light leading-[1.7] text-[var(--color-primary-hover)] [&_p+p]:mt-[var(--px-11)]">
        {children}
      </div>
    </details>
  );
}

function Para({ children }: { children: ReactNode }) {
  return <p className="m-0">{children}</p>;
}

function buildFoundingAnswer(offer: FoundingOfferCopy): ReactNode | null {
  if (!offer.foundingActive || !offer.endDateLabel) return null;
  const {
    endDateLabel,
    monthlyFounding,
    monthlyList,
    yearlyFounding,
    yearlyList,
  } = offer;

  return (
    <>
      <Para>
        <strong className="font-medium text-[var(--color-text-secondary)]">{endDateLabel}</strong> is
        the deadline to start a founding subscription. Join before then to lock in the founding
        rate. {PRO_CARD.deadlineNotBetaEnd}
      </Para>
      {(monthlyFounding || monthlyList || yearlyFounding || yearlyList) && (
        <Para>
          After you subscribe, you keep the founding rate for the billing cycles locked in at
          checkout — the schedule is confirmed before you pay.{" "}
          {monthlyFounding && monthlyList && (
            <>
              On monthly billing, {monthlyFounding} / month then becomes{" "}
              <strong className="font-medium text-[var(--color-text-secondary)]">{monthlyList} / month</strong>{" "}
              + applicable VAT.{" "}
            </>
          )}
          {yearlyFounding && yearlyList && (
            <>
              On annual billing, {yearlyFounding} covers the founding term; it then renews at{" "}
              <strong className="font-medium text-[var(--color-text-secondary)]">{yearlyList} / year</strong>{" "}
              + applicable VAT.
            </>
          )}
        </Para>
      )}
      <Para>
        The change is disclosed before you buy, it is shown again in your billing portal, and you can
        cancel at any point before or after it.
      </Para>
    </>
  );
}

export function PricingFaq({ beta }: { beta: FoundingOfferCopy }) {
  const [tab, setTab] = useState(0);

  const foundingAnswer = buildFoundingAnswer(beta);

  const plansItems: FaqItem[] = [
    { id: "unlimited", q: FAQ_ITEMS.unlimited.q, a: <Para>{FAQ_ITEMS.unlimited.a}</Para> },
    { id: "allowances", q: FAQ_ITEMS.allowances.q, a: <Para>{FAQ_ITEMS.allowances.a}</Para> },
    { id: "library", q: FAQ_ITEMS.library.q, a: <Para>{FAQ_ITEMS.library.a}</Para> },
    { id: "freeSummary", q: FAQ_ITEMS.freeSummary.q, a: <Para>{FAQ_ITEMS.freeSummary.a}</Para> },
    { id: "fullTi", q: FAQ_ITEMS.fullTi.q, a: <Para>{FAQ_ITEMS.fullTi.a}</Para> },
    { id: "appleMusic", q: FAQ_ITEMS.appleMusic.q, a: <Para>{FAQ_ITEMS.appleMusic.a}</Para> },
  ];

  const billingItems: FaqItem[] = [
    ...(foundingAnswer
      ? [{ id: "foundingOffer", q: FAQ_ITEMS.foundingOffer.q, a: foundingAnswer }]
      : []),
    { id: "vat", q: FAQ_ITEMS.vat.q, a: <Para>{FAQ_ITEMS.vat.a}</Para> },
  ];

  const managingItems: FaqItem[] = [
    { id: "cancel", q: FAQ_ITEMS.cancel.q, a: <Para>{FAQ_ITEMS.cancel.a}</Para> },
    { id: "uploads", q: FAQ_ITEMS.uploads.q, a: <Para>{FAQ_ITEMS.uploads.a}</Para> },
  ];

  const tabs: Array<{ name: string; items: FaqItem[] }> = [
    { name: FAQ.tabs.plans, items: plansItems },
    { name: FAQ.tabs.billing, items: billingItems },
    { name: FAQ.tabs.managing, items: managingItems },
  ];


  return (
    <section className="space-y-[var(--px-14)]" aria-labelledby="faq-h">
      <h2
        id="faq-h"
        className="m-0 px-[var(--px-12)] text-center font-helvetica text-[length:var(--px-19)] font-bold uppercase leading-[1.2] tracking-[var(--px-1)] text-[var(--color-text-secondary)] md:text-[length:var(--px-23)] md:leading-[1.15] lg:text-[length:var(--px-34)]"
      >
        {FAQ.heading}
      </h2>

      {/* Categories as full-width disclosures, not tabs.
          A tab strip hid two thirds of the content behind controls that looked like filters, and on
          mobile the three labels wrapped into a stack that read as broken. Each category is now a
          row you open; its questions expand underneath it, in place. */}
      <div className="mx-auto mt-[var(--px-26)] max-w-[56rem]">
        {tabs.map((t, i) => {
          const open = i === tab;
          return (
            <div key={t.name} className="border-t border-white/13 last:border-b">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`rx-faq-panel-${i}`}
                id={`rx-faq-cat-${i}`}
                /* Toggle: pressing the open category closes it, so all three can be collapsed. */
                onClick={() => setTab(open ? -1 : i)}
                className={[
                  "flex w-full items-center justify-between gap-[var(--px-14)] px-[var(--px-14)] py-[var(--px-18)]",
                  "text-left font-fira text-[length:var(--px-12)] uppercase tracking-[0.12em] transition-colors",
                  // Faint accent wash so a CATEGORY row is visibly a different kind of control
                  // from a question row, which sits plain on the page background.
                  open
                    ? "bg-[rgba(226,89,58,0.10)] text-[var(--color-neon-orange)]"
                    : "bg-[rgba(226,89,58,0.04)] text-[var(--color-primary-hover)] hover:bg-[rgba(226,89,58,0.08)] hover:text-[var(--color-text-secondary)]",
                ].join(" ")}
              >
                <span>{t.name}</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  // 22px, up from 16: at the old size the chevron and the questions' +/- glyphs
                  // were near-indistinguishable at a glance.
                  className={`h-[var(--px-22)] w-[var(--px-22)] shrink-0 fill-none stroke-[var(--color-neon-orange)] transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {open && (
                <div
                  id={`rx-faq-panel-${i}`}
                  aria-labelledby={`rx-faq-cat-${i}`}
                  className="pb-[var(--px-8)] pl-[var(--px-4)]"
                >
                  {t.items.map((item) => (
                    <Disc key={item.id} q={item.q}>
                      {item.a}
                    </Disc>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-[var(--px-24)] text-center font-fira text-[length:var(--px-11)] uppercase leading-[2] tracking-[0.16em] text-[var(--color-primary-hover)] opacity-75">
        {LEGAL_LINKS.map((link, i) => (
          <span key={link.slug}>
            {i > 0 && " · "}
            <a
              href={`${LEGAL_BASE}/${link.slug}/`}
              className="text-inherit no-underline hover:text-[var(--color-text-secondary)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}

export default PricingFaq;
