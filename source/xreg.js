// ===================== More alternative regulations =====================
// Pre-season testing · equal cars (all season, or equal at the start and then developed) · weather setting ·
// refuelling · team orders · no safety car. Every option can be switched on/off in the custom regulations.
const XR0 = { testing: 'off', equal: 'off', weather: 'real', refuel: 'off', orders: 'off', scr: 'era', sprint: 'on', dnf: 'on', standins: 'real', heatpts: 'weighted', express: 'off', pot: 'off', gamble: 'off', rnglaps: 'off', rotate: 'off' };
const xr = (G0, k) => { const r = (G0 && G0.regs) || {}; return r[k] == null ? XR0[k] : r[k]; };

// ---------- settings form ----------
const _xg_dkRegsActive = dkRegsActive;
dkRegsActive = function (r) { return _xg_dkRegsActive.apply(this, arguments) || !!(r && Object.keys(XR0).some(k => r[k] != null && String(r[k]) !== XR0[k])); };
const _xg_dkApplyRegs = dkApplyRegs;
dkApplyRegs = function (G0) {
  _xg_dkApplyRegs.apply(this, arguments);
  if (!G0 || !G0.rules || !G0.regs) return;
  Object.assign(G0.rules, { testing: xr(G0, 'testing') === 'on', equal: xr(G0, 'equal'), weatherMode: xr(G0, 'weather'), refuel: xr(G0, 'refuel') === 'on', orders: xr(G0, 'orders') === 'on' });
  if (xr(G0, 'scr') === 'none') { G0.rules.sc = false; G0.rules.vsc = false; }
};
const _xg_dkRegsForm = dkRegsForm;
dkRegsForm = function (r, act) {
  let html = _xg_dkRegsForm.apply(this, arguments);
  if (r.heatpts === 'fixed' && (r.race === 'heats' || r.race === 'hybrid')) html = html.replace(`<select data-dkc="${act}" data-k="pts"`, `<select disabled title="Set by the fixed three-part GP points" data-dkc="${act}" data-k="pts"`).replace('Points system<select', 'Points system <span class="xr-lock">· locked: fixed three-part GP points</span><select');
  const sel = (k, opts) => `<select data-dkc="${act}" data-k="${k}" style="width:100%">${opts.map(([v, l]) => `<option value="${v}" ${String(r[k] == null ? XR0[k] : r[k]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const more = `<div class="small xr-h" style="grid-column:1/-1">MORE ALTERNATIVE RULES</div>
  <label class="small">Pre-season testing${sel('testing', [['off', 'Off'], ['on', 'On — 3 days of testing before round 1, with statistics']])}</label>
  <label class="small">Equal cars${sel('equal', [['off', 'Off — real car performance'], ['season', 'Equal cars all season'], ['start', 'Equal at the start of each season, then teams develop']])}</label>
  <label class="small">Weather${sel('weather', [['real', 'Real climate of each circuit'], ['dry', 'Always dry'], ['wet', 'Rain much more likely'], ['chaos', 'Lottery — rain at almost every race']])}</label>
  <label class="small">Refuelling${sel('refuel', [['off', 'Off'], ['on', 'On — light fuel stints and refuelling stops (1994–2009 style)']])}</label>
  <label class="small">Team orders${sel('orders', [['off', 'Off'], ['on', 'On — teams swap their cars for the better-placed driver']])}</label>
  <label class="small">Safety car${sel('scr', [['era', 'Real rules of each season'], ['none', 'No safety car — yellow flags only']])}</label>
  <label class="small">Sprint races${sel('sprint', [['on', 'On — sprint weekends as on the calendar'], ['off', 'Off — every round is a normal Grand Prix weekend']])}</label>
  <label class="small">Retirements${sel('dnf', [['on', 'On — crashes, failures and other retirements'], ['off', 'Off — every car races to the finish']])}</label>
  <label class="small">Stand-in &amp; reserve drivers${sel('standins', [['real', 'As in real history — stand-ins and one-off entries race'], ['off', 'Off — the season line-up races every round']])}</label>
  <label class="small">Three-part GP points${sel('heatpts', [['weighted', 'Weighted — Race 1 ⅓, Race 2 ⅔, Race 3 full points'], ['standard', 'Standard — normal points for the final classification only'], ['fixed', 'Fixed — Race 1 5-4-3-2-1, Race 2 10-8-6-4-2, Race 3 15-12-9-6-3 (replaces the points system)']])}</label>
  <label class="small">Express pass race${sel('express', [['off', 'Off'], ['on', 'On — a quarter of the races: each winner skips the next race, which pays half points']])}</label>
  <label class="small">Prize pot points${sel('pot', [['off', 'Off — normal points'], ['on', 'On — each driver gets 10 × rounds to chip in (min 1 per GP); the pot is shared by every finisher on a sliding scale (at least 1 each), retirements get 0']])}</label>
  <label class="small">Gamble grid slots${sel('gamble', [['off', 'Off — qualifying sets the grid'], ['on', 'On — qualifying sets the pick order; drivers choose their grid slot, and the slot sets the points (pole win 5 → back-row win 100, finishing well behind your slot loses points)']])}</label>
  <label class="small">Random laps${sel('rnglaps', [['off', 'Off'], ['on', 'On — at half distance a random number adds or removes 0–10 laps from the race']])}</label>
  <label class="small">Rotating drivers${sel('rotate', [['off', 'Off — drivers race for their own team'], ['on', 'On — no contracts: a lottery seats every driver in a different car each Grand Prix, and each driver drives every constructor\'s cars once before that constructor is off their list']])}</label>`;
  const i = html.lastIndexOf('</div>');
  return html.slice(0, i) + more + html.slice(i);
};

// ---------- equal cars ----------
function xrEqualize(G0) {
  const T = Object.values(G0.teams), E = Object.values(G0.engines);
  const avg = (L, k) => L.reduce((s, x) => s + (x[k] || 0), 0) / Math.max(1, L.length);
  const v = { aero: avg(T, 'aero'), chassis: avg(T, 'chassis'), rel: avg(T, 'rel'), power: avg(E, 'power'), erel: avg(E, 'rel') };
  // how good each team is at developing = how strong it was before the cars were made equal
  const score = t => (t.aero + t.chassis + (G0.engines[t.engine] || {}).power) / 3, sc = T.map(score), lo = Math.min(...sc), hi = Math.max(...sc);
  T.forEach((t, i) => { t.eqLearn = 0.6 + (hi > lo ? (sc[i] - lo) / (hi - lo) : 0.5) * 0.9; t.aero = v.aero; t.chassis = v.chassis; t.rel = v.rel; });
  E.forEach(e => { e.power = v.power; e.rel = v.erel; });
  G0.eqVals = v; G0.eqY = G0.year;
}
function xrEqualCheck(G0) {
  if (!G0 || !G0.rules || !G0.rules.equal || G0.rules.equal === 'off') return;
  if (G0.eqY !== G0.year) { xrEqualize(G0); news(G0, G0.rules.equal === 'season' ? '⚖️ Equal cars: every team has identical machinery this season' : '⚖️ Equal cars at the start of the season — now the development race begins'); }
  else if (G0.rules.equal === 'season' && G0.eqVals) { const v = G0.eqVals; Object.values(G0.teams).forEach(t => { t.aero = v.aero; t.chassis = v.chassis; t.rel = v.rel; }); Object.values(G0.engines).forEach(e => { e.power = v.power; e.rel = v.erel; }); }
}
const _xg_startWeekend = startWeekend;
startWeekend = function () { if (G) { dkApplyRegs(G); xrEqualCheck(G); while (xrTestNeeded(G)) xrRunTestDay(G); } return _xg_startWeekend.apply(this, arguments); };
const _xg_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0) {
  const out = _xg_applyRaceResult.apply(this, arguments);
  try {
    if (G0.rules && G0.rules.equal === 'season') xrEqualCheck(G0);
    else if (G0.rules && G0.rules.equal === 'start') // teams learn: the ones that were strongest before learn fastest
      Object.values(G0.teams).forEach(t => { if (t.id === G0.player) return; const m = (t.eqLearn || 1) * 0.35;
        t.aero = Math.min(99, t.aero + rnd(0, 1) * m); t.chassis = Math.min(99, t.chassis + rnd(0, 1) * m); t.rel = Math.min(99, t.rel + rnd(0, 0.6) * m);
        if (t.works) { const e = G0.engines[t.engine]; e.power = Math.min(99, e.power + rnd(0, 0.5) * m); } });
  } catch (e) { }
  return out;
};

// ---------- weather ----------
const _xg_makeWeather = makeWeather;
makeWeather = function (track, enabled) {
  const m = G ? xr(G, 'weather') : 'real';
  if (m === 'dry') return _xg_makeWeather(track, false);
  if (m === 'wet') return _xg_makeWeather(Object.assign({}, track, { rain: Math.min(0.75, track.rain * 2.5 + 0.15) }), true);
  if (m === 'chaos') return _xg_makeWeather(Object.assign({}, track, { rain: 0.9 }), true);
  return _xg_makeWeather.apply(this, arguments);
};

// ---------- no safety car / team orders / refuelling (race-time behaviour) ----------
hxChain('raceInit', race => {
  const R = race.G.rules; if (!R) return;
  if (xr(race.G, 'scr') === 'none') race.rules = Object.assign({}, race.rules, { sc: false, vsc: false });
  if (R.orders) race.orders = { done: {} };
  if (R.refuel && !race.sprint && !race.endu) {
    race.refuel = true;
    race.cars.forEach(c => { c.stopsPlan = race.laps > 40 ? pick([2, 2, 2, 3, 1]) : pick([1, 1, 2]); c.stopsDone = 0;
      const stint = Math.max(4, Math.round(race.laps / (c.stopsPlan + 1) * rnd(0.82, 1.08))); c.fuelLaps = stint + 1; });
    race.msg('⛽ Refuelling race: cars start light and must stop for fuel', false);
  }
});
// fuel weight follows the fuel actually on board
{ const prev = XPH.lapDelta; XPH.lapDelta = function (race, c) {
  const a = prev ? prev.apply(this, arguments) || 0 : 0;
  if (!race.refuel || c.fuelLaps == null) return a;
  const normal = 2.0 * (1 - c.laps / race.laps), now = 2.0 * Math.min(1, c.fuelLaps / race.laps) * 1.25;
  return a + now - normal;
}; }
const _xg_aiPit = Race.prototype.aiPit;
Race.prototype.aiPit = function (c) {
  const comp = _xg_aiPit.apply(this, arguments);
  if (!this.refuel || c.fuelLaps == null) return comp;
  if (!comp && c.fuelLaps <= 1.6 && this.laps - c.laps > 1) return this.slick(c, this.laps - c.laps); // must stop for fuel
  return comp;
};
const _xg_doPit = Race.prototype.doPit;
Race.prototype.doPit = function (c, comp) {
  const r = _xg_doPit.apply(this, arguments);
  if (this.refuel && c.fuelLaps != null) {
    const left = this.laps - c.laps; c.stopsDone++;
    const stopsLeft = Math.max(0, c.stopsPlan - c.stopsDone), stint = stopsLeft > 0 ? Math.ceil(left / (stopsLeft + 1)) : left;
    const add = Math.max(0, stint + 1 - c.fuelLaps), secs = add * 0.32;
    c.fuelLaps += add; c.pitT = (c.pitT || 0) + secs;
    if (c.player || c.fav) this.msg(`⛽ ${c.d.code} takes on fuel for ${stint} laps (+${secs.toFixed(1)}s)`, false);
  }
  return r;
};
hxChain('onLap', (race, c, n) => {
  if (race.refuel && c.fuelLaps != null && !c.out) {
    c.fuelLaps -= 1; const left = race.laps - c.laps;
    // safety net: a car that can't make another lap boxes now (the stop happens at the line it just crossed)
    if (c.fuelLaps < 1 && left > 0 && !(c.pitT > 0) && c.auto !== false) race.doPit(c, race.slick(c, left) || c.tyre);
    else if (c.fuelLaps <= 0 && left > 0) { race.retire(c, 'Out of fuel', null); return; }
    if (!c.auto && c.fuelLaps <= 1.6 && !c.pitReq) { c.pitReq = c.tyre; if (c.player) race.msg(`⛽ ${c.d.code}: low on fuel — boxing next lap`, true); }
  }
  // team orders: a car running just ahead of a team-mate who is better placed in the championship lets him through
  if (race.orders && !c.out && n >= race.laps * 0.35 && race.laps - n > 2) {
    const ord = race.order(), i = ord.indexOf(c), behind = ord[i + 1];
    if (behind && behind.t === c.t && !behind.out && c.t.id !== race.G.player && behind.dist > c.dist - 60) {
      const key = c.d.id + '>' + behind.d.id;
      if (!race.orders.done[key] && (behind.d.pts || 0) > (c.d.pts || 0) + 5) {
        race.orders.done[key] = 1; const d0 = c.dist; c.dist = behind.dist; behind.dist = d0;
        race.msg(`📻 Team orders at ${c.t.name}: ${c.d.name} lets ${behind.d.name} through`, behind.fav || c.fav);
      }
    }
  }
});
// fuel column on the live screen follows the refuelling plan
const _xg_dkFuel = dkFuel;
dkFuel = function (c, R) { if (R && R.refuel && c.fuelLaps != null) return Math.max(0.3, c.fuelLaps * Math.min(0.31 * R.track.km, 104 / R.laps)); return _xg_dkFuel.apply(this, arguments); };

// ---------- pre-season testing ----------
function xrTestTrack(G0) {
  const y = G0.year, has = id => TRACK_BY_ID[id] ? id : null;
  if (y >= 2020 || y === 2014) return has('bhr') || G0.cal[0];
  if (y >= 2009) return has('bcn') || G0.cal[0];
  return G0.cal[0];
}
function xrTestNeeded(G0) { return !!(G0 && G0.rules && G0.rules.testing && G0.round === 0 && !(G0.testing && G0.testing.y === G0.year && G0.testing.days.length >= 3)); }
function xrRunTestDay(G0) {
  if (!G0.testing || G0.testing.y !== G0.year) G0.testing = { y: G0.year, track: xrTestTrack(G0), days: [] };
  xrEqualCheck(G0);
  const T = G0.testing, day = T.days.length + 1, track = TRACK_BY_ID[T.track] || roundTrack(G0, 0);
  const wet = G0.weatherOn !== false && xr(G0, 'weather') !== 'dry' && Math.random() < (xr(G0, 'weather') === 'chaos' ? 0.5 : track.rain * 0.4) ? rnd(0.3, 0.7) : 0;
  const rows = [], events = [];
  Object.values(G0.teams).filter(t => !t.xt && Object.values(G0.drivers).some(d => d.team === t.id)).forEach(t => {
    const ds = Object.values(G0.drivers).filter(d => d.team === t.id).slice(0, 2);
    ds.forEach((d, k) => {
      const c = { d, t, tyre: 'S', wear: 0, setup: 0.35 + day * 0.12, mode: null };
      const rel = teamRel(G0, t), issue = Math.random() < (100 - rel) / 100 * 0.7;
      let laps = Math.round(rnd(55, 80) * (issue ? rnd(0.25, 0.7) : 1));
      const comp = pick(day === 3 ? ['S', 'S', 'M'] : ['M', 'H', 'M', 'S']); c.tyre = comp;
      const sandbag = rnd(0, 1.6) * (day === 3 ? 0.5 : 1) * (t.id === G0.player ? 0.6 : 1);
      const best = lapTimeFor(G0, c, track, { quali: true, wet, lap: 0, laps: track.laps }) + sandbag + rnd(-0.25, 0.35);
      c.tyre = 'M'; const long = lapTimeFor(G0, c, track, { lap: Math.round(track.laps * 0.4), laps: track.laps, wet }) + rnd(0, 0.6);
      const why = issue ? dkWhy(G0, 'm') : null;
      if (issue) events.push(`🔴 Red flag: ${d.name} stops on track (${why}) — ${laps} laps for ${t.name}`);
      rows.push({ id: d.id, code: d.code, name: d.name, team: t.id, laps, km: +(laps * track.km).toFixed(0), best: +best.toFixed(3), comp, long: +long.toFixed(3), issue: why });
    });
  });
  rows.sort((a, b) => a.best - b.best);
  T.days.push({ day, wet: !!wet, rows, events });
  news(G0, `🧪 Testing day ${day} (${track.short}): ${rows[0].name} quickest, ${fmtTime(rows[0].best)}`);
  if (typeof autosave === 'function') autosave();
}
function xrTestPage() {
  const T = G.testing && G.testing.y === G.year ? G.testing : { days: [], track: xrTestTrack(G) };
  const track = TRACK_BY_ID[T.track] || roundTrack(G, 0), tab = DK3.ttab || 'all';
  const all = {}; T.days.forEach(D => D.rows.forEach(r => { const a = all[r.id] = all[r.id] || Object.assign({}, r, { laps: 0, km: 0, issues: 0, best: 1e9 }); a.laps += r.laps; a.km += r.km; if (r.issue) a.issues++; if (r.best < a.best) { a.best = r.best; a.comp = r.comp; a.bestDay = D.day; } a.long = Math.min(a.long, r.long); }));
  const rows = tab === 'all' ? Object.values(all).sort((a, b) => a.best - b.best) : ((T.days[+tab - 1] || {}).rows || []);
  const lead = rows[0];
  const tm = id => G.teams[id] || { color: '#888', name: id };
  const table = rows.length ? `<table class="dkfp"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="ra">Best lap</th><th class="ra">Gap</th><th>Tyre</th><th class="ra">Laps</th><th class="ra hm">km</th><th class="ra hm">Long-run avg</th>${tab === 'all' ? '<th class="ra hm">Issues</th>' : '<th class="l hm">Problem</th>'}</tr></thead><tbody>${rows.map((r, i) => { const t = tm(r.team);
    return `<tr data-prof="${r.id}" style="--tc:${t.color};--ti:${dkInk(t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td><td class="l">${dkNm(r.name)}</td><td class="l hm">${esc(t.name)}</td><td class="ra">${fmtTime(r.best)}</td><td class="ra">${i ? '+' + (r.best - lead.best).toFixed(3) : '—'}</td><td>${dkTy(r.comp)}</td><td class="ra">${r.laps}</td><td class="ra hm">${r.km}</td><td class="ra hm">${fmtTime(r.long)}</td>${tab === 'all' ? `<td class="ra hm">${r.issues || ''}</td>` : `<td class="l hm">${r.issue ? esc(r.issue) : ''}</td>`}</tr>`; }).join('')}</tbody></table>` : `<div class="dk-mut" style="padding:2em">No running yet. Run day 1 to see the first timesheet.</div>`;
  // team summary
  const teams = {}; Object.values(all).forEach(r => { const a = teams[r.team] = teams[r.team] || { laps: 0, km: 0, issues: 0, best: 1e9, long: 1e9 }; a.laps += r.laps; a.km += r.km; a.issues += r.issues; a.best = Math.min(a.best, r.best); a.long = Math.min(a.long, r.long); });
  const tl = Object.entries(teams).sort((a, b) => b[1].laps - a[1].laps);
  const longBest = Math.min(...tl.map(([, a]) => a.long));
  const side = tl.length ? `<section><div class="dk-h"><b>TEAMS · MILEAGE & PACE</b></div><table class="endu-earn"><thead><tr><th class="l">Team</th><th>Laps</th><th>km</th><th>Long run</th><th>Issues</th></tr></thead><tbody>${tl.map(([id, a]) => `<tr data-tprof="${id}"><td class="l"><span style="color:${tm(id).color}">■</span> ${esc(tm(id).name)}</td><td>${a.laps}</td><td>${a.km.toLocaleString('en-GB')}</td><td>+${(a.long - longBest).toFixed(2)}</td><td>${a.issues || ''}</td></tr>`).join('')}</tbody></table></section>` : '';
  const ev = T.days.flatMap(D => D.events.map(e => `<div class="dkx-ms"><span class="dk-mut">Day ${D.day}</span>${esc(e)}</div>`)).join('');
  const notes = `<section><div class="dk-h"><b>READING THE TIMES</b></div><div class="dkg-body dk-mut" style="line-height:1.5">Teams run different fuel loads and tyres and hide their true pace, so one-lap times can mislead. Long-run averages and mileage tell you more about race pace and reliability.</div></section>`;
  const tabs = [['all', 'Combined'], ...T.days.map(D => [String(D.day), `Day ${D.day}${D.wet ? ' 🌧' : ''}`])].map(([v, l]) => `<button class="${tab === v ? 'on' : ''}" data-a="xrttab" data-v="${v}">${l}</button>`).join('');
  const left = 3 - T.days.length;
  return `<div class="dk dk-page dk-fp dk-res" id="dk"><div class="dk-reshead">${dkFlag(track.cc, 'lg')}<div><h1>Pre-Season Testing - ${esc(track.short)}</h1><div class="dk-mut">${esc(track.name)} | ${G.year} | Day ${T.days.length} of 3</div></div><span class="sp"></span><div class="dk-tabs">${tabs}</div></div>
  <div class="dk-resgrid"><div class="dk-fpbox">${table}</div><div class="dk-resside">${side}${ev ? `<section><div class="dk-h"><b>STOPPAGES</b></div><div class="dkg-body">${ev}</div></section>` : ''}${notes}</div></div>
  <div class="dk-fpfoot"><button data-a="xrtback">‹ Calendar</button><span class="sp"></span>${left > 0 ? `<button data-a="xrtrun" data-v="1">Run day ${T.days.length + 1}</button><button class="pri" data-a="xrtrun" data-v="${left}" data-enter="1">Run ${left > 1 ? 'all remaining days' : 'final day'}</button>` : '<span class="dk-mut">Testing complete — the season starts with round 1.</span><button class="pri" data-a="gowk" data-enter="1">Round 1 weekend →</button>'}</div></div>`;
}
Object.assign(A, {
  xrtest() { DK3.test = true; DK2.arch = null; render(); },
  xrtback() { DK3.test = false; render(); },
  xrttab(el) { DK3.ttab = el.dataset.v; render(); },
  xrtrun(el) { for (let i = 0; i < +el.dataset.v; i++) if (!(G.testing && G.testing.y === G.year && G.testing.days.length >= 3)) xrRunTestDay(G); DK3.ttab = 'all'; render(); },
});
const _xg_hqCalendar = hqCalendar;
hqCalendar = function () {
  if (DK3.test && G && G.rules && G.rules.testing && !(typeof dkCurPast === 'function' && dkCurPast())) return xrTestPage();
  let html = _xg_hqCalendar.apply(this, arguments);
  if (G && G.rules && G.rules.testing && !(typeof dkCurPast === 'function' && dkCurPast())) {
    const T = G.testing && G.testing.y === G.year ? G.testing : null, tr = TRACK_BY_ID[xrTestTrack(G)] || roundTrack(G, 0), done = T && T.days.length >= 3;
    const row = `<div class="dkcl xr-test ${done ? 'done' : G.round === 0 ? 'next' : 'done'}" data-a="xrtest"><span class="rn">TEST</span>${dkFlag(tr.cc)}<span class="nm">TESTING</span><span class="dk-mut">${T ? T.days.length : 0}/3 days</span></div>`;
    html = html.replace(/(<section class="dkc-list">[\s\S]*?<div class="dk-scroll">)/, '$1' + row);
  }
  return html;
};
const _xg_render = render;
render = function () { if (VIEW !== 'hq' || TAB !== 'calendar') DK3.test = false; return _xg_render.apply(this, arguments); };

// ---------- sprint races off: sprint rounds become normal Grand Prix weekends (F1 Academy keeps its two-race format) ----------
const _xg_isSprintRound = isSprintRound;
isSprintRound = function (G0, i) { if (G0 && !dkAcad(G0) && xr(G0, 'sprint') === 'off') return false; return _xg_isSprintRound.apply(this, arguments); };

// ---------- retirements off: every car races to the finish. A crash or failure costs time instead of ending the race ----------
const _xg_retire = Race.prototype.retire;
Race.prototype.retire = function (c, why, flag) {
  if (!this.G || xr(this.G, 'dnf') !== 'off' || /^Eliminated/.test(String(why))) return _xg_retire.apply(this, arguments); // format eliminations always remove the car
  const crash = flag === 'sc' || /crash|collision|wall|spun|accident|gravel|barrier|tyre/i.test(String(why));
  if (/fuel/i.test(String(why))) { c.fuelLaps = Math.max(c.fuelLaps || 0, 1.2); c.spin = Math.max(c.spin || 0, rnd(4, 8)); this.msg(`⛽ ${c.d.code} runs dry and limps to the pits`, true); return; }
  c.spin = Math.max(c.spin || 0, crash ? rnd(12, 26) : rnd(6, 16));
  if (/tyre/i.test(String(why))) c.pitReq = c.pitReq || (this.slick ? this.slick(c, this.laps - c.laps) : null) || 'M';
  this.msg(crash ? `💥 ${c.d.code} has a big moment (${why}) — but recovers and carries on` : `⚠️ ${c.d.code} has a problem (${why}) — loses time but keeps going`, true);
  if (crash && this.incidentsOn && this.rules.sc && Math.random() < 0.3) { if (this.rules.vsc) this.startVSC(); else this.msg('🟨 Yellow flags', false); }
};

// ---------- testing comes first: the season opens with pre-season testing, not round 1 ----------
function xrTestGo() { VIEW = 'hq'; TAB = 'calendar'; DK3.test = true; if (typeof DK2 !== 'undefined') DK2.arch = null; render(); window.scrollTo(0, 0); }
A.xrtestgo = xrTestGo;
A.xrtestall = function () { for (let i = 0; i < 3; i++) if (!(G.testing && G.testing.y === G.year && G.testing.days.length >= 3)) xrRunTestDay(G); DK3.ttab = 'all'; xrTestGo(); };
['gowk', 'gowkrace'].forEach(k => { const f = A[k]; A[k] = function () { if (xrTestNeeded(G)) return xrTestGo(); return f.apply(this, arguments); }; });
const _xg_nextRaceCard = nextRaceCard;
nextRaceCard = function (t, btn) {
  if (!xrTestNeeded(G)) return _xg_nextRaceCard.apply(this, arguments);
  const T = G.testing && G.testing.y === G.year ? G.testing : null, tr = TRACK_BY_ID[xrTestTrack(G)] || roundTrack(G, 0), done = T ? T.days.length : 0;
  return `<div class="card hl xr-next"><h3>Pre-season testing · before round 1 of ${G.cal.length}</h3><div class="row">${trackSVG(tr, 110)}<div class="sp"><div class="big">${flag(tr.cc)} Testing</div>
    <div class="mut">${esc(tr.name)} · 3 days</div><div class="small mut">${done ? `Day ${done} of 3 done.` : 'Every team runs 3 days of testing before the season opener.'} Round 1 is ${esc(t.short)}.</div></div></div>
    <div class="row" style="margin-top:10px"><button class="pri sp" data-a="xrtestgo" data-enter="1">${done ? 'Continue testing →' : 'Go to testing →'}</button><button data-a="xrtestall">⏩ Run all ${done ? 'remaining days' : '3 days'}</button></div></div>`;
};
