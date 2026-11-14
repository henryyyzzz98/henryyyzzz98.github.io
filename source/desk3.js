// ===================== Calendar preview, custom regulations, season archive =====================
const DK3 = { sel: null, ph: 'race', th: 'race', season: null };
const GP_ADJ = { Australia: 'Australian', China: 'Chinese', Japan: 'Japanese', 'Saudi Arabia': 'Saudi Arabian', Canada: 'Canadian', Spain: 'Spanish', Austria: 'Austrian', Britain: 'British', 'Great Britain': 'British', Belgium: 'Belgian', Hungary: 'Hungarian', Netherlands: 'Dutch', Italy: 'Italian', Mexico: 'Mexico City', Brazil: 'São Paulo', France: 'French', Germany: 'German', Portugal: 'Portuguese', Turkey: 'Turkish', Malaysia: 'Malaysian', Korea: 'Korean', India: 'Indian', Russia: 'Russian', Argentina: 'Argentine', Sweden: 'Swedish', Switzerland: 'Swiss', Morocco: 'Moroccan', 'South Africa': 'South African', Europe: 'European', Madrid: 'Spanish', Barcelona: 'Barcelona-Catalunya' };
function dkGpName(G0, i, t) { const ci = G0.calInfo && G0.calInfo[i]; const nm = ci && ci.gp || t.short; return /grand prix/i.test(nm) ? nm : (GP_ADJ[nm] || nm) + ' Grand Prix'; }

// ---------- per-circuit records (kept across seasons) ----------
function dkTrackRec(G0, race, wk) {
  try {
    const s = G0.results[G0.results.length - 1]; if (!s) return;
    G0.trackRec = G0.trackRec || {}; const L = G0.trackRec[s.track] = G0.trackRec[s.track] || [];
    const tm = id => { const t = G0.teams[id]; return t ? [t.name, t.color] : ['', '#888']; };
    const win = s.rows.find(r => !r.out && r.pos === 1), pole = wk.grid && wk.grid[0];
    const mineRow = s.rows.filter(r => G0.player ? r.team === G0.player : r.id === G0.follow).sort((a, b) => (a.out ? 99 : a.pos) - (b.out ? 99 : b.pos))[0];
    const myQ = (wk.grid || []).findIndex(e => G0.player ? e.t.id === G0.player : e.d.id === G0.follow);
    let fl = null; if (race && race.fastest) fl = [+race.fastest.t.toFixed(3), race.fastest.c.d.name, race.fastest.c.t.id, ...tm(race.fastest.c.t.id)];
    L.push({ y: G0.year, w: win ? [win.name, win.team, ...tm(win.team)] : null, p: pole ? [pole.d.name, pole.t.id, ...tm(pole.t.id)] : null, fl,
      me: G0.player || G0.follow ? { r: mineRow ? (mineRow.out ? 'DNF' : 'P' + mineRow.pos) : null, q: myQ >= 0 ? 'P' + (myQ + 1) : null, team: G0.player ? tm(G0.player)[0] : '' } : null });
    if (L.length > 40) L.splice(0, L.length - 40);
  } catch (e) { }
}

// ---------- season archive (for the standings history tables) ----------
function dkSid(G0) { if (!G0.sid) G0.sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); return G0.sid; }
function dkArchiveSeason(G0) {
  try {
    const eng = t => { const e = G0.engines[t.engine]; const owner = Object.values(G0.teams).find(x => x.works && x.engine === t.engine) || t; return [e ? e.name : '', owner.color]; };
    const pack = r => [r.id, r.team, r.pos || 0, r.out ? 1 : 0, r.pts || 0, r.grid || 0, r.code || ''];
    const ids = new Set(); G0.results.forEach(r => r.rows.forEach(x => ids.add(x.id)));
    standingsDrivers(G0).forEach(d => ids.add(d.id));
    const A0 = { year: G0.year, n: G0.cal.length, cal: G0.cal.map((id, i) => { const t = roundTrack(G0, i); return [t.short, t.cc]; }),
      res: G0.results.map(r => ({ r: r.rows.map(pack), s: r.sprint ? r.sprint.map(pack) : null, f: r.fastest ? r.fastest.code : null })),
      d: Object.fromEntries([...ids].filter(id => G0.drivers[id]).map(id => { const d = G0.drivers[id]; return [id, [d.name, d.nat, d.code, d.team, d.pts]]; })),
      t: Object.fromEntries(Object.values(G0.teams).map(t => [t.id, [t.name, t.color, ...eng(t), t.pts]])) };
    localStorage.setItem('pitwall_hist_' + dkSid(G0) + '_' + G0.year, JSON.stringify(A0));
    G0.histYears = G0.histYears || []; if (!G0.histYears.includes(G0.year)) G0.histYears.push(G0.year);
  } catch (e) { }
}
function dkLoadSeason(y) { try { return JSON.parse(localStorage.getItem('pitwall_hist_' + G.sid + '_' + y)); } catch (e) { return null; } }

// ---------- custom regulations (alternative history) ----------
const DK_PTS = { era: null, p50: [8, 6, 4, 3, 2], p60: [8, 6, 4, 3, 2, 1], p61: [9, 6, 4, 3, 2, 1], p91: [10, 6, 4, 3, 2, 1], p03: [10, 8, 6, 5, 4, 3, 2, 1], p10: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], top15: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] };
const DK_PTS_NAMES = { era: 'Real rules of each season', p50: '1950–59 · 8-6-4-3-2', p60: '1960 · 8-6-4-3-2-1', p61: '1961–90 · 9-6-4-3-2-1', p91: '1991–2002 · 10-6-4-3-2-1', p03: '2003–09 · 10-8-6-5-4-3-2-1', p10: '2010–today · 25-18-15-12-10-8-6-4-2-1', top15: 'Points to 15th · 25-20-16-13-11…1', custom: 'Custom…' };
const DK_REG0 = { pts: 'era', custom: '25,18,15,12,10,8,6,4,2,1', pole: 0, fl: 'era', quali: 'era', drop: 'era' };
function dkRegsActive(r) { return r && (r.pts !== 'era' || r.pole || r.fl !== 'era' || r.quali !== 'era' || r.drop !== 'era'); }
function dkApplyRegs(G0) {
  if (!G0 || !G0.regs || !dkRegsActive(G0.regs)) return;
  const r = G0.regs;
  const base = G0.timeline ? rulesFor(G0.year) : { year: G0.year, points: POINTS, bestN: 0, fl: null, sprintPts: SPRINT_POINTS, twoCompound: true, sc: true, vsc: true, quali: 'knockout', capOn: true, constructors: true, wearMul: 1 };
  if (r.pts === 'custom') { const p = String(r.custom).split(/[^0-9.]+/).map(Number).filter(x => x > 0); if (p.length) base.points = p; }
  else if (DK_PTS[r.pts]) base.points = DK_PTS[r.pts];
  if (r.fl !== 'era') base.fl = r.fl === 'off' ? null : r.fl;
  if (r.quali !== 'era') base.quali = r.quali;
  if (r.drop === 'all') base.bestN = 0;
  base.polePts = +r.pole || 0;
  G0.rules = base;
}
const _dk3_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  dkApplyRegs(G0);
  const out = _dk3_applyRaceResult.apply(this, arguments);
  try { // pole position points
    const pp = G0.rules && G0.rules.polePts, s = G0.results[G0.results.length - 1], pole = wk.grid && wk.grid[0];
    if (pp && s && pole) { const row = s.rows.find(x => x.id === pole.d.id); if (row) { row.pts += pp; row.pole = 1; pole.d.pts += pp; if (pole.d.res && pole.d.res.length) pole.d.res[pole.d.res.length - 1] += pp; if (G0.teams[row.team]) G0.teams[row.team].pts += pp; } }
  } catch (e) { }
  dkTrackRec(G0, race, wk); dkArchiveSeason(G0);
  return out;
};
const _dk3_startWeekend = startWeekend;
startWeekend = function () { dkApplyRegs(G); return _dk3_startWeekend.apply(this, arguments); };
function dkRegsForm(r, act) {
  const sel = (k, opts) => `<select data-dkc="${act}" data-k="${k}" style="width:100%">${opts.map(([v, l]) => `<option value="${v}" ${String(r[k]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<div class="grid g2" style="gap:10px">
  <label class="small">Points system${sel('pts', Object.entries(DK_PTS_NAMES))}</label>
  ${r.pts === 'custom' ? `<label class="small">Points for 1st, 2nd, 3rd… (comma separated)<input data-dkc="${act}" data-k="custom" value="${esc(r.custom)}" style="width:100%"></label>` : '<span></span>'}
  <label class="small">Pole position bonus${sel('pole', [[0, 'No points for pole'], [1, '1 point for pole'], [2, '2 points for pole'], [3, '3 points for pole']])}</label>
  <label class="small">Fastest lap bonus${sel('fl', [['era', 'Real rules of each season'], ['off', 'No fastest-lap point'], ['any', '1 point — any finisher'], ['top10', '1 point — only if in the top 10']])}</label>
  <label class="small">Qualifying format${sel('quali', [['era', 'Real format of each season'], ['single', 'One session — fastest lap takes pole'], ['knockout', 'Knockout — Q1, Q2, Q3']])}</label>
  <label class="small">Dropped scores${sel('drop', [['era', 'Real rules (some old seasons only count best results)'], ['all', 'Every result counts']])}</label></div>`;
}
const _dk3_viewSetup = viewSetup;
viewSetup = function () {
  let html = _dk3_viewSetup(); const S = SETUP;
  if (S.mode === 'spectator') {
    S.regs = S.regs || Object.assign({}, DK_REG0);
    const card = `<div class="card" style="margin-top:12px"><h3>Regulations — alternative history</h3><div class="small mut" style="margin-bottom:8px">Rewrite the rulebook and see how history changes. Leave everything on “real” for the genuine rules of ${S.era === 'hist' ? 'each season' : 'today'}.</div>${dkRegsForm(S.regs, 'dkreg')}</div>`;
    html = html.replace('<div class="row" style="margin:16px 0 40px">', card + '<div class="row" style="margin:16px 0 40px">');
  }
  return html;
};
const _dk3_newGame = newGame; newGame = function (opts) { const g = _dk3_newGame.apply(this, arguments); if (g && g.spectator && SETUP.regs && dkRegsActive(SETUP.regs)) { g.regs = Object.assign({}, SETUP.regs); dkApplyRegs(g); } return g; };
const _dk3_newTL = newTimelineGame; newTimelineGame = function (opts) { const g = _dk3_newTL.apply(this, arguments); if (g && g.spectator && SETUP.regs && dkRegsActive(SETUP.regs)) { g.regs = Object.assign({}, SETUP.regs); dkApplyRegs(g); } return g; };
const _dk3_hqMenu = hqMenu;
hqMenu = function () {
  if (!G.spectator) return _dk3_hqMenu();
  const r = G.regs || Object.assign({}, DK_REG0);
  return _dk3_hqMenu() + `<div class="card" style="margin-top:12px"><h3>Regulations</h3><div class="small mut" style="margin-bottom:8px">Changes apply from the next session onwards. Points already scored stay as they are.</div>${dkRegsForm(r, 'dkreg2')}</div>`;
};

// ---------- calendar: race weekend preview ----------
function dkMix(t) {
  const pr = dkProf(t), g = pr.g; const bins = [0, 0, 0, 0];
  for (let i = 0; i < pr.p.length; i++) { const ds = g.cum[i + 1] - g.cum[i], p = pr.p[i]; bins[p < 0.72 ? 0 : p < 1.0 ? 1 : p < 1.25 ? 2 : 3] += ds; }
  const tot = bins.reduce((a, b) => a + b, 0) || 1; return bins.map(b => Math.round(b / tot * 100));
}
const dkStars = n => { n = clamp(Math.round(n), 1, 5); return `<span class="dkstars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`; };
function deskCalendar() {
  const n = G.cal.length; if (DK3.sel == null || DK3.sel >= n) DK3.sel = Math.min(G.round, n - 1);
  const k = DK3.sel, t = roundTrack(G, k), res = G.results[k], rec = (G.trackRec && G.trackRec[t.id]) || [];
  const list = G.cal.map((id, i) => { const tt = roundTrack(G, i), r = G.results[i];
    return `<div class="dkcl ${i === k ? 'on' : ''} ${i < G.round ? 'done' : ''} ${i === G.round ? 'next' : ''}" data-a="dkcalsel" data-v="${i}"><span class="rn">R${String(i + 1).padStart(2, '0')}</span>${dkFlag(tt.cc)}<span class="nm">${esc(tt.short.toUpperCase())}</span>${isSprintRound(G, i) ? '<span class="spr">⚡</span>' : ''}${r ? `<span class="wn">${esc(r.rows[0].code || '')}</span>` : i === G.round ? '<span class="wn nx">NEXT</span>' : ''}</div>`; }).join('');
  // records at this circuit (our simulated history)
  const best = rec.filter(x => x.fl).sort((a, b) => a.fl[0] - b.fl[0])[0];
  const lastW = rec.filter(x => x.w).slice(-1)[0], lastP = rec.filter(x => x.p).slice(-1)[0];
  const realPrev = G.timeline ? (() => { for (let y = G.year - 1; y >= HIST_FIRST; y--) { const H = HIST.years[y]; const c = H && H.cal.find(c => c[0] === t.id); if (c && c[5] >= 0) return [histDriverName(c[5]), y]; } return null; })() : null;
  const info = [['CIRCUIT LENGTH', `${t.km.toFixed(3)} km`], ['EVENT DISTANCE', `${t.laps} laps · ${(t.km * t.laps).toFixed(1)} km`], ['TURNS', dkTurns(t, k)],
    ['LAP RECORD', best ? `${fmtTime(best.fl[0])} <span class="dk-mut">${esc(best.fl[1])} (${best.y})</span>` : '<span class="dk-mut">—</span>'],
    ['PREVIOUS POLE', lastP ? `<i class="tsw" style="background:${lastP.p[3]}"></i>${esc(lastP.p[0])} (${lastP.y})` : '<span class="dk-mut">—</span>'],
    ['PREVIOUS WINNER', lastW ? `<i class="tsw" style="background:${lastW.w[3]}"></i>${esc(lastW.w[0])} (${lastW.y})` : realPrev ? `📜 ${esc(realPrev[0])} (${realPrev[1]}, real)` : '<span class="dk-mut">—</span>']];
  if (res) info.push(['THIS SEASON', `🏆 ${esc(res.rows[0].name)}`]);
  if (G.timeline && t.realWin >= 0) info.push(['REAL WINNER ' + G.year, `📜 ${esc(histDriverName(t.realWin))}`]);
  const mix = dkMix(t), mixRows = [['Low Speed', mix[0], '#38bdf8'], ['Medium Speed', mix[1], '#38bdf8'], ['High Speed', mix[2], '#3b82f6'], ['Straights', mix[3], '#fbbf24']]
    .map(([l, v, c]) => `<div class="dkc"><span>${l}</span><i><b style="width:${v}%;background:${c}"></b></i><em>${v}%</em></div>`).join('');
  const wear = t.wear * ((G.rules && G.rules.wearMul) || 1), lvl = wear > 0.6 ? 'HIGH' : wear > 0.4 ? 'MEDIUM' : 'LOW', nb = clamp(Math.round(wear * 5 + 0.5), 1, 5);
  const histRows = (which) => { const L = rec.filter(x => which === 'race' ? x.w : x.p).slice().reverse().slice(0, 8);
    const sim = L.map(x => { const v = which === 'race' ? x.w : x.p; return `<div class="dkhr"><b>${x.y}</b><i class="tsw" style="background:${v[3]}"></i><span>${esc(v[0])}</span><em>${esc(v[2])}</em></div>`; }).join('');
    let real = '';
    if (G.timeline && which === 'race') { const out = []; for (let y = G.year - 1; y >= HIST_FIRST && out.length < 6; y--) { const H = HIST.years[y]; const c = H && H.cal.find(c => c[0] === t.id); if (c && c[5] >= 0 && !rec.some(x => x.y === y)) out.push(`<div class="dkhr real"><b>${y}</b><span>📜 ${esc(histDriverName(c[5]))}</span><em>real</em></div>`); } real = out.join(''); }
    return sim + real || `<div class="dk-mut dkhe">No ${which === 'race' ? 'races' : 'qualifying sessions'} here yet.</div>`; };
  const mineRows = (which) => { const L = rec.filter(x => x.me && (which === 'race' ? x.me.r : x.me.q)).slice().reverse().slice(0, 8);
    return L.map(x => `<div class="dkhr"><b>${x.y}</b><span>${which === 'race' ? x.me.r : x.me.q}</span><em>${esc(x.me.team || '')}</em></div>`).join('') || `<div class="dk-mut dkhe">No ${G.player ? 'team' : 'driver'} ${which === 'race' ? 'race' : 'qualifying'} results here yet.</div>`; };
  const who = G.player ? 'YOUR TEAM HISTORY' : G.follow && G.drivers[G.follow] ? `${esc(G.drivers[G.follow].name.toUpperCase())} HISTORY` : 'YOUR DRIVER HISTORY';
  const btns = `${G.timeline ? '' : `${G.round === 0 ? `<button data-a="editcal" data-v="now">Edit this season</button>` : ''}<button data-a="editcal" data-v="next">${G.calNext ? 'Edit' : 'Plan'} next season</button>`}`;
  return `<div class="dk dk-page dk-cal" id="dk"><div class="dk-pagehead"><div><h1>SCHEDULE</h1><div class="dk-mut">RACE WEEKEND PREVIEW</div></div><span class="sp"></span><span class="dk-yr">${G.year} SEASON</span>${btns}<button data-a="tab" data-v="home">Back</button></div>
  <div class="dkc-wrap"><section class="dkc-list"><div class="dk-h"><b>SEASON CALENDAR</b><span class="sp"></span><span class="dk-mut">${n} rounds</span></div><div class="dk-scroll">${list}</div></section>
  <div class="dkc-main">
    <section class="dkc-hero"><div class="dkc-maptitle">${dkFlag(t.cc, 'lg')}<b>${esc(t.name)}</b>${isSprintRound(G, k) ? '<span class="pill" style="background:#f5c518;color:#000">⚡ Sprint</span>' : ''}</div><div class="dkc-mapbox"><canvas id="calmap"></canvas></div><div class="dkc-country">${dkFlag(t.cc)} ${esc(t.short.toUpperCase())}<span class="sp"></span>${res ? `<button class="pri" data-a="dkarch" data-v="${k}">View results ›</button>` : k === G.round ? '<span class="dk-mut">Next race</span>' : ''}</div></section>
    <section class="dkc-info"><h2>${esc(dkGpName(G, k, t).toUpperCase())}</h2><div class="dkc-circ">${dkFlag(t.cc)} ${esc(t.name.toUpperCase())}</div>${info.map(([a, b]) => `<div class="dkc-row"><span>${a}</span><b>${b}</b></div>`).join('')}</section>
    <section class="dkc-mix"><div class="dk-h"><b>TRACK ATTRIBUTE MIX</b></div><div class="dkc-body">${mixRows}</div></section>
    <section class="dkc-deg"><div class="dk-h"><b>TYRE DEGRADATION</b></div><div class="dkc-body"><div class="dkc-lvl ${lvl.toLowerCase()}">${lvl}</div><div class="dk-mut">Wear multiplier <b>${(0.7 + wear * 0.9).toFixed(2)}x</b></div><div class="dkc-bars">${[0, 1, 2, 3, 4].map(i => `<i class="${i < nb ? 'on' : ''}"></i>`).join('')}</div><div>${lvl === 'HIGH' ? 'Tyre management is a key focus' : lvl === 'MEDIUM' ? 'A balance of pace and tyre care' : 'Push hard — tyres last well here'}</div></div></section>
    <section class="dkc-dev"><div class="dk-h"><b>DEVELOPMENT RELEVANCE</b></div><div class="dkc-body">
      <div class="dkc-dv"><div><b>Engine</b><span>Power and efficiency</span></div>${dkStars(t.pw * 5 + 0.3)}</div>
      <div class="dkc-dv"><div><b>Chassis + Aero</b><span>Cornering platform</span></div>${dkStars(t.df * 5 + 0.3)}</div>
      <div class="dkc-dv"><div><b>Tyre Management</b><span>Degradation control</span></div>${dkStars(t.wear * 5 + 0.5)}</div></div></section>
    <section class="dkc-past"><div class="dk-h"><b>PAST RESULTS</b></div><div class="dk-seg2">${[['race', 'Race History'], ['quali', 'Qualifying History']].map(([v, l]) => `<button class="${DK3.ph === v ? 'on' : ''}" data-a="dkcalph" data-v="${v}">${l}</button>`).join('')}</div><div class="dk-scroll">${histRows(DK3.ph)}</div></section>
    <section class="dkc-team"><div class="dk-h"><b>${who}</b></div><div class="dk-seg2">${[['race', 'Race Results'], ['quali', 'Qualifying Results']].map(([v, l]) => `<button class="${DK3.th === v ? 'on' : ''}" data-a="dkcalth" data-v="${v}">${l}</button>`).join('')}</div><div class="dk-scroll">${mineRows(DK3.th)}</div></section>
    <section class="dkc-sec"><div class="dk-h"><b>SECTOR OVERVIEW</b></div><div class="dkc-secb"><div>${['#22c55e', '#3b82f6', '#ef4444'].map((c, i) => `<div class="dkc-s"><i style="background:${c}"></i><b>Sector ${i + 1}</b><span>${(t.km / 3).toFixed(2)} km</span></div>`).join('')}</div><div class="dkc-secmap"><canvas id="calsec"></canvas></div></div></section>
  </div></div></div>`;
}
function dkDrawStatic(cv, t, sectors) {
  if (!cv) return; dkSize(cv); if (!cv._w) return;
  const ctx = cv.getContext('2d'), w = cv._w, h = cv._h; ctx.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0);
  const g = trackGeometry(t), pad = sectors ? 10 : 22, s = Math.min(w, h) - pad * 2, ox = (w - s) / 2, oy = (h - s) / 2;
  const X = p => ox + p[0] * s, Y = p => oy + p[1] * s;
  if (sectors) ctx.clearRect(0, 0, w, h); else { DK._terr = null; ctx.drawImage(dkTerrain(w, h), 0, 0, w, h); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (sectors) {
    const cols = ['#22c55e', '#3b82f6', '#ef4444'];
    for (let sct = 0; sct < 3; sct++) { ctx.beginPath(); let first = true; for (let f = sct / 3; f <= (sct + 1) / 3 + 1e-9; f += 1 / 300) { const p = pointAt(g, f); if (first) { ctx.moveTo(X(p), Y(p)); first = false; } else ctx.lineTo(X(p), Y(p)); } ctx.strokeStyle = cols[sct]; ctx.lineWidth = 3.5; ctx.stroke(); }
  } else {
    const path = () => { ctx.beginPath(); g.P.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.closePath(); };
    path(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 12; ctx.stroke(); ctx.strokeStyle = '#30343a'; ctx.lineWidth = 9; ctx.stroke();
  }
  const s0 = pointAt(g, 0); ctx.save(); ctx.translate(X(s0), Y(s0)); ctx.rotate(s0[2] + Math.PI / 2); for (let a = -3; a < 3; a++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (a + j) % 2 ? '#fff' : '#111'; ctx.fillRect(a * 2.5, -2.5 + j * 2.5, 2.5, 2.5); } ctx.restore();
}
function dkCalDraw() { if (!document.getElementById('calmap')) return; const t = roundTrack(G, DK3.sel); dkDrawStatic(document.getElementById('calmap'), t, false); dkDrawStatic(document.getElementById('calsec'), t, true); }

// ---------- standings from any season (current or archived) ----------
function dkSeasonData(y) {
  if (y == null || y === G.year) {
    const eng = t => { const e = G.engines[t.engine]; const owner = Object.values(G.teams).find(x => x.works && x.engine === t.engine) || t; return [e ? e.name : '', owner.color]; };
    return { year: G.year, cur: true, n: G.cal.length, cal: G.cal.map((id, i) => { const t = roundTrack(G, i); return [t.short, t.cc]; }), results: G.results,
      drivers: standingsDrivers(G).filter(d => d.team || d.pts > 0 || G.results.some(r => r.rows.some(x => x.id === d.id))).map(d => ({ id: d.id, name: d.name, nat: d.nat, team: d.team, pts: d.pts })),
      teams: standingsTeams(G).map(t => ({ id: t.id, name: t.name, color: t.color, eng: eng(t)[0], engCol: eng(t)[1], pts: t.pts })) };
  }
  const A0 = dkLoadSeason(y); if (!A0) return null;
  const un = r => ({ id: r[0], team: r[1], pos: r[2], out: r[3] ? 'RET' : null, pts: r[4], grid: r[5], code: r[6] });
  const results = A0.res.map(x => ({ rows: x.r.map(un), sprint: x.s ? x.s.map(un) : null, fastest: x.f ? { code: x.f } : null }));
  const cb = m => { const c = []; results.forEach(r => r.rows.forEach(x => { if (m(x) && !x.out && x.pos) c[x.pos] = (c[x.pos] || 0) + 1; })); return c; };
  const drivers = Object.entries(A0.d).map(([id, d]) => ({ id, name: d[0], nat: d[1], team: d[3], pts: d[4], cb: cb(x => x.id === id) }));
  drivers.sort((a, b) => b.pts - a.pts || cbCompare(a.cb, b.cb) || a.name.localeCompare(b.name));
  const teams = Object.entries(A0.t).map(([id, t]) => ({ id, name: t[0], color: t[1], eng: t[2], engCol: t[3], pts: t[4], cb: cb(x => x.team === id) }));
  teams.sort((a, b) => b.pts - a.pts || cbCompare(a.cb, b.cb) || a.name.localeCompare(b.name));
  return { year: y, cur: false, n: A0.n, cal: A0.cal, results, drivers, teams };
}
deskStandings = function () {
  const years = (G.histYears || []).filter(y => y !== G.year).sort((a, b) => b - a);
  if (DK3.season != null && DK3.season !== G.year && !years.includes(DK3.season)) DK3.season = null;
  const S = dkSeasonData(DK3.season) || dkSeasonData(null);
  const tmOf = id => S.teams.find(t => t.id === id);
  const tcell = (id, extra = '') => { const t = tmOf(id); return t ? `<td class="l tcell ${extra}" style="--tc:${t.color};--ti:${dkInk(t.color)}">${esc(t.name)}</td>` : `<td class="l ${extra}">—</td>`; };
  const mode = DK2.st, done = S.results.length;
  const flags = S.cal.map((c, i) => `<th class="fl ${i < done ? '' : 'todo'}" title="R${i + 1} ${esc(c[0])}">${dkFlag(c[1])}</th>`).join('');
  const isMe = (team, id) => S.cur && (G.player ? team === G.player : id === G.follow);
  let body;
  if (DK2.panel === 'graph') body = S.cur ? dkPointsGraph(mode) : dkPointsGraphS(S, mode);
  else if (DK2.panel === 'hist') body = dkHistory();
  else if (mode === 'd') {
    body = `<div class="dk-h"><b>Driver Championship ${S.year}</b>${S.cur ? '' : '<span class="dk-mut">final standings</span>'}</div><div class="dk-scroll"><table class="dkst ${DK2.modern ? 'modern' : 'classic'}"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Driver</th><th></th><th class="l">Team</th>${flags}<th class="pts">Pts</th></tr></thead><tbody>${S.drivers.map((d, i) => {
      const cells = S.cal.map((_, k) => { const res = S.results[k]; const r = res && res.rows.find(x => x.id === d.id); return `<td class="rc ${dkResCls(r)}">${r ? dkResTxt(r, res) : ''}</td>`; }).join('');
      const t = tmOf(d.team); return `<tr class="${isMe(d.team, d.id) ? 'me' : ''}"><td class="pos" style="border-left:3px solid ${t ? t.color : '#444'}">${i + 1}</td><td class="l nm">${esc(d.name)}</td><td class="flc">${dkFlag(d.nat)}</td>${d.team ? tcell(d.team) : '<td class="l dim">—</td>'}${cells}<td class="pts">${d.pts}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else {
    body = `<div class="dk-h"><b>Constructor Championship ${S.year}</b>${S.cur ? '' : '<span class="dk-mut">final standings</span>'}</div><div class="dk-scroll"><table class="dkst cons ${DK2.modern ? 'modern' : 'classic'}"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Team</th><th class="l">Engine</th>${flags}<th class="pts">Pts</th></tr></thead><tbody>${S.teams.map((t, i) => {
      const cells = S.cal.map((_, k) => { const res = S.results[k]; if (!res) return '<td class="rc"></td>'; const rs = res.rows.filter(x => x.team === t.id).sort((a, b) => (a.out ? 99 : a.pos) - (b.out ? 99 : b.pos));
        return `<td class="rc2">${rs.map(r => `<div class="${dkResCls(r)}">${dkResTxt(r, res)}</div>`).join('')}</td>`; }).join('');
      return `<tr class="${S.cur && t.id === G.player ? 'me' : ''}"><td class="pos" style="border-left:3px solid ${t.color}">${i + 1}</td>${tcell(t.id, 'stk1')}<td class="l tcell" style="--tc:${t.engCol};--ti:${dkInk(t.engCol)}">${esc(t.eng)}</td>${cells}<td class="pts">${t.pts}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  const legend = [['c-1', '1st'], ['c-2', '2nd'], ['c-3', '3rd'], ['c-pts', 'Pts'], ['c-np', 'No pts'], ['c-ret', 'RET'], ['c-dsq', 'DSQ']];
  const seasonSel = `<select class="dk-season" data-dkc="dkseason">${[G.year, ...years].map(y => `<option value="${y}" ${y === S.year ? 'selected' : ''}>${y}${y === G.year ? ' — current season' : ''}</option>`).join('')}</select>`;
  return `<div class="dk dk-page" id="dk"><div class="dk-pagehead"><h1>Championship Standings</h1><span class="sp"></span><span class="dk-mut">${S.year} · Round ${done} of ${S.n}${G.spectator ? ' · Spectator' : ' · ' + esc(G.teams[G.player] ? G.teams[G.player].name : '')}${G.regs && dkRegsActive(G.regs) ? ' · custom rules' : ''}</span><button data-a="tab" data-v="home">Back</button></div>
  <div class="dk-pagebar"><span class="dk-tabs2">${[['d', 'Drivers'], ['t', 'Constructors']].map(([k, v]) => `<button class="${mode === k && DK2.panel === 'grid' ? 'on' : ''}" data-a="dkst" data-v="${k}">${v}</button>`).join('')}</span>
    <button data-a="dkst2" data-v="legend">${DK2.legend ? 'Hide' : 'Show'} legend</button><button data-a="dkst2" data-v="color">${DK2.modern ? 'Modern' : 'Classic'} coloring</button><button data-a="dkst2" data-v="markers">Markers: ${DK_MARKERS[DK2.markers]}</button>
    <span class="sp"></span>${seasonSel}<button class="${DK2.panel === 'graph' ? 'on' : ''}" data-a="dkst2" data-v="graph">Points Graph</button><button class="${DK2.panel === 'hist' ? 'on' : ''}" data-a="dkst2" data-v="hist">Champions</button></div>
  <section class="dk-stbox">${body}</section>
  ${DK2.legend && DK2.panel === 'grid' ? `<div class="dk-legend ${DK2.modern ? 'modern' : 'classic'}">${legend.map(([c, l]) => `<span class="${c}">${l}</span>`).join('')}${DK2.markers === 1 ? '<span class="dk-mut"><b>Bold</b> = pole · <i>Italic</i> = fastest lap</span>' : DK2.markers === 2 ? '<span class="dk-mut">Superscript = sprint finish</span>' : ''}${(G.histYears || []).length ? '' : '<span class="dk-mut">Past seasons appear in the season menu once they have been played with this version.</span>'}</div>` : ''}</div>`;
};
function dkPointsGraphS(S, mode) {
  const N = S.results.length; if (!N) return '<div class="dk-empty">No races in this season.</div>';
  const series = (mode === 'd' ? S.drivers.slice(0, 10).map(d => ({ name: d.name.split(' ').slice(-1)[0], col: (S.teams.find(t => t.id === d.team) || { color: '#888' }).color, f: x => x.id === d.id }))
    : S.teams.map(t => ({ name: t.name, col: t.color, f: x => x.team === t.id })));
  series.forEach(s => { let c = 0; s.cum = S.results.map(r => c += r.rows.filter(s.f).reduce((a, x) => a + x.pts, 0) + (r.sprint ? r.sprint.filter(s.f).reduce((a, x) => a + x.pts, 0) : 0)); });
  const max = Math.max(1, ...series.map(s => s.cum[N - 1])), W = 1000, H = 420, L = 50, R = 150, T = 20, B = 40;
  const X = i => L + (N === 1 ? 0 : i / (N - 1)) * (W - L - R), Y = v => T + (1 - v / max) * (H - T - B);
  const grid = [0, .25, .5, .75, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${Y(max * f)}" y2="${Y(max * f)}" stroke="#1b2742"/><text x="${L - 8}" y="${Y(max * f) + 4}" fill="#7f8aa3" font-size="12" text-anchor="end">${Math.round(max * f)}</text>`).join('');
  const labels = series.map(s => ({ s, y: Y(s.cum[N - 1]) })).sort((a, b) => a.y - b.y); for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 13); for (let i = labels.length - 1; i >= 0; i--) labels[i].y = Math.min(labels[i].y, i === labels.length - 1 ? H - B : labels[i + 1].y - 13);
  return `<div class="dk-h"><b>${S.year} · cumulative points</b></div><div class="dk-graph"><svg viewBox="0 0 ${W} ${H}">${grid}${series.map(s => `<polyline fill="none" stroke="${s.col}" stroke-width="2.5" points="${s.cum.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`).join('')}${labels.map(({ s, y }) => `<text x="${W - R + 8}" y="${y + 4}" fill="${s.col}" font-size="12" font-weight="700">${esc(s.name)} ${s.cum[N - 1]}</text>`).join('')}</svg></div>`;
}

// ---------- hooks ----------
const _dk3_hqCalendar = hqCalendar;
hqCalendar = function () { if (deskOn() && !DK2.arch) return deskCalendar(); return _dk3_hqCalendar(); };
const _dk3_render = render;
render = function () { _dk3_render(); if (document.getElementById('calmap')) requestAnimationFrame(dkCalDraw); };
window.addEventListener('resize', () => { if (document.getElementById('calmap')) dkCalDraw(); });
document.addEventListener('change', e => { const el = e.target.closest && e.target.closest('[data-dkc]'); if (!el) return; A[el.dataset.dkc](el); });
Object.assign(A, {
  dkcalsel(el) { DK3.sel = +el.dataset.v; const sc = document.querySelector('.dkc-list .dk-scroll'); const top = sc ? sc.scrollTop : 0; render(); const s2 = document.querySelector('.dkc-list .dk-scroll'); if (s2) s2.scrollTop = top; },
  dkcalph(el) { DK3.ph = el.dataset.v; render(); },
  dkcalth(el) { DK3.th = el.dataset.v; render(); },
  dkseason(el) { if (el.tagName !== 'SELECT') return; DK3.season = +el.value; DK2.panel = 'grid'; render(); },
  dkreg(el) { if (el.tagName === 'OPTION') return; if (el.tagName !== 'SELECT' && el.tagName !== 'INPUT') return; SETUP.regs = SETUP.regs || Object.assign({}, DK_REG0); SETUP.regs[el.dataset.k] = el.value; if (el.tagName === 'SELECT') render(); },
  dkreg2(el) { if (el.tagName !== 'SELECT' && el.tagName !== 'INPUT') return; G.regs = G.regs || Object.assign({}, DK_REG0); G.regs[el.dataset.k] = el.value; if (dkRegsActive(G.regs)) dkApplyRegs(G); else G.rules = G.timeline ? rulesFor(G.year) : null; autosave(); if (el.tagName === 'SELECT') render(); toast('Regulations updated'); },
});
const _dk3_loadSeason = loadSeason; loadSeason = function (G0) { const r = _dk3_loadSeason.apply(this, arguments); dkApplyRegs(G0); return r; };
