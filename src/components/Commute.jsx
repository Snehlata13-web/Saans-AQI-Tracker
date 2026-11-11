import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LTooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from 'recharts'
import { Card, Tag, Loader, ErrorBox } from './ui'
import LocationSearch from './LocationSearch'
import { planCommute, MODES } from '../lib/commute'
import { epaFromCurrent, category, round, fmtHour } from '../lib/aqi'
import { reverseGeocode } from '../lib/api'
import { CITIES } from '../lib/cities'
import { haversine } from '../lib/aqi'
import { tipStyle } from './History'

const RC = ['#5ec8ff', '#ffd27a', '#e879f9']
const segColor = (pm) => category(epaFromCurrent({ pm2_5: pm }).us_aqi).color

function Fit({ routes }) {
  const map = useMap()
  useEffect(() => {
    const all = routes.flatMap((r) => r.coords)
    if (all.length) map.fitBounds(all, { padding: [30, 30] })
  }, [routes, map])
  return null
}

export default function Commute({ loc, aq }) {
  const [from, setFrom] = useState({ name: loc.name, lat: loc.lat, lon: loc.lon })
  const [to, setTo] = useState(null)
  const [mode, setMode] = useState('car')
  const [st, setSt] = useState(null)
  const [h, setH] = useState(0)
  const tz = aq?.tz
  const near = CITIES.map((c) => ({ ...c, d: haversine(from, c) })).filter((c) => c.d > 8 && c.d < 120).sort((a, b) => a.d - b.d).slice(0, 4)

  const run = async (m = mode) => {
    if (!to) return
    setSt({ loading: true })
    try {
      const r = await planCommute(from, to, m)
      setSt({ data: r }); setH(r.best.h)
    } catch (e) { setSt({ error: e }) }
  }
  const me = () => navigator.geolocation?.getCurrentPosition(async (p) => {
    const g = await reverseGeocode(p.coords.latitude, p.coords.longitude)
    setFrom({ name: g.name, lat: p.coords.latitude, lon: p.coords.longitude })
  })

  const d = st?.data
  const saving = d ? 1 - d.best.dose / d.baseline.dose : null
  const chart = d ? d.routes[0].byHour.map((x, i) => {
    const o = { t: x.t }
    d.routes.forEach((r) => { o['Route ' + 'ABC'[r.id]] = round(r.byHour[i].dose, 1) })
    return o
  }) : []

  return (
    <div className="grid">
      <Card className="span3 commute-in glowborder" title="Plan your cleanest trip" icon="🧭" right={<Tag kind="forecast">Forecast-based estimate</Tag>}>
        <div className="cm-form">
          <div className="cm-col">
          <div className="cm-pt">
            <span className="cm-dot a">A</span>
            <div><small className="muted">From</small><b>{from?.name}</b></div>
            <button className="btn ghost sm" onClick={me}>◎ Me</button>
          </div>
          <LocationSearch compact placeholder="Change start…" onPick={(p) => setFrom(p)} />
          </div>
          <div className="cm-col">
          <div className="cm-pt">
            <span className="cm-dot b">B</span>
            <div><small className="muted">To</small><b>{to?.name || 'Choose a destination'}</b></div>
          </div>
          <LocationSearch compact placeholder="Where to? e.g. Gurugram, Connaught Place, IIT Delhi…" onPick={(p) => setTo(p)} />
          {near.length > 0 && <div className="cm-try"><span className="xs muted">Try:</span>{near.map((c) => <button key={c.name} onClick={() => setTo(c)}>{c.name}</button>)}</div>}
          </div>
          <div className="cm-modes">
            {Object.entries(MODES).map(([k, m]) => (
              <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); if (d) run(k) }}>{m.icon} {m.label}</button>
            ))}
          </div>
          <button className="btn glow cm-go" disabled={!to || st?.loading} onClick={() => run()}>{st?.loading ? 'Scanning routes × 24h forecast…' : '✨ Find cleanest route & time'}</button>
        </div>
        <p className="xs muted">SAANS checks every alternative road route (OpenStreetMap / OSRM), samples the hourly PM2.5 forecast along each one, and estimates how much PM2.5 you would inhale for every departure hour in the next 24 h.</p>
      </Card>

      {st?.loading && <Card className="span3"><Loader text="Sampling pollution along every route for the next 24 hours…" /></Card>}
      {st?.error && <Card className="span3"><ErrorBox error={st.error} onRetry={() => run()} /></Card>}

      {d && <>
        <Card className="span3 cm-verdict">
          <div className="cm-v">
            <div className="cm-big">{saving > 0.005 ? <>−{round(saving * 100)}%</> : '✓'}</div>
            <div>
              <div className="kicker"><i />SMARTEST TRIP</div>
              <h2>Leave <b>{d.best.h === 0 ? 'now' : fmtHour(d.best.t, tz)}</b> via <b style={{ color: RC[d.best.route.id] }}>Route {'ABC'[d.best.route.id]}</b></h2>
              <p className="muted">
                {saving > 0.005
                  ? <>You'd inhale <b>{round(saving * 100)}% less PM2.5</b> than taking the fastest route right now ({round(d.best.dose, 1)} vs {round(d.baseline.dose, 1)} µg).</>
                  : <>Right now on the fastest route is already your cleanest option ({round(d.best.dose, 1)} µg PM2.5).</>}
                {' '}Trip: {round(d.best.route.distance / 1000, 1)} km · {round(d.best.route.duration / 60)} min · avg PM2.5 {round(d.best.avg)} µg/m³.
              </p>
              <p className="xs muted">{MODES[d.mode].icon} Assumes {MODES[d.mode].note}, {MODES[d.mode].rate} m³/h breathing rate. CAMS forecast — an estimate, not a measurement.</p>
            </div>
          </div>
        </Card>

        <Card className="span2" title="Routes coloured by pollution" icon="🗺️" right={<span className="xs muted">departing {h === 0 ? 'now' : fmtHour(d.times[h], tz)}</span>}>
          <div className="cm-map">
            <MapContainer center={[from.lat, from.lon]} zoom={11} className="map cm-leaflet" preferCanvas>
              <TileLayer attribution="Tiles © Esri · © OpenStreetMap · Routing © OSRM" url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
              <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" />
              <Fit routes={d.routes} />
              {d.routes.map((r) => <Polyline key={'o' + r.id} positions={r.coords} pathOptions={{ color: RC[r.id], weight: r.id === d.best.route.id ? 12 : 8, opacity: 0.35 }} />)}
              {d.routes.map((r) => r.segs.map((s, i) => {
                const idx = Math.min(s.pm.length - 1, h + Math.floor((s.frac * r.duration) / 3600))
                return (
                  <Polyline key={r.id + '-' + i} positions={[s.from, s.to]} pathOptions={{ color: segColor(s.pm[idx]), weight: r.id === d.best.route.id ? 6 : 4, opacity: 0.95 }}>
                    <LTooltip>Route {'ABC'[r.id]} · PM2.5 {round(s.pm[idx])} µg/m³ (forecast)</LTooltip>
                  </Polyline>
                )
              }))}
              <CircleMarker center={[from.lat, from.lon]} radius={8} pathOptions={{ color: '#fff', fillColor: '#2ee59d', fillOpacity: 1 }}><LTooltip permanent direction="top">A</LTooltip></CircleMarker>
              <CircleMarker center={[to.lat, to.lon]} radius={8} pathOptions={{ color: '#fff', fillColor: '#ff4d6d', fillOpacity: 1 }}><LTooltip permanent direction="top">B</LTooltip></CircleMarker>
            </MapContainer>
          </div>
          <div className="cm-slider">
            <span>Depart</span>
            <input type="range" className="range" min="0" max={d.routes[0].byHour.length - 1} value={h} onChange={(e) => setH(Number(e.target.value))} />
            <b>{h === 0 ? 'Now' : fmtHour(d.times[h], tz)}</b>
          </div>
        </Card>

        <Card title="Your options" icon="🛣️">
          <div className="cm-routes">
            {d.routes.map((r) => {
              const x = r.byHour[h]
              const isBest = r.id === d.best.route.id
              return (
                <div key={r.id} className={'cm-route tilt' + (isBest ? ' best' : '')} style={{ '--c': RC[r.id] }}>
                  {isBest && <div className="crown">🌿 Cleanest</div>}
                  <b>Route {'ABC'[r.id]}{r.id === d.fastest.id ? ' · fastest' : ''}</b>
                  <div className="cm-row"><span>{round(r.distance / 1000, 1)} km</span><span>{round(r.duration / 60)} min</span></div>
                  <div className="cm-dose">{round(x.dose, 1)}<small> µg inhaled</small></div>
                  <div className="xs muted">avg PM2.5 {round(x.avg)} µg/m³ along the way</div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="span3" title="When should you leave? (inhaled PM2.5 by departure time)" icon="⏱️" right={<Tag kind="forecast" />}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chart}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true, timeZone: tz })} tick={{ fill: '#9aa4bf', fontSize: 11 }} minTickGap={30} />
              <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} unit=" µg" width={60} />
              <Tooltip contentStyle={tipStyle} labelFormatter={(t) => fmtHour(t, tz)} formatter={(v, n) => [v + ' µg', n]} />
              <Legend />
              <ReferenceLine x={d.best.t} stroke="#2ee59d" strokeDasharray="4 4" label={{ value: 'best', fill: '#2ee59d', fontSize: 11 }} />
              {d.routes.map((r) => <Line key={r.id} dataKey={'Route ' + 'ABC'[r.id]} stroke={RC[r.id]} strokeWidth={r.id === d.best.route.id ? 3.5 : 2} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </>}
    </div>
  )
}
