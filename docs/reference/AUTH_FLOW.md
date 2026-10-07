## Resomix Authentication Guide

This document consolidates the complete client-side authentication story for the Resomix web properties. It covers end-user flows, token handling, storage decisions, axios configuration, and multi-tab behaviour. Treat it as the single source of truth for frontend auth logic.

---

## 1. High-Level Architecture

- **UI Entrypoint**: `apps/webapp/src/pages/AuthPage.tsx` routes between login, registration, verification, and account management screens.
- **State Store**: `packages/stores/src/useAuth.ts` (Zustand) keeps track of the logged-in user and auth flags. Access tokens now live only in memory.
- **Networking**: `packages/api-client/src/authClient.ts` wraps axios with request/response interceptors, refresh handling, and error normalisation.
- **Persistence**: `packages/stores/src/cookieStorage.ts` provides a hybrid adapter (localStorage + sanitised cookie) to share non-sensitive auth state across subdomains.
- **Bootstrap**: `packages/hooks/src/Auth/useAuthInit.ts` refreshes the session on app load, hydrates the user profile, and logs out if refresh fails.

---

## 2. User-Facing Flows

### 2.1 Login

- **Component**: `packages/ui/src/Content/LoginContent.tsx`
- **Validation**: `useFormValidation` enforces required email/username + password.
- **API Call**: `login()` from `@resomix/api-client` (`POST /auth/login`).
- **Success Handling**  
  - `requires_2fa === true`: shows success prompt, then routes to the 2FA verification screen with the provided `user_id`.  
  - `access_token` present: stores the user in `useAuthStore`, keeps the token in memory, and redirects after a short delay (allows cookie persistence).
- **Error Handling**  
  - `403` or messages containing “not verified”: presents a “Verify your email” status modal with a CTA to resend the verification email.  
  - Other API errors: surfaced as “Sign-in failed”.  
  - Network failures: generic connectivity message.  
  - If `sessionStorage.auth_logout_reason === "refresh_token_reuse"` on mount, the page shows “Session Ended” to explain why the user was logged out.
- **Resend Verification**: `resendVerification()` requires an email address; if the user entered a username, the UI prompts them to provide the email.

### 2.2 Registration

- **Component**: `packages/ui/src/Content/RegisterContent.tsx`
- **Validation**  
  - Email, username, password, confirm password, and optional name validated via shared hooks (`validateEmail`, `validateUsername`, etc.).  
  - Password strength indicator (`calculatePasswordStrength`).  
  - Terms of Service and Privacy Policy checkboxes enforced via `validateCheckbox`.
- **API Call**: `register()` from `@resomix/api-client` (`POST /auth/register`).
- **Success Handling**: Clears the form, resets checkboxes, displays success messaging, then navigates to the verify-email screen.
- **Error Handling**: surfaces API errors or a generic fallback; network errors show “check your connection”.

### 2.3 Password Reset

#### Step 1 – Request Reset Link

- **Component**: `packages/ui/src/Content/ForgotPasswordContent.tsx`
- **Validation**: `validateEmail`.
- **API Call**: `requestPasswordReset()` (`POST /auth/password-reset`).
- **Response Handling**: Always shows a success message (“If an account exists…”) for security reasons.
- **Follow-up**: After a delay, calls `onSuccess` to stay on the page or advance to the next step.

#### Step 2 – Confirm New Password

- **Component**: `packages/ui/src/Content/ResetPasswordContent.tsx`
- **Validation**: Enforces length ≥ 8 and at least one digit; checks confirm password and token presence.
- **API Call**: `confirmPasswordReset()` (`POST /auth/password-reset-confirm` with `token` + `new_password`).
- **Success Handling**: Shows “Password reset” success modal, clears the form, then triggers `onSuccess` and `onNavigateLogin`.
- **Error Handling**  
  - `429` / “rate limit”: title changes to “Too many attempts” but keeps the token valid.  
  - Other failures: title becomes “Unable to reset password”, token marked invalid, and the UI falls back to the “Invalid Reset Link” panel.  
  - Network errors: generic connectivity message.

### 2.4 Two-Factor Verification

- **Component**: `packages/ui/src/Content/Verify2FAContent.tsx`
- **Input**: Six-digit code auto-submits once filled.
- **API Call**: `verify2FA()` (`POST /auth/verify-2fa`).
- **Success Handling**: Stores user + access token in memory, displays success messaging, then invokes `onSuccess`.
- **Error Handling**  
  - `429` / “rate limit”: title changes to “Too many attempts”.  
  - Other API errors: “Verification failed”.  
  - Network errors: generic message and clears the code input.  
  - Invalid session (no user ID): renders the “Invalid Session” panel prompting a return to login.
- **Resend**: Button simulates a resend operation and starts a 60s cooldown (backend integration pending).

### 2.5 Ancillary Screens

- **Email Verification**: `packages/ui/src/Content/VerifyEmailContent.tsx` guides users to confirm their email and navigate back to login.
- **Optional Auth Banner**: `apps/webapp/src/components/OptionalAuthRoute.tsx` shows a reminder banner for authenticated but unverified users, with resend + dismiss actions.
- **Protected Routes**: `ProtectedRoute` redirects anonymous users to `/auth/login`.

---

## 3. Token Lifecycle

### 3.1 Access Token

- Stored only in memory within `useAuthStore`.  
- Persisted state via `partialize` now excludes the token entirely.  
- `useAuthInit` refreshes it on app load if missing or expired.  
- `authClient` request interceptor attaches it as `Authorization: Bearer …` when present.

### 3.2 Refresh Token

- Issued and stored by the backend in an HttpOnly, Secure cookie.  
- `authClient` sends it automatically because all requests use `withCredentials: true`.  
- `authClient` response interceptor handles 401s by attempting one refresh call.  
- On refresh success, the new access token is written to memory and queued requests are retried.  
- Refresh failures trigger `logout()`; if the error message contains “refresh token reuse detected”, a `sessionStorage` flag is set so the login screen can show a targeted message.

### 3.3 Error Normalisation

- `handleApiError` (`packages/api-client/src/utils.ts`) returns `{ success: false, error, status }`.  
- Callers branch on `status` for special cases (403 unverified, 429 rate limit, etc.).

---

## 4. Storage Strategy & Multi-Tab Behaviour

### 4.1 Persisted Fields

- **`user`**: stored as-is in localStorage; the cross-domain cookie keeps a sanitised subset (`id`, `uuid`, `email`, `username`, `is_email_verified`).  
- **`isAuthenticated`**: persisted for quick gating.  
- **`accessToken`**: excluded from persistence (memory-only).  
- **Transient Fields**: `isLoading`, helper methods, and banner flags remain in memory.

### 4.2 Hybrid Storage Mechanics

- `hybridStorage` now wraps all values in envelopes `{ ts, tabId, payload }`.  
  - Each tab gets a stable `tabId` (stored in `sessionStorage`).  
  - On reads, the newest envelope wins; reads are pure (no side effects).  
  - On writes, localStorage and the sanitised cookie are updated with the same envelope, but writes are debounced (100 ms) to avoid storms during rapid state changes.
- Sanitisation strips sensitive fields before writing cookies to avoid the 4 KB limit and leaking unnecessary data to subdomains.

### 4.3 Cross-Tab Synchronisation

- **Logout Broadcast**: `useAuthStore.logout()` writes a `resomix-logout` timestamp to localStorage. All other tabs listen for this key and call `logout({ broadcast: false })` to clean up without re-broadcasting.
- **State Rehydration**: When a tab updates `resomix-auth-storage`, other tabs detect the storage event and call `useAuthStore.persist.rehydrate()` to pull the latest snapshot.
- **Login**: After a successful refresh or login, other tabs pick up the new state via the same rehydration listener.

---

## 5. axios & Networking

- **Global Config**: `withCredentials: true`, `baseURL` via `API_CONFIG`.
- **Request Interceptor** (`authClient`):  
  - Adds `api_key` to every request.  
  - Attaches `Authorization` if an access token is available.  
  - Logs helpful debug information (token presence, request URL).
- **Response Interceptor**:  
  - For 401s, performs a single refresh attempt (queueing other requests).  
  - Processes queued requests once refresh succeeds.  
  - Logs out if refresh fails, capturing reuse scenarios.  
  - Logs `Retry-After` headers for 429s.

---

## 6. Debugging & Diagnostics

1. **Storage Storms**: Instrument `hybridStorage` to check for excessive writes (should be rare now due to debounce + envelopes).  
2. **Cookie Issues**: Inspect `resomix-auth-storage` in DevTools → Application → Cookies for size and attributes (domain, SameSite, Secure).  
3. **Cross-Tab Sync**: Open two tabs. Logging in/out in one tab should mirror in the other without manual refresh.  
4. **Refresh Failures**: Monitor network tab for `/auth/refresh` requests; ensure only one fires during access-token expiry.  
5. **Logout Messaging**: After a forced logout (refresh token reuse), the next login view should explain why the session ended.  
6. **Rate Limits**: Trigger 429s on 2FA or reset flows and confirm the UI surfaces specific copy instead of generic errors.

---

## 7. Future Enhancements

- **Session Management UI**: Add screens for viewing and revoking active sessions once the backend exposes an API.  
- **Device Notifications**: Provide toasts or banners when another tab logs in/out.  
- **Backend Coordination**: Consider moving entirely to httpOnly cookies (access + refresh) for maximum XSS protection if the backend can accommodate.  
- **Testing**: Expand E2E coverage for multi-tab flows, refresh expiry, and forced logout scenarios.

---

## 8. File Reference

- `apps/webapp/src/pages/AuthPage.tsx` – top-level auth router.  
- `apps/webapp/src/components/OptionalAuthRoute.tsx` – verification banner & demo notice.  
- `packages/ui/src/Content/*` – form components for login, register, forgot, reset, verify email, verify 2FA, profile, sessions, change password.  
- `packages/stores/src/useAuth.ts` – Zustand store with persist + broadcast logic.  
- `packages/stores/src/cookieStorage.ts` – hybrid storage adapter.  
- `packages/hooks/src/Auth/useAuthInit.ts` – session bootstrap & refresh.  
- `packages/api-client/src/authClient.ts` – axios instance with interceptors.  
- `packages/api-client/src/utils.ts` – error normalisation.  
- `packages/api-client/src/auth/*` – individual auth-related API calls.

---

**Last reviewed**: November 12, 2025. Update this document whenever the frontend auth contract or storage strategy changes.

---

## 9. Audio Architecture (Reference)

While authentication governs access, the Resomix experience is anchored by its audio subsystem. The following sections consolidate the audio documentation so new developers can understand how playback, waveform rendering, and playlist orchestration interact with auth-gated areas.

### 9.1 Goals

1. Run two coordinated players: the uploaded/search “Input Player” and the selected “Similarity Player”.  
2. Provide seamless waveform visualisation and scrubbing.  
3. Survive mobile/browser quirks (gesture unlocking, AudioContext limits, MediaSession integration).  
4. Keep state predictable across React components and shared stores.

### 9.2 Architecture Overview

```
User Upload/Search
       ↓
   Playlist Data
       ↓
┌─────────────────┬─────────────────┐
│   Input Player  │ Similarity Player│
│   (Original)    │  (Current Track) │
└─────────────────┴─────────────────┘
       ↓                 ↓
   WaveformPlayer    WaveformPlayer
       ↓                 ↓
    useWaveform      useWaveform
       ↓                 ↓
    WaveSurfer.js    WaveSurfer.js
```

---

## 10. Core Audio Modules

### 10.1 Primary Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| `InputPlayer` | `apps/webapp/src/components/Playlist/InputPlayer.tsx` | Plays the uploaded/searched track. Persistent UI presence, integrates with `AudioProvider`, supports skip, volume, progress, autoplay. |
| `SimilarityPlayer` | `apps/webapp/src/components/Playlist/SimilarityPlayer.tsx` | Plays whichever similar track the user selects. Shares controls with `InputPlayer`, auto-advances, uses `AudioProvider`. |
| `WaveformPlayer` | `apps/webapp/src/components/Playlist/WaveformPlayer.tsx` | WaveSurfer.js wrapper; renders interactive waveforms, syncs playback state, handles seek. |
| `PeaksPlayer` (legacy) | `apps/webapp/src/components/Playlist/PeaksPlayer.tsx` | Peaks.js-based waveform (used only in testing). |
| `PlaylistHero` | `apps/webapp/src/sections/desktop/Playlist/PlaylistHero.tsx` | Displays track metadata and the `InputPlayer`. |
| `PlaylistTable` | `apps/webapp/src/sections/desktop/Playlist/PlaylistTable.tsx` | Lists similar tracks, manages play/pause actions, renders `SimilarityPlayer`. |
| `PlaylistPage` | `apps/webapp/src/pages/desktop/PlaylistPage.tsx` | Overall playlist view, handles loading/error states. |

### 10.2 Supporting Hooks

| Hook | Path | Purpose |
|------|------|---------|
| `usePlayerManager` | `packages/hooks/src/Player/usePlayerManager.ts` | Central orchestrator for playback: manages `currentTrackId`, track switching, autoplay, volume sync, MediaSession integration, playlist stats. |
| `useAudioProvider` / `useAudioProviderRef` | `packages/hooks/src/Player/useAudioProvider.tsx` | Implements BeMusic pattern (persistent audio element, gesture unlocking, playback state). |
| `useAudioContextUnlocker` | `packages/hooks/src/Player/useAudioContextUnlocker.ts` | iOS gesture preservation helper using silent audio. |
| `useWaveform` | `packages/hooks/src/Waveform/useWaveform.ts` | WaveSurfer management layer: initialisation, peaks fetching (`/peaks?uuid=`), shared AudioContext, progress callbacks. |
| `usePeaks` (legacy) | `packages/hooks/src/Waveform/usePeaks.ts` | Peaks.js wrapper for legacy/test scenarios. |

### 10.3 Stores

| Store | Path | Key State |
|-------|------|-----------|
| `usePlayerStore` | `packages/stores/src/usePlayer.ts` | `currentTrackId`, WaveSurfer refs (`inputWs`, `similarityWs`), global volume, autoplay preference, playback positions, provider readiness, uploaded media metadata. |
| `usePlaylistStore` | `packages/stores/src/usePlayList.ts` | Playlist data, track ratings, loading/error states. |

---

## 11. Audio Flow Walkthroughs

1. **Initialisation**  
   - User action (upload/search) → playlist data stored in `usePlaylistStore` → `PlaylistPage` renders hero + table.
2. **Player Setup**  
   - `InputPlayer` mounts, `AudioProvider` creates persistent audio element, `WaveformPlayer` initialises WaveSurfer, `useWaveform` fetches peaks, WaveSurfer refs registered in `usePlayerStore`.
3. **Autoplay**  
   - If enabled, `usePlayerManager.startPlaying()` fires on mount, signalling the relevant `WaveformPlayer` to start playback.
4. **Track Switching**  
   - Selecting a new track triggers `usePlayerManager.startPlaying(newTrackId)`, stopping the previous player, updating UI, and refreshing waveform data.
5. **Volume Control**  
   - `usePlayerStore.setVolume()` updates global volume, `usePlayerManager` syncs it to both WaveSurfer instances and HTML audio elements.
6. **Autoplay Next**  
   - `AudioProvider.onEnded` calls `usePlayerManager.playNext()`, advancing when autoplay is enabled.
7. **Gesture Preservation**  
   - `AudioProvider` unlocks audio on mount using silent playback, sets `playsInline`, and integrates with MediaSession.

---

## 12. Patterns and Considerations

### 12.1 BeMusic Pattern

- Create audio elements immediately (not lazily when a user taps “play”).  
- Unlock audio with silent playback to meet iOS/Android requirements.  
- Switch track sources via `audio.src` updates rather than replacing the element.  
- Track provider readiness to coordinate UI state.

### 12.2 Dual Player Strategy

- Keep the input/original track always accessible.  
- Dynamically render the current similar track with identical controls.  
- Share global controls but track per-player progress independently.

### 12.3 Mobile Optimisations

- Shared `AudioContext` to avoid iOS limits.  
- MediaSession API support for lock-screen controls.  
- `playsInline` attributes to prevent unintended full-screen behaviour.  
- Silent unlock pattern for gesture compliance.

### 12.4 Waveform Management

- Prefer fetching precomputed peaks (`/peaks?uuid=`) for performance.  
- Fallback to generating peaks locally if the API data is missing.  
- Ensure WaveSurfer instances are destroyed on unmount to prevent leaks.

---

## 13. Developer Tips

### 13.1 Adding Features

1. Extend `usePlayerStore`/`usePlaylistStore` with new state.  
2. Leverage `usePlayerManager` for playback control.  
3. Pass state via props and callbacks (`onProgress`, `onPlay`, etc.).  
4. Update MediaSession metadata when introducing new track details.

### 13.2 Debugging

- Check console logs (WaveSurfer messages are prefixed).  
- Verify `inputProviderReady`/`similarityProviderReady`.  
- Confirm silent playback unlock succeeded on mobile.  
- Inspect network calls for `/peaks` and `/signed-audio`.

### 13.3 Common Gotchas

- Respect user gesture requirements (don’t auto-play without unlocking).  
- Destroy WaveSurfer instances to avoid memory leaks.  
- Handle multiple peak data formats (array vs object).  
- Keep the shared AudioContext from exceeding connection limits.

---

## 14. Audio API Touchpoints

- `GET /peaks/?uuid=` – precomputed waveform data.  
- `GET /signed-audio/?uuid=` – signed audio stream for playback.  
- `POST /rate` – submit track ratings tied to the playlist experience.

---

## 15. Audio File Reference

```
packages/
├── hooks/src/Player/
│   ├── usePlayerManager.ts
│   ├── useAudioProvider.tsx
│   └── useAudioContextUnlocker.ts
├── hooks/src/Waveform/
│   ├── useWaveform.ts
│   └── usePeaks.ts   # legacy
├── stores/src/
│   ├── usePlayer.ts
│   └── usePlayList.ts
└── api-client/src/
    └── peaks.ts

apps/webapp/src/components/Playlist/
├── InputPlayer.tsx
├── SimilarityPlayer.tsx
└── WaveformPlayer.tsx
```

This appendix consolidates the former Audio Flow guides so developers have a single reference for both authentication and audio subsystems.

