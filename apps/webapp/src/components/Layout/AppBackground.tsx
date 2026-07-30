import { VoidField } from "@resomix/ui";
import voidPlateDark from "@/assets/void-field/void-field-dark.webp";
import voidPlateLight from "@/assets/void-field/void-field-light.webp";
import voidGrainDark from "@/assets/void-field/void-grain-dark.png";
import voidGrainLight from "@/assets/void-field/void-grain-light.png";

/**
 * AppBackground — THE background for this app, in one place.
 *
 * `VoidField` takes its plate/grain as URLs so each app can bundle its own copy; binding them here
 * means every surface that needs a backdrop renders the same thing by construction. Use this rather
 * than reaching for an animation component directly — the app used to mix `VoidField` in the layout
 * with the older `NebulaField` (aurora + stars) in the boot and upload loaders, so a hard refresh
 * flashed a background that no longer exists anywhere else in the product.
 */
export function AppBackground() {
  return (
    <VoidField
      plateDark={voidPlateDark}
      plateLight={voidPlateLight}
      grainDark={voidGrainDark}
      grainLight={voidGrainLight}
    />
  );
}

export default AppBackground;
