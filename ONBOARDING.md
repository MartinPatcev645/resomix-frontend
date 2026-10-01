# Frontend onboarding (resomix-web)

Welcome. You will work in two repositories. This guide covers the frontend. The backend has its own
guide at `basic_fastapi_server_resomix/ONBOARDING.md`. Set the backend up first, because the
frontend needs an API to talk to.

| Repo | What it is | Runs on |
|---|---|---|
| `resomix-web` | The frontend monorepo. `apps/webapp` is the product (beta.resomix.com), `apps/landing` the marketing site, `apps/admin` the internal admin panel, `apps/embed` the playlist widget | `localhost:5174` / `5173` / `5175` |
| `basic_fastapi_server_resomix` | "Alwyzon", the main API, and the only server the browser talks to for data | `localhost:8001` |

The stack is React 19, TypeScript, Vite, Tailwind v4, React Router and Zustand, with pnpm workspaces
and Turbo. The admin app uses Ant Design. Each app deploys to Cloudflare Pages from `demo` (staging)
and `main` (production). Commands below are for **Windows PowerShell**.

## How we work with git

- `demo` is staging and `main` is production.
- You push **only to your own branch, `martin`**. Never push to `demo` or `main`.
- Every change reaches `demo` through a pull request from `martin`, and Usman reviews it.
- Keep each pull request to one change, small enough to review in one sitting.

```powershell
git checkout demo
git pull
git checkout -b martin          # first time only; later: git checkout martin
git merge demo                  # bring martin up to date before you start
# ...work, commit...
git push -u origin martin
```

Then open a pull request on GitHub with base `demo` and compare `martin`.

## 1. Install the tools

- **Node 22** from nodejs.org, or with nvm-windows (`nvm install 22`, then `nvm use 22`).
- **pnpm** through Corepack, which picks the exact version this repo pins. Run
  `corepack enable` once in an administrator PowerShell.
- **Git**, then `git config --global core.autocrlf input` so Windows line endings never land in a
  commit.

## 2. Set up and run

```powershell
git clone git@github.com:Resomix/resomix-web.git
cd resomix-web
git checkout demo
pnpm install
```

Each app reads its own `apps/<app>/.env`. Create `apps/webapp/.env` (and `apps/landing/.env`,
`apps/admin/.env` when you work on those) from the blocks in section 1b of `instructions.md`.

- `VITE_SERVER_BACKEND` is the API. Use `http://localhost:8001` for your local backend, or the
  staging API when you need uploads or similarity. **Always set it.** When it is missing, the app
  silently talks to production.
- Ask Usman for the staging URLs and the Google sign-in client id.
- Restart the dev server after editing `.env`.

```powershell
pnpm dev:webapp     # http://localhost:5174
pnpm dev:landing    # http://localhost:5173
pnpm dev:admin      # http://localhost:5175
```

**What works locally.** Against your local backend you get sign-up and login, the library,
playlists, the plans and billing screens and the admin panel. Track uploads, similarity results,
audio previews and playback, and Track Intelligence need the staging backend, because they depend on
a media server and a GPU server that only run there.

## 3. Coding practices

`instructions.md` is the rulebook. Read it end to end before your first change. These are the rules
that matter most.

- **Imports always use aliases** (`@/`, `@resomix/ui`, `@resomix/hooks` and so on), never `../../`.
- **Every new file is exported from its folder's `index.ts`.** Unexported code is unreachable.
- **Check `packages/ui` before building a component.** Reuse beats re-creation. A new shared
  component goes in `packages/ui` and is exported from there.
- **Logic goes in hooks, components only render.** Pages stay thin. Helper functions do not live
  inside a page file.
- **Never hardcode sizes or colours.** Use the `var(--px-N)` and `var(--color-*)` tokens.
- **Desktop and mobile are two code paths.** Change one and check the other, at mobile, 1280px and
  1920px wide, in both themes.
- **"Can this user do X" always goes through `useAccess()`.** Never decide it from login state or
  raw plan fields.
- **All HTTP goes through `@resomix/api-client`** (and `authClient` for logged-in calls). No `fetch`
  or `axios` inside components.
- **The browser only talks to Alwyzon for data.** Never call the media or analysis services directly
  for JSON. Alwyzon filters what leaves it, and a direct call skips that.
- **Never put a secret in a `VITE_` variable.** Everything in one ships in the public bundle. A new
  variable goes in the app's `env.example` and the table in `instructions.md`.
- **Adding a route** has a checklist in section 10 of `instructions.md`. The most missed step is the
  layout `mode` in `WebLayout.tsx`.
- **Comments explain why**, not what. When unsure how something should be built, ask before
  building it.

## 4. Tests and checks

- **Build.** Run `pnpm build` from the repo root. It type-checks every app and must pass before any
  pull request. `tsc --noEmit -p apps/<app>/tsconfig.json` looks like a check but checks nothing.
- **Unit tests.** Run the spec files you touched from `apps/webapp`, one at a time.

  ```powershell
  cd apps/webapp
  pnpm vitest run src/test/analysisTabs.spec.tsx
  ```

  The whole suite at once is heavy. Run it only when asked.
- **Lint.** `pnpm --filter ./apps/webapp lint`.
- **New logic gets a test.** A new hook or utility gets a spec in `apps/webapp/src/test/`.
- **Internal names.** `src/test/internalNames.spec.ts` scans the whole repo for internal names that
  must never appear in it. If it fails on your change, ask before working around it.

## 5. Before you open a pull request

- [ ] `pnpm build` passes
- [ ] The spec files for what you changed pass, and new logic has a test
- [ ] Desktop and mobile both checked, in both themes
- [ ] Barrels updated, imports aliased, no hardcoded sizes
- [ ] No secrets, no `.env` file, no stray `console.log`
- [ ] The pull request says what changed and why, with screenshots for any visual change

## Reference

- `instructions.md` is the frontend rulebook, including the full pre-push checklist (section 12).
- `docs/routes.md` is the API endpoint reference.
- `docs/DESIGN_SYSTEM.md` covers the tokens and visual language.
