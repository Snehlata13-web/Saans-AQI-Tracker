import { useEffect, useState } from 'react'
import { Card } from './ui'
import { bands, category, POLLUTANTS, round, scaleName } from '../lib/aqi'

const PERSONAS = [
  { k: 'general', l: '🧑 General public', f: (c) => c.general },
  { k: 'kids', l: '🧒 Children', f: (c, a) => a > 100 ? 'Children breathe faster and inhale more pollution per kg. Move play & sports indoors; avoid school-run hours near traffic.' : 'Outdoor play is fine. Avoid busy roads during rush hour.' },
  { k: 'elderly', l: '👵 Elderly', f: (c, a) => a > 100 ? 'Limit time outdoors, avoid morning walks when smog is trapped low; keep medicines handy.' : 'Morning/evening walks are fine; prefer parks over roads.' },
  { k: 'asthma', l: '🫁 Asthma / COPD', f: (c, a) => a > 50 ? 'Carry your reliever inhaler, follow your action plan, avoid outdoor exertion. Use N95 outdoors and HEPA purifier indoors.' : 'Low risk today — still keep your inhaler with you.' },
  { k: 'heart', l: '❤️ Heart disease', f: (c, a) => a > 100 ? 'PM2.5 can trigger heart attacks/arrhythmias. Avoid exertion outdoors; seek care for chest pain, palpitations or breathlessness.' : 'Light activity OK. Watch for unusual symptoms.' },
  { k: 'preg', l: '🤰 Pregnant', f: (c, a) => a > 100 ? 'Air pollution is linked to low birth weight. Stay indoors in filtered air and avoid traffic exposure.' : 'Fine to go out; avoid heavy-traffic areas.' },
  { k: 'athlete', l: '🏃 Runners & athletes', f: (c, a) => a > 150 ? 'Do NOT train outdoors — deep breathing during exercise multiplies your dose. Use a treadmill in filtered air.' : a > 100 ? 'Shorten and soften outdoor sessions; train when AQI is lowest (see Forecast).' : 'Great conditions for outdoor training.' },
]

export default function Health({ aq }) {
  const aqi = aq?.current?.us_aqi
  const cur = category(aqi)
  const [sel, setSel] = useState(cur.key === 'na' ? bands()[0].key : cur.key)
  useEffect(() => { if (cur.key !== 'na') setSel(cur.key) }, [cur.key])
  const [p, setP] = useState('general')
  const CATS = bands()
  const c = CATS.find((x) => x.key === sel) || CATS[0]
  const per = PERSONAS.find((x) => x.k === p)
  return (
    <div className="grid">
      <Card className="span3" title={`What does the ${scaleName()} mean?`} icon="🩺">
        <div className="scale">
          {CATS.map((x, i) => (
            <button key={x.key} className={'sc tilt' + (sel === x.key ? ' on' : '') + (cur.key === x.key ? ' cur' : '')} style={{ '--c': x.color }} onClick={() => setSel(x.key)}>
              <b>{i ? CATS[i - 1].max + 1 : 0}{x.max < 999 ? '–' + x.max : '+'}</b>
              <span>{x.emoji} {x.short || x.label}</span>
              {cur.key === x.key && <em>you are here</em>}
            </button>
          ))}
        </div>
        <div className="sc-detail" style={{ '--c': c.color }}>
          <h2 style={{ color: c.color }}>{c.emoji} {c.label}</h2>
          <p>{c.meaning}</p>
          <div className="three">
            <div><h3 className="sub-h">👥 Everyone</h3><p>{c.general}</p></div>
            <div><h3 className="sub-h">⚠️ Sensitive groups</h3><p>{c.sensitive}</p></div>
            <div><h3 className="sub-h">🏃 Outdoor activity</h3><p>{c.activity}</p></div>
          </div>
        </div>
      </Card>

      <Card className="span2" title={`Personal advice for right now (${scaleName()} ${aqi ?? '—'})`} icon="🎯">
        <div className="personas">{PERSONAS.map((x) => <button key={x.k} className={p === x.k ? 'on' : ''} onClick={() => setP(x.k)}>{x.l}</button>)}</div>
        <div className="advice" style={{ '--c': cur.color }}>{per.f(cur, aq?.current?.epa_aqi ?? 0)}</div>
        <div className="tips">
          <div>😷 <b>Masks:</b> only N95/FFP2/KN95 filter PM2.5. Cloth & surgical masks do little. Fit matters.</div>
          <div>🏠 <b>Indoors:</b> keep windows shut on bad days, run a HEPA purifier, avoid incense, candles & frying smoke.</div>
          <div>🌿 <b>Plants</b> are nice but won't clean polluted air meaningfully — a purifier does.</div>
          <div>🚗 <b>Commute:</b> keep car windows closed with recirculation on; avoid walking along busy roads.</div>
          <div>💧 Stay hydrated; eat antioxidant-rich food. See a doctor for persistent cough, wheeze or chest pain.</div>
        </div>
      </Card>

      <Card title="PM2.5 vs PM10 — size matters" icon="🔬">
        <div className="sizes">
          <div className="hair"><span>Human hair<br />50–70 µm</span></div>
          <div className="p10"><span>PM10<br />≤10 µm</span></div>
          <div className="p25"><span>PM2.5<br />≤2.5 µm</span></div>
        </div>
        <p className="sm"><b>PM10</b> lodges in the nose, throat and upper airways — coughing, asthma flare-ups.</p>
        <p className="sm"><b>PM2.5</b> is ~30× thinner than a hair. It reaches the deepest air sacs and enters the bloodstream, raising the risk of heart attack, stroke, lung cancer and premature death. WHO: no safe level; guideline 15 µg/m³ (24h).</p>
        {aq?.current && <p className="sm">Right now: PM2.5 <b>{round(aq.current.pm2_5, 1)}</b> · PM10 <b>{round(aq.current.pm10, 1)}</b> µg/m³ <span className="muted">(model estimate)</span></p>}
      </Card>

      <Card className="span3" title="India NAQI vs US AQI — why the numbers differ" icon="🇮🇳">
        <p className="sm muted">The same air gives different numbers on different scales. Indian apps and CPCB use the <b>National AQI</b>, while many global apps use the <b>US EPA AQI</b>. At PM2.5 = 130 µg/m³, India shows ~308 (Very Poor) and the US scale shows ~205 (Very Unhealthy). Use the 🇮🇳/🇺🇸 switch in the top bar.</p>
        <table className="tbl">
          <thead><tr><th>PM2.5 (µg/m³)</th><th>India NAQI (CPCB)</th><th>US AQI (EPA 2024)</th></tr></thead>
          <tbody>
            {[[15, 'Good (25)', 'Moderate (62)'], [45, 'Satisfactory (75)', 'Sensitive (124)'], [75, 'Moderate (150)', 'Unhealthy (165)'], [110, 'Poor (267)', 'Unhealthy (189)'], [180, 'Very Poor (346)', 'Very Unhealthy (255)'], [300, 'Severe (438)', 'Hazardous (449)']].map(([c, a, b]) => (
              <tr key={c}><td><b>{c}</b></td><td>{a}</td><td>{b}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="xs muted">CPCB's official bulletin uses 24-hour averages; SAANS also shows the live (latest-hour) value. Sources: CPCB National Air Quality Index (2014), US EPA AQI Technical Assistance Document (2024).</p>
      </Card>

      <Card className="span3" title="Pollutant guide" icon="📚">
        <div className="pol-guide">{POLLUTANTS.map((x) => <div key={x.key}><b>{x.label}</b><p className="sm">{x.desc}</p><small className="muted">WHO guideline: {x.who} {x.unit}</small></div>)}</div>
      </Card>
    </div>
  )
}
