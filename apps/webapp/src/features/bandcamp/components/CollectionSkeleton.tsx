import { COLLECTION_GRID } from "./CollectionItemCard.tsx";

const PULSE = "animate-pulse bg-[rgba(255,255,255,0.06)] motion-reduce:animate-none";

export function CollectionSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className={COLLECTION_GRID} data-testid="bandcamp-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-[var(--px-12)] border border-[var(--rx-color-border-subtle)] p-[var(--px-12)]">
          <div className="flex gap-[var(--px-12)] sm:flex-col">
            <div className={`${PULSE} aspect-square w-[var(--px-80)] shrink-0 sm:w-full`} />
            <div className="flex min-w-0 flex-1 flex-col gap-[var(--px-8)]">
              <div className={`${PULSE} h-[var(--px-20)] w-1/2`} />
              <div className={`${PULSE} h-[var(--px-14)] w-3/4`} />
              <div className={`${PULSE} h-[var(--px-14)] w-2/5`} />
            </div>
          </div>
          <div className="flex gap-[var(--px-8)]">
            <div className={`${PULSE} h-[var(--px-36)] flex-1`} />
            <div className={`${PULSE} h-[var(--px-36)] flex-1`} />
          </div>
        </div>
      ))}
    </div>
  );
}
