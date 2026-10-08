interface DemoStageBannerProps {
  onDismiss: () => void
  contactUrl?: string
}

/** Port of packages/ui DemoStageBanner. Markup and copy must stay identical to the live site. */
export function DemoStageBanner({ onDismiss, contactUrl = '/contact' }: DemoStageBannerProps) {
  return (
    // z-40: rendered outside the `relative z-30` page shell, whose fixed void-field backdrop would
    // otherwise paint over it. data-demo-banner is the hook for the no-flash rule in the root layout.
    <div
      data-demo-banner
      className="w-full bg-[var(--color-secondary)] border-l-4 border-[var(--color-primary)] p-[var(--px-12)] mb-[var(--px-20)] flex items-start justify-between gap-[var(--px-10)] relative z-40"
    >
      <div className="flex items-start gap-[var(--px-10)] flex-1">
        <span className="text-[var(--color-primary)] text-[length:var(--px-18)] flex-shrink-0 mt-[var(--px-2)]">
          ⚠
        </span>
        <div className="flex-1">
          <p className="text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-light font-helvetica text-[var(--color-text-secondary)] uppercase tracking-[var(--px-0-2)]">
            Beta Stage Notice
          </p>
          <p className="text-[length:var(--px-11)] lg:text-[length:var(--px-9)] font-light font-fira text-[var(--color-text-secondary)] mt-[var(--px-6)] leading-[var(--px-14)]">
            Resomix is a sound-first music discovery and track analysis platform, currently in beta. You may
            encounter bugs or incomplete features while we keep improving it. If you find an issue, please report it
            through our{' '}
            <a
              href={contactUrl}
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer underline underline-offset-2"
            >
              contact page
            </a>
            .
          </p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-[length:var(--px-14)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors ml-[var(--px-8)] flex-shrink-0"
        aria-label="Dismiss beta stage notice"
      >
        ✕
      </button>
    </div>
  )
}
