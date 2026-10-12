'use client'

import { useAfterIdle, useGoogleTagManager } from '@/hooks'
import { GTM_ID } from '@/lib/site'

/**
 * Loads the GTM container 4 s after load and idle, the same stage as apps/landing's App.tsx.
 * Consent is enforced by the Consent Mode defaults in the root layout, not by this delay.
 */
export function GoogleTagManager() {
  const analyticsReady = useAfterIdle(4000)
  useGoogleTagManager(GTM_ID, analyticsReady)
  return null
}
