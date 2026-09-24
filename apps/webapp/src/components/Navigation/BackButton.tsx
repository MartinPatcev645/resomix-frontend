import React from "react";
import { useNavigate } from "react-router-dom";
import { HERO_TOOLBAR_BACK, HeroChevronLeft } from "@/components/Playlist/heroToolbar.tsx";
import { WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

interface BackButtonProps {
  /** What the reader is going back TO, e.g. "Sonic Discovery", "Library", "Upload". */
  label: string;
  /** Where it goes. A real href, so middle-click and open-in-new-tab work. */
  to: string;
  /** Distinct per placement — the Library renders one for mobile and one for desktop. */
  id?: string;
  className?: string;
}

/**
 * The back control, one button for every page that has one.
 *
 * Each page used to roll its own: the Library and the account pages had a bordered button, the
 * analysis pages had a dim text link, and the playlist hero had a third thing. They are the same
 * control with a different word in it, so they are now the same button, wearing the accent edge
 * that marks the way out of a page.
 *
 * Rendered as an anchor with the click intercepted, so it navigates client-side but still behaves
 * like a link for a middle-click or a right-click.
 */
export const BackButton: React.FC<BackButtonProps> = ({ label, to, id, className }) => {
  const navigate = useNavigate();

  return (
    <a
      href={to}
      id={id}
      aria-label={label}
      onClick={(e) => {
        // Leave modified clicks to the browser, which is what makes open-in-new-tab work.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      className={`${HERO_TOOLBAR_BACK} ${WORKSPACE_FOCUS_VISIBLE} ${className ?? ""}`}
    >
      <HeroChevronLeft />
      {label}
    </a>
  );
};

export default BackButton;
