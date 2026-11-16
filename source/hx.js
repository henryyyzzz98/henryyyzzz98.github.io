// ===================== Real-world data from F1DB: poles, fastest laps, retirements, line-ups, profiles, team history =====================
// ---------- lookups ----------
let HX_IDX = null;
function hxIdx(id) { // game driver id -> HIST.drivers index
  if (!HX_IDX) { HX_IDX = new Map(); HIST.drivers.forEach((x, i) => HX_IDX.set(x[0], i)); }
  if (HX_IDX.has(id)) return HX_IDX.get(id);
  return HX.modD[id] != null ? HX.modD[id] : -1;
}
function hxCid(G0, tid) { return G0 && !G0.timeline && HX.modT[tid] ? HX.modT[tid] : tid; }
const hxName = i => i >= 0 && HIST.drivers[i] ? HIST.drivers[i][1] : '';
function hxStart(G0) { return G0.startYear || Math.min(G0.year, ...((G0.history || []).map(h => h.year).filter(Boolean))); }
// real data for round i: { p:[time,didx], f:[time,didx,lap], o:official, a/x/s line-up changes, ty:tyre form, ry: year of the data }
function hxRound(G0, i) {
  if (!G0 || !G0.cal || G0.cal[i] == null) return null;
  const tid = G0.cal[i];
  if (G0.timeline && HIST.years[G0.year] && HIST.years[G0.year].rx) {
    const H = HIST.years[G0.year];
    let j = H.cal[i] && H.cal[i][0] === tid ? i : H.cal.findIndex(c => c[0] === tid);
    if (j < 0) return null;
    return Object.assign({ ry: G0.year }, H.rx[j]);
  }
  const R = HX.rt[tid]; if (!R) return null;
  const ys = Object.keys(R).map(Number).sort((a, b) => a - b); if (!ys.length) return null;
  const y = R[G0.year] ? G0.year : (ys.filter(v => v <= G0.year).pop() || ys[ys.length - 1]);
  const [p, f, o] = R[y]; return { p, f, o, ry: y };
}
function hxOfficial(G0, i) {
  const r = hxRound(G0, i); if (!r || !r.o) return '';
  return r.ry === G0.year ? r.o : r.o.replace(/\b(19|20)\d\d\b(?!.*\b(19|20)\d\d\b)/, String(G0.year));
}
function hxCar(G0, tid) {
  const y = G0.lineYear || G0.year; const H = HIST.years[y];
  return H && H.car ? H.car[hxCid(G0, tid)] || null : null;
}

// ---------- season set-up: stand-ins, extra teams and drivers ----------
function hxEnsure(G0) {
  if (!G0 || !G0.timeline) return;
  const H = HIST.years[G0.year]; if (!H || G0.hxY === G0.year) return;
  (H.xt || []).forEach(([cid, full, eng, works, car, rel]) => {
    if (G0.teams[cid]) return; const [name, color] = HIST.teams[cid] || [cid, '#888'];
    G0.teams[cid] = { id: cid, name, full, color, engine: 'e:' + cid, works: !!works, aero: car, chassis: car, rel, cars: 0, xt: true, money: 60, sponsor: 1, dev: 1, pts: 0, spent: 0 };
    G0.engines['e:' + cid] = { name: eng, power: car, rel };
  });
  (H.xd || []).forEach(row => {
    const D = HIST.drivers[row[0]]; if (!D || G0.drivers[D[0]]) return; const r = row.slice(3); const c = (G0.careers || {})[D[0]] || { titles: 0, wins: 0 };
    G0.drivers[D[0]] = { id: D[0], name: D[1], code: D[2], num: row[2], nat: D[3], age: G0.year - D[4], pace: r[0], craft: r[1], cons: r[2], wet: r[3], tyre: r[4],
      salary: 0, until: G0.year, pot: 0, team: null, hteam: row[1], pts: 0, res: [], wins: 0, pods: 0, poles: 0, careerWins: c.wins, titles: c.titles, next: null, xd: true };
  });
  G0.hxY = G0.year;
}
const _hx_loadSeason = loadSeason;
loadSeason = function (G0, y) { const r = _hx_loadSeason.apply(this, arguments); G0.hxY = null; hxEnsure(G0); return r; };
const _hx_startWeekend = startWeekend;
startWeekend = function () { if (G) { hxEnsure(G); hxInitStats(G); } return _hx_startWeekend.apply(this, arguments); };
// teams that only made occasional entries don't clutter the constructors' table unless they scored
const _hx_standingsTeams = standingsTeams;
standingsTeams = function () { return _hx_standingsTeams.apply(this, arguments).filter(t => !t.xt || t.pts > 0); };

// real line-up for the round (AI teams only; the player's team keeps the drivers you chose)
const _hx_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  let L = _hx_weekendEntries.apply(this, arguments);
  if (!G0.timeline || G0.mix) return L; // mixed eras: the calendar year's stand-ins don't belong to this line-up
  const r = hxRound(G0, G0.round); if (!r || (!r.a && !r.x)) return L;
  const outs = new Set((r.x || []).map(i => HIST.drivers[i][0]));
  L = L.filter(e => e.t.id === G0.player || !outs.has(e.d.id));
  (r.a || []).forEach(([di, cid, num]) => {
    const id = HIST.drivers[di][0], d = G0.drivers[id], t = G0.teams[cid];
    if (!d || !t || cid === G0.player || (G0.player && d.team === G0.player)) return;
    L = L.filter(e => e.d.id !== id || e.t.id === G0.player);
    if (L.some(e => e.d.id === id)) return;
    if (!d.num && num) d.num = num; if (!d.team && !d.hteam) d.hteam = cid;
    L.push({ d, t, setup: rnd(0.35, 0.5) + rnd(0.1, 0.3), tyreKnow: rnd(0.2, 0.5), qualiPrep: rnd(0.2, 0.5), standin: true });
  });
  return L;
};

// ---------- tyre war: race-by-race form of each tyre maker (from how its cars really qualified there) ----------
function hxTyreForm(G0, tid) {
  if (!G0.timeline || G0.mix || !WK) return 0;
  const r = hxRound(G0, WK.round); if (!r || !r.ty) return 0;
  if (!WK._tyf) { const v = Object.values(r.ty); const m = v.reduce((s, x) => s + x, 0) / v.length; WK._tyf = Object.fromEntries(Object.entries(r.ty).map(([k, x]) => [k, x - m])); }
  const car = hxCar(G0, tid); if (!car || !car[2]) return 0;
  return WK._tyf[car[2].split(' / ')[0]] || 0;
}
const _hx_lapTimeFor = lapTimeFor;
lapTimeFor = function (G0, c, track, o) {
  let lt = _hx_lapTimeFor.apply(this, arguments);
  try { const f = hxTyreForm(G0, c.t.id); if (f) lt -= f * 0.6 * spreadFor(G0.year) * 0.0011 * track.base; } catch (e) { }
  return lt;
};
function spreadFor(y) { return y < 1960 ? 46 : y < 1970 ? 38 : y < 1980 ? 32 : y < 1990 ? 30 : y < 2000 ? 25 : y < 2010 ? 21 : 18; }

// ---------- retirement causes by era ----------
function dkWhy(G0, kind) {
  const R = HIST.ret; const y = (G0 && G0.year) || 2026; let e = Math.floor(y / 5) * 5;
  while (!R[e] && e > 1950) e -= 5; const L = R[e] && (kind === 'c' ? R[e].c : R[e].m);
  if (!L || !L.length) return kind === 'c' ? pick(['Accident', 'Collision', 'Spun off']) : pick(['Engine', 'Gearbox', 'Hydraulics', 'Brakes', 'Electrical']);
  const tot = L.reduce((s, x) => s + x[1], 0); let v = Math.random() * tot;
  for (const [k, w] of L) { v -= w; if (v <= 0) return k; } return L[0][0];
}

// ---------- shared cars (1950s): a driver whose own car is out takes over a team-mate's car ----------
function hxChain(name, fn) { const prev = XPH[name]; XPH[name] = function () { const r = prev ? prev.apply(this, arguments) : undefined; const r2 = fn.apply(this, arguments); return r2 !== undefined ? r2 : r; }; }
hxChain('raceInit', race => {
  try {
    if (!G.timeline || G.mix || !WK || race.sprint) return;
    const r = hxRound(G, WK.round); if (!r || !r.s) return;
    r.s.forEach(([pi, cos]) => { const c = race.cars.find(c => c.d.id === HIST.drivers[pi][0]); if (c) c.share = cos.map(i => HIST.drivers[i][0]).filter(id => G.drivers[id]); });
  } catch (e) { }
});
hxChain('onLap', (race, c, n) => {
  if (!c.share || !c.share.length || c.out || c.finished || n < race.laps * 0.4 || n > race.laps * 0.85) return;
  const id = c.share[0], own = race.cars.find(x => x !== c && x.d.id === id);
  if (own && !own.out) return; // still racing his own car
  c.share.shift(); const nd = G.drivers[id]; if (!nd) return;
  c.prevD = (c.prevD || []).concat([{ d: c.d, laps: c.laps }]); const old = c.d; c.d = nd;
  if (own) own.handed = true;
  race.msg(`🔄 ${old.name} hands his ${c.t.name} over to ${nd.name}`, true);
});
const _hx_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _hx_applyRaceResult.apply(this, arguments);
  try {
    const s = G0.results[G0.results.length - 1];
    if (s && race && race.cars) hxShareSplit(G0, race, s);
    if (s) hxRaceStats(G0, race, wk, s);
  } catch (e) { console.error(e); }
  return out;
};
function hxShareSplit(G0, race, s) {
  race.cars.filter(c => c.prevD).forEach(c => {
    const row = s.rows.find(r => r.id === c.d.id && r.team === c.t.id && r.pos === race.result.find(x => x.c === c).pos); if (!row) return;
    // the taking-over driver's own (retired) car leaves the classification
    const own = race.cars.find(x => x !== c && x.d.id === c.d.id && x.handed);
    if (own) { const k = s.rows.findIndex(r => r !== row && r.id === c.d.id); if (k >= 0) { s.rows.splice(k, 1); const d = G0.drivers[c.d.id]; const z = d.res.lastIndexOf(0); if (z >= 0 && d.res.length > 1) d.res.splice(z, 1); } }
    const ids = c.prevD.map(p => p.d.id).concat(c.d.id), n = ids.length, share = Math.round(row.pts / n * 100) / 100;
    if (row.pts) { const d = G0.drivers[c.d.id]; const cut = row.pts - share; d.pts -= cut; d.res[d.res.length - 1] -= cut; row.pts = share; }
    row.shared = c.prevD.map(p => p.d.name);
    c.prevD.forEach(p => {
      const d = G0.drivers[p.d.id]; if (!d) return;
      const own = s.rows.find(r => r.id === d.id && r !== row);
      if (own) { // he also has his own (retired) car in the classification: credit the shared points there
        if (share) { own.pts += share; d.pts += share; d.res[d.res.length - 1] += share; }
        own.shared = (own.shared || []).concat(c.d.name); return;
      }
      d.res = d.res || []; d.res.push(share); d.pts += share;
      s.rows.push({ id: d.id, code: d.code, name: d.name, team: c.t.id, pos: row.pos, grid: row.grid, out: row.out, time: row.time, laps: row.laps, pts: share, best: null, stops: row.stops, shared: [c.d.name], sharedPart: true });
    });
    s.rows.sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || a.pos - b.pos || (a.sharedPart ? 1 : 0) - (b.sharedPart ? 1 : 0));
  });
}

// ---------- career statistics: real totals before the save started + everything since ----------
const HX_KEYS = ['st', 'w', 'p', 'pod', 'fl', 'gs', 't'];
function hxInitStats(G0) { G0.cst = G0.cst || {}; G0.tst = G0.tst || {}; G0.hxStart = G0.hxStart || hxStart(G0); }
function hxReal(kind, id, G0) {
  const S = G0.hxStart || hxStart(G0), o = { st: 0, w: 0, p: 0, pod: 0, fl: 0, gs: 0, t: 0, one2: 0, pts: 0 };
  if (kind === 'd') { const i = hxIdx(id); (HX.ds[i] || []).forEach(r => { if (r[0] < S) { o.st += r[1]; o.w += r[2]; o.p += r[3]; o.pod += r[4]; o.fl += r[5]; o.gs += r[6]; o.t += r[7]; o.pts += r[8]; } }); }
  else { const T = HX.tp[hxCid(G0, id)]; (T ? T[3] : []).forEach(r => { if (r[0] < S) { o.st += r[1]; o.w += r[2]; o.p += r[3]; o.pod += r[4]; o.fl += r[5]; o.one2 += r[6]; o.t += r[7]; o.pts += r[8]; } }); }
  return o;
}
function hxGame(kind, id, G0) { const src = kind === 'd' ? (G0.cst || {}) : (G0.tst || {}); return Object.assign({ st: 0, w: 0, p: 0, pod: 0, fl: 0, gs: 0, t: 0, one2: 0 }, src[id] || {}); }
function hxTotal(kind, id, G0) { const a = hxReal(kind, id, G0), b = hxGame(kind, id, G0); const o = {}; Object.keys(a).forEach(k => o[k] = (a[k] || 0) + (b[k] || 0)); return o; }
const HX_MS = { st: [50, 100, 150, 200, 250, 300, 350, 400], w: [1, 10, 20, 25, 30, 40, 50, 60, 75, 90, 100], p: [1, 10, 20, 25, 30, 40, 50, 75, 100], pod: [1, 10, 25, 50, 75, 100, 150, 200], gs: [1, 5, 10] };
const HX_MSN = { st: n => `${n}${n % 100 === 0 ? 'th' : 'th'} Grand Prix start`, w: n => n === 1 ? 'first Grand Prix win' : `${n}th Grand Prix win`, p: n => n === 1 ? 'first pole position' : `${n}th pole position`, pod: n => n === 1 ? 'first podium' : `${n}th podium`, gs: n => n === 1 ? 'first grand slam' : `${n}th grand slam` };
const HX_TMS = { w: [1, 10, 25, 50, 75, 100, 150, 200, 250, 300], p: [1, 25, 50, 100, 150, 200, 250, 300], one2: [1, 10, 25, 50, 100] };
const HX_TMSN = { w: n => n === 1 ? 'first Grand Prix win' : `${n}th Grand Prix win`, p: n => n === 1 ? 'first pole position' : `${n}th pole position`, one2: n => n === 1 ? 'first one-two finish' : `${n}th one-two finish` };
function hxRaceStats(G0, race, wk, s) {
  hxInitStats(G0);
  const beforeD = {}, beforeT = {};
  const ids = [...new Set(s.rows.map(r => r.id))], tids = [...new Set(s.rows.map(r => r.team))];
  ids.forEach(id => beforeD[id] = hxTotal('d', id, G0)); tids.forEach(t => beforeT[t] = hxTotal('t', t, G0));
  const bump = (src, id, k) => { src[id] = src[id] || {}; src[id][k] = (src[id][k] || 0) + 1; };
  const pole = wk && wk.grid && wk.grid[0] ? wk.grid[0].d.id : null, poleT = wk && wk.grid && wk.grid[0] ? wk.grid[0].t.id : null;
  const flId = race && race.fastest ? race.fastest.c.d.id : null, flT = race && race.fastest ? race.fastest.c.t.id : null;
  const win = s.rows.find(r => r.pos === 1 && !r.out);
  s.rows.forEach(r => { if (!r.sharedPart) bump(G0.cst, r.id, 'st'); if (!r.out && r.pos <= 3) bump(G0.cst, r.id, 'pod'); if (!r.out && r.pos === 1) bump(G0.cst, r.id, 'w'); });
  tids.forEach(t => bump(G0.tst, t, 'st'));
  s.rows.filter(r => !r.out && r.pos <= 3 && !r.sharedPart).forEach(r => bump(G0.tst, r.team, 'pod'));
  if (win) bump(G0.tst, win.team, 'w');
  if (pole) { bump(G0.cst, pole, 'p'); bump(G0.tst, poleT, 'p'); }
  if (flId) { bump(G0.cst, flId, 'fl'); bump(G0.tst, flT, 'fl'); }
  const top2 = s.rows.filter(r => !r.out && !r.sharedPart && r.pos <= 2);
  if (top2.length === 2 && top2[0].team === top2[1].team) bump(G0.tst, top2[0].team, 'one2');
  const L = s.leaders;
  if (win && pole === win.id && flId === win.id && L && L.length === 1 && L[0].id === win.id) bump(G0.cst, win.id, 'gs');
  // milestones
  const ms = [];
  ids.forEach(id => { const a = beforeD[id], b = hxTotal('d', id, G0), d = G0.drivers[id]; if (!d) return;
    Object.keys(HX_MS).forEach(k => HX_MS[k].forEach(n => { if (a[k] < n && b[k] >= n) ms.push({ id, name: d.name, team: d.team, txt: HX_MSN[k](n), k }); })); });
  tids.forEach(t => { const a = beforeT[t], b = hxTotal('t', t, G0), tm = G0.teams[t]; if (!tm) return;
    Object.keys(HX_TMS).forEach(k => HX_TMS[k].forEach(n => { if (a[k] < n && b[k] >= n) ms.push({ tid: t, name: tm.name, txt: HX_TMSN[k](n), k }); })); });
  if (ms.length) { s.ms = ms; ms.forEach(m => news(G0, `🎉 ${m.name}: ${m.txt}!`)); }
}
// titles at the end of a season
const _hx_endseason = A.endseason;
A.endseason = function () {
  try { if (G && G.results && G.results.length >= G.cal.length) { hxInitStats(G); const d = standingsDrivers(G)[0], t = standingsTeams(G)[0];
    if (d) { G.cst[d.id] = G.cst[d.id] || {}; G.cst[d.id].t = (G.cst[d.id].t || 0) + 1; }
    if (t && (!G.rules || G.rules.constructors !== false)) { G.tst[t.id] = G.tst[t.id] || {}; G.tst[t.id].t = (G.tst[t.id].t || 0) + 1; } } } catch (e) { }
  return _hx_endseason.apply(this, arguments);
};

// ---------- real-world panels on the results screens ----------
function hxRealPanel(G0, k, kind, sim) {
  const r = hxRound(G0, k); if (!r) return '';
  const lbl = r.ry === G0.year ? 'REAL WORLD' : `REAL WORLD · ${r.ry}`;
  const row = (a, who, t, cmp) => `<div class="dkg-row"><span>${a}</span><b>${esc(who)}${t != null ? ` · ${fmtTime(t)}` : ''}${cmp || ''}</b></div>`;
  const diff = (real, sim) => real != null && sim != null ? ` <em class="${sim - real <= 0 ? 'g' : 'r'}">(game ${sim - real <= 0 ? '−' : '+'}${Math.abs(sim - real).toFixed(3)})</em>` : '';
  let h = '';
  if (kind === 'q' && r.p) h += row('POLE POSITION', hxName(r.p[1]), r.p[0], sim ? diff(r.p[0], sim) : '');
  if (kind === 'r') {
    const t = roundTrack(G0, k);
    if (t.realWin != null && t.realWin >= 0 && G0.timeline) h += row('WINNER', hxName(t.realWin), null);
    if (r.p) h += row('POLE POSITION', hxName(r.p[1]), r.p[0]);
    if (r.f) h += row('FASTEST LAP', hxName(r.f[1]) + (r.f[2] ? ` (lap ${r.f[2]})` : ''), r.f[0], sim ? diff(r.f[0], sim) : '');
  }
  if (!h) return '';
  return `<section><div class="dk-h"><b>${lbl}</b></div><div class="dkg-body">${h}</div></section>`;
}
function hxMsPanel(s) {
  if (!s || !s.ms || !s.ms.length) return '';
  return `<section><div class="dk-h"><b>🎉 MILESTONES</b></div><div class="dkg-body">${s.ms.map(m => `<div class="dkx-ms" ${m.id ? `data-prof="${m.id}"` : `data-tprof="${m.tid}"`}><b>${esc(m.name)}</b><span>${esc(m.txt)}</span></div>`).join('')}</div></section>`;
}
function hxInject(html, extra, official) {
  if (extra) html = html.replace('<div class="dk-resside">', '<div class="dk-resside">' + extra);
  if (official) html = html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>[\s\S]*?<\/h1>)/, `$1<div class="dkx-off">${esc(official)}</div>`);
  return html;
}
// qualifying results
const _hx_deskQualiRes = deskQualiRes;
deskQualiRes = function () {
  const html = _hx_deskQualiRes.apply(this, arguments);
  try { const QS = WK && (WK.stage === 'squali' ? WK.SQ : WK.Q); const done = QS && QS.rounds && QS.rounds.length;
    const g = WK && WK.stage !== 'squali' ? WK.grid : null; let best = null;
    if (done) QS.rounds[QS.rounds.length - 1].res.forEach(x => { if (x.t != null && (best == null || x.t < best)) best = x.t; });
    const sq = WK.stage === 'squali' && !(typeof dkAcad === 'function' && dkAcad()), r = hxRound(G, WK.round), fin = html.includes('data-a="tostage"') || /Results/.test(html.slice(0, 600));
    let strip = `<div class="dkx-strip">${esc(hxOfficial(G, WK.round))}`;
    if (!sq && r && r.p && fin) strip += `<span class="sp"></span><span><b class="dkx-rw">${r.ry === G.year ? 'REAL POLE' : 'REAL POLE ' + r.ry}</b> ${esc(hxName(r.p[1]))} · ${fmtTime(r.p[0])}${best != null ? ` <em class="${best - r.p[0] <= 0 ? 'g' : 'r'}">(game pole ${best - r.p[0] <= 0 ? '−' : '+'}${Math.abs(best - r.p[0]).toFixed(3)})</em>` : ''}</span>`;
    strip += '</div>';
    return html.replace(/(<div class="dk-fptitle">[\s\S]*?<\/span><\/div>)/, '$1' + strip);
  } catch (e) { return html; }
};
// race results (live and archive)
const _hx_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  const html = _hx_dkRaceView.apply(this, arguments);
  try { const s = G.results[o.k]; const fl = o.fastest ? o.fastest.t : null;
    return hxInject(html, (o.sprint ? '' : hxRealPanel(G, o.k, 'r', fl)) + (o.sprint ? '' : hxMsPanel(s)), hxOfficial(G, o.k));
  } catch (e) { return html; }
};
const _hx_deskGrid = deskGrid;
deskGrid = function () { const html = _hx_deskGrid.apply(this, arguments); try { return hxInject(html, '', hxOfficial(G, WK.round)); } catch (e) { return html; } };

// ---------- profiles ----------
const HX_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hxDate = s => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return `${d} ${HX_MON[m - 1]} ${y}`; };
const hxAge = (from, to) => { const [y, m, d] = from.split('-').map(Number); const [Y, M, D] = to; return Y - y - ((M < m || (M === m && D < d)) ? 1 : 0); };
const HX_FAM = { CHILD: ['Father of', 'Parent of'], PARENT: ['Son of', 'Child of'], SIBLING: ['Brother of', 'Sibling of'], SIBLINGS_CHILD: ['Uncle of', 'Uncle/aunt of'], PARENTS_SIBLING: ['Nephew of', 'Nephew/niece of'],
  GRANDCHILD: ['Grandfather of', 'Grandparent of'], GRANDPARENT: ['Grandson of', 'Grandchild of'], COUSIN: ['Cousin of', 'Cousin of'], HALF_SIBLING: ['Half-brother of', 'Half-sibling of'],
  SPOUSE: ['Married to', 'Married to'], PARENTS_SIBLINGS_CHILD: ['Cousin of', 'Cousin of'], SIBLINGS_GRANDCHILD: ['Great-uncle of', 'Great-uncle of'], GRANDPARENTS_SIBLING: ['Great-nephew of', 'Great-nephew of'] };
function hxStatTable(rows, real, game, tot, S) {
  return `<table class="dkx-st"><thead><tr><th class="l"></th><th>Before ${S}<small>real world</small></th><th>Since ${S}<small>this game</small></th><th>Total</th></tr></thead><tbody>${rows.map(([k, lab]) => `<tr><td class="l">${lab}</td><td>${fmtN(real[k])}</td><td>${fmtN(game[k])}</td><td><b>${fmtN(tot[k])}</b></td></tr>`).join('')}</tbody></table>`;
}
const fmtN = v => (Math.round((v || 0) * 100) / 100).toLocaleString('en-GB');
function hxNext(tot, table, names) {
  const out = []; Object.keys(table).forEach(k => { const n = table[k].find(n => n > (tot[k] || 0)); if (n && n - (tot[k] || 0) <= (k === 'st' ? 15 : 5)) out.push(`${n - (tot[k] || 0)} more for ${names[k](n)}`); });
  return out.length ? `<div class="dk-mut dkx-next">Next: ${out.join(' · ')}</div>` : '';
}
function hxDriverProfile(id) {
  hxInitStats(G);
  const d = G.drivers[id], i = hxIdx(id), P = i >= 0 ? HX.prof[i] : null, H = i >= 0 ? HIST.drivers[i] : null;
  const name = d ? d.name : H ? H[1] : id; const tm = d && G.teams[d.team || d.hteam];
  const S = G.hxStart, now = [G.year, 7, 1];
  const real = hxReal('d', id, G), game = hxGame('d', id, G), tot = hxTotal('d', id, G);
  const bio = [];
  if (P && P[1]) bio.push(['BORN', `${hxDate(P[1])}${P[2] ? ', ' + esc(P[2]) : ''} ${P[3] ? dkFlag(P[3]) : ''}${!P[4] ? ` <span class="dk-mut">(age ${hxAge(P[1], now)} in ${G.year})</span>` : ''}`]);
  if (P && P[4]) bio.push(['DIED', `${hxDate(P[4])} <span class="dk-mut">(aged ${hxAge(P[1], P[4].split('-').map(Number))})</span>`]);
  if (d) bio.push(['NATIONALITY', `${dkFlag(d.nat)} ${esc(d.nat)}`]);
  if (P && P[5]) bio.push(['PERMANENT NUMBER', '#' + esc(P[5])]);
  if (d && d.num) bio.push([`RACE NUMBER ${G.year}`, '#' + d.num]);
  if (P && P[6] && P[6].length) bio.push(['FAMILY', P[6].map(([j, t]) => `${(HX_FAM[t] || [t.toLowerCase().replace(/_/g, ' ') + ' of'])[0]} <a data-prof="${HIST.drivers[j][0]}">${esc(HIST.drivers[j][1])}</a>`).join('<br>')]);
  if (d) { const ds = standingsDrivers(G), p = ds.findIndex(x => x.id === id) + 1; if (p) bio.push([`${G.year} SEASON`, `P${p} · ${fmtN(d.pts)} pts · ${d.wins || 0} win${d.wins === 1 ? '' : 's'}`]); }
  const car = tm && hxCar(G, tm.id);
  return `<div class="dkx-mod" style="--tc:${tm ? tm.color : '#3b82f6'}"><div class="dkx-hd">${d ? dkFlag(d.nat, 'lg') : ''}<div><h2>${esc(name)}</h2><div class="dk-mut">${P ? esc(P[0]) : ''}${tm ? ` · <a data-tprof="${tm.id}">${esc(tm.name)}</a>${car && car[0] ? ' ' + esc(car[0]) : ''}` : ''}</div></div><span class="sp"></span>${(P && P[5]) || (d && d.num) ? `<div class="dkx-num">${esc(String((d && d.num) || P[5]))}</div>` : ''}<button class="dkx-x" data-a="hxclose">✕</button></div>
    <div class="dkx-body"><section><div class="dk-h"><b>PROFILE</b></div><div class="dkg-body">${bio.map(([a, b]) => `<div class="dkg-row"><span>${a}</span><b>${b}</b></div>`).join('')}</div></section>
    <section><div class="dk-h"><b>CAREER</b></div>${hxStatTable([['st', 'Grand Prix starts'], ['w', 'Wins'], ['p', 'Pole positions'], ['pod', 'Podiums'], ['fl', 'Fastest laps'], ['gs', 'Grand slams'], ['t', 'World titles']], real, game, tot, S)}${hxNext(tot, HX_MS, HX_MSN)}</section></div></div>`;
}
function hxTeamProfile(tid) {
  hxInitStats(G);
  const tm = G.teams[tid], cid = hxCid(G, tid), T = HX.tp[cid]; const S = G.hxStart;
  const real = hxReal('t', tid, G), game = hxGame('t', tid, G), tot = hxTotal('t', tid, G);
  const name = tm ? tm.name : T ? T[0] : tid;
  let lineage = '';
  if (T && T[2] && T[2].length && T[2].some(([c, a, b]) => c === cid && G.year >= a && (b == null || G.year <= b))) lineage = `<section><div class="dk-h"><b>LINEAGE</b></div><div class="dkx-lin">${T[2].map(([c, a, b]) => { const n = HX.tp[c] ? HX.tp[c][0] : (HIST.teams[c] || [c])[0]; const on = c === cid && G.year >= a && (b == null || G.year <= b);
    return `<span class="${on ? 'on' : ''}"><b>${esc(n)}</b><small>${a}–${b == null ? 'today' : b}</small></span>`; }).join('<i>→</i>')}</div></section>`;
  const car = hxCar(G, tid), drivers = Object.values(G.drivers).filter(d => d.team === tid);
  const info = [];
  if (T && T[1]) info.push(['NATIONALITY', `${dkFlag(T[1])} ${esc(T[1])}`]);
  if (tm) info.push(['ENTRANT', esc(tm.full || tm.name)]);
  if (car && car[0]) info.push([`CAR ${G.year}`, esc(car[0])]);
  info.push(['ENGINE', esc((car && car[1]) || (tm ? dkEngine(tm) : ''))]);
  if (car && car[2]) info.push(['TYRES', esc(car[2])]);
  if (drivers.length) info.push(['DRIVERS', drivers.map(d => `<a data-prof="${d.id}">${esc(d.name)}</a>`).join(', ')]);
  if (tm) { const p = standingsTeams(G).findIndex(x => x.id === tid) + 1; if (p) info.push([`${G.year} SEASON`, `P${p} · ${fmtN(tm.pts)} pts`]); }
  return `<div class="dkx-mod" style="--tc:${tm ? tm.color : '#3b82f6'}"><div class="dkx-hd"><i class="dkx-sw"></i><div><h2>${esc(name)}</h2><div class="dk-mut">${T && T[0] !== name ? esc(T[0]) : 'Team history'}</div></div><span class="sp"></span><button class="dkx-x" data-a="hxclose">✕</button></div>
    <div class="dkx-body"><section><div class="dk-h"><b>TEAM</b></div><div class="dkg-body">${info.map(([a, b]) => `<div class="dkg-row"><span>${a}</span><b>${b}</b></div>`).join('')}</div></section>${lineage}
    <section><div class="dk-h"><b>ALL-TIME RECORD</b></div>${hxStatTable([['st', 'Grands Prix'], ['w', 'Wins'], ['p', 'Pole positions'], ['pod', 'Podiums'], ['fl', 'Fastest laps'], ['one2', 'One-two finishes'], ['t', "Constructors' titles"]], real, game, tot, S)}${hxNext(tot, HX_TMS, HX_TMSN)}</section></div></div>`;
}
function hxOpen(html) { hxClose(); const el = document.createElement('div'); el.className = 'dkx-ov'; el.id = 'dkx-ov'; el.innerHTML = html; document.body.appendChild(el); }
function hxClose() { const el = document.getElementById('dkx-ov'); if (el) el.remove(); }
A.hxclose = hxClose;
document.addEventListener('click', ev => {
  if (!G) return;
  const ov = document.getElementById('dkx-ov');
  if (ov && ev.target === ov) { hxClose(); return; }
  const p = ev.target.closest('[data-prof]'), t = ev.target.closest('[data-tprof]');
  if (ev.target.closest('[data-a]') && !(ov && ov.contains(ev.target) && (p || t))) return;
  if (p && (G.drivers[p.dataset.prof] || hxIdx(p.dataset.prof) >= 0)) { ev.stopPropagation(); hxOpen(hxDriverProfile(p.dataset.prof)); }
  else if (t && (G.teams[t.dataset.tprof] || HX.tp[t.dataset.tprof])) { ev.stopPropagation(); hxOpen(hxTeamProfile(t.dataset.tprof)); }
}, true);
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && document.getElementById('dkx-ov')) { hxClose(); ev.stopPropagation(); } }, true);

// ---------- calendar: official name ----------
const _hx_deskCalendar = deskCalendar;
deskCalendar = function () {
  const html = _hx_deskCalendar.apply(this, arguments);
  try { const k = DK3.sel == null ? Math.min(G.round, G.cal.length - 1) : DK3.sel; const o = hxOfficial(G, k);
    return o ? html.replace(/(<div class="dkc-circ">[\s\S]*?<\/div>)/, `$1<div class="dkx-off">${esc(o)}</div>`) : html; } catch (e) { return html; }
};

// ---------- lap-time calibration against the real pole and fastest lap of each race ----------
const _hx_roundTrack = roundTrack;
roundTrack = function (G0, i) {
  const t = _hx_roundTrack.apply(this, arguments);
  try {
    const r = G0 ? hxRound(G0, i) : null;
    if (G0 && G0.timeline && G0.calInfo && G0.calInfo[i] && G0.calInfo[i].base) t.base = +(t.base * 1.0163).toFixed(3);
    else if (G0 && !G0.timeline && r && r.p && G0.year - r.ry <= 2) t.base = +(r.p[0] * 1.0061).toFixed(3); // modern: latest real pole at this circuit
    if (G0 && (G0.timeline ? G0.calInfo && G0.calInfo[i] : G0.year - (r && r.ry) <= 2)) {
      // real race pace relative to pole (qualifying tyres/boost, fuel loads, tyre saving...)
      if (r && r.p && r.f) t.raceAdd = Math.max(-1.5, Math.min(12, (r.f[0] - r.p[0]) - 0.6));
    }
  } catch (e) { }
  return t;
};
{ const prev = XPH.lapDelta; XPH.lapDelta = function (race, c) { const t = race.track; return (prev ? prev.apply(this, arguments) || 0 : 0) + (t && t.raceAdd ? t.raceAdd : 0); }; }

// ---------- retirement rates calibrated per 5-year era (simulated vs real DNFs per start) ----------
const HX_MECH_MUL = {"1950": 1.29, "1955": 1.3, "1960": 1.29, "1965": 1.14, "1970": 0.99, "1975": 1.22, "1980": 1.06, "1985": 1.36, "1990": 1.08, "1995": 0.97, "2000": 1.15, "2005": 1.01, "2010": 0.88, "2015": 1.13, "2020": 0.96, "2025": 1.2}, HX_CRASH_MUL = {"1950": 1.32, "1955": 1.08, "1960": 0.95, "1965": 0.84, "1970": 1.31, "1975": 2.58, "1980": 3.43, "1985": 1.75, "1990": 2.84, "1995": 3.3, "2000": 1.42, "2005": 1.86, "2010": 1.63, "2015": 2.37, "2020": 1.63, "2025": 1.4};
const hxEraMul = (T, y) => { let e = Math.floor((y || 2026) / 5) * 5; while (T[e] == null && e > 1950) e -= 5; return T[e] || 1; };
{ const prev = XPH.relMul; XPH.relMul = function (race) { const a = prev ? prev.apply(this, arguments) : 1; return (a == null ? 1 : a) * hxEraMul(HX_MECH_MUL, race.G.year); }; }
{ const prev = XPH.crashMul; XPH.crashMul = function (race) { const a = prev ? prev.apply(this, arguments) : 1; return (a == null ? 1 : a) * hxEraMul(HX_CRASH_MUL, race.G.year); }; }
