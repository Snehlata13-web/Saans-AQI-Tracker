import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { getAirQuality, getWeather, getStation, getMulti, reverseGeocode } from './lib/api'
import { CITIES } from './lib/cities'
import { category, setActiveScale } from './lib/aqi'
import { checkAlerts } from './lib/alerts'
import Dashboard from './components/Dashboard'
import CommandPalette from './components/CommandPalette'
import { Cursor, Ripple } from './components/FX'
import { LITE } from './lib/perf'
import { Loader, ErrorBox, PageHead, Boundary } from './components/ui'

const Backdrop = lazy(() => import('./components/Backdrop'))

const World = lazy(() => import('./components/World'))
const MapView = lazy(() => import('./components/MapView'))
const Commute = lazy(() => import('./components/Commute'))
const History = lazy(() => import('./components/History'))
const Forecast = lazy(() => import('./components/Forecast'))
const Compare = lazy(() => import('./components/Compare'))
const Health = lazy(() => import('./components/Health'))
const Assistant = lazy(() => import('./components/Assistant'))
const Alerts = lazy(() => import('./components/Alerts'))
const ShareCard = lazy(() => import('./components/ShareCard'))

const I = (d) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const ICONS = {
  overview: I(<><path d="M3 12h3l2-6 4 12 2-6h7" /></>),
  world: I(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  map: I(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>),
  commute: I(<><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></>),
  history: I(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 3" /></>),
  forecast: I(<><path d="M17 18H7a4 4 0 1 1 .9-7.9A6 6 0 0 1 19 12a3 3 0 0 1-2 6z" /><path d="m11 13 2 2 3-4" /></>),
  compare: I(<><path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z" /></>),
  health: I(<><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /><path d="M7 12h3l1-2 2 4 1-2h3" /></>),
  assistant: I(<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>),
  alerts: I(<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>),
}

const TABS = [
  ['overview', '◉', 'Live'], ['world', '🌍', '3D Globe'], ['map', '🗺️', 'Map'], ['commute', '🧭', 'Commute'], ['history', '📈', 'History'],
  ['forecast', '🔮', 'Forecast'], ['compare', '⚖️', 'Compare'], ['health', '🩺', 'Health'], ['assistant', '🤖', 'AI'], ['alerts', '🔔', 'Alerts'],
]

const HEADS = {
  world: ['Planet pulse', 'The world, breathing.', 'Live AQI for 76 cities rendered as glowing pillars on a 3D Earth. Drag to spin, click a pillar to fly there.'],
  map: ['Interactive map', 'Pollution, mapped.', 'A live heatmap of modelled AQI, real monitoring stations and hotspots. Click anywhere on Earth to probe the air.'],
  commute: ['Clean Commute', 'Breathe less smoke on the way.', 'Pick a destination — SAANS checks every route against the 24-hour pollution forecast and tells you the cleanest road and the best time to leave.'],
  history: ['Time machine', 'How the air has changed.', 'Daily trends, spikes, anomalies and a full impact report for {city} — plus the Diwali firecracker effect.'],
  forecast: ['Look ahead', 'Tomorrow\'s air, today.', 'Copernicus CAMS forecast for {city}, cross-checked by SAANS\' own ML model trained live in your browser.'],
  compare: ['Side by side', 'Who breathes easier?', 'Compare pollutants and 7-day trends across up to five places.'],
  health: ['Stay safe', 'What the numbers mean for you.', 'AQI categories decoded, with advice for children, elders, asthma, heart patients, athletes and more.'],
  assistant: ['SAANS AI', 'Ask the air anything.', 'A voice-enabled assistant grounded on live data for {city}. English, Hindi or Hinglish.'],
  alerts: ['Never be surprised', 'Smart AQI alerts.', 'Get notified when the air crosses your limit — or when the forecast says it will.'],
}

function initialLoc() {
  const p = new URLSearchParams(location.search)
  if (p.get('lat')) return { name: p.get('name') || 'Shared location', lat: +p.get('lat'), lon: +p.get('lon'), country: p.get('country') || '' }
  try { const s = JSON.parse(localStorage.getItem('saans:loc')); if (s) return s } catch { /* none */ }
  return { name: 'New Delhi', lat: 28.6139, lon: 77.209, country: 'India' }
}

export default function App() {
  const [loc, setLoc] = useState(initialLoc)
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'overview')
  const [aq, setAq] = useState(null)
  const [wx, setWx] = useState(null)
  const [station, setStation] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [world, setWorld] = useState([])
  const [worldErr, setWorldErr] = useState(null)
  const [share, setShare] = useState(false)
  const [toasts, setToasts] = useState([])
  const [intro, setIntro] = useState(() => !sessionStorage.getItem('saans:intro'))
  const [fx, setFx] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cmd, setCmd] = useState(false)
  const [scale, setScale] = useState(() => localStorage.getItem('saans:scale') || 'auto')
  const sc = scale === 'auto' ? (/india/i.test(loc.country || '') ? 'IN' : 'US') : scale
  setActiveScale(sc)

  useEffect(() => {
    let lastTilt = null
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v) } }
    // spotlight effect: cards glow where the cursor is
    let pending = null, rafId = 0
    const m = (ev) => { pending = ev; if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; apply(pending) }) }
    const apply = (e) => {
      if (LITE) return
      const c = e.target.closest?.('.card')
      if (c) {
        const r = c.getBoundingClientRect()
        c.style.setProperty('--mx', e.clientX - r.left + 'px')
        c.style.setProperty('--my', e.clientY - r.top + 'px')
      }
      const t = e.target.closest?.('.tilt')
      if (lastTilt && lastTilt !== t) { lastTilt.style.setProperty('--rx', '0deg'); lastTilt.style.setProperty('--ry', '0deg') }
      if (t) {
        const r = t.getBoundingClientRect()
        t.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * 14 + 'deg')
        t.style.setProperty('--rx', -((e.clientY - r.top) / r.height - 0.5) * 14 + 'deg')
      }
      lastTilt = t
    }
    window.addEventListener('keydown', k)
    window.addEventListener('pointermove', m, { passive: true })
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', k); window.removeEventListener('pointermove', m) }
  }, [])

  const notify = useCallback((t) => {
    const id = Math.random()
    setToasts((x) => [...x, { ...t, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 7000)
  }, [])

  const pick = (p) => {
    const l = { name: p.name, lat: p.lat, lon: p.lon, country: p.country || '' }
    setLoc(l); localStorage.setItem('saans:loc', JSON.stringify(l))
    setTab('overview'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const go = (t) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  useEffect(() => { history.replaceState(null, '', `?lat=${loc.lat.toFixed(4)}&lon=${loc.lon.toFixed(4)}&name=${encodeURIComponent(loc.name)}&country=${encodeURIComponent(loc.country || '')}#${tab}`) }, [loc, tab])

  useEffect(() => {
    const h = () => { const t = location.hash.slice(1); if (TABS.some(([k]) => k === t)) setTab(t) }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // main location data
  useEffect(() => {
    let off = false
    setLoading(true); setErr(null); setStation(null)
    getAirQuality(loc.lat, loc.lon, { pastDays: 30, forecastDays: 5 })
      .then((d) => { if (!off) { setAq(d); setLoading(false) } })
      .catch((e) => { if (!off) { setErr(e); setLoading(false) } })
    getWeather(loc.lat, loc.lon).then((d) => !off && setWx(d)).catch(() => !off && setWx(null))
    getStation(loc.lat, loc.lon).then((d) => !off && setStation(d)).catch((e) => !off && setStation({ error: e.status === 503 ? 'not configured' : e.message }))
    return () => { off = true }
  }, [loc.lat, loc.lon, refreshKey, sc])

  // auto refresh every 10 min
  useEffect(() => { const i = setInterval(() => setRefreshKey((k) => k + 1), 10 * 60e3); return () => clearInterval(i) }, [])

  // world cities for globe, map, leaderboard
  useEffect(() => {
    const load = () => getMulti(CITIES).then((d) => { setWorld(d); setWorldErr(null) }).catch(setWorldErr)
    load()
    const i = setInterval(load, 15 * 60e3)
    return () => clearInterval(i)
  }, [sc])

  // alerts watcher
  useEffect(() => {
    const run = () => checkAlerts(notify).catch(() => {})
    const t = setTimeout(run, 8000)
    const i = setInterval(run, 15 * 60e3)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [notify])

  useEffect(() => { if (!intro) return; sessionStorage.setItem('saans:intro', '1'); const t = setTimeout(() => setIntro(false), 2000); return () => clearTimeout(t) }, [])
  // mount the full-screen WebGL backdrop only after the page is interactive (and never on Lite devices)
  useEffect(() => {
    if (LITE) return
    const go = () => setFx(true)
    const id = window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 1200)
    return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id))
  }, [])

  const locate = () => {
    if (!navigator.geolocation) return notify({ title: 'Location unavailable', body: 'Your browser does not support geolocation.' })
    navigator.geolocation.getCurrentPosition(async (p) => {
      const g = await reverseGeocode(p.coords.latitude, p.coords.longitude)
      pick({ ...g, lat: p.coords.latitude, lon: p.coords.longitude })
      notify({ title: '📍 Located you', body: `Showing air quality near ${g.name}.` })
    }, () => notify({ title: 'Location denied', body: 'Allow location access or search for a place.' }), { timeout: 10000 })
  }

  const cat = category(aq?.current?.us_aqi)
  const ticker = [...world].filter((p) => p.us_aqi != null).sort((a, b) => b.us_aqi - a.us_aqi)
  const head = HEADS[tab]
  const setSc = (v) => { setScale(v); localStorage.setItem('saans:scale', v) }

  return (
    <div className="app" style={{ '--cat': cat.color, '--catglow': cat.glow }}>
      {intro && (
        <div className="intro">
          <div className="intro-orb" />
          <h1>SAANS</h1>
          <p>breathe in… <span>breathe out</span></p>
        </div>
      )}
      <div className="bg"><i className="b1" /><i className="b2" /><i className="b3" /><div className="gridfx" /></div>
      {fx && <Boundary fallback={null}><Suspense fallback={null}><Backdrop color={cat.color} aqi={aq?.current?.us_aqi} /></Suspense></Boundary>}
      <div className="noise" />

      <aside className="dock">
        <div className="dock-logo" onClick={() => go('overview')}>🪔</div>
        {TABS.map(([k, ic, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)} aria-label={l}>
            <span className="d-ic">{ICONS[k] || ic}</span><span className="d-l">{l}</span>
          </button>
        ))}
      </aside>

      <div className="shell">
        <header className="top">
          <div className="brand" onClick={() => go('overview')}>
            <b>SAANS</b><small>Air Quality Intelligence</small>
          </div>
          <button className="search-trigger" onClick={() => setCmd(true)}>
            <span className="st-ic">⌕</span>
            <span className="st-loc"><i style={{ background: cat.color }} />{loc.name}{loc.country ? `, ${loc.country}` : ''}</span>
            <span className="st-hint">Search any place…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="scale-btn" title="AQI scale">
            <button className={sc === 'IN' ? 'on' : ''} onClick={() => setSc('IN')}>🇮🇳 NAQI</button>
            <button className={sc === 'US' ? 'on' : ''} onClick={() => setSc('US')}>🇺🇸 US</button>
          </div>
          <button className="icon-btn" onClick={locate} title="Use my location">◎</button>
          <Clock tz={aq?.tz} />
          <div className="live"><i />LIVE</div>
        </header>

        {ticker.length > 0 && (
          <div className="ticker"><div className="ticker-in">
            {[...ticker, ...ticker].map((p, i) => (
              <span key={i} onClick={() => pick(p)}><i style={{ background: category(p.us_aqi).color }} />{p.name} <b style={{ color: category(p.us_aqi).color }}>{p.us_aqi}</b></span>
            ))}
          </div></div>
        )}

        <main key={tab + sc} className="page">
          {head && <PageHead kicker={head[0]} title={head[1]} sub={head[2].replace('{city}', loc.name)} />}
          {loading && !aq && <Loader />}
          <ErrorBox error={err} onRetry={() => setRefreshKey((k) => k + 1)} />
          <Boundary><Suspense fallback={<Loader text="Loading module…" />}>
            {tab === 'world' && <World world={world} worldErr={worldErr} loc={loc} aq={aq} onPick={pick} />}
            {tab === 'map' && <MapView loc={loc} world={world} onPick={pick} />}
            {tab === 'commute' && <Commute loc={loc} aq={aq} />}
            {tab === 'health' && <Health aq={aq} />}
            {tab === 'compare' && <Compare loc={loc} />}
            {tab === 'history' && <History loc={loc} />}
            {tab === 'alerts' && <Alerts loc={loc} notify={notify} />}
            {aq && <>
              {tab === 'overview' && <Dashboard loc={loc} aq={aq} wx={wx} station={station} onShare={() => setShare(true)} go={go} scale={sc} onScale={() => setSc(sc === 'IN' ? 'US' : 'IN')} />}
              {tab === 'forecast' && <Forecast loc={loc} aq={aq} wx={wx} />}
              {tab === 'assistant' && <Assistant loc={loc} aq={aq} wx={wx} station={station} onPick={pick} />}
              {share && <ShareCard loc={loc} aq={aq} onClose={() => setShare(false)} />}
            </>}
          </Suspense></Boundary>
        </main>

        <footer className="foot">
          <div className="foot-mega" aria-hidden="true" />
          <div className="foot-cols">
            <div>
              <h2 className="foot-h">SAANS 🪔</h2>
              <p>Real-time air quality intelligence that turns raw atmospheric data into decisions you can act on — built for the Let's Code Diwali Challenge 2026.</p>
            </div>
            <div>
              <h2 className="foot-h">Data sources</h2>
              <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">Open-Meteo Air Quality · Copernicus CAMS</a>
              <a href="https://aqicn.org/api/" target="_blank" rel="noreferrer">WAQI · World Air Quality Index</a>
              <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Open-Meteo Weather & Geocoding</a>
              <a href="https://www.bigdatacloud.com" target="_blank" rel="noreferrer">BigDataCloud reverse geocoding</a>
              <a href="https://www.esri.com" target="_blank" rel="noreferrer">Map tiles © Esri · OpenStreetMap</a>
            </div>
            <div>
              <h2 className="foot-h">Explore</h2>
              {TABS.map(([k, , l]) => <button key={k} onClick={() => go(k)}>{l}</button>)}
            </div>
            <div>
              <h2 className="foot-h">Honest data</h2>
              <p>Measurements, model estimates, forecasts and ML predictions are always labelled. Nothing is fabricated. Health guidance is general information, not medical advice.</p>
            </div>
          </div>
          <div className="foot-bar"><span>© 2026 SAANS</span><span>Made with ❤️ & 🪔 for cleaner air</span></div>
        </footer>
      </div>

      <Cursor />
      <Ripple trigger={tab} color={cat.color} />
      <CommandPalette open={cmd} onClose={() => setCmd(false)} onPick={pick} onLocate={locate} world={world} />
      <div className="toasts">{toasts.map((t) => <div key={t.id} className="toast"><b>{t.title}</b><span>{t.body}</span></div>)}</div>
    </div>
  )
}

function Clock({ tz }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])
  return <div className="clock">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz || undefined })}<small>{tz?.split('/').pop()?.replace('_', ' ') || 'local'}</small></div>
}
