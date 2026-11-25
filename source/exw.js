// ===================== EXEMPTION WEEKEND (custom weekend format, survival season built in) =====================
// Friday:   FP1, FP2, then Exemption Qualifying 1 and 2 — every driver runs 12 laps; the best 12-lap average in each
//           session is exempt from qualifying and starts Grand Prix 1 from P1 (EQ1) / P2 (EQ2). The EQ1 winner sits out EQ2.
// Saturday: everyone else runs Pole-Lap Qualifying for P3 onwards.
// Sunday:   two Grands Prix, one after the other.
//   GP1 (3/4 distance) — everyone. Drivers NOT CLASSIFIED (lapped or retired) race GP2; if all are classified, the last 10.
//   GP2 (1/4 distance) — starts in the order of the FIA "not classified" list; the last-placed driver is out of the season.
// Revival rounds (1 if the season has up to 12 races, 2 if more): only eliminated drivers race one half-distance
// Grand Prix; the first across the line rejoins the competition. At least 4 drivers reach the final round.
// No points. One driver out per weekend; the winner of Grand Prix 1 at the last round is champion.
const exOn = (G0) => { G0 = G0 || G; return !!(G0 && G0.rules && G0.rules.exempt); };
const EX_LAPS = 12, EX_MIN_FINAL = 4;
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
    Object.assign(G0.rules, { exempt: true, quali: 'lapelim', endu: false, elimRace: false, heats: false, hybrid: false, intruder: false, poleElim: false, groups: false, forkRace: false, yieldRace: false, academy: false, polePts: 0 });
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

// survival plan: one driver out every weekend (never below two left); the last round only runs Grand Prix 1
const _ex_svPlan = svPlan;
svPlan = function (G0, ids) {
  if (!exOn(G0)) return _ex_svPlan.apply(this, arguments);
  const R = G0.cal.length, out = [], rev = exRevRounds(R); let alive = ids.length, gone = 0;
  for (let i = 0; i < R; i++) {
    if (rev.includes(i)) { out.push(0); if (gone > 0) { alive++; gone--; } continue; }
    const k = i < R - 1 && alive > EX_MIN_FINAL ? 1 : 0; out.push(k); alive -= k; gone += k;
  }
  return out;
};

// ---------- Friday: two practice sessions, then exemption qualifying ----------
const _ex_startWeekend = startWeekend;
startWeekend = function () {
  const r = _ex_startWeekend.apply(this, arguments);
  if (exOn() && WK) { WK.sessions = 2; WK.sprint = false; WK.ex = { eq: [], exempt: [], risk: {} }; }
  return r;
};
const _ex_docSched = docSched;
docSched = function (wk) { if (exOn() && wk && wk.ex) return { fp: [[0, 690, 60], [0, 810, 60]], eq: [[0, 960, 50], [0, 1070, 50]], q: [1, 960, 60], race: [2, 780] }; return _ex_docSched.apply(this, arguments); };
function exRunEQ(k) {
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
  rows.sort((a, b) => a.avg - b.avg);
  X.eq[k - 1] = rows; X.exempt.push(rows[0].id);
  try { // FIA timing sheet
    const sc = docSched(WK).eq[k - 1], best = rows[0].avg;
    docAdd('eq' + k, `Exemption Qualifying ${k} Classification`, 'Timing Sheet', sc[0], sc[1] + sc[2] + rint(10, 20), { kind: 'fp', label: `Exemption Qualifying ${k} — average of ${EX_LAPS} laps`, rows: rows.map((r, i) => ({ id: r.id, t: r.avg, laps: EX_LAPS, tod: (sc[1] + rnd(5, sc[2] - 3)) * 60 + rint(0, 59), gap: i ? r.avg - best : null, int: i ? r.avg - rows[i - 1].avg : null })) });
  } catch (e) { }
}
function exEnt(id) { return WK.entries.find(e => e.d.id === id); }
const _ex_toquali = A.toquali;
A.toquali = function (q) {
  if (exOn() && WK && WK.ex && WK.stage === 'fp' && !WK.ex.done) {
    if (q === true) { while (WK.ex.eq.length < 2 && WK.entries.length - WK.ex.exempt.length > 0) exRunEQ(WK.ex.eq.length + 1); WK.ex.done = true; return A.toquali(true); }
    WK.stage = 'exq'; render(); window.scrollTo(0, 0); return;
  }
  const r = _ex_toquali.apply(this, arguments);
  if (exOn() && WK && WK.ex && WK.stage === 'quali' && WK.Q) {
    WK.Q.alive = WK.Q.alive.filter(e => !WK.ex.exempt.includes(e.d.id)); WK.ex.qn = WK.Q.alive.length;
    if (WK.ex.qn <= 4) { // too few to run three knock-out sessions: they line up in Exemption Qualifying 2 order
      const eq = WK.ex.eq[WK.ex.eq.length - 1] || [], rank = id => { const i = eq.findIndex(r => r.id === id); return i < 0 ? 99 : i; };
      WK.ex.noQ = true; WK.grid = WK.Q.alive.slice().sort((a, b) => rank(a.d.id) - rank(b.d.id));
      WK.stage = 'grid'; const ex = WK.ex.exempt.map(exEnt).filter(Boolean); WK.grid = ex.concat(WK.grid.filter(e => !ex.includes(e))); WK.ex.gridSet = true;
      if (q !== true) render();
    }
  }
  return r;
};
Object.assign(A, {
  exeq() { const X = WK.ex; if (X.eq.length < 2 && WK.entries.length - X.exempt.length > 0) exRunEQ(X.eq.length + 1); render(); },
  exrisk(el) { WK.ex.risk[el.dataset.d] = el.dataset.v; render(); },
  exsat() { const X = WK.ex; while (X.eq.length < 2 && WK.entries.length - X.exempt.length > 0) exRunEQ(X.eq.length + 1); X.done = true; WK.stage = 'fp'; A.toquali(); }
});
function exEqPage() {
  const X = WK.ex, t = WK.track, k = X.eq.length, mine = e => (G.player && e.t.id === G.player) || G.follow === e.d.id;
  const tbl = (rows, n) => { const best = rows[0].avg; return `<h3 class="ex-h">Exemption Qualifying ${n} <span class="dk-mut">· ${rows.length} drivers · ${EX_LAPS} laps each · best average → starts GP1 from P${n}</span></h3><table class="dkfp"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="ra">Average</th><th class="ra">Gap</th><th class="ra hm">Best lap</th><th class="ra hm">Errors</th><th class="l hm">Approach</th></tr></thead><tbody>${rows.map((r, i) => { const e = exEnt(r.id);
    return `<tr class="${mine(e) ? 'me' : ''} ${i === 0 ? 'ex-win' : ''}" data-prof="${r.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}${i === 0 ? ` <b class="ex-badge">EXEMPT · GP1 P${n}</b>` : ''}</td><td class="l hm tcell">${esc(e.t.name)}</td><td class="ra"><b>${fmtLap(r.avg)}</b></td><td class="ra">${i ? '+' + (r.avg - best).toFixed(3) : ''}</td><td class="ra hm">${fmtLap(r.best)}</td><td class="ra hm">${r.mist || ''}</td><td class="l hm dk-mut">${{ safe: 'Steady', std: 'Balanced', push: 'Attack' }[r.app]}</td></tr>`; }).join('')}</tbody></table>`; };
  const my = myEntries().filter(e => !X.exempt.includes(e.d.id));
  const ctl = k < 2 && my.length ? `<div class="ex-ctl">${my.map(e => `<div><b>${esc(e.d.code)}</b> approach: ${[['safe', 'Steady'], ['std', 'Balanced'], ['push', 'Attack']].map(([v, l]) => `<button class="${(X.risk[e.d.id] || 'std') === v ? 'on' : ''}" data-a="exrisk" data-d="${e.d.id}" data-v="${v}">${l}</button>`).join('')}</div>`).join('')}<div class="dk-mut small">Attack is quicker but wears the tyres and makes more mistakes; Steady is the opposite.</div></div>` : '';
  const ex = X.exempt.map((id, i) => { const e = exEnt(id); return `<span class="ex-chip" style="--tc:${e.t.color}">GP1 P${i + 1} · ${esc(e.d.name)}</span>`; }).join('');
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Exemption Qualifying - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · FRIDAY · ${k < 2 ? `NEXT: EQ${k + 1}` : 'COMPLETE'}</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">⏱️ Every driver runs ${EX_LAPS} laps on their own. The best <b>average</b> lap time in each session is exempt from Saturday's qualifying: EQ1's winner starts Grand Prix 1 from P1 and sits out EQ2; EQ2's winner starts from P2. ${ex ? `<br>${ex}` : ''}</div>${ctl}
  ${X.eq.map((r, i) => tbl(r, i + 1)).reverse().join('')}</div>
  <div class="dk-fpfoot"><span class="sp"></span>${k < 2 ? `<button data-a="exsat">⏩ Run all</button><button class="pri" data-a="exeq" data-enter="1">Run Exemption Qualifying ${k + 1} →</button>` : `<button class="pri" data-a="exsat" data-enter="1">Saturday: Pole-Lap Qualifying →</button>`}</div></div>`;
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
  race.msg(X.k === 1 ? `🏁 Grand Prix 1: ${race.laps} laps · ${race.cars.length} cars. ${svFinal(G, WK.round) ? 'Final round — the winner is champion!' : elim ? 'Drivers not classified (or, if everyone is classified, the last 10) go on to Grand Prix 2.' : 'Nobody can be eliminated this weekend.'}`
    : `⛔ Grand Prix 2: ${race.laps} laps · ${race.cars.length} cars. The last-placed driver is out of the season.`, true);
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
  X.parts.push({ k, laps: R.laps, rows });
  exDoc(R, k, rows);
  const S = svCur(), canElim = S && S.sched[WK.round] > 0;
  let next = null, out = null;
  if (k === 1 && canElim) {
    const nc = rows.filter(r => !r.cls);
    next = nc.length ? nc : rows.filter(r => r.cls).slice(-Math.min(10, rows.length - 1));
    X.why2 = nc.length ? 'nc' : 'last10';
  } else if (k === 2) out = rows[rows.length - 1];
  if (R.exRev) { next = null; out = null; X.revWin = (rows.find(r => r.time != null) || {}).id || null; }
  if (next && next.length === 1) { out = next[0]; next = null; X.single = k + 1; }
  if (next) {
    cancelAnimationFrame(raf);
    X.gridNow = next.map(r => r.e); X.k = k + 1; X.wet = R.wet;
    WK.stage = 'xbreak'; RACE = null;
    autosave(); raceBanner = ''; PAUSED = false; LIGHTS = null; TW.fl = null; TW.flKey = null; TW.greenUntil = 0; TW.prev = 'green';
    render(); window.scrollTo(0, 0); return;
  }
  // weekend over: combined classification — GP1 safe, GP2 safe, GP3 …, and the driver who is out last
  X.out = out ? out.id : null;
  const used = new Set(), res = [];
  const add = (r, extra) => { if (used.has(r.id)) return; used.add(r.id); res.push(exEndRow(r, extra)); };
  const P = X.parts, later = j => new Set(P.slice(j).flatMap(p => p.rows.map(r => r.id)));
  P.forEach((p, j) => { const nx = later(j + 1); p.rows.forEach(r => { if (!nx.has(r.id) && r.id !== X.out) add(r, p.k > 1 ? { exTxt: `Grand Prix ${p.k} · P${r.pos}${r.cls ? '' : ' (NC)'}`, elimLap: 'GP' + p.k } : (r.cls ? {} : { exTxt: WK.rev ? 'not classified' : 'GP1 · not classified', elimLap: 'GP1' })); }); });
  if (out) { const lastK = P.map(p => p.k).reverse().find(kk => P.find(p => p.k === kk).rows.some(r => r.id === out.id)); add(out, { exTxt: `OUT · Grand Prix ${lastK} P${out.pos}${X.single ? ' (the only driver sent to Grand Prix ' + X.single + ')' : ''}`, elimLap: 'GP' + lastK }); }
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
      s.exw = { parts: X.parts.map(p => ({ k: p.k, laps: p.laps, rows: p.rows.map(r => ({ id: r.id, pos: r.pos, cls: r.cls })) })), out: X.out, why2: X.why2, eq: (wk.ex && wk.ex.exempt) || [] };
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
  const why = k === 1 ? (X.why2 === 'nc' ? `${nc.length} driver${nc.length > 1 ? 's were' : ' was'} not classified and race${nc.length > 1 ? '' : 's'} Grand Prix 2.` : `Every driver was classified, so the last ${X.gridNow.length} classified drivers race Grand Prix 2.`)
    : '';
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Grand Prix ${k} Classification - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · ${P.laps} LAPS · NEXT: GRAND PRIX ${X.k} · ${exLaps(X.k)} LAPS · ${X.gridNow.length} CARS</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">🏁 ${why} Classified = took the chequered flag on the lead lap; lapped cars and retirements are not classified. Grand Prix ${X.k} starts in the order of the ${X.why2 === 'last10' && k === 1 ? 'classification' : 'not-classified list'}: ${X.gridNow.map(e => esc(e.d.code)).join(' · ')}</div>
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
  if (WK.rev) return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note"><b>♻️ Revival round:</b> only eliminated drivers race — one Grand Prix of ${exLaps()} laps (half distance), starting with the most recently eliminated at the front. The first across the finish line rejoins the competition at the next race.</div>$1`);
  const ex = WK.ex.exempt.map((id, i) => `${esc((exEnt(id) || { d: { code: id } }).d.code)} P${i + 1}`).join(', ') + (WK.ex.noQ ? ' (with so few drivers left there was no Saturday qualifying — the rest line up in Exemption Qualifying 2 order)' : '');
  return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note"><b>🏁 Exemption weekend:</b> exempt from qualifying: ${ex}. Grand Prix 1 · ${exLaps(1)} laps (¾ distance) · all cars. ${fin ? '<b>Final round — the winner of Grand Prix 1 is champion.</b>' : elim ? `Not classified (lapped or retired — or, if all are classified, the last 10) → Grand Prix 2 (${exLaps(2)} laps, ¼ distance). Last place in Grand Prix 2 is out of the season.` : 'Nobody can be eliminated this weekend.'}</div>$1`);
};
// live header
const _ex_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _ex_updRace.apply(this, arguments);
  try {
    if (!exOn() || !RACE || !RACE.exk || !WK.exg) return r;
    const k = RACE.exk, lead = RACE.order().find(c => !c.out), lap = lead ? Math.min(RACE.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
    const S = svCur(), canElim = S && S.sched[WK.round] > 0;
    const tag = k === 1 ? (svFinal(G, WK.round) ? 'FINAL — WINNER IS CHAMPION' : canElim ? 'NC / LAST 10 → GP2' : 'NO ELIMINATION') : 'LAST PLACE IS OUT OF THE SEASON';
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
  let strip = `<div class="heat-strip">${s.exw.eq.length ? `<span><b>Exempt</b> · ${s.exw.eq.map((id, i) => `P${i + 1} ${nm(id)}`).join(' · ')}</span>` : ''}${s.exw.parts.map(p => { const w = p.rows[0], nc = p.rows.filter(r => !r.cls); return `<span><b>Grand Prix ${p.k}</b> · ${p.laps} laps · ${p.rows.length} cars · won by ${nm(w.id)}${nc.length ? ` · NC: ${nc.map(r => nm(r.id)).join(', ')}` : ''}</span>`; }).join('')}${s.exw.out ? `<span><b class="bad">⛔ Out of the season: ${nm(s.exw.out)}</b></span>` : ''}</div>`;
  if (s.exw.rev) { strip = `<div class="heat-strip"><span><b>♻️ Revival round</b> · eliminated drivers only · ${s.exw.parts[0].laps} laps</span><span>${s.exw.revWin ? `<b class="good">Back in the competition: ${nm(s.exw.revWin)}</b>` : 'Nobody finished — no driver returns'}</span></div>`; html = html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)Exemption Weekend Results/, '$1Revival Round Results'); }
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
  return html.replace(/(<div class="grid g2" style="gap:10px">)/, `$1<div class="small sv-regnote" style="grid-column:1/-1">🏁 Exemption weekend sets its own rules: no points, one driver out per weekend, revival rounds, Pole-Lap Qualifying, two Grands Prix (¾ and ¼ distance), no sprints, testing, refuelling, team orders, express pass, random laps, rotation or 107% rule; real safety-car rules and retirements on. Only equal cars and weather can be changed.</div>`);
};

// ---------- revival rounds ----------
const _ex_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  const L = _ex_weekendEntries.apply(this, arguments);
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
      const s = G0.results[G0.results.length - 1], S = svCur(G0), w = wk.exg.revWin;
      if (G0.news && G0.news.length && /non-elimination/.test(G0.news[0].s || '')) G0.news.shift();
      s.surv = { elim: [], count: 0, rev: w || null };
      s.exw.rev = true; s.exw.revWin = w;
      if (S) {
        S.revR = S.revR || {}; S.revR[s.round - 1] = w || null;
        if (w && S.out[w]) { S.revived = S.revived || []; S.revived.push({ id: w, outR: S.out[w].r, revR: s.round - 1 }); delete S.out[w]; }
        svArchive(G0);
      }
      news(G0, w ? `♻️ ${G0.drivers[w].name} wins the revival race at ${roundTrack(G0, s.round - 1).short} and is back in the competition!` : `♻️ Nobody finished the revival race at ${roundTrack(G0, s.round - 1).short} — no driver returns.`);
    }
  } catch (e) { console.error('exrev', e); }
  return out;
};
