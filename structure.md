# Monorepo Structure & Troubleshooting Report

## 1. Project Structure

```
resomix-web/
  apps/
    landing/
      src/
      package.json
      tsconfig.json
      tsconfig.app.json
      tsconfig.node.json
    webapp/
      src/
      package.json
      tsconfig.json
      tsconfig.app.json
      tsconfig.node.json
  packages/
    ui/
      src/
      dist/
      package.json
      tsconfig.json
    hooks/
      src/
      dist/
      package.json
      tsconfig.json
    api-client/
      src/
      dist/
      package.json
      tsconfig.json
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md
```

## 2. What We Have Tried So Far

- Created shared packages: `@resomix/ui`, `@resomix/hooks`, `@resomix/api-client`.
- Each package has its own `src/` and builds to `dist/` with type declarations.
- Added `exports` and `files` fields to each package's `package.json`.
- Set up `composite: true` in each package's `tsconfig.json` for project references.
- Added project references in `apps/landing/tsconfig.app.json` and `apps/webapp/tsconfig.app.json` to the shared packages.
- Ensured all packages build and `dist/` contains the expected files.
- Verified that `node_modules/.pnpm/node_modules/@resomix/{ui,hooks,api-client}/dist` contains the built files and types.
- All packages are present in the workspace and linked by pnpm.

## 3. The Issue We Are Facing

Despite all the above, running `pnpm build` in the root results in errors in both `landing` and `webapp`:

```
src/App.tsx(2,24): error TS2307: Cannot find module '@resomix/ui' or its corresponding type declarations.
src/App.tsx(3,25): error TS2307: Cannot find module '@resomix/hooks' or its corresponding type declarations.
src/App.tsx(4,32): error TS2307: Cannot find module '@resomix/api-client' or its corresponding type declarations.
```

- The `dist/` folders are present and correct in all packages.
- The packages are present in `node_modules/.pnpm/node_modules/@resomix/` and contain the correct files.
- The error persists even after clean builds and IDE restarts.

## 4. Key Configurations

### 4.1 Shared Package: Example (`@resomix/ui`)

**package.json**
```json
{
  "name": "@resomix/ui",
  "version": "0.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "react": "^18.0.0",
    "@types/react": "^18.0.0"
  },
  "private": "true",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationDir": "dist",
    "emitDeclarationOnly": false,
    "outDir": "dist",
    "module": "ESNext",
    "target": "ES2020",
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### 4.2 App: Example (`apps/landing/tsconfig.app.json`)

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/ui" },
    { "path": "../../packages/hooks" },
    { "path": "../../packages/api-client" }
  ]
}
```

### 4.3 pnpm-workspace.yaml

```
packages:
  - "apps/*"
  - "packages/*"
```

### 4.4 turbo.json (relevant part)

```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**"],
      "dependsOn": ["^build"]
    }
  }
}
```

## 5. Diagnostics

- All shared packages are present in `node_modules/.pnpm/node_modules/@resomix/` and contain the correct `dist/` files.
- All `dist/` folders contain the expected `.js` and `.d.ts` files.
- All configs are set for project references and type declarations.
- The error persists despite all above.

## 6. Next Steps / Open Questions

- Is there a TypeScript or Vite config in the apps that could be interfering with module resolution?
- Is there a pnpm or turbo cache issue? (Try `pnpm install --force` and `pnpm build --force`)
- Is the IDE or TypeScript version out of sync with the workspace?
- Should we try adding explicit `paths` in the app's `tsconfig`?

---

**This file documents the current state, what has been tried, and the persistent import issue for further debugging or sharing with collaborators.** 