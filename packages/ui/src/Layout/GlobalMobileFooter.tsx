import React from "react";
import { CodeTyping } from "../index";
import { useConfig } from "@resomix/stores";

interface GlobalMobileFooterProps {
  logo: React.ReactNode;
  baseUrl?: string;
  onNavigate?: (path: string) => void;
}

const GlobalMobileFooter: React.FC<GlobalMobileFooterProps> = ({ logo, baseUrl = "https://resomix.com", onNavigate }) => {
  const version = useConfig((s) => s.version);

  return (
    <footer className="mt-[var(--px-250)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
      <div className="flex flex-col w-full">
        <div className="absolute -left-[var(--px-20)] -top-[var(--px-80)] w-[var(--px-393)] text-[length:var(--px-30)] font-benzin uppercase leading-[var(--px-40)]">
          Join the Resomix<br />Universe
        </div>
        <div className="flex flex-col items-start px-[var(--px-10)] min-h-[var(--px-129)] mt-[var(--px-40)]">
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
            <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)] leading-[var(--px-16)]">
              <div className="my-[var(--px-14)]">
                <CodeTyping
                  speed={50}
                  text="// ──────[ resomix &gt;<br />footer_terminal ]──────"
                  multiline={true}
                />
              </div>
              <div>
                <CodeTyping
                  speed={50}
                  text={`company_name: Resomix Inc.<br />status: online [✓]<br />version: ${version}`}
                  multiline={true}
                />
              </div>
              <div className="mt-[var(--px-20)]">
                <CodeTyping
                  speed={120}
                  text={`contact@email: support@resomix.com<br />HQ_coords: 47°59'397"N 14°12'456"W // Europe<br />address: resomix.com`}
                  multiline={true}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center text-center justify-between">
          <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)] items-center my-[var(--px-60)]">
            <a href="https://support.resomix.com" target="_blank" aria-label="Resomix terms" className="hover:underline decoration-[var(--px-0-5)] footer-link" id="footer-terms-link">
              legal.support()
            </a>
            <br />
            <br />
            <a
              href={`${baseUrl}/contact`}
              aria-label="Resomix contact"
              className="hover:underline decoration-[var(--px-0-5)] footer-link"
              id="footer-contact-link"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(`${baseUrl}/contact`);
                }
              }}
            >
              contact_us()
            </a>
            <button
              className="hover:underline decoration-[var(--px-0-5)] footer-link mt-[var(--px-20)] cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                const silktideIcon = document.querySelector('#stcm-icon') as HTMLElement;
                if (silktideIcon) {
                  silktideIcon.click();
                }
              }}
            >
              privacy.preferences()
            </button>
          </div>
          <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)]">
            <CodeTyping
              speed={50}
              text="© 2026 Resomix Inc.<br />// Demo Stage"
              multiline={true}
            />
            <CodeTyping
              speed={70}
              text="All tracks CC BY 4.0<br />licensed Non-commercial prototype<br />licensing@resomix.com"
              multiline={true}
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default GlobalMobileFooter;
