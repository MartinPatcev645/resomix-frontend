import { useEffect, useState } from 'react'

/**
 * Becomes true once the page has loaded AND the browser is idle, optionally after a further delay.
 * Stages third-party scripts so they never compete with first paint.
 *
 * Not a consent gate: the Consent Mode defaults in the root layout run inline before anything is
 * scheduled here. `requestIdleCallback` is missing in Safari <16.4, so a timeout fallback is always
 * armed. The result is a one-way latch.
 */
export function useAfterIdle(delayMs = 0): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let idleHandle: number | undefined
    let timeoutHandle: number | undefined
    let delayHandle: number | undefined
    let done = false

    const fire = () => {
      if (done) return
      done = true
      setReady(true)
    }

    const schedule = () => {
      delayHandle = window.setTimeout(() => {
        if (window.requestIdleCallback) {
          idleHandle = window.requestIdleCallback(fire, { timeout: 3000 })
        }
        timeoutHandle = window.setTimeout(fire, 3000)
      }, delayMs)
    }

    if (document.readyState === 'complete') {
      schedule()
    } else {
      window.addEventListener('load', schedule, { once: true })
    }

    return () => {
      window.removeEventListener('load', schedule)
      if (delayHandle) window.clearTimeout(delayHandle)
      if (timeoutHandle) window.clearTimeout(timeoutHandle)
      if (idleHandle && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle)
    }
  }, [delayMs])

  return ready
}
