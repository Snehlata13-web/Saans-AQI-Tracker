import { useEffect, useRef, useState } from 'react'
import { geocode } from '../lib/api'
import { CITIES } from '../lib/cities'
import { category } from '../lib/aqi'

const POPULAR = ['Delhi', 'Mumbai', 'Bengaluru', 'Kolkata', 'Lahore', 'Beijing', 'London', 'New York']

export default function CommandPalette({ open, onClose, onPick, onLocate, world = [] }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [busy, setBusy] = useState(false)
  const [idx, setIdx] = useState(0)
  const inp = useRef()
  const t = useRef()

  useEffect(() => { if (open) { setQ(''); setRes([]); setIdx(0); setTimeout(() => inp.current?.focus(), 30) } }, [open])
  useEffect(() => {
    clearTimeout(t.current)
    if (q.trim().length < 2) { setRes([]); return }
    t.current = setTimeout(async () => {
      setBusy(true)
      try { setRes(await geocode(q.trim())); setIdx(0) } catch { setRes([]) }
      setBusy(false)
    }, 250)
  }, [q])

  if (!open) return null
  const quick = POPULAR.map((n) => world.find((w) => w.name === n) || CITIES.find((c) => c.name === n)).filter(Boolean)
  const list = res.length ? res : []
  const choose = (p) => { onPick(p); onClose() }

  return (
    <div className="cmdk" onMouseDown={onClose}>
      <div className="cmdk-box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-in">
          <span className="cmdk-ic">{busy ? <i className="spin" /> : '⌕'}</span>
          <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any city, town or place on Earth…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
              if (e.key === 'Enter' && list[idx]) choose(list[idx])
            }} />
          <kbd>ESC</kbd>
        </div>
        {list.length > 0 ? (
          <ul className="cmdk-res">
            {list.map((r, i) => (
              <li key={r.lat + ',' + r.lon} className={i === idx ? 'on' : ''} onMouseEnter={() => setIdx(i)} onClick={() => choose(r)}>
                <span className="pin">📍</span>
                <div><b>{r.name}</b><small>{[r.admin, r.country].filter(Boolean).join(' · ')}</small></div>
                <span className="go">↵</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cmdk-empty">
            <button className="cmdk-locate" onClick={() => { onLocate(); onClose() }}>
              <span>◎</span><div><b>Use my current location</b><small>Detect nearby air quality</small></div>
            </button>
            <div className="cmdk-label">Popular right now</div>
            <div className="cmdk-quick">
              {quick.map((c) => (
                <button key={c.name} onClick={() => choose(c)} style={{ '--c': category(c.us_aqi).color }}>
                  <i />{c.name}{c.us_aqi != null && <b>{c.us_aqi}</b>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span>Open-Meteo Geocoding</span></div>
      </div>
    </div>
  )
}
