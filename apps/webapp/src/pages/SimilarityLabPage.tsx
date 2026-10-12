import { useSimilarityLab } from "@resomix/hooks";
import { LabControls, LabResults } from "@/components/Lab/index.ts";

/**
 * Similarity lab (/lab/similarity). Built into the bundle only where VITE_LAB_ENABLED=true, which
 * is staging. Compares today's playlists with experimental search settings; nothing is saved.
 */
export default function SimilarityLabPage() {
  const lab = useSimilarityLab();
  return (
    <div className="relative z-20 flex flex-col gap-[var(--px-24)] px-[var(--px-20)] py-[var(--px-24)] lg:px-[var(--px-64)] lg:py-[var(--px-40)]">
      <LabControls lab={lab} />
      <LabResults lab={lab} />
    </div>
  );
}
