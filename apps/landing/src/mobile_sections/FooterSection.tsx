import React from "react";
import { CodeTyping } from "@resomix/ui";
import { LogoRFooter } from "../components/LogoRFooter.tsx";

const FooterSection: React.FC = () => (
  <div className="mt-[var(--px-324)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
    <div className="flex flex-col w-full">
      <div className="max-w-full text-[length:var(--px-30)] font-benzin uppercase">
        Join the Resomix<br />Universe
      </div>
      <div className="flex flex-col items-start px-[var(--px-40)] min-h-[var(--px-129)] mt-[var(--px-40)]">
        <div className="flex w-full justify-start">
          <a href="https://resomix.com" className="cursor-default">
            <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
          </a>
        </div>
        <div className="flex justify-between">
          <div className="flex flex-col text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
            <div className="leading-[var(--px-8)] my-[var(--px-10)]">
              <CodeTyping
                speed={50}
                text="// ──────[ resomix &gt;<br />footer_terminal ]──────"
                multiline={true}
              />
            </div>
            <div className="leading-[var(--px-8)]">
              <CodeTyping
                speed={50}
                text="company_name: Resomix Inc.<br />status: online [✓]"
                multiline={true}
              />
            </div>
            <div className="leading-[var(--px-8)] mt-[var(--px-14)]">
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
        <div className="flex flex-col text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)] items-end my-[var(--px-60)]">
          <CodeTyping
            speed={50}
            text="legal.terms()<br />privacy_policy()"
            multiline={true}
          />
        </div>
        <div className="flex flex-col text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
          <CodeTyping
            speed={50}
            text="© 2025 Resomix // built on beatmaps and algorithms"
            multiline={true}
          />
        </div>
      </div>
    </div>
  </div>
);

export default FooterSection;
