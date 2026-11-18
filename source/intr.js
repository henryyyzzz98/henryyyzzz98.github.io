// ===================== Intruder Grand Prix =====================
// The slowest qualifier starts the race alone. Every (race laps ÷ entrants) laps, as the leader crosses the line,
// the next car up the qualifying order is released from the pit exit at racing speed (a flying start), slotting in
// right behind the leader — the pole sitter is the last intruder. Positions are on-track positions at the flag.
const intrOn = () => !!(G && G.rules && G.rules.intruder);
function intrPlan(laps, n) { return [...Array(n)].map((_, k) => k === 0 ? 0 : Math.max(1, Math.round(k * laps / n))); }
hxChain('raceInit', race => {
  if (race.sprint || !intrOn()) return;
  const N = race.cars.length, byGrid = race.cars.slice().sort((a, b) => b.grid - a.grid); // last qualifier first
  race.intr = { queue: byGrid, at: intrPlan(race.laps, N), next: 1 };
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  byGrid.forEach((c, k) => {
    if (k === 0) { c.dist = -5; return; }
    c.parked = true; c.pitT = 1e9; c.dist = -20 - k * 4;
  });
  const first = byGrid[0];
  race.msg(`🚪 Intruder Grand Prix: ${first.d.name} starts alone. A new car joins every ${(race.laps / N).toFixed(1)} laps — ${byGrid[1] ? byGrid[1].d.code : ''} is next, the pole sitter ${byGrid[N - 1].d.code} comes in last.`, true);
});
function intrRelease(race, leader) {
  const I = race.intr, n = race.leaderLap; let j = 0;
  while (I.next < I.queue.length && I.at[I.next] <= n) {
    const c = I.queue[I.next++]; if (c.out) continue;
    const v = race.L / Math.max(40, leader.curLT);
    c.parked = false; c.pitT = 0; c.spin = 0;
    c.dist = Math.max(0, leader.dist - v * 1.2 * (j + 1)); j++;
    c.laps = Math.floor(c.dist / race.L); c.cross = []; c.cross[c.laps] = race.t - 1.2 * j;
    c.wear = 0; c.age = 0; c.outLap = false; c.curLT = race.lapTime(c, n);
    const pos = race.order().filter(x => !x.parked && !x.out).indexOf(c) + 1;
    race.msg(`🚪 ${c.d.name} joins the race in P${pos}!${I.next < I.queue.length ? ` Next: ${I.queue[I.next].d.code} in ${I.at[I.next] - n} lap${I.at[I.next] - n === 1 ? '' : 's'}.` : ' The whole field is now out.'}`, true);
  }
}
hxChain('onLap', (race, c, n) => {
  if (!race.intr || race.sprint) return;
  if (n === race.leaderLap && race.intr.last !== n && !c.out) { race.intr.last = n; intrRelease(race, c); }
});
const _intr_gapStr = Race.prototype.gapStr;
Race.prototype.gapStr = function (c, leader) { if (c.parked) return 'GARAGE'; return _intr_gapStr.apply(this, arguments); };
const _intr_upd = updateRaceUI;
updateRaceUI = function () {
  const r = _intr_upd.apply(this, arguments);
  try {
    if (!RACE || !RACE.intr) return r;
    const I = RACE.intr, lead = RACE.order().find(c => !c.out && !c.parked), lap = lead ? Math.min(RACE.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
    const nx = I.queue[I.next], h = `INTRUDER · L${lap}/${RACE.laps}${nx ? ` · NEXT ${nx.d.code} L${I.at[I.next] + 1}` : ' · ALL OUT'}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = h; }
  } catch (e) { }
  return r;
};
if (typeof deskGrid === 'function') {
  const _intr_deskGrid = deskGrid;
  deskGrid = function (sprint) {
    let html = _intr_deskGrid.apply(this, arguments);
    if (!sprint && intrOn()) {
      const N = WK.grid.length, at = intrPlan(WK.track.laps, N), last = WK.grid[N - 1], pole = WK.grid[0];
      html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Intruder Grand Prix:</b> ${esc(last.d.name)} (P${N} in qualifying) starts alone. Every ${(WK.track.laps / N).toFixed(1)} laps the next car up the order joins at racing speed, right behind the leader. ${esc(pole.d.name)} on pole joins last, on lap ${at[N - 1] + 1} of ${WK.track.laps}.</div>`);
    }
    return html;
  };
}
// the broadcast layer must not call parked cars "pit stops"
if (typeof bcSample === 'function') {
  const _intr_bcSample = bcSample;
  bcSample = function (R) { R.cars.forEach(c => { if (c.parked) BC.inPit && BC.inPit.add(c); }); return _intr_bcSample.apply(this, arguments); };
}

// ===================== Express pass race =====================
// One random race each season: its winner earns an express pass and sits out the next Grand Prix, which pays half points.
function expInfo(G0) {
  G0 = G0 || G;
  if (!G0 || !G0.regs || G0.regs.express !== 'on' || G0.cal.length < 2) return null;
  if (!G0.express || G0.express.y !== G0.year) {
    const done = G0.results.length, lo = Math.min(done, G0.cal.length - 2);
    G0.express = { y: G0.year, r: rint(lo, G0.cal.length - 2), win: null };
    news(G0, `🎟️ Express pass race: the winner at ${roundTrack(G0, G0.express.r).short} (round ${G0.express.r + 1}) will skip ${roundTrack(G0, G0.express.r + 1).short}, which pays half points.`);
  }
  return G0.express;
}
const _exp_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  const L = _exp_weekendEntries.apply(this, arguments), E = expInfo(G0);
  if (E && E.win && G0.round === E.r + 1) return L.filter(e => e.d.id !== E.win);
  return L;
};
const _exp_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _exp_applyRaceResult.apply(this, arguments);
  try {
    const E = expInfo(G0), s = G0.results[G0.results.length - 1];
    if (E && race && !race.sprint && s) {
      const i = s.round - 1;
      if (i === E.r) { const w = s.rows.find(r => r.pos === 1 && !r.out); if (w) { E.win = w.id; s.express = 'win'; news(G0, `🎟️ ${w.name} wins the express pass race and will skip ${roundTrack(G0, E.r + 1).short}!`); } }
      if (i === E.r + 1) {
        s.express = 'half'; s.half = true;
        s.rows.forEach(r => { if (!r.pts) return; const np = r.pts / 2, delta = np - r.pts; r.pts = np; const d = G0.drivers[r.id]; if (d) { d.pts += delta; if (d.res && d.res.length) d.res[d.res.length - 1] += delta; } if (G0.teams[r.team]) G0.teams[r.team].pts += delta; });
        if (G0.rules && G0.rules.bestN && typeof recomputePoints === 'function') recomputePoints(G0);
      }
    }
  } catch (e) { console.warn('express', e); }
  return out;
};
if (typeof deskCalendar === 'function') {
  const _exp_deskCalendar = deskCalendar;
  deskCalendar = function () {
    let html = _exp_deskCalendar.apply(this, arguments);
    const E = expInfo(); if (!E) return html;
    const tag = (i, t, cls) => { html = html.replace(new RegExp(`(data-a="dkcalsel" data-v="${i}">[\\s\\S]*?<span class="nm">[^<]*</span>)`), `$1<span class="exp ${cls}">${t}</span>`); };
    tag(E.r, '🎟️ EXPRESS', 'x1'); tag(E.r + 1, '½ PTS', 'x2');
    return html;
  };
}
if (typeof deskGrid === 'function') {
  const _exp_deskGrid = deskGrid;
  deskGrid = function (sprint) {
    let html = _exp_deskGrid.apply(this, arguments);
    const E = expInfo(); if (!E || sprint) return html;
    const note = G.round === E.r ? `🎟️ <b>Express pass race:</b> the winner skips ${esc(roundTrack(G, E.r + 1).short)}, which pays half points.` : G.round === E.r + 1 ? `½ <b>Half points this race.</b>${E.win && G.drivers[E.win] ? ` ${esc(G.drivers[E.win].name)} is sitting this one out with the express pass.` : ''}` : '';
    return note ? html.replace('<div class="dk-mut dkg-note">', `<div class="dk-mut dkg-note exp-note">${note}</div><div class="dk-mut dkg-note">`) : html;
  };
}
