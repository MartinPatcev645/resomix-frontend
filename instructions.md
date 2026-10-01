# Resomix Web — Engineering Instructions

Conventions for `resomix-web`. These are rules, not suggestions — the codebase is consistent today
and should stay that way. Assumes you know React/TS; this only covers what is **specific to us**.

---

## 0. The non-negotiables

1. **Always import via alias** (`@/`, `@resomix/*`). Never `../../`.
2. **Always update the `index.ts` barrel** when you add a component / page / section / hook / API fn.
3. **Check `packages/ui` before building any component.** Reuse beats re-creation.
4. **Never hardcode sizes.** Every dimension is `var(--px-N)`.
5. **Functionality goes in hooks**, components render.
6. **Assets go in `src/assets/…` and are imported as modules**, never inlined or hot-linked.
7. **Pages never render the Navbar or Footer** — the layout shell owns them.
8. **Desktop and mobile are two code paths.** Change one → check the other.

---

## 1. Repo map

| Path | What | Deploys to |
|---|---|---|
| `apps/landing` | Marketing site. **i18n (i18next)** | resomix.com |
| `apps/webapp` | The product. No i18n | beta.resomix.com |
| `apps/admin` | Internal. **Different stack (antd)** — do not copy patterns in/out | internal |
| `packages/ui` | Shared React components + the design system | — |
| `packages/hooks` | Shared behaviour/data hooks | — |
| `packages/stores` | Zustand stores | — |
| `packages/api-client` | Typed backend wrappers + `authClient` | — |
| `packages/config` | `VITE_*` env → typed constants | — |

pnpm workspaces + Turbo + Vite + React 19 + React Router + Tailwind v4.
All five packages are vite-aliased to their `src/` — **edits are live, no package rebuild needed.**

```bash
pnpm install
pnpm dev:landing   # :5173
pnpm dev:webapp    # :5174
pnpm dev:admin     # :5175
pnpm build:webapp  # turbo, per-app
```

---

## 1b. Environment setup (one time)

Each app reads its **own** `.env` from `apps/<app>/.env`. `.env` is gitignored; `env.example` is
committed. Only `VITE_`-prefixed vars reach the browser — **never put a secret in one**, everything
here ships in the bundle. Vars are read once at build time via `@resomix/config`; **restart the dev
server after editing `.env`.**

Copy-paste for local development:

```bash
# ── apps/landing/.env ─────────────────────────────────────
VITE_BASE_LANDING_URL=http://localhost:5173
VITE_BASE_BETA_URL=http://localhost:5174
VITE_SERVER_BACKEND=http://localhost:8001
VITE_SERVER_MEDIA=http://localhost:8002
VITE_FACEBOOK_URL=https://www.facebook.com/resomix
VITE_INSTAGRAM_URL=https://www.instagram.com/resomix
VITE_TWITTER_URL=https://x.com/resomix
VITE_SOUNDCLOUD_URL=https://soundcloud.com/resomix
```

```bash
# ── apps/webapp/.env ──────────────────────────────────────
VITE_BASE_LANDING_URL=http://localhost:5173
VITE_BASE_BETA_URL=http://localhost:5174
VITE_SERVER_BACKEND=http://localhost:8001
VITE_SERVER_MEDIA=http://localhost:8002
VITE_FACEBOOK_URL=https://www.facebook.com/resomix
VITE_INSTAGRAM_URL=https://www.instagram.com/resomix
VITE_TWITTER_URL=https://x.com/resomix
VITE_SOUNDCLOUD_URL=https://soundcloud.com/resomix

# Redacts catalogue metadata in the UI. Use false locally to see real data.
VITE_DEMO_MODE=false

# Google sign-in. MUST be the same client id the backend has as GOOGLE_CLIENT_ID,
# or "Continue with Google" fails token verification. Ask for the dev client id.
VITE_GOOGLE_CLIENT_ID=
```

```bash
# ── apps/admin/.env ───────────────────────────────────────
VITE_BASE_LANDING_URL=http://localhost:5173
VITE_BASE_BETA_URL=http://localhost:5174
VITE_SERVER_BACKEND=http://localhost:8001
VITE_SERVER_MEDIA=http://localhost:8002
```

**Reference:**

| Var | Apps | Notes |
|---|---|---|
| `VITE_BASE_LANDING_URL` / `VITE_BASE_BETA_URL` | all | Cross-app links. Wrong values silently break landing↔webapp navigation |
| `VITE_SERVER_BACKEND` | all | Alwyzon origin → `API_CONFIG.BASE_URL`. Bare origin, **no path suffix**. Defaults to `https://bserver.resomix.com` if unset — so a missing value silently talks to **production** |
| `VITE_SERVER_MEDIA` | all | Media/similarity server (HLS, previews, peaks) |
| `VITE_DEMO_MODE` | webapp | `true` masks catalogue metadata (`"dEm0"` ids) |
| `VITE_GOOGLE_CLIENT_ID` | webapp | Must match the backend's `GOOGLE_CLIENT_ID` |
| `VITE_TELEMETRY_HEARTBEAT_MS` | webapp | Optional, has a default |
| `VITE_SPOTIFY_CLIENT_ID` / `VITE_TIDAL_CLIENT_ID` | webapp | Only for the (dormant) transfer features |
| `VITE_FACEBOOK/INSTAGRAM/TWITTER/SOUNDCLOUD_URL` | landing, webapp | Footer links |

> **Known drift — don't be misled by `env.example`:** the examples omit `VITE_GOOGLE_CLIENT_ID`, and still list `VITE_PUBLIC_POSTHOG_KEY` / `VITE_PUBLIC_POSTHOG_HOST`
> and `VITE_BASE_ADMIN_URL`, which are **referenced nowhere in the code**. Use the blocks above.
> If you add a new var, add it to the app's `env.example` **and** this table.

---

## 2. Imports — always aliased

```ts
import { Navbar, ButtonHeavyRight } from "@resomix/ui";
import { useResponsive } from "@resomix/hooks";
import { useAuthStore } from "@resomix/stores";
import { getPlaylist } from "@resomix/api-client";
import { BASE_BETA_URL } from "@resomix/config";
import { WebLayout } from "@/components/index.ts";
import AngleLeftSvg from "@/assets/icons/angle_left.svg";
```

- `@/` → the current app's `src/`.
- `@resomix/*` → workspace packages.
- **Zero `../../` imports exist in landing/webapp. Keep it at zero.** Same-folder `./x.tsx` is fine.

---

## 3. Barrels — update them or your code is unreachable

Adding a file is only half the job. Register it:

| You added | Update |
|---|---|
| Shared component | `packages/ui/src/index.ts` (import **and** export lists) |
| Shared hook | `packages/hooks/src/index.ts` (+ domain `index.ts` if the folder has one) |
| Store | `packages/stores/src/index.ts` |
| API function | its module + `packages/api-client/src/index.ts` |
| App component | `apps/<app>/src/components/index.ts` |
| Page | `apps/<app>/src/pages/index.ts` |
| Section | `apps/<app>/src/sections/{desktop,mobile}/index.ts` |

`packages/ui/src/index.ts` is an explicit import-then-export barrel — add your component to **both** blocks.

---

## 4. Assets

Place files under the app's assets tree, then import as a module:

```
src/assets/icons/    # SVG (most things)
src/assets/images/   # raster
src/assets/gifs/
```

```tsx
import AngleLeftSvg from "@/assets/icons/angle_left.svg";

<img src={AngleLeftSvg} alt="" aria-hidden="true" loading="lazy" draggable={false}
     className="w-[var(--px-14)] h-[var(--px-14)]" />
```

Rules: kebab/snake filenames · decorative icons get `alt="" aria-hidden="true"` · meaningful icons get a
real `alt` · always `loading="lazy"` + `draggable={false}` · never paste raw `<svg>` markup into a page.

---

## 5. Reuse before you build

**Before writing a component, read `packages/ui/src/index.ts`.** Existing families:

`Buttons/` (ButtonHeavyLeft/Right, ButtonSleek, IconButton, LinkButton, ToggleButton, RoundContainer) ·
`Elements/` (FormInput, PasswordInput, FormError, SearchInput, SearchDropdown, StatusMessage,
ProfileDropdown, IconComp, TextComp, CartIcon, banners) · `Modals/` (StatusModal, ConfirmModal,
InputModal) · `Layout/` (Navbar, MobileNavbar, SideLines, GlobalFooter, GlobalMobileFooter,
InfoPageLayout, Tooltip, WelcomeMessage, TermsAcceptance) · `Content/` (Login, Register, Profile,
Sessions, Contact, Error404, …) · `Billing/` · `Auth/` · `Animations/` · `Vectors/`

Placement rule:
- Used by **more than one app or page** → `packages/ui`.
- Genuinely app-specific → `apps/<app>/src/components/`.
- Needs a new variant? **Extend the existing component with a prop.** Do not fork it.

---

## 6. Functionality lives in hooks

Components render markup. Anything else is a hook.

- Data fetching / mutations / polling → `packages/hooks/src/<Domain>/useX.ts`
  (`Auth`, `Playlist`, `Player`, `Similarity`, `Library`, `Cart`, `Entitlements`, `Transfer`, …)
- Shared client state → zustand store in `packages/stores`, accessed with a **selector**:
  `useAuthStore(s => s.isAuthenticated)` — not `const { x } = useStore()` for hot paths.
- **Gated actions (share/rename/export/favorite/rate/upload) go through `useAccess()`** — one
  verdict per action: `allowed | login | upgrade | pending`. Never gate UI on
  `useAuthStore.isAuthenticated` or raw `useEntitlements` fields: mixing those signals is what
  caused logged-in users to see "log in" modals. `pending` = dim the control and no-op; never
  raise a gate modal from an unsettled state. Plan-agnostic by design — new plans (basic/max)
  need zero frontend changes.
- HTTP → `packages/api-client`. Authenticated calls **must** go through `authClient`
  (it attaches the Bearer token and serialises refresh on 401).

A page/section may call `api-client` directly for a trivial one-shot read, but anything with loading
state, retries, caching, or reuse belongs in a hook.

---

## 7. Design system

### 7.1 Fluid rem — understand this first
The rem unit scales with the viewport; the design is authored at **1280px desktop / 393px mobile**:

```css
html { font-size: clamp(12.8px, 1.25vw, 32px); }                        /* desktop */
@media (max-width:1023px){ html{ font-size: clamp(10px, 4.07vw, 26px);} } /* mobile  */
```

All `--px-*` tokens are **rem**, so the whole UI scales 1280→2560px automatically. You do not need
breakpoints for sizing.

### 7.2 Tokens
- **Sizing:** `var(--px-N)` from `src/styles/pixels.css` (~268 steps, incl. fractional `--px-10-37`).
  Missing a step? **Add it to `pixels.css`** — never inline a rem/px value.
- **Colour:** `--color-primary` (fg), `--color-secondary` (bg), `--color-primary-background`,
  `--color-secondary-background`, `--color-primary-hover`, `--color-text-secondary`,
  `--color-neon-orange` (sole accent), `--opacity-10…95`.
- **Theme:** `:root` = dark (default), `.light` overrides. **Test both.**

### 7.3 Tailwind v4
No config file. Utilities are arbitrary values wrapping tokens; font-size needs the `length:` hint:

```tsx
className="text-[length:var(--px-17)] leading-[var(--px-20)] gap-[var(--px-40)]
           tracking-[var(--px-0-25)] font-light font-helvetica uppercase"
```

Never `text-sm`, `p-4`, `w-64`, or raw px. `index.css` has `@source "../../../packages/ui/src"`, so
classes only generate for files under the app `src/` or `packages/ui/src`.

### 7.4 Visual language
- **Dotted borders are the brand.** `border border-dotted border-slate-200` (`/60`, `/30` for
  hierarchy); dividers are `border-t border-dotted`. Used in 45+ files — match it.
- **Fonts:** `font-helvetica` (UI/headlines, usually `uppercase` + `font-light`/`font-medium`),
  `font-fira` (mono: code, timers, metadata).
- **Background:** `StaticNoise` is mounted **once by the layout**. Never add a second one.
- **z-index:** noise/frame `z-1` · content `z-20`/`z-30` · frame inset `z-[60]` · navbar `z-[70]` ·
  mobile menu `z-[100]` · upload overlay `z-[9999]`. **Content needs `z-20`+ or the noise covers it.**

---

## 8. Responsive strategy — one file or two?

**Default: one component with two breakpoints.** Base classes = mobile, `lg:` = desktop, both sized
with `--px-*` tokens so the two views stay consistent:

```tsx
<div className="px-[var(--px-20)] lg:px-[var(--px-63)]
                text-[length:var(--px-13)] lg:text-[length:var(--px-11)]">
```

Use this for **content pages, forms, cards, info pages** — anything whose structure is the same and
only the spacing/scale differs.

**Escalate to separate `desktop/` + `mobile/` files only when** the DOM structure genuinely diverges
(different element order/nesting), the component needs different behaviour or data per view, or the
single file would turn into a thicket of conditionals. Then:

```
pages/desktop/FooPage.tsx     sections/desktop/Foo/FooOne.tsx
pages/mobile/FooMobile.tsx    sections/mobile/Foo/FooOne.tsx
```
and switch at the route:

```tsx
function FooLanding() {
  const { isDesktop } = useResponsive();   // breakpoint: 1024px
  return isDesktop ? <FooPage /> : <FooMobile />;
}
```

⚠️ **Splitting doubles your maintenance and is our main source of bugs** (desktop/mobile gates
drifting apart). Prefer one file. If you split, fix both sides in the same change.

---

## 9. Pages & sections

Three archetypes:

| Type | Example | Shape |
|---|---|---|
| **Section page** | landing `AboutPage`, webapp home | Ordered numbered sections |
| **Content page** | `InfoPage mode="contact"` | Thin wrapper picking a `@resomix/ui` Content component |
| **App page** | `LibraryPage`, `AnalysisPage` | Hooks + stores + api-client |

A section page is literally a list:

```tsx
export function AboutPage() {
  return (
    <div className="overflow-hidden">
      <AboutHero /><AboutOne /><AboutTwo /><AboutThree />
    </div>
  );
}
```

Sections live in `sections/{desktop,mobile}/<Page>/` and are named `<Page>Hero`, `<Page>One`,
`<Page>Two`, … in render order. **Pages render content only** — Navbar, SideLines, footer and noise
come from `WebLayout` / `LandingLayout` (or `InfoPageLayout` for standalone pages).

---

## 10. Adding a route — checklist

1. Create the page (§8 decides one file or two).
2. `lazy()` import at the top of `App.tsx`.
3. Add `<Route>` in the correct guard group: `ProtectedRoute` (auth required, redirects to login and
   preserves `state.from`), `GuestRoute` (logged-out only), or plain (optional auth).
4. **Update the layout's `mode` useMemo** (`WebLayout.tsx`) — it maps pathname → navbar mode and
   otherwise falls through to `'404'`. Most-missed step.
5. Check the `SideLines` `mode` semantics: `about | upload | playlist | home` are hero pages (no SVG
   frame notch); everything else gets the framed treatment.
6. Update `pages/index.ts` if anything imports the page.
7. Cross-app links use `BASE_LANDING_URL` / `BASE_BETA_URL` from `@resomix/config` and go through the
   layout's `handleNavigate` so they stay SPA transitions instead of full reloads.

Note `/auth/*`, `/profile`, `/subscribe`, `/contact`, `/error` and 404 exist in **both** landing and
webapp — changing "the profile page" usually means touching both.

---

## 11. i18n (landing only)

No literal copy in landing sections. Use `useTranslation('common')` + `t('about.about_one.headline')`
and add keys to `src/locales`. Strings may contain markup and are rendered with
`dangerouslySetInnerHTML` — keep that pattern. **webapp has no i18n**; plain strings there.

---

## 12. Before you push

- [ ] All imports aliased; no `../../`
- [ ] Barrel `index.ts` updated for every new file
- [ ] Reused existing `@resomix/ui` components; new shared ones live there and are exported
- [ ] Logic in hooks; auth'd HTTP via `authClient`
- [ ] Only `var(--px-*)` / `var(--color-*)`; new steps added to `pixels.css`
- [ ] Assets in `src/assets/…`, imported as modules, with `aria-hidden`/`loading`/`draggable`
- [ ] Both themes checked; mobile, 1280px **and** wide (≥1920px) checked
- [ ] If desktop/mobile files are split, **both** updated
- [ ] Route registered, guard correct, layout `mode` updated
- [ ] New env var? added to `env.example` **and** the §1b table — and it holds no secret
- [ ] `pnpm build` (or `pnpm --filter <app> build`) passes

> ⚠️ **Never verify with `tsc --noEmit -p apps/<app>/tsconfig.json`.** Each app's root `tsconfig.json`
> is a *solution* file — `"files": []` plus `references` to `tsconfig.app.json` / `tsconfig.node.json`.
> Pointing `-p` at it typechecks **nothing** and exits 0 while real errors sit in your code. The build
> script uses `tsc -b`, which follows the references. Use `pnpm build`, or `tsc -b apps/<app>`.
