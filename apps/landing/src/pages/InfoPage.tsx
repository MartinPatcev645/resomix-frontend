import { ContactContent, ErrorContent, Error404 } from "@resomix/ui";
import TermsContent from "@/content/TermsContent.tsx";
import PrivacyContent from "@/content/PrivacyContent.tsx";
import WaitListContent from "@/content/WaitList.tsx";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

interface InfoPageProps {
  mode: string;
}

export default function InfoPage({ mode }: InfoPageProps) {
  return (
    <div className="min-h-screen p-[var(--px-20)] lg:p-[var(--px-40)]">
      {mode === "terms" && <TermsContent />}
      {mode === "privacy" && <PrivacyContent />}
      {mode === "contact" && <ContactContent baseUrl={BASE_LANDING_URL} />}
      {mode === "waitlist" && <WaitListContent baseUrl={BASE_LANDING_URL} />}
      {mode === "error" && <ErrorContent baseUrl={BASE_BETA_URL} />}
      {mode === "404" && <Error404 baseUrl={BASE_LANDING_URL} />}
    </div>
  );
}
