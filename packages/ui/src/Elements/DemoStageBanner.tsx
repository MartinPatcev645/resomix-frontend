interface DemoStageBannerProps {
  onDismiss: () => void;
}

export const DemoStageBanner: React.FC<DemoStageBannerProps> = ({ onDismiss }) => {
  return (
    <div className="w-full bg-[var(--color-secondary)] border-l-4 border-[var(--color-primary)] p-[var(--px-12)] mb-[var(--px-20)] flex items-start justify-between gap-[var(--px-10)] relative z-10">
      <div className="flex items-start gap-[var(--px-10)] flex-1">
        <span className="text-[var(--color-primary)] text-[length:var(--px-18)] flex-shrink-0 mt-[var(--px-2)]">
          ⚠
        </span>
        <div className="flex-1">
          <p className="text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-light font-helvetica text-[var(--color-text-secondary)] uppercase tracking-[var(--px-0-2)]">
            Demo Stage Notice
          </p>
          <p className="text-[length:var(--px-11)] lg:text-[length:var(--px-9)] font-light font-fira text-[var(--color-text-secondary)] mt-[var(--px-6)] leading-[var(--px-14)]">
            Resomix is open exclusively for evaluation and feedback at this time. Playback, downloading, sales, and public streaming are not available right now. We are working to build licensing partnerships with rightsholders.
          </p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-[length:var(--px-14)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors ml-[var(--px-8)] flex-shrink-0"
        aria-label="Dismiss demo stage notice"
      >
        ✕
      </button>
    </div>
  );
};

