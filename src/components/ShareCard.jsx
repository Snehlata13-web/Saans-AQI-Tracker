import { useEffect, useRef, useState } from 'react'
import { category, round, fmtTime, POLLUTANTS, scaleName } from '../lib/aqi'
import { summary } from '../lib/insights'

function draw(cv, { loc, aq }) {
  const W = 1080, H = 1350
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  const c = aq.current || {}
  const cat = category(c.us_aqi)
  const s = summary(aq)
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#070b1d'); bg.addColorStop(0.6, '#140a2e'); bg.addColorStop(1, '#2a0d1a')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  // glow orb
  const rg = g.createRadialGradient(W / 2, 520, 40, W / 2, 520, 420)
  rg.addColorStop(0, cat.color + 'cc'); rg.addColorStop(0.5, cat.color + '33'); rg.addColorStop(1, 'transparent')
  g.fillStyle = rg; g.fillRect(0, 0, W, H)
  // particles
  const n = Math.min(900, Math.max(60, (c.pm2_5 || 0) * 6))
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 330
    g.fillStyle = cat.color + (Math.random() > 0.5 ? 'aa' : '55')
    g.beginPath(); g.arc(W / 2 + Math.cos(a) * r, 520 + Math.sin(a) * r, Math.random() * 3 + 1, 0, 7); g.fill()
  }
  g.textAlign = 'center'
  g.fillStyle = '#ffd27a'; g.font = '600 34px "Space Grotesk", sans-serif'
  g.fillText('🪔  SAANS · AIR QUALITY REPORT', W / 2, 110)
  g.fillStyle = '#fff'; g.font = '700 84px "Space Grotesk", sans-serif'
  g.fillText(loc.name, W / 2, 220)
  g.font = '400 30px Inter, sans-serif'; g.fillStyle = '#aab3cf'
  g.fillText(fmtTime(c.t, aq.tz), W / 2, 270)
  g.fillStyle = '#fff'; g.font = '800 250px "Space Grotesk", sans-serif'
  g.shadowColor = cat.color; g.shadowBlur = 60
  g.fillText(String(c.us_aqi ?? '—'), W / 2, 610)
  g.shadowBlur = 0
  g.font = '600 34px Inter'; g.fillStyle = '#cfd6ea'; g.fillText(scaleName(), W / 2, 670)
  g.fillStyle = cat.color
  const label = `${cat.emoji} ${cat.label}`
  g.font = '700 48px "Space Grotesk"'
  const tw = g.measureText(label).width + 80
  g.beginPath(); g.roundRect(W / 2 - tw / 2, 715, tw, 86, 43); g.fill()
  g.fillStyle = '#0a0d1f'; g.fillText(label, W / 2, 775)
  // pollutants
  const ps = POLLUTANTS.filter((p) => c[p.key] != null)
  ps.forEach((p, i) => {
    const col = i % 3, row = Math.floor(i / 3)
    const x = 100 + col * 300, y = 860 + row * 130
    g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(x, y, 280, 110, 22); g.fill()
    g.textAlign = 'left'
    g.fillStyle = '#9aa4bf'; g.font = '500 26px Inter'; g.fillText(p.label, x + 24, y + 40)
    g.fillStyle = '#fff'; g.font = '700 40px "Space Grotesk"'; g.fillText(`${round(c[p.key], 1)}`, x + 24, y + 88)
    g.fillStyle = '#9aa4bf'; g.font = '400 20px Inter'; g.fillText('µg/m³', x + 200, y + 88)
  })
  g.textAlign = 'center'
  g.fillStyle = '#ffd27a'; g.font = '600 36px Inter'
  if (s.cig != null) g.fillText(`🚬 ≈ ${round(s.cig, 1)} cigarettes/day  ·  ${round(s.whoX, 1)}× WHO PM2.5 limit`, W / 2, 1160)
  g.fillStyle = '#cfd6ea'; g.font = '400 28px Inter'
  g.fillText(cat.activity.slice(0, 70), W / 2, 1215)
  g.fillStyle = '#6f7a99'; g.font = '400 22px Inter'
  g.fillText('Model estimate · Open-Meteo Air Quality API (Copernicus CAMS)', W / 2, 1290)
  g.fillText('#BreatheBetter #LetsCodeDiwali2026', W / 2, 1322)
}

export default function ShareCard({ loc, aq, onClose }) {
  const cv = useRef()
  const [url, setUrl] = useState(null)
  useEffect(() => { document.fonts?.ready.then(() => { draw(cv.current, { loc, aq }); setUrl(cv.current.toDataURL('image/png')) }) }, [loc, aq])
  const share = async () => {
    const blob = await (await fetch(url)).blob()
    const file = new File([blob], `saans-${loc.name}.png`, { type: 'image/png' })
    const text = `Air quality in ${loc.name} right now: ${scaleName()} ${aq.current?.us_aqi} (${category(aq.current?.us_aqi).label}). Check yours on SAANS 🪔 #BreatheBetter`
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text }).catch(() => {})
    else window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text + ' ' + location.href), '_blank')
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-in" onClick={(e) => e.stopPropagation()}>
        <canvas ref={cv} className="share-cv" />
        <div className="modal-act">
          {url && <a className="btn glow" href={url} download={`saans-${loc.name}.png`}>⬇ Download PNG</a>}
          <button className="btn" onClick={share}>📤 Share</button>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
