import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone embed widget. Deployed as its OWN Cloudflare Pages project (e.g. embed.resomix.com),
// so base is '/'. It intentionally depends on nothing from the main app — tiny bundle, and it
// physically cannot navigate into the full site (those routes don't exist here).
export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
})
