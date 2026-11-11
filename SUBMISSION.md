# SAANS — Submission kit (copy-paste into the form)

Submit at: https://forms.gle/8ck7stXe8W61U2t88 — deadline **11 Nov 2026, 11:59 PM**.

---

## 1. Project name
**SAANS — Real-Time Air Quality Intelligence** 🪔

## 2. Short description (≈ 60 words)
SAANS (साँस = "breath") turns live air-quality data into decisions. It shows real-time AQI on both the **India NAQI (CPCB)** and **US EPA** scales, next to readings from nearby ground stations. It adds a 3D pollution globe, a live heatmap, history with the Diwali-firecracker effect, ML + CAMS forecasts, a voice AI assistant, smart alerts and shareable cards. Every number is labelled as a measurement, a model estimate or a forecast.

## 2b. Long description
Air pollution is invisible. Most dashboards show a number and stop there. SAANS answers three questions: *How bad is the air right now? What does it mean for me? When will it get better?*

- **See it:** a breathing 3D orb whose particle density follows live PM2.5, a spinning 3D Earth with AQI pillars for 76 cities, and a blurred pollution heatmap with real monitoring stations.
- **Understand it:** cigarette-equivalent exposure, WHO-guideline multiples, CPCB/EPA health statements, and advice for children, elders, asthma or heart patients, pregnant women and athletes.
- **Act on it:** the best 2-hour window to go outside, forecast-based early-warning alerts, a Clean Air Finder that looks for cleaner places within 160 km, and a Hinglish voice assistant.
- **Analyse it:** daily trends, % changes, spike and anomaly detection, a two-date comparison, a downloadable impact report, and a **Diwali Effect** chart that lines up PM2.5 around every Diwali since 2023.

**Data honesty:** SAANS computes AQI itself using the official EPA NowCast method and the CPCB breakpoints. It does not use Open-Meteo's raw index, which is inflated by CAMS ozone. We checked our numbers against IQAir on 9 Nov 2026: Delhi 192 vs 196, Mumbai 160 vs 159.

## 3. Live URL
`https://<your-project>.vercel.app`

## 4. GitHub repository
`https://github.com/<your-username>/saans`

## 5. Public APIs integrated
1. **Open-Meteo Air Quality API**: Copernicus CAMS model, current + hourly history since 2022 + 5-day forecast, multi-location.
2. **WAQI / aqicn.org**: ground-station measurements (nearest station, stations on the map, hotspots).
3. **CPCB Real-time AQI via data.gov.in** (Open Government Data, optional key): official NAQI for each station.
4. **Open-Meteo Weather API**: wind, humidity, boundary-layer height (used for insights and as ML features).
5. **Open-Meteo Geocoding API**: place search.
6. **OSRM routing (routing.openstreetmap.de)**: route alternatives for Clean Commute.
6b. **BigDataCloud Reverse Geocoding**: names for "Near me" and map probes.
7. **Google Gemini API** (optional, server-side key; Groq/OpenAI also supported): LLM assistant + one-click AI briefing. Without a key, a built-in engine grounded on the live data answers instead.

## 6. Screenshots
See `docs/` in the repo (dashboard, globe, map, history, Diwali effect, forecast, compare, health, AI, alerts).

## 7. Demo video (2–3 min)
`<YouTube / Drive link — set to "Anyone with the link">`

## 8. Features implemented

### Mandatory ✅
- **A. Live AQI dashboard:**
  - Headline AQI on the India NAQI or US AQI scale.
  - PM2.5, PM10, NO₂, SO₂, CO and O₃, each with its WHO-guideline multiple.
  - Severity category, source and last-updated timestamp.
- **B. Interactive map:**
  - Colour-coded markers and real monitoring stations.
  - Click anywhere to probe the air there.
  - Pulsing hotspots, a heatmap and a legend.
- **C. Historical tracker:**
  - 7D / 30D / 90D / 1Y / custom ranges, with daily averages and peak hours.
  - PM2.5 vs PM10, % change from the previous day, ⚡ spike markers.
  - Two-date comparison.
- **D. Location comparison:**
  - Up to 5 places, a pollutant table and 7-day trends.
  - 👑 marks the cleanest place.
- **E. Health & safety:**
  - Interactive AQI scale and CPCB/EPA health statements.
  - Advice for 7 groups, plus a mask and indoor guide and a PM2.5 vs PM10 size visual.
- **F. AQI forecast:**
  - 5-day CAMS forecast with a NOW divider, daily outlook and predicted spikes.
  - The best time to go outside.

### Bonus ✅ (13/13)
1. AI assistant
2. Smart alerts, including forecast-based warnings
3. ML prediction: ridge regression with weather features, back-tested
4. Pollution heatmap
5. Location-based AQI ("Near me")
6. Clean Air Finder
7. Share cards (PNG + Web Share)
8. Impact report (.md download)
9. Leaderboard (All / India / World)
10. Voice assistant (speech in and out)
11. Anomaly detection (robust z-score)
12. Multi-API integration
13. AI insights

### Extra
- Live model-vs-station accuracy card (Delhi: model 171 vs 26-station median 166, +3%).
- Lighthouse 100 for Accessibility, Best Practices and SEO.
- **🧭 Clean Commute (signature feature):** compares every route against the 24 h PM2.5 forecast and recommends the cleanest road and the best departure time, with an inhaled-dose estimate (e.g. "leave at 2:30 pm via Route A → 37% less PM2.5").
- 48 h map time-lapse with animated wind flow (shows where smoke is drifting from).
- Unit tests and CI (GitHub Actions); error boundaries with a WebGL fallback.
- Diwali Effect analysis.
- Global India NAQI ⇄ US AQI switch: every page (globe, map, history, forecast, compare, health, alerts, share card, AI) follows the selected scale.
- 3D breath orb, 3D globe, 3D smog backdrop.
- ⌘K command palette, live city ticker, PWA manifest, shareable URLs.
- Offline / stale-cache fallback, rate-limit handling, auto-refresh every 10 min.
