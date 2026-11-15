// ===================== Endurance Grand Prix (custom regulation) =====================
// Every car starts with 60 s on its clock (max 90 s). Completing a lap adds time (more on longer tracks),
// every car overtaken adds 10 s. Off-track moments freeze the distance counter. Each lap the field gets faster and
// more spread out, and mistakes become more likely. When the clock hits zero the car can no longer accelerate:
// it coasts to a stop, and the distance it covered from the start line is its result.
const ENDU = { start: 60, max: 90, pass: 10 };
const enduOn = race => !!(race && race.endu);
function enduLapBonus(track) { return Math.round(track.base * 1.06); }   // longer lap = more time
const enduKm = c => (Math.max(0, c.edist || 0) / 1000).toFixed(3);

hxChain('raceInit', race => {
  if (race.sprint || !race.G.rules || !race.G.rules.endu) return;
  race.endu = { bonus: enduLapBonus(race.track) };
  race.laps = 999;
  race.rules = Object.assign({}, race.rules, { sc: false, vsc: false, twoCompound: false });
  race.cars.forEach(c => { c.clk = ENDU.start; c.edist = 0; c.off = 0; c.coastF = null; c.passes = 0; c._pd = c.dist; });
  race.physOrder = function () { return this.cars.slice().sort((a, b) => (!!a.out !== !!b.out ? (a.out ? 1 : -1) : b.dist - a.dist)); };
  race.msg(`⏱ Endurance race: ${ENDU.start}s on every clock (max ${ENDU.max}s) · +${race.endu.bonus}s per lap (a third at each sector) · +${ENDU.pass}s per overtake`, true);
});
// speed: off-track moments and coasting once the clock has run out
{ const prev = XPH.speedMul; XPH.speedMul = function (race, c, dt) {
  let m = prev ? (prev.apply(this, arguments) ?? 1) : 1;
  if (!enduOn(race)) return prev ? m : undefined;
  if (c.coastF != null) return m * c.coastF;
  if (c.off > 0) return m * 0.18;
  return m;
}; }
// progressively faster and more spread out
{ const prev = XPH.lapDelta; XPH.lapDelta = function (race, c) {
  const a = prev ? prev.apply(this, arguments) || 0 : 0;
  if (!enduOn(race)) return a;
  const L = c.laps || 0, base = race.track.base;
  const raw = lapTimeFor(race.G, c, race.track, { lap: L, wet: race.wet, laps: race.laps });
  const faster = raw * (Math.max(0.9, 1 - 0.006 * L) - 1);
  const spread = Math.max(0, raw - base) * 0.06 * L;
  return a + faster + spread;
}; }
// lap bonus, paid a third at a time at each sector line (a real F1 lap is longer than the 60 s starting clock)
function enduSectors(race, c) {
  const S = race.L / 3, n = Math.floor(Math.max(0, c.dist) / S);
  if (c._sec == null) c._sec = 0;
  while (c._sec < n && !c.out && c.coastF == null) {
    c._sec++; const before = c.clk; c.clk = Math.min(ENDU.max, c.clk + race.endu.bonus / 3);
    if ((c.player || c.fav) && c._sec % 3 === 0) race.msg(`⏱ ${c.d.code} completes lap ${c._sec / 3}: clock ${c.clk.toFixed(1)}s`, false);
  }
}
// clock, distance counter, overtakes, off-track moments, coasting, end of race
hxChain('onStep', (race, dt) => {
  if (!enduOn(race) || race.done) return;
  const run = race.cars.filter(c => !c.out);
  for (const c of run) {
    enduSectors(race, c);
    const d0 = Math.max(0, c._pd), d1 = Math.max(0, c.dist);
    if (!(c.off > 0) && d1 > d0) c.edist += d1 - d0;          // off-track or in reverse: no distance
    if (c.off > 0) { c.off -= dt; if (c.off <= 0) { c.off = 0; if (c.player || c.fav) race.msg(`🟩 ${c.d.code} is back on track`, false); } }
    if (c.coastF == null) {
      c.clk -= dt;
      if (c.clk <= 0) {
        c.clk = 0;
        if (c.pitT > 0) { enduStop(race, c, 'in the pit lane'); continue; }
        c.coastF = 1; race.msg(`⌛ ${c.d.code} is out of time — coasting at ${enduKm(c)} km`, c.player || c.fav);
      } else if (c.pitT <= 0 && !(c.off > 0)) {
        // mistakes: more likely the further into the race (faster cars), for less consistent drivers and in the wet
        const L = c.laps || 0, perLap = 0.03 * Math.pow(1.2, L) * (1 + (100 - c.d.cons) / 30) * (1 + race.wet * 3);
        if (Math.random() < perLap * dt / Math.max(30, c.curLT)) {
          if (L >= 12 && Math.random() < 0.025) { race.retire(c, 'Crashed out', null); c.stopT = race.t; continue; }
          c.off = rnd(3, 9); race.msg(`🟥 ${c.d.code} runs off the track! Distance counter frozen`, c.player || c.fav);
        }
      }
    } else {
      c.coastF *= Math.exp(-dt / 2.6);
      if (c.coastF < 0.03) enduStop(race, c);
    }
  }
  // overtakes: +10 s for every running car passed on track (cars in the pits don't count)
  for (const a of run) {
    if (a.out || a.coastF != null) continue;
    for (const b of run) {
      if (a === b || b.out || b.pitT > 0) continue;
      if (a._pd < b._pd && a.dist > b.dist) { a.passes++; const was = a.clk; a.clk = Math.min(ENDU.max, a.clk + ENDU.pass);
        if (a.player || a.fav || b.player || b.fav) race.msg(`⚔️ ${a.d.code} passes ${b.d.code}: +${(a.clk - was).toFixed(0)}s`, false); }
    }
  }
  race.cars.forEach(c => { c._pd = c.dist; });
  if (race.cars.every(c => c.out)) race.finish();
});
function enduStop(race, c, where) {
  c.out = 'Out of time'; c.stopT = race.t; c.coastF = 0; c.dnfLap = c.laps;
  race.msg(`🛑 ${c.d.code} has stopped${where ? ' ' + where : ''} — ${enduKm(c)} km`, c.player || c.fav || race.cars.filter(x => !x.out).length <= 1);
}
// results: classified on distance; cars that ran out of time are classified, crashes/failures are DNFs
const _endu_order = Race.prototype.order;
Race.prototype.order = function () {
  if (!this.endu) return _endu_order.apply(this, arguments);
  return this.cars.slice().sort((a, b) => b.edist - a.edist); // the race ends for everyone when the car stops: furthest wins
};
hxChain('raceFinish', race => {
  if (!enduOn(race)) return;
  race.cars.forEach(c => { if (c.out) { if (c.out !== 'Out of time') c.why = c.out; c.out = null; c.finished = true; c.finishT = c.stopT || race.t; } });
  const w = race.order()[0]; if (w) race.msg(`🏁 ${w.d.name} wins the endurance race — ${enduKm(w)} km`, true);
});
const _endu_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _endu_applyRaceResult.apply(this, arguments);
  try { if (enduOn(race)) { const s = G0.results[G0.results.length - 1]; s.endu = true;
    s.rows.forEach(r => { const c = race.cars.find(x => x.d.id === r.id && x.t.id === r.team); if (c) { r.edist = Math.round(c.edist); r.passes = c.passes; if (c.why) r.why = c.why; } }); } } catch (e) { }
  return out;
};

// ---------- live screens ----------
const _endu_dkOrderTable = dkOrderTable;
dkOrderTable = function (kind, S, ord) {
  if (kind !== 'race' || !enduOn(RACE) || DK.tab === 'tyres' || DK.tab === 'sectors') return _endu_dkOrderTable.apply(this, arguments);
  const lead = ord[0];
  return `<table class="dkt"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th>Distance</th><th>Gap</th><th>Clock</th><th>Lap</th><th>Last</th><th>Tyre</th><th>Pass</th><th>St</th></tr></thead><tbody>${ord.map((c, i) => {
    const gone = c.out && !c.finished, stopped = c.out === 'Out of time' || c.finished, clk = Math.max(0, c.clk || 0);
    const st = gone && !stopped ? 'DNF' : stopped ? 'STOP' : c.coastF != null ? 'COAST' : c.off > 0 ? 'OFF' : c.pitT > 0 ? 'PIT' : '';
    const col = clk > 30 ? '#3ddc84' : clk > 12 ? '#ffd23f' : '#ff4d4d';
    return `<tr class="${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''}" style="--tc:${c.t.color};--ti:${dkInk(c.t.color)}" data-a="follow" data-v="${c.d.id}">
    <td>${i + 1}</td><td class="l">${esc(dkShort(c.d))}</td><td class="l hm">${esc(c.t.name)}</td><td><span class="endu-d ${c.off > 0 ? 'off' : ''}">${enduKm(c)} km</span></td>
    <td>${i === 0 ? '—' : '-' + ((lead.edist - c.edist) / 1000).toFixed(3)}</td>
    <td>${c.out ? '' : `<span class="endu-c"><i style="width:${Math.round(clk / ENDU.max * 100)}%;background:${col}"></i><b>${clk.toFixed(1)}</b></span>`}</td>
    <td>${c.laps}</td><td>${dkT(c.lastLap)}</td><td>${c.out ? '' : dkTy(c.tyre)}</td><td>${c.passes || 0}</td><td class="endu-st ${st.toLowerCase()}">${st}</td></tr>`; }).join('')}</tbody></table>`;
};
const _endu_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _endu_updRace.apply(this, arguments);
  try {
    if (!enduOn(RACE)) return r;
    const lap = Math.max(0, ...RACE.cars.map(c => c.laps)), left = RACE.cars.filter(c => !c.out).length;
    const h = `ENDURANCE · LAP ${lap} · ${left} RUNNING · +${RACE.endu.bonus}s/LAP`;
    const ds = document.getElementById('dksess'); if (ds && (ds._e !== h || ds._esrc !== ds._h)) { ds.innerHTML = h; ds._e = h; ds._esrc = ds._h; }
    const lc = document.getElementById('dklapc'); if (lc && lc._e !== 'LAP ' + lap) { lc.innerHTML = 'LAP ' + lap; lc._e = 'LAP ' + lap; }
  } catch (e) { }
  return r;
};
// results table: distance instead of race time
function enduTimeTxt(r, lead) {
  const km = x => (x.edist / 1000).toFixed(3) + ' km';
  if (r.out) return `DNF · ${km(r)}`;
  const why = r.why ? ` · ${r.why.length > 14 ? r.why.split(/[ (]/)[0] : r.why}` : '';
  return (r === lead || !lead || lead.edist == null ? km(r) : `${km(r)} (-${((lead.edist - r.edist) / 1000).toFixed(3)})`) + why;
}
const _endu_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  const html = _endu_dkRaceView.apply(this, arguments);
  const s = G.results[o.k];
  return s && s.endu && !o.sprint ? html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)Race Results/, '$1Endurance Results') : html;
};
// grid page: explain the format
const _endu_deskGrid = deskGrid;
deskGrid = function (sprint) {
  let html = _endu_deskGrid.apply(this, arguments);
  if (!sprint && G.rules && G.rules.endu) html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Endurance race:</b> every car starts with ${ENDU.start}s on its clock (max ${ENDU.max}s) · +${enduLapBonus(WK.track)}s for each lap (paid a third at each sector line) · +${ENDU.pass}s for each car overtaken · off-track driving doesn't count · when the clock hits zero the car coasts to a stop · furthest distance wins.</div>`).replace(/<div class="dkg-row"><span>DISTANCE<\/span><b>[^<]*<\/b><\/div>/, '<div class="dkg-row"><span>DISTANCE</span><b>Until every clock runs out</b></div>');
  return html;
};
