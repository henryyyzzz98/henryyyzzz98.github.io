// ===================== Three-part Grand Prix (custom regulation) =====================
// The Grand Prix is split into three races, each from a standing start:
//   Race 1: first 1/6 of the laps — the slowest 1/6 of the entrants are eliminated — 20-minute break
//   Race 2: next 1/3 of the laps, grid = Race 1 order — the slowest 1/3 of the entrants are eliminated — 40-minute break
//   Race 3: the last 1/2 of the laps, grid = Race 2 order — the chequered flag decides the Grand Prix.
// Retirements count towards a race's eliminations. Eliminated drivers are classified behind Race 3, latest-out first.
// Points follow the final Grand Prix order.
const heatsOn = () => !!(G && G.rules && G.rules.heats);
function heatPlan(laps, n) {
  const l1 = Math.max(1, Math.round(laps / 6)), l2 = Math.max(1, Math.round(laps / 3)), l3 = Math.max(1, laps - l1 - l2);
  let e1 = Math.round(n / 6), e2 = Math.round(n / 3);
  while (n - e1 - e2 < 2 && e2 > 0) e2--;
  while (n - e1 - e2 < 2 && e1 > 0) e1--;
  return { laps: [l1, l2, l3], elim: [e1, e2, 0], brk: [20, 40, 0] };
}
// Points: every race scores on its own finishing order, weighted by its share of the distance.
// Race 1 = 1/3 of the normal points table, Race 2 = 2/3, Race 3 = the full table (Race 1 + Race 2 together are worth as much as Race 3).
const HEAT_W = [1 / 3, 2 / 3, 1];
const HEAT_FIXED = [[5, 4, 3, 2, 1], [10, 8, 6, 4, 2], [15, 12, 9, 6, 3]];
function heatTable(k) { if (G && G.regs && G.regs.heatpts === 'fixed') return HEAT_FIXED[k - 1].slice(); const PT = (G.rules && G.rules.points) || POINTS; return PT.map(p => Math.round(p * HEAT_W[k - 1])).filter((p, i, a) => p > 0 || a.slice(i).some(x => x > 0)); }
function heatPts(k, pos, out) { if (out) return 0; const T = heatTable(k); return pos <= T.length ? T[pos - 1] : 0; }
function heatNew() {
  const P = heatPlan(WK.track.laps, WK.grid.length);
  WK.heat = Object.assign(P, { k: 1, n0: WK.grid.length, parts: [], gridNow: WK.grid.slice(), wet: null, plan0: null, lapOff: 0 });
  return WK.heat;
}

hxChain('raceInit', race => {
  if (race.sprint || !heatsOn() || race.wk !== WK) return;
  const H = (WK.heat && WK.stage === 'hbreak') ? WK.heat : heatNew();
  race.heat = H.k; race.laps = H.laps[H.k - 1];
  race.rules = Object.assign({}, race.rules, { twoCompound: false });
  if (H.k > 1 && H.wet != null) { // the weather carries on from where the last race finished
    race.wet = race.wetTarget = H.wet;
    race.plan = (H.plan0 || []).filter(p => p.lap > H.lapOff).map(p => Object.assign({}, p, { lap: p.lap - H.lapOff }));
    race.cars.forEach(c => { if (race.wet > 0.6) c.tyre = 'W'; else if (race.wet > 0.22) c.tyre = 'I'; c.used = new Set([c.tyre]); });
  } else H.plan0 = race.plan.slice();
  const out = H.elim[H.k - 1];
  if (!G.rules.hybrid) race.msg(H.k < 3 ? `🏁 Race ${H.k} of 3: ${race.laps} laps · ${race.cars.length} cars · the slowest ${out} at the flag are eliminated, then a ${H.brk[H.k - 1]}-minute break.`
    : `🏁 Race 3 of 3: ${race.laps} laps · ${race.cars.length} cars · this chequered flag decides the Grand Prix.`, true);
});

// ---------- ending a part ----------
function heatRows(race) {
  return race.order().map((c, i) => ({ e: c.e, pos: i + 1, laps: c.laps, time: c.finished ? c.finishT : null, out: c.out, best: c.best, stops: c.stops }));
}
function heatLeaders(race, off) {
  const segs = typeof dkCalcLeaders === 'function' ? dkCalcLeaders(race) || [] : [];
  return segs.map(s => Object.assign({}, s, { from: s.from + off, to: s.to + off }));
}
const _heat_finishRace = finishRace;
finishRace = function () {
  const R = RACE, H = WK && WK.heat;
  if (!R || R.sprint || !R.heat || !H) return _heat_finishRace.apply(this, arguments);
  if (R.heat < 3) {
    cancelAnimationFrame(raf);
    const rows = heatRows(R), drop = H.elim[R.heat - 1], keepN = rows.length - drop;
    const survivors = rows.filter(r => !r.out).slice(0, keepN).map(r => r.e);
    rows.forEach(r => { r.adv = survivors.includes(r.e); });
    H.parts.push({ k: R.heat, laps: R.laps, rows, leaders: heatLeaders(R, H.lapOff), fastest: R.fastest ? { e: R.fastest.c.e, t: R.fastest.t } : null });
    H.wet = R.wet; H.lapOff += R.laps;
    H.gridNow = survivors; H.k = R.heat + 1;
    WK.stage = 'hbreak'; RACE = null;
    autosave(); raceBanner = ''; PAUSED = false; LIGHTS = null; TW.fl = null; TW.flKey = null; TW.greenUntil = 0; TW.prev = 'green';
    render(); window.scrollTo(0, 0); return;
  }
  // Race 3 done: build the Grand Prix classification
  H.parts.push({ k: 3, laps: R.laps, rows: heatRows(R), leaders: heatLeaders(R, H.lapOff), fastest: R.fastest ? { e: R.fastest.c.e, t: R.fastest.t } : null });
  const off = H.lapOff, total = H.laps[0] + H.laps[1] + H.laps[2], gridOf = e => WK.grid.indexOf(e) + 1;
  const res = R.result.map(r => Object.assign({}, r, { laps: r.laps + off, grid: gridOf(r.c.e), heatOut: null }));
  [2, 1].forEach(k => {
    const P = H.parts[k - 1];
    P.rows.filter(r => !r.adv).forEach(r => {
      const pre = H.parts.slice(0, k - 1).reduce((s, p) => s + p.laps, 0);
      res.push({ pos: 0, c: { d: r.e.d, t: r.e.t, e: r.e }, id: r.e.d.id, team: r.e.t.id, out: r.out || null, laps: r.laps + pre, time: null, grid: gridOf(r.e), best: r.best, stops: r.stops, heatOut: k });
    });
  });
  // classified: Race 3 finishers, then Race 2 and Race 1 eliminations; every retirement goes to the bottom (latest race first)
  const ordered = res.filter(r => !r.out).concat(res.filter(r => r.out));
  ordered.forEach((r, i) => { r.pos = i + 1; });
  R.result = ordered;
  // fastest lap of the whole Grand Prix
  let fl = null; H.parts.forEach(p => { if (p.fastest && (!fl || p.fastest.t < fl.t)) fl = p.fastest; });
  if (fl) { const row = ordered.find(r => r.c.e === fl.e); R.fastest = row ? { c: row.c, t: fl.t, lap: 0 } : R.fastest; }
  R.heatTotal = total;
  return _heat_finishRace.apply(this, arguments);
};
const _heat_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _heat_applyRaceResult.apply(this, arguments);
  try {
    if (race && race.heat === 3 && wk.heat) {
      const s = G0.results[G0.results.length - 1], H = wk.heat; s.heats = true;
      s.rows.forEach(r => { const x = race.result.find(y => y.id === r.id && y.team === r.team); if (x && x.heatOut) { r.heatOut = x.heatOut; r.elimLap = 'R' + x.heatOut; } });
      s.leaders = H.parts.flatMap(p => p.leaders);
      s.heatInfo = H.parts.map(p => ({ k: p.k, laps: p.laps, win: p.rows[0] && p.rows[0].e.d.id, out: p.rows.filter(r => p.k < 3 && !r.adv).map(r => r.e.d.id) }));
      if (!(G0.regs && G0.regs.heatpts === 'standard')) {
      // weighted points: replace the normal table with Race 1 + Race 2 + Race 3 points (fastest-lap bonus kept)
      const PT = (G0.rules && G0.rules.points) || POINTS;
      s.rows.forEach(r => {
        const hp = [1, 2, 3].map(k => { const P = H.parts[k - 1]; const x = P && P.rows.find(y => y.e.d.id === r.id); return x ? heatPts(k, x.pos, x.out) : 0; });
        const base = !r.out && r.pos <= PT.length ? PT[r.pos - 1] : 0, fl = G0.regs && G0.regs.heatpts === 'fixed' ? 0 : Math.max(0, r.pts - base), np = hp[0] + hp[1] + hp[2] + fl, delta = np - r.pts;
        r.hp = hp;
        if (delta) { const d = G0.drivers[r.id]; if (d) { d.pts += delta; if (d.res && d.res.length) d.res[d.res.length - 1] += delta; } if (G0.teams[r.team]) G0.teams[r.team].pts += delta; r.pts = np; }
      });
      s.heatTables = [1, 2, 3].map(heatTable);
      }
      if (G0.rules && G0.rules.bestN && typeof recomputePoints === 'function') recomputePoints(G0);
    }
  } catch (e) { }
  return out;
};
const _heat_elimTimeTxt = typeof elimTimeTxt === 'function' ? elimTimeTxt : null;
elimTimeTxt = function (r) {
  if (r.heatOut) return r.out ? `DNF · Race ${r.heatOut}` : `Eliminated · Race ${r.heatOut}`;
  return _heat_elimTimeTxt ? _heat_elimTimeTxt.apply(this, arguments) : '';
};

// ---------- forming up for Race 2 / Race 3 ----------
const _heat_startrace = A.startrace;
A.startrace = function (q) {
  if (!(WK && WK.stage === 'hbreak' && WK.heat)) return _heat_startrace.apply(this, arguments);
  const H = WK.heat, keep = WK.grid, laps = H.laps[H.k - 1];
  WK.entries.forEach(e => { if (!(G.player && e.t.id === G.player)) e.startTyre = laps <= 12 ? pick(['S', 'S', 'S', 'M']) : pick(['S', 'M', 'M', 'H']); });
  WK.grid = H.gridNow;
  try { _heat_startrace.call(this, q); } finally { WK.grid = keep; }
};

// ---------- live header: which race, and who is in the elimination zone ----------
const _heat_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _heat_updRace.apply(this, arguments);
  try {
    if (!RACE || !RACE.heat || !WK.heat || RACE.pe) return r;
    const H = WK.heat, k = RACE.heat, alive = RACE.order().filter(x => !x.out), lead = alive[0];
    const lap = lead ? Math.min(RACE.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
    const drop = H.elim[k - 1], dnf = RACE.cars.filter(x => x.out).length, zone = k < 3 ? Math.max(0, drop - dnf) : 0;
    const danger = zone ? alive.slice(-zone) : [];
    const h = `RACE ${k}/3 · LAP ${lap}/${RACE.laps}${k < 3 ? ` · BOTTOM ${drop} OUT` : ' · DECIDER'}`;
    const ds = document.getElementById('dksess'); if (ds && (ds._x !== h || ds._xsrc !== ds._h)) { ds.innerHTML = h; ds._x = h; ds._xsrc = ds._h; ds.title = ds.textContent; }
    document.querySelectorAll('#dk tr[data-v]').forEach(tr => tr.classList.toggle('elimr-danger', danger.some(c => c.d.id === tr.dataset.v)));
  } catch (e) { }
  return r;
};

// ---------- the break page ----------
function heatBreakPage() {
  const H = WK.heat, P = H.parts[H.parts.length - 1], t = WK.track, k = P.k, nextLaps = H.laps[H.k - 1];
  const mine = e => (G.player && e.t.id === G.player) || G.follow === e.d.id;
  const lead = P.rows[0];
  const timeTxt = r => r.out ? `DNF (${String(r.out).split(/[ (]/)[0]})` : r === lead ? fmtTime(r.time) : r.laps < lead.laps ? `+${lead.laps - r.laps} Lap${lead.laps - r.laps > 1 ? 's' : ''}` : r.time != null && lead.time != null ? '+' + (r.time - lead.time).toFixed(3) : '';
  const cut = P.rows.filter(r => r.adv).length;
  const table = `<table class="dkfp"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="ra hm">Best lap</th><th class="ra">Time/Gap</th><th class="ra">Pts</th><th class="l">Status</th></tr></thead><tbody>${P.rows.map((r, i) => {
    const e = r.e; return `<tr class="${mine(e) ? 'me' : ''} ${r.adv ? '' : 'elim'} ${i === cut ? 'cut' : ''}" data-prof="${e.d.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="l hm">${esc(e.t.name)}</td><td class="ra hm">${r.best ? fmtTime(r.best) : ''}</td><td class="ra">${timeTxt(r)}</td><td class="ra">${G.regs && G.regs.heatpts === 'standard' ? '' : heatPts(k, r.pos, r.out) || ''}</td><td class="l">${r.adv ? `Race ${H.k} grid P${H.gridNow.indexOf(e) + 1}` : r.out ? 'Out — retired' : 'ELIMINATED'}</td></tr>`; }).join('')}</tbody></table>`;
  const nextTxt = H.k === 3 ? `Race 3 decides the Grand Prix: ${nextLaps} laps, ${H.gridNow.length} cars${G.rules.hybrid ? ' — the last-placed car is out every time the pole sitter has done another ' + (nextLaps / H.gridNow.length).toFixed(1) + ' laps, until two are left' : ''}.` : `Race ${H.k}: ${nextLaps} laps, ${H.gridNow.length} cars — ${H.elim[H.k - 1]} will be eliminated${G.rules.hybrid ? ', one at a time when the pole sitter crosses the line' : ''}.`;
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Race ${k} Results - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year} · ${H.brk[k - 1]}-MINUTE BREAK · NEXT: RACE ${H.k} · ${nextLaps} LAPS · ${H.gridNow.length} CARS</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">${G.regs && G.regs.heatpts === 'standard' ? '🏅 Points are awarded only for the final classification after Race 3.' : `🏅 Race ${k} points: ${heatTable(k).join('-')}.`}<br>⏸️ ${H.brk[k - 1]}-minute break. Teams fit fresh tyres and the cars form up on the grid in Race ${k} finishing order. ${nextTxt}</div>${table}</div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">Press ENTER/SPACE or click Form up.</span><span class="sp"></span><button class="pri" data-a="startrace" data-enter="1">Form up for Race ${H.k} →</button></div></div>`;
}
const _heat_viewWeekend = viewWeekend;
viewWeekend = function () {
  if (WK && WK.stage === 'hbreak' && WK.heat) return heatBreakPage();
  return _heat_viewWeekend.apply(this, arguments);
};

// grid page and results title
if (typeof deskGrid === 'function') {
  const _heat_deskGrid = deskGrid;
  deskGrid = function (sprint) {
    let html = _heat_deskGrid.apply(this, arguments);
    if (!sprint && heatsOn()) { const P = heatPlan(WK.track.laps, WK.grid.length);
      html = html.replace(/<div class="dk-mut dkg-note">[^<]*<\/div>/, `<div class="dk-mut dkg-note"><b>Three-part Grand Prix:</b> Race 1 · ${P.laps[0]} laps, slowest ${P.elim[0]} out → 20-min break → Race 2 · ${P.laps[1]} laps, slowest ${P.elim[1]} out → 40-min break → Race 3 · ${P.laps[2]} laps decides the Grand Prix. Each race forms up in the previous race's finishing order. ${G.regs && G.regs.heatpts === 'standard' ? 'Normal points for the final classification.' : 'Points from all three races add up: ' + (G.regs && G.regs.heatpts === 'fixed' ? 'Race 1 5-4-3-2-1, Race 2 10-8-6-4-2, Race 3 15-12-9-6-3.' : 'Race 1 ⅓ of the table, Race 2 ⅔, Race 3 the full table.')}</div>`); }
    return html;
  };
}
const _heat_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  let html = _heat_dkRaceView.apply(this, arguments);
  const s = G.results[o.k];
  if (s && s.heats && !o.sprint) {
    html = html.replace(/(<div class="dk-reshead">[\s\S]*?<h1>)Race Results/, '$1Grand Prix Results');
    if (s.heatInfo) {
      const nm = id => G.drivers[id] ? G.drivers[id].code || G.drivers[id].name : id;
      const tabs = s.heatTables && !(G.regs && G.regs.heatpts === 'standard') ? `<span><b>Points</b> · Race 1 ${s.heatTables[0].join('-')} · Race 2 ${s.heatTables[1].join('-')} · Race 3 ${s.heatTables[2].join('-')} · totals add up all three</span>` : '';
      const strip = `<div class="heat-strip">${tabs}${s.heatInfo.map(h => `<span><b>Race ${h.k}</b> · ${h.laps} laps · won by ${esc(nm(h.win))}${h.out.length ? ` · out: ${h.out.map(x => esc(nm(x))).join(', ')}` : ''}</span>`).join('')}</div>`;
      html = html.replace('<table class="dkfp dkrr">', strip + '<table class="dkfp dkrr">');
    }
  }
  return html;
};
