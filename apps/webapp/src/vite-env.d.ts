/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the resomix-analysis-service (FastAPI). Set per environment. */
  readonly VITE_ANALYSIS_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
