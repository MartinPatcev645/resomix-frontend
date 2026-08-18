import React from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Dialog, PAGE_FIELD_LABEL } from "@resomix/ui";
import { renderSquareCover } from "@resomix/hooks";

/**
 * CoverCropModal
 * ==============
 *
 * Owner-only playlist-cover cropper, built on the shared `Dialog` shell. The user picks any
 * (non-square) image; here they pan + zoom and confirm a SQUARE crop. On confirm the selected region
 * is rendered to the exact square we store and handed back as a JPEG `Blob`.
 *
 * `imageSrc` is the object URL of the PREPARED image — `usePlaylistCover.prepare` has already
 * downscaled the camera original to a bounded working size. That matters: this modal renders the
 * source in a live cropper, and pointing it at a 48 MP original is what makes an older phone stutter
 * or hand back a blank canvas. Everything here works on the bounded copy.
 *
 * Uses `react-easy-crop` (lightweight, stable, aspect-locked crop with zoom/pan). The source is a
 * same-origin `blob:` URL, so drawing it to a canvas does NOT taint it and `toBlob` works.
 */

export interface CoverCropModalProps {
  isOpen: boolean;
  /** Object URL of the prepared image (blob:). */
  imageSrc: string | null;
  onCancel: () => void;
  /** Called with the cropped square JPEG blob when the user confirms. */
  onConfirm: (blob: Blob) => void;
}

export const CoverCropModal: React.FC<CoverCropModalProps> = ({ isOpen, imageSrc, onCancel, onConfirm }) => {
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [processing, setProcessing] = React.useState(false);
  const areaRef = React.useRef<Area | null>(null);

  // Reset pan/zoom whenever a new image is opened.
  React.useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      areaRef.current = null;
      setProcessing(false);
    }
  }, [isOpen, imageSrc]);

  const handleApply = async () => {
    if (!imageSrc || !areaRef.current || processing) return;
    setProcessing(true);
    try {
      const blob = await renderSquareCover(imageSrc, areaRef.current);
      onConfirm(blob);
    } catch {
      setProcessing(false);
      // Fall back to cancel so the user isn't stuck; the picker can be retried.
      onCancel();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      eyebrow="Playlist // Cover"
      title="Crop your cover"
      subtitle="Drag to reposition · scroll / pinch or use the slider to zoom · the cover is always square"
      ariaLabel="Crop your cover"
      // While the canvas render is in flight the dialog cannot be dismissed — the old shell did the
      // same with a no-op onClose.
      dismissible={!processing}
      actions={[
        { label: "Cancel", dismiss: true, disabled: processing },
        {
          label: "Apply",
          onClick: handleApply,
          tone: "primary",
          busy: processing,
          busyLabel: "Processing…",
        },
      ]}
    >
      <div className="flex w-full flex-col gap-[var(--px-15)] pb-[var(--px-4)]">
        {/* Cropper viewport (square). react-easy-crop fills this relatively-positioned box. */}
        <div className="relative aspect-square w-full overflow-hidden border border-[var(--rx-color-border-default)] bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={4}
              aspect={1}
              cropShape="rect"
              showGrid
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => {
                areaRef.current = areaPixels;
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-[var(--px-10)]">
          <span className={PAGE_FIELD_LABEL}>Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 cursor-pointer accent-[var(--rx-color-accent)]"
          />
        </div>
      </div>
    </Dialog>
  );
};

export default CoverCropModal;
