import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './embed.css'
import EmbedPlaylist from './EmbedPlaylist.tsx'
import { readTheme } from './api.ts'

// Apply the theme (from ?theme=) before first paint so there's no flash. Defaults to dark.
document.documentElement.dataset.theme = readTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EmbedPlaylist />
  </StrictMode>,
)
