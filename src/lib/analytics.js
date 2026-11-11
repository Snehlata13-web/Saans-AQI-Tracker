import { avg, pm25ToUsAqi, activeScale, naqiNow } from './aqi'

// ---------- daily aggregation ----------
export function dayKey(t, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
}
export function daily(rows, tz, keys = ['us_aqi', 'pm2_5', 'pm10']) {
  const g = new Map()
  for (const r of rows) {
    const k = dayKey(r.t, tz)
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(r)
  }
  return [...g.entries()].map(([day, rs]) => {
    const o = { day, n: rs.length }
    for (const key of keys) {
      const vals = rs.map((r) => r[key]).filter((v) => v != null)
      o[key] = avg(vals)
      o[key + '_max'] = vals.length ? Math.max(...vals) : null
    }
    return o
  })
}

// ---------- anomaly detection (rolling median + MAD robust z-score) ----------
export function detectAnomalies(rows, key = 'pm2_5', win = 48, thresh = 3.5) {
  const out = []
  for (let i = win; i < rows.length; i++) {
    const x = rows[i][key]
    if (x == null) continue
    const w = rows.slice(i - win, i).map((r) => r[key]).filter((v) => v != null).sort((a, b) => a - b)
    if (w.length < win / 2) continue
    const med = w[Math.floor(w.length / 2)]
    const dev = w.map((v) => Math.abs(v - med)).sort((a, b) => a - b)
    const mad = dev[Math.floor(dev.length / 2)] || 1
    const z = (0.6745 * (x - med)) / mad
    if (z > thresh && x > 25) out.push({ t: rows[i].t, value: x, baseline: med, z })
  }
  // merge consecutive hours into events
  const events = []
  for (const a of out) {
    const last = events[events.length - 1]
    if (last && a.t - last.end <= 3 * 3600e3) {
      last.end = a.t
      if (a.value > last.peak) { last.peak = a.value; last.peakT = a.t; last.baseline = a.baseline }
    } else events.push({ start: a.t, end: a.t, peak: a.value, peakT: a.t, baseline: a.baseline })
  }
  return { points: out, events }
}

// ---------- ML: ridge-regression autoregressive model with weather covariates ----------
function solve(A, b) {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    const piv = M[c][c] || 1e-9
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / piv
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-9))
}

const L = (v) => Math.log1p(Math.max(0, v))
const FEATS = ['bias', 'lag1', 'lag2', 'lag3', 'lag24', 'hsin', 'hcos', 'wind', 'rh', 'blh', 'temp', 'rain']

function features(series, i, w, tzOffsetH) {
  const h = (new Date(series[i].t).getUTCHours() + tzOffsetH + 24) % 24
  return [
    1, series[i - 1].y, series[i - 2].y, series[i - 3].y, series[i - 24].y,
    Math.sin((2 * Math.PI * h) / 24), Math.cos((2 * Math.PI * h) / 24),
    Math.log1p(w?.wind_speed_10m ?? 8), (w?.relative_humidity_2m ?? 60) / 100,
    Math.log1p(w?.boundary_layer_height ?? 500) / 8, (w?.temperature_2m ?? 20) / 40, Math.log1p(w?.precipitation ?? 0),
  ]
}

function fit(X, y, lambda = 0.5) {
  const d = X[0].length
  const XtX = Array.from({ length: d }, () => Array(d).fill(0))
  const Xty = Array(d).fill(0)
  for (let r = 0; r < X.length; r++) {
    const x = X[r]
    for (let i = 0; i < d; i++) {
      Xty[i] += x[i] * y[r]
      for (let j = 0; j < d; j++) XtX[i][j] += x[i] * x[j]
    }
  }
  for (let i = 1; i < d; i++) XtX[i][i] += lambda
  return solve(XtX, Xty)
}
const dot = (w, x) => w.reduce((s, wi, i) => s + wi * x[i], 0)

function rollout(w, hist, futureT, wx, tzOffsetH) {
  const s = [...hist]
  const preds = []
  for (const t of futureT) {
    s.push({ t, y: 0 })
    const i = s.length - 1
    const yhat = dot(w, features(s, i, wx.get(t), tzOffsetH))
    s[i].y = yhat
    preds.push({ t, pm2_5: Math.max(0, Math.expm1(yhat)) })
  }
  return preds
}

/**
 * Trains on past hourly PM2.5 + weather, evaluates on the last 48h (vs. persistence baseline),
 * then predicts the next `horizon` hours using the weather forecast as covariates.
 */
export function mlForecast(aqPast, wxRows, { horizon = 72, tzOffsetH = 0 } = {}) {
  const wx = new Map(wxRows.map((r) => [r.t, r]))
  const series = aqPast.filter((r) => r.pm2_5 != null).map((r) => ({ t: r.t, y: L(r.pm2_5) }))
  if (series.length < 24 * 6) return null

  const build = (upto) => {
    const X = [], y = []
    for (let i = 24; i < upto; i++) { X.push(features(series, i, wx.get(series[i].t), tzOffsetH)); y.push(series[i].y) }
    return { X, y }
  }
  // backtest
  const hold = 48
  const cut = series.length - hold
  const tr = build(cut)
  const w0 = fit(tr.X, tr.y)
  const back = rollout(w0, series.slice(0, cut), series.slice(cut).map((s) => s.t), wx, tzOffsetH)
  const actual = series.slice(cut).map((s) => Math.expm1(s.y))
  const mae = avg(back.map((p, i) => Math.abs(p.pm2_5 - actual[i])))
  const persist = Math.expm1(series[cut - 1].y)
  const maeBase = avg(actual.map((a) => Math.abs(a - persist)))

  // final model on all data
  const all = build(series.length)
  const w = fit(all.X, all.y)
  const lastT = series[series.length - 1].t
  const futureT = Array.from({ length: horizon }, (_, k) => lastT + (k + 1) * 3600e3)
  const preds = rollout(w, series, futureT, wx, tzOffsetH).map((p) => ({ ...p, us_aqi: activeScale() === 'IN' ? naqiNow({ pm2_5: p.pm2_5 })?.value : pm25ToUsAqi(p.pm2_5) }))

  const importance = FEATS.map((f, i) => ({ f, w: w[i] })).slice(1).sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
  return { preds, mae, maeBase, skill: maeBase ? 1 - mae / maeBase : null, backtest: back.map((p, i) => ({ ...p, actual: actual[i] })), importance, nTrain: all.X.length }
}

export function pctChange(a, b) {
  if (a == null || b == null || a === 0) return null
  return ((b - a) / a) * 100
}

// Best continuous window (hours) of lowest forecast AQI in the next 48h, daytime preferred
export function bestWindow(forecast, hours = 2, tz) {
  const f = forecast.slice(0, 48).filter((r) => r.us_aqi != null)
  let best = null
  for (let i = 0; i + hours <= f.length; i++) {
    const seg = f.slice(i, i + hours)
    const hr = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz || undefined }).format(new Date(seg[0].t)))
    if (hr < 5 || hr > 21) continue
    const m = avg(seg.map((r) => r.us_aqi))
    if (!best || m < best.aqi) best = { start: seg[0].t, end: seg[seg.length - 1].t + 3600e3, aqi: m }
  }
  return best
}
