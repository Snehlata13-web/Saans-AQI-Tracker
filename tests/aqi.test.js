import { describe, it, expect } from 'vitest'
import { epaIndex, nowcast, naqiNow, computeNAQI, epaFromCurrent, withEpaAqi, setActiveScale, category, usAqiToPm25 } from '../src/lib/aqi.js'
import { detectAnomalies, pctChange, mlForecast } from '../src/lib/analytics.js'

describe('US EPA AQI (2024 breakpoints)', () => {
  it('maps PM2.5 breakpoints exactly', () => {
    expect(epaIndex('pm2_5', 9)).toBe(50)
    expect(epaIndex('pm2_5', 35.4)).toBe(100)
    expect(epaIndex('pm2_5', 55.4)).toBe(150)
    expect(epaIndex('pm2_5', 125.4)).toBe(200)
  })
  it('caps at 500 and handles missing data', () => {
    expect(epaIndex('pm10', 5000)).toBe(500)
    expect(epaIndex('pm2_5', null)).toBeNull()
  })
  it('NowCast weighs recent hours more', () => {
    const rising = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 100]
    expect(nowcast(rising)).toBeGreaterThan(50)
    expect(nowcast([20, 20, 20])).toBeCloseTo(20)
  })
  it('round-trips PM2.5 ↔ index', () => {
    expect(usAqiToPm25(epaIndex('pm2_5', 80))).toBeCloseTo(80, 0)
  })
})

describe('India NAQI (CPCB)', () => {
  it('matches CPCB PM2.5 bands', () => {
    expect(naqiNow({ pm2_5: 30 }).value).toBe(50)
    expect(naqiNow({ pm2_5: 60 }).value).toBe(100)
    expect(naqiNow({ pm2_5: 130 }).value).toBe(308)
  })
  it('requires ≥3 pollutants incl. PM for the 24h index (CPCB rule)', () => {
    expect(computeNAQI({ pm2_5: 100 })).toBeNull()
    expect(computeNAQI({ pm2_5: 100, pm10: 150, nitrogen_dioxide: 40 }).value).toBeGreaterThan(200)
  })
  it('same air reads higher on NAQI than US AQI at high PM2.5', () => {
    setActiveScale('US')
    const us = epaFromCurrent({ pm2_5: 130, pm10: 150 }).us_aqi
    setActiveScale('IN')
    const ind = epaFromCurrent({ pm2_5: 130, pm10: 150 }).us_aqi
    setActiveScale('US')
    expect(ind).toBeGreaterThan(us)
  })
  it('category follows the active scale', () => {
    setActiveScale('IN'); expect(category(310).label).toBe('Very Poor')
    setActiveScale('US'); expect(category(310).label).toBe('Hazardous')
  })
})

describe('Ozone bias guard', () => {
  it('headline ignores modelled ozone (shown separately)', () => {
    const rows = withEpaAqi([{ pm2_5: 20, pm10: 30, ozone: 400, nitrogen_dioxide: 10 }])
    expect(rows[0].dominant).not.toBe('ozone')
    expect(rows[0].o3_aqi).toBeGreaterThan(rows[0].us_aqi)
  })
})

describe('Analytics', () => {
  it('pctChange', () => { expect(pctChange(100, 150)).toBe(50); expect(pctChange(0, 5)).toBeNull() })
  it('detects a pollution spike as an anomaly event', () => {
    const rows = Array.from({ length: 96 }, (_, i) => ({ t: i * 3600e3, pm2_5: 30 + (i % 3) }))
    rows[80].pm2_5 = 300
    const { events } = detectAnomalies(rows)
    expect(events.length).toBe(1)
    expect(events[0].peak).toBe(300)
  })
  it('ML model trains and forecasts finite values', () => {
    const past = Array.from({ length: 24 * 10 }, (_, i) => ({ t: i * 3600e3, pm2_5: 60 + 30 * Math.sin((2 * Math.PI * i) / 24) }))
    const wx = past.map((r) => ({ t: r.t, wind_speed_10m: 8, relative_humidity_2m: 60, boundary_layer_height: 600, temperature_2m: 20, precipitation: 0 }))
    const m = mlForecast(past, wx, { horizon: 24 })
    expect(m.preds).toHaveLength(24)
    expect(m.preds.every((p) => Number.isFinite(p.pm2_5))).toBe(true)
    expect(m.mae).toBeLessThan(m.maeBase)
  })
})
