import React from "react";
import { ButtonSleek } from "@resomix/ui";
import { useEntitlementCta } from "@/utils/entitlementCta.ts";
import { WORKSPACE_PANEL_CLASS } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

export interface PlaylistUnlockBandProps {
  isGuest: boolean;
  maxTracksPerPlaylist: number;
  /** Stack CTAs vertically on narrow viewports. */
  mobile?: boolean;
}

/**
 * In-flow unlock band between the last unlocked result row and the first locked row.
 * Copy and CTAs mirror the legacy entitlement tease — styling only.
 */
export const PlaylistUnlockBand: React.FC<PlaylistUnlockBandProps> = ({
  isGuest,
  maxTracksPerPlaylist,
  mobile = false,
}) => {
  const { trigger: triggerCta } = useEntitlementCta();

  return (
    <div
      className={`${WORKSPACE_PANEL_CLASS} border-t border-dotted border-slate-200 pointer-events-auto select-text`}
      data-testid="playlist-unlock-band"
    >
      <h3 className="m-0 text-center font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--color-primary)] opacity-80">
        Unlock all matching tracks
      </h3>
      <p className="mt-[var(--px-10)] mb-[var(--px-16)] text-center font-fira text-[length:var(--px-10)] font-light leading-[var(--px-14)] text-[var(--color-primary)] opacity-75">
        {isGuest
          ? `Guest access includes the first ${maxTracksPerPlaylist} results. Create a free account or log in to view the complete similarity list and save your playlist.`
          : `Your plan includes the first ${maxTracksPerPlaylist} results. Subscribe to unlock the complete similarity list.`}
      </p>
      <div
        className={
          mobile
            ? "flex flex-col items-stretch gap-[var(--px-10)]"
            : "flex flex-wrap items-center justify-center gap-[var(--px-12)]"
        }
      >
        {isGuest ? (
          <>
            <ButtonSleek
              text="Create Free Account"
              onClick={() => triggerCta("register")}
              className="min-h-[var(--px-44)]"
            />
            <ButtonSleek
              text="Log In"
              onClick={() => triggerCta("login")}
              transparent
              className="min-h-[var(--px-44)]"
            />
          </>
        ) : (
          <ButtonSleek
            text="Subscribe"
            onClick={() => triggerCta("subscribe")}
            className="min-h-[var(--px-44)]"
          />
        )}
      </div>
    </div>
  );
};

export default PlaylistUnlockBand;
