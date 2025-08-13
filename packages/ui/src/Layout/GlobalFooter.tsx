import React from "react";
import { CodeTyping } from "../index";

// Add a prop for the LogoRFooter
interface GlobalFooterProps {
  logo: React.ReactNode;
}

const GlobalFooter: React.FC<GlobalFooterProps> = ({ logo }) => (
  <div className="mt-[var(--px-150)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
    <div className="absolute text-[length:var(--px-63)] -left-[var(--px-63)] top-[var(--px-140)] min-w-[var(--px-1280)] font-benzin uppercase">
      Join the Resomix Universe
    </div>
    <div className="flex flex-col gap-[var(--px-130)]">
      <div className="flex flex-col px-[var(--px-65)] min-h-[var(--px-129)]">
        <div className="flex w-full justify-start">
          <a href="https://resomix.com" className="cursor-default">
            {logo}
          </a>
        </div>
        <div className="flex justify-between">
          <div className="flex flex-col text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
            <div className="leading-[var(--px-40)]">
              <CodeTyping
                speed={50}
                text="// ──────[ resomix &gt; footer_terminal ]──────"
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
          <div className="flex flex-col text-[length:var(--px-7)] text-right font-light font-fira opacity-50 tracking-[var(--px-2)] items-end">
            <div className="leading-[var(--px-8)]">
              <CodeTyping
                speed={50}
                text="upload_protocol: SSL 256-bit // encrypted<br />system_uptime: 99.97%<br />last_waveform_uploaded: 3.4s ago"
                multiline={true}
              />
            </div>
            <div className="leading-[var(--px-8)] mt-[var(--px-40)]">
              <CodeTyping
                speed={100}
                text="Deep Learning Audio Engine: v5.3.9 [ML model: R-BeatNet]<br />latency: zero-latency-mode = active<br />data_nodes: [New York] [London] [Singapore]"
                multiline={true}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-between px-[var(--px-65)]">
        <div className="flex flex-col text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
          <CodeTyping
            speed={50}
            text="© 2025 Resomix // built on beatmaps and algorithms"
            multiline={true}
          />
        </div>
        <div className="flex flex-col text-[length:var(--px-7)] text-right font-light font-fira tracking-[var(--px-2)] items-end">
          <a href="/terms" className="hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity">
            legal.terms(): open('/terms')
          </a>
          <br />
          <a href="/privacy" className="hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity">
            privacy_policy(): fetch('/privacy')
          </a>
        </div>
      </div>
    </div>
  </div>
);

export default GlobalFooter;
