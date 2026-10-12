import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getBandcampCollection, mapError } from "../api/bandcampApi.ts";
import type { BandcampApiError, BandcampCollectionPage } from "../api/types.ts";
import { useDebouncedValue } from "./useDebouncedValue.ts";

export const COLLECTION_PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

function readPage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * Collection list state. `q` and `page` live in the URL so Back and shared links work; the search
 * box writes to the URL only after the user pauses typing.
 */
export function useBandcampCollection({ enabled }: { enabled: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const page = readPage(searchParams.get("page"));
  const matchedOnly = searchParams.get("matched") === "true";

  const [inputValue, setInputValue] = useState(urlQuery);
  const debouncedInput = useDebouncedValue(inputValue, SEARCH_DEBOUNCE_MS);

  const [data, setData] = useState<BandcampCollectionPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BandcampApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const updateParams = useCallback(
    (mutate: (next: URLSearchParams) => void, replace = true) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  // Back/forward changed the URL underneath the box: follow it.
  useEffect(() => {
    if (urlQuery !== debouncedInput.trim()) setInputValue(urlQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only an external URL change should sync the box
  }, [urlQuery]);

  useEffect(() => {
    const q = debouncedInput.trim();
    if (q === urlQuery) return;
    updateParams((next) => {
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the debounced text settles
  }, [debouncedInput]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getBandcampCollection({ page, pageSize: COLLECTION_PAGE_SIZE, q: urlQuery, matched: matchedOnly }, controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((raw) => {
        const err = mapError(raw, "collection");
        if (err.kind === "aborted") return;
        setError(err);
        setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, page, urlQuery, matchedOnly, reloadToken]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // A deep link past the end (or a list that shrank) lands on the last real page.
  useEffect(() => {
    if (data && !loading && data.total > 0 && page > totalPages) {
      updateParams((next) => next.set("page", String(totalPages)));
    }
  }, [data, loading, page, totalPages, updateParams]);

  const goToPage = useCallback(
    (target: number) => {
      updateParams((next) => {
        if (target <= 1) next.delete("page");
        else next.set("page", String(target));
      }, false);
    },
    [updateParams],
  );

  const clearSearch = useCallback(() => {
    setInputValue("");
    updateParams((next) => {
      next.delete("q");
      next.delete("page");
    });
  }, [updateParams]);

  const setMatchedOnly = useCallback(
    (on: boolean) => {
      updateParams((next) => {
        if (on) next.set("matched", "true");
        else next.delete("matched");
        next.delete("page");
      });
    },
    [updateParams],
  );

  const clearBrowseState = useCallback(() => {
    setInputValue("");
    updateParams((next) => {
      next.delete("q");
      next.delete("page");
      next.delete("matched");
    });
  }, [updateParams]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return {
    inputValue,
    setInputValue,
    query: urlQuery,
    matchedOnly,
    setMatchedOnly,
    page,
    totalPages,
    goToPage,
    clearSearch,
    clearBrowseState,
    data,
    loading,
    error,
    reload,
  };
}
