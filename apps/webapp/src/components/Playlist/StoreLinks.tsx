import TraxsourceIcon from "@/assets/icons/stores/traxsource.svg";
import BandcampIcon from "@/assets/icons/stores/bandcamp.svg";

/**
 * "Buy on ..." links for the download stores we matched the track to, as small store icons. Shown
 * wherever the Apple Music badge is. Each store appears only when its link is set, so a track with
 * neither shows nothing, with one shows that one, with both shows both. The links come from the
 * backend's `track_store_links` (uploads never have them, and hidden tracks get them nulled).
 */
interface StoreLinksProps {
  traxsourceUrl?: string | null;
  bandcampUrl?: string | null;
  className?: string;
  iconClass?: string;
}

const STORES = [
  { key: "traxsource", label: "Traxsource", icon: TraxsourceIcon },
  { key: "bandcamp", label: "Bandcamp", icon: BandcampIcon },
] as const;

export function StoreLinks({
  traxsourceUrl,
  bandcampUrl,
  className = "",
  iconClass = "w-[var(--px-22)] h-[var(--px-22)]",
}: StoreLinksProps) {
  const urls: Record<(typeof STORES)[number]["key"], string | null | undefined> = {
    traxsource: traxsourceUrl,
    bandcamp: bandcampUrl,
  };
  const present = STORES.filter((s) => urls[s.key]);
  if (present.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-[var(--px-6)] ${className}`.trim()}>
      {present.map((s) => (
        <a
          key={s.key}
          href={urls[s.key] ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Buy on ${s.label}`}
          title={`Buy on ${s.label}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center transition-all duration-150 hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.75)] hover:cursor-pointer"
        >
          <img src={s.icon} alt={s.label} draggable={false} className={iconClass} />
        </a>
      ))}
    </span>
  );
}

export default StoreLinks;
