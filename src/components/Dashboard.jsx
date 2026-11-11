import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { getStationsInBounds, getCpcb } from '../lib/api'
import { Card, Tag, AqiChip, CountUp, Ring, Boundary } from './ui'
import { bands, category, usCategory, naqiCategory, naqiNow, POLLUTANTS, round, fmtTime, fmtHour, haversine, polLabel } from '../lib/aqi'
import { insights, contextFor } from '../lib/insights'

const BreathOrb = lazy(() => import('./BreathOrb'))

// Press & hold for one breath (4 s). Uses ~0.5 L tidal volume and ~15 m³/day adult inhalation (US EPA Exposure Factors).
function HoldToBreathe({ pm, onProgress, color }) {
  const [p, setP] = useState(0)
  const [done, setDone] = useState(null)
  const raf = useRef()
  const start = (e) => {
    e.preventDefault()
    setDone(null)
    const t0 = performance.now()
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 4000)
      setP(k); onProgress(k)
      if (k < 1) raf.current = requestAnimationFrame(tick)
      else { setDone(true); setTimeout(() => { setP(0); onProgress(0) }, 400) }
    }
    raf.current = requestAnimationFrame(tick)
  }
  const stop = () => { cancelAnimationFrame(raf.current); if (p < 1) { setP(0); onProgress(0) } }
  const perBreath = pm != null ? pm * 0.0005 : null
  return (
    <div className="htb" style={{ '--c': color, '--p': p }}>
      <button className="htb-btn" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} aria-label="Hold to take a breath">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" className="htb-track" /><circle cx="32" cy="32" r="28" className="htb-fill" style={{ strokeDashoffset: 176 * (1 - p) }} /></svg>
        <span>{p > 0 && p < 1 ? 'inhaling…' : 'Hold to breathe'}</span>
      </button>
      {done && perBreath != null && (
        <div className="htb-res">
          That breath carried <b>≈ {perBreath < 0.1 ? perBreath.toFixed(3) : perBreath.toFixed(2)} µg</b> of PM2.5.
          <br />A full day here ≈ <b>{Math.round(pm * 15)} µg</b> into your lungs.
          <small>Estimate: 0.5 L per breath, 15 m³/day (US EPA). Model PM2.5 {Math.round(pm)} µg/m³.</small>
        </div>
      )}
    </div>
  )
}

function ScaleMeter({ value }) {
  const B = bands()
  const max = B[B.length - 2].max * 1.25
  const pos = Math.min(100, ((value || 0) / max) * 100)
  return (
    <div className="meter">
      <div className="meter-bar" style={{ background: `linear-gradient(90deg, ${B.map((b, i) => `${b.color} ${Math.min(100, ((i ? B[i - 1].max : 0) / max) * 100)}%`).join(', ')})` }}>
        <i className="meter-pin" style={{ left: pos + '%' }}><b>{value ?? '—'}</b></i>
      </div>
      <div className="meter-l">{B.map((b) => <span key={b.key}>{b.short || b.label}</span>)}</div>
    </div>
  )
}

function Spark({ aq }) {
  const now = Date.now()
  const rows = useMemo(() => [
    ...aq.past.filter((r) => r.t > now - 24 * 3600e3),
    ...aq.forecast.slice(0, 24),
  ].filter((r) => r.us_aqi != null), [aq])
  if (rows.length < 4) return null
  const W = 600, H = 150, P = 8
  const t0 = rows[0].t, t1 = rows[rows.length - 1].t
  const max = Math.max(...rows.map((r) => r.us_aqi)) * 1.15, min = Math.min(...rows.map((r) => r.us_aqi)) * 0.8
  const x = (t) => P + ((t - t0) / (t1 - t0)) * (W - 2 * P)
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P)
  const pts = rows.map((r) => [x(r.t), y(r.us_aqi)])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const nx = x(now)
  const peak = rows.reduce((m, r) => (r.us_aqi > m.us_aqi ? r : m))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" x2="1">
          {rows.filter((_, i) => i % 6 === 0).map((r, i, a) => <stop key={i} offset={i / (a.length - 1 || 1)} stopColor={category(r.us_aqi).color} />)}
        </linearGradient>
        <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id="past"><rect x="0" y="0" width={nx} height={H} /></clipPath>
        <clipPath id="fut"><rect x={nx} y="0" width={W} height={H} /></clipPath>
      </defs>
      <path d={d + ` L ${W - P} ${H} L ${P} ${H} Z`} fill="url(#sf)" />
      <path d={d} fill="none" stroke="url(#sg)" strokeWidth="3" clipPath="url(#past)" />
      <path d={d} fill="none" stroke="url(#sg)" strokeWidth="3" strokeDasharray="6 6" clipPath="url(#fut)" opacity=".85" />
      <line x1={nx} x2={nx} y1="0" y2={H} stroke="#fff" strokeOpacity=".5" strokeDasharray="2 4" />
      <circle cx={nx} cy={y(aq.current?.us_aqi ?? rows[0].us_aqi)} r="6" fill="#fff" className="now-dot" />
      <text x={nx + 8} y="16" className="spark-t">NOW</text>
      <text x={P} y="16" className="spark-t mut">−24h · modelled</text>
      <text x={W - P} y="16" textAnchor="end" className="spark-t mut">+24h · forecast</text>
      <circle cx={x(peak.t)} cy={y(peak.us_aqi)} r="4" fill={category(peak.us_aqi).color} />
      <text x={Math.min(W - 70, x(peak.t) + 6)} y={y(peak.us_aqi) < 34 ? y(peak.us_aqi) + 18 : y(peak.us_aqi) - 8} textAnchor={x(peak.t) > W - 80 ? 'end' : 'start'} className="spark-t">peak {peak.us_aqi}</text>
    </svg>
  )
}

export default function Dashboard({ loc, aq, wx, station, onShare, go, scale = 'US', onScale }) {
  const c = aq.current || {}
  const { lines, s } = insights(aq, wx, loc.name)
  const st = station && !station.error && station.aqi != null ? station : null
  const [ai, setAi] = useState(null)
  const [breath, setBreath] = useState(0)
  const runAi = async () => {
    setAi({ busy: true })
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'brief', messages: [{ role: 'user', content: `Give me a crisp briefing for ${loc.name} right now: 1 line verdict, then 4 short bullets (health risk, who should be careful, best time to go out, what to do today). Use the ${scale === 'IN' ? 'India NAQI' : 'US AQI'} scale.` }], context: { ...contextFor(aq, wx, station, loc), stationsNearby: net?.slice(-5) } }) })
      const j = await r.json()
      if (!j.text) throw new Error(j.error)
      setAi({ text: j.text, model: j.model })
    } catch (e) {
      setAi({ err: e.message === 'No AI key configured' ? 'LLM briefing needs GEMINI_API_KEY on the server — the data-driven insights below are generated locally from live numbers.' : 'AI briefing unavailable right now (' + e.message + ').' })
    }
  }
  const [net, setNet] = useState(null)
  useEffect(() => {
    let off = false
    setNet(null)
    getStationsInBounds([loc.lat - 0.25, loc.lon - 0.3, loc.lat + 0.25, loc.lon + 0.3])
      .then((r) => {
        if (off) return
        const fresh = (r.stations || []).map((x) => ({ ...x, dist: haversine({ lat: loc.lat, lon: loc.lon }, x), ageH: x.time ? (Date.now() - new Date(x.time).getTime()) / 3600e3 : 99 }))
          .filter((x) => x.dist <= 25 && x.ageH < 3).sort((a, b) => a.aqi - b.aqi)
        setNet(fresh)
      }).catch(() => !off && setNet([]))
    return () => { off = true }
  }, [loc.lat, loc.lon])
  const [cpcb, setCpcb] = useState(null)
  useEffect(() => {
    let off = false
    setCpcb(null)
    if (/india/i.test(loc.country || '')) getCpcb(loc.lat, loc.lon).then((r) => !off && setCpcb(r)).catch((e) => !off && setCpcb({ error: e.message }))
    return () => { off = true }
  }, [loc.lat, loc.lon, loc.country])
  const cp = cpcb?.stations?.length ? cpcb : null
  const med = net?.length ? net[Math.floor(net.length / 2)].aqi : null
  const hot = net?.length ? net[net.length - 1] : null
  const IN = scale === 'IN'
  // Stations (WAQI) publish the US-EPA index only, so they drive the headline on the US scale.
  // On the India scale SAANS applies CPCB breakpoints to the latest concentrations.
  const useCp = IN && cp
  const useSt = (med != null && !IN) || useCp
  const modelVal = IN ? naqiNow(c)?.value : c.us_aqi
  const headline = useCp ? cp.cityAqi : useSt ? med : modelVal
  const cat = IN ? naqiCategory(headline) : category(headline)
  const scaleName = IN ? 'India NAQI (CPCB)' : 'US AQI (EPA)'
  const orbit = POLLUTANTS.filter((p) => c[p.key] != null).map((p) => {
    const x = c[p.key] / p.who
    return { label: p.label, value: round(c[p.key], p.key === 'carbon_monoxide' ? 0 : 1), color: x <= 1 ? '#2ee59d' : x <= 2 ? '#ffd43b' : x <= 4 ? '#ff922b' : '#ff4d6d' }
  })

  return (
    <>
      <section className="hero">
        <div className="hero-l">
          <div className="kicker"><i />LIVE AIR · {loc.country || 'Earth'} · {fmtTime(c.t, aq.tz)}</div>
          <h1 className="mega" data-text={loc.name}>{loc.name}</h1>
          <div className="aqi-row">
            <div className="aqi-wrap" style={{ '--c': cat.color }}><span className="halo" /><div className="aqi-mega"><CountUp value={headline} /></div></div>
            <div className="aqi-side">
              <span className="aqi-unit">{scaleName} · {useSt ? 'MEASURED' : 'MODEL ESTIMATE'}</span>
              <span className="cat-pill" style={{ '--c': cat.color }}>{cat.emoji} {cat.label}</span>
              <div className="tags">
                {useCp ? <Tag kind="measured">Official CPCB · {cp.stations.length} stations ≤30 km</Tag> : useSt ? <Tag kind="measured">Median of {net.length} station{net.length > 1 ? 's' : ''} ≤25 km</Tag> : <Tag kind={aq.stale ? 'stale' : 'model'}>{IN ? 'CPCB scale · from CAMS concentrations' : undefined}</Tag>}
                {useSt ? <Tag kind="model">Model {modelVal ?? '—'}</Tag> : med != null && <Tag kind="measured">Stations median US AQI {med}</Tag>}
              </div>
              <span className="xs muted">Main pollutant: <b>{polLabel(c.dominant)}</b> · <button className="linkbtn" onClick={onScale}>switch to {IN ? 'US AQI' : 'India NAQI'}</button></span>
            </div>
          </div>
          <ScaleMeter value={headline} />
          <p className="lede">{cat.meaning} <span>{cat.general}</span></p>
          {wx?.current && (
            <div className="wx-pills">
              <span>🌡️ <b>{round(wx.current.temperature_2m)}°C</b></span>
              <span>💨 <b>{round(wx.current.wind_speed_10m)} km/h</b>{wx.current.wind_speed_10m < 6 ? ' · calm, smog trapped' : ''}</span>
              <span>💧 <b>{wx.current.relative_humidity_2m}%</b> humidity</span>
              <span>🧪 PM2.5 <b>{round(c.pm2_5)}</b> µg/m³</span>
            </div>
          )}
          {useCp ? (() => { const h = [...cp.stations].sort((a, b) => b.aqi - a.aqi)[0]; return <p className="sm hotspot">🔥 Worst CPCB station: <b>{h.name.split(',')[0]}</b> — NAQI {h.aqi} ({h.dominant})</p> })()
            : hot && net.length > 1 && <p className="sm hotspot">🔥 Hotspot right now: <b>{hot.name?.split(',')[0]}</b> — US AQI {hot.aqi > 500 ? '500+' : hot.aqi} <span className="muted xs">(measured {fmtTime(hot.time)})</span></p>}
          {!useSt && !IN && net && <p className="xs muted">No ground station within 25 km reported in the last 3 hours — showing the Copernicus CAMS model estimate, which can under-estimate local hotspots.</p>}
          {c.epa_aqi >= 500 && !useSt && <p className="warn sm">⚠️ Model shows an extreme event at the top of the AQI scale (e.g. a modelled dust storm, PM10 {round(c.pm10)} µg/m³). Dust models can over-estimate.</p>}
          <div className="facts">
            <div><b><CountUp value={s.cig} decimals={1} /></b><span>cigarettes / day<br />equivalent 🚬</span></div>
            <div><b><CountUp value={s.whoX} decimals={1} />×</b><span>WHO PM2.5<br />daily limit</span></div>
            <div><b style={{ color: s.naqi?.category.color }}>{s.naqi?.value ?? '—'}</b><span>NAQI 24h avg*<br />{s.naqi?.category.label}</span></div>
          </div>
          <div className="cta">
            <button className="btn glow" onClick={onShare}>📸 Create share card</button>
            <button className="btn" onClick={() => go('assistant')}>✨ Ask SAANS AI</button>
            <button className="btn ghost" onClick={() => go('forecast')}>Forecast →</button>
          </div>
        </div>
        <div className="hero-r">
          <div className="breath-label"><span className="in">inhale</span><span className="out">exhale</span></div>
          <Boundary fallback={<div className="orb-fallback" style={{ '--c': cat.color }} />}><Suspense fallback={<div style={{ height: 560 }} />}>
            <BreathOrb color={cat.color} pm={c.pm2_5} height={560} orbit={orbit} zoom={7} inhale={breath > 0 && breath < 1} />
          </Suspense></Boundary>
          <HoldToBreathe pm={c.pm2_5} onProgress={setBreath} color={cat.color} />
          <div className="orb-cap">Each glowing speck ≈ live PM2.5 density · {round(c.pm2_5, 1)} µg/m³</div>
        </div>
        <div className="scroll-hint">scroll<i /></div>
      </section>

      <div className="marquee" style={{ '--c': cat.color }}>
        <div className="mq-in">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>BREATHE <i>✦</i> साँस <i>✦</i> {loc.name.toUpperCase()} <b>{headline ?? '—'}</b> <i>✦</i> {cat.label.toUpperCase()} <i>✦</i> BREATHE BETTER <i>✦</i> PM2.5 <b>{round(c.pm2_5)}</b> µg/m³ <i>✦</i> </span>
          ))}
        </div>
      </div>

      <div className="bento">
        <Card className="b-wide" title="Last 24h → next 24h" icon="〰" right={<div className="tags"><Tag kind="history">Modelled</Tag><Tag kind="forecast" /></div>}>
          <Spark aq={aq} />
        </Card>

        <Card className="b-tall glowborder" title="Best time to step out" icon="🏃" right={<Tag kind="forecast" />}>
          {s.best ? (
            <div className="best">
              <div className="best-t">{fmtHour(s.best.start, aq.tz)}</div>
              <div className="muted sm">until {new Date(s.best.end).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: aq.tz })}</div>
              <div className="best-aqi"><AqiChip v={round(s.best.aqi)} /> forecast AQI</div>
              <p className="sm">{category(s.best.aqi).activity}</p>
            </div>
          ) : <div className="muted">Forecast not available.</div>}
        </Card>

        {POLLUTANTS.map((p) => {
          const v = c[p.key]
          const x = v != null ? v / p.who : null
          const col = x == null ? '#7a869a' : x <= 1 ? '#2ee59d' : x <= 2 ? '#ffd43b' : x <= 4 ? '#ff922b' : '#ff4d6d'
          return (
            <div className="card pol tilt" key={p.key} style={{ '--pc': col }} title={p.desc}>
              <div className="spot" />
              <Ring pct={(x || 0) / 4} color={col} size={70}><b>{x != null ? round(x, 1) + '×' : '—'}</b></Ring>
              <div>
                <div className="pol-n">{p.label}</div>
                <div className="pol-v">{v != null ? round(v, 1) : '—'}<small> {p.unit}</small></div>
                <div className="pol-w">WHO guideline {p.who}</div>
              </div>
            </div>
          )
        })}

        <Card className="b-wide glowborder" title="AI insights" icon="✦" right={<div className="tags"><button className="btn sm glow" onClick={runAi} disabled={ai?.busy}>{ai?.busy ? 'Thinking…' : '✨ AI briefing'}</button><button className="btn ghost sm" onClick={() => go('assistant')}>Ask follow-ups →</button></div>}>
          {ai?.text && <div className="ai-brief"><div className="ai-h">✨ {ai.model || 'AI'} briefing · grounded on the live numbers below</div>{ai.text}</div>}
          {ai?.err && <p className="xs muted">{ai.err}</p>}
          <ul className="insights">{lines.map((l, i) => <li key={i} style={{ animationDelay: i * 90 + 'ms' }}>{l}</li>)}</ul>
        </Card>

        <Card className="b-tall" title="Monitoring stations nearby" icon="📡" right={<Tag kind="measured">{useCp ? 'Measured · CPCB' : 'Measured · WAQI'}</Tag>}>
          {useCp ? (
            <ul className="st-list">
              {[...cp.stations].sort((x, y) => y.aqi - x.aqi).slice(0, 10).map((x) => (
                <li key={x.name}>
                  <span className="st-n">{x.name.split(',')[0]}<small>{x.dist} km · {x.dominant} · {x.time ? fmtTime(x.time) : ''}</small></span>
                  <AqiChip v={x.aqi} color={naqiCategory(x.aqi).color} />
                </li>
              ))}
            </ul>
          ) : net == null ? <div className="muted sm">Finding stations…</div> : net.length ? (
            <ul className="st-list">
              {[...net].reverse().slice(0, 8).map((x) => {
                const v = x.aqi
                const cc = usCategory(v)
                return (
                  <li key={x.uid}>
                    <span className="st-n">{x.name?.split(',')[0]}<small>{round(x.dist, 1)} km · {x.time ? new Date(x.time).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</small></span>
                    <AqiChip v={v} color={cc.color} />
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="muted sm">
              {st && <p>Nearest station <b>{st.station}</b>: US AQI {st.aqi} ({fmtTime(st.time)}) — older than 3 h or farther than 25 km.</p>}
              No fresh ground-station reading within 25 km. The model estimate above is still live.
            </div>
          )}
          <p className="muted xs">{useCp ? 'Official CPCB NAQI (24-h averages) via data.gov.in Open Government Data. ' : 'Station values are WAQI\'s US-EPA index (hourly). '}Data: World Air Quality Index Project (aqicn.org) · CPCB / state boards.</p>
        </Card>

        <Card className="b-full acc" title="Live accuracy check — model vs ground stations" icon="🎯" right={<div className="tags"><Tag kind="model">CAMS model</Tag><Tag kind="measured">WAQI stations</Tag></div>}>
          {net?.length ? (() => {
            const vals = net.map((x) => x.aqi)
            const lo = vals[0], hi2 = vals[vals.length - 1]
            const bias = c.epa_aqi != null && med ? Math.round(((c.epa_aqi - med) / med) * 100) : null
            const W = 100, pos = (v) => Math.min(100, (v / Math.max(hi2, c.epa_aqi || 0, 1)) * W)
            return (
              <div className="acc-grid">
                <div className="acc-k"><span>Model estimate (US AQI)</span><b>{c.epa_aqi ?? '—'}</b></div>
                <div className="acc-k"><span>Stations median · {net.length} within 25 km</span><b>{med}</b></div>
                <div className="acc-k"><span>Model bias vs measured</span><b className={Math.abs(bias) <= 15 ? 'down' : 'up'}>{bias > 0 ? '+' : ''}{bias}%</b></div>
                <div className="acc-bar">
                  <div className="acc-range" style={{ left: pos(lo) + '%', width: Math.max(1, pos(hi2) - pos(lo)) + '%' }} />
                  {net.map((x) => <i key={x.uid} className="acc-st" style={{ left: pos(x.aqi) + '%', background: usCategory(x.aqi).color }} title={`${x.name}: ${x.aqi}`} />)}
                  <i className="acc-model" style={{ left: pos(c.epa_aqi || 0) + '%' }}><b>model</b></i>
                </div>
                <p className="xs muted acc-note">Each dot is a real monitoring station (hourly, last 3 h). Station spread {lo}–{hi2} shows how much air varies street-to-street; a gridded model can't resolve single hotspots. {Math.abs(bias) <= 15 ? 'The model agrees with measurements within ±15% here.' : 'The model differs by more than 15% here — trust the station readings for local decisions.'}</p>
              </div>
            )
          })() : <p className="muted sm">No fresh ground stations within 25 km to validate against — showing the model estimate only.</p>}
        </Card>

        <Card className="b-full src" right={null}>
          <div className="src-row">
            <span>🕒 Updated <b>{fmtTime(c.t, aq.tz)}</b> ({aq.tz})</span>
            <span>📡 {aq.source}</span>
            <span>🇪🇺 European AQI <b>{c.european_aqi ?? '—'}</b></span>
            <span>☀️ UV <b>{round(c.uv_index, 1) ?? '—'}</b></span>
            {aq.stale && <span className="warn">Cached data from {fmtTime(aq.cachedAt)}</span>}
          </div>
          <p className="muted xs">How SAANS computes AQI: US EPA method from modelled concentrations — NowCast (12h) for PM2.5/PM10, 1h NO₂/SO₂, 8h CO. CAMS ozone (8h sub-index: {c.o3_aqi ?? '—'}) is shown separately and not used in the headline because the model strongly over-estimates ozone over South Asia (Open-Meteo's raw index here: {c.us_aqi_cams ?? '—'}). Ground-station readings (WAQI) take priority when a station within 25 km reported in the last 2 hours.</p>
          <p className="muted xs">*India NAQI computed by SAANS from 24h-average modelled concentrations using CPCB breakpoints — an estimate, not an official CPCB reading.</p>
        </Card>
      </div>
    </>
  )
}
