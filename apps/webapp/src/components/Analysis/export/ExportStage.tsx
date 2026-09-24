import React, { useEffect } from "react";
import type { PagePlan } from "./paginate.ts";
import { ExportPage, type ExportBlock } from "./ExportDocument.tsx";
import { CONTENT_W, PAGE_BG, PAGE_W, SIDE_MARGIN } from "./exportTheme.ts";

/**
 * The two passes the export renders, and the one that says when to look.
 *
 * Nothing here is ever seen on screen. `Flow` is the whole document in one column, which exists
 * only so each block can be measured at the width it will be printed at; `Sheets` is the same
 * blocks dealt onto A4 once the packer has decided where the pages turn.
 */

export const Flow: React.FC<{ blocks: ExportBlock[] }> = ({ blocks }) => (
  <div style={{ width: PAGE_W, padding: `0 ${SIDE_MARGIN}px`, background: PAGE_BG }}>
    {blocks.map((b) => (
      <div key={b.id} data-export-block={b.id} style={{ width: CONTENT_W }}>
        {b.node}
      </div>
    ))}
  </div>
);

export const Sheets: React.FC<{ plan: PagePlan[]; blocks: ExportBlock[]; title: string }> = ({ plan, blocks, title }) => {
  const byId = new Map(blocks.map((b) => [b.id, b.node]));
  return (
    <>
      {plan.map((page, i) => (
        <ExportPage key={i} page={i + 1} total={plan.length} title={title}>
          <div style={{ display: "flex", flexDirection: "column", gap: page.gap }}>
            {page.blocks.map((placed) => (
              <div
                key={placed.id}
                style={
                  placed.scale < 1
                    ? {
                        // Laid out wider and scaled back down, so the result is still exactly one
                        // content width across and everything inside it shrinks together.
                        width: CONTENT_W / placed.scale,
                        transform: `scale(${placed.scale})`,
                        transformOrigin: "top left",
                      }
                    : { width: CONTENT_W }
                }
              >
                {byId.get(placed.id)}
              </div>
            ))}
          </div>
        </ExportPage>
      ))}
    </>
  );
};

/** Calls back once React has committed the tree below it. */
export const Settle: React.FC<{ onMounted: () => void; children: React.ReactNode }> = ({ onMounted, children }) => {
  useEffect(() => {
    onMounted();
    // Mounted once per pass. Re-running on a new callback identity would only resolve twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
};
