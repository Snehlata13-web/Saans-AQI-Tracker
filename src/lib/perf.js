// Device capability detection → "lite" mode for phones / low-power devices / reduced-motion / data-saver users
const mq = (q) => typeof window !== 'undefined' && window.matchMedia?.(q).matches
const nav = typeof navigator !== 'undefined' ? navigator : {}

export const REDUCED = mq('(prefers-reduced-motion: reduce)')
export const TOUCH = mq('(pointer: coarse)')
export const LITE =
  REDUCED || TOUCH || mq('(max-width: 860px)') ||
  (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) ||
  (nav.deviceMemory && nav.deviceMemory <= 4) ||
  nav.connection?.saveData === true

export const DPR = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, LITE ? 1 : 1.5)

if (typeof document !== 'undefined') document.documentElement.classList.toggle('lite', !!LITE)

// Run a callback when the browser is idle (or after a timeout as fallback)
export const whenIdle = (fn, timeout = 1500) =>
  typeof window !== 'undefined' && window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout }) : setTimeout(fn, 300)
