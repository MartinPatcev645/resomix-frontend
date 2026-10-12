'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { lookup } from '@/lib/lookup'
import type { CoreCopy } from '@/lib/i18n'

export type Translate = (key: string) => string

const CopyContext = createContext<Translate | null>(null)

export function CopyProvider({ copy, children }: { copy: CoreCopy; children: ReactNode }) {
  const t = useMemo<Translate>(() => (key) => lookup(copy, key), [copy])
  return <CopyContext.Provider value={t}>{children}</CopyContext.Provider>
}

export function useT(): Translate {
  const t = useContext(CopyContext)
  if (!t) throw new Error('useT must be used inside CopyProvider')
  return t
}
