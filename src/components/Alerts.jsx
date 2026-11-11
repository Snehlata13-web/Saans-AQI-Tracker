import { useState } from 'react'
import { Card, AqiChip } from './ui'
import { loadAlerts, saveAlerts, checkAlerts } from '../lib/alerts'
import { bands, fmtTime, activeScale, scaleName } from '../lib/aqi'
import LocationSearch from './LocationSearch'

export default function Alerts({ loc, notify }) {
  const [alerts, setAlerts] = useState(loadAlerts)
  const [target, setTarget] = useState(loc)
  const [th, setTh] = useState(() => (activeScale() === 'IN' ? 300 : 150))
  const [fc, setFc] = useState(true)
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  const [busy, setBusy] = useState(false)
  const upd = (a) => { saveAlerts(a); setAlerts(a) }

  const add = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') setPerm(await Notification.requestPermission())
    upd([...alerts, { id: Date.now(), name: target.name, lat: target.lat, lon: target.lon, threshold: Number(th), forecast: fc, scale: activeScale() }])
  }
  const test = async () => { setBusy(true); try { const f = await checkAlerts(notify); if (!f.length) notify({ title: '✅ All clear', body: 'No alert thresholds crossed right now.' }) } catch (e) { notify({ title: 'Check failed', body: e.message }) } setAlerts(loadAlerts()); setBusy(false) }

  return (
    <div className="grid">
      <Card className="span2" title="Smart AQI alerts" icon="🔔">
        <p className="sm muted">Get a browser notification when AQI crosses your threshold — and an early warning when the <b>forecast</b> says it will within 12 hours. Checked every 15 minutes while SAANS is open.</p>
        <div className="alert-form">
          <div><label className="xs muted">Location</label><div className="pick">📍 <b>{target.name}</b></div><LocationSearch compact placeholder="Change location…" onPick={setTarget} /></div>
          <div>
            <label className="xs muted">Notify when {scaleName()} ≥ <b>{th}</b></label>
            <input type="range" min="50" max="500" step="10" value={th} onChange={(e) => setTh(e.target.value)} className="range" />
            <div className="quick">{bands().slice(0, 5).map((c) => <button key={c.key} style={{ '--c': c.color }} onClick={() => setTh(c.max + 1)}>{c.max + 1}</button>)}</div>
          </div>
          <label className="sm"><input type="checkbox" checked={fc} onChange={(e) => setFc(e.target.checked)} /> Also warn me from the forecast</label>
          <button className="btn glow" onClick={add}>+ Create alert</button>
        </div>
        <p className="xs muted">Notifications: <b>{perm}</b>{perm === 'denied' && ' — enable them in your browser site settings. In-app alerts still work.'}</p>
      </Card>
      <Card title="Your alerts" icon="📋" right={<button className="btn sm" onClick={test} disabled={busy}>{busy ? 'Checking…' : 'Check now'}</button>}>
        {alerts.length === 0 && (
          <div className="alert-empty">
            <div className="bell">🔔</div>
            <b>No alerts yet</b>
            <p className="sm muted">Create one and you'll get a heads-up like this:</p>
            <div className="notif-preview"><small>SAANS · NOW</small><b>⚠️ {target.name}: {scaleName()} crossed {th}</b><span className="muted">Crossed your threshold of {th} — wear an N95 outdoors.</span></div>
            <p className="xs muted">Preview of the notification format.</p>
          </div>
        )}
        <ul className="alerts">
          {alerts.map((a) => (
            <li key={a.id}>
              <div><b>{a.name}</b> · {a.scale === 'IN' ? 'NAQI' : 'US AQI'} ≥ {a.threshold}{a.forecast && ' · 🔮'}<br /><small className="muted">{a.checkedAt ? <>last: <AqiChip v={a.last} /> at {fmtTime(a.checkedAt)}</> : 'not checked yet'}</small></div>
              <button className="x" onClick={() => upd(alerts.filter((x) => x.id !== a.id))}>×</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
