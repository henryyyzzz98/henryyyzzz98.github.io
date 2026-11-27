// ===================== Gamble grid slots + Random laps (custom regulations) =====================
const gbOn = () => !!(G && G.regs && G.regs.gamble === 'on');
const rngOn = () => !!(G && G.regs && G.regs.rnglaps === 'on');

// ---------- the points scale ----------
// A win from slot s is worth 5 points from pole rising smoothly to 100 points from the back of the grid.
// Other finishes slide down to 0 about 4½ places behind the starting slot, and go negative beyond that.
function gbWin(s, N) { return N > 1 ? 5 * Math.pow(20, (s - 1) / (N - 1)) : 5; }
function gbBreak(s) { return s + 4.5; }
function gbPts(s, f, N) { const w = gbWin(s, N), b = gbBreak(s); return Math.round(w * (b - f) / (b - 1)); }
function gbDnf(s, N) { return Math.min(0, gbPts(s, N, N)); } // a retirement scores 0, or last place's value if that's negative

// ---------- the draft ----------
function gbHuman(e) { return !G.spectator && G.player && e.t.id === G.player; }
function gbInit() {
  const order = WK.grid.slice(); // qualifying result = pick order
  WK.gb = { order: order.map(e => e.d.id), slot: {}, i: 0, N: order.length, risk: {} };
  order.forEach(e => { WK.gb.risk[e.d.id] = rnd(0.75, 1.35); });
  return WK.gb;
}
function gbEntry(id) { return WK.entries.find(e => e.d.id === id); }
function gbTaken() { return new Set(Object.values(WK.gb.slot)); }
function gbAiPick(id) {
  const B = WK.gb, N = B.N, rank = B.order.indexOf(id) + 1, taken = gbTaken(), a = B.risk[id], e = gbEntry(id);
  const dnf = 0.08 + (100 - (e ? e.d.cons : 80)) / 400;
  let best = null;
  for (let s = 1; s <= N; s++) {
    if (taken.has(s)) continue;
    const exp = rank + 0.45 * (s - rank); // where they expect to finish: their pace, pulled toward their starting slot
    let ev = 0, wsum = 0;
    for (let d = -4; d <= 4; d++) { const f = Math.min(N, Math.max(1, Math.round(exp + d * (0.6 + s / N)))), w = 5 - Math.abs(d); ev += w * gbPts(s, f, N); wsum += w; }
    ev = (ev / wsum) * (1 - dnf) + gbDnf(s, N) * dnf;
    const score = ev * (ev > 0 ? a : 1 / a) + rnd(-1.5, 1.5);
    if (!best || score > best.score) best = { s, score };
  }
  return best.s;
}
function gbRun(stopForHuman) { // run AI picks until a human driver is up (or the draft ends)
  const B = WK.gb;
  while (B.i < B.order.length) {
    const id = B.order[B.i], e = gbEntry(id);
    if (stopForHuman && e && gbHuman(e)) return;
    B.slot[id] = gbAiPick(id); B.i++;
  }
}
function gbFinish() {
  const B = WK.gb, bySlot = Object.entries(B.slot).sort((a, b) => a[1] - b[1]).map(([id]) => gbEntry(id)).filter(Boolean);
  WK.grid = bySlot; B.done = true;
}
const _gb_togrid = A.togrid;
A.togrid = function (q) {
  if (gbOn() && WK && WK.stage === 'quali' && !(WK.gb && WK.gb.done)) {
    if (!WK.gb) gbInit();
    gbRun(q !== true);
    if (q === true) { gbRun(false); gbFinish(); return _gb_togrid.apply(this, arguments); }
    WK.stage = 'gpick'; render(); window.scrollTo(0, 0); return;
  }
  return _gb_togrid.apply(this, arguments);
};
Object.assign(A, {
  gbpick(el) { const B = WK.gb, id = B.order[B.i], s = +el.dataset.v; if (gbTaken().has(s)) return; B.slot[id] = s; B.i++; gbRun(true); render(); },
  gbauto() { const B = WK.gb, id = B.order[B.i]; B.slot[id] = gbAiPick(id); B.i++; gbRun(true); render(); },
  gbgo() { gbRun(false); gbFinish(); WK.stage = 'quali'; _gb_togrid.call(A); }
});
function gbPage() {
  const B = WK.gb, N = B.N, t = WK.track, taken = new Map(Object.entries(B.slot).map(([id, s]) => [s, id])), curId = B.order[B.i], cur = curId && gbEntry(curId), my = cur && gbHuman(cur);
  const row = (id, k) => { const e = gbEntry(id), s = B.slot[id]; return `<tr class="${k === B.i ? 'gb-now' : ''} ${G.player && e.t.id === G.player ? 'me' : ''}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">Q${k + 1}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="l hm">${esc(e.t.name)}</td><td class="ra">${s ? `<b>P${s}</b>` : k === B.i ? '<span class="good">picking…</span>' : ''}</td><td class="ra">${s ? `win = ${Math.round(gbWin(s, N))}` : ''}</td></tr>`; };
  const slot = s => { const id = taken.get(s), e = id && gbEntry(id), w = Math.round(gbWin(s, N)), be = Math.min(N, Math.floor(gbBreak(s)));
    return `<button class="gb-slot ${id ? 'taken' : ''}" ${id || !my ? 'disabled' : `data-a="gbpick" data-v="${s}"`} style="${e ? `--tc:${e.t.color}` : ''}"><b>P${s}</b><span>win ${w}</span><small>${id ? esc(e.d.code) : be < N ? `0 pts at P${Math.ceil(gbBreak(s))}` : 'all finishes score'}</small></button>`; };
  const ex = s => `P1 ${gbPts(s, 1, N)} · P3 ${gbPts(s, 3, N)} · P6 ${gbPts(s, 6, N)} · P10 ${gbPts(s, 10, N)} · last ${gbPts(s, N, N)}`;
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Grid Slot Draft - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · GAMBLE GRID · ${B.i >= B.order.length ? 'DRAFT COMPLETE' : `PICK ${B.i + 1} OF ${N}`}</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">🎲 Qualifying sets the order drivers choose their grid slot. The slot sets what the race is worth: a win from pole pays ${Math.round(gbWin(1, N))}, from the back ${Math.round(gbWin(N, N))}. Finishing about 4–5 places behind your slot scores nothing, and worse loses points. ${my ? `<b class="good">Your pick: ${esc(cur.d.name)}.</b> Choose a slot below.` : ''}</div>
  <div class="gb-cols"><div><table class="dkfp"><thead><tr><th>Pick</th><th class="l">Driver</th><th class="l hm">Team</th><th class="ra">Slot</th><th class="ra">Value</th></tr></thead><tbody>${B.order.map(row).join('')}</tbody></table></div>
  <div><div class="gb-slots">${Array.from({ length: N }, (_, i) => slot(i + 1)).join('')}</div>
  <div class="dk-mut small" style="margin-top:8px">Examples — from P1: ${ex(1)}<br>from P${Math.ceil(N / 2)}: ${ex(Math.ceil(N / 2))}<br>from P${N}: ${ex(N)}</div></div></div></div>
  <div class="dk-fpfoot"><span class="sp"></span>${my ? `<button data-a="gbauto">Let the team strategist pick</button>` : ''}<button class="pri" data-a="gbgo" ${my ? '' : 'data-enter="1"'}>${B.i >= B.order.length ? 'Cars to the grid →' : 'Finish the draft →'}</button></div></div>`;
}
const _gb_viewWeekend = viewWeekend;
viewWeekend = function () { if (WK && WK.stage === 'gpick' && WK.gb) return gbPage(); return _gb_viewWeekend.apply(this, arguments); };
if (typeof DOC_ORDER !== 'undefined') DOC_ORDER.splice(DOC_ORDER.indexOf('quali') + 1, 0, 'gpick');

// grid page: what each slot is worth
if (typeof deskGrid === 'function') {
  const _gb_deskGrid = deskGrid;
  deskGrid = function (sprint) {
    let html = _gb_deskGrid.apply(this, arguments);
    if (!sprint && gbOn() && WK.gb && WK.gb.done) {
      const N = WK.gb.N, me = WK.grid.find(e => G.player ? e.t.id === G.player : e.d.id === G.follow);
      html = html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note gb-ann">🎲 Gamble grid: a win from pole pays ${Math.round(gbWin(1, N))}, from P${N} ${Math.round(gbWin(N, N))}.${me ? ` ${esc(me.d.code)} starts P${WK.gb.slot[me.d.id]} — a win is worth ${Math.round(gbWin(WK.gb.slot[me.d.id], N))}, finishing P${Math.ceil(gbBreak(WK.gb.slot[me.d.id]))} or worse costs points.` : ''}</div>$1`);
    }
    return html;
  };
}
// race points
const _gb_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _gb_applyRaceResult.apply(this, arguments);
  try {
    if (!gbOn() || !race || race.sprint || !wk.gb || !wk.gb.done) return out;
    const s = G0.results[G0.results.length - 1], N = wk.gb.N, teamDelta = {};
    let best = null;
    s.rows.forEach(r => {
      const slot = wk.gb.slot[r.id]; if (!slot) return;
      const nw = r.out ? gbDnf(slot, N) : gbPts(slot, r.pos, N), d = G0.drivers[r.id]; if (!d) return;
      const dl = nw - (r.pts || 0); d.pts += dl; if (d.res && d.res.length) d.res[d.res.length - 1] = nw;
      G0.teams[r.team].pts += dl; teamDelta[r.team] = (teamDelta[r.team] || 0) + dl; r.pts = nw; r.slot = slot;
      if (!best || nw > best.pts) best = { code: r.code, pts: nw, slot, pos: r.pos };
    });
    Object.entries(teamDelta).forEach(([t, dl]) => { G0.teams[t].money += dl * 0.12; });
    s.gamble = { best, N };
    if (G0.rules && G0.rules.bestN && typeof recomputePoints === 'function') recomputePoints(G0);
  } catch (e) { console.error(e); }
  return out;
};
// live championship projection
if (typeof potLive === 'function') {
  const _gb_potLive = potLive;
  potLive = function (R, running) {
    if (gbOn() && !R.sprint && WK.gb && WK.gb.done) { const add = {}; running.forEach((c, i) => { const s = WK.gb.slot[c.d.id]; if (s) add[c.d.id] = gbPts(s, i + 1, WK.gb.N); }); return add; }
    return _gb_potLive.apply(this, arguments);
  };
}
// results strip
const _gb_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  let html = _gb_dkRaceView.apply(this, arguments);
  const s = G.results[o.k];
  if (s && s.gamble && !o.sprint) {
    const b = s.gamble.best;
    html = html.replace('<table class="dkfp dkrr">', `<div class="heat-strip"><span><b>🎲 Gamble grid</b> · points set by each driver's chosen slot</span>${b ? `<span>Biggest haul: ${esc(b.code)} +${b.pts} (P${b.slot} → P${b.pos})</span>` : ''}</div><table class="dkfp dkrr">`);
  }
  return html;
};

// ---------- Random laps at half distance ----------
function rngAllowed(race) {
  const r = G.rules || {};
  return rngOn() && !race.sprint && !r.elimRace && !r.heats && !r.intruder && !r.poleElim && !r.groups && !r.endu && !r.hybrid && !r.forkRace && !r.endlessGP;
}
hxChain('onLap', (race, c, n) => {
  if (!race || !rngAllowed(race)) return;
  if (!race.rng && race.wk === WK && n >= Math.floor(race.laps / 2)) {
    const delta = typeof window.RNG_FORCE === 'number' ? window.RNG_FORCE : rint(-10, 10), from = race.laps, to = Math.max(n + 3, from + delta);
    race.laps = to; race.rng = { delta: to - from, at: n, from, to };
    race.msg(to === from ? `🎲 RANDOM LAPS at half distance: ±0 — the race stays at ${to} laps` : `🎲 RANDOM LAPS at half distance: ${to > from ? '+' : ''}${to - from} laps! The race is now ${to} laps instead of ${from}. ${to < from ? 'Teams switch to attack mode.' : 'Teams switch to tyre saving.'}`, true);
    if (typeof bcComm === 'function') try { bcComm('lead', to === from ? 'The random laps roll comes up zero — no change!' : `What a twist — ${Math.abs(to - from)} laps ${to > from ? 'added to' : 'taken off'} the race!`, 4); } catch (e) { }
  }
  // AI reacts to the new distance for the rest of the race
  if (race.rng && race.rng.delta && c.auto && !c.player && !c.finished) {
    const left = race.laps - n;
    if (race.rng.delta < 0) { if (c.wear < 0.7 || left <= 3) c.mode = 'push'; }
    else if (c.wear > 0.3 && left > 4) c.mode = 'save';
  }
});
const _rng_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _rng_updRace.apply(this, arguments);
  try {
    if (RACE && RACE.rng) { const ds = document.getElementById('dksess'); if (ds && !ds.querySelector('.rng-chip')) ds.insertAdjacentHTML('beforeend', ` <span class="rng-chip">🎲 ${RACE.rng.delta > 0 ? '+' : ''}${RACE.rng.delta} LAPS</span>`); }
    else if (RACE && !RACE.sprint && rngAllowed(RACE) && !RACE.rng) { const ds = document.getElementById('dksess'); if (ds && !ds.querySelector('.rng-chip')) ds.insertAdjacentHTML('beforeend', ` <span class="rng-chip pend">🎲 ±0–10 AT HALF DISTANCE</span>`); }
  } catch (e) { }
  return r;
};
