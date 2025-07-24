# Resomix Monorepo Guide

> One repo · Two apps · Three shared packages · Turbo‑powered builds

---

## 1. Project Overview

| Path                    | Purpose                                                   | Deploy target         |
| ----------------------- | --------------------------------------------------------- | --------------------- |
| **apps/landing**        | Static/SPA marketing site                                 | `resomix.com`         |
| **apps/webapp**         | Full React product (authenticated, feature‑rich)          | `beta.resomix.com`    |
| **packages/ui**         | Re‑usable React components + **Tailwind preset**          | NPM workspace package |
| **packages/hooks**      | Shared custom hooks (state, auth, analytics, media, etc.) | NPM workspace package |
| **packages/api‑client** | Typed wrappers for backend REST/GraphQL endpoints         | NPM workspace package |
| **turbo.json**          | Task graph & caching rules                                | —                     |
| **pnpm-workspace.yaml** | Declares the workspace boundaries (monorepo root)         | —                     |

---

## 2. Prerequisites

* **Node ≥ 20.10** (22 recommended) – enables `crypto.hash` required by Vite 7.
* **pnpm ≥ 10** – workspace‑aware package manager.
* **Git** – with LFS if you plan to store large media assets.

---

## 3. Bootstrap

```bash
# clone & enter
git clone <repo> && cd resomix-web

# install everything (root scope)
pnpm install

# run dev servers (in parallel terminals)
pnpm dev:landing    # http://localhost:5173
pnpm dev:webapp     # http://localhost:5174
```

To build all packages:

```bash
pnpm build          # turbo run build
```

> `TURBO_DISABLE_DAEMON=1 pnpm build` disables the background daemon if required.

---

## 4. Folder Layout

```
resomix-web/
│  pnpm-workspace.yaml
│  turbo.json
│  package.json  # ⇦ root‑level, private, no code
│  README.md
├─ apps/
│  ├─ landing/    # Vite + React + TS + Tailwind (marketing)
│  └─ webapp/     # Vite + React + TS + Tailwind (product)
├─ packages/
│  ├─ ui/
│  │   ├─ src/    # <Button/>, <Card/>, Tailwind preset, etc.
│  │   └─ tsconfig.json
│  ├─ hooks/
│  │   ├─ src/
│  │   └─ tsconfig.json
│  └─ api-client/
│      ├─ src/
│      └─ tsconfig.json
└─ .vscode/       # shared workspace settings (optional)
```

---

## 5. Tailwind CSS Setup

Tailwind lives in **packages/ui** and is consumed by both apps so you only
define your design‑tokens once.

### 5.1 Preset export (packages/ui/tailwind‑preset.ts)

```ts
import type { Config } from 'tailwindcss'

export default {
  content: [],              // each app adds its own paths
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00D38A',
          dark: '#00865F'
        }
      }
    }
  },
  plugins: []
} satisfies Config
```

> If you need component‑level styles (e.g. `.btn`), co‑locate them in
> `src/index.css` and export via NPM package as well.

### 5.2 App‑level tailwind.config.ts

```ts
import preset from '@resomix/ui/tailwind-preset'
import { join } from 'path'

export default {
  presets: [preset],
  content: [join(__dirname, 'src/**/*.{ts,tsx}')],
} satisfies import('tailwindcss').Config
```

### 5.3 `postcss.config.cjs`

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

### 5.4 Global CSS entry

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Import this file once in `main.tsx` of each app.

---

## 6. Development Workflow

### 6.1 Daily commands

| Task                      | Command                           |
| ------------------------- | --------------------------------- |
| Run marketing site        | `pnpm dev:landing`                |
| Run product app           | `pnpm dev:webapp`                 |
| Build all (CI)            | `pnpm build`                      |
| Build just one package    | `pnpm --filter @resomix/ui build` |
| Add dep to *landing*      | `pnpm add <pkg> --filter landing` |
| Add shared dep everywhere | `pnpm add -w -D <types>@latest`   |

### 6.2 Creating a new shared component

1. Inside **packages/ui/src/** add `MyComponent.tsx`.
2. Export it from `src/index.ts`.
3. Run `pnpm build` once to generate `dist/` (ESM + d.ts).
4. Import in an app: `import { MyComponent } from '@resomix/ui'`.
5. Turbo caches the build; subsequent app builds skip unchanged packages.

### 6.3 Coding guidelines

* **Keep packages framework‑agnostic** where possible (no DOM in hooks).
* **Co‑locate tests** next to code (`MyHook.test.ts`).
* Use **absolute imports** with the baseUrl in each tsconfig.
* Stick to **semantic commit messages**: `feat(ui): add <Button> variant`.

---

## 7. Testing & Linting (optional but recommended)

```bash
pnpm add -w -D vitest @testing-library/react eslint prettier eslint-config-prettier
```

* Add a root‑level **vitest.config.ts** and **.eslintrc.cjs**.
* Turbo task example:

```jsonc
"tasks": {
  "test": { "cache": false, "outputs": [] },
  "lint": { "cache": false, "outputs": [] },
  "build": { "outputs": ["dist/**"], "dependsOn": ["^build"] }
}
```

Run all tests: `pnpm turbo run test`.

---

## 8. Deployment (Cloudflare Pages)

| Project     | Root dir       | Build command                                             | Output |
| ----------- | -------------- | --------------------------------------------------------- | ------ |
| **landing** | `apps/landing` | `pnpm i --frozen-lockfile && pnpm --filter landing build` | `dist` |
| **webapp**  | `apps/webapp`  | `pnpm i --frozen-lockfile && pnpm --filter webapp build`  | `dist` |

Set **Build watch paths** so each Page deploys only when its files (or
`packages/**`) change.

> Cloudflare Pages ship Node 20 LTS—works out of the box.

---

## 9. CI / GitHub Actions snippet (example)

```yaml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build --filter webapp --filter landing  # build only apps
```

---

## 10. Troubleshooting

| Symptom                              | Fix                                            |
| ------------------------------------ | ---------------------------------------------- |
| `crypto.hash is not a function`      | Upgrade Node to ≥ 20.10 or 22.x                |
| `tsc is not recognized`              | `pnpm add -w -D typescript`                    |
| Turbo warns about `pipeline` field   | Use `"tasks"` key in **turbo.json**            |
| pnpm warns *"Ignored build scripts"* | `pnpm approve-builds` (usually safe to ignore) |

---
