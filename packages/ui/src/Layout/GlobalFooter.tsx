import React from "react";
import { CodeTyping, fetchGenerationTime } from "../index";
import { useConfig } from "@resomix/stores";

// Add a prop for the LogoRFooter and base URL
interface GlobalFooterProps {
  logo: React.ReactNode;
  baseUrl?: string;
  onNavigate?: (path: string) => void;
}

const GlobalFooter: React.FC<GlobalFooterProps> = ({ logo, baseUrl = "https://resomix.com", onNavigate }) => {
  const version = useConfig((s) => s.version);

  // Computed ONCE per mount, not per render.
  //
  // `fetchGenerationTime()` is randomised, so calling it inline in the JSX produced a different
  // string on every render. `CodeTyping` restarts its animation whenever `text` changes — it calls
  // `setDisplay("")` and types again from scratch — so every unrelated re-render of the footer made
  // this line visibly erase and retype itself, settling only once re-renders stopped. The two
  // sibling `CodeTyping` blocks have literal text, which is why only this one misbehaved.
  const generationTime = React.useMemo(() => fetchGenerationTime(), []);

  return (
    <footer className="mt-[var(--px-150)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
      {/*
        Full-bleed headline. Only the FONT-SIZE is made viewport-based (inline so the webapp's
        root-font-size cap — George's 4230874, html capped at 16px above 1280px — can't freeze it):
        clamp(50.4px,4.921875vw,126px) is exactly what `--px-63` resolves to with the *uncapped* root,
        i.e. 63px @ 1280px, scaling with the viewport up to the 2560px content cap.
        `-left`/`min-w` deliberately stay `--px-63`/`--px-1280`: `-left-[--px-63]` cancels the
        `mx-[--px-63]` side margin in WebSideLines so the title's left edge lands exactly on the
        content-box edge. (Making `-left` a vw over-compensated that fixed margin and pushed the "J"
        off-screen with a growing right gap on wide viewports.)
      */}
      <div
        aria-hidden="true"
        className="absolute -left-[var(--px-63)] top-[var(--px-180)] min-w-[var(--px-1280)] font-benzin uppercase whitespace-nowrap"
        style={{ fontSize: "clamp(50.4px, 4.921875vw, 126px)" }}
      >
        Join the Resomix Universe
      </div>
      <div className="flex flex-col gap-[var(--px-130)]">
        <div className="flex flex-col px-[var(--px-65)] min-h-[var(--px-129)]">
          <div className="flex w-full justify-start">
            <a
              href={baseUrl}
              aria-label="Resomix home"
              className="cursor-default footer-logo-link"
              id="footer-logo-link"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(baseUrl);
                }
              }}
            >
              {logo}
            </a>
          </div>
          <div className="flex justify-between">
            <div className="flex flex-col text-[length:var(--px-10)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
              <div className="leading-[var(--px-40)]">
                <CodeTyping
                  speed={50}
                  text="// ──────[ resomix &gt; footer_terminal ]──────"
                />
              </div>
              <div className="leading-[var(--px-12)]">
                <CodeTyping
                  speed={50}
                  text={`company_name: Resomix<br />status: online [✓]<br />version: ${version}`}
                  multiline={true}
                />
              </div>
              <div className="leading-[var(--px-12)] mt-[var(--px-20)]">
                <CodeTyping
                  speed={120}
                  text={`contact@email: support@resomix.com<br />HQ_coords: RA 0h 42m 44s | Dec +41° 16′ 9″ // Andromeda<br />address: resomix.com`}
                  multiline={true}
                />
              </div>
            </div>
            <div className="flex flex-col text-[length:var(--px-10)] text-right font-light font-fira opacity-50 tracking-[var(--px-2)] items-end">
              <div className="leading-[var(--px-12)]">
                <CodeTyping
                  speed={50}
                  text={`upload_protocol: SSL 256-bit // encrypted<br />system_uptime: 99.97%<br />last_waveform_uploaded: ${generationTime} ago`}
                  multiline={true}
                />
              </div>

              <div className="leading-[var(--px-12)] mt-[var(--px-57)]">
                <CodeTyping
                  speed={100}
                  text="PYXIS-1 Sonic Analysis Engine: v5.3.9<br />latency: zero-latency-mode = active<br />data_nodes: [New York] [London] [Singapore]"
                  multiline={true}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between px-[var(--px-65)]">
          <div className="flex flex-col text-[length:var(--px-10)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
            <CodeTyping
              speed={50}
              text="© 2026 Resomix // Beta Stage"
              multiline={true}
            />
          </div>
          <div className="flex flex-col text-[length:var(--px-10)] text-right font-light font-fira tracking-[var(--px-2)] items-end">
            <a
              href="https://legal.resomix.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Resomix legal information"
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link"
              id="footer-legal-link"
            >
              legal.info(): open('/legal')
            </a>
            <a
              href="https://support.resomix.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Resomix support"
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link"
              id="footer-support-link"
            >
              support.to(): open('/support')
            </a>
            <br />
            <a
              href={`${baseUrl}/contact`}
              aria-label="Resomix contact"
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link"
              id="footer-contact-link"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(`${baseUrl}/contact`);
                }
              }}
            >
              contact_us(): fetch('/contact')
            </a>
            <button
              className="inline-flex min-h-[var(--px-24)] items-center justify-end px-[var(--px-8)] py-[var(--px-2)] hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity footer-link cursor-pointer text-right"
              onClick={(e) => {
                e.preventDefault();
                const silktideIcon = document.querySelector('#stcm-icon') as HTMLElement;
                if (silktideIcon) {
                  silktideIcon.click();
                }
              }}
            >
              privacy.preferences(): open('/cookies')
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default GlobalFooter;
