import { useEffect, useRef, useState } from 'react'

// true while the element is on screen AND the tab is visible — used to pause WebGL render loops
export function useActive(margin = '100px') {
  const ref = useRef(null)
  const [inView, setInView] = useState(true)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const el = ref.current
    let io
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin })
      io.observe(el)
    }
    const v = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', v)
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', v) }
  }, [margin])
  return [ref, inView && visible]
}

export function useTabVisible() {
  const [v, setV] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const f = () => setV(!document.hidden)
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])
  return v
}
