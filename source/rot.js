// ===================== Rotating drivers (custom regulation) =====================
// No contracts: the season's drivers form one pool, and a lottery seats them in a different car each Grand Prix.
// A driver can race for a constructor once in each of its cars; once they've driven all of them, that constructor is off their list.
const rotOn = (G0) => !!(G0 && G0.regs && G0.regs.rotate === 'on');
function rotSlotName(t, k) { return (t && t.cars === 1) ? 'car' : `car ${k + 1}`; }

function rotSeason(G0, base) {
  if (G0.rot && G0.rot.year === G0.year) return G0.rot;
  // seats: the cars the regular line-up would race; pool: the season's contracted drivers (no stand-ins)
  const per = {};
  base.filter(e => !e.standin && !e.t.xt).forEach(e => { per[e.t.id] = (per[e.t.id] || 0) + 1; });
  const seats = []; Object.entries(per).forEach(([tid, n]) => { for (let k = 0; k < n; k++) seats.push([tid, k]); });
  const pool = Object.values(G0.drivers).filter(d => d.team && per[d.team] && !d.retired).map(d => d.id);
  G0.rot = { year: G0.year, pool, seats, used: {}, rounds: {} };
  return G0.rot;
}
// does driver id still have this seat available? (each car of each constructor once)
function rotFree(R, id, s) { const u = R.used[id]; return !(u && u[s[0]] && u[s[0]].includes(s[1])); }
function rotDraw(G0, R) {
  const n = R.seats.length;
  // who races: everyone if the pool fits, else the drivers with fewest starts (random tie-break)
  const starts = id => Object.values(R.used[id] || {}).reduce((a, l) => a + l.length, 0);
  let drivers = R.pool.filter(id => G0.drivers[id] && !G0.drivers[id].retired).map(id => [id, starts(id) + Math.random()]).sort((a, b) => a[1] - b[1]).slice(0, n).map(x => x[0]);
  // a driver who has driven every car on the grid starts a fresh cycle
  drivers.forEach(id => { if (R.seats.every(s => !rotFree(R, id, s))) { R.used[id] = {}; R.cyc = R.cyc || {}; R.cyc[id] = (R.cyc[id] || 1) + 1; } });
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  drivers = shuffle(drivers);
  // lottery = random maximum matching of drivers to seats, never a seat the driver has used
  const seatOf = {}, drvOf = new Array(n).fill(null);
  const order = {}; drivers.forEach(id => { order[id] = shuffle([...Array(n).keys()]); });
  const tryAssign = (id, seen) => {
    for (const si of order[id]) {
      if (seen.has(si) || !rotFree(R, id, R.seats[si])) continue; seen.add(si);
      if (drvOf[si] === null || tryAssign(drvOf[si], seen)) { drvOf[si] = id; seatOf[id] = si; return true; }
    }
    return false;
  };
  drivers.forEach(id => tryAssign(id, new Set()));
  // anyone the lottery couldn't place (rare late-season dead end): clear their history and draw again for free seats
  drivers.filter(id => seatOf[id] == null).forEach(id => { R.used[id] = {}; R.cyc = R.cyc || {}; R.cyc[id] = (R.cyc[id] || 1) + 1; tryAssign(id, new Set()); });
  const map = {};
  drvOf.forEach((id, si) => { if (id) map[id] = si; });
  return map;
}
const _rot_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  const base = _rot_weekendEntries.apply(this, arguments);
  if (!rotOn(G0)) return base;
  try {
    const R = rotSeason(G0, base);
    let map = R.rounds[G0.round];
    if (!map) {
      map = rotDraw(G0, R); R.rounds[G0.round] = map;
      Object.entries(map).forEach(([id, si]) => { const [tid, k] = R.seats[si]; const u = (R.used[id] = R.used[id] || {}); (u[tid] = u[tid] || []).push(k); });
    }
    const mk = (d, t) => ({ d, t, setup: rnd(0.35, 0.5) + (t.id === G0.player ? 0 : rnd(0.1, 0.3)), tyreKnow: t.id === G0.player ? 0 : rnd(0.2, 0.5), qualiPrep: t.id === G0.player ? 0 : rnd(0.2, 0.5) });
    const seated = Object.entries(map).sort((a, b) => a[1] - b[1]);
    seated.forEach(([id, si]) => { G0.drivers[id].team = R.seats[si][0]; G0.drivers[id].rotSeat = R.seats[si][1]; });
    R.pool.forEach(id => { if (map[id] == null && G0.drivers[id]) G0.drivers[id].rotSeat = null; });
    const L = seated.map(([id, si]) => mk(G0.drivers[id], G0.teams[R.seats[si][0]]));
    return L;
  } catch (e) { console.error(e); return base; }
};

// ---------- the draw on the practice page ----------
function rotDrawHtml() {
  const R = G.rot; if (!R || !WK) return '';
  const map = R.rounds[WK.round]; if (!map) return '';
  const byTeam = {};
  Object.entries(map).forEach(([id, si]) => { const [tid, k] = R.seats[si]; (byTeam[tid] = byTeam[tid] || []).push([k, id]); });
  const prev = R.rounds[WK.round - 1] || {};
  const cards = Object.keys(byTeam).map(tid => { const t = G.teams[tid];
    return `<div class="rot-team" style="--tc:${t.color}"><b>${esc(t.name)}</b>${byTeam[tid].sort((a, b) => a[0] - b[0]).map(([k, id]) => { const d = G.drivers[id], left = (t.cars || 2) - ((R.used[id] || {})[tid] || []).length;
      return `<div><span class="dk-mut">${rotSlotName(t, k)}</span> ${dkFlag(d.nat)} ${esc(d.name)}${left ? '' : ' <i class="rot-last" title="Last time in this team\'s cars">final</i>'}</div>`; }).join('')}</div>`; }).join('');
  return `<div class="rot-draw"><div class="rot-hd"><b>🎰 Driver lottery · Round ${WK.round + 1}</b><span class="dk-mut">Every driver drives each constructor's cars once, then that constructor is off their list.</span><button data-a="rotview">Rotation table</button></div><div class="rot-grid">${cards}</div></div>`;
}
const _rot_viewWeekend = viewWeekend;
viewWeekend = function () {
  let html = _rot_viewWeekend.apply(this, arguments);
  if (rotOn(G) && WK && WK.stage === 'fp' && G.rot) {
    const box = rotDrawHtml();
    const i = html.indexOf('<div class="dk-fpbox">');
    html = i >= 0 ? html.slice(0, i) + box + html.slice(i) : box + html;
  }
  return html;
};
// rotation table: driver × constructor, cars driven
function rotTableHtml() {
  const R = G.rot; if (!R) return '<p class="dk-mut">The lottery starts at the first Grand Prix.</p>';
  const teams = [...new Set(R.seats.map(s => s[0]))].map(id => G.teams[id]);
  const rows = R.pool.map(id => G.drivers[id]).filter(Boolean).sort((a, b) => b.pts - a.pts).map(d => {
    const u = R.used[d.id] || {}, cur = WK && R.rounds[WK.round] && R.rounds[WK.round][d.id] != null ? R.seats[R.rounds[WK.round][d.id]][0] : null;
    const cy = (R.cyc || {})[d.id] || 1, done = Object.values(u).reduce((a, l) => a + l.length, 0);
    return `<tr><td class="l">${dkFlag(d.nat)} ${esc(d.code || d.name)}</td><td class="ra">${d.pts}</td><td class="ra">${cy > 1 ? `#${cy} · ` : ''}${done}/${R.seats.length}</td>${teams.map(t => { const n = (u[t.id] || []).length, full = n >= (t.cars || 2);
      return `<td class="rot-c ${full ? 'full' : ''} ${cur === t.id ? 'now' : ''}" style="--tc:${t.color}">${n ? (full ? '✓' : '●'.repeat(n)) : ''}</td>`; }).join('')}</tr>`; }).join('');
  return `<p class="dk-mut small">● = one Grand Prix in that constructor's car, ✓ = every car of that constructor driven, so the lottery skips it. "Cars" counts the cars driven so far; once a driver has driven every car on the grid (#2) a new cycle starts. The outlined cell is this weekend's car.</p>
  <div class="rot-scroll"><table class="dkfp rot-tab"><thead><tr><th class="l">Driver</th><th class="ra">Pts</th><th class="ra" title="Cars driven in the current cycle">Cars</th>${teams.map(t => `<th style="--tc:${t.color}" class="rot-th" title="${esc(t.name)}">${esc((t.name || t.id).slice(0, 3).toUpperCase())}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
A.rotview = function () {
  hxOpen(`<div class="dkx-mod pot-mod"><div class="dkx-hd"><div><h2>Driver rotation</h2><div class="dk-mut">${G.year} · lottery seats</div></div><span class="sp"></span><button class="dkx-x" data-a="hxclose">✕</button></div><div class="dkx-body">${rotTableHtml()}</div></div>`);
};
const _rot_hqTabs = hqTabs;
hqTabs = function () { const t = _rot_hqTabs.apply(this, arguments); if (rotOn(G) && !t.includes('rot')) { const i = t.indexOf('standings'); t.splice(i + 1, 0, 'rot'); } return t; };
TAB_NAMES.rot = '🎰 Rotation';
const _rot_viewHQ = viewHQ;
viewHQ = function () { if (TAB === 'rot' && rotOn(G)) return `<div class="card pot-page"><h3>🎰 Driver rotation — ${G.year}</h3>${rotTableHtml()}</div>`; return _rot_viewHQ.apply(this, arguments); };
