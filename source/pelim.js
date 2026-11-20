// ===================== Pole-lap elimination Grand Prix (+ the Hybrid three-part version) =====================
// Pole-lap elimination: every (race laps ÷ starters) laps — counted on the RACE LEADER's laps — the car in last place
// at the moment the leader crosses the start/finish line is eliminated. Retirements don't replace eliminations.
// The final two race to the flag.
// Hybrid: the three-part Grand Prix, but each race's eliminations happen during the race the same way (timed on that
// race's leader): Race 1 and Race 2 drop their quota spread evenly through the race; Race 3 drops one car every
// (laps ÷ cars) laps until two are left to fight for the win.
hxChain('raceInit', race => {
  const R0 = race.G && race.G.rules; if (race.sprint || !R0) return;
  const hybrid = R0.hybrid && race.heat && WK.heat, solo = R0.poleElim;
  if (!hybrid && !solo) return;
  const N = race.cars.length, pole = race.cars.find(c => c.grid === 1) || race.cars[0];
  let sched = [], every;
  if (hybrid && race.heat < 3) { const q = WK.heat.elim[race.heat - 1]; every = race.laps / (q + 1); for (let k = 1; k <= q; k++) sched.push(Math.max(1, Math.round(k * every))); }
  else { every = race.laps / N; for (let k = 1; k <= N - 2; k++) sched.push(Math.max(1, Math.round(k * every))); }
  race.pe = { pole, lastN: 0, sched, k: 0, credit: 0, post: 0, out: [], duel: false, every, hybrid: !!hybrid };
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  const head = hybrid ? `🏁 Race ${race.heat} of 3 · ${race.laps} laps · ${N} cars` : '⛔ Pole-lap elimination';
  race.msg(`${head}: each time the leader completes lap ${sched.slice(0, 4).join(', ')}${sched.length > 4 ? '…' : ''} the car in last place is out${sched.length ? ` — ${sched.length} elimination${sched.length === 1 ? '' : 's'}` : ''}.${hybrid && race.heat < 3 ? '' : ' The final two race to the flag.'}`, true);
});
const _pe_retire = Race.prototype.retire;
Race.prototype.retire = function (c, why, flag) {
  const r = _pe_retire.apply(this, arguments);
  if (this.pe && !c.elimd && !this.pe.out.includes(c)) { this.pe.out.push(c); c.elimLap = c.laps; /* no credit: the schedule carries on */ }
  return r;
};
function peAlive(race) { return race.order().filter(x => !x.out && !x.finished); }
hxChain('onLap', (race, c, n) => {
  const E = race.pe; if (!E || race.done) return;
  if (n !== race.leaderLap || E.lastN === n || c.out) return; // only the leader's crossing (first car to complete lap n)
  E.lastN = n;
  let due = E.post; E.post = 0;
  while (E.k < E.sched.length && E.sched[E.k] <= n) { E.k++; due++; }
  while (due > 0 && E.credit > 0) { due--; E.credit--; race.msg(`⛔ Lap ${n}: a retirement takes this elimination`, false); }
  const alive = peAlive(race); due = Math.min(due, alive.length - 2);
  if (due <= 0) return;
  if (race.sc || race.vsc) { E.post += due; race.msg(`🟨 Elimination held — it happens on the next green-flag lap`, false); return; }
  for (let i = 0; i < due; i++) {
    const al = peAlive(race), v = al[al.length - 1]; if (!v || al.length <= 2) break;
    v.elimd = true; v.elimLap = v.laps; if (!E.out.includes(v)) E.out.push(v); v.finishT = race.t;
    _pe_retire.call(race, v, 'Eliminated', null);
    if (!v.out) v.out = 'Eliminated'; // never let a car stay on track after it is eliminated
    race.msg(`⛔ ${c.d.code} leads across the line (lap ${n}) — ${v.d.name} is last and eliminated, P${al.length}`, v.player || v.fav || al.length <= 5);
  }
  const al = peAlive(race);
  if (al.length === 2 && !E.duel && (!E.hybrid || race.heat === 3)) { E.duel = true; race.msg(`⚔️ Final duel: ${al[0].d.name} vs ${al[1].d.name} — race to the flag!`, true); }
});
const _pe_order = Race.prototype.order;
Race.prototype.order = function () {
  const o = _pe_order.apply(this, arguments);
  if (!this.pe) return o;
  const out = [...new Set(this.pe.out)].reverse(), el = out.filter(c => c.elimd), dnf = out.filter(c => !c.elimd);
  return o.filter(c => !out.includes(c)).concat(el, dnf);
};
hxChain('raceFinish', race => {
  if (!race.pe) return;
  race.cars.forEach(c => { if (c.elimd) { c.out = null; c.finished = true; c.finishT = c.finishT || race.t; } });
});
const _pe_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _pe_applyRaceResult.apply(this, arguments);
  try { if (race && race.pe) { const s = G0.results[G0.results.length - 1]; s.elimR = s.elimR || !race.heat;
    s.rows.forEach(r => { if (r.heatOut) return; const c = race.cars.find(x => x.d.id === r.id && x.t.id === r.team); if (c && c.elimLap != null && (c.elimd || c.out)) r.elimLap = c.elimLap + (race.heat && wk.heat ? wk.heat.lapOff : 0); }); } } catch (e) { }
  return out;
};
// AI: near the back, don't pit just before the pole sitter's elimination lap
const _pe_aiPit = Race.prototype.aiPit;
Race.prototype.aiPit = function (c) {
  const comp = _pe_aiPit.apply(this, arguments), E = this.pe; if (!E || E.duel || !comp) return comp;
  const alive = peAlive(this), rank = alive.indexOf(c), nxt = E.sched[E.k];
  if (nxt != null && rank >= alive.length - 4 && c.wear < 0.9 && alive[0] && nxt - alive[0].laps <= 1) return null;
  return comp;
};
// header + danger highlight
const _pe_upd = updateRaceUI;
updateRaceUI = function () {
  const r = _pe_upd.apply(this, arguments);
  try {
    const E = RACE && RACE.pe; if (!E) return r;
    const alive = peAlive(RACE), lead = alive[0], lap = lead ? Math.min(RACE.laps, lead.laps + 1) : 0, nx = E.sched[E.k];
    const danger = E.duel || nx == null ? null : alive[alive.length - 1];
    const pre = E.hybrid ? `RACE ${RACE.heat}/3 · ` : 'POLE ELIM · ';
    const h = `${pre}L${lap}/${RACE.laps} · ${alive.length} LEFT${E.duel ? ' · FINAL DUEL' : E.post ? ' · HELD (SC)' : nx != null ? ` · NEXT ELIM L${nx}` : ''}${danger && !E.credit ? ` · <span class="q16">⚠ ${danger.d.code}</span>` : ''}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
    document.querySelectorAll('#dk tr[data-v]').forEach(tr => tr.classList.toggle('elimr-danger', !!danger && !E.credit && tr.dataset.v === danger.d.id));
  } catch (e) { }
  return r;
};
const _pe_deskGrid = deskGrid;
deskGrid = function (sprint) {
  let html = _pe_deskGrid.apply(this, arguments);
  if (sprint || !G.rules) return html;
  if (G.rules.poleElim) { const n = WK.grid.length, every = WK.track.laps / n;
    html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Pole-lap elimination:</b> every ${every.toFixed(1)} laps (${WK.track.laps} ÷ ${n}) — counted on the race leader's laps — the car in last place when the leader crosses the line is eliminated. Held under the safety car · retirements count · the final two race to the flag.</div>`); }
  if (G.rules.hybrid) { const P = heatPlan(WK.track.laps, WK.grid.length);
    html = html.replace(/<div class="dk-mut dkg-note">[\s\S]*?<\/div>/, `<div class="dk-mut dkg-note"><b>Hybrid Grand Prix:</b> Race 1 · ${P.laps[0]} laps, ${P.elim[0]} cars out one at a time when the leader crosses the line → 20-min break → Race 2 · ${P.laps[1]} laps, ${P.elim[1]} out the same way → 40-min break → Race 3 · ${P.laps[2]} laps, last car out every ${(P.laps[2] / (WK.grid.length - P.elim[0] - P.elim[1])).toFixed(1)} laps of the leader until two are left. Each race forms up in the previous race's finishing order.</div>`); }
  return html;
};
