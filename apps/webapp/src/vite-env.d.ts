/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth Web Client ID for "Continue with Google" (public; same as backend GOOGLE_CLIENT_ID). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** "true" serves /api/v1/bandcamp/* from MSW. Dev server only; ignored by production builds. */
  readonly VITE_BANDCAMP_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
