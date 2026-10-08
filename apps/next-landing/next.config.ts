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
  agentRules: false,
}

export default nextConfig
