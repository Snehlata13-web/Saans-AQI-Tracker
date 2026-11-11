import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea } from 'recharts'
import { Card, Tag, AqiChip } from './ui'
import { mlForecast, daily, bestWindow } from '../lib/analytics'
import { category, round, hiThreshold, scaleName } from '../lib/aqi'
import { tipStyle } from './History'

export default function Forecast({ loc, aq, wx }) {
  const tz = aq.tz
  const ml = useMemo(() => (wx ? mlForecast(aq.past, wx.rows, { horizon: 72, tzOffsetH: aq.offsetH }) : null), [aq, wx])
  const now = Date.now()
  const cur = aq.current?.us_aqi

  const data = useMemo(() => {
    const m = new Map()
    const put = (t, k, v) => { if (!m.has(t)) m.set(t, { t }); m.get(t)[k] = v }
    aq.past.filter((r) => r.t > now - 48 * 3600e3).forEach((r) => put(r.t, 'past', r.us_aqi))
    aq.forecast.forEach((r) => put(r.t, 'fc', r.us_aqi))
    ml?.preds.forEach((r) => put(r.t, 'ml', r.us_aqi))
    const last = aq.past[aq.past.length - 1]
    if (last) put(last.t, 'fc', last.us_aqi)
    return [...m.values()].sort((a, b) => a.t - b.t)
  }, [aq, ml])

  const spikes = aq.forecast.filter((r, i, a) => r.us_aqi != null && (r.us_aqi > hiThreshold() || (cur && r.us_aqi > cur * 1.3)) && (i === 0 || a[i - 1].us_aqi <= r.us_aqi) && (i === a.length - 1 || a[i + 1].us_aqi < r.us_aqi))
  const fDays = daily(aq.forecast, tz)
  const best = bestWindow(aq.forecast, 2, tz)
  const tf = (t) => new Date(t).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', hour12: true, timeZone: tz })

  return (
    <div className="grid">
      <Card className="span3" title={`${scaleName()} forecast · ${loc.name}`} icon="🔮" right={<div className="tags"><Tag kind="history">Past 48h (modelled)</Tag><Tag kind="forecast">CAMS forecast</Tag>{ml && <Tag kind="ml" />}</div>}>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5ec8ff" stopOpacity={0.5} /><stop offset="1" stopColor="#5ec8ff" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.06)" />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tf} tick={{ fill: '#9aa4bf', fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fill: '#9aa4bf', fontSize: 11 }} />
            <Tooltip contentStyle={tipStyle} labelFormatter={(t) => tf(t)} formatter={(v, n) => [round(v), n]} />
            <ReferenceArea x1={now} x2={data[data.length - 1]?.t} fill="#ffb34710" />
            <ReferenceLine x={now} stroke="#fff" strokeDasharray="3 3" label={{ value: 'NOW', fill: '#fff', fontSize: 11, position: 'insideTopLeft' }} />
            <ReferenceLine y={hiThreshold()} stroke="#ff4d6d66" strokeDasharray="2 4" />
            <Area dataKey="past" name="Past (modelled)" stroke="#5ec8ff" fill="url(#gp)" strokeWidth={2} connectNulls />
            <Line dataKey="fc" name="CAMS forecast" stroke="#ffb347" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls />
            {ml && <Line dataKey="ml" name="SAANS ML prediction" stroke="#e879f9" strokeWidth={2} strokeDasharray="2 3" dot={false} connectNulls />}
          </ComposedChart>
        </ResponsiveContainer>
        <p className="muted xs">Everything right of NOW is a forecast, not a measurement. Shaded region = future.</p>
      </Card>

      <Card className="span2" title="Daily outlook" icon="📅" right={<Tag kind="forecast" />}>
        <div className="fdays">
          {fDays.map((d) => {
            const c = category(d.us_aqi)
            return (
              <div key={d.day} className="fday tilt" style={{ '--c': c.color }}>
                <div className="muted sm">{new Date(d.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div className="fday-v">{round(d.us_aqi)}</div>
                <div className="sm">{c.emoji} {c.short || c.label}</div>
                <div className="muted xs">peak {round(d.us_aqi_max)} · PM2.5 {round(d.pm2_5)}</div>
              </div>
            )
          })}
        </div>
        {best && <p className="best-line">🏃 Best 2-hour window: <b>{tf(best.start)}</b> (≈ AQI {round(best.aqi)})</p>}
      </Card>

      <Card title="Predicted spikes" icon="⚠️" right={<Tag kind="forecast" />}>
        {spikes.length === 0 ? <p className="muted">No major spikes expected in the forecast window. 🎉</p> : (
          <ul className="anoms">
            {spikes.slice(0, 6).map((s) => <li key={s.t}><b>{tf(s.t)}</b><span>Expected AQI <AqiChip v={s.us_aqi} /> · {category(s.us_aqi).label}</span></li>)}
          </ul>
        )}
      </Card>

      {ml && (
        <Card className="span3" title="SAANS ML model — how it works" icon="🧠" right={<Tag kind="ml" />}>
          <div className="ml-grid">
            <div>
              <p className="sm">An autoregressive <b>ridge-regression</b> model trained live in your browser on <b>{ml.nTrain}</b> hours of {loc.name}'s PM2.5 history, using lagged pollution (1h, 2h, 3h, 24h), time-of-day and <b>weather covariates</b> (wind, humidity, boundary-layer height, temperature, rain) from Open-Meteo. It rolls forward 72h using the weather forecast.</p>
              <div className="kpis">
                <div><span>Backtest MAE (48h)</span><b>{round(ml.mae, 1)} µg/m³</b></div>
                <div><span>Persistence baseline</span><b>{round(ml.maeBase, 1)} µg/m³</b></div>
                <div><span>Skill vs baseline</span><b className={ml.skill > 0 ? 'down' : 'up'}>{ml.skill != null ? round(ml.skill * 100) + '%' : '—'}</b></div>
              </div>
            </div>
            <div>
              <h3 className="sub-h">Feature influence (|weight|)</h3>
              {ml.importance.slice(0, 7).map((f) => (
                <div key={f.f} className="fi"><span>{f.f}</span><div className="bar"><i style={{ width: Math.min(100, Math.abs(f.w) * 120) + '%', background: f.w > 0 ? '#ff7a8a' : '#2ee59d' }} /></div><small>{f.w > 0 ? '↑' : '↓'}</small></div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
