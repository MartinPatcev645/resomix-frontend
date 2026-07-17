import { ButtonSleek } from "../index";

interface Error404Props {
  baseUrl?: string;
  title?: string;
  description?: string | React.ReactNode;
  buttonText?: string;
  /** While true, render only the page frame + a centered loader (no title/description/button). Lets a
   *  caller show this page's structure immediately (never a black screen) and reveal the real message
   *  once it knows the outcome. */
  loading?: boolean;
}

export default function Error404({
  baseUrl = "https://resomix.com",
  title = "Page not found",
  description = "The page you are looking for does not exist.\nPlease check the URL or go back to the home page.",
  buttonText = "Go Back to Safety",
  loading = false,
}: Error404Props) {
  return (
    <div className="w-full flex flex-col items-center text-[var(--color-primary)] pt-[var(--px-120)] relative">
      {/* Top frame outline SVG shown always */}
      <div className="hidden lg:block absolute left-0 top-[var(--px-0-25)] w-full h-[length:var(--px-628)] pointer-events-none z-10">
        <svg
          viewBox="0 0 1152 628"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <path
            d="M0.333008 1.07413H279.222L347.74 40.6333H779.963L848.481 1.07413H1152"
            stroke="#eceaeaff"
            strokeOpacity="1"
            strokeWidth="1"
            strokeDasharray="0.74 0.74"
            fill="none"
          />
        </svg>
      </div>
      <div className="max-w-[var(--px-650)] p-[var(--px-20)]">
        <div className="flex flex-col items-center w-full gap-[var(--px-20)]">
          {loading ? (
            <div className="min-h-[var(--px-220)] flex items-center justify-center" role="status" aria-label="Loading">
              <span className="inline-block w-[var(--px-32)] h-[var(--px-32)] rounded-full border-2 border-[var(--color-primary)]/25 border-t-[var(--color-primary)] animate-spin" />
            </div>
          ) : (
            <>
              <svg className="w-[var(--px-35)] h-[var(--px-35)]" viewBox="0 0 19 19" fill="none">
                <path d="M17.8337 17.8333L1.16699 1.16667M17.8337 1.16667L1.16699 17.8333" stroke="white" stroke-linecap="round" stroke-linejoin="round" />
              </svg>

              <div className="text-center text-[length:var(--px-19)] font-semibold font-helvetica leading-[var(--px-23)] uppercase">
                {title}
              </div>
              <div className="text-center text-[length:var(--px-11)] font-light font-fira leading-[var(--px-18)] mb-[var(--px-20)] whitespace-pre-line">
                {description}
              </div>
              <ButtonSleek text={buttonText} onClick={() => { window.location.href = baseUrl; }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
