// ===================== Fork in the Road + Yield (Grand Prix formats), 107% rule, "Eliminated" status =====================

// ---------- shared helpers ----------
const isElimCar = c => !!(c && (c.elimd || /elim/i.test(c.out || '')));
function fyAlive(race) { return race.order().filter(x => !x.out && !x.finished); }

// =====================================================================
// FORK IN THE ROAD
// In qualifying order, each driver picks Group A or B (seeing both line-ups). Everyone starts the GP together.
// Every (laps ÷ (cars ÷ 2)) laps, on the leader crossing the line, the last car of EACH group is eliminated
// (3 cars on the first one if the field is odd: the bigger group loses its last two). When each group is down to
// one car, those two race to the flag. Retirements do not replace an elimination.
// =====================================================================
const fkOn = () => !!(G && G.rules && G.rules.forkRace);
function fkHuman(e) { return !G.spectator && G.player && e.t.id === G.player; }
function fkEntry(id) { return WK.entries.find(e => e.d.id === id); }
function fkCount(F, g) { return Object.values(F.grp).filter(x => x === g).length; }
function fkCapOk(F, g) { return fkCount(F, g) < Math.ceil(F.N / 2); }
function fkAiPick(id) {
  const F = WK.fork, a = fkCount(F, 'A'), b = fkCount(F, 'B');
  if (!fkCapOk(F, 'A')) return 'B'; if (!fkCapOk(F, 'B')) return 'A';
  // everyone already in a group qualified ahead: join the group with fewer faster cars (with a little gambling)
  if (a === b) return Math.random() < 0.5 ? 'A' : 'B';
  const better = a < b ? 'A' : 'B';
  return Math.abs(a - b) <= 1 && Math.random() < 0.25 ? (better === 'A' ? 'B' : 'A') : better;
}
function fkRun(stopForHuman) {
  const F = WK.fork;
  while (F.i < F.order.length) { const id = F.order[F.i], e = fkEntry(id); if (stopForHuman && e && fkHuman(e)) return; F.grp[id] = fkAiPick(id); F.i++; }
}
const _fk_togrid = A.togrid;
A.togrid = function (q) {
  if (fkOn() && WK && WK.stage === 'quali' && !(WK.fork && WK.fork.done)) {
    if (!WK.fork) { const order = WK.grid.map(e => e.d.id); WK.fork = { order, grp: {}, i: 0, N: order.length }; }
    fkRun(q !== true);
    if (q === true) { fkRun(false); WK.fork.done = true; return A.togrid.apply(this, arguments); }
    WK.stage = 'fkpick'; render(); window.scrollTo(0, 0); return;
  }
  return _fk_togrid.apply(this, arguments);
};
Object.assign(A, {
  fkpick(el) { const F = WK.fork, id = F.order[F.i], g = el.dataset.v; if (!fkCapOk(F, g)) return; F.grp[id] = g; F.i++; fkRun(true); render(); },
  fkauto() { const F = WK.fork, id = F.order[F.i]; F.grp[id] = fkAiPick(id); F.i++; fkRun(true); render(); },
  fkgo() { fkRun(false); WK.fork.done = true; WK.stage = 'quali'; A.togrid(); }
});
function fkSched(laps, N) {
  const every = laps / (N / 2), out = [];
  for (let k = 1; k <= N; k++) out.push(Math.max(1, Math.round(k * every)));
  return { every, sched: out };
}
function fkPage() {
  const F = WK.fork, t = WK.track, curId = F.order[F.i], cur = curId && fkEntry(curId), my = cur && fkHuman(cur);
  const S = fkSched(t.laps, F.N), odd = F.N % 2 === 1;
  const col = g => { const ids = F.order.filter(id => F.grp[id] === g);
    return `<div class="fk-col fk-${g.toLowerCase()}"><div class="fk-h"><b>GROUP ${g}</b><span class="dk-mut">${ids.length}/${Math.ceil(F.N / 2)}</span></div>${ids.map((id, k) => { const e = fkEntry(id);
      return `<div class="fk-row ${G.player && e.t.id === G.player ? 'me' : ''}" style="--tc:${e.t.color}"><span class="dk-mut">${k + 1}</span>${dkFlag(e.d.nat)} ${dkNm(e.d.name)}<span class="dk-mut small">Q${F.order.indexOf(id) + 1}</span></div>`; }).join('') || '<div class="dk-mut small">empty</div>'}
      ${my ? `<button class="pri fk-btn" data-a="fkpick" data-v="${g}" ${fkCapOk(F, g) ? '' : 'disabled'}>Join Group ${g}</button>` : ''}</div>`; };
  const left = F.order.slice(F.i).map(id => fkEntry(id)).filter(Boolean);
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Fork in the Road - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · ${F.i >= F.N ? 'GROUPS SET' : `PICK ${F.i + 1} OF ${F.N}`}</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">🔀 In qualifying order, each driver joins Group A or B. Both groups race together, but every ${S.every.toFixed(2)} laps (${t.laps} laps ÷ (${F.N} cars ÷ 2)) the last car of <b>each</b> group is eliminated${odd ? ' — 3 cars on the first one, as the field is odd' : ''}. The last car of each group then race each other to the flag. ${my ? `<b class="good">Your pick: ${esc(cur.d.name)} (Q${F.i + 1}).</b>` : ''}</div>
  <div class="fk-cols">${col('A')}${col('B')}<div class="fk-col fk-wait"><div class="fk-h"><b>STILL TO CHOOSE</b><span class="dk-mut">${left.length}</span></div>${left.map((e, k) => `<div class="fk-row ${k === 0 ? 'now' : ''}" style="--tc:${e.t.color}"><span class="dk-mut">Q${F.i + k + 1}</span>${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</div>`).join('')}</div></div></div>
  <div class="dk-fpfoot"><span class="sp"></span>${my ? `<button data-a="fkauto">Let the team strategist pick</button>` : ''}<button class="pri" data-a="fkgo" ${my ? '' : 'data-enter="1"'}>${F.i >= F.N ? 'Cars to the grid →' : 'Finish the picks →'}</button></div></div>`;
}
const _fk_viewWeekend = viewWeekend;
viewWeekend = function () { if (WK && WK.stage === 'fkpick' && WK.fork) return fkPage(); return _fk_viewWeekend.apply(this, arguments); };
if (typeof DOC_ORDER !== 'undefined') DOC_ORDER.splice(DOC_ORDER.indexOf('quali') + 1, 0, 'fkpick');

hxChain('raceInit', race => {
  if (race.sprint || !fkOn() || !WK || !WK.fork || !WK.fork.done || race.wk !== WK) return;
  const N = race.cars.length, S = fkSched(race.laps, N);
  race.cars.forEach(c => { c.fg = WK.fork.grp[c.d.id] || 'A'; });
  race.fk = { every: S.every, sched: S.sched, k: 0, seen: 0, post: 0, out: [], duel: false, first: true };
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  race.msg(`🔀 Fork in the Road: every ${S.every.toFixed(2)} laps the last car of each group is eliminated — first on lap ${S.sched[0]}. Group A: ${race.cars.filter(c => c.fg === 'A').length} cars · Group B: ${race.cars.filter(c => c.fg === 'B').length} cars.`, true);
});
const _fk_retire = Race.prototype.retire;
Race.prototype.retire = function (c) {
  const r = _fk_retire.apply(this, arguments);
  if (this.fk && !c.elimd && !this.fk.out.includes(c)) { this.fk.out.push(c); c.elimLap = c.laps; }
  return r;
};
function fkGroupAlive(race, g) { return fyAlive(race).filter(x => x.fg === g); }
function fkElim(race, v, n) {
  const F = race.fk, left = fyAlive(race).length;
  v.elimd = true; v.elimLap = n; F.out.push(v); v.finishT = race.t;
  _fk_retire.call(race, v, 'Eliminated', null);
  race.msg(`⛔ ${v.d.name} is last in Group ${v.fg} on lap ${n} — eliminated, P${left}`, v.player || v.fav || left <= 4);
}
hxChain('onLap', (race, c, n) => {
  const F = race.fk; if (!F || race.done) return;
  if (n <= F.seen) { fkEnd(race); return; }
  F.seen = n;
  let due = F.post; F.post = 0;
  while (F.k < F.sched.length && F.sched[F.k] <= n) { F.k++; due++; }
  if (due > 0 && fkGroupAlive(race, 'A').length <= 1 && fkGroupAlive(race, 'B').length <= 1) due = 0;
  if (due > 0) {
    if (race.sc || race.vsc) { if (!F.post) race.msg(`🟨 Fork eliminations held — they happen on the next green-flag lap`, false); F.post += due; }
    else for (let d = 0; d < due; d++) {
      const A0 = fkGroupAlive(race, 'A'), B0 = fkGroupAlive(race, 'B');
      if (A0.length <= 1 && B0.length <= 1) break;
      const vict = [];
      if (A0.length > 1) vict.push(A0[A0.length - 1]);
      if (B0.length > 1) vict.push(B0[B0.length - 1]);
      if (F.first && race.cars.length % 2 === 1) { // odd field: the bigger group loses two on the first elimination
        const big = A0.length > B0.length ? A0 : B0;
        if (big.length > 2) vict.push(big[big.length - 2]);
      }
      F.first = false;
      vict.forEach(v => fkElim(race, v, n));
    }
    const A1 = fkGroupAlive(race, 'A'), B1 = fkGroupAlive(race, 'B');
    if (A1.length <= 1 && B1.length <= 1 && !F.duel && A1.length + B1.length === 2) { F.duel = true; race.msg(`⚔️ Fork final: ${A1[0].d.name} (A) vs ${B1[0].d.name} (B) — race to the flag!`, true); }
  }
  fkEnd(race);
});
function fkEnd(race) {
  const alive = race.cars.filter(x => !x.out && !x.finished);
  if (alive.length === 1 && !race.chequered) { alive[0].finished = true; alive[0].finishT = race.t; race.msg(`🏁 ${alive[0].d.name} is the last car running and wins!`, true); race.finish(); }
}
const _fk_order = Race.prototype.order;
Race.prototype.order = function () {
  const o = _fk_order.apply(this, arguments);
  if (!this.fk) return o;
  const out = this.fk.out.slice().reverse(), el = out.filter(c => c.elimd), dnf = out.filter(c => !c.elimd);
  return o.filter(c => !out.includes(c)).concat(el, dnf);
};
hxChain('raceFinish', race => { if (race.fk) race.cars.forEach(c => { if (c.elimd) { c.out = null; c.finished = true; c.finishT = c.finishT || race.t; } }); });
const _fk_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _fk_applyRaceResult.apply(this, arguments);
  try { if (race && race.fk) { const s = G0.results[G0.results.length - 1]; s.elimR = true; s.fork = true;
    s.rows.forEach(r => { const c = race.cars.find(x => x.d.id === r.id && x.t.id === r.team); if (!c) return; r.fg = c.fg; if (c.elimLap != null) r.elimLap = c.elimLap; }); } } catch (e) { }
  return out;
};
// strategy: near the back of your group, don't pit just before an elimination lap
const _fk_aiPit = Race.prototype.aiPit;
Race.prototype.aiPit = function (c) {
  const comp = _fk_aiPit.apply(this, arguments);
  const F = this.fk; if (!F || F.duel || !comp) return comp;
  const grp = fkGroupAlive(this, c.fg), danger = grp.indexOf(c) >= grp.length - 3, nx = F.sched[F.k];
  if (danger && nx != null && c.wear < 0.9 && nx - c.laps >= 1 && nx - c.laps <= 2) return null;
  return comp;
};

// =====================================================================
// YIELD
// Every (laps ÷ cars) laps, as the leader crosses the line, the car in last place gets a penalty lap:
// one extra lap to drive before they can take the chequered flag.
// =====================================================================
const ydOn = () => !!(G && G.rules && G.rules.yieldRace);
const ydStrict = () => !!(G && G.regs && G.regs.yieldMode === 'strict');
hxChain('raceInit', race => {
  if (race.sprint || !ydOn()) return;
  const N = race.cars.length, every = race.laps / N, sched = [];
  for (let k = 1; k * every < race.laps; k++) sched.push(Math.max(1, Math.round(k * every)));
  race.cars.forEach(c => { c.extra = 0; });
  race.yd = { every, sched, k: 0, seen: 0, post: 0, given: 0 };
  race.msg(`🐢 Yield: every ${every.toFixed(1)} laps (${race.laps} laps ÷ ${N} cars) ${ydStrict() ? 'the last car' : "the last car that hasn't yielded yet"} gets a penalty lap — first on lap ${sched[0]}.`, true);
});
const ydLaps = c => c.laps - (c.extra || 0);
// running order counts a penalty lap as a lap down
const _yd_order = Race.prototype.order;
Race.prototype.order = function () {
  if (!this.yd) return _yd_order.apply(this, arguments);
  const L = this.L;
  return this.cars.slice().sort((a, b) => {
    if (!!a.out !== !!b.out) return a.out ? 1 : -1;
    if (a.out && b.out) return (b.dist - (b.extra || 0) * L) - (a.dist - (a.extra || 0) * L);
    if (a.finished && b.finished) return (ydLaps(b) - ydLaps(a)) || (a.finishT - b.finishT);
    if (a.finished !== b.finished) { const f = a.finished ? a : b, o = a.finished ? b : a; if (ydLaps(o) >= ydLaps(f)) return a.finished ? 1 : -1; return a.finished ? -1 : 1; }
    return (b.dist - (b.extra || 0) * L) - (a.dist - (a.extra || 0) * L);
  });
};
// a car owing penalty laps is not allowed to finish until they're done
const _yd_onLap = Race.prototype.onLap;
Race.prototype.onLap = function (c, tc) {
  if (!this.yd || !(c.extra > 0)) return _yd_onLap.apply(this, arguments);
  const n = c.laps, need = this.laps + c.extra;
  if (n >= need) { // penalty laps done: the original logic now lets them take the flag
    const laps = this.laps; this.laps = need; try { return _yd_onLap.apply(this, arguments); } finally { this.laps = laps; }
  }
  const ch = this.chequered, laps = this.laps; this.chequered = false; this.laps = need;
  try { return _yd_onLap.apply(this, arguments); }
  finally { this.chequered = ch || this.chequered; this.laps = laps; }
};
hxChain('onLap', (race, c, n) => {
  const Y = race.yd; if (!Y || race.done || race.chequered) return;
  // leader = first car to complete this many "real" laps
  const real = ydLaps(c); if (real <= Y.seen) return;
  Y.seen = real;
  let due = Y.post; Y.post = 0;
  while (Y.k < Y.sched.length && Y.sched[Y.k] <= real) { Y.k++; due++; }
  if (!due) return;
  if (race.sc || race.vsc) { Y.post += due; return; }
  for (let d = 0; d < due; d++) {
    const run = fyAlive(race); if (run.length < 2) return;
    // last place among the cars that haven't yielded yet (so one slow car doesn't collect every penalty); once everyone has, plain last place
    const fresh = ydStrict() ? [] : run.slice(1).filter(x => !x.yielded), v = fresh.length ? fresh[fresh.length - 1] : run[run.length - 1]; v.yielded = (v.yielded || 0) + 1; v.extra = (v.extra || 0) + 1; Y.given++;
    race.msg(`🐢 Lap ${real}: ${v.d.name} is ${v === run[run.length - 1] ? 'last' : `the last car yet to yield (P${run.indexOf(v) + 1})`} — penalty lap${v.extra > 1 ? ` (${v.extra} owed)` : ''}`, v.player || v.fav);
  }
});
// AI knows its own race distance
const _yd_aiPit = Race.prototype.aiPit;
Race.prototype.aiPit = function (c) {
  if (!this.yd || !(c.extra > 0)) return _yd_aiPit.apply(this, arguments);
  const laps = this.laps; this.laps = laps + c.extra;
  try { return _yd_aiPit.apply(this, arguments); } finally { this.laps = laps; }
};
const _yd_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _yd_applyRaceResult.apply(this, arguments);
  try { if (race && race.yd) { const s = G0.results[G0.results.length - 1]; s.yieldR = race.yd.given;
    s.rows.forEach(r => { const c = race.cars.find(x => x.d.id === r.id && x.t.id === r.team); if (c && c.extra) r.extra = c.extra; }); } } catch (e) { }
  return out;
};

// ---------- race screen header + tower badges ----------
const _fy_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _fy_updRace.apply(this, arguments);
  try {
    if (!RACE) return r;
    const ds = document.getElementById('dksess');
    if (RACE.fk) {
      const F = RACE.fk, A0 = fkGroupAlive(RACE, 'A'), B0 = fkGroupAlive(RACE, 'B'), lead = fyAlive(RACE)[0], lap = lead ? Math.min(RACE.laps, lead.laps + 1) : F.seen, nx = F.sched[F.k];
      const st = F.duel ? ' · FINAL' : F.post ? ' · HELD (SAFETY CAR)' : nx != null && (A0.length > 1 || B0.length > 1) ? ` · NEXT ELIM L${nx}` : '';
      const danger = [A0.length > 1 ? A0[A0.length - 1] : null, B0.length > 1 ? B0[B0.length - 1] : null].filter(Boolean);
      const h = `FORK · LAP ${lap} · A ${A0.length} · B ${B0.length}${st}${!F.duel && danger.length ? ` · <span class="q16">⚠ ${danger.map(x => x.d.code).join(' ')}</span>` : ''}`;
      if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
      document.querySelectorAll('#dk tr[data-v]').forEach(tr => { const c = RACE.cars.find(x => x.d.id === tr.dataset.v); if (!c || !c.fg) return;
        tr.classList.toggle('elimr-danger', !F.duel && danger.includes(c));
        const td = tr.children[1]; if (td && !td.querySelector('.fk-badge')) td.insertAdjacentHTML('afterbegin', `<i class="fk-badge fk-${c.fg.toLowerCase()}">${c.fg}</i>`); });
    }
    if (RACE.yd) {
      const Y = RACE.yd, nx = Y.sched[Y.k], owed = RACE.cars.filter(c => c.extra > 0 && !c.finished && !c.out);
      const run = fyAlive(RACE), fr = ydStrict() ? [] : run.slice(1).filter(x => !x.yielded), last = run.length > 1 ? (fr.length ? fr[fr.length - 1] : run[run.length - 1]) : null;
      const tag = ` <span class="rng-chip pend yd-chip">🐢 ${nx != null ? `YIELD L${nx}` : 'NO MORE YIELDS'}${last && nx != null ? ` · ⚠ ${last.d.code}` : ''}${owed.length ? ` · ${owed.length} OWE LAPS` : ''}</span>`;
      if (ds) { const old = ds.querySelector('.yd-chip'); if (old) old.outerHTML = tag; else ds.insertAdjacentHTML('beforeend', tag); }
      document.querySelectorAll('#dk tr[data-v]').forEach(tr => { const c = RACE.cars.find(x => x.d.id === tr.dataset.v); if (!c) return;
        const td = tr.children[1]; if (!td) return; const b = td.querySelector('.yd-badge');
        if (c.extra > 0 && !c.finished) { const t = `+${c.extra}L`; if (!b) td.insertAdjacentHTML('beforeend', ` <i class="yd-badge" title="Penalty laps still to drive">${t}</i>`); else if (b.textContent !== t) b.textContent = t; }
        else if (b) b.remove(); });
    }
  } catch (e) { }
  return r;
};
// grid page notes
const _fy_deskGrid = deskGrid;
deskGrid = function (sprint) {
  let html = _fy_deskGrid.apply(this, arguments);
  if (!sprint && fkOn() && WK.fork && WK.fork.done) {
    const n = WK.grid.length, S = fkSched(WK.track.laps, n), a = WK.grid.filter(e => WK.fork.grp[e.d.id] === 'A').map(e => e.d.code), b = WK.grid.filter(e => WK.fork.grp[e.d.id] === 'B').map(e => e.d.code);
    html = html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note"><b>🔀 Fork in the Road:</b> every ${S.every.toFixed(2)} laps the last car of each group is out (first on lap ${S.sched[0]}). <b>A:</b> ${a.join(' ')} · <b>B:</b> ${b.join(' ')}</div>$1`);
  }
  if (!sprint && ydOn()) { const n = WK.grid.length, every = WK.track.laps / n;
    html = html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note"><b>🐢 Yield:</b> every ${every.toFixed(1)} laps (${WK.track.laps} ÷ ${n}) ${ydStrict() ? 'the last car' : "the last car that hasn't yielded yet"} must drive one extra lap — first on lap ${Math.max(1, Math.round(every))}.</div>$1`); }
  if (WK.dnq107 && WK.dnq107.length && WK.dnq107.sprint === !!sprint) html = html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note bad">🚫 107% rule: ${WK.dnq107.map(x => `${esc(x.e.d.name)} (${x.pct.toFixed(1)}%)`).join(', ')} did not qualify — over 107% of the fastest ${WK.dnq107.ref} time.</div>$1`);
  return html;
};
// results header + time column
const _fy_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  let html = _fy_dkRaceView.apply(this, arguments);
  const s = G.results[o.k]; if (!s || o.sprint) return html;
  if (s.fork) html = html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)(Elimination )?(Race )?Results/, '$1Fork in the Road Results');
  if (s.yieldR != null) { const pens = s.rows.filter(r => r.extra);
    html = html.replace('<table class="dkfp dkrr">', `<div class="heat-strip"><span><b>🐢 Yield</b> · ${s.yieldR} penalty laps handed out</span>${pens.length ? `<span>${pens.sort((a, b) => b.extra - a.extra).slice(0, 6).map(r => `${esc(r.code)} +${r.extra}`).join(' · ')}</span>` : ''}</div><table class="dkfp dkrr">`); }
  return html;
};
const _fy_elimTimeTxt = elimTimeTxt;
elimTimeTxt = function (r) { const t = _fy_elimTimeTxt.apply(this, arguments); return r.fg ? `${t} · Grp ${r.fg}` : t; };

// =====================================================================
// 107% RULE: cars whose best time in the first qualifying session is more than 107% of the fastest don't start.
// =====================================================================
const r107On = () => !!(G && G.regs && G.regs.r107 === 'on');
function apply107(sq) {
  const QS = sq ? WK.SQ : WK.Q; if (!QS || !QS.rounds || !QS.rounds.length) return;
  const res = QS.rounds[0].res || [], times = res.filter(r => r.t != null && r.e), best = Math.min(...times.map(r => r.t));
  if (!isFinite(best)) return;
  const lim = best * 1.07, out = times.filter(r => r.t > lim).map(r => ({ e: r.e, t: r.t, pct: r.t / best * 100 }));
  const key = sq ? 'sgrid' : 'grid', grid = WK[key] || [];
  const keep = grid.filter(e => !out.some(x => x.e.d.id === e.d.id));
  if (keep.length < 2) return; // never wipe out the field
  WK[key] = keep;
  const tag = Object.assign(out, { sprint: !!sq, ref: G.rules && G.rules.quali === 'single' ? 'qualifying' : sq ? 'SQ1' : 'Q1' });
  WK.dnq107 = tag;
  if (out.length && typeof toast === 'function') toast(`🚫 107% rule: ${out.map(x => x.e.d.code).join(', ')} did not qualify`);
}
const _r107_togrid = A.togrid;
A.togrid = function (q) {
  if (r107On() && WK && (WK.stage === 'quali' || WK.stage === 'squali')) { const sq = WK.stage === 'squali'; if (!(sq ? WK.done107s : WK.done107)) { if (sq) WK.done107s = true; else WK.done107 = true; apply107(sq); } }
  return _r107_togrid.apply(this, arguments);
};
