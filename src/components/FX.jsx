import { useEffect, useRef, useState } from 'react'

// Glowing aura cursor (desktop only): dot + lagging ring that grows over interactive elements
export function Cursor() {
  const dot = useRef(), ring = useRef()
  const [on] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches)
  useEffect(() => {
    if (!on) return
    document.body.classList.add('fx-cursor')
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf
    const move = (e) => {
      x = e.clientX; y = e.clientY
      kick()
      const hot = e.target.closest?.('button, a, input, select, .card, .leaflet-container, canvas')
      ring.current?.classList.toggle('hot', !!hot && !e.target.closest('.card:not(.tilt)'))
      ring.current?.classList.toggle('big', !!e.target.closest?.('button, a'))
    }
    const down = () => ring.current?.classList.add('press'), up = () => ring.current?.classList.remove('press')
    let running = false
    const loop = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.3) raf = requestAnimationFrame(loop)
      else running = false
    }
    const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(loop) } }
    addEventListener('pointermove', move, { passive: true }); addEventListener('pointerdown', down); addEventListener('pointerup', up)
    kick()
    return () => { cancelAnimationFrame(raf); removeEventListener('pointermove', move); removeEventListener('pointerdown', down); removeEventListener('pointerup', up); document.body.classList.remove('fx-cursor') }
  }, [on])
  if (!on) return null
  return <><div ref={ring} className="cur-ring"><i /></div><div ref={dot} className="cur-dot" /></>
}

// "Breath" ripple that washes over the screen on page change
export function Ripple({ trigger, color }) {
  const [r, setR] = useState(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setR({ k: Date.now(), x: window.__lastClick?.x ?? innerWidth / 2, y: window.__lastClick?.y ?? innerHeight / 2 })
  }, [trigger])
  useEffect(() => {
    const f = (e) => { window.__lastClick = { x: e.clientX, y: e.clientY } }
    addEventListener('pointerdown', f, true)
    return () => removeEventListener('pointerdown', f, true)
  }, [])
  if (!r) return null
  return <div key={r.k} className="ripple" style={{ '--x': r.x + 'px', '--y': r.y + 'px', '--c': color }} onAnimationEnd={() => setR(null)} />
}
