// The lab's own barrel. Kept out of components/index.ts on purpose: that barrel is imported by
// every page, so exporting the lab from it puts the lab in every bundle. Only the lazily loaded
// SimilarityLabPage imports this one, so where VITE_LAB_ENABLED is off none of it ships.
export { LabControls } from "./LabControls.tsx";
export { LabResults } from "./LabResults.tsx";
