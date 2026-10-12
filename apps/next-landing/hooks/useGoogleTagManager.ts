import { useEffect } from 'react'

const SCRIPT_ID = 'gtm-container-script'

/**
 * Injects the GTM container once `enabled` turns true. GTM in turn loads PostHog, so deferring it
 * defers both. The Consent Mode defaults and the noscript iframe stay in the root layout: the
 * defaults must run before the container or tags may fire unconsented.
 */
export function useGoogleTagManager(containerId: string | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !containerId) return
    if (document.getElementById(SCRIPT_ID)) return

    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`
    document.head.appendChild(script)
  }, [containerId, enabled])
}
