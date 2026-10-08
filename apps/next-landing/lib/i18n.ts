import core from '@/locales/en/core.json'
import home from '@/locales/en/home.json'
import { lookup, lookupValue } from '@/lib/lookup'

const messages = { ...core, ...home }

/** Build-time translation. Same dotted keys as the Vite `t('home…')` / `t('nav…')` calls. */
export function t(path: string): string {
  return lookup(messages, path)
}

export function tValue<T>(path: string): T {
  return lookupValue<T>(messages, path)
}

export type CoreCopy = typeof core

export { core }
