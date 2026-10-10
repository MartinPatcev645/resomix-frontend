import { useEffect, useId, useRef, type Ref } from "react";
import { PAGE_BTN_DANGER, PAGE_BTN_PRIMARY, PAGE_BTN_SECONDARY, PAGE_FIELD, PAGE_FIELD_LABEL } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import type { useBandcampCollection } from "../hooks/useBandcampCollection.ts";
import { COLLECTION_GRID, CollectionItemCard } from "./CollectionItemCard.tsx";
import { CollectionSkeleton } from "./CollectionSkeleton.tsx";
import { ErrorBody, StateNotice } from "./StateNotice.tsx";
import { errorCopyFor } from "../lib/errorCopy.ts";

interface CollectionViewProps {
  collection: ReturnType<typeof useBandcampCollection>;
  username: string | null;
  onDisconnectClick: () => void;
  onNotConnected: () => void;
  disconnectButtonRef: Ref<HTMLButtonElement>;
  headingRef: Ref<HTMLHeadingElement>;
}

export function CollectionView({
  collection,
  username,
  onDisconnectClick,
  onNotConnected,
  disconnectButtonRef,
  headingRef,
}: CollectionViewProps) {
  const searchId = useId();
  const listTopRef = useRef<HTMLDivElement>(null);
  const { data, loading, error, query, page, totalPages } = collection;

  // The connection disappeared underneath us (removed elsewhere): go back to the connect form.
  useEffect(() => {
    if (error?.kind === "not_connected") onNotConnected();
  }, [error, onNotConnected]);

  const changePage = (target: number) => {
    collection.goToPage(target);
    listTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const showSkeleton = loading;
  const showEmpty = !loading && !error && data !== null && data.total === 0;

  return (
    <section aria-labelledby="bandcamp-collection-title" className="flex flex-col gap-[var(--px-16)]">
      <div className="flex flex-col gap-[var(--px-6)] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="bandcamp-collection-title"
            ref={headingRef}
            tabIndex={-1}
            className="m-0 font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-primary)] focus:outline-none"
          >
            {BANDCAMP_COPY.collection.heading}
          </h2>
          {username ? (
            <p className="m-0 mt-[var(--px-4)] font-helvetica text-[length:var(--px-15)] font-light text-[var(--rx-color-text-secondary)]">
              {BANDCAMP_COPY.collection.connectedAs(username)}
            </p>
          ) : null}
        </div>
        <button ref={disconnectButtonRef} type="button" className={`${PAGE_BTN_DANGER} self-start sm:self-auto`} onClick={onDisconnectClick}>
          {BANDCAMP_COPY.disconnect.button}
        </button>
      </div>

      <div ref={listTopRef} className="flex w-full flex-col items-start gap-[var(--px-8)] scroll-mt-[var(--px-100)]">
        <label htmlFor={searchId} className={PAGE_FIELD_LABEL}>
          {BANDCAMP_COPY.collection.searchLabel}
        </label>
        <input
          id={searchId}
          type="search"
          value={collection.inputValue}
          onChange={(e) => collection.setInputValue(e.target.value)}
          placeholder={BANDCAMP_COPY.collection.searchPlaceholder}
          autoComplete="off"
          className={PAGE_FIELD}
        />
      </div>

      <p role="status" aria-live="polite" aria-atomic="true" className="m-0 font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]">
        {data && !loading && !error ? BANDCAMP_COPY.collection.count(data.total) : ""}
      </p>

      {error && error.kind !== "not_connected" ? (
        <StateNotice tone="error" urgent title={errorCopyFor(error.kind).title} body={<ErrorBody kind={error.kind} />}>
          <button type="button" className={PAGE_BTN_PRIMARY} onClick={collection.reload}>
            {BANDCAMP_COPY.collection.refresh}
          </button>
        </StateNotice>
      ) : showSkeleton ? (
        <div aria-busy="true">
          <CollectionSkeleton />
        </div>
      ) : showEmpty ? (
        query ? (
          <StateNotice title={BANDCAMP_COPY.collection.noResults(query)}>
            <button type="button" className={PAGE_BTN_SECONDARY} onClick={collection.clearSearch}>
              {BANDCAMP_COPY.collection.clearSearch}
            </button>
          </StateNotice>
        ) : (
          <StateNotice title={BANDCAMP_COPY.collection.empty}>
            <button type="button" className={PAGE_BTN_SECONDARY} onClick={collection.reload}>
              {BANDCAMP_COPY.collection.refresh}
            </button>
          </StateNotice>
        )
      ) : data ? (
        <ul className={`${COLLECTION_GRID} m-0 list-none p-0`}>
          {data.items.map((item) => (
            <li key={item.id} className="flex min-w-0">
              <CollectionItemCard item={item} />
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !error && data && totalPages > 1 ? (
        <nav aria-label={BANDCAMP_COPY.collection.pagesLabel} className="mt-[var(--px-14)] flex items-center justify-center gap-[var(--px-20)]">
          <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} className={PAGE_BTN_SECONDARY}>
            {BANDCAMP_COPY.collection.prev}
          </button>
          <span className="font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]">
            {BANDCAMP_COPY.collection.page(page, totalPages)}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)} className={PAGE_BTN_SECONDARY}>
            {BANDCAMP_COPY.collection.next}
          </button>
        </nav>
      ) : null}
    </section>
  );
}
