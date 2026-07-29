import { useEffect, useState } from "react";

/**
 * Returns `true` once the processing panel has been sitting on its final step for `delayMs`
 * (default 3s). The last step absorbs all the extra server wait, so without a signal it can look
 * frozen — callers use this to start a gentle blink on that step's neon dot, telling the user work
 * is still happening. Resets the moment we leave the last step (or unmount).
 */
export function useLastStepBlink(isOnLastStep: boolean, delayMs = 3000): boolean {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!isOnLastStep) {
      setBlink(false);
      return;
    }
    const timer = window.setTimeout(() => setBlink(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [isOnLastStep, delayMs]);

  return blink;
}
