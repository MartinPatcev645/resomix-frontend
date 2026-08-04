interface DemoStageBannerProps {
  onDismiss: () => void;
  /** Where the "contact page" link points. Relative "/contact" works per-origin in both apps. */
  contactUrl?: string;
}

export const DemoStageBanner: React.FC<DemoStageBannerProps> = ({ onDismiss, contactUrl = "/contact" }) => {
  return (
    // z-40, not z-10: both apps render this banner OUTSIDE the page shell, and that shell is
    // `relative z-30` — which makes it a stacking context. Marketing pages hang their void-field
    // backdrop (`position: fixed; inset: 0`) inside it, so although those layers set z-index:-3
    // they still paint at 30 — i.e. over this banner — washing the text out to grey, or hiding it
    // completely on the darker pages. Anything that must cover the banner (drawer 70, modals 120+)
    // is still comfortably above.
    /* data-demo-banner is the hook for the no-flash rule in landing's index.html: that app
       prerenders its pages, so this banner ships inside the HTML and paints before React runs.
       A visitor who already dismissed it would otherwise watch it sit there until hydration
       removed it. The inline head script hides it from the same localStorage flag, before the
       first paint; React then unmounts it for real. */
    <div data-demo-banner className="w-full bg-[var(--color-secondary)] border-l-4 border-[var(--color-primary)] p-[var(--px-12)] mb-[var(--px-20)] flex items-start justify-between gap-[var(--px-10)] relative z-40">
      <div className="flex items-start gap-[var(--px-10)] flex-1">
        <span className="text-[var(--color-primary)] text-[length:var(--px-18)] flex-shrink-0 mt-[var(--px-2)]">
          ⚠
        </span>
        <div className="flex-1">
          <p className="text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-light font-helvetica text-[var(--color-text-secondary)] uppercase tracking-[var(--px-0-2)]">
            Beta Stage Notice
          </p>
          <p className="text-[length:var(--px-11)] lg:text-[length:var(--px-9)] font-light font-fira text-[var(--color-text-secondary)] mt-[var(--px-6)] leading-[var(--px-14)]">
            Resomix is currently in beta. You may encounter bugs or incomplete features while we continue improving the sonic discovery experience. If you find an issue, please report it through our{" "}
            <a
              href={contactUrl}
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer underline underline-offset-2"
            >
              contact page
            </a>.
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
  );
};

