import React from "react";
import RIconFooter from "../assets/icons/r_icon_footer.svg";

const FooterSection: React.FC = () => (
  <div className="mt-[var(--px-324)] pb-[var(--px-30)] relative z-15">
    <div className="flex flex-col">
      <div className="flex flex-col px-[var(--px-120)]">
        <div className="flex w-full justify-start">
          <img src={RIconFooter} className="w-[var(--px-27)] h-[var(--px-27)]" alt="RIconFooter" />
        </div>
        <div className="flex justify-between">
          <div className="flex flex-col text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
            <div className="leading-[var(--px-40)]">
            // ──────[ resomix &gt; footer_terminal ]──────
            </div>
            <div className="leading-[var(--px-8)]">
              company_name: Resomix Inc.<br />
              status: online [✓]
            </div>
            <div className="leading-[var(--px-8)] mt-[var(--px-14)]">
              contact@email: hello@resolmix.audio<br />
              support_line: +1 (800) 441-7765<br />
              HQ_coords: 40°44'54.6"N 73°59'08.9"W // New York City, USA<br />
              address: 808 Echo Street, Floor 12, Brooklyn, NY 11201, USA
            </div>
          </div>
          <div className="flex flex-col text-[length:var(--px-7)] text-right font-light font-fira opacity-50 tracking-[var(--px-2)] items-end">
            <div className="leading-[var(--px-8)]">
              upload_protocol: SSL 256-bit // encrypted<br />
              system_uptime: 99.97%<br />
              last_waveform_uploaded: 3.4s ago
            </div>
            <div className="leading-[var(--px-8)] mt-[var(--px-40)]">
              A.I. Audio Engine: v5.3.9 [ML model: R-BeatNet]<br />
              latency: zero-latency-mode = active<br />
              data_nodes: [New York] [London] [Singapore]
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-full text-[length:var(--px-62)] xl:text-[length:var(--px-63)] font-benzin uppercase">
        Join the Resomix Universe
      </div>
      <div className="flex justify-between px-[var(--px-120)]">
        <div className="flex flex-col text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
          © 2025 Resolmix // built on beatmaps and algorithms
        </div>
        <div className="flex flex-col text-[length:var(--px-7)] text-right font-light font-fira opacity-50 tracking-[var(--px-2)] items-end">
          legal.terms(): open("/legal/terms")<br />
          privacy_policy(): fetch("/legal/privacy")
        </div>
      </div>
    </div>
  </div>
);

export default FooterSection;
