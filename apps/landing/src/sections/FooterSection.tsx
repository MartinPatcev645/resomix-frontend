import React from "react";
import RIconFooter from "../assets/icons/r_icon_footer.svg";

const FooterSection: React.FC = () => (
  <div className="mt-[310px] pb-[20px] relative z-15">
    <div className="flex flex-col">
      <div className="flex flex-col px-[120px]">
        <div className="flex w-full justify-start">
          <img src={RIconFooter} alt="RIconFooter" />
        </div>
        <div className="flex justify-between">
          <div className="flex flex-col text-[7px] font-light font-fira opacity-50 tracking-[2px]">
            <div className="leading-10">
            // ──────[ resomix &gt; footer_terminal ]──────
            </div>
            <div className="leading-[8px]">
              company_name: Resomix Inc.<br />
              status: online [✓]
            </div>
            <div className="leading-[8px] mt-[14px]">
              contact@email: hello@resolmix.audio<br />
              support_line: +1 (800) 441-7765<br />
              HQ_coords: 40°44'54.6"N 73°59'08.9"W // New York City, USA<br />
              address: 808 Echo Street, Floor 12, Brooklyn, NY 11201, USA
            </div>
          </div>
          <div className="flex flex-col text-[7px] text-right font-light font-fira opacity-50 tracking-[2px] items-end">
            <div className="leading-[8px]">
              upload_protocol: SSL 256-bit // encrypted<br />
              system_uptime: 99.97%<br />
              last_waveform_uploaded: 3.4s ago
            </div>
            <div className="leading-[8px] mt-[40px]">
              A.I. Audio Engine: v5.3.9 [ML model: R-BeatNet]<br />
              latency: zero-latency-mode = active<br />
              data_nodes: [New York] [London] [Singapore]
            </div>
          </div>
        </div>
      </div>
      <div className="w-[1280px] text-[63px] font-benzin uppercase">
        Join the Resomix Universe
      </div>
      <div className="flex justify-between px-[120px]">
        <div className="flex flex-col text-[7px] font-light font-fira opacity-50 tracking-[2px]">
          © 2025 Resolmix // built on beatmaps and algorithms
        </div>
        <div className="flex flex-col text-[7px] text-right font-light font-fira opacity-50 tracking-[2px] items-end">
          legal.terms(): open("/legal/terms")<br />
          privacy_policy(): fetch("/legal/privacy")
        </div>
      </div>
    </div>
  </div>
);

export default FooterSection;
