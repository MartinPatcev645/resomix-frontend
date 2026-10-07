# 21st.dev MCP & CLI Setup (documented, NOT executed)

Status: Draft — awaiting approval (Gate 3). **Nothing is installed; no MCP config was touched.**
Repository snapshot: `george-updates` at `2e00707`
Verified against live official pages on 2026-07-22: `https://21st.dev/mcp` (official CLI & MCP page), `https://21st.dev/pricing`, `https://github.com/21st-dev` (`magic-mcp`, `cli`, `registry` repos)
Last reviewed: 2026-07-22

## Verified capabilities (official, 2026-07-22)

- **21st MCP** (formerly "Magic MCP" — `@21st-dev/magic` still works) connects **Cursor, Claude Code, Windsurf, or any MCP client** to the registry: semantic search across components/themes/templates, component install into the project (npm deps included), SVG logo search, bookmarks/lists retrieval, team libraries, publishing/management. Per-client setup tabs exist on `/mcp` for CLI · Claude · Codex · Cursor · Lovable · MCP.
- **CLI**: one global install; `21st login` opens the browser and saves a token locally; usable "anywhere — no per-editor setup"; example command shown officially: `21st add button`. CI/scripts: skip login and pass `--api-key $API_KEY_21ST` (or set the env var). API keys managed at `https://21st.dev/settings/api-keys`.
- **Limits (pricing page)**: Hobby free — full browsing, **2 component copies/installs per day, 2 MCP searches/day**(listed as "Component search & install via MCP: 2/day"), unlimited SVG logo search; Builder ($6/mo yearly) — unlimited copies/installs, MCP/CLI search, 100 AI credits/mo; Team ($7.50/seat/mo) — Builder + shared team collections, centralized billing, admin controls. Payments non-refundable (terms at `/terms`).
- **Registry format**: components publish in shadcn registry format; every component also has a shadcn CLI install command and an AI-ready copy-prompt.
- Note: the previously assumed commands `npm i -g @21st-dev/cli` / `21st init --client claude|cursor` were **not directly confirmed** in fetched text (the exact per-client commands sit behind interactive tabs). At setup time, copy the exact commands from the live `/mcp` page tabs — do not run remembered commands.

## Setup outline (to execute only after Gate 3 approval)

1. **Global CLI install + login** — exact command from `/mcp` (global install; `21st login` browser flow; token stored locally by the tool).
2. **Claude Code connection** — per the `/mcp` "Claude" tab (MCP client registration).
3. **Cursor connection** — per the `/mcp` "Cursor" tab; Cursor **user-level** configuration stays outside the project when the official tool places it there.
4. **Verification** — run one free semantic search (e.g., `accessible accordion`) from each client; confirm results; run `21st --version`.
5. **Disconnect/uninstall** — remove the MCP server entry from the client config; remove the global CLI package; revoke tokens/keys at `21st.dev/settings/api-keys`.

## Security rules (binding)

Never place any 21st key (`21st_sk_*` or `API_KEY_21ST` values) in application source, in any `VITE_*` variable, or in a commit. Inspect generated MCP configuration before committing anything; if `.mcp.json` contains a secret, keep it local and gitignored. Prefer environment-variable references for scripts/CI. Never expose keys in reports, screenshots, logs, or Markdown. Never store 21st credentials in `apps/*/.env`.

## Approval gate (approve each separately)

1. Global CLI installation · 2. Claude Code MCP connection · 3. Cursor MCP connection · 4. Free (Hobby) vs paid plan — note: Hobby's 2 searches + 2 installs/day is enough for the first manual scouting cycle; Builder becomes worthwhile once repeated retrieval starts · 5. Whether team lists/private libraries are needed (Team plan).

**Recommendation:** run one manual, documentation-only scouting cycle first (website browsing, zero installs); approve the policy; then connect MCP/CLI for repeated search and retrieval.

## Change history

- 2026-07-22 — Initial setup policy from live verification. Author: Claude.
