import Error404 from "./Error404";

interface ErrorContentProps {
  baseUrl?: string;
}

/**
 * Generic "something went wrong" page (/error).
 *
 * Composes Error404 rather than restyling its own panel: the two are the same terminal-state
 * layout — accent rule + mono kicker, uppercase heading, one bordered panel with the message and a
 * single action — and keeping two copies is exactly how this one ended up stranded on the old
 * dotted-border look while the 404 was migrated.
 */
export default function ErrorContent({ baseUrl = "https://beta.resomix.com" }: ErrorContentProps) {
  return (
    <Error404
      baseUrl={baseUrl}
      eyebrow="Error // No track data"
      title="Something went wrong"
      description={
        "No track data found. Please go back and try again.\n" +
        "This can happen if you opened this page directly without providing a track."
      }
      buttonText="Upload Another Track"
    />
  );
}
