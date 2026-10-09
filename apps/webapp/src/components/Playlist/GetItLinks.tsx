import { pushStoreLinkClicked } from "@resomix/hooks";
import type { BuyLink, StoreLinkTracking } from "@/utils/trackUtils.ts";

/**
 * The playing row's buy line, "GET IT // Traxsource · Bandcamp", with the stores as text links
 * (George's layout, October 2026). It sits on the row's top line, well away from the Apple badge:
 * Apple's preview terms do not allow other stores beside its player, so store links never share the
 * player strip. Renders nothing when the track has no store link. A click is logged as
 * `store_link_clicked` with `row_state: "open"` (bought while listening).
 */
interface GetItLinksProps {
  links: BuyLink[];
  tracking: StoreLinkTracking;
  className?: string;
}

export function GetItLinks({ links, tracking, className = "" }: GetItLinksProps) {
  if (links.length === 0) return null;

  return (
    <div
      className={`flex min-w-0 items-center gap-[var(--px-6)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] ${className}`.trim()}
    >
      <span className="shrink-0 text-[var(--rx-color-text-muted)]">Get it //</span>
      {links.map((link, i) => (
        <span key={link.store} className="flex min-w-0 items-center gap-[var(--px-6)]">
          {i > 0 && (
            <span aria-hidden="true" className="text-[var(--rx-color-text-muted)]">
              ·
            </span>
          )}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Buy on ${link.label}`}
            title={`Buy on ${link.label}`}
            onClick={(e) => {
              e.stopPropagation();
              pushStoreLinkClicked({ store: link.store, rowState: "open", ...tracking });
            }}
            className="truncate text-[var(--rx-color-text-secondary)] underline-offset-[var(--px-3)] transition-colors hover:text-[var(--color-accent,#EE4A26)] hover:underline"
          >
            {link.label}
          </a>
        </span>
      ))}
    </div>
  );
}

export default GetItLinks;
