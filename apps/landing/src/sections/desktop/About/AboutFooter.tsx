import React from "react";
import { CodeTyping } from "@resomix/ui";
import { LogoRFooter } from "@/components/LogoRFooter.tsx";

const AboutFooter: React.FC = () => (
  <div className="mt-[var(--px-324)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
    <div className="flex flex-col">
      <div className="flex flex-col px-[var(--px-60)] min-h-[var(--px-129)]">
        <div className="flex w-full justify-start">
          <a href="https://resomix.com" className="cursor-default">
            <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
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
      <div className="text-[length:var(--px-62)] xl:text-[length:var(--px-63)] font-benzin uppercase w-[var(--px-1278)] -ml-[var(--px-62)]">
        Join the Resomix Universe
      </div>
      <div className="flex justify-between px-[var(--px-120)]">
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
          <a href="/terms" className="hover:underline decoration-[var(--px-0-5)] opacity-50 hover:opacity-100 transition-opacity">
            privacy_policy(): fetch('/privacy')
          </a>
        </div>
      </div>
    </div>
  </div>
);

export default AboutFooter;
