// ===================== Elimination Grand Prix (custom regulation) =====================
// The car in last place is eliminated every (race laps ÷ starters) laps, timed on the leader crossing the line.
// A retirement does NOT replace an elimination: the next one still happens on schedule. The last car left wins; the rest are ranked by when they went out.
const elimOn = race => !!(race && race.elimR);
hxChain('raceInit', race => {
  if (race.sprint || !race.G.rules || !race.G.rules.elimRace) return;
  const N = race.cars.length, every = race.laps / N, sched = [];
  for (let k = 1; k < N; k++) sched.push(Math.max(1, Math.round(k * every)));
  race.elimR = { every, sched: sched.slice(0, Math.max(0, N - 2)), k: 0, seen: 0, credit: 0, post: 0, out: [], sweep: null, duel: false };
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  race.msg(`⛔ Elimination race: every ${every.toFixed(1)} laps (${race.laps} laps ÷ ${N} cars) the last car across the line is out — first on lap ${sched[0]}. The final two race to the flag.`, true);
});
const _elimr_retire = Race.prototype.retire;
Race.prototype.retire = function (c, why, flag) {
  const r = _elimr_retire.apply(this, arguments);
  if (this.elimR && !c.elimd && !this.elimR.out.includes(c)) { this.elimR.out.push(c); c.elimLap = c.laps; /* no credit: the schedule carries on */ }
  return r;
};
// Eliminations: when the leader completes a scheduled lap, that lap becomes an elimination lap and the LAST CAR
// ACROSS THE LINE on it is out. Held under SC/VSC until the next green-flag lap. Stops when two are left: they race to the flag.
function elimrAlive(race) { return race.order().filter(x => !x.out && !x.finished); }
function elimrCheckSweep(race) {
  const R = race.elimR, S = R.sweep; if (!S) return;
  for (const x of [...S.pending]) if (x.out || x.finished) S.pending.delete(x);
  while (S.k > 0 && R.credit > 0) { S.k--; R.credit--; }
  if (S.k <= 0) { R.sweep = null; return; }
  if (S.pending.size > S.k) return;
  const victims = race.order().filter(x => S.pending.has(x));
  R.sweep = null;
  victims.forEach(v => {
    const left = elimrAlive(race).length;
    v.elimd = true; v.elimLap = S.lap; R.out.push(v); v.finishT = race.t;
    _elimr_retire.call(race, v, 'Eliminated', null);
    race.msg(`⛔ ${v.d.name} is last across the line on lap ${S.lap} — eliminated, P${left}`, v.player || v.fav || left <= 4);
  });
  const al = elimrAlive(race);
  if (al.length === 2 && !R.duel) { R.duel = true; race.msg(`⚔️ Final duel: ${al[0].d.name} vs ${al[1].d.name} — no more eliminations, race to the flag!`, true); }
}
hxChain('onLap', (race, c, n) => {
  const R = race.elimR; if (!R || race.done) return;
  if (R.sweep && R.sweep.pending.has(c)) { R.sweep.pending.delete(c); elimrCheckSweep(race); }
  if (n <= R.seen) { elimrEnd(race); return; }
  R.seen = n; // the leader has just completed lap n
  let due = R.post; R.post = 0;
  while (R.k < R.sched.length && R.sched[R.k] <= n) { R.k++; due++; }
  while (due > 0 && R.credit > 0) { due--; R.credit--; race.msg(`⛔ Lap ${n}: a retirement takes this interval's elimination`, false); }
  const alive = elimrAlive(race);
  due = Math.min(due, alive.length - 2);
  if (due > 0 && !R.sweep) {
    if (race.sc || race.vsc) { const was = R.post; R.post += due; if (R.post > was && !R.heldN) race.msg(`🟨 Elimination held — it will happen on the next green-flag lap`, false); R.heldN = R.post; }
    else { R.heldN = 0; R.sweep = { lap: n, k: due, pending: new Set(alive.filter(x => x !== c)) }; race.msg(`⛔ Lap ${n} is an elimination lap: the last car across the line is out`, alive.slice(-3).some(x => x.player || x.fav)); elimrCheckSweep(race); }
  }
  elimrEnd(race);
});
function elimrEnd(race) {
  const alive = race.cars.filter(x => !x.out && !x.finished);
  if (alive.length === 1 && !race.chequered) { alive[0].finished = true; alive[0].finishT = race.t; race.msg(`🏁 ${alive[0].d.name} is the last car running and wins!`, true); race.finish(); }
}
// strategy: don't pit just before an elimination lap when near the back; pit straight after one instead
const _elimr_aiPit = Race.prototype.aiPit;
Race.prototype.aiPit = function (c) {
  const comp = _elimr_aiPit.apply(this, arguments);
  const R = this.elimR; if (!R || R.duel) return comp;
  const alive = elimrAlive(this), rank = alive.indexOf(c), danger = rank >= alive.length - 4;
  const nextLap = R.sweep ? R.sweep.lap : (R.sched[R.k] != null ? R.sched[R.k] : 1e9);
  // a stop at the end of lap L costs time on lap L+1: hold it if L+1 (or L+2) is an elimination lap
  if (comp && danger && c.wear < 0.9 && nextLap - c.laps >= 1 && nextLap - c.laps <= 2) return null;
  // just crossed the line safely on an elimination lap: the best moment to stop
  const safeNow = R.sweep && R.sweep.lap === c.laps && R.sweep.pending.size - 1 >= R.sweep.k;
  if (!comp && safeNow && c.wear > c.planStop - 0.15 && this.laps - c.laps > 5) return this.slick(c, this.laps - c.laps);
  return comp;
};
// classification: survivors on track first, then in reverse order of elimination
const _elimr_order = Race.prototype.order;
Race.prototype.order = function () {
  const o = _elimr_order.apply(this, arguments);
  if (!this.elimR) return o;
  const out = this.elimR.out.slice().reverse(), el = out.filter(c => c.elimd), dnf = out.filter(c => !c.elimd);
  return o.filter(c => !out.includes(c)).concat(el, dnf); // retirements are classified below every eliminated car
};
hxChain('raceFinish', race => {
  if (!elimOn(race)) return;
  race.cars.forEach(c => { if (c.elimd) { c.out = null; c.finished = true; c.finishT = c.finishT || race.t; } });
});
const _elimr_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _elimr_applyRaceResult.apply(this, arguments);
  try { if (elimOn(race)) { const s = G0.results[G0.results.length - 1]; s.elimR = true;
    s.rows.forEach(r => { const c = race.cars.find(x => x.d.id === r.id && x.t.id === r.team); if (c && c.elimLap != null) r.elimLap = c.elimLap; }); } } catch (e) { }
  return out;
};
function elimTimeTxt(r) { return r.out ? `DNF · lap ${r.elimLap}` : `Eliminated · lap ${r.elimLap}`; }

// ---------- screens ----------
const _elimr_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _elimr_updRace.apply(this, arguments);
  try {
    const R = RACE && RACE.elimR; if (!R) return r;
    const alive = RACE.order().filter(x => !x.out && !x.finished), lead = alive[0], lap = lead ? Math.min(RACE.laps, lead.laps + 1) : R.seen;
    const pend = R.sweep ? alive.filter(x => R.sweep.pending.has(x)) : null;
    const danger = R.duel ? null : pend ? pend[pend.length - 1] : alive.length > 2 ? alive[alive.length - 1] : null;
    const nx = R.sweep ? R.sweep.lap : R.sched[R.k] != null ? R.sched[R.k] : null;
    const st = R.duel ? ' · FINAL DUEL' : R.post ? ' · HELD (SAFETY CAR)' : R.sweep ? ` · ELIMINATION LAP` : nx ? ` · NEXT ELIM L${nx}` : '';
    const h = `ELIM · LAP ${lap} · ${alive.length} LEFT${st}${danger && !R.credit ? ` · <span class="q16">⚠ ${danger.d.code}</span>` : ''}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
    document.querySelectorAll('#dk tr[data-v]').forEach(tr => tr.classList.toggle('elimr-danger', !!danger && !R.credit && tr.dataset.v === danger.d.id));
  } catch (e) { }
  return r;
};
const _elimr_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  const html = _elimr_dkRaceView.apply(this, arguments);
  const s = G.results[o.k];
  return s && s.elimR && !o.sprint ? html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)Race Results/, '$1Elimination Results') : html;
};
const _elimr_deskGrid = deskGrid;
deskGrid = function (sprint) {
  let html = _elimr_deskGrid.apply(this, arguments);
  if (!sprint && G.rules && G.rules.elimRace) { const n = WK.grid.length, every = WK.track.laps / n;
    html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Elimination race:</b> ${WK.track.laps} laps ÷ ${n} cars = every ${every.toFixed(1)} laps the last car across the line is eliminated (first on lap ${Math.max(1, Math.round(every))}) · no eliminations under the safety car · a retirement counts as that interval's elimination · the final two race to the chequered flag.</div>`); }
  return html;
};
