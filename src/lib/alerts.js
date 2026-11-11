import { getMulti, getAirQuality } from './api'
import { naqiCategory, usCategory } from './aqi'

const KEY = 'saans:alerts'
export const loadAlerts = () => { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }
export const saveAlerts = (a) => localStorage.setItem(KEY, JSON.stringify(a))

export async function checkAlerts(notify) {
  const alerts = loadAlerts()
  if (!alerts.length) return []
  const now = Date.now()
  const cur = await getMulti(alerts.map((a) => ({ lat: a.lat, lon: a.lon })))
  const fired = []
  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i], K = a.scale === 'IN' ? 'in_aqi' : 'epa_aqi', v = cur[i]?.[K]
    a.last = v; a.checkedAt = now
    if (v != null && v >= a.threshold && (!a.firedAt || now - a.firedAt > 3 * 3600e3)) {
      a.firedAt = now
      fired.push({ title: `⚠️ ${a.name}: ${a.scale === 'IN' ? 'NAQI' : 'US AQI'} ${v}`, body: `Crossed your threshold of ${a.threshold} — ${(a.scale === 'IN' ? naqiCategory : usCategory)(v).label}. ${(a.scale === 'IN' ? naqiCategory : usCategory)(v).general}` })
    } else if (a.forecast && v != null && v < a.threshold && (!a.fFiredAt || now - a.fFiredAt > 6 * 3600e3)) {
      try {
        const aq = await getAirQuality(a.lat, a.lon, { pastDays: 1, forecastDays: 2 })
        const hit = aq.forecast.slice(0, 12).find((r) => r[K] >= a.threshold)
        if (hit) {
          a.fFiredAt = now
          fired.push({ title: `🔮 ${a.name}: AQI may reach ${hit[K]}`, body: `Forecast to cross ${a.threshold} around ${new Date(hit.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: aq.tz })} (forecast, not a measurement).` })
        }
      } catch { /* ignore forecast failure */ }
    }
  }
  saveAlerts(alerts)
  fired.forEach((f) => {
    notify(f)
    if ('Notification' in window && Notification.permission === 'granted') new Notification(f.title, { body: f.body, icon: '/favicon.svg' })
  })
  return fired
}
