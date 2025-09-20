import React from "react";
import { CodeTyping } from "@resomix/ui";
import { LogoRFooter } from "@/components/LogoRFooter.tsx";

const HomeFooter: React.FC = () => (
  <div className="mt-[var(--px-324)] pb-[var(--px-30)] relative z-15 min-h-[var(--px-275)]">
    <div className="flex flex-col w-full">
      <div className="absolute -left-[var(--px-20)] -top-[var(--px-80)] w-[var(--px-393)] text-[length:var(--px-30)] font-benzin uppercase leading-[var(--px-40)]">
        Join the Resomix<br />Universe
      </div>
      <div className="flex flex-col items-start px-[var(--px-10)] min-h-[var(--px-129)] mt-[var(--px-40)]">
        <div className="flex w-full justify-start">
          <a href="https://resomix.com" className="cursor-default">
            <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
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
                text={`contact@email: support@resomix.com<br />HQ_coords: 47°59'397"N 14°12'456"W // Europe<br />address: resomix.com`}
                multiline={true}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center text-center justify-between">
        <div className="flex flex-col text-[length:var(--px-12)] font-light font-fira tracking-[var(--px-2)] items-center my-[var(--px-60)]">
          <a href="/terms" className="hover:underline decoration-[var(--px-0-5)]">
            legal.terms()
          </a>
          <br />
          <a href="/terms" className="hover:underline decoration-[var(--px-0-5)]">
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

export default HomeFooter;
