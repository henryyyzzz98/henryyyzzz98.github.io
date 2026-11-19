// ===================== UI refresh: points progression, weather forecast, GPS data, driver profile =====================

// ---------- Points progression (full page) ----------
const PG = { all: false };
function pgSeries(S, mode) {
  const ptsOf = (r, f) => r.rows.filter(f).reduce((a, x) => a + (x.pts || 0), 0) + (r.sprint ? r.sprint.filter(f).reduce((a, x) => a + (x.pts || 0), 0) : 0);
  const tmOf = id => (S.allTeams || S.teams).find(t => t.id === id);
  let list;
  if (mode === 'd') {
    const ds = S.drivers.filter(d => S.results.some(r => r.rows.some(x => x.id === d.id)));
    list = (PG.all ? ds : ds.slice(0, 8)).map(d => ({ id: d.id, name: dkShort(d), team: d.team, col: (tmOf(d.team) || { color: '#888' }).color, f: x => x.id === d.id }));
    // second driver of a team (in this list) is drawn dotted with hollow markers
    const seen = {}; list.forEach(s => { s.mate = !!seen[s.team]; seen[s.team] = 1; });
  } else list = (PG.all ? S.teams : S.teams.slice(0, 8)).map(t => ({ id: t.id, name: t.name, col: t.color, f: x => x.team === t.id, mate: false }));
  list.forEach(s => { let c = 0; s.cum = S.results.map(r => c += ptsOf(r, s.f)); });
  return list;
}
function pgRender(S, mode) {
  const N = S.results.length, R = S.cal.length;
  if (!N) return '<div class="dk-empty">The points progression appears after the first race.</div>';
  const series = pgSeries(S, mode);
  const W = 1600, H = 820, L = 60, RT = 190, T = 30, B = 70;
  const max0 = Math.max(10, ...series.map(s => s.cum[N - 1]));
  const step = max0 > 400 ? 100 : max0 > 120 ? 50 : max0 > 50 ? 20 : 10, max = Math.ceil(max0 / step) * step;
  const X = i => L + (R <= 1 ? 0 : i / (R - 1)) * (W - L - RT), Y = v => T + (1 - v / max) * (H - T - B);
  const code = i => S.cur ? String(roundTrack(G, i).id || S.cal[i][0]).slice(0, 3).toUpperCase() : String(S.cal[i][0]).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  let grid = '';
  for (let v = 0; v <= max; v += step) grid += `<line x1="${L}" x2="${X(R - 1)}" y1="${Y(v)}" y2="${Y(v)}" class="pg-gl"/><text x="${L - 10}" y="${Y(v) + 5}" class="pg-yl">${v}</text>`;
  for (let i = 0; i < R; i++) grid += `<line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H - B}" class="pg-vl ${i < N ? 'done' : ''}"/><text x="${X(i)}" y="${H - B + 22}" class="pg-xl">R${i + 1}</text><text x="${X(i)}" y="${H - B + 42}" class="pg-xl b">${esc(code(i))}</text>`;
  const lines = series.map(s => `<g class="pg-s"><polyline fill="none" stroke="${s.col}" stroke-width="${s.mate ? 2.2 : 3}" ${s.mate ? 'stroke-dasharray="2 7" stroke-linecap="round"' : ''} points="${s.cum.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>${s.cum.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${s.mate ? 5 : 6}" ${s.mate ? `fill="#000" stroke="${s.col}" stroke-width="2"` : `fill="${s.col}"`}><title>${esc(s.name)} · R${i + 1} ${esc(code(i))}: ${v} pts</title></circle>`).join('')}</g>`).join('');
  // end labels, nudged apart so they never overlap
  const labs = series.map(s => ({ s, y0: Y(s.cum[N - 1]), y: Y(s.cum[N - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + 20);
  for (let i = labs.length - 1; i >= 0; i--) labs[i].y = Math.min(labs[i].y, i === labs.length - 1 ? H - B - 4 : labs[i + 1].y - 20);
  const xe = X(N - 1);
  const lab = labs.map(({ s, y0, y }) => `${Math.abs(y - y0) > 3 ? `<line x1="${xe + 7}" y1="${y0}" x2="${xe + 20}" y2="${y}" stroke="${s.col}" stroke-width="1"/>` : ''}<text x="${xe + 24}" y="${y + 6}" fill="${s.col}" class="pg-lab">${esc(s.name)}</text>`).join('');
  return `<div class="pg-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${lines}${lab}</svg></div>`;
}
dkPointsGraph = function (mode) { return pgRender(dkSeasonData(null), mode); };
dkPointsGraphS = function (S, mode) { return pgRender(S, mode); };
const _pg_deskStandings = deskStandings;
deskStandings = function () {
  if (DK2.panel !== 'graph') return _pg_deskStandings.apply(this, arguments);
  const S = (typeof DK3 !== 'undefined' && dkSeasonData(DK3.season)) || dkSeasonData(null), mode = DK2.st;
  return `<div class="dk dk-page pg-page" id="dk"><div class="pg-head"><h2>Points Progression${S.cur ? '' : ' · ' + S.year}</h2>
    <div class="pg-btns"><button data-a="dkst2" data-v="graph">Back to Standings</button><button class="${mode === 'd' ? 'on' : ''}" data-a="dkst" data-v="d">Drivers</button><button class="${mode === 't' ? 'on' : ''}" data-a="dkst" data-v="t">Constructors</button><button class="${PG.all ? 'on' : ''}" data-a="pgall">${PG.all ? 'Top 8' : 'Show all'}</button></div></div>
    ${pgRender(S, mode)}</div>`;
};
A.pgall = () => { PG.all = !PG.all; render(); };
// the Drivers/Constructors buttons must keep the graph open
const _pg_dkst = A.dkst;
A.dkst = function (el) { const keep = DK2.panel === 'graph'; const r = _pg_dkst.apply(this, arguments); if (keep && DK2.panel !== 'graph') { DK2.panel = 'graph'; render(); } return r; };

// ---------- Weather forecast ----------
const WXLOG = { key: null, pts: [] };
hxChain('raceInit', race => { race.wet0 = race.wet; race.wetHist = [race.wet]; });
hxChain('onLap', (race, c, n) => { if (n === race.leaderLap && race.wetHist) race.wetHist[n] = race.wet; });
function wxLog() {
  const kind = dkStage(); if (kind !== 'race' && kind !== 'quali') return;
  const S = kind === 'race' ? RACE : curQS().live; if (!S) return;
  const key = WK.round + ':' + G.year + ':' + kind + ':' + (S.label || '');
  if (WXLOG.key !== key) { WXLOG.key = key; WXLOG.pts = []; }
  const t = S.t || 0, last = WXLOG.pts[WXLOG.pts.length - 1];
  if (last && t - last.t < 20) return;
  const e = dkEnv(S.wet || 0, kind === 'race' ? (S.leaderLap || 0) / S.laps : t / (S.dur || 3600));
  WXLOG.pts.push({ t, wind: e.wind, dir: e.dir });
}
const _wx_dkUpdate = dkUpdate;
dkUpdate = function () { const r = _wx_dkUpdate.apply(this, arguments); try { wxLog(); } catch (e) { } return r; };
function wxSeries(kind, S) {
  // returns buckets: { x label, wet 0..1, temp, icon }
  const out = [];
  if (kind === 'race') {
    const laps = S.laps, plan = (S.plan || []).slice().sort((a, b) => a.lap - b.lap);
    let w = S.wet0 != null ? S.wet0 : WK.weather.start || 0, k = 0; const done = S.leaderLap || 0;
    for (let l = 0; l <= laps; l++) {
      while (k < plan.length && plan[k].lap <= l) k++;
      const tgt = k ? plan[k - 1].target : WK.weather.start || 0;
      if (l <= done && S.wetHist && S.wetHist[l] != null) w = S.wetHist[l]; else if (l === done + 1) w = S.wet; else w += (tgt - w) * 0.35;
      const cur = l <= (S.leaderLap || 0) ? null : null;
      const e = dkEnv(w, l / laps);
      out.push({ x: l, wet: w, temp: e.track, rain: e.rain });
    }
  } else {
    const durS = S.dur || 3600, step = durS <= 1200 ? 30 : 60, n = Math.round(durS / step), w = S.wet || 0;
    for (let m = 0; m <= n; m++) { const e = dkEnv(w, m / Math.max(1, n)); out.push({ x: +(m * step / 60).toFixed(1), wet: w, temp: e.track, rain: e.rain }); }
  }
  // sky: deterministic cloud cover per track/round, worse when wet
  const rr = seeded(WK.track.id + ':sky:' + G.year + ':' + WK.round), base = rr();
  out.forEach((b, i) => { const c = base + Math.sin(i * 0.37 + base * 6) * 0.3; b.icon = b.wet > 0.6 ? 'rain' : b.wet > 0.25 ? 'shower' : b.wet > 0.05 ? 'cloud' : c > 0.55 ? 'cloud' : c > 0.3 ? 'part' : 'sun'; });
  return out;
}
const WX_ICON = { sun: '☀️', part: '⛅', cloud: '☁️', shower: '🌦️', rain: '🌧️' };
function wxModal() {
  const kind = dkStage(), S = kind === 'race' ? RACE : kind === 'quali' ? curQS().live : null;
  if (!S) return null;
  const ser = wxSeries(kind, S), n = ser.length, unit = kind === 'race' ? 'lap' : 'm';
  const now = kind === 'race' ? Math.min(S.laps, (S.leaderLap || 0)) : Math.min(n - 1, Math.floor((S.t || 0) / ((S.dur || 3600) <= 1200 ? 30 : 60)));
  const W = 1500, H = 260, L = 50, R = 50, T = 14, B = 34;
  const tMin = Math.floor(Math.min(...ser.map(b => b.temp)) / 5) * 5 - 5, tMax = Math.ceil(Math.max(...ser.map(b => b.temp)) / 5) * 5;
  const wMax = Math.max(5, Math.ceil(Math.max(...ser.map(b => b.rain)) / 5) * 5);
  const X = i => L + i / Math.max(1, n - 1) * (W - L - R), bw = Math.max(2, Math.min(24, (W - L - R) / n * 0.7));
  const YT = v => T + (1 - (v - tMin) / (tMax - tMin)) * (H - T - B), YW = v => T + (1 - v / wMax) * (H - T - B);
  let g = '';
  for (let v = tMin; v <= tMax; v += 5) g += `<line x1="${L}" x2="${W - R}" y1="${YT(v)}" y2="${YT(v)}" class="wx-gl"/><text x="${L - 6}" y="${YT(v) + 4}" class="wx-yl">${v}°</text>`;
  [0, wMax / 2, wMax].forEach(v => { g += `<text x="${W - R + 6}" y="${YW(v) + 4}" class="wx-yr">${+v.toFixed(1)}</text>`; });
  const tickEvery = Math.max(1, Math.round(n / 12));
  ser.forEach((b, i) => { if (i % tickEvery === 0 || i === n - 1) g += `<line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H - B}" class="wx-vl"/><text x="${X(i)}" y="${H - B + 18}" class="wx-xl">${kind === 'race' ? 'L' + b.x : b.x + 'm'}</text>`; });
  const bars = ser.map((b, i) => b.rain > 0.01 ? `<rect x="${X(i) - bw / 2}" y="${YW(b.rain)}" width="${bw}" height="${H - B - YW(b.rain)}" class="wx-bar ${i < now ? 'past' : ''}"/>` : '').join('');
  const line = `<polyline fill="none" stroke="#f59e0b" stroke-width="2" points="${ser.map((b, i) => X(i) + ',' + YT(b.temp)).join(' ')}"/>`;
  const nowL = `<line x1="${X(now)}" x2="${X(now)}" y1="${T}" y2="${H - B}" stroke="#facc15" stroke-width="2"/>`;
  const iconsEvery = Math.max(1, Math.ceil(n / 40));
  const icons = `<div class="wx-icons">${ser.filter((_, i) => i % iconsEvery === 0).map((b, j) => `<span class="${j * iconsEvery <= now && now < (j + 1) * iconsEvery ? 'now' : ''}" title="${kind === 'race' ? 'Lap ' + b.x : b.x + ' min'}">${WX_ICON[b.icon]}</span>`).join('')}</div>`;
  // wind (observed)
  const obs = WXLOG.pts.length ? WXLOG.pts : [{ t: 0, wind: dkEnv(S.wet || 0, 0).wind, dir: dkEnv(S.wet || 0, 0).dir }];
  const dur = kind === 'race' ? Math.max(obs[obs.length - 1].t, 60) : (S.dur || 3600);
  const WW = 1200, WH = 220, wTop = Math.max(20, Math.ceil(Math.max(...obs.map(o => o.wind)) / 5) * 5 + 5);
  const WX = t => L + t / dur * (WW - L - 20), WY = v => 10 + (1 - v / wTop) * (WH - 44);
  let wg = '';
  for (let v = 0; v <= wTop; v += 5) wg += `<line x1="${L}" x2="${WW - 20}" y1="${WY(v)}" y2="${WY(v)}" class="wx-gl"/><text x="${L - 6}" y="${WY(v) + 4}" class="wx-yl">${v}</text>`;
  for (let k = 0; k <= 12; k++) { const t = dur * k / 12; wg += `<text x="${WX(t)}" y="${WH - 14}" class="wx-xl">${dur < 900 ? Math.round(t) + 's' : Math.round(t / 60) + 'm'}</text>`; }
  wg += `<polyline fill="none" stroke="#22c55e" stroke-width="2" points="${obs.map(o => WX(o.t) + ',' + WY(o.wind)).join(' ')}"/>${obs.map(o => `<circle cx="${WX(o.t)}" cy="${WY(o.wind)}" r="2.5" fill="#22c55e"/>`).join('')}`;
  const cur = obs[obs.length - 1], dir = cur.dir;
  const compass = `<svg viewBox="-60 -60 120 120" class="wx-comp"><circle r="40" fill="none" stroke="#3b82f6" stroke-width="1.5"/><text y="-46" class="wx-cl">N</text><text y="56" class="wx-cl">S</text><text x="-52" y="4" class="wx-cl">W</text><text x="52" y="4" class="wx-cl">E</text><g transform="rotate(${dir})"><line y1="30" y2="-30" stroke="#3b82f6" stroke-width="3"/><path d="M0,-36 L-8,-22 L8,-22 Z" fill="#3b82f6"/></g></svg>`;
  const st = a => { const mn = Math.min(...a), mx = Math.max(...a), av = a.reduce((x, y) => x + y, 0) / a.length; return `Min ${mn.toFixed(1)} | Max ${mx.toFixed(1)} | Avg ${av.toFixed(1)}`; };
  const sess = kind === 'race' ? `Race | ${S.laps} laps` : `${/^SQ/.test(S.label) ? 'Sprint Qualifying' : 'Qualifying'} | ${Math.round((S.dur || 3600) / 60)} minutes`;
  return `<div class="dkx-mod wx-mod"><div class="dkx-hd"><div><h2>Weather Forecast</h2><div class="wx-sub">${esc(WK.track.name)} | ${sess}</div></div><span class="sp"></span><button class="dkx-x" data-a="hxclose">✕</button></div>
  <div class="dkx-body wx-body">
    <section><div class="wx-h"><b>Temperature &amp; track wetness</b><span class="dk-mut">Temp °C &nbsp;/&nbsp; Wet mm</span></div><svg viewBox="0 0 ${W} ${H}" class="wx-svg">${g}${bars}${line}${nowL}</svg>${icons}</section>
    <section><div class="wx-h"><b>Wind speed &amp; direction · observed</b><span class="dk-mut">km/h</span></div><div class="wx-wind"><svg viewBox="0 0 ${WW} ${WH}" class="wx-svg">${wg}</svg><div class="wx-cbox">${compass}<div>toward ${dkCompass(dir)}<br><b>${Math.round(dir)}° · ${Math.round(cur.wind)} km/h</b></div></div></div></section>
    <div class="wx-foot"><div><span class="wx-fi">🌡️</span><b>Temperature (°C)</b><div>${st(ser.map(b => b.temp))}</div></div><div><span class="wx-fi">💧</span><b>Track wetness (mm)</b><div>${st(ser.map(b => b.rain))}</div></div><div><span class="wx-fi">💨</span><b>Wind (observed) (km/h)</b><div>${st(obs.map(o => o.wind))}</div></div></div>
    ${WK.forecast ? `<div class="dk-mut wx-note">${esc(WK.forecast)}</div>` : ''}
    <div class="wx-close"><button data-a="hxclose">Close · Esc</button></div>
  </div></div>`;
}

// ---------- GPS data: speed trap, cornering speeds, pit times ----------
const GPSV = { tab: 'trap' };
hxChain('onPit', (race, c, comp, svc) => { (c.pitLog || (c.pitLog = [])).push({ lap: c.laps + 1, svc, lane: c.pitT, comp }); });
function gpsModal() {
  const kind = dkStage(), S = kind === 'race' ? RACE : kind === 'quali' ? curQS().live : null; if (!S) return null;
  const tabs = kind === 'race' ? [['trap', 'Speed Trap'], ['corner', 'Cornering Speeds'], ['pit', 'Pit Times']] : [['trap', 'Speed Trap'], ['corner', 'Cornering Speeds']];
  if (!tabs.some(t => t[0] === GPSV.tab)) GPSV.tab = 'trap';
  const cars = (kind === 'race' ? RACE.cars : S.cars).slice().sort((a, b) => a.d.name.localeCompare(b.d.name));
  const prof = dkProf(S.track), lapOf = c => kind === 'race' ? (c.best || c.curLT) : (c.best || S.base || 90);
  const avg = c => S.L / lapOf(c) * 3.6;
  const row = (c, cells) => `<tr style="--tc:${c.t.color}"><td class="l"><i class="gps-sw"></i>${esc(dkShort(c.d))}</td><td class="l">${esc(c.t.full || c.t.name)}</td>${cells}</tr>`;
  let head, body, title;
  if (GPSV.tab === 'trap') {
    title = 'Speed Trap';
    const v = c => DK.vmax[c.d.id] || Math.round(avg(c) * prof.max);
    const best = Math.max(...cars.map(v));
    head = '<th class="ra">Top speed</th>'; body = cars.slice().sort((a, b) => v(b) - v(a)).map(c => row(c, `<td class="ra ${v(c) === best ? 'pu' : ''}">${v(c)} km/h</td>`)).join('');
  } else if (GPSV.tab === 'corner') {
    title = 'Cornering Speeds';
    const r = c => { const s = seeded('cs' + c.d.id + WK.track.id), k = 1 + (c.d.craft - 85) / 900; return [0.5, 0.72, 0.93].map(f => Math.round(avg(c) * f * k * (0.985 + s() * 0.03))); };
    head = '<th class="ra">Slow</th><th class="ra">Medium</th><th class="ra">Fast</th>';
    const all = cars.map(r), bests = [0, 1, 2].map(i => Math.max(...all.map(x => x[i])));
    body = cars.map((c, j) => row(c, all[j].map((x, i) => `<td class="ra ${x === bests[i] ? 'pu' : ''}">${x} km/h</td>`).join(''))).join('');
  } else {
    title = 'Pit Time';
    const fast = Math.min(...cars.flatMap(c => (c.pitLog || []).map(p => p.svc)), 99);
    head = '<th class="ra">Stops</th><th class="l">Stationary times</th><th class="ra">Time in pit lane</th>';
    body = cars.map(c => { const P = c.pitLog || []; return row(c, `<td class="ra">${P.length || '--'}</td><td class="l">${P.length ? P.map(p => `<span class="gps-ps ${p.svc === fast ? 'pu' : ''}" title="Lap ${p.lap} → ${TYRES[p.comp] ? TYRES[p.comp].name : ''}">L${p.lap} ${p.svc.toFixed(1)}s</span>`).join(' ') : '--'}</td><td class="ra">${P.length ? P.reduce((a, p) => a + p.lane, 0).toFixed(1) + 's' : '--'}</td>`); }).join('');
  }
  return `<div class="dkx-mod gps-mod"><div class="dkx-hd"><div><h2>${title}</h2><div class="dk-mut">Wheel/Up-Down scroll, click outside to close</div></div><span class="sp"></span><button class="dkx-x" data-a="hxclose">✕</button></div>
  <div class="gps-tabs">${tabs.map(([k, v]) => `<button class="${GPSV.tab === k ? 'on' : ''}" data-a="gpstab" data-v="${k}">${v}</button>`).join('')}</div>
  <div class="gps-body"><table class="gps-t"><thead><tr><th class="l">Driver</th><th class="l">Team</th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}
A.gpstab = el => { GPSV.tab = el.dataset.v; const h = gpsModal(); if (h) hxOpen(h); };
const _ui2_dkmodal = A.dkmodal;
A.dkmodal = function (el) {
  const v = el.dataset.v;
  if (v === 'weather') { const h = wxModal(); if (h) { hxOpen(h); return; } }
  if (v === 'gps' || v === 'trap') { GPSV.tab = 'trap'; const h = gpsModal(); if (h) { hxOpen(h); return; } }
  return _ui2_dkmodal.apply(this, arguments);
};
// click outside / Esc closes these overlays
document.addEventListener('click', e => { const ov = document.getElementById('dkx-ov'); if (ov && e.target === ov) hxClose(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('dkx-ov')) hxClose(); });

// ---------- Driver profile ----------
const DPV = { rel: 'd' };
function dpCareer(id) {
  const i = hxIdx(id), rows = [], S = G.hxStart || G.startYear || G.year;
  if (i >= 0) (HX.ds[i] || []).forEach(r => {
    if (r[0] >= S) return;
    const Y = HIST.years[r[0]], row = Y && Y.drivers.find(x => x[0] === i), tm = row && HIST.teams[row[1]] ? HIST.teams[row[1]][0] : '';
    rows.push({ y: r[0], team: tm, r: r[1], pts: r[8], pos: dpRealPos(r[0], i), w: r[2], real: true });
  });
  (G.history || []).forEach(h => { const k = h.driverTable ? h.driverTable.findIndex(x => x.name === (G.drivers[id] || {}).name) : -1; if (k >= 0) { const x = h.driverTable[k]; rows.push({ y: h.year, team: G.teams[x.team] ? G.teams[x.team].name : '', r: null, pts: x.pts, pos: k + 1 }); } });
  const d = G.drivers[id];
  if (d && G.results.length) { const ds = standingsDrivers(G), p = ds.findIndex(x => x.id === id) + 1, r = G.results.filter(s => s.rows.some(x => x.id === id)).length; if (r) rows.push({ y: G.year, team: d.team && G.teams[d.team] ? G.teams[d.team].name : '', r, pts: d.pts, pos: p || null, cur: true }); }
  return rows.sort((a, b) => b.y - a.y);
}
const DP_POS = {};
function dpRealPos(y, i) {
  if (!DP_POS[y]) { const L = []; Object.entries(HX.ds).forEach(([j, rs]) => { j = +j; const r = (rs || []).find(x => x[0] === y); if (r) L.push([j, r[8], r[2]]); }); L.sort((a, b) => b[1] - a[1] || b[2] - a[2]); DP_POS[y] = new Map(L.map((x, k) => [x[0], k + 1])); }
  return DP_POS[y].get(i) || null;
}
function dpTraits(d) {
  const T = [];
  if (d.pace >= 92) T.push(['⚡', 'Raw Speed']); if (d.craft >= 90) T.push(['🥊', 'Racecraft Master']); else if (d.craft >= 86) T.push(['↗️', 'Overtaker']);
  if (d.cons >= 90) T.push(['🎯', 'Metronome']); if (d.wet >= 90) T.push(['🌧️', 'Rain Master']); if (d.tyre >= 90) T.push(['🛞', 'Tyre Whisperer']);
  if (d.pace < 84 && d.cons >= 86) T.push(['🧮', 'Points Collector']); if (d.age >= 34) T.push(['🧓', 'Old Hand']); if (d.pot > 0 && d.age <= 24) T.push(['🌱', 'High Potential']);
  if (d.cons < 80) T.push(['🎲', 'Wild Card']); if (!T.length) T.push(['🤝', 'Team Player']);
  return T.slice(0, 4);
}
function dpStage(d, starts) { return d.age <= 22 && starts < 25 ? 'Rookie' : d.age <= 25 ? 'Young Talent' : d.age <= 31 ? 'In His Prime' : d.age <= 35 ? (starts < 60 ? 'Late Bloomer' : 'Experienced') : starts < 60 ? 'Inexperienced Old Racer' : 'Veteran'; }
function dpMorale(d) {
  const R = G.results.slice(-3).map(s => s.rows.find(x => x.id === d.id)).filter(Boolean); if (!R.length) return 'Stable';
  const dnf = R.filter(r => r.out).length, pts = R.reduce((a, r) => a + r.pts, 0), win = R.some(r => r.pos === 1 && !r.out);
  return win || pts >= 30 ? 'High' : dnf >= 2 || (pts === 0 && R.length === 3) ? 'Low' : 'Stable';
}
function dpRelations(d) {
  const S = G.story && G.story.y === G.year ? G.story : null;
  const others = Object.values(G.drivers).filter(o => o.team && o.id !== d.id);
  const sc = o => { let v = 50; if (o.team === d.team) v += 8; if (o.nat === d.nat) v += 4;
    const r = S && S.riv[stPair(d.id, o.id)]; if (r) { v += Math.min(8, r.battles) - r.clashes * 12 - Math.min(14, r.passes * 0.5) - r.close; }
    return Math.max(0, Math.min(100, Math.round(v))); };
  const dl = others.map(o => ({ o, v: sc(o) }));
  const career = dpCareer(d.id), past = new Set(career.map(c => c.team));
  const tl = Object.values(G.teams).map(t => { let v = 50; if (t.id === d.team) v += dpMorale(d) === 'High' ? 25 : dpMorale(d) === 'Low' ? 5 : 15; else if (past.has(t.name)) v += 8;
    const S2 = S ? Object.values(S.riv).filter(r => (r.a === d.id || r.b === d.id) && r.clashes) : []; S2.forEach(r => { const o = G.drivers[r.a === d.id ? r.b : r.a]; if (o && o.team === t.id) v -= 6 * r.clashes; });
    return { t, v: Math.max(0, Math.min(100, v)) }; });
  return { dl, tl };
}
hxDriverProfile = function (id) {
  hxInitStats(G);
  const d = G.drivers[id], i = hxIdx(id), P = i >= 0 ? HX.prof[i] : null, H = i >= 0 ? HIST.drivers[i] : null;
  const name = d ? d.name : H ? H[1] : id, tm = d && G.teams[d.team || d.hteam], col = tm ? tm.color : '#3b82f6';
  const tot = hxTotal('d', id, G), real = hxReal('d', id, G), game = hxGame('d', id, G);
  const now = [G.year, 7, 1];
  const left = [];
  if (d) {
    const ini = name.split(' ').map(x => x[0]).slice(0, 2).join('');
    const bars = [['Pace', d.pace], ['Racecraft', d.craft], ['Consistency', d.cons], ['Wet Weather', d.wet], ['Tyre Management', d.tyre]];
    const s = seeded('style' + id), bal = Math.max(8, Math.min(92, 50 + (s() - 0.5) * 60 + (d.craft - 85))), trac = Math.max(8, Math.min(92, 40 + (d.tyre - 80) * 2 + (s() - 0.5) * 20));
    left.push(`<div class="dp-top"><div class="dp-port" style="--tc:${col}"><span>${esc(ini)}</span><small>${d.num ? '#' + d.num : ''}</small></div><div class="dp-ovr">${Math.round(overall(d))}<small>OVR</small></div>
      <div class="dp-stats"><div class="dp-sh">STATS</div>${bars.map(([k, v]) => `<div class="dp-bar"><span>${k}</span><i><b style="width:${Math.max(4, Math.min(100, (v - 50) * 2))}%"></b></i><em>${v}</em></div>`).join('')}</div></div>`);
    const starts = tot.st || 0;
    const info = [['Nationality', `${dkFlag(d.nat)} ${esc(d.nat)}`], ['Age', d.age], ['Career Stage', dpStage(d, starts)], ['Morale', dpMorale(d)]];
    if (P && P[1]) info.push(['Born', `${hxDate(P[1])}${P[2] ? ', ' + esc(P[2]) : ''}`]);
    if (P && P[5]) info.push(['Permanent number', '#' + esc(P[5])]);
    if (tm) info.push(['Team', `<a data-tprof="${tm.id}">${esc(tm.name)}</a>`]);
    if (d.until) info.push(['Contract until', d.until]);
    left.push(`<div class="dp-info">${info.map(([a, b]) => `<div><span>${a}:</span> <b>${b}</b></div>`).join('')}</div>`);
    left.push(`<div class="dp-sec">TRAITS &amp; PERSONALITY</div>${dpTraits(d).map(([ic, t]) => `<div class="dp-trait"><span>${ic}</span>${t}</div>`).join('')}`);
    left.push(`<div class="dp-sec">DRIVING STYLE</div><div class="dp-sl"><b>Balance</b><div class="dp-sll"><span>Understeer</span><span>Oversteer</span></div><i><u style="left:${bal}%"></u></i></div><div class="dp-sl"><b>Traction</b><div class="dp-sll"><span>Rear-Limited</span><span>Strong Traction</span></div><i><u style="left:${trac}%"></u></i></div>`);
  } else {
    const info = [];
    if (P && P[1]) info.push(['Born', `${hxDate(P[1])}${P[2] ? ', ' + esc(P[2]) : ''} ${P[3] ? dkFlag(P[3]) : ''}`]);
    if (P && P[4]) info.push(['Died', `${hxDate(P[4])} (aged ${hxAge(P[1], P[4].split('-').map(Number))})`]);
    left.push(`<div class="dp-info">${info.map(([a, b]) => `<div><span>${a}:</span> <b>${b}</b></div>`).join('') || '<div class="dk-mut">Not on the grid this season.</div>'}</div>`);
  }
  if (P && P[6] && P[6].length) left.push(`<div class="dp-sec">FAMILY</div><div class="dp-info">${P[6].map(([j, t]) => `<div>${(HX_FAM[t] || [t.toLowerCase().replace(/_/g, ' ') + ' of'])[0]} <a data-prof="${HIST.drivers[j][0]}">${esc(HIST.drivers[j][1])}</a></div>`).join('')}</div>`);
  // right: career history + relationships
  const car = dpCareer(id), best = car.filter(r => r.pos).sort((a, b) => a.pos - b.pos)[0];
  const hist = `<table class="dp-ch"><thead><tr><th>Year</th><th class="l">Team</th><th>R</th><th>Pts</th><th>Pos</th></tr></thead><tbody>${car.length ? car.map(r => `<tr class="${r.cur ? 'cur' : ''}"><td>${r.y}</td><td class="l">${esc(r.team)}</td><td>${r.r != null ? r.r : '—'}</td><td>${fmtN(r.pts)}</td><td>${r.pos ? 'P' + r.pos : '—'}</td></tr>`).join('') : '<tr><td colspan="5" class="dk-mut">No history recorded yet.</td></tr>'}</tbody></table>
    <div class="dp-tot">Totals: <b>${tot.st || 0}</b> races | <b>${fmtN(tot.pts || 0)}</b> pts | <b>${tot.w || 0}</b> W | <b>${tot.pod || 0}</b> P | <b>${tot.p || 0}</b> Poles${tot.t ? ` | <b>${tot.t}</b> 🏆` : ''}<br>Best finish: <b>${best ? `P${best.pos} (${best.y})` : 'N/A'}</b></div>`;
  let rel = '';
  if (d && d.team) {
    const R = dpRelations(d), L = DPV.rel === 'd' ? R.dl.map(x => ({ k: x.o.id, nm: x.o.name, fl: dkFlag(x.o.nat), v: x.v, a: `data-prof="${x.o.id}"` })) : R.tl.map(x => ({ k: x.t.id, nm: x.t.name, fl: `<i class="dp-sw" style="background:${x.t.color}"></i>`, v: x.v, a: `data-tprof="${x.t.id}"` }));
    const top = L.slice().sort((a, b) => b.v - a.v || a.nm.localeCompare(b.nm)).slice(0, 7), bot = L.slice().sort((a, b) => a.v - b.v || a.nm.localeCompare(b.nm)).slice(0, 7);
    const li = x => `<div class="dp-rel"><span>${x.fl} <a ${x.a}>${esc(x.nm)}</a></span><b class="${x.v >= 60 ? 'g' : x.v <= 40 ? 'r' : ''}">${x.v}</b></div>`;
    rel = `<section class="dp-card"><div class="dp-ct">Relationships</div><div class="dp-rtabs"><button class="${DPV.rel === 'd' ? 'on' : ''}" data-a="dprel" data-v="d" data-id="${id}">Driver Relationships</button><button class="${DPV.rel === 't' ? 'on' : ''}" data-a="dprel" data-v="t" data-id="${id}">Team Relationships</button></div>
      <div class="dp-rcols"><div><div class="dp-rh g">TOP 7</div>${top.map(li).join('')}</div><div><div class="dp-rh r">BOTTOM 7</div>${bot.map(li).join('')}</div></div>
      <div class="dk-mut dp-rnote">50 = neutral. Team-mates, fair fights and shared nationality build respect; collisions and repeated overtakes wear it down.</div></section>`;
  }
  const records = `<section class="dp-card"><div class="dp-ct">Records</div>${hxStatTable([['st', 'Grand Prix starts'], ['w', 'Wins'], ['p', 'Pole positions'], ['pod', 'Podiums'], ['fl', 'Fastest laps'], ['gs', 'Grand slams'], ['t', 'World titles']], real, game, tot, G.hxStart)}${hxNext(tot, HX_MS, HX_MSN)}</section>`;
  return `<div class="dkx-mod dp-mod" style="--tc:${col}"><div class="dp-hd"><h2>Driver Profile - ${esc(name)}</h2><span class="sp"></span><button data-a="hxclose">Back</button></div>
    <div class="dp-grid"><section class="dp-card dp-left"><div class="dp-ct">Driver Profile</div>${left.join('')}</section>
    <div class="dp-right"><section class="dp-card"><div class="dp-ct">Career History</div>${hist}</section>${rel}${records}</div></div></div>`;
};
A.dprel = el => { DPV.rel = el.dataset.v; hxOpen(hxDriverProfile(el.dataset.id)); };

// ---------- Live championship standings (race) ----------
const LCS = { open: false, lap: -1 };
function lcsProject() {
  const R = RACE, sprint = R.sprint, ord = R.order(), PT = sprint ? ((G.rules && G.rules.sprintPts) || SPRINT_POINTS) : ((G.rules && G.rules.points) || POINTS);
  const fl = !sprint && G.rules ? G.rules.fl : null, add = {};
  const running = ord.filter(c => !c.out && !c.parked);
  const H = !sprint && R.heat && WK.heat;
  if (H && !(G.regs && G.regs.heatpts === 'standard')) {
    // three-part GP: points banked from the finished races + this race in its current order
    H.parts.forEach(p => p.rows.forEach(r => { add[r.e.d.id] = (add[r.e.d.id] || 0) + heatPts(p.k, r.pos, r.out); }));
    running.forEach((c, i) => { add[c.d.id] = (add[c.d.id] || 0) + heatPts(R.heat, i + 1, false); });
  } else if (!H || R.heat === 3) running.forEach((c, i) => { if (i < PT.length) add[c.d.id] = (add[c.d.id] || 0) + PT[i]; });
  if (fl && R.fastest && !R.fastest.c.out) { const p = running.indexOf(R.fastest.c); if (p >= 0 && (fl === 'any' || p < 10)) add[R.fastest.c.d.id] = (add[R.fastest.c.d.id] || 0) + 1; }
  if (!sprint && typeof expInfo === 'function') { const E = expInfo(); if (E && expHalf(E, G.round)) Object.keys(add).forEach(k => add[k] /= 2); }
  if (!sprint && typeof potLive === 'function') { const pa = potLive(R, running); if (pa) { Object.keys(add).forEach(k => delete add[k]); Object.assign(add, pa); } }
  const ds0 = standingsDrivers(G).filter(d => d.team || d.pts > 0), pre = new Map(ds0.map((d, i) => [d.id, i]));
  const drv = ds0.map(d => ({ d, pts: d.pts + (add[d.id] || 0), gain: add[d.id] || 0 })).sort((a, b) => b.pts - a.pts || pre.get(a.d.id) - pre.get(b.d.id));
  const ts0 = standingsTeams(G), preT = new Map(ts0.map((t, i) => [t.id, i])), tadd = {};
  R.cars.forEach(c => { if (add[c.d.id]) tadd[c.t.id] = (tadd[c.t.id] || 0) + add[c.d.id]; });
  const tms = ts0.map(t => ({ t, pts: t.pts + (tadd[t.id] || 0), gain: tadd[t.id] || 0 })).sort((a, b) => b.pts - a.pts || preT.get(a.t.id) - preT.get(b.t.id));
  return { drv: drv.map((x, i) => Object.assign(x, { mv: pre.get(x.d.id) - i })), tms: tms.map((x, i) => Object.assign(x, { mv: preT.get(x.t.id) - i })) };
}
function lcsHtml() {
  const R = RACE, P = lcsProject(), lead = R.order().find(c => !c.out && !c.parked), lap = lead ? Math.min(R.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
  const n = v => Number.isInteger(v) ? v : v.toFixed(1);
  const mv = m => m > 0 ? `<b class="lcs-up">▲ +${m}</b>` : m < 0 ? `<b class="lcs-dn">▼ ${m}</b>` : '<span class="dk-mut">–</span>';
  const me = (id, tid) => (G.player ? tid === G.player : id === G.follow) ? 'me' : '';
  const dr = P.drv.map((x, i) => { const tm = G.teams[x.d.team]; return `<tr class="${me(x.d.id, x.d.team)}"><td>${i + 1}</td><td class="l"><i class="lcs-sw" style="background:${tm ? tm.color : '#555'}"></i>${dkFlag(x.d.nat)} <a data-prof="${x.d.id}">${esc(x.d.name)}</a></td><td class="ra">${n(x.pts)}${x.gain ? `<small>+${n(x.gain)}</small>` : ''}</td><td class="ra">${mv(x.mv)}</td></tr>`; }).join('');
  const tr = P.tms.map((x, i) => `<tr class="${G.player === x.t.id ? 'me' : ''}"><td>${i + 1}</td><td class="l"><i class="lcs-sw" style="background:${x.t.color}"></i><a data-tprof="${x.t.id}">${esc(x.t.full || x.t.name)}</a></td><td class="ra">${n(x.pts)}${x.gain ? `<small>+${n(x.gain)}</small>` : ''}</td><td class="ra">${mv(x.mv)}</td></tr>`).join('');
  const what = R.sprint ? 'If the sprint finished in the current order' : R.heat && R.heat < 3 ? `Race ${R.heat} of 3 · points as they stand` : 'If the race finished in the current order';
  return `<div class="dkx-mod lcs-mod" id="lcsmod"><div class="dkx-hd"><div><h2>🏆 LIVE CHAMPIONSHIP STANDINGS</h2><div class="dk-mut lcs-sub">${what} &nbsp;|&nbsp; Lap ${lap}/${R.laps}</div></div><span class="sp"></span><button class="dkx-x" data-a="lcsclose">✕</button></div>
    <div class="lcs-grid"><section><div class="lcs-h">🪖 DRIVERS</div><div class="lcs-scroll"><table class="lcs-t"><thead><tr><th>#</th><th class="l">Driver</th><th class="ra">Pts</th><th class="ra">Δ</th></tr></thead><tbody>${dr}</tbody></table></div></section>
    <section><div class="lcs-h">👥 CONSTRUCTORS</div><div class="lcs-scroll"><table class="lcs-t"><thead><tr><th>#</th><th class="l">Team</th><th class="ra">Pts</th><th class="ra">Δ</th></tr></thead><tbody>${tr}</tbody></table></div></section></div>
    <div class="lcs-foot"><span class="dk-mut">${PAUSED ? 'Race paused' : 'Updates every lap'} &nbsp;|&nbsp; Δ versus pre-race standings · small numbers = points from this race</span><span class="sp"></span><button data-a="lcsclose">✕ Close <kbd>Esc</kbd></button></div></div>`;
}
function lcsShow() { LCS.open = true; LCS.lap = -1; hxOpen(lcsHtml()); }
A.lcsopen = () => { if (dkStage() === 'race' && RACE) lcsShow(); };
A.lcsclose = () => { LCS.open = false; hxClose(); };
const _lcs_dkUpdate = dkUpdate;
dkUpdate = function () {
  const r = _lcs_dkUpdate.apply(this, arguments);
  try {
    if (LCS.open) {
      const m = document.getElementById('lcsmod');
      if (!m || dkStage() !== 'race' || !RACE) { LCS.open = false; }
      else { const lead = RACE.order().find(c => !c.out && !c.parked), lap = (lead ? lead.laps : 0) + ':' + PAUSED + ':' + (RACE.heat || 0);
        if (lap !== LCS.lap) { LCS.lap = lap; const ov = document.getElementById('dkx-ov'), sc = [...m.querySelectorAll('.lcs-scroll')].map(x => x.scrollTop); if (ov) { ov.innerHTML = lcsHtml(); [...ov.querySelectorAll('.lcs-scroll')].forEach((x, i) => x.scrollTop = sc[i] || 0); } } }
    }
  } catch (e) { }
  return r;
};
const _lcs_deskLive = deskLive;
deskLive = function (kind) {
  const html = _lcs_deskLive.apply(this, arguments);
  if (kind !== 'race') return html;
  return html.replace('<button class="ico" data-a="dkmodal" data-v="settings"', '<button class="ico" data-a="lcsopen" title="Live championship standings">🏆</button><button class="ico" data-a="dkmodal" data-v="settings"');
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') LCS.open = false; });
document.addEventListener('click', e => { if (e.target && e.target.id === 'dkx-ov') LCS.open = false; });

// ---------- leave a live session for the main menu (it is checkpointed; Continue resumes it) ----------
A.dkhome = function () {
  PAUSED = true;
  try { wkCheckpoint(); } catch (e) { }
  try { if (G) save(G); } catch (e) { }
  cancelAnimationFrame(raf);
  try { closeModal(); } catch (e) { }
  try { hxClose(); } catch (e) { }
  WK = null; RACE = null; VIEW = 'title';
  document.body.classList.remove('dk-on');
  render(); window.scrollTo(0, 0);
};

// ---------- Team profile ("Team List" browser) ----------
const TPV = { cur: null };
const TP_POS = {};
function tpRealPos(y, cid) {
  if (!TP_POS[y]) { const L = []; Object.entries(HX.tp).forEach(([c, T]) => { const r = (T[3] || []).find(x => x[0] === y); if (r) L.push([c, r[8], r[2]]); }); L.sort((a, b) => b[1] - a[1] || b[2] - a[2]); TP_POS[y] = new Map(L.map((x, k) => [x[0], k + 1])); }
  return TP_POS[y].get(cid) || null;
}
function tpSeasons(tid) {
  const cid = hxCid(G, tid), T = HX.tp[cid], S = G.hxStart || hxStart(G), rows = [];
  (T ? T[3] : []).forEach(r => { if (r[0] < S) rows.push({ y: r[0], w: r[2], pod: r[4], pts: r[8], pos: r[7] ? 1 : tpRealPos(r[0], cid) }); });
  (G.history || []).forEach(h => { const k = (h.teamTable || []).findIndex(x => x.id === tid); if (k >= 0) rows.push({ y: h.year, w: null, pod: null, pts: h.teamTable[k].pts, pos: k + 1 }); });
  if (G.teams[tid] && G.results.length) {
    let w = 0, pod = 0; G.results.forEach(s => s.rows.forEach(r => { if (r.team === tid && !r.out) { if (r.pos === 1) w++; if (r.pos <= 3) pod++; } }));
    rows.push({ y: G.year, w, pod, pts: G.teams[tid].pts, pos: standingsTeams(G).findIndex(t => t.id === tid) + 1, cur: true });
  }
  return rows.sort((a, b) => b.y - a.y);
}
function tpPerf(t) { return t.aero * 0.4 + teamPower(G, t) * 0.35 + t.chassis * 0.25; }
hxTeamProfile = function (tid) {
  hxInitStats(G);
  const tm = G.teams[tid], cid = hxCid(G, tid), T = HX.tp[cid];
  const name = tm ? (tm.full || tm.name) : T ? T[0] : tid, col = tm ? tm.color : '#3b82f6';
  const real = hxReal('t', tid, G), game = hxGame('t', tid, G), tot = hxTotal('t', tid, G);
  const teams = Object.values(G.teams), perfMax = Math.max(...teams.map(tpPerf)), perfMin = Math.min(...teams.map(tpPerf));
  const flagOf = t => { const X = HX.tp[hxCid(G, t.id)]; return X && X[1] ? dkFlag(X[1]) : ''; };
  const list = teams.slice().sort((a, b) => tpPerf(b) - tpPerf(a)).map(t => `<div class="tp-li ${t.id === tid ? 'on' : ''}" data-tprof="${t.id}" style="--tc:${t.color}"><div class="tp-ln"><i class="tp-sw"></i><b>${esc(t.full || t.name)}</b> ${flagOf(t)}</div><div class="tp-lb"><i style="width:${Math.round(30 + 70 * (tpPerf(t) - perfMin) / Math.max(1, perfMax - perfMin))}%"></i></div></div>`).join('');
  let body = '';
  if (tm) {
    const pace = teams.slice().sort((a, b) => tpPerf(b) - tpPerf(a)).findIndex(t => t.id === tid) + 1, pos = standingsTeams(G).findIndex(t => t.id === tid) + 1;
    const car = hxCar(G, tid), eng = G.engines[tm.engine] || {}, works = tm.works;
    const drivers = Object.values(G.drivers).filter(d => d.team === tid);
    const first = T && T[3] && T[3].length ? T[3][0][0] : null, seasons = T ? T[3].filter(r => r[0] < (G.hxStart || G.year)).length + (G.history || []).length + 1 : null;
    const bar = (k, v) => `<div class="tp-bar"><span>${k} <em>${Math.round(v)}/100</em></span><i>${[...Array(10)].map((_, j) => `<b class="${j < Math.round((v - 50) / 5) ? 'on' : ''}"></b>`).join('')}</i></div>`;
    body = `<div class="tp-top" style="background:${col};color:${dkInk(col)}"><b>${esc(name)}</b> ${T && T[1] ? dkFlag(T[1]) : ''}<span class="sp"></span><span class="tp-badge">PACE ${pace}/${teams.length}</span>${pos && G.results.length ? `<span class="tp-badge">POS ${pos}</span>` : ''}</div>
    <section class="tp-card tp-team"><div class="tp-mono" style="--tc:${col}">${esc((tm.name || '').split(' ').map(x => x[0]).slice(0, 2).join(''))}</div><div class="tp-tinfo"><div class="tp-k">CONSTRUCTOR</div><b class="tp-big">${esc(T ? T[0] : tm.name)}</b><div class="dk-mut">${first ? `First Grand Prix season ${first}` : 'New team'}${seasons ? ` · ${seasons} season${seasons === 1 ? '' : 's'}` : ''}${T && T[1] ? ` · ${esc(T[1])}` : ''}</div>
      <div class="tp-bars">${bar('Aero', tm.aero)}${bar('Chassis', tm.chassis)}${bar('Power', teamPower(G, tm))}${bar('Reliability', teamRel(G, tm))}</div></div></section>
    <section class="tp-card"><div class="tp-ct">Car &amp; Suppliers</div><div class="tp-kv2">
      <div><span>Registered Entries:</span> <b>${drivers.length}</b></div><div><span>Engine:</span> <b>${esc((car && car[1]) || eng.name || '')}</b></div>
      <div><span>Current Car:</span> <b>${esc((car && car[0]) || '—')} (${G.lineYear || G.year})</b></div><div><span>Power Unit:</span> <b>${esc(eng.name || dkEngine(tm))} (${works ? 'Works' : 'Customer'})</b></div>
      <div><span>Entrant:</span> <b>${esc(tm.full || tm.name)}</b></div><div><span>Tyres:</span> <b>${esc((car && car[2]) || '—')}</b></div></div></section>
    <div class="tp-row2"><section class="tp-card"><div class="tp-ct">Drivers</div><table class="tp-dt"><thead><tr><th class="l">Name</th><th>OVR</th><th>Contract</th></tr></thead><tbody>${drivers.map(d => `<tr><td class="l">${dkFlag(d.nat)} <a data-prof="${d.id}">${esc(d.name)}</a><div class="dk-mut">Race Driver · ${fmtN(d.pts)} pts</div></td><td>${Math.round(overall(d))}</td><td>${d.until || '—'}</td></tr>`).join('')}</tbody></table></section>
    <section class="tp-card"><div class="tp-ct">All-Time Record</div>${hxStatTable([['st', 'Grands Prix'], ['w', 'Wins'], ['p', 'Poles'], ['pod', 'Podiums'], ['fl', 'Fastest laps'], ['one2', 'One-twos'], ['t', "Constructors' titles"]], real, game, tot, G.hxStart)}</section></div>
    ${T && T[2] && T[2].length > 1 ? `<section class="tp-card"><div class="tp-ct">Lineage</div><div class="dkx-lin">${T[2].map(([c, a, b]) => { const n = HX.tp[c] ? HX.tp[c][0] : (HIST.teams[c] || [c])[0]; return `<span class="${c === cid ? 'on' : ''}"><b>${esc(n)}</b><small>${a}–${b == null ? 'today' : b}</small></span>`; }).join('<i>→</i>')}</div></section>` : ''}`;
  } else {
    body = `<div class="tp-top" style="background:${col}"><b>${esc(name)}</b> ${T && T[1] ? dkFlag(T[1]) : ''}</div><section class="tp-card"><div class="tp-ct">All-Time Record</div>${hxStatTable([['st', 'Grands Prix'], ['w', 'Wins'], ['p', 'Poles'], ['pod', 'Podiums'], ['fl', 'Fastest laps'], ['one2', 'One-twos'], ['t', "Constructors' titles"]], real, game, tot, G.hxStart)}</section>`;
  }
  const S = tpSeasons(tid), tw = S.reduce((a, r) => a + (r.w || 0), 0), tpd = S.reduce((a, r) => a + (r.pod || 0), 0), tpt = S.reduce((a, r) => a + (r.pts || 0), 0);
  const hist = `<div class="tp-hist"><table><thead><tr><th>Year</th><th>Wins</th><th>Pod</th><th>Points</th><th>Pos</th></tr></thead><tbody>${S.map(r => `<tr class="${r.cur ? 'cur' : ''}"><td>${r.y}${r.cur ? '*' : ''}</td><td>${r.w ?? '—'}</td><td>${r.pod ?? '—'}</td><td>${fmtN(r.pts)}</td><td class="${r.pos === 1 ? 'gold' : ''}">${r.pos || '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="dk-mut">No seasons yet</td></tr>'}</tbody></table>
    <div class="tp-tot"><span>Total</span><span>${tw}</span><span>${tpd}</span><span>${fmtN(Math.round(tpt * 10) / 10)}</span><span></span></div></div>`;
  TPV.cur = tid;
  return `<div class="tp-mod" id="tpmod"><div class="tp-hd"><div><h2>Team List</h2><div class="dk-mut">Click or use ↑/↓ to browse teams • ESC to return</div></div><button data-a="hxclose">Back</button></div>
    <div class="tp-grid"><div class="tp-list">${list}</div><div class="tp-main">${body}</div>${hist}</div></div>`;
};
document.addEventListener('keydown', e => {
  if (!document.getElementById('tpmod') || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
  const ids = [...document.querySelectorAll('.tp-li')].map(x => x.dataset.tprof), i = ids.indexOf(TPV.cur);
  const n = ids[(i + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length]; if (n) { e.preventDefault(); hxOpen(hxTeamProfile(n)); }
});
