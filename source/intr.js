// ===================== Intruder Grand Prix =====================
// The slowest qualifier starts the race alone. Every (race laps ÷ entrants) laps, as the leader crosses the line,
// the next car up the qualifying order goes out for one timed flying lap on its own, then joins the race ahead of every
// car whose current race pace is slower — the pole sitter is the last intruder. Positions are on-track positions at the flag.
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
// Release: the car leaves the pit lane for one flying lap on its own, timed. When it's done, it joins the race ahead of
// every running car whose current race pace is slower than that flying lap (no one slower → it joins at the back).
function intrRelease(race, leader) {
  const I = race.intr, n = race.leaderLap;
  while (I.next < I.queue.length && I.at[I.next] <= n) {
    const c = I.queue[I.next++]; if (c.out) continue;
    c.wear = 0; c.age = 0; c.spin = 0;
    let fly = race.lapTime(c, n) * rnd(0.996, 1.008); const err = Math.random() < 0.04; if (err) fly += rnd(1.5, 4);
    c.fly = { t: fly, end: race.t + fly + 5, err };
    race.msg(`⏱️ ${c.d.name} heads out for his flying lap.`, c.fav || c.player);
  }
}
function intrJoin(race, c) {
  const F = c.fly; c.fly = null;
  const run = race.order().filter(x => x !== c && !x.parked && !x.out && !x.finished);
  const pace = x => x.curLT; // each car's current race pace (ignores safety-car and pit-stop laps, follows the weather and tyres)
  const k = run.findIndex(x => pace(x) > F.t); // first car (from the front) that is slower than the flying lap
  const v = race.L / Math.max(40, F.t);
  if (k < 0) { const tail = run.length ? run[run.length - 1].dist : 0; c.dist = Math.max(0, tail - v * 1.2); }
  else { const tgt = run[k], pre = run[k - 1]; let d = tgt.dist + v * 0.9; if (pre && d > pre.dist - v * 0.5) d = (tgt.dist + pre.dist) / 2; c.dist = d; }
  c.parked = false; c.pitT = 0; c.outLap = false;
  c.laps = Math.floor(c.dist / race.L); c.cross = []; c.cross[c.laps] = race.t - (c.dist - c.laps * race.L) / v;
  c.curLT = race.lapTime(c, race.leaderLap);
  const pos = race.order().filter(x => !x.parked && !x.out).indexOf(c) + 1, I = race.intr, nx = I.queue[I.next];
  const why = k < 0 ? `slower than everyone's race pace, so he joins at the back` : k === 0 ? `faster than the leader's race pace (${fmtTime(pace(run[0]))}) — straight into the lead!` : `quicker than ${run[k].d.code}'s race pace of ${fmtTime(pace(run[k]))}`;
  race.msg(`🚪 ${c.d.name}: flying lap ${fmtTime(F.t)}${F.err ? ' (a mistake!)' : ''} — ${why}${/[!.]$/.test(why) ? "" : "."} Joins in P${pos}.${nx ? ` Next: ${nx.d.code} on lap ${I.at[I.next] + 1}.` : ' The whole field is now out.'}`, true);
}
hxChain('onStep', race => {
  if (!race.intr) return;
  race.intr.queue.forEach(c => { if (c.fly && race.t >= c.fly.end && !c.out) intrJoin(race, c); });
});
hxChain('onLap', (race, c, n) => {
  if (!race.intr || race.sprint) return;
  if (n === race.leaderLap && race.intr.last !== n && !c.out) { race.intr.last = n; intrRelease(race, c); }
});
const _intr_gapStr = Race.prototype.gapStr;
Race.prototype.gapStr = function (c, leader) { if (c.parked) return c.fly ? 'FLY LAP' : 'GARAGE'; return _intr_gapStr.apply(this, arguments); };
const _intr_upd = updateRaceUI;
updateRaceUI = function () {
  const r = _intr_upd.apply(this, arguments);
  try {
    if (!RACE || !RACE.intr) return r;
    const I = RACE.intr, lead = RACE.order().find(c => !c.out && !c.parked), lap = lead ? Math.min(RACE.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
    const nx = I.queue[I.next], fl = I.queue.find(c => c.fly), h = `INTRUDER · L${lap}/${RACE.laps}${fl ? ` · ⏱ ${fl.d.code} ON FLYING LAP` : ''}${nx ? ` · NEXT ${nx.d.code} L${I.at[I.next] + 1}` : fl ? '' : ' · ALL OUT'}`;
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
      html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Intruder Grand Prix:</b> ${esc(last.d.name)} (P${N} in qualifying) starts alone. Every ${(WK.track.laps / N).toFixed(1)} laps the next car up the order does one timed flying lap on its own, then joins ahead of every car whose current race pace is slower (no one slower: at the back). ${esc(pole.d.name)} on pole joins last, on lap ${at[N - 1] + 1} of ${WK.track.laps}.</div>`);
    }
    return html;
  };
}
// the broadcast layer must not call parked cars "pit stops"
if (typeof bcSample === 'function') {
  const _intr_bcSample = bcSample;
  bcSample = function (R) { R.cars.forEach(c => { if (c.parked) BC.inPit && BC.inPit.add(c); }); return _intr_bcSample.apply(this, arguments); };
}

// ===================== Express pass races =====================
// A quarter of the rounds each season (picked at random) are express pass races: the winner sits out the next
// Grand Prix, which pays half points. An express race is never also a half-points race.
function expInfo(G0) {
  G0 = G0 || G;
  if (!G0 || !G0.regs || G0.regs.express !== 'on' || G0.cal.length < 2) return null;
  if (!G0.express || G0.express.y !== G0.year || !G0.express.list) {
    const N = G0.cal.length, K = Math.max(1, Math.round(N / 4)), from = Math.min(G0.results.length, N - 2), used = new Set(), list = [];
    shuffle([...Array(N - 1 - from)].map((_, i) => from + i)).forEach(r => { if (list.length < K && !used.has(r) && !used.has(r + 1)) { used.add(r); used.add(r + 1); list.push({ r, win: null }); } });
    list.sort((a, b) => a.r - b.r);
    G0.express = { y: G0.year, list };
    news(G0, `🎟️ ${list.length} express pass race${list.length === 1 ? '' : 's'} this season: ${list.map(e => roundTrack(G0, e.r).short).join(', ')}. Each winner skips the next race, which pays half points.`);
  }
  return G0.express;
}
const expAt = (E, i) => E && E.list.find(e => e.r === i);        // express race at round index i
const expHalf = (E, i) => E && E.list.find(e => e.r + 1 === i);  // round i pays half points (after express race e)
const _exp_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  const L = _exp_weekendEntries.apply(this, arguments), h = expHalf(expInfo(G0), G0.round);
  if (h && h.win) return L.filter(e => e.d.id !== h.win);
  return L;
};
const _exp_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _exp_applyRaceResult.apply(this, arguments);
  try {
    const E = expInfo(G0), s = G0.results[G0.results.length - 1];
    if (E && race && !race.sprint && s) {
      const i = s.round - 1, x = expAt(E, i), h = expHalf(E, i);
      if (x) { const w = s.rows.find(r => r.pos === 1 && !r.out); if (w) { x.win = w.id; s.express = 'win'; news(G0, `🎟️ ${w.name} wins the express pass race and will skip ${roundTrack(G0, i + 1).short}!`); } }
      if (h) {
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
    E.list.forEach(e => { tag(e.r, '🎟️ EXPRESS', 'x1'); tag(e.r + 1, '½ PTS', 'x2'); });
    return html;
  };
}
if (typeof deskGrid === 'function') {
  const _exp_deskGrid = deskGrid;
  deskGrid = function (sprint) {
    let html = _exp_deskGrid.apply(this, arguments);
    const E = expInfo(); if (!E || sprint) return html;
    const x = expAt(E, G.round), h = expHalf(E, G.round);
    const note = x ? `🎟️ <b>Express pass race:</b> the winner skips ${esc(roundTrack(G, G.round + 1).short)}, which pays half points.` : h ? `½ <b>Half points this race.</b>${h.win && G.drivers[h.win] ? ` ${esc(G.drivers[h.win].name)} is sitting this one out with the express pass.` : ''}` : '';
    return note ? html.replace('<div class="dk-mut dkg-note">', `<div class="dk-mut dkg-note exp-note">${note}</div><div class="dk-mut dkg-note">`) : html;
  };
}
