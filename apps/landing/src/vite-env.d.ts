/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth Web Client ID for "Continue with Google" (public; same as backend GOOGLE_CLIENT_ID). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
