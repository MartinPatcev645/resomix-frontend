import { InfoPageLayout, MobileNavbar, Navbar } from "@resomix/ui";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { useState } from "react";
import { MenuPage } from "./index.ts";
import TermsContent from "../content/TermsContent.tsx";

interface InfoPageProps {
  mode: string;
}

export default function InfoPage({ mode }: InfoPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navbar = (
    <>
      <div className="hidden md:block">
        <Navbar
          logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
          mode={mode}
          customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
        />
      </div>
      <div className="block md:hidden">
        <MobileNavbar
          logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
          menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
          customClass="flex justify-between items-center align-center z-50 relative"
        />
      </div>
    </>
  );

  return (
    <>
      <InfoPageLayout
        navbar={navbar}
        LogoRFooter={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />}
        mode={mode}
      >
        {mode === "terms" && <TermsContent />}
        {/* {mode === "privacy" && <PrivacyContent />}
        {mode === "contact" && <ContactContent />}
        {mode === "error" && <ErrorContent />} */}
      </InfoPageLayout>
      {/* Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100]">
          <MenuPage onClose={() => setIsMenuOpen(false)} />
        </div>
      )}
    </>
  );
}
