/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the resomix-analysis-service (FastAPI) — used ONLY by the dev-direct fallback. */
  readonly VITE_ANALYSIS_ENDPOINT?: string;
  /** Route analysis uploads through Alwyzon (default "true"). Set "false" for dev-direct. */
  readonly VITE_ANALYSIS_VIA_ALWYZON?: string;
  /** Fetch the completed result from the served cache via token (default "true"). "false" = proxy. */
  readonly VITE_ANALYSIS_DIRECT_CACHE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
