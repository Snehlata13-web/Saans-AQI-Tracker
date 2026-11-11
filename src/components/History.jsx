import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceDot, Bar, LineChart, Legend } from 'recharts'
import { Card, Tag, Loader, ErrorBox, AqiChip } from './ui'
import { getHistory } from '../lib/api'
import { daily, detectAnomalies, pctChange } from '../lib/analytics'
import { avg, round, category, cigarettes, scaleName, hiThreshold } from '../lib/aqi'
import { DIWALI } from '../lib/cities'

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const today = () => iso(new Date())
export const tipStyle = { background: 'rgba(10,14,30,.92)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: '#fff' }

function useHistory(loc, start, end) {
  const [st, setSt] = useState({ loading: true })
  const [k, setK] = useState(0)
  useEffect(() => {
    let off = false
    setSt({ loading: true })
    getHistory(loc.lat, loc.lon, start, end).then((d) => !off && setSt({ data: d }), (e) => !off && setSt({ error: e }))
    return () => { off = true }
  }, [loc.lat, loc.lon, start, end, k])
  return { ...st, retry: () => setK(k + 1) }
}

export default function History({ loc }) {
  const [range, setRange] = useState(30)
  const [custom, setCustom] = useState({ start: addDays(today(), -60), end: today() })
  const start = range === 'c' ? custom.start : addDays(today(), -range)
  const end = range === 'c' ? custom.end : today()
  const h = useHistory(loc, start, end)

  const rows = h.data?.rows?.filter((r) => r.t <= Date.now()) || []
  const days = useMemo(() => daily(rows, h.data?.tz).filter((d) => d.n >= 12), [h.data])
  const anomalies = useMemo(() => detectAnomalies(rows), [h.data])

  const half = Math.floor(days.length / 2)
  const trend = pctChange(avg(days.slice(0, half).map((d) => d.pm2_5)), avg(days.slice(half).map((d) => d.pm2_5)))
  const spikes = days.filter((d, i) => i > 0 && days[i - 1].us_aqi && d.us_aqi > days[i - 1].us_aqi * 1.3 && d.us_aqi > hiThreshold() / 2)
  const worst = days.reduce((m, d) => (!m || d.us_aqi > m.us_aqi ? d : m), null)
  const bestD = days.reduce((m, d) => (!m || d.us_aqi < m.us_aqi ? d : m), null)
  const overWHO = days.filter((d) => d.pm2_5 > 15).length
  const chartDays = days.map((d, i) => ({ ...d, delta: i ? pctChange(days[i - 1].us_aqi, d.us_aqi) : null }))

  const report = days.length ? [
    `# SAANS Pollution Impact Report — ${loc.name}`,
    `Period: ${start} → ${end} (${days.length} days) · Data: Open-Meteo Air Quality API (Copernicus CAMS, modelled)`,
    ``,
    `- Average ${scaleName()}: **${round(avg(days.map((d) => d.us_aqi)))}** (${category(avg(days.map((d) => d.us_aqi))).label})`,
    `- Average PM2.5: **${round(avg(days.map((d) => d.pm2_5)), 1)} µg/m³**, PM10: **${round(avg(days.map((d) => d.pm10)), 1)} µg/m³**`,
    `- Worst day: **${worst.day}** (AQI ${round(worst.us_aqi)}, peak hour ${round(worst.us_aqi_max)}) · Cleanest day: **${bestD.day}** (AQI ${round(bestD.us_aqi)})`,
    `- Days above WHO PM2.5 guideline (15 µg/m³): **${overWHO}/${days.length}** (${round((overWHO / days.length) * 100)}%)`,
    `- Trend (2nd half vs 1st half PM2.5): **${trend != null ? (trend > 0 ? '+' : '') + round(trend, 1) + '%' : 'n/a'}**`,
    `- Pollution spike days (>30% jump): **${spikes.length}** ${spikes.map((s) => s.day).join(', ')}`,
    `- Anomalous hourly events detected: **${anomalies.events.length}**`,
    `- Cumulative exposure ≈ **${round(days.reduce((s, d) => s + (cigarettes(d.pm2_5) || 0), 0))} cigarettes** (Berkeley Earth equivalence)`,
  ].join('\n') : ''

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([report], { type: 'text/markdown' }))
    a.download = `saans-report-${loc.name}-${start}_${end}.md`
    a.click()
  }

  return (
    <div className="grid">
      <Card className="span3" title={`Historical tracker · ${loc.name}`} icon="📈" right={<Tag kind="history" />}>
        <div className="seg">
          {[7, 30, 90, 365].map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r === 365 ? '1Y' : r + 'D'}</button>)}
          <button className={range === 'c' ? 'on' : ''} onClick={() => setRange('c')}>Custom</button>
          {range === 'c' && <>
            <input type="date" value={custom.start} min="2022-08-01" max={custom.end} onChange={(e) => setCustom({ ...custom, start: e.target.value })} />
            <input type="date" value={custom.end} min={custom.start} max={today()} onChange={(e) => setCustom({ ...custom, end: e.target.value })} />
          </>}
        </div>
        {h.loading && <Loader text="Loading history…" />}
        <ErrorBox error={h.error} onRetry={h.retry} />
        {days.length > 0 && <>
          <div className="kpis">
            <div><span>Avg {scaleName()}</span><b><AqiChip v={round(avg(days.map((d) => d.us_aqi)))} /></b></div>
            <div><span>PM2.5 trend</span><b className={trend > 0 ? 'up' : 'down'}>{trend != null ? (trend > 0 ? '▲ +' : '▼ ') + round(trend, 1) + '%' : '—'}</b></div>
            <div><span>Worst day</span><b>{worst.day} <AqiChip v={round(worst.us_aqi)} /></b></div>
            <div><span>Cleanest day</span><b>{bestD.day} <AqiChip v={round(bestD.us_aqi)} /></b></div>
            <div><span>Days &gt; WHO PM2.5</span><b>{overWHO}/{days.length}</b></div>
            <div><span>Spikes / anomalies</span><b>{spikes.length} / {anomalies.events.length}</b></div>
          </div>
          <h3 className="sub-h">Daily {scaleName()} (avg & peak hour) with day-over-day % change</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartDays}>
              <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff4d6d" stopOpacity={0.7} /><stop offset="1" stopColor="#5ec8ff" stopOpacity={0.05} /></linearGradient></defs>
              <CartesianGrid stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="day" tick={{ fill: '#9aa4bf', fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} />
              <Tooltip contentStyle={tipStyle} content={({ active, payload, label }) => active && payload?.length ? (
                <div style={{ ...tipStyle, padding: 10 }}>
                  <b>{label}</b><br />Avg AQI {round(payload[0].payload.us_aqi)} · Peak {round(payload[0].payload.us_aqi_max)}<br />
                  {payload[0].payload.delta != null && <span className={payload[0].payload.delta > 0 ? 'up' : 'down'}>Δ vs prev day {payload[0].payload.delta > 0 ? '+' : ''}{round(payload[0].payload.delta, 1)}%</span>}
                </div>) : null} />
              <Area type="monotone" dataKey="us_aqi" name="Avg AQI" stroke="#ff7a8a" fill="url(#ga)" strokeWidth={2} />
              <Line type="monotone" dataKey="us_aqi_max" name="Peak hour AQI" stroke="#ffd43b" dot={false} strokeDasharray="4 3" />
              {spikes.map((s) => <ReferenceDot key={s.day} x={s.day} y={s.us_aqi} r={7} fill="#ff2a2a" stroke="#fff" label={{ value: '⚡', position: 'top' }} />)}
              <ReferenceLine y={hiThreshold() * 2 / 3} stroke="#ffd43b55" strokeDasharray="2 4" />
              <ReferenceLine y={hiThreshold()} stroke="#ff922b55" strokeDasharray="2 4" />
            </ComposedChart>
          </ResponsiveContainer>
          <h3 className="sub-h">PM2.5 vs PM10 (daily mean, µg/m³)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={days}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="day" tick={{ fill: '#9aa4bf', fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => round(v, 1)} />
              <Legend />
              <Bar dataKey="pm10" name="PM10" fill="#b56cff88" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="pm2_5" name="PM2.5" stroke="#5ec8ff" strokeWidth={2.5} dot={false} />
              <ReferenceLine y={15} stroke="#2ee59d" strokeDasharray="4 4" label={{ value: 'WHO PM2.5 15', fill: '#2ee59d', fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </>}
      </Card>

      {days.length > 0 && <DateCompare rows={rows} tz={h.data?.tz} days={days} />}

      {days.length > 0 && (
        <Card title="Anomaly detection" icon="🛰️" right={<span className="muted xs">robust z-score (median/MAD, 48h window)</span>}>
          {anomalies.events.length === 0 ? <p className="muted">No unusual spikes detected in this period.</p> : (
            <ul className="anoms">
              {anomalies.events.slice(-8).reverse().map((e) => (
                <li key={e.start}>
                  <b>{new Date(e.peakT).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: h.data?.tz })}</b>
                  <span>PM2.5 peaked at <b>{round(e.peak)}</b> vs baseline {round(e.baseline)} µg/m³ (<span className="up">+{round(pctChange(e.baseline, e.peak))}%</span>)</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {report && (
        <Card className="span2" title="Pollution impact report" icon="📄" right={<button className="btn sm" onClick={download}>⬇ Download .md</button>}>
          <pre className="report">{report.replace(/\*\*/g, '')}</pre>
        </Card>
      )}

      <DiwaliEffect loc={loc} />
    </div>
  )
}

function DateCompare({ rows, tz, days }) {
  const [a, setA] = useState(days[0].day)
  const [b, setB] = useState(days[days.length - 1].day)
  const fmtH = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date(t)))
  const dk = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t))
  const ra = rows.filter((r) => dk(r.t) === a), rb = rows.filter((r) => dk(r.t) === b)
  const data = Array.from({ length: 24 }, (_, hr) => ({ hr: hr + ':00', A: ra.find((r) => fmtH(r.t) === hr)?.us_aqi, B: rb.find((r) => fmtH(r.t) === hr)?.us_aqi }))
  const da = days.find((d) => d.day === a), db = days.find((d) => d.day === b)
  const ch = (k) => pctChange(da?.[k], db?.[k])
  return (
    <Card className="span2" title="Compare two dates" icon="🗓️">
      <div className="seg">
        <label>A <select value={a} onChange={(e) => setA(e.target.value)}>{days.map((d) => <option key={d.day}>{d.day}</option>)}</select></label>
        <label>B <select value={b} onChange={(e) => setB(e.target.value)}>{days.map((d) => <option key={d.day}>{d.day}</option>)}</select></label>
      </div>
      <div className="kpis">
        {[['us_aqi', 'AQI'], ['pm2_5', 'PM2.5'], ['pm10', 'PM10']].map(([k, l]) => (
          <div key={k}><span>{l}: {round(da?.[k], 1)} → {round(db?.[k], 1)}</span><b className={ch(k) > 0 ? 'up' : 'down'}>{ch(k) != null ? (ch(k) > 0 ? '▲ +' : '▼ ') + round(ch(k), 1) + '%' : '—'}</b></div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" />
          <XAxis dataKey="hr" tick={{ fill: '#9aa4bf', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} />
          <Tooltip contentStyle={tipStyle} />
          <Legend />
          <Line dataKey="A" name={a} stroke="#5ec8ff" strokeWidth={2} dot={false} />
          <Line dataKey="B" name={b} stroke="#ff7a8a" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

function DiwaliEffect({ loc }) {
  const [st, setSt] = useState({ loading: true })
  useEffect(() => {
    let off = false
    setSt({ loading: true })
    Promise.all(DIWALI.map(async (d) => {
      const end = addDays(d.date, 5) > today() ? today() : addDays(d.date, 5)
      const h = await getHistory(loc.lat, loc.lon, addDays(d.date, -7), end, ['pm2_5'])
      const dd = daily(h.rows.filter((r) => r.t <= Date.now()), h.tz, ['pm2_5'])
      return { ...d, days: dd }
    })).then((r) => !off && setSt({ data: r }), (e) => !off && setSt({ error: e }))
    return () => { off = true }
  }, [loc.lat, loc.lon])

  const COLORS = ['#a5b4fc', '#5ec8ff', '#ffd43b', '#ff7a18']
  const chart = Array.from({ length: 13 }, (_, i) => {
    const off = i - 7
    const o = { off: off === 0 ? 'Diwali' : (off > 0 ? '+' : '') + off + 'd' }
    st.data?.forEach((y) => { o[y.year] = round(y.days.find((d) => d.day === addDays(y.date, off))?.pm2_5, 1) })
    return o
  })
  const stats = st.data?.map((y) => {
    const base = avg(y.days.filter((d) => d.day < addDays(y.date, -2)).map((d) => d.pm2_5))
    const peakD = y.days.filter((d) => d.day >= y.date && d.day <= addDays(y.date, 2)).reduce((m, d) => (!m || d.pm2_5 > m.pm2_5 ? d : m), null)
    return { year: y.year, base, peak: peakD?.pm2_5, change: pctChange(base, peakD?.pm2_5) }
  })
  return (
    <Card className="span3 diwali" title="🪔 Diwali Effect — firecracker impact on PM2.5" right={<Tag kind="history" />}>
      <p className="muted sm">Daily mean PM2.5 from 7 days before to 5 days after Diwali, for every year since 2023 — aligned on the festival night for {loc.name}.</p>
      {st.loading && <Loader text="Crunching four Diwalis of data…" />}
      <ErrorBox error={st.error} />
      {st.data && <>
        <div className="kpis">
          {stats.map((s, i) => (
            <div key={s.year} style={{ borderColor: COLORS[i] }}><span>Diwali {s.year}: {round(s.base)} → {round(s.peak)} µg/m³</span>
              <b className={s.change > 0 ? 'up' : 'down'}>{s.change != null ? (s.change > 0 ? '▲ +' : '▼ ') + round(s.change) + '%' : 'n/a'}</b></div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart}>
            <CartesianGrid stroke="rgba(255,255,255,.06)" />
            <XAxis dataKey="off" tick={{ fill: '#9aa4bf', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} unit="" />
            <Tooltip contentStyle={tipStyle} />
            <Legend />
            <ReferenceLine x="Diwali" stroke="#ffb347" strokeWidth={2} label={{ value: '🪔', position: 'top' }} />
            <ReferenceLine y={15} stroke="#2ee59d" strokeDasharray="4 4" />
            {DIWALI.map((d, i) => <Line key={d.year} dataKey={String(d.year)} name={'Diwali ' + d.year} stroke={COLORS[i]} strokeWidth={d.year === 2026 ? 3.5 : 2} dot={{ r: 2 }} connectNulls />)}
          </LineChart>
        </ResponsiveContainer>
        <p className="muted xs">Peak = highest daily mean from Diwali night to +2 days; baseline = mean of days −7 to −3. Weather also plays a big role — calm, cold nights trap smoke.</p>
      </>}
    </Card>
  )
}
