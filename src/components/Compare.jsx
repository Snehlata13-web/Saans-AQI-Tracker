import { useEffect, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { Card, Tag, AqiChip, Loader } from './ui'
import LocationSearch from './LocationSearch'
import { getAirQuality } from '../lib/api'
import { daily } from '../lib/analytics'
import { POLLUTANTS, round, category, scaleName } from '../lib/aqi'
import { tipStyle } from './History'

const COLORS = ['#5ec8ff', '#ff7a8a', '#ffd43b', '#2ee59d', '#e879f9']

export default function Compare({ loc }) {
  const [list, setList] = useState(() => [loc, { name: 'Mumbai', lat: 19.076, lon: 72.8777, country: 'India' }, { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, country: 'India' }])
  const [data, setData] = useState({})
  useEffect(() => {
    list.forEach((l) => {
      const k = l.lat + ',' + l.lon
      if (data[k]) return
      getAirQuality(l.lat, l.lon, { pastDays: 7, forecastDays: 1 })
        .then((d) => setData((o) => ({ ...o, [k]: d })), (e) => setData((o) => ({ ...o, [k]: { error: e.message } })))
    })
  }, [list])

  const rows = list.map((l, i) => ({ l, i, d: data[l.lat + ',' + l.lon] }))
  const ready = rows.filter((r) => r.d && !r.d.error)
  const best = ready.reduce((m, r) => (!m || (r.d.current?.us_aqi ?? 999) < (m.d.current?.us_aqi ?? 999) ? r : m), null)

  const polData = POLLUTANTS.map((p) => {
    const o = { p: p.label }
    ready.forEach((r) => { o[r.l.name] = round(r.d.current?.[p.key], 1) })
    return o
  }).filter((o) => o.p !== 'CO')

  const trend = {}
  ready.forEach((r) => daily(r.d.past, r.d.tz).forEach((d) => { trend[d.day] = { ...(trend[d.day] || { day: d.day }), [r.l.name]: round(d.us_aqi) } }))
  const trendData = Object.values(trend).sort((a, b) => a.day.localeCompare(b.day))

  return (
    <div className="grid">
      <Card className="span3" title="Compare locations" icon="⚖️" right={<Tag kind="model" />}>
        <div className="cmp-top">
          {list.length < 5 && <LocationSearch compact placeholder="Add a location to compare…" onPick={(p) => setList((l) => [...l, p])} />}
          <span className="muted xs">Up to 5 locations</span>
        </div>
        <div className="cmp-cards">
          {rows.map(({ l, i, d }) => {
            const c = category(d?.current?.us_aqi)
            return (
              <div key={l.lat + l.name} className={'cmp-card tilt' + (best && best.l === l ? ' best' : '')} style={{ '--c': COLORS[i], '--cc': c.color }}>
                {best && best.l === l && <div className="crown">👑 Cleanest</div>}
                <button className="x" onClick={() => setList((ls) => ls.filter((x) => x !== l))}>×</button>
                <b>{l.name}</b><span className="muted xs">{l.country}</span>
                {!d ? <Loader text="" /> : d.error ? <span className="warn xs">{d.error}</span> : <>
                  <div className="cmp-aqi" style={{ color: c.color }}>{d.current?.us_aqi ?? '—'}</div>
                  <div className="sm">{c.label}</div>
                  {best && best.l !== l && d.current?.us_aqi != null && <div className="xs muted">+{d.current.us_aqi - best.d.current.us_aqi} vs cleanest</div>}
                </>}
              </div>
            )
          })}
        </div>
        {ready.length > 0 && (
          <table className="tbl">
            <thead><tr><th>Pollutant</th>{ready.map((r) => <th key={r.l.name} style={{ color: COLORS[r.i] }}>{r.l.name}</th>)}</tr></thead>
            <tbody>
              <tr><td>{scaleName()}</td>{ready.map((r) => <td key={r.l.name}><AqiChip v={r.d.current?.us_aqi} /></td>)}</tr>
              {POLLUTANTS.map((p) => {
                const vals = ready.map((r) => r.d.current?.[p.key]).filter((v) => v != null)
                const mn = Math.min(...vals)
                return <tr key={p.key}><td>{p.label} <small className="muted">{p.unit}</small></td>{ready.map((r) => {
                  const v = r.d.current?.[p.key]
                  return <td key={r.l.name} className={v === mn && vals.length > 1 ? 'win' : ''}>{v != null ? round(v, 1) : '—'}</td>
                })}</tr>
              })}
            </tbody>
          </table>
        )}
      </Card>
      {ready.length > 0 && <>
        <Card className="span2" title="7-day AQI trend" icon="📉" right={<Tag kind="history" />}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="day" tick={{ fill: '#9aa4bf', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} />
              <Tooltip contentStyle={tipStyle} /><Legend />
              {ready.map((r) => <Line key={r.l.name} dataKey={r.l.name} stroke={COLORS[r.i]} strokeWidth={2.5} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Pollutant differences" icon="🧪">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={polData}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="p" tick={{ fill: '#9aa4bf', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} />
              <Tooltip contentStyle={tipStyle} />
              {ready.map((r) => <Bar key={r.l.name} dataKey={r.l.name} fill={COLORS[r.i]} radius={[4, 4, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </>}
    </div>
  )
}
