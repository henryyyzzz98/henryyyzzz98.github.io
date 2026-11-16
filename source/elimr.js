// ===================== Elimination Grand Prix (custom regulation) =====================
// The car in last place is eliminated every (race laps ÷ starters) laps, timed on the leader crossing the line.
// A retirement counts as that interval's elimination. The last car left wins; the rest are ranked by when they went out.
const elimOn = race => !!(race && race.elimR);
hxChain('raceInit', race => {
  if (race.sprint || !race.G.rules || !race.G.rules.elimRace) return;
  const N = race.cars.length, every = race.laps / N, sched = [];
  for (let k = 1; k < N; k++) sched.push(Math.max(1, Math.round(k * every)));
  race.elimR = { every, sched, k: 0, seen: 0, credit: 0, out: [] };
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  race.msg(`⛔ Elimination race: the last-placed car is out every ${every.toFixed(1)} laps (${race.laps} laps ÷ ${N} cars) — first at the end of lap ${sched[0]}`, true);
});
const _elimr_retire = Race.prototype.retire;
Race.prototype.retire = function (c, why, flag) {
  const r = _elimr_retire.apply(this, arguments);
  if (this.elimR && !c.elimd && !this.elimR.out.includes(c)) { this.elimR.out.push(c); c.elimLap = c.laps; this.elimR.credit++; }
  return r;
};
hxChain('onLap', (race, c, n) => {
  const R = race.elimR; if (!R || race.done || n <= R.seen) return;
  R.seen = n; // the leader has just completed lap n
  while (R.k < R.sched.length && R.sched[R.k] <= n) {
    R.k++;
    if (R.credit > 0) { R.credit--; race.msg(`⛔ Lap ${n}: no elimination — a retirement already took this interval's place`, false); continue; }
    const alive = race.order().filter(x => !x.out && !x.finished); if (alive.length <= 1) break;
    const last = alive[alive.length - 1];
    last.elimd = true; last.elimLap = n; R.out.push(last); last.finishT = race.t;
    _elimr_retire.call(race, last, 'Eliminated', null);
    race.msg(`⛔ ${last.d.name} is eliminated at the end of lap ${n} — P${alive.length}`, last.player || last.fav || alive.length <= 4);
  }
  const alive = race.cars.filter(x => !x.out && !x.finished);
  if (alive.length <= 1) {
    if (alive[0]) { alive[0].finished = true; alive[0].finishT = race.t; race.msg(`🏁 ${alive[0].d.name} is the last car standing and wins!`, true); }
    race.finish();
  }
});
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
function elimTimeTxt(r) { return r.out ? `DNF · lap ${r.elimLap}` : r.elimLap != null ? `Eliminated · lap ${r.elimLap}` : 'Last car standing'; }

// ---------- screens ----------
const _elimr_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _elimr_updRace.apply(this, arguments);
  try {
    const R = RACE && RACE.elimR; if (!R) return r;
    const alive = RACE.order().filter(x => !x.out && !x.finished), lead = alive[0], lap = lead ? Math.min(RACE.laps, lead.laps + 1) : R.seen;
    const nx = R.sched[R.k], danger = alive.length > 1 ? alive[alive.length - 1] : null;
    const h = `ELIM · LAP ${lap} · ${alive.length} LEFT${nx ? ` · OUT AFTER L${nx}${R.credit ? ' (retirement covers it)' : danger ? ` · <span class="q16">⚠ ${danger.d.code}</span>` : ''}` : ''}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
    if (danger && !R.credit) document.querySelectorAll('#dk tr[data-v]').forEach(tr => tr.classList.toggle('elimr-danger', tr.dataset.v === danger.d.id));
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
    html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Elimination race:</b> ${WK.track.laps} laps ÷ ${n} cars = the last-placed car is eliminated every ${every.toFixed(1)} laps (first at the end of lap ${Math.max(1, Math.round(every))}) · a retirement counts as that interval's elimination · the last car standing wins.</div>`); }
  return html;
};
