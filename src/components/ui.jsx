import { Component, useEffect, useRef, useState } from 'react'
import { category } from '../lib/aqi'

// Keeps one failing widget (e.g. WebGL unavailable) from blanking the whole app
export class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return this.props.fallback ?? (
      <div className="errbox">⚠️ This section couldn't load on this device ({String(this.state.err.message || this.state.err).slice(0, 80)}).
        <button className="btn sm" onClick={() => this.setState({ err: null })}>Retry</button></div>
    )
  }
}

export function CountUp({ value, dur = 1400, decimals = 0 }) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (value == null) return
    const start = performance.now(), a = from.current, b = value
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur)
      const e = 1 - Math.pow(1 - k, 4)
      setV(a + (b - a) * e)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = b
    }
    raf = requestAnimationFrame(step)
    const to = setTimeout(() => { setV(b); from.current = b }, dur + 150)
    return () => { cancelAnimationFrame(raf); clearTimeout(to) }
  }, [value])
  if (value == null) return '—'
  return decimals ? v.toFixed(decimals) : Math.round(v)
}

export function Ring({ pct = 0, color = '#fff', size = 64, stroke = 6, children }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${C * Math.min(1, pct)} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  )
}

export function PageHead({ kicker, title, sub, right }) {
  return (
    <div className="pagehead">
      <div>
        <div className="kicker"><i />{kicker}</div>
        <h1 className="ph-title">{title}</h1>
        {sub && <p className="ph-sub">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Card({ title, icon, right, children, className = '', style }) {
  return (
    <section className={'card ' + className} style={style}>
      <div className="spot" />
      {(title || right) && (
        <header className="card-h">
          <h2 className="card-t">{icon && <span className="ic" aria-hidden="true">{icon}</span>}{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

const KIND = {
  measured: { t: 'Ground-station measurement', c: '#2ee59d' },
  model: { t: 'Model estimate · CAMS', c: '#5ec8ff' },
  forecast: { t: 'Forecast', c: '#ffb347' },
  ml: { t: 'ML prediction · experimental', c: '#e879f9' },
  history: { t: 'Historical (modelled)', c: '#a5b4fc' },
  stale: { t: 'Cached — live fetch failed', c: '#ff6b6b' },
}
export function Tag({ kind, children }) {
  const k = KIND[kind] || KIND.model
  return <span className="tag" style={{ '--c': k.c }}><i />{children || k.t}</span>
}

export function Gauge({ value, size = 220, label = 'US AQI' }) {
  const cat = category(value)
  const pct = Math.min(1, (value || 0) / 300)
  const r = size / 2 - 16, C = Math.PI * r * 1.5
  return (
    <div className="gauge" style={{ width: size, height: size, '--glow': cat.glow }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gg" x1="0" x2="1">
            <stop offset="0" stopColor="#2ee59d" /><stop offset=".35" stopColor="#ffd43b" />
            <stop offset=".6" stopColor="#ff922b" /><stop offset=".8" stopColor="#ff4d6d" /><stop offset="1" stopColor="#b56cff" />
          </linearGradient>
        </defs>
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#gg)" strokeOpacity=".22" strokeWidth="14" strokeDasharray={`${C} 999`} strokeLinecap="round" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cat.color} strokeWidth="14" strokeDasharray={`${C * pct} 999`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1), stroke .6s', filter: `drop-shadow(0 0 8px ${cat.color})` }} />
        </g>
      </svg>
      <div className="gauge-in">
        <div className="gauge-v" style={{ color: cat.color }}>{value ?? '—'}</div>
        <div className="gauge-l">{label}</div>
        <div className="gauge-c" style={{ background: cat.color }}>{cat.short || cat.label}</div>
      </div>
    </div>
  )
}

export function Loader({ text = 'Fetching live air data…' }) {
  return <div className="loader"><span className="orb" /> {text}</div>
}
export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="errbox">
      ⚠️ {String(error.message || error)} {error.status === 429 && '(rate limited — please wait a minute)'}
      {onRetry && <button className="btn sm" onClick={onRetry}>Retry</button>}
    </div>
  )
}

export function AqiChip({ v, color }) {
  const c = color ? { color } : category(v)
  return <span className="chip" style={{ background: c.color + '22', color: c.color, borderColor: c.color + '66' }}>{v == null ? '—' : v > 500 ? '500+' : v}</span>
}
