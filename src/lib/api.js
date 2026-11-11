// Thin data layer over authentic public APIs:
//  - Open-Meteo Air Quality API (CAMS model: current, past & forecast) — no key
//  - Open-Meteo Weather + Geocoding APIs — no key
//  - BigDataCloud reverse geocoding (client endpoint) — no key
//  - WAQI / aqicn.org ground-station measurements — via our serverless proxy (token kept server-side)

import { withEpaAqi, epaFromCurrent } from './aqi'

const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const WX = 'https://api.open-meteo.com/v1/forecast'
const GEO = 'https://geocoding-api.open-meteo.com/v1/search'

export const POLL_VARS = ['us_aqi', 'european_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide', 'ozone', 'dust', 'uv_index']

export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status }
}

const mem = new Map()
const inflight = new Map()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function getJSON(url, opts = {}) {
  const { ttl = 10 * 60e3, persist = true } = opts
  const hit = mem.get(url)
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data)
  if (persist) {
    // fresh persistent cache (keeps us well within free-tier rate limits across reloads)
    try {
      const c = JSON.parse(localStorage.getItem('c:' + url))
      if (c && Date.now() - c.at < ttl) { mem.set(url, c); return Promise.resolve(c.data) }
    } catch { /* ignore */ }
  }
  if (inflight.has(url)) return inflight.get(url)
  const p = fetchJSON(url, opts).finally(() => inflight.delete(url))
  inflight.set(url, p)
  return p
}

async function fetchJSON(url, { timeout = 15000, retries = 2, persist = true } = {}) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController()
    const tm = setTimeout(() => ctrl.abort(), timeout)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(tm)
      if (res.status === 429) {
        lastErr = new ApiError('Rate limit reached — retrying shortly', 429)
        await sleep(1200 * 2 ** i)
        continue
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error) throw new ApiError(data?.reason || data?.error || `HTTP ${res.status}`, res.status)
      mem.set(url, { at: Date.now(), data })
      if (persist) {
        const v = JSON.stringify({ at: Date.now(), data })
        try { localStorage.setItem('c:' + url, v) } catch {
          try {
            Object.keys(localStorage).filter((k) => k.startsWith('c:')).forEach((k) => localStorage.removeItem(k))
            localStorage.setItem('c:' + url, v)
          } catch { /* quota */ }
        }
      }
      return data
    } catch (e) {
      clearTimeout(tm)
      lastErr = e.name === 'AbortError' ? new ApiError('Request timed out', 408) : e
      if (e.status && e.status < 500 && e.status !== 429) break
      if (i < retries) await sleep(600 * 2 ** i)
    }
  }
  // Offline / failure fallback: last good response, clearly flagged as stale
  try {
    const c = JSON.parse(localStorage.getItem('c:' + url))
    if (c) return { ...c.data, __stale: true, __cachedAt: c.at }
  } catch { /* ignore */ }
  throw lastErr
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null)).toString()

function toRows(block) {
  if (!block?.time) return []
  return block.time.map((t, i) => {
    const r = { t: t * 1000 }
    for (const k of Object.keys(block)) if (k !== 'time') r[k] = block[k][i]
    return r
  })
}

export async function geocode(name) {
  if (!name || name.length < 2) return []
  const d = await getJSON(`${GEO}?${qs({ name, count: 8, language: 'en', format: 'json' })}`, { ttl: 864e5 })
  return (d.results || []).map((r) => ({
    name: r.name, lat: r.latitude, lon: r.longitude, country: r.country, admin: r.admin1, cc: r.country_code,
  }))
}

export async function reverseGeocode(lat, lon) {
  try {
    const d = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?${qs({ latitude: lat, longitude: lon, localityLanguage: 'en' })}`, { ttl: 864e5, retries: 0 })
    return { name: d.city || d.locality || d.principalSubdivision || 'My location', country: d.countryName, admin: d.principalSubdivision }
  } catch {
    return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: '' }
  }
}

// Current + hourly (past 7 days modelled + up to 5 days forecast)
export async function getAirQuality(lat, lon, { pastDays = 7, forecastDays = 5 } = {}) {
  const d = await getJSON(`${AQ}?${qs({
    latitude: lat.toFixed(4), longitude: lon.toFixed(4), current: POLL_VARS.join(','), hourly: POLL_VARS.join(','),
    past_days: pastDays, forecast_days: forecastDays, timezone: 'auto', timeformat: 'unixtime', domains: 'auto',
  })}`)
  const now = Date.now()
  const hourly = withEpaAqi(toRows(d.hourly))
  let current = null
  if (d.current) {
    const ct = d.current.time * 1000
    const upto = toRows(d.hourly).filter((r) => r.t <= ct)
    const snap = { ...d.current, t: ct }
    const calc = withEpaAqi([...upto.slice(-12, -1), snap]).pop()
    current = { ...snap, ...calc, t: ct }
  }
  return {
    source: 'Open-Meteo Air Quality API (Copernicus CAMS model)',
    kind: 'model',
    tz: d.timezone,
    offsetH: (d.utc_offset_seconds || 0) / 3600,
    lat: d.latitude, lon: d.longitude,
    current,
    past: hourly.filter((r) => r.t <= now),
    forecast: hourly.filter((r) => r.t > now),
    units: d.hourly_units,
    stale: !!d.__stale, cachedAt: d.__cachedAt,
  }
}

export async function getHistory(lat, lon, start, end, vars = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide', 'ozone']) {
  const d = await getJSON(`${AQ}?${qs({
    latitude: lat.toFixed(4), longitude: lon.toFixed(4), hourly: vars.join(','), start_date: start, end_date: end, timezone: 'auto', timeformat: 'unixtime',
  })}`, { ttl: 6 * 3600e3 })
  const rows = toRows(d.hourly)
  return { rows: vars.includes('pm10') ? withEpaAqi(rows) : rows, tz: d.timezone, stale: !!d.__stale }
}

// Many coordinates in a single request (Open-Meteo supports comma-separated lists)
export async function getMulti(points, vars = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide']) {
  const need = [...new Set([...vars.filter((v) => v !== 'us_aqi'), 'pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'])]
  const out = []
  for (let i = 0; i < points.length; i += 60) {
    const chunk = points.slice(i, i + 60)
    const d = await getJSON(`${AQ}?${qs({
      latitude: chunk.map((p) => p.lat.toFixed(3)).join(','), longitude: chunk.map((p) => p.lon.toFixed(3)).join(','),
      current: need.join(','), timeformat: 'unixtime',
    })}`, { ttl: 15 * 60e3 })
    const arr = Array.isArray(d) ? d : [d]
    arr.forEach((r, j) => {
      const c = r.current || {}
      out.push({ ...chunk[j], ...c, ...epaFromCurrent(c), t: (c.time || 0) * 1000 })
    })
  }
  return out
}

export async function getWeather(lat, lon, { pastDays = 30, forecastDays = 4 } = {}) {
  const d = await getJSON(`${WX}?${qs({
    latitude: lat.toFixed(4), longitude: lon.toFixed(4),
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,boundary_layer_height',
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    past_days: pastDays, forecast_days: forecastDays, timezone: 'auto', timeformat: 'unixtime',
  })}`)
  return { current: d.current, rows: toRows(d.hourly) }
}

// 48-hour hourly forecast of particles + wind for a grid of points (map time-lapse)
export async function getGridSeries(points, hours = 48) {
  const lat = points.map((p) => p.lat.toFixed(2)).join(','), lon = points.map((p) => p.lon.toFixed(2)).join(',')
  const [a, w] = await Promise.all([
    getJSON(`${AQ}?${qs({ latitude: lat, longitude: lon, hourly: 'pm2_5,pm10', forecast_hours: hours, timeformat: 'unixtime' })}`, { ttl: 30 * 60e3 }),
    getJSON(`${WX}?${qs({ latitude: lat, longitude: lon, hourly: 'wind_speed_10m,wind_direction_10m', forecast_hours: hours, timeformat: 'unixtime' })}`, { ttl: 30 * 60e3 }).catch(() => null),
  ])
  const A = Array.isArray(a) ? a : [a], W = w ? (Array.isArray(w) ? w : [w]) : []
  const times = (A[0]?.hourly?.time || []).map((t) => t * 1000)
  return {
    times,
    cells: points.map((p, i) => ({
      ...p,
      aqi: (A[i]?.hourly?.pm2_5 || []).map((v, h) => epaFromCurrent({ pm2_5: v, pm10: A[i].hourly.pm10?.[h] }).us_aqi),
      ws: W[i]?.hourly?.wind_speed_10m || [], wd: W[i]?.hourly?.wind_direction_10m || [],
    })),
  }
}

export async function getCpcb(lat, lon, radius = 30) {
  return getJSON(`/api/cpcb?${qs({ lat: lat.toFixed(3), lon: lon.toFixed(3), radius })}`, { ttl: 10 * 60e3, retries: 0, persist: false, timeout: 30000 })
}

// ----- WAQI ground stations (real measurements) via serverless proxy -----
export async function getStation(lat, lon) {
  const d = await getJSON(`/api/waqi?${qs({ type: 'geo', lat, lon })}`, { ttl: 10 * 60e3, retries: 0, persist: false })
  return d
}
export async function getStationsInBounds(b) {
  return getJSON(`/api/waqi?${qs({ type: 'bounds', latlng: b.join(',') })}`, { ttl: 10 * 60e3, retries: 0, persist: false })
}
