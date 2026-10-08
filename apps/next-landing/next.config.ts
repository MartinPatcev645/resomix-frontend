import type { NextConfig } from 'next'

/**
 * Static export for a separate Cloudflare Pages project.
 *
 * `trailingSlash: false` matches the current Vite prerender, which writes flat
 * files (`about.html`, not `about/index.html`). Cloudflare would 308 a directory
 * index to the slashed URL, and the canonicals are unsuffixed except `/`.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  images: { unoptimized: true },
  // Only stops `next dev` writing a Next-managed block into AGENTS.md; this repo's agent rules live
  // in instructions.md and .cursor/rules. No effect on the export or the Markdown twins.
  agentRules: false,
}

export default nextConfig
