// Official CPCB real-time station data via the Government of India Open Data API (data.gov.in).
// Dataset: "Real time Air Quality Index from various locations" (CPCB). Key: DATAGOV_API_KEY (free at data.gov.in).
const RES = '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69'
const SAMPLE_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b' // public demo key (heavily rate-limited)

const BP = {
  'PM2.5': [0, 30, 60, 90, 120, 250, 380], PM10: [0, 50, 100, 250, 350, 430, 510],
  NO2: [0, 40, 80, 180, 280, 400, 520], SO2: [0, 40, 80, 380, 800, 1600, 2100],
  CO: [0, 1, 2, 10, 17, 34, 46], OZONE: [0, 50, 100, 168, 208, 748, 1000], NH3: [0, 200, 400, 800, 1200, 1800, 2400],
}
const I = [0, 50, 100, 200, 300, 400, 500]
function sub(p, c) {
  const b = BP[p]
  if (!b || c == null) return null
  for (let i = 1; i < b.length; i++) if (c <= b[i]) return Math.round(I[i - 1] + ((c - b[i - 1]) / (b[i] - b[i - 1])) * (I[i] - I[i - 1]))
  return 500
}
const toRad = (x) => (x * Math.PI) / 180
const dist = (a, b) => 12742 * Math.asin(Math.sqrt(Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2))
// "09-11-2026 20:00:00" (IST) -> ISO
const iso = (s) => { const m = /(\d\d)-(\d\d)-(\d{4}) (\d\d:\d\d:\d\d)/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}+05:30` : null }

let cache = { at: 0, rows: null }

async function allRows(key) {
  if (cache.rows && Date.now() - cache.at < 10 * 60e3) return cache.rows
  const rows = []
  for (let offset = 0; offset < 10000; offset += 2000) {
    const r = await fetch(`https://api.data.gov.in/resource/${RES}?api-key=${key}&format=json&limit=2000&offset=${offset}`)
    const j = await r.json()
    if (!j.records) throw new Error(j.error || j.message || 'data.gov.in error')
    rows.push(...j.records)
    if (j.records.length < 2000) break
  }
  cache = { at: Date.now(), rows }
  return rows
}

export default async function handler(req, res) {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  const lat = Number(q.lat), lon = Number(q.lon), radius = Number(q.radius) || 30
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'lat/lon required' })
  try {
    const rows = await allRows(process.env.DATAGOV_API_KEY || SAMPLE_KEY)
    const st = new Map()
    for (const r of rows) {
      const la = Number(r.latitude), lo = Number(r.longitude)
      if (!Number.isFinite(la) || !Number.isFinite(lo)) continue
      const k = r.station
      if (!st.has(k)) st.set(k, { name: r.station, city: r.city, state: r.state, lat: la, lon: lo, time: iso(r.last_update), pollutants: {} })
      const v = Number(r.avg_value ?? r.pollutant_avg)
      if (Number.isFinite(v)) st.get(k).pollutants[r.pollutant_id] = { avg: v, min: Number(r.min_value ?? r.pollutant_min), max: Number(r.max_value ?? r.pollutant_max) }
    }
    const out = []
    for (const s of st.values()) {
      const d = dist({ lat, lon }, s)
      if (d > radius) continue
      const subs = Object.fromEntries(Object.entries(s.pollutants).map(([p, v]) => [p, sub(p, v.avg)]).filter(([, v]) => v != null))
      const keys = Object.keys(subs)
      if (keys.length < 3 || (subs['PM2.5'] == null && subs.PM10 == null)) continue // CPCB rule
      const dom = keys.reduce((a, b) => (subs[a] >= subs[b] ? a : b))
      out.push({ ...s, dist: Math.round(d * 10) / 10, aqi: subs[dom], dominant: dom, subs })
    }
    out.sort((a, b) => a.dist - b.dist)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
    const avg = out.length ? Math.round(out.reduce((s, x) => s + x.aqi, 0) / out.length) : null
    return res.status(200).json({ source: 'CPCB via data.gov.in', cityAqi: avg, stations: out, keyType: process.env.DATAGOV_API_KEY ? 'own' : 'sample' })
  } catch (e) {
    return res.status(200).json({ error: String(e.message || e), keyType: process.env.DATAGOV_API_KEY ? 'own' : 'sample' })
  }
}
