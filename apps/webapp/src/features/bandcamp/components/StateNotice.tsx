import React, { forwardRef } from "react";
import { PAGE_KICKER, PAGE_PANEL } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import type { BandcampErrorKind } from "../api/types.ts";
import { errorCopyFor } from "../lib/errorCopy.ts";

interface StateNoticeProps {
  title: string;
  body?: React.ReactNode;
  tone?: "neutral" | "error";
  /** Announce immediately (errors) rather than politely (empty states). */
  urgent?: boolean;
  children?: React.ReactNode;
}

/** One designed block for every empty / error state on the page. */
export const StateNotice = forwardRef<HTMLDivElement, StateNoticeProps>(function StateNotice(
  { title, body, tone = "neutral", urgent = false, children },
  ref,
) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={urgent ? "alert" : "status"}
      className={`${PAGE_PANEL} flex flex-col gap-[var(--px-10)] focus:outline-none ${
        tone === "error" ? "border-[rgba(255,118,96,0.42)]" : ""
      }`}
    >
      <p className={`${PAGE_KICKER} ${tone === "error" ? "text-[var(--rx-color-error)]" : ""}`}>{title}</p>
      {body ? (
        <div className="font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)]">
          {body}
        </div>
      ) : null}
      {children ? <div className="mt-[var(--px-4)] flex flex-wrap gap-[var(--px-10)]">{children}</div> : null}
    </div>
  );
});

/** Body for an API error, including the "make it public" steps for a private collection. */
export function ErrorBody({ kind }: { kind: BandcampErrorKind }) {
  if (kind === "private") {
    const copy = BANDCAMP_COPY.errors.private;
    return (
      <>
        <p className="m-0">{copy.body}</p>
        <ol className="mt-[var(--px-8)] mb-0 flex list-decimal flex-col gap-[var(--px-4)] pl-[var(--px-20)]">
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </>
    );
  }
  return <p className="m-0">{errorCopyFor(kind).body}</p>;
}
