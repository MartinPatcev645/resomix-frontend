import { ContactContent, ErrorContent, Error404 } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

interface InfoPageProps {
  mode: string;
}

export default function InfoPage({ mode }: InfoPageProps) {
  return (
    <>
      {mode === "contact" && <ContactContent baseUrl={BASE_BETA_URL} />}
      {mode === "error" && <ErrorContent baseUrl={BASE_BETA_URL} />}
      {mode === "404" && <Error404 baseUrl={BASE_BETA_URL} eyebrow="Error // 404" />}
    </>
  );
}
