# 🎬 SAANS — Demo video script (≈ 3:45)

Record at **1080p** with QuickTime (⌘⇧5 → "Record Entire Screen", turn on the mic) or OBS.
Talk calmly, in English or Hinglish. Read the numbers **from the screen**, because they are live and will be different from the examples below.

---

## ✅ Before you record (5 min)

1. Open the **deployed URL** (better than localhost) in Chrome, full screen (⌃⌘F), zoom 100%, all other tabs closed.
2. Open every page once so the data is cached and loads instantly.
3. In the **Compare** page, check that Delhi, Mumbai and Bengaluru have loaded.
4. In **Commute**, run New Delhi → Gurugram once so the routes are already cached.
5. Turn on Do-Not-Disturb, turn off "read answers aloud" in AI, and plug in a headset mic.
6. Reload once with the location set to **New Delhi** and the **🇮🇳 NAQI** scale selected.
7. To see the intro splash again, open a new tab, or clear the session storage.

---

## 🎙️ Script

| Time | What to SHOW | What to SAY |
|---|---|---|
| **0:00 – 0:15** | Intro splash "SAANS · breathe in… breathe out" → Live page | "Hi, I'm the creator of SAANS. This is **SAANS** — साँस means *breath*. It's a real-time air-quality intelligence platform that doesn't just show a number, it tells you **what to do** about the air you breathe." |
| **0:15 – 0:45** | **Live** hero: the big AQI number, category pill, scale meter, the 3D orb with pollutants orbiting | "Right now New Delhi is at India NAQI **<number>**, *<category>*. Every number is labelled — this one is a **model estimate** from Copernicus CAMS, and next to it is the median of **real monitoring stations**. The orb is live: its particle density follows the current PM2.5, and you can see each pollutant orbiting it." |
| **0:45 – 1:00** | Click **🇮🇳 NAQI → 🇺🇸 US** in the top bar, then back | "Indian apps use the CPCB scale and global apps use the US EPA scale, which is why people see different numbers. SAANS computes **both** from raw concentrations, and one switch changes **every page** in the app." |
| **1:00 – 1:15** | Press and hold **"Hold to breathe"** for 4 seconds and show the result card | "Hold to breathe… that single breath carried about **<x> µg** of PM2.5 into my lungs — and a full day here is about **<y> µg**, roughly **<z> cigarettes**." |
| **1:15 – 1:35** | Scroll: the tilted marquee → 24h line → pollutant rings → **Live accuracy check** card → stations list | "Here are all six pollutants versus WHO limits. And this is our **live accuracy check**: the model says **<m>**, and **<n> ground stations** within 25 km have a median of **<s>** — a **<bias>%** difference. Each dot is a real station, so we validate our data live instead of just trusting it." |
| **1:35 – 2:00** | ⭐ **Commute** → "To: Gurugram" → 🚗 Drive → *Find cleanest route & time* → drag the departure slider | "This is the feature I'm proudest of — **Clean Commute**. SAANS takes every road route, samples the 24-hour pollution forecast along each one, and estimates how much PM2.5 you'd actually inhale. Here it says: leave at **<time>** via **Route <X>** and breathe **<y>% less** pollution. Drag the slider and the route colours change by departure time." |
| **2:00 – 2:20** | **Map** → press **▶** on the timeline (let it play 5 sec) → click an empty spot on the map | "On the map you get a live heatmap, real monitoring stations and hotspots. Press play and you see the next **48 hours** of pollution with **wind flow** — you can literally watch smoke drift in. Click anywhere on Earth to probe the air there." |
| **2:20 – 2:30** | **3D Globe** → drag to spin → click a pillar | "76 cities live on a 3D globe — pillar height is AQI — plus a leaderboard and a Clean Air Finder for cleaner places nearby." |
| **2:30 – 2:50** | **History** → 30D → scroll past the spikes ⚡ → **Diwali Effect** chart | "History shows daily trends, % change, spikes, anomaly detection and a downloadable impact report. And since it's Diwali — this chart lines up PM2.5 around every Diwali since 2023 to show the firecracker effect." |
| **2:50 – 3:10** | **Forecast** → the NOW line → scroll to the **ML model** card | "The forecast clearly separates the past from the future with a NOW line. Beyond the Copernicus forecast, I built my own **ML model** — a ridge-regression time-series model trained live in the browser on 30 days of pollution and weather. It's back-tested honestly: here it is **<skill>%** better than a naive baseline." |
| **3:10 – 3:25** | **AI** → click 🎙️ and say *"Kya aaj bahar running kar sakta hoon?"* (or click the tile) | "And the AI assistant, powered by Gemini, answers only from live data — short, relevant, even in Hinglish." *(let the answer appear)* |
| **3:25 – 3:35** | **Health** → click a persona (e.g. Asthma) → **Alerts** (show the form) | "Health advice for seven groups — kids, elders, asthma, heart patients — and smart alerts that warn you even **before** the air turns bad, using the forecast." |
| **3:35 – 3:45** | Back to **Live** → click **📸 Create share card** → show the PNG → scroll to the footer "BREATHE BETTER." | "You can share a pollution card to spread awareness. SAANS uses 8 public APIs, no fabricated data, scores 100 on Lighthouse accessibility, and runs smoothly on phones. **Breathe better, build smarter.** Thank you, and happy Diwali! 🪔" |

---

## 🎯 Must-show checklist (judges' criteria)

- [ ] Live AQI + all 6 pollutants + category + **last updated time + source** (A, API)
- [ ] **Measured vs model vs forecast labels**, plus the accuracy card (data accuracy, 20%)
- [ ] NAQI ⇄ US switch (UX)
- [ ] Map: colours, click a location, hotspots, heatmap, ▶ time-lapse (B)
- [ ] History: chart, PM2.5 vs PM10, % change, spikes, date compare (C)
- [ ] Compare page (D): even 3 seconds is enough, just show the 👑 cleanest badge
- [ ] Health page (E)
- [ ] Forecast + NOW line + ML card (F + ML bonus)
- [ ] Commute ⭐, Hold to breathe, AI voice (innovation + impact)

## 💡 Tips
- If a page loads slowly, keep talking. Don't cut, and keep it to one take if you can.
- Move the mouse slowly; the glowing cursor and tilt look great on video.
- Final length: **3–4 min**. If you're over, shorten Globe and Health.
- Upload to YouTube as **Unlisted** (or to Drive as "Anyone with the link") → paste the link in the README, `SUBMISSION.md` and the form.
