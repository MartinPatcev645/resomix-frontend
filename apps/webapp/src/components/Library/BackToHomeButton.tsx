import { useNavigate } from "react-router-dom";
import { HERO_TOOLBAR_BTN, HeroChevronLeft } from "@/components/Playlist/heroToolbar.tsx";
import { WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

interface BackToHomeButtonProps {
  /** Distinct per placement — the Library renders one for mobile and one for desktop. */
  id?: string;
}

/**
 * "Back to home" out of the Library, onto the beta workspace root.
 *
 * Rendered as a real anchor so middle-click / open-in-new-tab work, with the click intercepted for
 * a client-side navigation. Wears the playlist hero's toolbar chrome so the two back controls in
 * the app look like the same button.
 */
export function BackToHomeButton({ id }: BackToHomeButtonProps) {
  const navigate = useNavigate();

  return (
    <a
      href="/"
      aria-label="Back to home"
      onClick={(e) => {
        e.preventDefault();
        navigate("/");
      }}
      className={`${HERO_TOOLBAR_BTN} ${WORKSPACE_FOCUS_VISIBLE}`}
      id={id}
    >
      <HeroChevronLeft />
      Back to home
    </a>
  );
}

export default BackToHomeButton;
