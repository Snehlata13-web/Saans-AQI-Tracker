import { avg, category, cigarettes, computeNAQI, naqiNow, POLLUTANTS, round, fmtTime, fmtHour, scaleName } from './aqi'
import { bestWindow, pctChange } from './analytics'

export function last24(aq) {
  const cut = Date.now() - 24 * 3600e3
  return aq.past.filter((r) => r.t > cut)
}

export function summary(aq) {
  const l24 = last24(aq)
  const avgs = Object.fromEntries(POLLUTANTS.map((p) => [p.key, avg(l24.map((r) => r[p.key]))]))
  const prev = aq.past.filter((r) => r.t > Date.now() - 48 * 3600e3 && r.t <= Date.now() - 24 * 3600e3)
  const next24 = aq.forecast.slice(0, 24)
  const fMax = next24.reduce((m, r) => (r.us_aqi != null && (!m || r.us_aqi > m.us_aqi) ? r : m), null)
  const fMin = next24.reduce((m, r) => (r.us_aqi != null && (!m || r.us_aqi < m.us_aqi) ? r : m), null)
  return {
    avgs,
    aqi24: avg(l24.map((r) => r.us_aqi)),
    aqiPrev: avg(prev.map((r) => r.us_aqi)),
    change: pctChange(avg(prev.map((r) => r.us_aqi)), avg(l24.map((r) => r.us_aqi))),
    cig: cigarettes(avgs.pm2_5),
    naqi: computeNAQI(avgs),
    fMax, fMin,
    best: bestWindow(aq.forecast, 2, aq.tz),
    whoX: avgs.pm2_5 != null ? avgs.pm2_5 / 15 : null,
  }
}

const hm = (t, tz) => fmtHour(t, tz)

// Plain-language "AI insights" generated from the live numbers (deterministic, no hallucination)
export function insights(aq, wx, place) {
  const s = summary(aq)
  const c = aq.current || {}
  const cat = category(c.us_aqi)
  const out = []
  out.push(`${place} is at ${scaleName()} ${c.us_aqi ?? '—'} (${cat.label}). ${cat.meaning}`)
  if (s.whoX != null) out.push(`24-hour average PM2.5 is ${round(s.avgs.pm2_5, 1)} µg/m³ — ${round(s.whoX, 1)}× the WHO daily guideline of 15 µg/m³.`)
  if (s.cig != null && s.cig >= 0.3) out.push(`Breathing this air for a day is roughly like smoking ${round(s.cig, 1)} cigarette${s.cig >= 1.5 ? 's' : ''} (Berkeley Earth estimate).`)
  if (s.change != null && Math.abs(s.change) >= 5) out.push(`Air is ${s.change > 0 ? 'worse' : 'better'} than yesterday by ${Math.abs(round(s.change))}% (24h average AQI).`)
  if (s.fMax && c.us_aqi != null && s.fMax.us_aqi > c.us_aqi * 1.15) out.push(`Forecast: AQI may rise to ~${s.fMax.us_aqi} around ${hm(s.fMax.t, aq.tz)}.`)
  else if (s.fMin && c.us_aqi != null && s.fMin.us_aqi < c.us_aqi * 0.85) out.push(`Forecast: improvement expected — down to ~${s.fMin.us_aqi} around ${hm(s.fMin.t, aq.tz)}.`)
  if (s.best) out.push(`Best 2-hour window outdoors in the next 48h: ${hm(s.best.start, aq.tz)} (forecast AQI ≈ ${round(s.best.aqi)}).`)
  const w = wx?.current
  if (w) {
    if (w.wind_speed_10m < 6) out.push(`Wind is calm (${w.wind_speed_10m} km/h), so pollutants are not dispersing well.`)
    else if (w.wind_speed_10m > 18) out.push(`Strong winds (${w.wind_speed_10m} km/h) should help disperse pollution.`)
    if (w.relative_humidity_2m > 80 && (c.pm2_5 || 0) > 35) out.push(`High humidity (${w.relative_humidity_2m}%) plus particles favour smog/haze formation.`)
  }
  const dom = POLLUTANTS.filter((p) => c[p.key] != null).map((p) => ({ p, x: c[p.key] / p.who })).sort((a, b) => b.x - a.x)[0]
  if (dom && dom.x > 1) out.push(`Dominant concern right now: ${dom.p.label} at ${round(c[dom.p.key], 1)} ${dom.p.unit} (${round(dom.x, 1)}× WHO guideline).`)
  return { lines: out, s }
}

export function contextFor(aq, wx, station, loc) {
  const s = summary(aq)
  return {
    location: loc,
    modelEstimate: (() => {
      const c = aq.current || {}
      return { source: aq.source, time: fmtTime(c.t, aq.tz), indiaNAQI: c.in_aqi, usAQI: c.epa_aqi, dominantPollutant: c.dominant,
        pm2_5: c.pm2_5, pm10: c.pm10, no2: c.nitrogen_dioxide, so2: c.sulphur_dioxide, co: c.carbon_monoxide, o3: c.ozone, units: 'µg/m³' }
    })(),
    groundStation: station && !station.error ? { station: station.station, usAQI_measured: station.aqi, time: station.time, dominant: station.dominant } : null,
    last24hAverages: Object.fromEntries(Object.entries(s.avgs).map(([k, v]) => [k, round(v, 1)])),
    indiaNAQI24hAvg: s.naqi?.value, indiaNAQINow: naqiNow(aq.current || {})?.value, cigarettesPerDay: round(s.cig, 1),
    scaleInUse: scaleName(),
    forecastNext48h: aq.forecast.slice(0, 48).filter((_, i) => i % 3 === 0).map((r) => ({ time: fmtTime(r.t, aq.tz), usAqi: r.epa_aqi, indiaNaqi: r.in_aqi, pm2_5: r.pm2_5 })),
    weather: wx?.current,
  }
}
