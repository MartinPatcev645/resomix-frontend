import React from "react";
import type { SearchResult } from "@resomix/hooks";
import { displayArtistOrOmit, sanitizeWorkspaceTitle } from "@/utils/trackUtils.ts";
import {
  EMPTY_SEARCH_OUTCOME,
  EXAMPLE_REFERENCES_LABEL,
  TRY_EXAMPLE_ACTION,
  TRY_EXAMPLE_HINT,
} from "./workspaceCopy.ts";

interface DiscoveryEmptyGuideProps {
  examples: SearchResult[];
  onTryExample: () => void;
  onSelectExample: (track: SearchResult) => void;
}

const OUTCOME_ARIA =
  "One reference track enters and Resomix returns a ranked shortlist you can audition — explanatory illustration, not real results";

/** Two-zone empty state: outcome visual (left) + verified example references (right). */
export const DiscoveryEmptyGuide: React.FC<DiscoveryEmptyGuideProps> = ({
  examples,
  onTryExample,
  onSelectExample,
}) => {
  const chips = examples.slice(0, 5);

  return (
    <div className="-mx-[var(--px-22)] mt-[var(--px-8)] grid grid-cols-1 max-[1023px]:gap-0 min-[1024px]:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
      <div className="relative border-b border-dotted border-[rgba(255,255,255,.09)] px-[var(--px-24)] pb-[var(--px-28)] pt-[var(--px-16)] max-[640px]:px-[var(--px-16)] min-[1024px]:border-b-0 min-[1024px]:border-r min-[1024px]:pr-[var(--px-32)] min-[1024px]:pl-[var(--px-24)]">
        <p className="mb-[var(--px-20)] max-w-[34rem] text-[length:var(--px-16)] font-helvetica font-light leading-[var(--px-24)] text-[#d4d4d4]">
          {EMPTY_SEARCH_OUTCOME}
        </p>
        <div
          className="text-[rgba(255,255,255,.55)]"
          role="img"
          aria-label={OUTCOME_ARIA}
        >
          <svg
            className="hidden w-full max-[640px]:hidden min-[641px]:block"
            viewBox="0 0 640 168"
            aria-hidden="true"
          >
            <g
              style={{
                stroke: "rgba(255,255,255,.55)",
                fill: "none",
                strokeWidth: 1.5,
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            >
              <path d="M16 84 l11-9 8 15 10-22 10 26 8-19 8 10 7-5 7 6 H120" />
            </g>
            <circle
              className="motion-safe:animate-[sd-pulse_2.6s_ease-in-out_infinite]"
              cx="126"
              cy="84"
              r="4"
              style={{ fill: "#EE4A26" }}
            />
            <path
              className="motion-safe:animate-[sd-dash_9s_linear_infinite]"
              d="M126 84 C 220 84 260 84 352 84"
              style={{
                stroke: "rgba(238,74,38,.8)",
                fill: "none",
                strokeWidth: 1.8,
                strokeDasharray: "5 7",
              }}
            />
            <path
              d="M352 84 C 388 84 396 40 428 38 M352 84 H428 M352 84 C 388 84 396 128 428 130"
              style={{ stroke: "rgba(238,74,38,.45)", fill: "none", strokeWidth: 1.2 }}
            />
            <g style={{ stroke: "rgba(255,255,255,.7)", fill: "none", strokeWidth: 1.3 }}>
              <rect x="432" y="24" width="188" height="28" />
            </g>
            <g style={{ stroke: "rgba(255,255,255,.3)", fill: "none", strokeWidth: 1.2 }}>
              <rect x="432" y="70" width="160" height="28" />
              <rect x="432" y="116" width="132" height="28" />
            </g>
            <g style={{ fill: "rgba(255,255,255,.35)" }}>
              <circle cx="446" cy="38" r="2.2" />
              <circle cx="446" cy="84" r="2.2" />
              <circle cx="446" cy="130" r="2.2" />
            </g>
          </svg>
          <svg className="block w-full min-[641px]:hidden" viewBox="0 0 358 190" aria-hidden="true">
            <g
              style={{
                stroke: "rgba(255,255,255,.55)",
                fill: "none",
                strokeWidth: 1.4,
                strokeLinecap: "round",
                strokeLinejoin: "round",
              }}
            >
              <path d="M24 30 l10-8 8 13 9-19 9 22 8-16 7 8 7-4 8 5 H310" />
            </g>
            <circle
              className="motion-safe:animate-[sd-pulse_2.6s_ease-in-out_infinite]"
              cx="24"
              cy="30"
              r="3.5"
              style={{ fill: "#EE4A26" }}
            />
            <path
              className="motion-safe:animate-[sd-dash_9s_linear_infinite]"
              d="M24 30 V96"
              style={{
                stroke: "rgba(238,74,38,.8)",
                fill: "none",
                strokeWidth: 1.8,
                strokeDasharray: "5 7",
              }}
            />
            <path
              d="M24 96 C 24 110 40 112 52 112 M24 96 C 24 128 40 142 52 142 M24 96 C 24 158 40 172 52 172"
              style={{ stroke: "rgba(238,74,38,.45)", fill: "none", strokeWidth: 1.2 }}
            />
            <g style={{ stroke: "rgba(255,255,255,.7)", fill: "none", strokeWidth: 1.3 }}>
              <rect x="58" y="99" width="252" height="26" />
            </g>
            <g style={{ stroke: "rgba(255,255,255,.3)", fill: "none", strokeWidth: 1.2 }}>
              <rect x="58" y="129" width="216" height="26" />
              <rect x="58" y="159" width="180" height="26" />
            </g>
          </svg>
          <div
            aria-hidden="true"
            className="mt-[var(--px-8)] grid grid-cols-[auto_1fr_auto] gap-[var(--px-16)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[rgba(255,255,255,.55)] max-[640px]:text-[length:var(--px-10-5)]"
          >
            <span>Reference</span>
            <span />
            <span className="text-[#d8d8d8]">Ranked shortlist</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[var(--px-14)] px-[var(--px-24)] pb-[var(--px-28)] pt-[var(--px-16)] max-[640px]:px-[var(--px-16)] min-[1024px]:pl-[var(--px-28)] min-[1024px]:pr-[var(--px-24)]">
        <p className="m-0 text-[length:var(--px-15)] font-helvetica font-light text-[var(--color-primary)] opacity-75">
          {TRY_EXAMPLE_HINT}
          <button
            type="button"
            className="ml-[var(--px-6)] border-b border-dotted border-[rgba(238,74,38,.5)] pb-[var(--px-2)] font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-1)] text-[var(--color-accent,#EE4A26)] hover:border-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
            onClick={onTryExample}
          >
            {TRY_EXAMPLE_ACTION}
          </button>
        </p>
        <span className="font-fira text-[length:var(--px-10-5)] uppercase tracking-[var(--px-2)] text-[rgba(255,255,255,.55)]">
          {EXAMPLE_REFERENCES_LABEL}
        </span>
        {chips.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-[var(--px-8)] p-0">
            {chips.map((track) => {
              const artist = displayArtistOrOmit(track.artist);
              const title = sanitizeWorkspaceTitle(track.title);
              const label = artist ? `${artist} — ${title}` : title;
              return (
                <li key={String(track.id)}>
                  <button
                    type="button"
                    onClick={() => onSelectExample(track)}
                    className="group flex w-full min-h-[var(--px-44)] items-center gap-[var(--px-12)] border border-[rgba(255,255,255,.14)] bg-[rgba(255,255,255,.015)] px-[var(--px-14)] py-[var(--px-9)] text-left text-[length:var(--px-14)] font-helvetica font-light leading-[var(--px-20)] text-[rgba(255,255,255,.7)] transition-colors hover:border-[rgba(238,74,38,.55)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
                  >
                    <i
                      aria-hidden="true"
                      className="block h-[var(--px-7)] w-[var(--px-7)] shrink-0 rounded-full border border-[rgba(255,255,255,.55)] not-italic group-hover:border-[var(--color-accent,#EE4A26)]"
                    />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {track.duration && (
                      <span className="shrink-0 font-fira text-[length:var(--px-11)] tabular-nums text-[rgba(255,255,255,.4)] group-hover:text-[rgba(238,74,38,.75)]">
                        {track.duration}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
