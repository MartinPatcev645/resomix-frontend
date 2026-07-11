/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the resomix-analysis-service (FastAPI) — used ONLY by the dev-direct fallback. */
  readonly VITE_ANALYSIS_ENDPOINT?: string;
  /** Route analysis uploads through Alwyzon (default "true"). Set "false" for dev-direct. */
  readonly VITE_ANALYSIS_VIA_ALWYZON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
