// Vercel serverless proxy for WAQI (aqicn.org) ground-station measurements.
// With WAQI_TOKEN (kept server-side) the official API is used; without it we fall back to
// WAQI's public map endpoints (same station data that powers aqicn.org's map).
const UA = { 'User-Agent': 'Mozilla/5.0 (SAANS air-quality app)' }

export default async function handler(req, res) {
  const token = process.env.WAQI_TOKEN
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  try {
    if (q.type === 'geo') {
      const lat = Number(q.lat), lon = Number(q.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'lat/lon required' })
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
      if (token) {
        const j = await (await fetch(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${token}`)).json()
        if (j.status !== 'ok') return res.status(200).json({ error: String(j.data || 'WAQI error') })
        const d = j.data
        return res.status(200).json({
          aqi: Number.isFinite(Number(d.aqi)) ? Number(d.aqi) : null,
          dominant: d.dominentpol, station: d.city?.name, stationUrl: d.city?.url, geo: d.city?.geo?.map(Number),
          time: d.time?.iso, iaqi: Object.fromEntries(Object.entries(d.iaqi || {}).map(([k, v]) => [k, v?.v])),
          attributions: (d.attributions || []).map((a) => ({ name: a.name, url: a.url })), via: 'waqi-api',
        })
      }
      const j = await (await fetch(`https://api.waqi.info/mapq/nearest?geo=1/${lat}/${lon}`, { headers: UA })).json()
      const s = (j.d || []).find((x) => Number.isFinite(Number(x.v)))
      if (!s) return res.status(200).json({ error: 'no station nearby' })
      return res.status(200).json({
        aqi: Number(s.v), dominant: s.pol, station: s.nlo, geo: s.geo?.map(Number), distanceKm: s.d,
        time: s.t ? new Date(s.t * 1000).toISOString() : null, iaqi: {},
        attributions: [{ name: 'World Air Quality Index Project (aqicn.org)', url: 'https://aqicn.org' }], via: 'waqi-map',
      })
    }
    if (q.type === 'bounds') {
      const p = String(q.latlng || '').split(',').map(Number)
      if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return res.status(400).json({ error: 'latlng=lat1,lon1,lat2,lon2 required' })
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
      let stations = []
      if (token) {
        const j = await (await fetch(`https://api.waqi.info/map/bounds?latlng=${p.join(',')}&networks=all&token=${token}`)).json()
        if (j.status === 'ok') stations = (j.data || []).map((s) => ({ uid: s.uid, lat: s.lat, lon: s.lon, aqi: Number(s.aqi), name: s.station?.name, time: s.station?.time }))
      } else {
        const j = await (await fetch(`https://api.waqi.info/mapq/bounds/?bounds=${p.join(',')}&inc=placeholders`, { headers: UA })).json()
        stations = (Array.isArray(j) ? j : []).map((s) => ({ uid: s.idx, lat: s.lat, lon: s.lon, aqi: Number(s.aqi), name: s.city, time: s.utime ? s.utime.replace(' ', 'T') + (s.tz || '') : null }))
      }
      return res.status(200).json({ stations: stations.filter((s) => Number.isFinite(s.aqi)) })
    }
    return res.status(400).json({ error: 'type must be geo or bounds' })
  } catch {
    return res.status(200).json({ error: 'Upstream WAQI request failed' })
  }
}
