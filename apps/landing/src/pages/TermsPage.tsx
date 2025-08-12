import { InfoPageLayout } from "@resomix/ui";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";

export default function TermsPage() {
  return (
    <InfoPageLayout
    LogoHeader={<LogoHeader />} 
    LogoRFooter={<LogoRFooter />}
    mode="terms"
    >
      <div className="py-[var(--px-120)] text-center">
        <h1 className="text-4xl font-bold mb-8">Terms and Conditions</h1>
        <p className="text-xl">Okay</p>
      </div>
    </InfoPageLayout>
  );
}
