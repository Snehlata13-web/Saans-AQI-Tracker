import { useEffect, useRef, useState } from 'react'
import { geocode } from '../lib/api'

export default function LocationSearch({ onPick, placeholder = 'Search any city, town or place…', compact }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useRef()
  useEffect(() => {
    clearTimeout(t.current)
    if (q.trim().length < 2) { setRes([]); return }
    t.current = setTimeout(async () => {
      setBusy(true)
      try { setRes(await geocode(q.trim())); setOpen(true) } catch { setRes([]) }
      setBusy(false)
    }, 300)
  }, [q])
  return (
    <div className={'search' + (compact ? ' compact' : '')}>
      <span className="s-ic">{busy ? '⏳' : '🔍'}</span>
      <input value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) { onPick(res[0]); setQ(''); setOpen(false) } }} />
      {open && res.length > 0 && (
        <ul className="s-res">
          {res.map((r) => (
            <li key={r.lat + ',' + r.lon} onMouseDown={() => { onPick(r); setQ(''); setOpen(false) }}>
              <b>{r.name}</b> <span>{[r.admin, r.country].filter(Boolean).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
