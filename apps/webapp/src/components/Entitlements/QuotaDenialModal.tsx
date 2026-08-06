import React from "react";
import { useQuotaDenial } from "@resomix/hooks";
import { GateCtaModal } from "./GateCtaModal.tsx";

/**
 * QuotaDenialModal — the upgrade prompt for a server 402 (pricing v2.1, E2).
 *
 * Mounted **once**, at the app root, and driven by the API layer rather than by any call site: a
 * 402 anywhere resolves to the right copy and opens this. That is deliberate — every metered
 * endpoint would otherwise need its own modal wiring, and the next one added would silently ship
 * without any.
 *
 * Distinct from the pre-emptive `GateCtaModal` call sites, which fire on the CLIENT's `useAccess`
 * verdict *before* a request. Those prevent a doomed request; this one answers a refusal that
 * already happened, and is the only path that can quote real numbers — the server resolved the
 * plan when it decided to refuse.
 *
 * Renders the same `GateCtaModal` shell so a quota refusal looks like every other gate in the app,
 * only with copy built from the denial.
 */
export const QuotaDenialModal: React.FC = () => {
  const { copy, clear } = useQuotaDenial();

  if (!copy) return null;

  return <GateCtaModal reason={copy.reason} title={copy.title} body={copy.body} onClose={clear} />;
};

export default QuotaDenialModal;
