import React from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { StatusMessage } from "@resomix/ui";

/**
 * CoverCropModal
 * ==============
 *
 * Owner-only playlist-cover cropper, reusing the app's `StatusMessage` (custom) modal shell. The user
 * picks any (non-square) image; here they pan + zoom and confirm a SQUARE crop. On confirm we render
 * the selected region to a canvas and hand back a square JPEG `Blob`, so the backend + media server
 * always receive a proper square.
 *
 * Uses `react-easy-crop` (lightweight, stable, aspect-locked crop with zoom/pan). The source is an
 * object URL (same-origin `blob:`), so drawing it to a canvas does NOT taint it and `toBlob` works.
 */

// Output square is clamped so the file stays small and inside the media server's 100–4000 px window.
const OUTPUT_MIN = 200;
const OUTPUT_MAX = 1500;
const JPEG_QUALITY = 0.9;

export interface CoverCropModalProps {
  isOpen: boolean;
  /** Object URL of the picked image (blob:). */
  imageSrc: string | null;
  onCancel: () => void;
  /** Called with the cropped square JPEG blob when the user confirms. */
  onConfirm: (blob: Blob) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = src;
  });
}

/** Draw the chosen crop region onto a square canvas and export a JPEG blob. */
async function getCroppedSquareBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const outSize = Math.max(OUTPUT_MIN, Math.min(Math.round(area.width), OUTPUT_MAX));
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outSize, outSize);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
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
      const blob = await getCroppedSquareBlob(imageSrc, areaRef.current);
      onConfirm(blob);
    } catch {
      setProcessing(false);
      // Fall back to cancel so the user isn't stuck; the picker can be retried.
      onCancel();
    }
  };

  return (
    <StatusMessage isOpen={isOpen} onClose={processing ? () => {} : onCancel} status="custom">
      <div className="w-full flex flex-col gap-[var(--px-15)]">
        <div className="text-center">
          <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
            Crop Your Cover
          </div>
          <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-14)] mt-[var(--px-6)] opacity-70">
            Drag to reposition · scroll / pinch or use the slider to zoom · the cover is always square
          </div>
        </div>

        {/* Cropper viewport (square). react-easy-crop fills this relatively-positioned box. */}
        <div className="relative w-full aspect-square bg-black overflow-hidden rounded-xs border border-dotted border-[var(--color-primary)]/40">
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
          <span className="text-[length:var(--px-9)] font-light font-fira uppercase tracking-wider opacity-70">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-[var(--color-primary)] cursor-pointer"
          />
        </div>

        <div className="mt-[var(--px-5)] flex justify-center items-center gap-[var(--px-10)] w-full">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing}
            className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)] hover:opacity-90 text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer flex justify-center items-center disabled:opacity-50"
          >
            {processing ? "Processing…" : "Apply"}
          </button>
        </div>
      </div>
    </StatusMessage>
  );
};

export default CoverCropModal;
