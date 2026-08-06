import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BillingPlanLimits } from "@resomix/api-client";
import { PricingButton } from "./PricingButton";
import {
  formatPerDay,
  formatPerMonth,
  formatPlainCount,
  formatTopN,
} from "./planFeatures";
import { COMPARE, GUEST_LIMITS_FALLBACK } from "./pricingCopy";

/**
 * Plan comparison (Guest · Free · Pro on desktop; Free/Guest · Pro on mobile).
 *
 * Desktop (≥901px): three-column sticky plan header that collapses while the table crosses
 * the stick line. `--stick-top` reads `var(--nav-sticky-h)`.
 *
 * Mobile (≤900px): two value columns only — Free vs Pro by default, with a segmented control
 * to substitute Guest for Free. No horizontal scroll.
 */

export interface PlanComparisonProps {
  freeLimits?: BillingPlanLimits | null;
  proLimits?: BillingPlanLimits | null;
  /** Formatted Pro price for the selected interval (from API). */
  proPriceLabel: string;
  freePriceLabel?: string;
  onFreeCta?: () => void;
  onProCta?: () => void;
  freeCtaLabel: string;
  proCtaLabel: string;
  freeCtaDisabled?: boolean;
  proCtaDisabled?: boolean;
  /** Hide purchase CTAs entirely (current Pro subscriber). */
  hidePurchaseCtas?: boolean;
}

type Cell = string | "on" | "—";
type LeftPlan = "free" | "guest";

function cellClass(value: Cell, pro: boolean): string {
  const parts = [pro ? "rx-cmp__pro" : ""];
  if (value === "on") parts.push("rx-cmp__on");
  if (value === "—") parts.push("rx-cmp__na");
  return parts.filter(Boolean).join(" ");
}

function CellTd({
  value,
  pro,
  col,
}: {
  value: Cell;
  pro?: boolean;
  col?: "guest" | "free";
}) {
  const colClass = col === "guest" ? "rx-cmp__guest" : col === "free" ? "rx-cmp__free" : "";
  return (
    <td className={[cellClass(value, !!pro), colClass].filter(Boolean).join(" ")}>
      {value === "on" ? "" : value}
    </td>
  );
}

function libraryListed(limits: BillingPlanLimits | null | undefined): Cell {
  if (!limits) return "—";
  if (limits.library_playlists_max === null) return "Unlimited (fair use)";
  if (limits.library_playlists_max === 0) return COMPARE.values.noLibrary;
  return formatPlainCount(limits.library_playlists_max);
}

export function PlanComparison({
  freeLimits,
  proLimits,
  proPriceLabel,
  freePriceLabel = COMPARE.values.freePrice,
  onFreeCta,
  onProCta,
  freeCtaLabel,
  proCtaLabel,
  freeCtaDisabled,
  proCtaDisabled,
  hidePurchaseCtas = false,
}: PlanComparisonProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [stuck, setStuck] = useState(false);
  const [leftPlan, setLeftPlan] = useState<LeftPlan>("free");
  // Guest column — route (b): fallback constant until `/billing/plans` exposes the guest row.
  const guest = GUEST_LIMITS_FALLBACK;

  useEffect(() => {
    const table = tableRef.current;
    if (!table || typeof IntersectionObserver === "undefined") return;

    const measureTop = () => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;visibility:hidden;height:var(--nav-sticky-h,3.25rem);pointer-events:none";
      document.body.appendChild(probe);
      const px = Math.max(0, Math.round(probe.getBoundingClientRect().height));
      probe.remove();
      return px || 52;
    };

    const top = measureTop();
    table.style.setProperty("--rx-stick-top", `${top}px`);
    const host = table.closest(".rx-cmp-scroll") || table;

    const alignToStick = () => {
      host.scrollIntoView({ block: "start" });
      // Nudge past the stick band edge so IntersectionObserver classifies as intersecting.
      window.scrollBy(0, 1);
    };

    // Plans load async above this table — a single scrollIntoView on mount loses the stick line
    // once the Free/Pro cards replace their skeletons. Re-align on hash load after layout settles.
    let hashTimer: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && window.location.hash === "#compare") {
      alignToStick();
      setStuck(true);
      hashTimer = setTimeout(() => {
        alignToStick();
        setStuck(true);
      }, 450);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        setStuck(entry.isIntersecting);
      },
      { root: null, rootMargin: `-${top}px 0px -99.9% 0px`, threshold: 0 },
    );
    // Observe the scroll host (not a point sentinel). Tables with sticky thead can report a
    // bounding box that sits below the stick band even when the host has crossed it.
    io.observe(host);

    return () => {
      if (hashTimer) clearTimeout(hashTimer);
      io.disconnect();
    };
  }, []);

  const rows: Array<
    | { kind: "grp"; label: string }
    | { kind: "row"; label: string; guest: Cell; free: Cell; pro: Cell }
  > = [
    { kind: "grp", label: COMPARE.groups.discovery },
    {
      kind: "row",
      label: COMPARE.rows.sonicSearches,
      guest: formatPerDay(guest.searches_per_day),
      free: formatPerDay(freeLimits?.searches_per_day),
      pro: formatPerDay(proLimits?.searches_per_day),
    },
    {
      kind: "row",
      label: COMPARE.rows.matchesVisible,
      guest: formatTopN(guest.top_sk_max),
      free: formatTopN(freeLimits?.top_sk_max),
      pro: formatTopN(proLimits?.top_sk_max),
    },
    {
      kind: "row",
      label: COMPARE.rows.maxDepth,
      guest: formatPlainCount(guest.dropdown_max_tracks),
      free: formatPlainCount(freeLimits?.dropdown_max_tracks),
      pro: formatPlainCount(proLimits?.dropdown_max_tracks),
    },
    {
      kind: "row",
      label: COMPARE.rows.repeatSearch,
      guest: COMPARE.values.freeRepeat,
      free: COMPARE.values.freeRepeat,
      pro: COMPARE.values.freeRepeat,
    },
    {
      kind: "row",
      label: COMPARE.rows.openPlayShare,
      guest: "on",
      free: "on",
      pro: "on",
    },

    { kind: "grp", label: COMPARE.groups.trackIntelligence },
    {
      kind: "row",
      label: COMPARE.rows.trackUploads,
      guest: formatPerMonth(guest.uploads_per_month),
      free: formatPerMonth(freeLimits?.uploads_per_month),
      pro: formatPerMonth(proLimits?.uploads_per_month),
    },
    {
      kind: "row",
      label: COMPARE.rows.completeSummary,
      guest: "—",
      free: "on",
      pro: "on",
    },
    {
      kind: "row",
      label: COMPARE.rows.similarityFromUpload,
      guest: "—",
      free: freeLimits?.can_similarity_upload ? "on" : "—",
      pro: proLimits?.can_similarity_upload ? "on" : "—",
    },
    {
      kind: "row",
      label: COMPARE.rows.fullDashboard,
      guest: "—",
      free: freeLimits?.can_view_full_analysis ? "on" : "—",
      pro: proLimits?.can_view_full_analysis ? "on" : "—",
    },

    { kind: "grp", label: COMPARE.groups.library },
    {
      kind: "row",
      label: COMPARE.rows.playlistsListed,
      guest: libraryListed(guest),
      free: libraryListed(freeLimits),
      pro: libraryListed(proLimits),
    },
    {
      kind: "row",
      label: COMPARE.rows.playlistsCreate,
      guest: COMPARE.values.notCapped,
      free: COMPARE.values.notCapped,
      pro: COMPARE.values.notCapped,
    },
    {
      kind: "row",
      label: COMPARE.rows.newPlaylistsAre,
      guest: COMPARE.values.public,
      free: COMPARE.values.private,
      pro: COMPARE.values.private,
    },
    {
      kind: "row",
      label: COMPARE.rows.renameFavourite,
      guest: "—",
      free: "on",
      pro: "on",
    },
    {
      kind: "row",
      label: COMPARE.rows.customCover,
      guest: "—",
      free: "on",
      pro: "on",
    },

    { kind: "grp", label: COMPARE.groups.export },
    {
      kind: "row",
      label: COMPARE.rows.exports,
      guest: formatPerDay(guest.exports_per_day),
      free: formatPerDay(freeLimits?.exports_per_day),
      pro: formatPerDay(proLimits?.exports_per_day),
    },
    {
      kind: "row",
      label: COMPARE.rows.tracksPerExport,
      guest: formatPlainCount(guest.export_track_limit),
      free: formatPlainCount(freeLimits?.export_track_limit),
      pro: formatPlainCount(proLimits?.export_track_limit),
    },
    {
      kind: "row",
      label: COMPARE.rows.txtTracklist,
      guest: "—",
      free: "on",
      pro: "on",
    },
    {
      kind: "row",
      label: COMPARE.rows.appleMusic,
      guest: "—",
      free: "on",
      pro: "on",
    },
    {
      kind: "row",
      label: COMPARE.rows.playlistEmbed,
      guest: "—",
      free: "—",
      pro: "on",
    },

    { kind: "grp", label: COMPARE.groups.account },
    {
      kind: "row",
      label: COMPARE.rows.accountRequired,
      guest: "—",
      free: "on",
      pro: "on",
    },
    {
      kind: "row",
      label: COMPARE.rows.price,
      guest: "—",
      free: freePriceLabel,
      pro: proPriceLabel,
    },
    {
      kind: "row",
      label: COMPARE.rows.cancelAnytime,
      guest: "—",
      free: "—",
      pro: "on",
    },
    {
      kind: "row",
      label: COMPARE.rows.billingPortal,
      guest: "—",
      free: "—",
      pro: "on",
    },
  ];

  return (
    <div
      id="compare"
      className="rx-cmp-scroll"
      style={{ scrollMarginTop: "var(--nav-sticky-h, 3.25rem)" }}
    >
      <style>{RX_CMP_CSS}</style>

      {/* Mobile: Free·Pro / Guest·Pro switch — Guest substitutes for Free, not a third column. */}
      <div
        role="radiogroup"
        aria-label={COMPARE.switchLabel}
        className="rx-cmp__switch"
      >
        {(
          [
            { id: "free" as const, label: COMPARE.switchFreePro },
            { id: "guest" as const, label: COMPARE.switchGuestPro },
          ] as const
        ).map((opt) => {
          const checked = leftPlan === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setLeftPlan(opt.id)}
              className={checked ? "is-on" : undefined}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <table
        ref={tableRef}
        className={`rx-cmp rx-cmp--left-${leftPlan}${stuck ? " is-stuck" : ""}`}
        data-testid="plan-comparison"
        data-left-plan={leftPlan}
      >
        <colgroup>
          <col className="rx-cmp__feat-col" />
          <col className="rx-cmp__guest-col" />
          <col className="rx-cmp__free-col" />
          <col className="rx-cmp__pro-col" />
        </colgroup>
        <thead>
          <tr>
            <th className="rx-cmp__feat" scope="col">
              <span className="rx-cmp__lbl">{COMPARE.featLabel}</span>
            </th>
            <th className="rx-cmp__pcol rx-cmp__guest" scope="col">
              <span className="rx-cmp__pname">{COMPARE.guestName}</span>
              <span className="rx-cmp__pprice">{COMPARE.guestPrice}</span>
            </th>
            <th className="rx-cmp__pcol rx-cmp__free" scope="col">
              <span className="rx-cmp__pname">{COMPARE.freeName}</span>
              <span className="rx-cmp__pprice">{freePriceLabel}</span>
              {!hidePurchaseCtas && (
                <span className="rx-cmp__ptry">
                  <PricingButton onClick={onFreeCta} disabled={freeCtaDisabled}>
                    {freeCtaLabel}
                  </PricingButton>
                </span>
              )}
            </th>
            <th className="rx-cmp__pcol rx-cmp__pcol--pro" scope="col">
              <span className="rx-cmp__pname">{COMPARE.proName}</span>
              <span className="rx-cmp__pprice" data-slot="tableprice">
                {proPriceLabel}
              </span>
              {!hidePurchaseCtas && (
                <span className="rx-cmp__ptry">
                  <PricingButton variant="primary" onClick={onProCta} disabled={proCtaDisabled}>
                    {proCtaLabel}
                  </PricingButton>
                </span>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.kind === "grp" ? (
              <tr key={`g-${r.label}`} className="rx-cmp__grp">
                <th scope="rowgroup">{r.label}</th>
                <td className="rx-cmp__guest" />
                <td className="rx-cmp__free" />
                <td className="rx-cmp__pro" />
              </tr>
            ) : (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <CellTd value={r.guest} col="guest" />
                <CellTd value={r.free} col="free" />
                <CellTd value={r.pro} pro />
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Centred section chrome around the table. */
export function PlanComparisonSection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="space-y-[var(--px-14)]" aria-labelledby="cmp-h">
      <h2
        id="cmp-h"
        className="m-0 text-center font-helvetica text-[length:var(--px-23)] font-bold uppercase leading-[1.15] tracking-[var(--px-1)] text-[var(--color-text-secondary)] lg:text-[length:var(--px-34)]"
      >
        {COMPARE.heading}
      </h2>
      <p className="mx-auto m-0 max-w-[40rem] text-center font-helvetica text-[length:var(--px-17)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
        {COMPARE.subtitle}
      </p>
      {/* Spacing above the table; #compare lives on the scroll host so the anchor lands on the stick line. */}
      <div className="mt-[var(--px-32)] scroll-mt-[var(--nav-sticky-h,3.25rem)]">{children}</div>
    </section>
  );
}

const RX_CMP_CSS = `
.rx-cmp-scroll { overflow-x: visible; width: 100%; }
.rx-cmp__switch {
  display: none;
  margin: 0 auto var(--px-16);
  width: fit-content;
  max-width: 100%;
  border: 1px solid rgba(255,255,255,0.22);
}
.rx-cmp__switch button {
  min-height: var(--px-44);
  padding: var(--px-12) var(--px-16);
  font-family: var(--font-fira, "Fira Code", monospace);
  font-size: var(--px-11);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: transparent;
  color: var(--color-primary-hover);
  border: 0;
  cursor: pointer;
}
.rx-cmp__switch button.is-on {
  background: var(--color-neon-orange);
  color: #101010;
  font-weight: 600;
}
.rx-cmp {
  width: 100%;
  min-width: 44rem;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  --rx-stick-top: var(--nav-sticky-h, 3.25rem);
  scroll-margin-top: var(--nav-sticky-h, 3.25rem);
}
.rx-cmp__feat-col { width: 40%; }
.rx-cmp thead th {
  position: sticky;
  top: var(--rx-stick-top);
  z-index: 6;
  background: var(--color-secondary);
  padding: var(--px-16) var(--px-14);
  box-shadow: inset 0 -1px 0 rgba(255,255,255,0.22);
  vertical-align: top;
  transition: padding 0.18s ease;
}
@media (prefers-reduced-motion: reduce) {
  .rx-cmp thead th { transition: none; }
}
.rx-cmp thead th.rx-cmp__feat { text-align: left; }
.rx-cmp thead th.rx-cmp__pcol { text-align: center; }
.rx-cmp.is-stuck thead th {
  padding-block: var(--px-8);
  box-shadow: inset 0 -1px 0 rgba(255,255,255,0.22), 0 6px 14px rgba(0,0,0,0.5);
}
.rx-cmp.is-stuck thead th .rx-cmp__ptry { display: none; }
.rx-cmp.is-stuck thead th .rx-cmp__pname { font-size: var(--px-13); }
.rx-cmp.is-stuck thead th .rx-cmp__pprice { margin-top: var(--px-2); font-size: var(--px-11); }
.rx-cmp.is-stuck thead th.rx-cmp__feat .rx-cmp__lbl::after {
  content: " · comparing";
  color: var(--color-primary-hover);
  opacity: 0.75;
}
@media (max-width: 900px) {
  .rx-cmp__switch { display: inline-flex; }
  .rx-cmp-scroll { overflow-x: visible; }
  .rx-cmp {
    min-width: 0;
    width: 100%;
  }
  .rx-cmp thead th { position: static; box-shadow: inset 0 -1px 0 rgba(255,255,255,0.22); }
  .rx-cmp.is-stuck thead th {
    padding-block: var(--px-12);
    box-shadow: inset 0 -1px 0 rgba(255,255,255,0.22);
  }
  .rx-cmp.is-stuck thead th.rx-cmp__feat .rx-cmp__lbl::after { content: none; }
  .rx-cmp.is-stuck thead th .rx-cmp__pname { font-size: var(--px-16); }
  .rx-cmp.is-stuck thead th .rx-cmp__pprice { font-size: var(--px-11); }
  .rx-cmp .rx-cmp__ptry { display: none; }
  .rx-cmp__feat-col { width: 48%; }
  .rx-cmp__guest-col,
  .rx-cmp__free-col,
  .rx-cmp__pro-col { width: 26%; }
  /* Two-column decision: hide the plan that is not selected on the left. */
  .rx-cmp--left-free .rx-cmp__guest,
  .rx-cmp--left-free col.rx-cmp__guest-col { display: none; }
  .rx-cmp--left-guest .rx-cmp__free,
  .rx-cmp--left-guest col.rx-cmp__free-col { display: none; }
  .rx-cmp--left-free .rx-cmp__free-col,
  .rx-cmp--left-guest .rx-cmp__guest-col { width: 26%; }
  .rx-cmp thead th.rx-cmp__pcol { text-align: right; }
  .rx-cmp tbody td { text-align: right; }
  .rx-cmp tbody th {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    padding: var(--px-14) var(--px-10) var(--px-14) 0;
  }
  .rx-cmp tbody td {
    padding: var(--px-14) 0 var(--px-14) var(--px-8);
  }
  .rx-cmp thead th {
    padding: var(--px-12) var(--px-8);
  }
  .rx-cmp thead th.rx-cmp__feat { padding-left: 0; }
  .rx-cmp tr.rx-cmp__grp th {
    padding: var(--px-24) var(--px-10) var(--px-11) 0;
  }
}
.rx-cmp__pname {
  font-family: var(--font-helvetica, Helvetica, Arial, sans-serif);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
  font-size: var(--px-16);
  display: block;
}
.rx-cmp__pcol--pro .rx-cmp__pname { color: var(--color-neon-orange); }
.rx-cmp__pprice {
  font-family: var(--font-fira, "Fira Code", monospace);
  font-size: var(--px-11);
  letter-spacing: 0.05em;
  color: var(--color-primary-hover);
  margin-top: var(--px-6);
  display: block;
}
.rx-cmp__ptry {
  margin-top: var(--px-11);
  display: inline-flex;
  justify-content: center;
}
.rx-cmp__lbl {
  font-family: var(--font-fira, "Fira Code", monospace);
  font-size: var(--px-11);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-primary-hover);
}
.rx-cmp tbody th {
  text-align: left;
  font-weight: 300;
  font-size: var(--px-15);
  color: var(--color-primary-hover);
  padding: var(--px-13) var(--px-14);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.rx-cmp tbody td {
  text-align: center;
  font-family: var(--font-fira, "Fira Code", monospace);
  font-size: var(--px-12);
  letter-spacing: 0.03em;
  color: var(--color-text-secondary);
  padding: var(--px-13) var(--px-14);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.rx-cmp tbody td.rx-cmp__na { color: var(--color-primary-hover); opacity: 0.75; }
.rx-cmp tbody td.rx-cmp__on::before {
  content: "●";
  color: var(--color-neon-orange);
  font-size: var(--px-13);
}
.rx-cmp tbody td.rx-cmp__pro,
.rx-cmp tr.rx-cmp__grp td.rx-cmp__pro {
  background: rgba(238, 74, 38, 0.035);
}
.rx-cmp tr.rx-cmp__grp th {
  font-family: var(--font-fira, "Fira Code", monospace);
  font-size: var(--px-11);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  padding: var(--px-32) var(--px-14) var(--px-11);
  border-bottom: 1px solid rgba(255,255,255,0.13);
}
.rx-cmp tr.rx-cmp__grp td { border-bottom: 1px solid rgba(255,255,255,0.13); }
@media (min-width: 901px) {
  .rx-cmp__switch { display: none !important; }
}
`;

export default PlanComparison;
