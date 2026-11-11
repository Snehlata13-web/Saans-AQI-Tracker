import { useEffect, useRef, useState } from 'react'
import { Card, Tag } from './ui'
import { category, round, POLLUTANTS, fmtHour, scaleName, polLabel } from '../lib/aqi'
import { insights, contextFor } from '../lib/insights'
import { geocode } from '../lib/api'

const SUGGEST = ['Is it safe to go for a run now?', 'Should my kids play outside?', 'When is the best time to go out today?', 'What is PM2.5?', 'Will air get worse tomorrow?', 'Kya mujhe mask pehenna chahiye?']

// Built-in, data-grounded answers: short and only what was asked
function localAnswer(q, { aq, wx, loc }) {
  const t = q.toLowerCase()
  const c = aq.current || {}
  const { s } = insights(aq, wx, loc.name)
  const tf = (x) => fmtHour(x, aq.tz)
  const E = c.epa_aqi ?? 0 // decisions use the EPA index (health thresholds)
  const now = `${scaleName()} ${c.us_aqi ?? '—'} (${category(c.us_aqi).label})`
  const best = s.best ? ` Best time: ${tf(s.best.start)}.` : ''
  const has = (re) => re.test(t)

  for (const p of POLLUTANTS) {
    const k = p.label.toLowerCase().replace('₂', '2').replace('₃', '3')
    if (t.includes(k) || t.includes(p.key)) return `${p.label} — ${p.desc} Now: ${round(c[p.key], 1) ?? '—'} ${p.unit} (WHO limit ${p.who}).`
  }
  if (has(/run|jog|exercise|walk|gym|cycl|sport|workout|daud|sair|khel/)) return E > 150 ? `No — ${now}. Exercise indoors today.${best}` : E > 100 ? `Only light exercise — ${now}.${best}` : `Yes — ${now}, fine for exercise.`
  if (has(/kid|child|baby|school|bachch/)) return E > 100 ? `Keep kids indoors — ${now}.${best}` : `Yes, outdoor play is fine — ${now}.`
  if (has(/mask|n95/)) return E > 150 ? `Yes, wear an N95/FFP2 outdoors — ${now}.` : E > 100 ? `Advised for sensitive people (N95) — ${now}.` : `Not needed — ${now}.`
  if (has(/window|khidki|purifier/)) return E > 100 ? `Keep windows closed and run a purifier — ${now}.` : `Fine to open windows — ${now}.`
  if (has(/best time|when|kab|timing/)) return s.best ? `${tf(s.best.start)} — forecast ${scaleName()} ≈ ${round(s.best.aqi)}.` : 'Forecast not available.'
  if (has(/tomorrow|forecast|worse|better|kal|future|predict|aage/)) {
    const f = aq.forecast.slice(12, 36).map((r) => r.us_aqi).filter((v) => v != null)
    if (!f.length) return 'Forecast not available.'
    const m = Math.round(f.reduce((x, y) => x + y) / f.length)
    return `${m > (c.us_aqi ?? 0) ? 'Worse' : 'Slightly better'} — tomorrow avg ≈ ${m} (${category(m).label}), peak ≈ ${Math.max(...f)}. (Forecast)`
  }
  if (has(/cigar|smok/)) return `≈ ${round(s.cig, 1)} cigarettes/day (24h PM2.5 ${round(s.avgs.pm2_5)} µg/m³).`
  if (has(/diwali|cracker|patakh|firework/)) return `Firecracker smoke spikes PM2.5 within hours; calm nights trap it. See History → Diwali Effect for ${loc.name}.`
  if (has(/why|reason|cause|kyu|kyon/)) {
    const w = wx?.current
    return `Mainly ${polLabel(c.dominant)}${w && w.wind_speed_10m < 6 ? `, trapped by calm wind (${round(w.wind_speed_10m)} km/h)` : ''} — from traffic, dust, burning and industry.`
  }
  if (has(/asthma|heart|elder|old|pregnan|sensitive|dil|saans/)) return `${category(c.us_aqi).sensitive} (${now})`
  if (has(/safe|outside|bahar|outdoor|go out|jaa/)) return E > 150 ? `Not safe for long outdoor time — ${now}. Wear N95 if you go.${best}` : E > 100 ? `OK for short trips; sensitive people limit time — ${now}.` : `Yes — ${now}.`
  if (has(/aqi|scale|naqi|mean|matlab/)) return `${scaleName()} turns pollutant levels into one 0–500 number — higher is worse. Now: ${now}.`
  return `${now}. ${category(c.us_aqi).general}`
}

function locationFromMessage(text) {
  const match = text.match(/^\s*(?:i['’]?m|i am|i live|main|मैं)\s+(?:currently\s+)?(?:in|at|near|में|मे)\s+(.+?)\s*[.!?]?\s*$/i)
  return match?.[1] || null
}

async function findLocation(place) {
  const queries = [place]
  const words = place.split(/\s+/)
  if (words.length > 1) queries.push(words.slice(-2).join(' '))
  if (/patna|bihar/i.test(place)) queries.push('Patna')
  const results = (await Promise.all(queries.map((query) => geocode(query)))).flat()
  const india = results.find((result) => /india/i.test(result.country || ''))
  return india || results[0]
}

export default function Assistant({ aq, wx, station, loc, onPick }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: `Namaste! 🙏 I'm SAANS AI. Ask me anything about the air in ${loc.name} — by typing or with the 🎙️ mic.` }])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [speak, setSpeak] = useState(() => localStorage.getItem('saans:speak') === '1')
  useEffect(() => () => window.speechSynthesis?.cancel(), [])
  const [mode, setMode] = useState('…')
  const box = useRef()
  const rec = useRef()

  useEffect(() => { box.current?.scrollTo(0, 1e6) }, [msgs])

  const say = (text) => {
    if (!speak || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''))
    u.rate = 1.03
    window.speechSynthesis.speak(u)
  }

  const ask = async (text) => {
    if (!text.trim()) return
    const next = [...msgs, { role: 'user', content: text }]
    setMsgs(next); setQ(''); setBusy(true)
    let answer
    const place = locationFromMessage(text)
    try {
      if (place && onPick) {
        const result = await findLocation(place)
        if (!result) throw new Error('Location not found')
        onPick(result)
        answer = `Location updated to ${result.name}${result.admin ? `, ${result.admin}` : ''}. The live air-quality data is refreshing now.`
        setMode('location')
      } else {
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(1), context: contextFor(aq, wx, station, loc) }) })
        if (!r.ok) throw new Error(r.status)
        const j = await r.json()
        if (!j.text) throw new Error(j.error || 'no text')
        answer = j.text
        setMode(j.model ? (j.model.startsWith('gemini') ? 'Gemini · ' : 'LLM · ') + j.model : 'LLM')
      }
    } catch {
      if (place) {
        answer = `I couldn't find “${place}”. Please try a nearby city or district name.`
        setMode('location error')
      } else {
        answer = localAnswer(text, { aq, wx, loc })
        setMode('built-in engine')
      }
    }
    setMsgs((m) => [...m, { role: 'assistant', content: answer }])
    setBusy(false)
    say(answer)
  }

  const mic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Voice input is not supported in this browser (try Chrome).')
    if (listening) { rec.current?.stop(); return }
    const r = new SR()
    r.lang = navigator.language || 'en-IN'
    r.interimResults = false
    r.onresult = (e) => ask(e.results[0][0].transcript)
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    r.start(); setListening(true)
  }

  const c = aq.current || {}
  const cat = category(c.us_aqi)
  const TILES = [['🏃', 'Is it safe to go for a run now?'], ['🧒', 'Should my kids play outside?'], ['⏰', 'When is the best time to go out today?'], ['🔬', 'What is PM2.5?'], ['🔮', 'Will air get worse tomorrow?'], ['😷', 'Kya mujhe mask pehenna chahiye?']]
  const fresh = msgs.length === 1
  return (
    <div className="grid ai-grid">
      <Card className="span2 chat" title="SAANS AI" icon="✦" right={<div className="tags"><Tag kind="model">Grounded on live data</Tag><span className="mode-pill">{mode === '…' ? 'ready' : mode}</span></div>}>
        <div className="msgs" ref={box}>
          {msgs.map((m, i) => (
            <div key={i} className={'row ' + m.role}>
              {m.role === 'assistant' && <span className="av">🪔</span>}
              <div className={'msg ' + m.role}>{m.content}</div>
            </div>
          ))}
          {busy && <div className="row assistant"><span className="av">🪔</span><div className="msg assistant typing"><i /><i /><i /></div></div>}
          {fresh && (
            <div className="tiles">
              {TILES.map(([e, t]) => <button key={t} className="tile tilt" onClick={() => ask(t)}><span>{e}</span>{t}</button>)}
            </div>
          )}
        </div>
        {!fresh && <div className="sugg">{SUGGEST.map((x) => <button key={x} onClick={() => ask(x)}>{x}</button>)}</div>}
        <form className="chat-in" onSubmit={(e) => { e.preventDefault(); ask(q) }}>
          <button type="button" className={'mic' + (listening ? ' on' : '')} onClick={mic} title="Voice input">🎙️</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? 'Listening… speak now' : `Ask anything about the air in ${loc.name}…`} />
          <button className="btn glow send" disabled={busy}>Send ↑</button>
        </form>
        <label className="xs muted speak-t"><input type="checkbox" checked={speak} onChange={(e) => { setSpeak(e.target.checked); localStorage.setItem('saans:speak', e.target.checked ? '1' : '0'); if (!e.target.checked) window.speechSynthesis?.cancel() }} /> 🔊 read answers aloud</label>
      </Card>
      <Card className="ctx-card glowborder" title="What I'm looking at" icon="📡">
        <div className="ctx-aqi" style={{ '--c': cat.color }}>
          <b>{c.us_aqi ?? '—'}</b>
          <div><span>{scaleName()}</span><em>{cat.emoji} {cat.label}</em></div>
        </div>
        <ul className="ctx-list">
          <li><span>PM2.5</span><b>{round(c.pm2_5, 1)} µg/m³</b></li>
          <li><span>PM10</span><b>{round(c.pm10, 1)} µg/m³</b></li>
          <li><span>NO₂</span><b>{round(c.nitrogen_dioxide, 1)} µg/m³</b></li>
          {wx?.current && <li><span>Wind</span><b>{round(wx.current.wind_speed_10m)} km/h</b></li>}
          {wx?.current && <li><span>Humidity</span><b>{wx.current.relative_humidity_2m}%</b></li>}
          {station && !station.error && <li><span>Nearest station</span><b>US {station.aqi > 500 ? '500+' : station.aqi}</b></li>}
        </ul>
        <div className="ctx-can">
          <div className="xs muted">I can help with</div>
          <span>🏃 Outdoor plans</span><span>🩺 Health advice</span><span>🔮 Forecasts</span><span>🪔 Diwali smoke</span><span>🇮🇳 Hinglish</span><span>🎙️ Voice</span>
        </div>
        <p className="xs muted">Answers use only these live numbers (Open-Meteo CAMS model + WAQI stations). Not medical advice.</p>
      </Card>
    </div>
  )
}
