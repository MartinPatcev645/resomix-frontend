import React from "react";
import { RxBadge } from "./RxBadge";

type RxSearchFieldProps = {
  label: string;
  searchModeLabel: string;
  searchModeValue: string;
  searchModeOptions: Array<{ value: string; label: string }>;
  placeholder: string;
  value?: string;
  status?: "default" | "loading" | "no-results" | "error";
  hint?: string;
  uploadLabel?: string;
  uploadState?: "default" | "drag-active" | "focus" | "error";
  onValueChange?: React.ChangeEventHandler<HTMLInputElement>;
  onSearchModeChange?: React.ChangeEventHandler<HTMLSelectElement>;
};

export function RxSearchField({
  label,
  searchModeLabel,
  searchModeValue,
  searchModeOptions,
  placeholder,
  value = "",
  status = "default",
  hint,
  uploadLabel,
  uploadState = "default",
  onValueChange,
  onSearchModeChange,
}: RxSearchFieldProps) {
  const inputId = React.useId();
  const selectId = React.useId();
  const hintId = React.useId();

  return (
    <div className="rx-stack">
      <div className="rx-field-row">
        <div className="rx-field-stack">
          <label className="rx-label" htmlFor={inputId}>
            {label}
          </label>
          <input
            id={inputId}
            className="rx-input"
            {...(onValueChange ? { value, onChange: onValueChange } : { defaultValue: value })}
            placeholder={placeholder}
            aria-describedby={hint || status !== "default" ? hintId : undefined}
          />
        </div>

        <div className="rx-field-stack">
          <label className="rx-label" htmlFor={selectId}>
            {searchModeLabel}
          </label>
          <select
            id={selectId}
            className="rx-select"
            {...(
              onSearchModeChange
                ? { value: searchModeValue, onChange: onSearchModeChange }
                : { defaultValue: searchModeValue }
            )}
          >
            {searchModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rx-field-status" id={hintId} aria-live="polite">
        {status === "loading" ? <RxBadge tone="accent">Loading results</RxBadge> : null}
        {status === "no-results" ? <RxBadge>No results for this specimen query</RxBadge> : null}
        {status === "error" ? <RxBadge tone="error">Preview unavailable in specimen state</RxBadge> : null}
        {hint ? <p className="rx-meta">{hint}</p> : null}
      </div>

      {uploadLabel ? (
        <div className="rx-stack">
          <div className="rx-label">{uploadLabel}</div>
          <div
            className="rx-dropzone rx-ticks"
            data-state={uploadState}
            tabIndex={0}
            role="group"
            aria-label={uploadLabel}
          >
            <div className="rx-stack">
              <p className="rx-body">Drop a reference file here or choose one locally.</p>
              <p className="rx-meta">WAV · AIFF · MP3 · FLAC · Max 50MB · Specimen only</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { RxSearchFieldProps };
