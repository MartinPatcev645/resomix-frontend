'use client'

import { useSyncExternalStore } from 'react'
import { DemoStageBanner } from './DemoStageBanner'

/** Same key as apps/landing OptionalAuthRoute and the inline script in the root layout. */
const DISMISSED_KEY = 'demo_stage_notice_dismissed'

const listeners = new Set<() => void>()
let dismissedThisView = false

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isDismissed(): boolean {
  if (dismissedThisView) return true
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

function dismiss() {
  dismissedThisView = true
  try {
    localStorage.setItem(DISMISSED_KEY, 'true')
  } catch {
    /* storage blocked: dismiss for this page view only */
  }
  listeners.forEach((listener) => listener())
}

/**
 * The server snapshot is "shown", so the exported HTML and hydration agree. A visitor who dismissed
 * it is hidden by the head script before paint, then unmounted once the client snapshot is read.
 */
export function BetaNotice() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false)
  return dismissed ? null : <DemoStageBanner onDismiss={dismiss} />
}
