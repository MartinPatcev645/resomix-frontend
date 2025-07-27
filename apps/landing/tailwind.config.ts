import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'helvetica': ['Helvetica_Neue', 'sans-serif'],
        'auger': ['Auger Mono', 'monospace'],
        'fira': ['Fira Code', 'monospace'],
        'montserrat': ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
