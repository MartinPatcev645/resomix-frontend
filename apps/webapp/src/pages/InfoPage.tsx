import { ContactContent, ErrorContent, Error404 } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";
import { BackToHomeButton } from "@/components/index.ts";

interface InfoPageProps {
  mode: string;
}

export default function InfoPage({ mode }: InfoPageProps) {
  return (
    <>
      {/* Contact exits to Sonic Discovery, not to the landing site — the same client-side
          BackToHomeButton the Library uses, so leaving this page keeps you inside the webapp. */}
      {mode === "contact" && (
        <ContactContent
          baseUrl={BASE_BETA_URL}
          backControl={<BackToHomeButton id="contact-back-link" />}
        />
      )}
      {mode === "error" && <ErrorContent baseUrl={BASE_BETA_URL} />}
      {mode === "404" && <Error404 baseUrl={BASE_BETA_URL} eyebrow="Error // 404" />}
    </>
  );
}
