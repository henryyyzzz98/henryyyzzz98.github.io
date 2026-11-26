// ===================== EXEMPTION WEEKEND (custom weekend format, survival season built in) =====================
// Friday:   FP1, FP2, then Exemption Qualifying 1 and 2 — every driver runs 12 laps; the best 12-lap average in each
//           session is exempt from qualifying and starts Grand Prix 1 from P1 (EQ1) / P2 (EQ2). The EQ1 winner sits out EQ2.
// Saturday: everyone else runs Pole-Lap Qualifying for P3 onwards.
// Sunday:   two Grands Prix, one after the other.
//   GP1 (3/4 distance) — everyone. Drivers NOT CLASSIFIED (lapped or retired) race GP2; if all are classified, the last 10.
//   GP2 (1/4 distance) — starts in the order of the FIA "not classified" list; the last-placed driver is out of the season.
// Revival rounds (1 if the season has up to 12 races, 2 if more): only eliminated drivers race one half-distance
// Grand Prix; the first across the line rejoins the competition. At least 4 drivers reach the final round.
// No points. 1-3 drivers out per weekend; 4 drivers race an endless final, the last one running is champion.
const exOn = (G0) => { G0 = G0 || G; return !!(G0 && G0.rules && G0.rules.exempt); };
const EX_LAPS = 8, EX_MIN_FINAL = 4;
// revival rounds: 1 in a season of up to 12 races, 2 in longer seasons; spread through the season, never round 1 or the final
function exRevRounds(R) { const n = R <= 1 ? 0 : R <= 12 ? 1 : 2, out = []; for (let k = 1; k <= n; k++) { const i = Math.round(R * k / (n + 1)); if (i > 1 && i < R - 1) out.push(i); } return [...new Set(out)]; }
const exIsRev = (G0, i) => exOn(G0) && exRevRounds(G0.cal.length).includes(i);

// ---------- rules ----------
const _ex_dkRegsActive = dkRegsActive;
dkRegsActive = function (r) { return (r && r.format === 'exempt') || _ex_dkRegsActive.apply(this, arguments); };
const _ex_dkApplyRegs = dkApplyRegs;
dkApplyRegs = function (G0) {
  const r = _ex_dkApplyRegs.apply(this, arguments);
  if (G0 && G0.exSurv && G0.regs && G0.regs.format !== 'exempt' && !(G0.results || []).length) { G0.survival = false; G0.exSurv = false; delete G0.sv; } // changed their mind before the first race
  if (G0 && G0.regs && G0.regs.format === 'exempt' && G0.rules) {
    Object.assign(G0.rules, { exempt: true, quali: 'single', endu: false, elimRace: false, heats: false, hybrid: false, intruder: false, poleElim: false, groups: false, forkRace: false, yieldRace: false, academy: false, polePts: 0 });
    if (!G0.survival) G0.exSurv = true; G0.survival = true;
    Object.assign(G0.regs, EX_FORCED); G0.regs.format = 'exempt';
  }
  return r;
};
const _ex_isSprintRound = isSprintRound;
isSprintRound = function (G0, i) { if (G0 && G0.regs && G0.regs.format === 'exempt') return false; return _ex_isSprintRound.apply(this, arguments); };
const _ex_startgame = A.startgame;
A.startgame = function () {
  const r = _ex_startgame.apply(this, arguments);
  if (G && G.regs && G.regs.format === 'exempt' && !G.results.length) { dkApplyRegs(G); G.survival = true; G.exSeason = true; }
  return r;
};

// survival plan: a random 1–4 drivers out each weekend, revival rounds bring back a random 1 or 2,
// and it all adds up so exactly 4 drivers race the final round (the last round only runs Grand Prix 1)
function exPlan(R, P) {
  const rev = exRevRounds(R), er = []; for (let i = 0; i < R - 1; i++) if (!rev.includes(i)) er.push(i);
  for (let tries = 0; tries < 400; tries++) {
    const v = {}; rev.forEach(i => { v[i] = 2; });
    const E = P - EX_MIN_FINAL + Object.values(v).reduce((a, x) => a + x, 0);
    const k = {}; er.forEach(i => { k[i] = E >= er.length ? 1 : 0; });
    let left = E - Object.values(k).reduce((a, x) => a + x, 0);
    if (left < 0) { const z = er.slice().sort(() => Math.random() - 0.5).slice(0, -left); z.forEach(i => { k[i] = 0; }); left = 0; }
    let guard = 0; while (left > 0 && guard++ < 5000) { const i = er[rint(0, er.length - 1)]; if (k[i] < 3) { k[i]++; left--; } if (er.every(j => k[j] >= 3)) break; }
    // check: never below 4 alive, revivals always have enough eliminated drivers
    let alive = P, gone = 0, ok = true;
    for (let i = 0; i < R; i++) { if (rev.includes(i)) { if (gone < v[i]) { ok = false; break; } alive += v[i]; gone -= v[i]; } else if (i < R - 1) { alive -= k[i]; gone += k[i]; if (alive < EX_MIN_FINAL) { ok = false; break; } } }
    if (ok || tries === 399) { const out = []; for (let i = 0; i < R; i++) out.push(rev.includes(i) || i === R - 1 ? 0 : k[i] || 0); out.revN = v; return out; }
  }
}
const _ex_svPlan = svPlan;
svPlan = function (G0, ids) { if (!exOn(G0)) return _ex_svPlan.apply(this, arguments); return exPlan(G0.cal.length, ids.length); };

// ---------- Friday: two practice sessions, then exemption qualifying ----------
const _ex_startWeekend = startWeekend;
startWeekend = function () {
  const r = _ex_startWeekend.apply(this, arguments);
  if (exOn() && WK) { WK.sessions = 3; WK.sprint = false; WK.ex = { eq: [], exempt: [], risk: {} }; }
  return r;
};
const _ex_docSched = docSched;
docSched = function (wk) { if (exOn() && wk && wk.ex) return { fp: [[0, 690, 60], [0, 960, 60], [1, 690, 60]], eq: [[1, 900, 40], [1, 960, 40], [1, 1020, 40]], q: [1, 900, 160], race: [2, 780] }; return _ex_docSched.apply(this, arguments); };
function exRunEQ(k) { exRecordEQ(k, exGenEQ()); }
function exGenEQ() {
  const X = WK.ex, track = WK.track, rows = [], wet0 = (WK.weather.quali || 0) * rnd(0.5, 1);
  WK.entries.filter(e => !X.exempt.includes(e.d.id)).forEach(e => {
    const app = X.risk[e.d.id] || (myEntries().includes(e) ? 'std' : pick(['safe', 'std', 'std', 'push']));
    const wet = clamp(wet0 + rnd(-0.05, 0.05), 0, 1);
    const c = { d: e.d, t: e.t, tyre: wet > 0.65 ? 'W' : wet > 0.25 ? 'I' : 'M', wear: 0.02, mode: app === 'push' ? 'push' : app === 'safe' ? 'save' : 'std', setup: e.setup };
    const laps = []; let mist = 0;
    for (let n = 0; n < EX_LAPS; n++) {
      let lt = lapTimeFor(G, c, track, { lap: track.laps * 0.85, wet }) - 0.5;
      const mp = (app === 'push' ? 0.06 : app === 'safe' ? 0.012 : 0.03) * (1 + wet * 2) * (1.4 - e.d.cons / 100);
      if (Math.random() < mp) { lt += rnd(0.8, 3.5); mist++; }
      laps.push(lt);
      c.wear += (app === 'push' ? 0.03 : app === 'safe' ? 0.016 : 0.022) * (1 - (e.tyreKnow || 0) * 0.4);
    }
    const avg = laps.reduce((a, x) => a + x, 0) / EX_LAPS;
    rows.push({ id: e.d.id, avg, best: Math.min(...laps), laps, mist, app });
  });
  return rows;
}
function exRecordEQ(k, rows) {
  const X = WK.ex;
  rows.sort((a, b) => a.avg - b.avg);
  X.eq[k - 1] = rows; X.exempt.push(rows[0].id);
  try { // FIA timing sheet
    const sc = docSched(WK).eq[k - 1], best = rows[0].avg;
    docAdd('eq' + k, `Exemption Qualifying ${k} Classification`, 'Timing Sheet', sc[0], sc[1] + sc[2] + rint(10, 20), { kind: 'fp', label: `Exemption Qualifying ${k} — average of ${EX_LAPS} laps`, rows: rows.map((r, i) => ({ id: r.id, t: r.avg, laps: EX_LAPS, tod: (sc[1] + rnd(5, sc[2] - 3)) * 60 + rint(0, 59), gap: i ? r.avg - best : null, int: i ? r.avg - rows[i - 1].avg : null })) });
  } catch (e) { }
}
function exEnt(id) { return WK.entries.find(e => e.d.id === id); }
const EX_EQN = 3;
function exEqLeft() { const X = WK.ex; return X.eq.length < EX_EQN && WK.entries.length - X.exempt.length > 0; }
// after the three sessions: P1-P3 are the session winners, everyone else lines up on the average of their three averages
function exEqGrid() {
  const X = WK.ex, tot = {};
  X.eq.forEach(rows => rows.forEach(r => { (tot[r.id] = tot[r.id] || []).push(r.avg); }));
  X.mean = {}; Object.entries(tot).forEach(([id, a]) => { X.mean[id] = a.reduce((x, y) => x + y, 0) / a.length; });
  const ex = X.exempt.map(exEnt).filter(Boolean);
  const rest = WK.entries.filter(e => !X.exempt.includes(e.d.id)).sort((a, b) => (X.mean[a.d.id] ?? 1e9) - (X.mean[b.d.id] ?? 1e9));
  WK.grid = ex.concat(rest); X.done = true; X.gridSet = true; WK.stage = 'grid';
}
const _ex_toquali = A.toquali;
A.toquali = function (q) {
  if (exOn() && WK && WK.ex && WK.stage === 'fp' && !WK.ex.done) {
    if (q === true) { while (exEqLeft()) exRunEQ(WK.ex.eq.length + 1); exEqGrid(); return; }
    WK.stage = 'exq'; render(); window.scrollTo(0, 0); return;
  }
  return _ex_toquali.apply(this, arguments);
};
Object.assign(A, {
  exeq() { if (exEqLeft()) exRunEQ(WK.ex.eq.length + 1); render(); },
  exrisk(el) { WK.ex.risk[el.dataset.d] = el.dataset.v; render(); },
  exsat() { while (exEqLeft()) exRunEQ(WK.ex.eq.length + 1); render(); },
  exgrid() { while (exEqLeft()) exRunEQ(WK.ex.eq.length + 1); exEqGrid(); render(); window.scrollTo(0, 0); }
});
function exEqPage() {
  const X = WK.ex, t = WK.track, k = X.eq.length, more = exEqLeft(), mine = e => (G.player && e.t.id === G.player) || G.follow === e.d.id;
  const tbl = (rows, n) => { const best = rows[0].avg; return `<h3 class="ex-h">Exemption Qualifying ${n} <span class="dk-mut">· ${rows.length} drivers · ${EX_LAPS} laps each · best average → starts Grand Prix 1 from P${n}</span></h3><table class="dkfp"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="ra">Average</th><th class="ra">Gap</th><th class="ra hm">Best lap</th><th class="ra hm">Errors</th><th class="l hm">Approach</th></tr></thead><tbody>${rows.map((r, i) => { const e = exEnt(r.id);
    return `<tr class="${mine(e) ? 'me' : ''} ${i === 0 ? 'ex-win' : ''}" data-prof="${r.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}${i === 0 ? ` <b class="ex-badge">EXEMPT · GP1 P${n}</b>` : ''}</td><td class="l hm tcell">${esc(e.t.name)}</td><td class="ra"><b>${fmtLap(r.avg)}</b></td><td class="ra">${i ? '+' + (r.avg - best).toFixed(3) : ''}</td><td class="ra hm">${fmtLap(r.best)}</td><td class="ra hm">${r.mist || ''}</td><td class="l hm dk-mut">${{ safe: 'Steady', std: 'Balanced', push: 'Attack' }[r.app]}</td></tr>`; }).join('')}</tbody></table>`; };
  // running order for P4 onwards: the average of each driver's session averages so far
  let comb = '';
  if (k) {
    const tot = {}; X.eq.forEach(rows => rows.forEach(r => { (tot[r.id] = tot[r.id] || []).push(r.avg); }));
    const L = Object.entries(tot).filter(([id]) => !X.exempt.includes(id)).map(([id, a]) => ({ id, n: a.length, m: a.reduce((x, y) => x + y, 0) / a.length })).sort((a, b) => a.m - b.m);
    comb = `<h3 class="ex-h">${more ? 'Provisional ' : ''}Grand Prix 1 grid from P${X.exempt.length + 1} <span class="dk-mut">· average of each driver's session averages</span></h3><table class="dkfp"><thead><tr><th>Grid</th><th class="l">Driver</th><th class="ra">Overall average</th><th class="ra hm">Sessions</th></tr></thead><tbody>${L.map((r, i) => { const e = exEnt(r.id);
      return `<tr class="${mine(e) ? 'me' : ''}" data-prof="${r.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + X.exempt.length + 1).padStart(2, '0')}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="ra"><b>${fmtLap(r.m)}</b></td><td class="ra hm">${r.n}</td></tr>`; }).join('')}</tbody></table>`;
  }
  const my = myEntries().filter(e => !X.exempt.includes(e.d.id));
  const ctl = more && my.length ? `<div class="ex-ctl">${my.map(e => `<div><b>${esc(e.d.code)}</b> approach: ${[['safe', 'Steady'], ['std', 'Balanced'], ['push', 'Attack']].map(([v, l]) => `<button class="${(X.risk[e.d.id] || 'std') === v ? 'on' : ''}" data-a="exrisk" data-d="${e.d.id}" data-v="${v}">${l}</button>`).join('')}</div>`).join('')}<div class="dk-mut small">Attack is quicker but wears the tyres and makes more mistakes; Steady is the opposite.</div></div>` : '';
  const ex = X.exempt.map((id, i) => { const e = exEnt(id); return `<span class="ex-chip" style="--tc:${e.t.color}">GP1 P${i + 1} · ${esc(e.d.name)}</span>`; }).join('');
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Exemption Qualifying - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · SATURDAY · ${more ? `NEXT: EQ${k + 1} OF ${EX_EQN}` : 'COMPLETE'}</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">⏱️ Three sessions, one after another. Every driver runs ${EX_LAPS} laps on their own and the best <b>average</b> lap time wins: EQ1's winner starts Grand Prix 1 from P1, EQ2's from P2 and EQ3's from P3 — each winner sits out the later sessions. Everyone else lines up from P4 on the average of their three session averages. ${ex ? `<br>${ex}` : ''}</div>${ctl}
  ${comb}${X.eq.map((r, i) => tbl(r, i + 1)).reverse().join('')}</div>
  <div class="dk-fpfoot"><span class="sp"></span>${more ? `<button data-a="exsat">⏩ Simulate all</button><button data-a="exeq">⏩ Simulate EQ${k + 1}</button><button class="pri" data-a="exeqlive" data-enter="1">▶ Watch Exemption Qualifying ${k + 1} →</button>` : `<button class="pri" data-a="exgrid" data-enter="1">Sunday: form up for Grand Prix 1 →</button>`}</div></div>`;
}
function fmtLap(t) { if (t == null || !isFinite(t)) return '—'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + s.toFixed(3).padStart(6, '0'); }

// ---------- Saturday → grid: the two exempt drivers start P1 and P2 ----------
// small fields: knock-out sizes follow the drivers actually qualifying, leaving at least three for the final session
const _ex_qCut = qCut;
qCut = function (n) {
  if (exOn() && WK && WK.ex && WK.ex.qn && WK.stage === 'quali') { const P = WK.ex.qn; return Math.max(1, Math.min(_ex_qCut(P), Math.floor((P - 3) / 2))); }
  return _ex_qCut.apply(this, arguments);
};
const _ex_togrid = A.togrid;
A.togrid = function (q) {
  const wasQ = WK && WK.stage === 'quali';
  const r = _ex_togrid.apply(this, arguments);
  if (exOn() && WK && WK.ex && wasQ && WK.stage === 'grid' && !WK.ex.gridSet) {
    const ex = WK.ex.exempt.map(exEnt).filter(Boolean);
    WK.grid = ex.concat(WK.grid.filter(e => !ex.includes(e))); WK.ex.gridSet = true;
    if (q !== true) render();
  }
  return r;
};

// ---------- Sunday: Grand Prix 1, 2, 3 ----------
function exLaps(k) { const L = WK.track.laps; return Math.max(1, Math.round(WK.rev ? L / 2 : k === 2 ? L / 4 : L * 3 / 4)); }
hxChain('raceInit', race => {
  if (race.sprint || !exOn() || race.wk !== WK || !WK.ex) return;
  if (!WK.exg || WK.stage !== 'xbreak') WK.exg = { k: 1, parts: [], gridNow: null, out: null };
  const X = WK.exg; race.exk = X.k; race.laps = exLaps(X.k); if (WK.rev) { race.exRev = true; race.msg(`♻️ REVIVAL ROUND: ${race.cars.length} eliminated drivers · ${race.laps} laps. The first across the finish line rejoins the competition!`, true); return; }
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  const S = svCur(), elim = S && S.sched[WK.round];
  race.msg(X.k === 1 ? `🏁 Grand Prix 1: ${race.laps} laps · ${race.cars.length} cars. ${svFinal(G, WK.round) ? 'Endless final!' : elim ? `${elim} driver${elim > 1 ? 's' : ''} will be out of the season. Everyone outside the podium goes on to Grand Prix 2.` : 'Nobody can be eliminated this weekend.'}`
    : `⛔ Grand Prix 2: ${race.cars.length} cars.`, true);
});
function exClassify(R) {
  // classified = took the chequered flag on the lead lap; lapped cars (+1 lap, +2 laps…) and retirements are not classified
  const ord = R.order(), lead = ord.find(c => c.finished) || ord[0], need = lead ? lead.laps : R.laps;
  return ord.map((c, i) => ({ e: c.e || exEnt(c.d.id), id: c.d.id, pos: i + 1, laps: c.laps, time: c.finished ? c.finishT : null, out: c.out, lapped: !c.out && c.laps < need, elimd: !!c.elimd, best: c.best, stops: c.stops, grid: c.grid, cls: c.elimd ? true : (!c.out && c.finished && c.laps >= need) }));
}
function exDoc(R, k, rows) {
  try {
    const s = { rows: rows.map(r => ({ id: r.id, pos: r.pos, out: r.cls ? null : (r.out || (r.lapped ? `Not classified (+${rows[0].laps - r.laps} lap${rows[0].laps - r.laps > 1 ? 's' : ''})` : 'Not classified')), laps: r.laps, time: r.time, best: r.best, pts: 0 })) };
    // classified-but-retired cars still appear in the classified list
    s.rows.forEach((x, i) => { if (rows[i].cls && rows[i].out) x.time = x.time || null; });
    const D = docRaceData(s), sc = docSched(WK), end = sc.race[1] + (k - 1) * 70 + Math.round((D.leadT || 1800) / 60);
    docAdd('gp' + k, WK.rev ? 'Revival Grand Prix Classification' : `Grand Prix ${k} Classification`, 'Timing Sheet', sc.race[0], end + rint(4, 9), { kind: 'race', final: true, label: WK.rev ? 'Revival Grand Prix' : `Grand Prix ${k}`, data: D });
  } catch (e) { }
}
function exEndRow(r, extra) { return Object.assign({ pos: 0, c: { d: r.e.d, t: r.e.t, e: r.e }, id: r.id, team: r.e.t.id, out: r.cls ? null : r.out, laps: r.laps, time: r.time, grid: r.grid, best: r.best, stops: r.stops }, extra || {}); }
const _ex_finishRace = finishRace;
finishRace = function () {
  const R = RACE, X = WK && WK.exg;
  if (!R || R.sprint || !R.exk || !X) return _ex_finishRace.apply(this, arguments);
  const k = R.exk, rows = exClassify(R);
  X.parts.push({ k, laps: R.endless ? Math.max(...rows.map(r => r.laps || 0)) : R.laps, rows, endless: !!R.endless });
  exDoc(R, k, rows);
  const S = svCur(), kOut = S ? S.sched[WK.round] || 0 : 0, canElim = kOut > 0;
  let next = null, outs = [];
  if (k === 1 && canElim) {
    // Grand Prix 2 = everyone except the Grand Prix 1 podium (P4 onwards, not-classified cars included)
    next = rows.slice(Math.min(3, rows.length - 1)); X.gp2 = { size: next.length, kOut };
    if (next.length <= kOut) { outs = next.slice(-kOut); next = null; }
  } else if (k === 2) outs = rows.slice(-kOut);
  if (R.exRev) { next = null; outs = []; const n = (S && S.revN && S.revN[WK.round]) || 2; X.revWins = rows.filter(r => r.time != null).slice(0, n).map(r => r.id); X.revWin = X.revWins[0] || null; }
  if (next) {
    cancelAnimationFrame(raf);
    X.gridNow = next.map(r => r.e); X.k = k + 1; X.wet = R.wet;
    WK.stage = 'xbreak'; RACE = null;
    autosave(); raceBanner = ''; PAUSED = false; LIGHTS = null; TW.fl = null; TW.flKey = null; TW.greenUntil = 0; TW.prev = 'green';
    render(); window.scrollTo(0, 0); return;
  }
  // weekend over: combined classification — GP1 safe, GP2 safe, GP3 …, and the driver who is out last
  X.outs = outs.map(r => r.id); X.out = X.outs[0] || null;
  const used = new Set(), res = [];
  const add = (r, extra) => { if (used.has(r.id)) return; used.add(r.id); res.push(exEndRow(r, extra)); };
  const P = X.parts, later = j => new Set(P.slice(j).flatMap(p => p.rows.map(r => r.id)));
  if (R.endless && R.endless.fin) P[0].rows.forEach((r, i) => { const c = R.cars.find(x => x.d.id === r.id), pts = c ? c.epts : null; add(r, { exTxt: r.out === 'Out of points' ? `Out of points · lap ${r.laps}` : r.out ? `${r.out} · lap ${r.laps}` : `${pts} points left`, elimLap: 'END' }); });
  P.forEach((p, j) => { const nx = later(j + 1); p.rows.forEach(r => { if (!nx.has(r.id) && !X.outs.includes(r.id)) add(r, p.k > 1 ? { exTxt: `Grand Prix ${p.k} · P${r.pos}${R.endless && p.k === 2 ? ` · ${(R.cars.find(x => x.d.id === r.id) || {}).epts ?? '?'} points left` : r.cls ? '' : ' (NC)'}`, elimLap: 'GP' + p.k } : (r.cls ? {} : { exTxt: WK.rev ? 'not classified' : 'GP1 · not classified', elimLap: 'GP1' })); }); });
  outs.forEach(out => { const lastK = P.map(p => p.k).reverse().find(kk => P.find(p => p.k === kk).rows.some(r => r.id === out.id)); add(out, { exTxt: `OUT · Grand Prix ${lastK} P${out.pos}`, elimLap: 'GP' + lastK }); });
  res.forEach((r, i) => { r.pos = i + 1; });
  R.result = res;
  return _ex_finishRace.apply(this, arguments);
};
const _ex_startrace = A.startrace;
A.startrace = function (q) {
  if (!(exOn() && WK && WK.stage === 'xbreak' && WK.exg)) return _ex_startrace.apply(this, arguments);
  const X = WK.exg, keep = WK.grid, elimFlag = G.rules.elimRace;
  WK.grid = X.gridNow;
  try { _ex_startrace.call(this, q); } finally { WK.grid = keep; G.rules.elimRace = elimFlag; }
};
const _ex_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _ex_applyRaceResult.apply(this, arguments);
  try {
    if (race && race.exk && wk.exg) {
      const s = G0.results[G0.results.length - 1], X = wk.exg;
      s.exw = { parts: X.parts.map(p => ({ k: p.k, laps: p.laps, endless: p.endless, rows: p.rows.map(r => ({ id: r.id, pos: r.pos, cls: r.cls })) })), out: X.out, outs: X.outs, gp2: X.gp2, eq: (wk.ex && wk.ex.exempt) || [] };
      s.elimR = s.exw.parts.length > 1;
      s.rows.forEach(r => { const x = race.result.find(y => y.id === r.id); if (x && x.exTxt) { r.exTxt = x.exTxt; r.elimLap = x.elimLap; } else if (s.elimR) { delete r.elimLap; } });
      const S = svCur(G0);
      if (S) { S.exr = S.exr || {}; const m = {}; X.parts.forEach(p => p.rows.forEach(r => { (m[r.id] = m[r.id] || ['', ''])[p.k - 1] = r.cls ? String(r.pos) : 'NC'; })); S.exr[s.round - 1] = m; svArchive(G0); }
    }
  } catch (e) { console.error('exw', e); }
  return out;
};
const _ex_elimTimeTxt = elimTimeTxt;
elimTimeTxt = function (r) { return r.exTxt || _ex_elimTimeTxt.apply(this, arguments); };
// the combined result must not trigger the plain survival "last k" rule with a different driver: the out driver is last
// (survival already eliminates the last-placed driver still in, which is exactly X.out)

// ---------- pages ----------
function exBreakPage() {
  const X = WK.exg, P = X.parts[X.parts.length - 1], t = WK.track, k = P.k, mine = e => (G.player && e.t.id === G.player) || G.follow === e.d.id;
  const lead = P.rows[0], nextIds = X.gridNow.map(e => e.d.id);
  const timeTxt = r => !r.cls ? `NC${r.out ? ` (${String(r.out).split(/[ (]/)[0]})` : r.lapped ? ` (+${lead.laps - r.laps} Lap${lead.laps - r.laps > 1 ? 's' : ''})` : ''}` : r === lead ? fmtTime(r.time) : r.laps < lead.laps ? `+${lead.laps - r.laps} Lap${lead.laps - r.laps > 1 ? 's' : ''}` : r.time != null && lead.time != null ? '+' + (r.time - lead.time).toFixed(3) : '';
  const cls = P.rows.filter(r => r.cls), nc = P.rows.filter(r => !r.cls);
  const tr = r => { const e = r.e, go = nextIds.includes(r.id); return `<tr class="${mine(e) ? 'me' : ''} ${go ? 'elim' : ''}" data-prof="${r.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">${r.cls ? 'P' + String(r.pos).padStart(2, '0') : 'NC'}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="l hm tcell">${esc(e.t.name)}</td><td class="ra">${r.laps}</td><td class="ra">${timeTxt(r)}</td><td class="l">${go ? `<b class="ex-st bad">→ GP${X.k}</b>` : '<b class="ex-st good">Safe</b>'}</td></tr>`; };
  const head = '<thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="ra">Laps</th><th class="ra">Time/Gap</th><th class="l">Status</th></tr></thead>';
  const g = X.gp2 || { size: X.gridNow.length, kOut: 1, ret: 0, lap: 0 };
  const why = `This weekend <b>${g.kOut}</b> driver${g.kOut > 1 ? 's are' : ' is'} out of the season. Everyone except the Grand Prix 1 podium — <b>${g.size}</b> cars — races Grand Prix 2, an <b>endless</b> race: everyone starts on ${EX_EPTS} points, more than ${EX_GAP} s behind the car in front at a timing line costs 1 point, and at 0 you're out (a mechanical failure can be fixed for ${EX_FIX} points). It stops as soon as ${g.kOut} driver${g.kOut > 1 ? 's are' : ' is'} out — they're out of the season. After 2 hours, the fewest points left go out.`;
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Grand Prix ${k} Classification - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · ${P.laps} LAPS · NEXT: GRAND PRIX ${X.k} · ENDLESS · ${X.gridNow.length} CARS</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">🏁 ${why} Classified = took the chequered flag on the lead lap; lapped cars and retirements are not classified. Grand Prix ${X.k} starts in Grand Prix 1 classification order: ${X.gridNow.map(e => esc(e.d.code)).join(' · ')}</div>
  <table class="dkfp">${head}<tbody>${cls.map(tr).join('')}</tbody></table>${nc.length ? `<h3 class="ex-h">Not classified</h3><table class="dkfp">${head}<tbody>${nc.map(tr).join('')}</tbody></table>` : ''}</div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">Press ENTER/SPACE or click Form up.</span><span class="sp"></span><button data-a="skipgp">⏩ Skip to the result</button><button class="pri" data-a="startrace" data-enter="1">Form up for Grand Prix ${X.k} →</button></div></div>`;
}
const _ex_viewWeekend = viewWeekend;
viewWeekend = function () {
  if (exOn() && WK && WK.stage === 'exq' && WK.ex) return exEqPage();
  if (exOn() && WK && WK.stage === 'xbreak' && WK.exg) return exBreakPage();
  return _ex_viewWeekend.apply(this, arguments);
};
if (typeof DOC_ORDER !== 'undefined') { DOC_ORDER.splice(DOC_ORDER.indexOf('fp') + 1, 0, 'exq'); DOC_ORDER.splice(DOC_ORDER.indexOf('race') + 1, 0, 'xbreak'); }
// the normal race classification documents are replaced by one sheet per Grand Prix
const _ex_docRace = docRace;
docRace = function (s) { if (exOn() && WK && WK.exg) return; return _ex_docRace.apply(this, arguments); };

// grid note
const _ex_deskGrid = deskGrid;
deskGrid = function (sprint) {
  let html = _ex_deskGrid.apply(this, arguments);
  if (!exOn() || !WK.ex) return html;
  html = html.replace(/<div class="dk-mut dkg-note sv-note">[\s\S]*?<\/div>/, '');
  const S = svCur(), fin = svFinal(G, WK.round), elim = S && S.sched[WK.round];
  if (WK.rev) return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note"><b>♻️ Revival round:</b> only eliminated drivers race — one Grand Prix of ${exLaps()} laps (half distance), starting with the most recently eliminated at the front. The first ${(svCur() && svCur().revN && svCur().revN[WK.round]) || 1} across the finish line rejoin${((svCur() && svCur().revN && svCur().revN[WK.round]) || 1) > 1 ? '' : 's'} the competition at the next race.</div>$1`);
  const ex = WK.ex.exempt.map((id, i) => `${esc((exEnt(id) || { d: { code: id } }).d.code)} P${i + 1}`).join(', ') + (WK.ex.noQ ? ' (with so few drivers left there was no Saturday qualifying — the rest line up in Exemption Qualifying 2 order)' : WK.ex.oneQ ? ' (with so few drivers left, Saturday was a single pole-lap session with no shootout)' : '');
  const body = fin ? `<b>♾️ Endless final:</b> everyone starts on ${EX_EPTS} points; more than ${EX_GAP} s behind the car in front at a timing line costs 1 point, at 0 you're out; a mechanical failure can be fixed for ${EX_FIX} points. The last driver running is champion — or, if the 2-hour limit is reached, whoever has the most points left (ties go to the driver ahead on track).`
    : `Grand Prix 1 · ${exLaps(1)} laps (¾ distance) · all cars. ` + (elim ? `${elim} driver${elim > 1 ? 's' : ''} out this weekend: everyone from P4 in Grand Prix 1 → Grand Prix 2, an endless race on 100 points each. The first ${elim} out of points (or retired) ${elim > 1 ? 'are' : 'is'} out of the season.` : 'Nobody can be eliminated this weekend.');
  return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note"><b>🏁 Exemption weekend:</b> Exemption Qualifying winners: ${ex}; everyone else on their three-session average. ${body}</div>$1`);
};
// live header
const _ex_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _ex_updRace.apply(this, arguments);
  try {
    if (!exOn() || !RACE || !RACE.exk || !WK.exg) return r;
    const k = RACE.exk, lead = RACE.order().find(c => !c.out), lap = lead ? Math.min(RACE.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
    const S = svCur(), canElim = S && S.sched[WK.round] > 0;
    const tag = k === 1 ? (svFinal(G, WK.round) ? 'ENDLESS FINAL' : canElim ? `${S.sched[WK.round]} OUT · P4+ → GP2` : 'NO ELIMINATION') : `ENDLESS · ${S.sched[WK.round]} OUT`;
    const h = RACE.exRev ? `REVIVAL ROUND · LAP ${lap}/${RACE.laps} · FIRST ACROSS THE LINE IS BACK IN` : `GRAND PRIX ${k}/2 · LAP ${lap}/${RACE.laps} · ${tag}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
  } catch (e) { }
  return r;
};

// results page strip
const _ex_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  let html = _ex_dkRaceView.apply(this, arguments);
  const s = G.results[o.k]; if (!s || !s.exw || o.sprint) return html;
  const nm = id => G.drivers[id] ? esc(G.drivers[id].code || G.drivers[id].name) : id;
  html = html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)(Elimination )?(Race )?Results/, '$1Exemption Weekend Results');
  let strip = `<div class="heat-strip">${s.exw.eq.length ? `<span><b>Exempt</b> · ${s.exw.eq.map((id, i) => `P${i + 1} ${nm(id)}`).join(' · ')}</span>` : ''}${s.exw.parts.map(p => { const w = p.rows[0], nc = p.rows.filter(r => !r.cls); return `<span><b>Grand Prix ${p.k}</b>${p.endless ? ' · ♾️ endless' : ''} · ${p.laps} laps · ${p.rows.length} cars · ${p.endless ? `led by ${nm(w.id)}` : `won by ${nm(w.id)}`}${nc.length && !p.endless ? ` · NC: ${nc.map(r => nm(r.id)).join(', ')}` : ''}</span>`; }).join('')}${(s.exw.outs || (s.exw.out ? [s.exw.out] : [])).length ? `<span><b class="bad">⛔ Out of the season: ${(s.exw.outs || [s.exw.out]).map(nm).join(', ')}</b></span>` : ''}</div>`;
  if (s.exw.rev) { strip = `<div class="heat-strip"><span><b>♻️ Revival round</b> · eliminated drivers only · ${s.exw.parts[0].laps} laps</span><span>${(s.exw.revWins || [s.exw.revWin]).filter(Boolean).length ? `<b class="good">Back in the competition: ${(s.exw.revWins || [s.exw.revWin]).filter(Boolean).map(nm).join(', ')}</b>` : 'Nobody finished — no driver returns'}</span></div>`; html = html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)Exemption Weekend Results/, '$1Revival Round Results'); }
  if (s.exw.parts.length > 1) html = html.replace(/<section><div class="dk-h"><b>LAP LEADERS[\s\S]*?<\/section>/, ''); // leaders span three separate races
  return html.replace('<table class="dkfp dkrr">', strip + '<table class="dkfp dkrr">');
};

// ---------- regulations form: an exemption weekend fixes everything except equal cars and weather ----------
const EX_FORCED = { quali: 'era', race: 'gp', testing: 'off', refuel: 'off', orders: 'off', scr: 'era', sprint: 'off', dnf: 'on', standins: 'off', express: 'off', rnglaps: 'off', rotate: 'off', r107: 'off', pot: 'off', gamble: 'off' };
const EX_KEEP = /^(Weekend format|Equal cars|Weather)/;
const _ex_dkRegsForm = dkRegsForm;
dkRegsForm = function (r, act) {
  let html = _ex_dkRegsForm.apply(this, arguments);
  if (!(r && r.format === 'exempt')) return html;
  html = html.replace(/<label class="small"[^>]*>([^<$]*)<select[\s\S]*?<\/select><\/label>/g, (m, lab) => EX_KEEP.test(lab.trim()) ? m : '');
  html = html.replace(/<label class="small">Points for 1st[\s\S]*?<\/label>/, '');
  html = html.replace(/<div class="small sv-regnote"[^>]*>[\s\S]*?<\/div>/, '');
  return html.replace(/(<div class="grid g2" style="gap:10px">)/, `$1<div class="small sv-regnote" style="grid-column:1/-1">🏁 Exemption weekend sets its own rules: no points, FP1-3, three Exemption Qualifying sessions on Saturday, 1–3 drivers out per weekend, revival rounds (2 back), exactly 4 in an endless final, Grand Prix 1 (¾ distance) and an endless Grand Prix 2, no sprints, testing, refuelling, team orders, express pass, random laps, rotation or 107% rule; real safety-car rules and retirements on. Only equal cars and weather can be changed.</div>`);
};

// ---------- revival rounds ----------
const _ex_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  const L = _ex_weekendEntries.apply(this, arguments);
  { const S0 = svCur(G0); if (S0 && !S0.revN && S0.sched && S0.sched.revN) S0.revN = S0.sched.revN; }
  if (!exIsRev(G0, G0.round)) return L;
  const S = svCur(G0); if (!S) return L;
  const ids = Object.keys(S.out).sort((a, b) => S.out[b].r - S.out[a].r || S.out[a].pos - S.out[b].pos);
  if (!ids.length) return L;
  return ids.map(id => G0.drivers[id]).filter(d => d && !d.retired && (G0.teams[d.team] || G0.teams[d.hteam])).map(d => { const t = G0.teams[d.team] || G0.teams[d.hteam];
    return { d, t, setup: rnd(0.35, 0.5) + (t.id === G0.player ? 0 : rnd(0.1, 0.3)), tyreKnow: t.id === G0.player ? 0 : rnd(0.2, 0.5), qualiPrep: t.id === G0.player ? 0 : rnd(0.2, 0.5) }; });
};
const _ex_startWeekend2 = startWeekend;
startWeekend = function () {
  const r = _ex_startWeekend2.apply(this, arguments);
  if (WK && exIsRev(G, WK.round) && svCur() && Object.keys(svCur().out).length) {
    WK.rev = true; WK.ex.done = true; WK.ex.gridSet = true;
    WK.grid = WK.entries.slice(); // most recently eliminated starts at the front
    WK.stage = 'grid';
  }
  return r;
};
const _ex_applyRaceResult2 = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _ex_applyRaceResult2.apply(this, arguments);
  try {
    if (race && race.exRev && wk.exg) {
      const s = G0.results[G0.results.length - 1], S = svCur(G0), ws = wk.exg.revWins || [], w = ws[0] || null;
      if (G0.news && G0.news.length && /non-elimination/.test(G0.news[0].s || '')) G0.news.shift();
      s.surv = { elim: [], count: 0, rev: ws };
      s.exw.rev = true; s.exw.revWin = w; s.exw.revWins = ws;
      if (S) {
        S.revR = S.revR || {}; S.revR[s.round - 1] = ws;
        ws.forEach(id => { if (S.out[id]) { S.revived = S.revived || []; S.revived.push({ id, outR: S.out[id].r, revR: s.round - 1 }); delete S.out[id]; } });
        svArchive(G0);
      }
      news(G0, ws.length ? `♻️ Revival race at ${roundTrack(G0, s.round - 1).short}: ${ws.map(id => G0.drivers[id].name).join(' and ')} ${ws.length > 1 ? 'are' : 'is'} back in the competition!` : `♻️ Nobody finished the revival race at ${roundTrack(G0, s.round - 1).short} — no driver returns.`);
    }
  } catch (e) { console.error('exrev', e); }
  return out;
};

// one-session pole-lap qualifying for tiny fields
const _ex_applyQualiStage = applyQualiStage;
applyQualiStage = function (QS, res) {
  if (exOn() && WK && WK.ex && WK.ex.oneQ && WK.stage === 'quali') { QS.rounds.push({ stage: 3, res }); QS.top = res; QS.out1 = []; QS.out2 = []; QS.stage = 4; WK.grid = res.map(r => r.e); return; }
  return _ex_applyQualiStage.apply(this, arguments);
};

// ---------- Grand Prix 2: early chequered flag once enough cars have retired ----------
hxChain('onStep', race => {
  if (!race.exk || race.exk !== 2 || race.exEarly || race.done || !exOn() || race.endless) return; // (Grand Prix 2 is now endless — kept for old saves)
  const S = svCur(), k = S ? S.sched[WK.round] || 0 : 0; if (!k) return;
  if (race.cars.filter(c => c.out).length >= k) {
    const lead = race.order().find(c => !c.out); if (!lead) return;
    race.exEarly = true; race.laps = Math.min(race.laps, lead.laps + 1);
    race.msg(`🏁 ${k} car${k > 1 ? 's have' : ' has'} retired — the eliminations are decided. Chequered flag at the end of lap ${race.laps}!`, true);
  }
});

// ---------- the final: an endless Grand Prix ----------
// Everyone starts on 100 points. At every timing line (finish line and the two sector lines) a driver more than
// 5 s behind the car in front loses 1 point. At 0 they are out. A mechanical retirement can be undone for 10 points:
// the car is fixed and rejoins from the pit lane. The last driver still running wins the title; after 2 hours, the most points left wins.
const EX_EPTS = 100, EX_GAP = 5, EX_FIX = 10, EX_FIXT = 25, EX_TLIM = 7200;
hxChain('raceInit', race => {
  if (race.sprint || !exOn() || race.wk !== WK || !race.exk || WK.rev) return;
  const fin = svFinal(G, WK.round); if (!fin && race.exk !== 2) return;
  const S = svCur(), need = fin ? race.cars.length - 1 : Math.min(race.cars.length - 1, (S && S.sched[WK.round]) || 1);
  race.endless = { out: [], t0: null, need, fin }; race.laps = 999; // no lap count: points or the 2-hour limit end it
  race.cars.forEach(c => { c.epts = EX_EPTS; c.esec = 0; });
  if (!fin) { race.msg(`♾️ GRAND PRIX 2 — ENDLESS: everyone starts on ${EX_EPTS} points. More than ${EX_GAP} s behind the car in front at a timing line costs 1 point; at 0 you're out. A mechanical failure can be fixed for ${EX_FIX} points. It ends as soon as ${need} driver${need > 1 ? 's are' : ' is'} out — they're out of the season. After 2 hours, the fewest points left go out.`, true); return; }
  race.msg(`♾️ ENDLESS FINAL: everyone starts on ${EX_EPTS} points. More than ${EX_GAP} s behind the car in front at a timing line costs 1 point; at 0 you're out. A mechanical failure can be fixed for ${EX_FIX} points. Last driver running is champion! After 2 hours, the most points left wins.`, true);
});
const exCrash = why => /crash|collision|wall|spun|gravel|accident|barrier|contact|hit|off|out of points|disq/i.test(why || '');
hxChain('onStep', race => {
  const E = race.endless; if (!E || race.done) return;
  if (E.t0 == null && race.started) E.t0 = race.t;
  if (E.t0 != null && !E.timeUp && race.t - E.t0 >= EX_TLIM) { // 2-hour limit: most points left wins (ties: running order)
    E.timeUp = true;
    const run = race.order().filter(c => !c.out && !c.finished), rank = run.map((c, i) => ({ c, i })).sort((a, b) => b.c.epts - a.c.epts || a.i - b.i);
    rank.forEach(({ c }, j) => { c.finished = true; c.finishT = race.t + j * 0.001; });
    const w = rank[0] && rank[0].c;
    race.msg(E.fin ? `⏱️ 2 hours are up! ${w ? `${w.d.name} has the most points left (${w.epts}) and is champion!` : ''}` : `⏱️ 2 hours are up! The drivers with the fewest points left are out of the season.`, true);
    race.finish(); return;
  }
  const L = race.L, ord = race.order().filter(c => !c.out && !c.finished);
  ord.forEach((c, i) => {
    const sec = Math.floor(c.dist / (L / 3));
    if (sec <= c.esec) return; c.esec = sec;
    if (i === 0 || c.pitT > 0) return;
    const f = ord[i - 1], gap = (f.dist - c.dist) / (L / (c.curLT || 90));
    if (gap > EX_GAP) {
      c.epts--;
      if (c.epts <= 0) { c.epts = 0; c.epOut = true; E.out.push(c); race.retire(c, 'Out of points'); race.msg(`⛔ ${c.d.name} has run out of points — out of the ${E.fin ? 'final' : 'race and the season'}! ${ord.length - 1} left.`, true); }
    }
  });
  const alive = race.cars.filter(c => !c.out && !c.finished);
  if (E.fin && alive.length === 1 && !race.chequered) { alive[0].finished = true; alive[0].finishT = race.t; race.msg(`🏆 ${alive[0].d.name} is the last driver running — champion!`, true); race.finish(); return; }
  if (!E.fin && race.cars.length - alive.length >= E.need) { // Grand Prix 2: enough drivers are out — stop, the rest are safe
    race.order().filter(c => !c.out && !c.finished).forEach((c, j) => { c.finished = true; c.finishT = race.t + j * 0.001; });
    race.msg(`🏁 ${E.need} driver${E.need > 1 ? 's are' : ' is'} out — Grand Prix 2 is over. Everyone still running is safe!`, true); race.finish();
  }
});
const _ex_retire = Race.prototype.retire;
Race.prototype.retire = function (c, why) {
  if (this.endless && !c.epOut && !exCrash(why) && c.epts >= EX_FIX) {
    c.epts -= EX_FIX; c.pitT = EX_FIXT; c.wear = 0; c.fixes = (c.fixes || 0) + 1;
    this.msg(`🔧 ${c.d.name}: ${why} — spends ${EX_FIX} points to fix the car and rejoins from the pit lane (${c.epts} left)`, true);
    return;
  }
  return _ex_retire.apply(this, arguments);
};
const _ex_order = Race.prototype.order;
Race.prototype.order = function () {
  const o = _ex_order.apply(this, arguments);
  if (!this.endless) return o;
  const gone = this.endless.out.slice().reverse();
  return o.filter(c => !gone.includes(c) && !(c.out && !c.epOut)).concat(gone, o.filter(c => c.out && !c.epOut));
};
const _ex_updRace2 = updateRaceUI;
updateRaceUI = function () {
  const r = _ex_updRace2.apply(this, arguments);
  try {
    if (!RACE || !RACE.endless) return r;
    const ord = RACE.order(), lead = ord.find(c => !c.out), lap = lead ? lead.laps + 1 : 0, run = ord.filter(c => !c.out && !c.finished);
    const E = RACE.endless, left = E.t0 == null ? EX_TLIM : Math.max(0, EX_TLIM - (RACE.t - E.t0)), clk = `${Math.floor(left / 3600)}:${String(Math.floor(left % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const h = `♾️ ${E.fin ? 'ENDLESS FINAL' : `GRAND PRIX 2 · ENDLESS · ${E.need} OUT (${RACE.cars.length - run.length}/${E.need})`} · LAP ${lap} · ${E.timeUp ? 'TIME UP' : '⏱ ' + clk} · ${run.length} LEFT · ${run.map(c => `${c.d.code} ${c.epts}`).join(' · ')}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
    if (!E.timeUp) document.querySelectorAll('#dk td').forEach(td => { if (td.childElementCount === 0 && /\/999$/.test(td.textContent)) td.textContent = td.textContent.replace('/999', ''); });
    document.querySelectorAll('#dk tr[data-v]').forEach(tr => { const c = RACE.cars.find(x => x.d.id === tr.dataset.v); if (!c || c.epts == null) return;
      const td = tr.children[1]; if (!td) return; const b = td.querySelector('.ep-badge'), t = c.epOut ? 'OUT' : String(c.epts);
      if (!b) td.insertAdjacentHTML('beforeend', ` <i class="yd-badge ep-badge ${c.epts < 20 ? 'low' : ''}" title="Endless final points">${t}</i>`); else if (b.textContent !== t) { b.textContent = t; b.classList.toggle('low', c.epts < 20); } });
  } catch (e) { }
  return r;
};

// ---------- watch an Exemption Qualifying session live (same live timing screen as qualifying) ----------
function exEqLive() {
  const X = WK.ex, k = X.eq.length + 1, gen = exGenEQ(), list = gen.map(r => exEnt(r.id)).filter(Boolean);
  const Q = new QualiLive(G, WK, list, { dur: 600, label: `Exemption Qualifying ${k}`, cut: 0, runs: 1, risks: WK.risks || {} });
  const base = Q.base, OL = base * 1.35, IL = base * 1.4;
  let end = 0;
  Q.cars.forEach(c => {
    const g = gen.find(r => r.id === c.d.id); c.eqGen = g; c.eqL = [];
    let t = rnd(0, 0.25) * (OL + g.laps.reduce((a, x) => a + x, 0)); // their own time: staggered starts
    c.runs = g.laps.map((lt, i) => { const r = { start: t, OL: i === 0 ? OL * rnd(0.97, 1.04) : 0, IL: i === g.laps.length - 1 ? IL * rnd(0.97, 1.04) : 0, fly: lt, crash: false, done: false, aborted: false }; t += r.OL + lt; return r; });
    end = Math.max(end, t + IL);
  });
  Q.dur = end + 5; Q.eqk = k; Q.log = []; Q.msg(`🟢 Exemption Qualifying ${k} is under way — every driver runs ${EX_LAPS} timed laps; the best average wins and starts Grand Prix 1 from P${k}`);
  WK.ex.liveQ = { prevStage: WK.stage, prevQ: WK.Q };
  WK.Q = { stage: 1, alive: list, rounds: [], live: Q, exEq: k };
  WK.stage = 'quali'; PAUSED = false; SPEED = 16; render(); window.scrollTo(0, 0);
}
// each lap updates the driver's running average; the timing tower ranks on it
const _ex_lapDone = QualiLive.prototype.lapDone;
QualiLive.prototype.lapDone = function (c, lt) {
  const r = _ex_lapDone.apply(this, arguments);
  if (this.eqk && c.eqL) {
    c.eqL.push(lt); c.best = c.eqL.reduce((a, x) => a + x, 0) / c.eqL.length;
    if (c.eqL.length === EX_LAPS) { const done = this.cars.filter(o => o.eqL && o.eqL.length === EX_LAPS).sort((a, b) => a.best - b.best);
      if (done[0] === c) this.msg(`⏱️ ${c.d.name} completes ${EX_LAPS} laps with an average of ${fmtLap(c.best)} — the new benchmark`, true);
      else if (c.fav || c.player) this.msg(`⏱️ ${c.d.code} finishes: average ${fmtLap(c.best)} (P${done.indexOf(c) + 1} of the finished runs)`, false); }
  }
  return r;
};
const _ex_applyQualiStage2 = applyQualiStage;
applyQualiStage = function (QS, res) {
  if (QS && QS.exEq && WK.ex && WK.ex.liveQ) {
    const Q = WK.Q, k = QS.exEq, rows = [];
    (QS._cars || []).forEach(c => { const g = c.eqGen; rows.push(g); });
    exRecordEQ(k, rows);
    WK.Q = WK.ex.liveQ.prevQ; WK.stage = 'exq'; WK.ex.liveQ = null;
    return;
  }
  return _ex_applyQualiStage2.apply(this, arguments);
};
// keep the generated runs with the session object so the result can be recorded
const _ex_finishQualiLive = finishQualiLive;
finishQualiLive = function () {
  const QS = curQS(); if (QS && QS.exEq && QS.live) QS._cars = QS.live.cars;
  return _ex_finishQualiLive.apply(this, arguments);
};
A.exeqlive = function () { if (exEqLeft()) exEqLive(); };
const _ex_updQuali = updateQualiUI;
updateQualiUI = function () {
  const r = _ex_updQuali.apply(this, arguments);
  try {
    const Q = WK && WK.Q && WK.Q.exEq && WK.Q.live; if (!Q) return r;
    document.querySelectorAll('#dk th').forEach(th => { if (th.textContent === 'Best Lap') th.textContent = `Average (${EX_LAPS} laps)`; });
  } catch (e) { }
  return r;
};
