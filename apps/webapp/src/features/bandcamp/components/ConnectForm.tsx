import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { PAGE_FIELD, PAGE_FIELD_LABEL, PAGE_PANEL, RxButton } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import { parseBandcampUsername } from "../lib/parseUsername.ts";
import type { BandcampApiError } from "../api/types.ts";
import { ErrorBody, StateNotice } from "./StateNotice.tsx";
import { errorCopyFor } from "../lib/errorCopy.ts";

export interface ConnectFormHandle {
  focus: () => void;
}

interface ConnectFormProps {
  onConnect: (username: string) => Promise<boolean>;
  submitting: boolean;
  apiError: BandcampApiError | null;
  initialValue?: string;
}

export const ConnectForm = forwardRef<ConnectFormHandle, ConnectFormProps>(function ConnectForm(
  { onConnect, submitting, apiError, initialValue = "" },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [parseError, setParseError] = useState<string | null>(null);
  const ids = { input: useId(), hint: useId(), note: useId(), error: useId() };

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  // A failed request sends focus back to the field so the user can correct it straight away.
  useEffect(() => {
    if (apiError) inputRef.current?.focus();
  }, [apiError]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const parsed = parseBandcampUsername(value);
    if (!parsed.ok) {
      setParseError(BANDCAMP_COPY.parse[parsed.reason]);
      inputRef.current?.focus();
      return;
    }
    setParseError(null);
    setValue(parsed.username);
    await onConnect(parsed.username);
  };

  const describedBy = [ids.hint, ids.note, parseError ? ids.error : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-[var(--px-16)]">
      <form onSubmit={handleSubmit} noValidate className={`${PAGE_PANEL} flex flex-col gap-[var(--px-14)]`}>
        <div className="flex w-full flex-col items-start gap-[var(--px-8)]">
          <label htmlFor={ids.input} className={PAGE_FIELD_LABEL}>
            {BANDCAMP_COPY.connect.label}
          </label>
          <div className="flex w-full flex-col gap-[var(--px-10)] sm:flex-row">
            <input
              ref={inputRef}
              id={ids.input}
              name="bandcamp-username"
              type="text"
              inputMode="url"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (parseError) setParseError(null);
              }}
              placeholder={BANDCAMP_COPY.connect.placeholder}
              readOnly={submitting}
              aria-invalid={parseError ? true : undefined}
              aria-describedby={describedBy}
              className={`${PAGE_FIELD} sm:flex-1 ${parseError ? "!border-[var(--rx-color-error)]" : ""}`}
            />
            <RxButton type="submit" variant="primary" loading={submitting} className="sm:min-w-[var(--px-140)]">
              {submitting ? BANDCAMP_COPY.connect.submitting : BANDCAMP_COPY.connect.submit}
            </RxButton>
          </div>
          <p id={ids.hint} className="m-0 font-helvetica text-[length:var(--px-13)] font-light text-[var(--rx-color-text-secondary)]">
            {BANDCAMP_COPY.connect.hint}
          </p>
          {parseError ? (
            <p
              id={ids.error}
              role="alert"
              className="m-0 font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]"
            >
              {parseError}
            </p>
          ) : null}
        </div>
        <p
          id={ids.note}
          className="m-0 border-t border-[var(--rx-color-border-subtle)] pt-[var(--px-12)] font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)]"
        >
          {BANDCAMP_COPY.connect.note}
        </p>
      </form>

      {apiError ? (
        <StateNotice tone="error" urgent title={errorCopyFor(apiError.kind).title} body={<ErrorBody kind={apiError.kind} />} />
      ) : null}
    </div>
  );
});
