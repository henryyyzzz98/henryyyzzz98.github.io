// ===================== Group Grand Prix (custom regulation) =====================
// Qualifying splits the field into thirds: top third = Group A, next third = Group B, last third = Group C.
// Each group runs its own race over 1/3 of the Grand Prix distance, alone on the circuit (Group C first, Group A last).
// Every car runs the full group distance — nobody is waved off a lap down.
// The Grand Prix result is every driver's total time at their chequered flag, fastest first. Retirements go to the bottom.
const grpOn = () => !!(G && G.rules && G.rules.groups);
const GRP_NAMES = ['A', 'B', 'C'];
const GRP_RUN = [2, 1, 0]; // running order: C, B, A
function grpSizes(n) { const b = Math.floor(n / 3), r = n % 3; return [b + (r > 0 ? 1 : 0), b + (r > 1 ? 1 : 0), b]; }
function grpLaps(laps) { return Math.max(1, Math.round(laps / 3)); }
function grpSplit(grid) { const s = grpSizes(grid.length); return [grid.slice(0, s[0]), grid.slice(s[0], s[0] + s[1]), grid.slice(s[0] + s[1])]; }
function grpOf(e) { const P = WK && WK.grp; if (!P) return null; const i = P.groups.findIndex(g => g.includes(e)); return i < 0 ? null : GRP_NAMES[i]; }
function grpNew() {
  WK.grp = { k: 1, groups: grpSplit(WK.grid), laps: grpLaps(WK.track.laps), parts: [], wet: null, plan0: null, lapOff: 0 };
  return WK.grp;
}
function grpCur(P) { return GRP_RUN[P.k - 1]; }

// ---------- starting each group race ----------
const _grp_startrace = A.startrace;
A.startrace = function (q) {
  if (!grpOn() || !WK || WK.sprint && WK.stage === 'sgrid') return _grp_startrace.apply(this, arguments);
  if (WK.stage !== 'gbreak' && WK.stage !== 'grid') return _grp_startrace.apply(this, arguments);
  const P = WK.stage === 'gbreak' && WK.grp ? WK.grp : grpNew(), keep = WK.grid;
  if (P.k > 1) WK.entries.forEach(e => { if (!(G.player && e.t.id === G.player)) e.startTyre = P.laps <= 12 ? pick(['S', 'S', 'S', 'M']) : pick(['S', 'M', 'M', 'H']); });
  WK.grid = P.groups[grpCur(P)];
  try { _grp_startrace.call(this, q); } finally { WK.grid = keep; }
};
hxChain('raceInit', race => {
  if (race.sprint || !grpOn() || race.wk !== WK || !WK.grp) return;
  const P = WK.grp, gi = grpCur(P);
  race.grp = P.k; race.grpName = GRP_NAMES[gi]; race.laps = P.laps;
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  if (P.k > 1 && P.wet != null) { // the weather carries on from where the last group finished
    race.wet = race.wetTarget = P.wet;
    race.plan = (P.plan0 || []).filter(p => p.lap > P.lapOff).map(p => Object.assign({}, p, { lap: p.lap - P.lapOff }));
    race.cars.forEach(c => { if (race.wet > 0.6) c.tyre = 'W'; else if (race.wet > 0.22) c.tyre = 'I'; c.used = new Set([c.tyre]); });
  } else P.plan0 = race.plan.slice();
  race.msg(`🏁 Group ${race.grpName} (${P.k} of 3): ${race.laps} laps · ${race.cars.length} cars on track alone. Every car runs the full distance — total time decides the Grand Prix.`, true);
});
// every car completes the full group distance: no waving lapped cars off at the chequered flag
const _grp_onLap = Race.prototype.onLap;
Race.prototype.onLap = function (c, tc) {
  if (!this.grp) return _grp_onLap.apply(this, arguments);
  const ch = this.chequered;
  if (ch && c.laps < this.laps) this.chequered = false;
  try { return _grp_onLap.apply(this, arguments); } finally { if (ch) this.chequered = true; }
};

// ---------- ending each group race ----------
function grpRows(race) {
  return race.order().map((c, i) => ({ e: c.e, pos: i + 1, laps: c.laps, time: c.finished ? c.finishT : null, out: c.out, best: c.best, stops: c.stops }));
}
function grpStandings(P) { // everyone who has raced so far, by total time; retirements last
  const all = P.parts.flatMap(p => p.rows.map(r => Object.assign({ g: p.g }, r)));
  const fin = all.filter(r => !r.out && r.time != null).sort((a, b) => a.time - b.time);
  const dnf = all.filter(r => r.out || r.time == null).sort((a, b) => (b.laps - a.laps));
  return fin.concat(dnf);
}
const _grp_finishRace = finishRace;
finishRace = function () {
  const R = RACE, P = WK && WK.grp;
  if (!R || R.sprint || !R.grp || !P) return _grp_finishRace.apply(this, arguments);
  const cross = R.cars.map(c => ({ id: c.d.id, x: c.cross.slice(0, R.laps + 1) }));
  P.parts.push({ k: R.grp, g: R.grpName, laps: R.laps, rows: grpRows(R), cross, fastest: R.fastest ? { e: R.fastest.c.e, t: R.fastest.t } : null });
  P.wet = R.wet; P.lapOff += R.laps;
  if (R.grp < 3) {
    cancelAnimationFrame(raf);
    P.k = R.grp + 1; WK.stage = 'gbreak'; RACE = null;
    autosave(); raceBanner = ''; PAUSED = false; LIGHTS = null; TW.fl = null; TW.flKey = null; TW.greenUntil = 0; TW.prev = 'green';
    render(); window.scrollTo(0, 0); return;
  }
  // all three groups done: classify by total time
  const gridOf = e => WK.grid.indexOf(e) + 1;
  const ordered = grpStandings(P).map((r, i) => ({ pos: i + 1, c: { d: r.e.d, t: r.e.t, e: r.e }, id: r.e.d.id, team: r.e.t.id, out: r.out || null, laps: r.laps, time: r.out ? null : r.time, grid: gridOf(r.e), best: r.best, stops: r.stops, grpName: r.g }));
  // keep the live car objects for the last group so per-car extras still line up
  ordered.forEach(r => { const live = R.cars.find(c => c.e === r.c.e); if (live) r.c = live; });
  R.result = ordered;
  let fl = null; P.parts.forEach(p => { if (p.fastest && (!fl || p.fastest.t < fl.t)) fl = p.fastest; });
  if (fl) { const row = ordered.find(r => r.c.e === fl.e); R.fastest = row ? { c: row.c, t: fl.t, lap: 0 } : R.fastest; }
  return _grp_finishRace.apply(this, arguments);
};
const _grp_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _grp_applyRaceResult.apply(this, arguments);
  try {
    if (race && race.grp === 3 && wk.grp) {
      const s = G0.results[G0.results.length - 1], P = wk.grp; s.groups = true;
      s.rows.forEach(r => { const x = race.result.find(y => y.id === r.id && y.team === r.team); if (x) r.grp = x.grpName; });
      // lap leaders = who had the lowest elapsed time at each lap across all three groups
      const ents = new Map(wk.entries.map(e => [e.d.id, e]));
      const cars = P.parts.flatMap(p => (p.cross || []).map(o => { const e = ents.get(o.id); return e ? { d: e.d, t: e.t, cross: o.x } : null; })).filter(Boolean);
      if (cars.length && typeof dkCalcLeaders === 'function') s.leaders = dkCalcLeaders({ cars, laps: P.laps }) || s.leaders;
      s.grpInfo = P.parts.map(p => { const w = p.rows.find(r => !r.out); return { g: p.g, laps: p.laps, win: w && w.e.d.id, t: w && w.time }; });
    }
  } catch (e) { }
  return out;
};

// ---------- live header ----------
const _grp_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _grp_updRace.apply(this, arguments);
  try {
    if (!RACE || !RACE.grp || !WK.grp) return r;
    const P = WK.grp, lead = RACE.order().find(x => !x.out);
    const lap = lead ? Math.min(RACE.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
    const best = grpStandings(P).find(x => !x.out && x.time != null);
    const h = `GROUP ${RACE.grpName} · ${RACE.grp}/3 · LAP ${lap}/${RACE.laps}${best ? ` · TIME TO BEAT ${esc(best.e.d.code)} ${fmtTime(best.time)}` : ''}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
  } catch (e) { }
  return r;
};

// ---------- the page between groups ----------
function grpBreakPage() {
  const P = WK.grp, last = P.parts[P.parts.length - 1], t = WK.track, next = GRP_NAMES[grpCur(P)], nextN = P.groups[grpCur(P)].length;
  const mine = e => (G.player && e.t.id === G.player) || G.follow === e.d.id;
  const st = grpStandings(P), lead = st.find(r => !r.out && r.time != null);
  const tt = r => r.out ? `DNF (${String(r.out).split(/[ (]/)[0]})` : r.time == null ? '' : r === lead ? fmtTime(r.time) : '+' + (r.time - lead.time).toFixed(3);
  const row = (r, i, showG) => { const e = r.e; return `<tr class="${mine(e) ? 'me' : ''} ${r.out ? 'elim' : ''}" data-prof="${e.d.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td>${showG ? `<td><span class="grp-tag g${r.g}">${r.g}</span></td>` : ''}<td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="l hm">${esc(e.t.name)}</td><td class="ra hm">${r.best ? fmtTime(r.best) : ''}</td><td class="ra">${tt(r)}</td></tr>`; };
  const head = g => `<thead><tr><th>Pos</th>${g ? '<th>Grp</th>' : ''}<th class="l">Driver</th><th class="l hm">Team</th><th class="ra hm">Best lap</th><th class="ra">Total time</th></tr></thead>`;
  const waiting = P.groups.filter((g, i) => !P.parts.some(p => p.g === GRP_NAMES[i])).map((g, i) => g);
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Group ${last.g} Results - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · GROUP GRAND PRIX · NEXT: GROUP ${next} · ${P.laps} LAPS · ${nextN} CARS</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">⏱️ Group ${last.g} has finished its ${last.laps} laps. Group ${next} takes the track next, on its own, starting in qualifying order. The Grand Prix is decided by total time once all three groups have run.</div>
  <div class="grp-cols"><div><h3 class="grp-h">Grand Prix standings so far</h3><table class="dkfp">${head(true)}<tbody>${st.map((r, i) => row(r, i, true)).join('')}</tbody></table></div>
  <div><h3 class="grp-h">Still to run</h3>${P.groups.map((g, i) => P.parts.some(p => p.g === GRP_NAMES[i]) ? '' : `<div class="grp-wait"><span class="grp-tag g${GRP_NAMES[i]}">${GRP_NAMES[i]}</span> ${g.map(e => `<span class="${mine(e) ? 'good' : ''}">${esc(e.d.code)}</span>`).join(' · ')}</div>`).join('')}</div></div></div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">Press ENTER/SPACE or click Form up.</span><span class="sp"></span><button class="pri" data-a="startrace" data-enter="1">Form up Group ${next} →</button></div></div>`;
}
const _grp_viewWeekend = viewWeekend;
viewWeekend = function () {
  if (WK && WK.stage === 'gbreak' && WK.grp) return grpBreakPage();
  return _grp_viewWeekend.apply(this, arguments);
};

// ---------- grid page note and results header ----------
if (typeof deskGrid === 'function') {
  const _grp_deskGrid = deskGrid;
  deskGrid = function (sprint) {
    let html = _grp_deskGrid.apply(this, arguments);
    if (!sprint && grpOn()) {
      const s = grpSizes(WK.grid.length), L = grpLaps(WK.track.laps);
      html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Group Grand Prix:</b> P1–P${s[0]} are Group A, P${s[0] + 1}–P${s[0] + s[1]} Group B, P${s[0] + s[1] + 1}–P${WK.grid.length} Group C. Each group races ${L} laps alone on the track — Group C first, then B, then A. Every car runs the full distance, and the fastest total time wins the Grand Prix.</div>`);
    }
    return html;
  };
}
const _grp_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  let html = _grp_dkRaceView.apply(this, arguments);
  const s = G.results[o.k];
  if (s && s.groups && !o.sprint) {
    html = html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)Race Results/, '$1Grand Prix Results');
    if (s.grpInfo) {
      const nm = id => G.drivers[id] ? G.drivers[id].code || G.drivers[id].name : id;
      const strip = `<div class="heat-strip"><span><b>Group Grand Prix</b> · classified by total time</span>${s.grpInfo.map(h => `<span><b>Group ${h.g}</b> · ${h.laps} laps · fastest ${esc(nm(h.win))}${h.t ? ' ' + fmtTime(h.t) : ''}</span>`).join('')}</div>`;
      html = html.replace('<table class="dkfp dkrr">', strip + '<table class="dkfp dkrr">');
    }
  }
  return html;
};
