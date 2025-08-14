import React from "react";
import { CodeTyping } from "../index";

interface GlobalMobileFooterProps {
  logo: React.ReactNode;
  baseUrl?: string;
}

const GlobalMobileFooter: React.FC<GlobalMobileFooterProps> = ({ logo, baseUrl = "https://resomix.com" }) => (
  <div className="mt-[var(--px-250)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
    <div className="flex flex-col w-full">
      <div className="absolute -left-[var(--px-20)] -top-[var(--px-80)] w-[var(--px-393)] text-[length:var(--px-30)] font-benzin uppercase leading-[var(--px-40)]">
        Join the Resomix<br />Universe
      </div>
      <div className="flex flex-col items-start px-[var(--px-10)] min-h-[var(--px-129)] mt-[var(--px-40)]">
        <div className="flex w-full justify-start">
          <a href={baseUrl} className="cursor-default">
            {logo}
          </a>
        </div>
        <div className="flex justify-between">
          <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)]">
            <div className="leading-[var(--px-12)] my-[var(--px-14)]">
              <CodeTyping
                speed={50}
                text="// ──────[ resomix &gt;<br />footer_terminal ]──────"
                multiline={true}
              />
            </div>
            <div className="leading-[var(--px-12)]">
              <CodeTyping
                speed={50}
                text="company_name: Resomix Inc.<br />status: online [✓]"
                multiline={true}
              />
            </div>
            <div className="leading-[var(--px-12)] mt-[var(--px-20)]">
              <CodeTyping
                speed={120}
                text={`contact@email: hello@resomix.audio<br />support_line: +1 (800) 441-7765<br />HQ_coords: 40°44'54.6"N 73°59'08.9"W // New York City, USA<br />address: 808 Echo Street, Floor 12, Brooklyn, NY 11201, USA`}
                multiline={true}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center text-center justify-between">
        <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)] items-center my-[var(--px-60)]">
          <a href={`${baseUrl}/terms`} className="hover:underline decoration-[var(--px-0-5)]">
            legal.terms()
          </a>
          <br />
          <a href={`${baseUrl}/privacy`} className="hover:underline decoration-[var(--px-0-5)]">
            privacy_policy()
          </a>
        </div>
        <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)]">
          <CodeTyping
            speed={50}
            text="© 2025 Resomix<br />// built on beatmaps and algorithms"
            multiline={true}
          />
        </div>
      </div>
    </div>
  </div>
);

export default GlobalMobileFooter;
