import { InfoPageLayout, MobileNavbar, Navbar, ContactContent, ErrorContent, Error404 } from "@resomix/ui";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { useState } from "react";
import { MenuPage } from "./index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

interface InfoPageProps {
  mode: string;
}


export default function InfoPage({ mode }: InfoPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navbar = (
    <>
      <div className="hidden lg:block">
        <Navbar
          logo={<a href={BASE_BETA_URL} className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
          mode={mode}
          baseUrl={BASE_LANDING_URL}
          baseBetaUrl={BASE_BETA_URL}
          customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
        />
      </div>
      <div className="block lg:hidden">
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
        baseUrl={BASE_LANDING_URL}
        LogoRFooter={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />}
        mode={mode}
      >
        {mode === "contact" && <ContactContent baseUrl={BASE_BETA_URL} />}
        {mode === "error" && <ErrorContent baseUrl={BASE_BETA_URL} />}
        {mode === "404" && <Error404 baseUrl={BASE_BETA_URL} />}
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
