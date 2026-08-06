import { useEffect, useState } from "react";
import { onQuotaDenied, type QuotaDenial } from "@resomix/api-client";
import { quotaDenialCopy, type QuotaCopy } from "./quotaCopy";

/**
 * The most recent quota denial, resolved to display copy (pricing v2.1, E2).
 *
 * Subscribes to every 402 the API returns, so a metered endpoint gets the right upgrade modal
 * without its call site knowing anything about quotas. Mount the consumer **once**, near the app
 * root — two mounted consumers would stack two identical modals over one denial.
 *
 * A denial the resolver does not recognise is dropped rather than shown. An unknown code means we
 * cannot say anything true about it, and the call site is still surfacing the server's own error
 * message — so silence here leaves the user informed, while a guessed modal would talk over that
 * with something possibly wrong.
 */
export interface UseQuotaDenial {
  /** Copy for the current denial, or null when there is nothing to show. */
  copy: QuotaCopy | null;
  /** The raw denial, for callers that want the numbers. */
  denial: QuotaDenial | null;
  /** Dismiss the current denial. */
  clear: () => void;
}

export function useQuotaDenial(): UseQuotaDenial {
  const [denial, setDenial] = useState<QuotaDenial | null>(null);

  useEffect(() => {
    return onQuotaDenied((next) => {
      // Resolve before storing: an unrecognised denial must not clear a modal that is currently
      // showing something we DID understand.
      if (quotaDenialCopy(next)) setDenial(next);
    });
  }, []);

  return {
    copy: quotaDenialCopy(denial),
    denial,
    clear: () => setDenial(null),
  };
}
