// Clean Commute: route alternatives (OSRM) × hourly pollution forecast (Open-Meteo CAMS) → inhaled-dose estimate
import { getJSON } from './api'
import { haversine } from './aqi'

const PROFILE = { car: 'routed-car', bike: 'routed-bike', foot: 'routed-foot' }
// Typical breathing rates (m³/h, US EPA Exposure Factors Handbook, light–moderate activity) and in-vehicle infiltration
export const MODES = {
  car: { label: 'Drive', icon: '🚗', rate: 0.6, cabin: 0.6, note: 'in-car, windows closed (~60% infiltration)' },
  bike: { label: 'Cycle', icon: '🚲', rate: 2.5, cabin: 1, note: 'cycling, moderate effort' },
  foot: { label: 'Walk', icon: '🚶', rate: 1.6, cabin: 1, note: 'walking, light effort' },
}

export async function getRoutes(from, to, mode) {
  const url = `https://routing.openstreetmap.de/${PROFILE[mode]}/route/v1/driving/${from.lon.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}?alternatives=3&overview=full&geometries=geojson`
  const d = await getJSON(url, { ttl: 6 * 3600e3, timeout: 20000, retries: 1 })
  if (d.code !== 'Ok' || !d.routes?.length) throw new Error(d.message || 'No route found between these places')
  return d.routes.slice(0, 3).map((r, i) => ({ id: i, distance: r.distance, duration: r.duration, coords: r.geometry.coordinates.map(([lo, la]) => [la, lo]) }))
}

// Split a route into K equal-distance segments; return their midpoints with elapsed time
function segments(route, K = 10) {
  const c = route.coords
  const cum = [0]
  for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + haversine({ lat: c[i - 1][0], lon: c[i - 1][1] }, { lat: c[i][0], lon: c[i][1] }))
  const total = cum[cum.length - 1] || 1
  const at = (d) => {
    let j = cum.findIndex((x) => x >= d)
    if (j <= 0) return c[0]
    const f = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1)
    return [c[j - 1][0] + f * (c[j][0] - c[j - 1][0]), c[j - 1][1] + f * (c[j][1] - c[j - 1][1])]
  }
  return Array.from({ length: K }, (_, k) => {
    const mid = ((k + 0.5) / K) * total
    const [lat, lon] = at(mid)
    return { lat, lon, frac: (k + 0.5) / K, from: at((k / K) * total), to: at(((k + 1) / K) * total) }
  })
}

export async function planCommute(from, to, mode, hours = 24) {
  const routes = await getRoutes(from, to, mode)
  routes.forEach((r) => { r.segs = segments(r) })
  const pts = routes.flatMap((r) => r.segs)
  const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality'
  const q = new URLSearchParams({
    latitude: pts.map((p) => p.lat.toFixed(3)).join(','), longitude: pts.map((p) => p.lon.toFixed(3)).join(','),
    hourly: 'pm2_5', forecast_hours: String(hours + 6), timeformat: 'unixtime',
  })
  const d = await getJSON(`${AQ}?${q}`, { ttl: 30 * 60e3 })
  const arr = Array.isArray(d) ? d : [d]
  const times = (arr[0]?.hourly?.time || []).map((t) => t * 1000)
  let k = 0
  routes.forEach((r) => r.segs.forEach((s) => { s.pm = arr[k++]?.hourly?.pm2_5 || [] }))

  const M = MODES[mode]
  // dose (µg PM2.5 inhaled) for departing at hour index h
  const dose = (r, h) => {
    const segH = r.duration / 3600 / r.segs.length
    let tot = 0, conc = 0
    for (const s of r.segs) {
      const idx = Math.min(s.pm.length - 1, h + Math.floor((s.frac * r.duration) / 3600))
      const c = s.pm[idx] ?? s.pm[s.pm.length - 1] ?? 0
      conc += c
      tot += c * M.cabin * M.rate * segH
    }
    return { dose: tot, avg: conc / r.segs.length }
  }
  const N = Math.min(hours, times.length - 1)
  routes.forEach((r) => { r.byHour = Array.from({ length: N }, (_, h) => ({ h, t: times[h], ...dose(r, h) })) })

  const nowWorst = Math.max(...routes.map((r) => r.byHour[0].dose))
  const fastest = routes.reduce((a, b) => (a.duration <= b.duration ? a : b))
  let best = null
  routes.forEach((r) => r.byHour.forEach((x) => { if (!best || x.dose < best.dose) best = { route: r, ...x } }))
  return { routes, times, best, fastest, baseline: fastest.byHour[0], nowWorst, mode }
}
