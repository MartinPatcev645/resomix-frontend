import { BackButton } from "@/components/Navigation/BackButton.tsx";

interface BackToHomeButtonProps {
  /** Distinct per placement — the Library renders one for mobile and one for desktop. */
  id?: string;
}

/**
 * "Back to home" out of the Library and the info pages, onto the beta workspace root.
 *
 * Kept as its own name because three pages import it, but it is now just the shared `BackButton`
 * with this app's word for home in it.
 */
export function BackToHomeButton({ id }: BackToHomeButtonProps) {
  return <BackButton label="Sonic Discovery" to="/" id={id} />;
}

export default BackToHomeButton;
