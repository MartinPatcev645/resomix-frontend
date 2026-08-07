interface Error404Props {
  baseUrl?: string;
  /** Mono kicker above the heading, e.g. "Error // 404". Kept generic for the reused states. */
  eyebrow?: string;
  title?: string;
  description?: string | React.ReactNode;
  buttonText?: string;
  /** While true, render only the page frame + a centered loader (no title/description/button). Lets a
   *  caller show this page's structure immediately (never a black screen) and reveal the real message
   *  once it knows the outcome. */
  loading?: boolean;
}

/**
 * Terminal-state page (404, private playlist) in the precision-industrial theme, so it reads as
 * part of the same product as the workspace: accent rule + mono kicker, large uppercase heading,
 * then a bordered panel carrying the message and the single action.
 *
 * Deliberately NOT drawing the dotted top frame outline — that belongs to the page frame
 * (SideLines / WebSideLines), which already draws it on every non-hero page.
 *
 * Styled with the shared --rx-* tokens rather than either app's local helper classes (ws-btn-*,
 * font-benzin), since this component renders in both the landing site and the webapp.
 */
export default function Error404({
  baseUrl = "https://resomix.com",
  eyebrow = "Error",
  title = "Page not found",
  description = "The page you are looking for does not exist.\nPlease check the URL or go back to the home page.",
  buttonText = "Go Back to Safety",
  loading = false,
}: Error404Props) {
  return (
    <div className="w-full pt-[var(--px-120)] pb-[var(--px-40)] text-[var(--rx-color-text-primary)]">
      <div className="mx-auto w-full max-w-[var(--px-650)] px-[var(--px-20)]">
        {loading ? (
          <div
            className="flex min-h-[var(--px-220)] items-center justify-center"
            role="status"
            aria-label="Loading"
          >
            <span className="inline-block h-[var(--px-32)] w-[var(--px-32)] animate-spin rounded-full border-2 border-[var(--rx-color-border-subtle)] border-t-[var(--rx-color-accent)]" />
          </div>
        ) : (
          <>
            <p className="mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-32)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
              {eyebrow}
            </p>

            <h1 className="m-0 font-helvetica text-[length:var(--px-28)] font-medium uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
              {title}
            </h1>

            {/* Message + action in a bordered panel with the accent tick, same chrome as the
                workspace panels. */}
            <div className="relative mt-[var(--px-24)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-22)] before:absolute before:left-[var(--px-24)] before:top-0 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
              <div className="px-[var(--px-16)] py-[var(--px-8)] text-center">
                <p className="mb-[var(--px-20)] whitespace-pre-line font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)] opacity-80">
                  {description}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = baseUrl;
                  }}
                  className="inline-flex min-h-[var(--px-44)] cursor-pointer items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-accent)] bg-[var(--rx-color-accent)] px-[var(--px-22)] font-fira text-[length:var(--px-11)] font-semibold uppercase tracking-[var(--px-1)] text-[#050505] transition-[background-color,border-color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)] hover:border-[var(--rx-color-accent-hover)] hover:bg-[var(--rx-color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rx-color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rx-color-surface)]"
                >
                  {buttonText}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
