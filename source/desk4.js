// ===================== Past seasons in the calendar: full results of every round =====================
const DK4 = { cy: null, cache: {} };
const dkFullKey = (G0, y) => 'pitwall_full_' + dkSid(G0) + '_' + y;
const dkR3 = x => x == null || typeof x !== 'number' ? x : Math.round(x * 1000) / 1000;
const DK4_DROP = ['lapPos', 'stints', 'dotdCands', 'fantasy', 'milestone', 'clinched'];

// save a slim copy of the whole season (results + practice/quali archives + who drove for whom) before it is reset
function dkSaveFull(G0) {
  try {
    if (!G0 || !G0.results || !G0.results.length) return;
    const usedD = new Set(), usedT = new Set(Object.keys(G0.teams));
    const slimRows = rs => rs ? rs.map(x => { usedD.add(x.id); usedT.add(x.team); return Object.assign({}, x, { time: dkR3(x.time), best: dkR3(x.best) }); }) : rs;
    const results = G0.results.map(r => { const o = {}; for (const k in r) if (!DK4_DROP.includes(k)) o[k] = r[k]; o.rows = slimRows(r.rows); o.sprint = slimRows(r.sprint); return o; });
    standingsDrivers(G0).forEach(d => { if (d.team || d.pts > 0) usedD.add(d.id); });
    const P = { v: 1, year: G0.year, cal: G0.cal.slice(), calInfo: G0.calInfo || null, results, rules: G0.rules || null, regs: G0.regs || null, timeline: !!G0.timeline,
      drivers: Object.fromEntries([...usedD].filter(id => G0.drivers[id]).map(id => { const d = G0.drivers[id]; return [id, { id, name: d.name, nat: d.nat, code: d.code, team: d.team || d.hteam || null, pts: d.pts }]; })),
      teams: Object.fromEntries([...usedT].filter(id => G0.teams[id]).map(id => { const t = G0.teams[id]; return [id, { id, name: t.name, color: t.color, engine: t.engine, works: t.works, pts: t.pts }]; })),
      engines: Object.fromEntries(Object.entries(G0.engines || {}).map(([k, e]) => [k, { name: e.name }])) };
    const str = JSON.stringify(P);
    G0.fullYears = (G0.fullYears || []).filter(y => y !== G0.year);
    for (let tries = 0; tries < 40; tries++) {
      try { localStorage.setItem(dkFullKey(G0, G0.year), str); G0.fullYears.push(G0.year); break; }
      catch (e) { // storage full: drop the oldest detailed season (its final standings stay in the compact archive)
        const old = G0.fullYears.slice().sort((a, b) => a - b)[0]; if (old == null) break;
        try { localStorage.removeItem(dkFullKey(G0, old)); } catch (e2) { } G0.fullYears = G0.fullYears.filter(y => y !== old);
      }
    }
    delete DK4.cache[G0.year];
  } catch (e) { }
}
const _dk4_endseason = A.endseason;
A.endseason = function () { if (G) { dkArchiveSeason(G); dkSaveFull(G); } return _dk4_endseason.apply(this, arguments); };

// rebuild a season from the compact archive (older saves: final classification only)
function dkTrackFromShort(short, cc) { const L = Object.values(TRACK_BY_ID); const t = L.find(t => t.short === short && t.cc === cc) || L.find(t => t.short === short) || L.find(t => t.cc === cc); return t ? t.id : null; }
function dkPastSeason(y) {
  if (DK4.cache[y]) return DK4.cache[y];
  let P = null; try { P = JSON.parse(localStorage.getItem(dkFullKey(G, y))); } catch (e) { }
  if (P) { P.full = true; return DK4.cache[y] = P; }
  const A0 = dkLoadSeason(y); if (!A0) return null;
  const cal = A0.cal.map(c => dkTrackFromShort(c[0], c[1])); if (cal.some(x => !x)) return null;
  const un = r => { const d = A0.d[r[0]] || []; return { id: r[0], team: r[1], pos: r[2] || null, out: r[3] ? 'Retired' : null, pts: r[4], grid: r[5] || null, code: r[6] || d[2] || '', name: d[0] || r[0] }; };
  const results = A0.res.map((x, i) => ({ round: i + 1, track: cal[i], year: y, rows: x.r.map(un), sprint: x.s ? x.s.map(un) : null, fastest: x.f ? { code: x.f } : null }));
  const drivers = Object.fromEntries(Object.entries(A0.d).map(([id, d]) => [id, { id, name: d[0], nat: d[1], code: d[2], team: d[3], pts: d[4] }]));
  const engines = {}, teams = Object.fromEntries(Object.entries(A0.t).map(([id, t]) => { engines['e_' + id] = { name: t[2] }; return [id, { id, name: t[0], color: t[1], engine: 'e_' + id, pts: t[4] }]; }));
  return DK4.cache[y] = { year: y, cal, calInfo: null, results, drivers, teams, engines, rules: null, regs: A0.acad ? { format: 'academy' } : null, full: false };
}
function dkPastYears() { return [...new Set([...(G.histYears || []), ...(G.fullYears || [])])].filter(y => y !== G.year).sort((a, b) => b - a); }
function dkCurPast() {
  if (!G || DK4.cy == null || DK4.cy === G.year || VIEW !== 'hq' || TAB !== 'calendar') return null;
  return dkPastSeason(DK4.cy);
}
// run a view function with the past season standing in for the live one, then put everything back
function dkWith(P, fn) {
  const real = G;
  G = Object.assign({}, real, { year: P.year, cal: P.cal, calInfo: P.calInfo, results: P.results, drivers: P.drivers, teams: P.teams, engines: P.engines, rules: P.rules, regs: P.regs, round: P.cal.length, calNext: null, timeline: P.timeline != null ? P.timeline : real.timeline, _past: true });
  try { return fn(); } finally { G = real; }
}

// calendar: season picker + past-season mode
const _dk4_hqCalendar = hqCalendar;
hqCalendar = function () {
  const P = dkCurPast(); if (DK4.cy != null && !P) DK4.cy = null;
  let html = P ? dkWith(P, () => _dk4_hqCalendar()) : _dk4_hqCalendar();
  const years = dkPastYears();
  if (years.length) {
    const cur = P ? P.year : G.year;
    const sel = `<select class="dk-season" data-dkc="dkcalyear">${[G.year, ...years].map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}${y === G.year ? ' — current season' : ''}</option>`).join('')}</select>`;
    html = html.replace(/<span class="dk-yr">\d+ SEASON<\/span>/, `<span class="dk-yr">SEASON</span>${sel}`);
  }
  if (P) {
    html = html.replace(/<button data-a="editcal"[^>]*>[^<]*<\/button>/g, '');
    if (!P.full && !DK2.arch) html = html.replace('<div class="dkc-wrap">', '<div class="dk-mut dk4-note">This season was played before detailed results were kept, so only the final classification of each race is available.</div><div class="dkc-wrap">');
  }
  return html;
};
const _dk4_calDraw = dkCalDraw;
dkCalDraw = function () { const P = dkCurPast(); return P ? dkWith(P, () => _dk4_calDraw()) : _dk4_calDraw(); };
Object.assign(A, {
  dkcalyear(el) { if (el.tagName !== 'SELECT') return; const y = +el.value; DK4.cy = y === G.year ? null : y; DK3.sel = DK4.cy == null ? null : 0; DK2.arch = null; render(); },
  dkarch(el) { const v = +el.dataset.v, P = dkCurPast(), R = P ? P.results : G.results; DK2.arch = v >= 0 && R[v] ? { k: v, tab: DK2.arch ? DK2.arch.tab : 'race' } : null; render(); },
});
// leaving the calendar returns it to the current season
const _dk4_render = render;
render = function () { if (VIEW !== 'hq' || TAB !== 'calendar') DK4.cy = null; return _dk4_render.apply(this, arguments); };
