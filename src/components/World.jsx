import { lazy, Suspense, useState } from 'react'
import { Card, Tag, AqiChip, Loader, ErrorBox, Boundary } from './ui'
import { getMulti, reverseGeocode } from '../lib/api'
import { category, round, fmtTime, scaleName } from '../lib/aqi'

const Globe = lazy(() => import('./Globe'))
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export default function World({ world, worldErr, loc, aq, onPick }) {
  const [scope, setScope] = useState('all')
  const [sel, setSel] = useState(null)
  const [worst, setWorst] = useState(true)
  const list = world.filter((p) => p.us_aqi != null && (scope === 'all' || (scope === 'in' ? p.in : !p.in)))
  const ranked = [...list].sort((a, b) => (worst ? b.us_aqi - a.us_aqi : a.us_aqi - b.us_aqi))
  return (
    <div className="grid world">
      <Card className="span2 globe-card" title="Live 3D pollution globe" icon="🌍" right={<Tag kind="model">Pillar height = AQI · rings = hotspots</Tag>}>
        <ErrorBox error={worldErr} />
        <Boundary><Suspense fallback={<Loader text="Spinning up the globe…" />}>
          <Globe points={world} height={560} selected={sel} focus={loc} onSelect={(p) => setSel(p)} autoRotate={!sel} />
        </Suspense></Boundary>
        {sel && (
          <div className="globe-sel" style={{ '--c': category(sel.us_aqi).color }}>
            <b>{sel.name}</b>, {sel.country} · AQI <AqiChip v={sel.us_aqi} /> {category(sel.us_aqi).label} · PM2.5 {sel.pm2_5}
            <button className="btn sm" onClick={() => onPick(sel)}>Open dashboard →</button>
          </div>
        )}
      </Card>
      <Card title="Pollution leaderboard" icon="🏆" right={<div className="seg mini"><button className="on" onClick={() => setWorst(!worst)}>{worst ? '🔥 Worst' : '🌿 Cleanest'}</button>{[['all', 'All'], ['in', 'India'], ['w', 'World']].map(([k, l]) => <button key={k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{l}</button>)}</div>}>
        {world.length === 0 && <Loader text="Ranking cities…" />}
        <ol className="lb">
          {ranked.map((p, i) => (
            <li key={p.name} onClick={() => setSel(p)} className={sel?.name === p.name ? 'on' : ''}>
              <span className="rk">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
              <span className="nm">{p.name}<small>{p.country}{p.dominant === 'pm10' && p.us_aqi >= 300 && ' · ⚠ modelled dust'}</small></span>
              <span className="lbbar"><i style={{ width: Math.min(100, p.us_aqi / 3) + '%', background: category(p.us_aqi).color }} /></span>
              <AqiChip v={p.us_aqi} />
            </li>
          ))}
        </ol>
        {world[0] && <p className="muted xs">{worst ? 'Most polluted' : 'Cleanest'} first · {scaleName()} · updated {fmtTime(world[0].t)} · Open-Meteo CAMS</p>}
      </Card>
      <CleanAirFinder loc={loc} aq={aq} onPick={onPick} />
    </div>
  )
}

function CleanAirFinder({ loc, aq, onPick }) {
  const [st, setSt] = useState(null)
  const run = async () => {
    setSt({ loading: true })
    try {
      const pts = [{ lat: loc.lat, lon: loc.lon, dist: 0, dir: '•' }]
      for (const km of [20, 50, 100, 160]) DIRS.forEach((d, i) => {
        const a = (i * Math.PI) / 4
        pts.push({ lat: loc.lat + (km / 111) * Math.cos(a), lon: loc.lon + (km / (111 * Math.cos((loc.lat * Math.PI) / 180))) * Math.sin(a), dist: km, dir: d })
      })
      const r = (await getMulti(pts, ['us_aqi', 'pm2_5'])).filter((p) => p.us_aqi != null)
      const here = r[0]
      const top = r.slice(1).sort((a, b) => a.us_aqi - b.us_aqi || a.dist - b.dist).slice(0, 4)
      const named = await Promise.all(top.map(async (p) => ({ ...p, ...(await reverseGeocode(p.lat, p.lon)) })))
      setSt({ here, top: named })
    } catch (e) { setSt({ error: e }) }
  }
  return (
    <Card className="span3" title="Clean Air Finder" icon="🧭" right={<Tag kind="model" />}>
      <p className="sm muted">Scans 32 points up to 160 km around <b>{loc.name}</b> to find relatively cleaner air nearby — handy for weekend escapes or choosing where to run.</p>
      {!st && <button className="btn glow" onClick={run}>🔎 Find cleaner air near {loc.name}</button>}
      {st?.loading && <Loader text="Scanning the surroundings…" />}
      <ErrorBox error={st?.error} onRetry={run} />
      {st?.top && (
        <div className="finder">
          <div className="f-here">Here: <AqiChip v={st.here?.us_aqi ?? aq?.current?.us_aqi} /></div>
          {st.top.map((p) => {
            const diff = (st.here?.us_aqi ?? 0) - p.us_aqi
            return (
              <div key={p.lat} className="f-card tilt" style={{ '--c': category(p.us_aqi).color }}>
                <b>{p.name}</b><small className="muted">{p.admin}</small>
                <div className="f-aqi">{p.us_aqi}</div>
                <div className="xs">{p.dist} km {p.dir} · {diff > 0 ? <span className="down">{diff} AQI cleaner</span> : 'similar'}</div>
                <button className="btn sm ghost" onClick={() => onPick({ name: p.name, country: p.country, lat: p.lat, lon: p.lon })}>View</button>
              </div>
            )
          })}
          <button className="btn ghost sm" onClick={run}>↻ Rescan</button>
        </div>
      )}
    </Card>
  )
}
