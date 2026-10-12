import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'public/scripts/**'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
]

export default config
