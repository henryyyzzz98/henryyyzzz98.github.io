// ===================== SURVIVAL SEASON (Amazing Race-style competition mode) =====================
// No points at all. Each Grand Prix eliminates the last-placed driver(s) still in the competition for the rest of
// the season, spread so that 3 drivers reach the final round, and the winner of the final is champion.
// Express pass races (if on): the winner sits out the next round and is safe from elimination.
const svOn = (G0) => !!((G0 || G) && (G0 || G).survival);
const svCur = (G0) => { G0 = G0 || G; return G0 && G0.sv && G0.sv.year === G0.year ? G0.sv : null; };
// before round 1 the season hasn't been set up yet: preview it from the line-up (nothing is stored)
function svView(G0) {
  G0 = G0 || G; const S = svCur(G0); if (S || !G0) return S;
  const ids = Object.values(G0.drivers).filter(d => d.team && G0.teams[d.team] && !G0.teams[d.team].xt && !d.retired).map(d => d.id);
  if (!ids.length) return null;
  return { year: G0.year, pool: ids, out: {}, sched: svPlan(G0, ids), R: G0.cal.length, champ: null, preview: true };
}

// ---------- setup page: choose the competition ----------
const _sv_viewSetup = viewSetup;
viewSetup = function () {
  let html = _sv_viewSetup.apply(this, arguments);
  const c = SETUP.comp || 'points';
  if (SETUP.regs && SETUP.regs.format === 'exempt') return html.replace('<div class="row" style="margin:16px 0 40px">', `<div class="card sv-setup" style="margin-top:12px"><h3>Competition</h3><div class="small mut">🏁 Exemption weekend runs its own survival season: no points, a random 1–3 drivers out every weekend, revival rounds bring 2 back, and exactly 4 drivers race an endless final — the last driver running is champion.</div></div><div class="row" style="margin:16px 0 40px">`);
  const card = `<div class="card sv-setup" style="margin-top:12px"><h3>Competition</h3><div class="row">${[['points', '🏆 Points championship'], ['survival', '🏁 Survival season']].map(([k, v]) => `<button data-a="setcomp" data-v="${k}" class="${c === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <div class="small mut" style="margin-top:8px">${c === 'survival' ? 'Amazing Race style: no points at all. After every Grand Prix the last-placed driver(s) still in the competition are eliminated for the rest of the season, until three drivers reach the final round. Whoever wins the final is champion. If the express pass race is on, its winner skips the next race and is safe from elimination. Points-based rules (prize pot, gamble grid) are switched off.' : 'The usual season: points for each race decide the championships.'}</div></div>`;
  return html.replace('<div class="row" style="margin:16px 0 40px">', card + '<div class="row" style="margin:16px 0 40px">');
};
A.setcomp = function (el) { SETUP.comp = el.dataset.v; render(); };
const _sv_startgame = A.startgame;
A.startgame = function () {
  const r = _sv_startgame.apply(this, arguments);
  if (G && SETUP.comp === 'survival' && !G.results.length) { G.survival = true; svNoPoints(G); news(G, '🏁 Survival season: no points — the last driver(s) home in each Grand Prix are eliminated until three reach the final. Win the final to be champion.'); }
  return r;
};
function svNoPoints(G0) { if (G0.regs) { if (G0.regs.pot === 'on') G0.regs.pot = 'off'; if (G0.regs.gamble === 'on') G0.regs.gamble = 'off'; } }
const _sv_dkApplyRegs = dkApplyRegs;
dkApplyRegs = function (G0) { const r = _sv_dkApplyRegs.apply(this, arguments); if (svOn(G0)) svNoPoints(G0); return r; };

// ---------- the season plan ----------
const SV_FINAL = 3;
function svPlan(G0, ids) {
  const R = G0.cal.length, P = ids.length, F = Math.min(SV_FINAL, P), E = Math.max(0, P - F), n = Math.max(1, R - 1), sched = [];
  for (let i = 0; i < R; i++) sched.push(i >= R - 1 ? 0 : Math.floor((i + 1) * E / n) - Math.floor(i * E / n));
  return sched;
}
function svState(G0, base) {
  if (G0.sv && G0.sv.year === G0.year) {
    const S = G0.sv;
    if (S.R !== G0.cal.length) { // calendar changed: re-spread the remaining eliminations over the remaining rounds
      const done = G0.results.length, alive = S.pool.filter(id => !S.out[id]).length, R = G0.cal.length, F = Math.min(SV_FINAL, S.pool.length), E = Math.max(0, alive - F), n = Math.max(1, R - 1 - done);
      S.sched = S.sched.slice(0, done); for (let i = done; i < R; i++) { const k = i - done; S.sched.push(i >= R - 1 ? 0 : Math.floor((k + 1) * E / n) - Math.floor(k * E / n)); }
      S.R = R;
    }
    return S;
  }
  if (!base) return null;
  // the season's contracted line-up (not one-off entries or stand-ins)
  let ids = Object.values(G0.drivers).filter(d => d.team && G0.teams[d.team] && !G0.teams[d.team].xt && !d.retired).map(d => d.id);
  if (!ids.length) ids = base.filter(e => !e.standin).map(e => e.d.id);
  if (G0.rot && G0.rot.year === G0.year && G0.rot.pool) ids = G0.rot.pool.slice();
  G0.sv = { year: G0.year, pool: ids, out: {}, sched: null, R: G0.cal.length, champ: null };
  G0.sv.sched = svPlan(G0, ids);
  return G0.sv;
}
const svAlive = (S, id) => S.pool.includes(id) && !S.out[id];
const svFinal = (G0, i) => i === G0.cal.length - 1;
function svCountTxt(G0, i) { const S = svView(G0); if (!S) return ''; if (typeof exIsRev === 'function' && exIsRev(G0 || G, i)) { const v = S.revN && S.revN[i]; return `♻️ Revival round — eliminated drivers race${v ? `, the first ${v} come back` : ' to come back'}`; }
  if (typeof exOn === 'function' && exOn(G0 || G) && S.preview && i < (G0 || G).cal.length - 1) return '🎲 1–3 drivers eliminated'; if (svFinal(G0, i)) return '🏁 FINAL — the winner is champion'; const k = S.sched[i] || 0; return k ? `⛔ ${k} driver${k > 1 ? 's' : ''} eliminated` : '🟢 Non-elimination round'; }

const _sv_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  const L = _sv_weekendEntries.apply(this, arguments);
  if (!svOn(G0)) return L;
  const S = svState(G0, L);
  if (G0.rot && G0.rot.year === G0.year) return L.filter(e => !S.out[e.d.id]);
  // only drivers still in the competition race — and every one of them races each round (bar an express-pass skip)
  let skip = null; try { const E = typeof expInfo === 'function' ? expInfo(G0) : null, h = E && expHalf(E, G0.round); skip = h && h.win; } catch (e) { }
  const out = [];
  S.pool.forEach(id => {
    if (S.out[id] || id === skip) return;
    const d = G0.drivers[id]; if (!d || d.retired) return;
    const have = L.find(e => e.d.id === id && !e.standin);
    if (have) { out.push(have); return; }
    const t = G0.teams[d.team] || G0.teams[d.hteam]; if (!t) return;
    out.push({ d, t, setup: rnd(0.35, 0.5) + (t.id === G0.player ? 0 : rnd(0.1, 0.3)), tyreKnow: t.id === G0.player ? 0 : rnd(0.2, 0.5), qualiPrep: t.id === G0.player ? 0 : rnd(0.2, 0.5) });
  });
  return out;
};
// express pass never sends a finalist away from the final
if (typeof expInfo === 'function') {
  const _sv_expInfo = expInfo;
  expInfo = function (G0) {
    const E = _sv_expInfo.apply(this, arguments); G0 = G0 || G;
    if (E && svOn(G0) && !E.svFix) { const N = G0.cal.length; E.list = E.list.filter(e => e.r + 1 < N - 1 || e.win); E.svFix = true; }
    return E;
  };
}

// ---------- results: no points, eliminations ----------
const _sv_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  if (!svOn(G0)) return _sv_applyRaceResult.apply(this, arguments);
  const dp = {}, tp = {}; Object.values(G0.drivers).forEach(d => { dp[d.id] = d.pts; }); Object.values(G0.teams).forEach(t => { tp[t.id] = t.pts; });
  const out = _sv_applyRaceResult.apply(this, arguments);
  try {
    // strip every point awarded (any points system, sprint, fastest lap, heats, …)
    Object.values(G0.drivers).forEach(d => { if (dp[d.id] != null) d.pts = dp[d.id]; else d.pts = 0; if (d.res && d.res.length && race && !race.sprint) d.res[d.res.length - 1] = 0; });
    Object.values(G0.teams).forEach(t => { if (tp[t.id] != null) t.pts = tp[t.id]; });
    const s = race && race.sprint ? null : G0.results[G0.results.length - 1];
    const rowsOf = s ? s.rows : (G0.sprints && G0.sprints.length ? (G0.sprints[G0.sprints.length - 1] || {}).rows || [] : []);
    (rowsOf || []).forEach(r => { r.pts = 0; });
    if (!s) return out;
    const S = svState(G0); if (!S) return out;
    const i = s.round - 1, ord = s.rows.slice().sort((a, b) => a.pos - b.pos).filter(r => svAlive(S, r.id));
    if (svFinal(G0, i)) {
      const w = ord[0];
      if (w) { S.champ = w.id; S.final = ord.map(r => r.id); s.surv = { final: true, champ: w.id };
        news(G0, `🏆 ${w.name} wins the final at ${roundTrack(G0, i).short} and is the ${G0.year} survival champion!`); }
    } else {
      const k = Math.min(S.sched[i] || 0, Math.max(0, ord.length - 1)), gone = k ? ord.slice(-k) : [];
      gone.forEach(r => { S.out[r.id] = { r: i, pos: r.pos, dnf: !!r.out }; });
      s.surv = { elim: gone.map(r => r.id), count: k };
      const left = S.pool.filter(id => !S.out[id]).length;
      news(G0, k ? `⛔ Eliminated at ${roundTrack(G0, i).short}: ${gone.map(r => `${r.name} (${r.out ? 'DNF' : 'P' + r.pos})`).join(', ')}. ${left} drivers remain.` : `🟢 ${roundTrack(G0, i).short} was a non-elimination round — all ${left} drivers carry on.`);
    }
    svArchive(G0);
  } catch (e) { console.error('survival', e); }
  return out;
};

// ---------- standings: survival order instead of points ----------
function svRankKey(G0, S, d) {
  if (!S.pool.includes(d.id)) return [3, 0, 0];
  if (S.final && S.final.includes(d.id)) return [0, S.final.indexOf(d.id), 0];
  if (!S.out[d.id]) { // still in: by average finish so far
    const fin = G0.results.map(r => r.rows.find(x => x.id === d.id)).filter(Boolean);
    const avg = fin.length ? fin.reduce((a, x) => a + (x.out ? 30 : x.pos), 0) / fin.length : 99;
    return [1, -fin.filter(x => x.pos === 1 && !x.out).length, avg];
  }
  const o = S.out[d.id]; return [2, -o.r, o.pos];
}
const _sv_standingsDrivers = standingsDrivers;
standingsDrivers = function (G0, upto, ptsOf) {
  const L = _sv_standingsDrivers.apply(this, arguments);
  if (!svOn(G0) || !svCur(G0) || ptsOf) return L;
  const S = G0.sv, extra = S.pool.map(id => G0.drivers[id]).filter(d => d && !L.includes(d)), all = L.concat(extra);
  const key = new Map(all.map(d => [d.id, svRankKey(G0, S, d)]));
  return all.sort((a, b) => { const x = key.get(a.id), y = key.get(b.id); for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return x[k] - y[k]; return a.name.localeCompare(b.name); });
};
const _sv_standingsTeams = standingsTeams;
standingsTeams = function (G0, upto, ptsOf) {
  const L = _sv_standingsTeams.apply(this, arguments);
  if (!svOn(G0) || !svCur(G0) || ptsOf) return L;
  const ds = standingsDrivers(G0), best = t => { const k = ds.findIndex(d => d.team === t.id); return k < 0 ? 999 : k; };
  return L.slice().sort((a, b) => best(a) - best(b));
};
if (typeof titleClinched === 'function') { const _sv_tc = titleClinched; titleClinched = function (G0) { return svOn(G0) ? null : _sv_tc.apply(this, arguments); }; }
function svStatus(G0, id) {
  const S = svView(G0); if (!S || !S.pool.includes(id)) return { t: '—', c: 'dk-mut' };
  if (S.champ === id) return { t: '🏆 CHAMPION', c: 'sv-champ' };
  if (S.final && S.final.includes(id)) return { t: `FINAL P${S.final.indexOf(id) + 1}`, c: 'sv-in' };
  const o = S.out[id]; if (o) return { t: `OUT · R${o.r + 1} ${roundTrack(G0, o.r).short.toUpperCase()}`, c: 'sv-out' };
  return { t: 'STILL IN', c: 'sv-in' };
}

// ---------- championship page → survival board ----------
// express pass skips this season: {skipped round index: winner id}
function svExpMap(G0) { const m = {}; try { const E = typeof expInfo === 'function' ? expInfo(G0) : null; if (E) E.list.forEach(e => { if (e.win) m[e.r + 1] = e.win; }); } catch (e) { } return m; }
// keep each season's survival record (small) so past seasons can be browsed
function svArchive(G0) {
  const S = svCur(G0); if (!S) return;
  G0.svArch = G0.svArch || {};
  G0.svArch[G0.year] = { pool: S.pool.slice(), out: JSON.parse(JSON.stringify(S.out)), sched: S.sched.slice(), champ: S.champ, final: S.final ? S.final.slice() : null, exp: svExpMap(G0), exr: S.exr ? JSON.parse(JSON.stringify(S.exr)) : null, exw: !!(G0.rules && G0.rules.exempt) };
}
const _sv_dkArchiveSeason = dkArchiveSeason;
dkArchiveSeason = function (G0) { const r = _sv_dkArchiveSeason.apply(this, arguments); try { if (svOn(G0)) svArchive(G0); } catch (e) { } return r; };
function svRankGen(S, results, id) {
  if (!S.pool.includes(id)) return [3, 0, 0];
  if (S.final && S.final.includes(id)) return [0, S.final.indexOf(id), 0];
  if (!S.out[id]) { const fin = results.map(r => r.rows.find(x => x.id === id)).filter(Boolean); const avg = fin.length ? fin.reduce((a, x) => a + (x.out ? 30 : x.pos), 0) / fin.length : 99; return [1, -fin.filter(x => x.pos === 1 && !x.out).length, avg]; }
  const o = S.out[id]; return [2, -o.r, o.pos];
}
function svStatusGen(S, cal, id) {
  if (!S || !S.pool.includes(id)) return { t: '—', c: 'dk-mut' };
  if (S.champ === id) return { t: '🏆 CHAMPION', c: 'sv-champ' };
  if (S.final && S.final.includes(id)) return { t: `FINAL P${S.final.indexOf(id) + 1}`, c: 'sv-in' };
  const o = S.out[id]; if (o) return { t: `OUT · R${o.r + 1} ${(cal[o.r] ? cal[o.r][0] : '').toUpperCase()}`, c: 'sv-out' };
  return { t: 'STILL IN', c: 'sv-in' };
}
const _sv_deskStandings = deskStandings;
deskStandings = function () {
  if (!svOn()) return _sv_deskStandings.apply(this, arguments);
  const years = (G.histYears || []).filter(y => y !== G.year).sort((a, b) => b - a);
  if (DK3.season != null && DK3.season !== G.year && !years.includes(DK3.season)) DK3.season = null;
  const cur = DK3.season == null || DK3.season === G.year;
  const D = dkSeasonData(cur ? null : DK3.season) || dkSeasonData(null);
  const S = cur ? svView(G) : (G.svArch || {})[D.year] || null;
  const tm = id => (D.allTeams || D.teams).find(t => t.id === id) || (G.teams[id] ? { id, name: G.teams[id].name, color: G.teams[id].color } : null);
  const raced = {}; D.results.forEach(r => r && r.rows.forEach(x => { if (x.team) raced[x.id] = x.team; }));
  const teamOf = d => (d.team && tm(d.team)) ? d.team : raced[d.id] || null;
  const tcell = (id, extra = '') => { const t = tm(id); return t ? `<td class="l tcell ${extra}" style="--tc:${t.color};--ti:${dkInk(t.color)}">${esc(t.name)}</td>` : `<td class="l ${extra}">—</td>`; };
  const rounds = D.n || D.cal.length, done = D.results.length, mode = DK2.st, cal = D.cal;
  const isFinal = i => i === rounds - 1;
  const EXW = S && (S.exw || S.exr || (cur && typeof exOn === 'function' && exOn()));
  const flags = cal.map((c, i) => { const k = S && S.sched ? S.sched[i] : 0; return `<th class="fl ${i < done ? '' : 'todo'} ${EXW ? 'exw3' : ''}" ${EXW ? 'colspan="2"' : ''} title="R${i + 1} ${esc(c[0])}">${dkFlag(c[1])}<div class="sv-k">${EXW && i > done && !isFinal(i) && !((S && S.revR && i in S.revR) || (cur && typeof exIsRev === 'function' && exIsRev(G, i))) ? '?' : isFinal(i) ? 'F' : (S && S.revR && i in S.revR) || (cur && typeof exIsRev === 'function' && exIsRev(G, i)) ? '♻' : k ? '−' + k : '·'}</div>${EXW ? (S.revR && i in S.revR || (cur && typeof exIsRev === 'function' && exIsRev(G, i)) ? '<div class="exw-sub"><span>REV</span></div>' : '<div class="exw-sub"><span>1</span><span>2</span></div>') : ''}</th>`; }).join('');
  const alive = S ? S.pool.filter(id => !S.out[id]).length : 0;
  const seasonSel = years.length ? `<select class="dk-season" data-dkc="dkseason">${[G.year, ...years].map(y => `<option value="${y}" ${y === D.year ? 'selected' : ''}>${y}${y === G.year ? ' — current season' : ''}</option>`).join('')}</select>` : '';
  let body;
  if (DK2.panel === 'hist') {
    const ys = [G.year, ...years].filter(y => (G.svArch || {})[y] || y === G.year);
    body = `<div class="dk-h"><b>Survival champions</b></div><div class="dk-scroll"><table class="dkres"><thead><tr><th>Year</th><th class="l">Champion</th><th class="l">Other finalists</th><th class="l">First out</th></tr></thead><tbody>${ys.map(y => {
      const V = y === G.year ? svCur(G) : G.svArch[y]; if (!V) return '';
      const nm = id => { const d = G.drivers[id]; if (d) return esc(d.name); const P = dkSeasonData(y); const x = P && P.drivers.find(z => z.id === id); return x ? esc(x.name) : id; };
      const first = Object.entries(V.out || {}).sort((a, b) => a[1].r - b[1].r || b[1].pos - a[1].pos)[0];
      return `<tr><td>${y}</td><td class="l">${V.champ ? `🏆 <b>${nm(V.champ)}</b>` : `<span class="dk-mut">in progress · ${V.pool.filter(id => !V.out[id]).length} still in</span>`}</td><td class="l">${V.final ? V.final.filter(id => id !== V.champ).map(nm).join(', ') : ''}</td><td class="l dk-mut">${first ? nm(first[0]) : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else if (!S) {
    body = `<div class="dk-empty">No survival record was kept for ${D.year}.</div>`;
  } else if (mode === 'd') {
    const byId = new Map(D.drivers.map(d => [d.id, d]));
    S.pool.forEach(id => { if (!byId.has(id) && G.drivers[id]) { const d = G.drivers[id]; byId.set(id, { id, name: d.name, nat: d.nat, team: d.team }); } });
    let sd = [...byId.values()].filter(d => S.pool.includes(d.id));
    if (!S.preview) { const key = new Map(sd.map(d => [d.id, svRankGen(S, D.results, d.id)])); sd.sort((a, b) => { const x = key.get(a.id), y = key.get(b.id); for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return x[k] - y[k]; return a.name.localeCompare(b.name); }); }
    else sd = S.pool.map(id => byId.get(id)).filter(Boolean);
    const XM = cur ? svExpMap(G) : (S.exp || {});
    body = `<div class="dk-h"><b>Survival Board ${D.year}</b><span class="dk-mut"> · ${S.champ ? 'season complete' : `${alive} still in · ${S.pool.length - alive} eliminated`}</span></div><div class="dk-scroll"><table class="dkst ${DK2.modern ? 'modern' : 'classic'}"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Driver</th><th></th><th class="l">Team</th>${flags}<th class="pts">Status</th></tr></thead><tbody>${sd.map((d, i) => {
      const RV = (S.revived || []).filter(x => x.id === d.id);
      const exCells = k => { const res = D.results[k], m = S.exr && S.exr[k] && S.exr[k][d.id], isRev = S.revR && k in S.revR;
        const wasOut = S.out[d.id] && k > S.out[d.id].r || RV.some(x => k > x.outR && k < x.revR);
        const gone = (S.out[d.id] && S.out[d.id].r === k) || RV.some(x => x.outR === k);
        if (!m) { const skip = !isRev && res && !wasOut && (XM[k] === d.id || (S.pool.includes(d.id) && (!S.out[d.id] || k < S.out[d.id].r)));
          return skip ? `<td class="rc exw-c" colspan="2"><span class="sv-skip">EXP</span></td>` : `<td class="rc exw-c" ${isRev ? 'colspan="2"' : ''}>${wasOut ? '<span class="dk-mut">×</span>' : ''}</td>${isRev ? '' : '<td class="rc exw-c"></td>'}`; }
        if (isRev) { const v = m[0], won = [].concat(S.revR[k] || []).includes(d.id); return `<td class="rc exw-c ${won ? 'sv-revwin' : v ? dkResCls(v === 'NC' ? { pos: 99, out: 'NC' } : { pos: +v + 3 }) : ''}" colspan="2" title="Revival round">${won ? '♻ 1' : v}</td>`; }
        const lastG = m[1] ? 1 : 0;
        return m.slice(0, 2).map((v, g) => `<td class="rc exw-c ${v ? dkResCls(v === 'NC' ? { pos: 99, out: 'NC' } : { pos: +v }) : ''} ${gone && g === lastG ? 'sv-gone' : ''}">${v ? (v === 'NC' ? 'NC' : v) : ''}</td>`).join(''); };
      if (EXW) return (() => { const tid = teamOf(d), t = tm(tid), st = svStatusGen(S, cal, d.id);
        return `<tr class="${cur && (G.player ? d.team === G.player : d.id === G.follow) ? 'me' : ''} ${S.out[d.id] ? 'sv-dim' : ''}" data-prof="${d.id}"><td class="pos" style="border-left:3px solid ${t ? t.color : '#444'}">${i + 1}</td><td class="l nm">${esc(d.name)}</td><td class="flc">${dkFlag(d.nat)}</td>${tid ? tcell(tid) : '<td class="l"></td>'}${cal.map((_, k) => exCells(k)).join('')}<td class="pts ${st.c}">${st.t}</td></tr>`; })();
      const cells = cal.map((_, k) => { const res = D.results[k]; const r = res && res.rows.find(x => x.id === d.id); const gone = S.out[d.id] && S.out[d.id].r === k;
        const skip = !r && res && (XM[k] === d.id || (S.pool.includes(d.id) && (!S.out[d.id] || k < S.out[d.id].r))); // still in but didn't race = express-pass skip
        return `<td class="rc ${dkResCls(r)} ${gone ? 'sv-gone' : ''}">${r ? dkResTxt(r, res) : skip ? '<span class="sv-skip" title="Express pass — skipped and safe">EXP</span>' : S.out[d.id] && k > S.out[d.id].r ? '<span class="dk-mut">×</span>' : ''}</td>`; }).join('');
      const tid = teamOf(d), t = tm(tid), st = svStatusGen(S, cal, d.id);
      return `<tr class="${cur && (G.player ? d.team === G.player : d.id === G.follow) ? 'me' : ''} ${S.out[d.id] ? 'sv-dim' : ''}" data-prof="${d.id}"><td class="pos" style="border-left:3px solid ${t ? t.color : '#444'}">${i + 1}</td><td class="l nm">${esc(d.name)}</td><td class="flc">${dkFlag(d.nat)}</td>${tid ? tcell(tid) : '<td class="l"></td>'}${cells}<td class="pts ${st.c}">${st.t}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else {
    const drvTeam = id => { const d = D.drivers.find(x => x.id === id); return d ? teamOf(d) : (G.drivers[id] && cur ? G.drivers[id].team : null); };
    const tids = [...new Set(S.pool.map(drvTeam).filter(Boolean))];
    const rank = tid => { const ids = S.pool.filter(id => drvTeam(id) === tid); return Math.min(...ids.map(id => { const k = svRankGen(S, D.results, id); return k[0] * 1000 + (k[0] === 2 ? -k[1] * -1 : 0) * 10 + (k[0] === 0 ? k[1] : 0); })); };
    const nm = id => { const d = D.drivers.find(x => x.id === id) || G.drivers[id]; return d ? esc(d.code || d.name) : id; };
    body = `<div class="dk-h"><b>Constructors — drivers still in · ${D.year}</b></div><div class="dk-scroll"><table class="dkst cons"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Team</th><th class="l">Still in</th><th class="l">Eliminated</th></tr></thead><tbody>${tids.sort((a, b) => S.pool.filter(id => drvTeam(id) === b && !S.out[id]).length - S.pool.filter(id => drvTeam(id) === a && !S.out[id]).length).map((tid, i) => {
      const ids = S.pool.filter(id => drvTeam(id) === tid), t = tm(tid);
      return `<tr class="${cur && tid === G.player ? 'me' : ''}"><td class="pos" style="border-left:3px solid ${t ? t.color : '#444'}">${i + 1}</td>${tcell(tid, 'stk1')}<td class="l">${ids.filter(id => !S.out[id]).map(nm).join(', ') || '—'}</td><td class="l dk-mut">${ids.filter(id => S.out[id]).map(id => `${nm(id)} (R${S.out[id].r + 1})`).join(', ') || '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  const nx = !S || DK2.panel === 'hist' ? '' : S.champ ? `<b class="sv-champ">🏆 ${esc((G.drivers[S.champ] || { name: S.champ }).name)} is champion</b>` : cur && done < rounds ? `<span class="dk-mut">Next: R${done + 1} ${esc(cal[done][0])} — ${esc(svCountTxt(G, done))}</span>` : '';
  return `<div class="dk dk-page" id="dk"><div class="dk-pagehead"><h1>Survival Season</h1><span class="sp"></span><span class="dk-mut">${D.year} · Round ${done} of ${rounds} · no points</span><button data-a="tab" data-v="home">Back</button></div>
  <div class="dk-pagebar"><span class="dk-tabs2">${[['d', 'Drivers'], ['t', 'Constructors']].map(([k, v]) => `<button class="${mode === k && DK2.panel !== 'hist' ? 'on' : ''}" data-a="dkst" data-v="${k}">${v}</button>`).join('')}</span><span class="sp"></span>${nx}${seasonSel}<button class="${DK2.panel === 'hist' ? 'on' : ''}" data-a="dkst2" data-v="hist">Champions</button></div>
  <section class="dk-stbox">${body}</section>
  <div class="dk-legend"><span class="dk-mut">${EXW ? 'Each round shows Grand Prix 1 and 2 (NC = not classified); ♻ = revival round for eliminated drivers. The last driver running in the endless final is champion. ' : ''}Under each flag: −N = drivers eliminated that round · · = non-elimination round · F = final. The last-placed drivers still in the competition are eliminated; retirements count as last.</span></div></div>`;
};

// ---------- race weekend: grid note, live board, results ----------
const _sv_deskGrid = deskGrid;
deskGrid = function (sprint) {
  let html = _sv_deskGrid.apply(this, arguments);
  if (!svOn()) return html;
  html = html.replace(/, which pays half points\./g, ' and is safe from elimination.').replace(/½ <b>Half points this race\.<\/b>/g, '🎟️ <b>Express pass in use.</b>');
  if (typeof exOn === 'function' && exOn()) return html;
  if (sprint) return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note">🏁 Survival season: the sprint is for glory only — nobody is eliminated.</div>$1`);
  return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note"><b>🏁 Survival season · ${esc(svCountTxt(G, G.round))}.</b> ${svFinal(G, G.round) ? '' : (G.sv && G.sv.sched[G.round]) ? 'The last-placed driver(s) at the flag are out for the rest of the season.' : 'Everyone races on, whatever the result.'}</div>$1`);
};
if (typeof deskCalendar === 'function') {
  const _sv_deskCalendar = deskCalendar;
  deskCalendar = function () {
    let html = _sv_deskCalendar.apply(this, arguments);
    if (!svOn()) return html;
    html = html.replace(/½ PTS/g, '🎟️ SAFE');
    G.cal.forEach((_, i) => { const S = svView(); if (!S || !S.sched) return; const t = svFinal(G, i) ? 'FINAL' : typeof exIsRev === 'function' && exIsRev(G, i) ? 'REVIVAL' : S.sched[i] ? `−${S.sched[i]}` : 'NO ELIM';
      html = html.replace(new RegExp(`(data-a="dkcalsel" data-v="${i}">[\\s\\S]*?<span class="nm">[^<]*</span>)`), `$1<span class="exp sv-tag">${t}</span>`); });
    return html;
  };
}
hxChain('raceInit', race => {
  if (!svOn() || race.sprint || race.wk !== WK) return;
  race.msg(`🏁 Survival season · ${svCountTxt(G, G.round)}`, true);
});
const _sv_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _sv_updRace.apply(this, arguments);
  try {
    if (!svOn() || !RACE || RACE.sprint || !svCur() || (typeof exOn === 'function' && exOn())) return r;
    const S = G.sv, ds = document.getElementById('dksess'), fin = svFinal(G, G.round), k = S.sched[G.round] || 0;
    const run = RACE.order().filter(c => svAlive(S, c.d.id)), danger = fin ? [] : run.slice(-k);
    const tag = ` <span class="rng-chip pend sv-chip">${fin ? '🏁 FINAL' : k ? `⛔ OUT: ${danger.map(c => c.d.code).join(' ')}` : '🟢 NO ELIMINATION'}</span>`;
    if (ds) { const o = ds.querySelector('.sv-chip'); if (o) { if (o.outerHTML !== tag.trim()) o.outerHTML = tag; } else ds.insertAdjacentHTML('beforeend', tag); }
    document.querySelectorAll('#dk tr[data-v]').forEach(tr => { const c = RACE.cars.find(x => x.d.id === tr.dataset.v); if (c) tr.classList.toggle('elimr-danger', danger.includes(c)); });
  } catch (e) { }
  return r;
};
// live "championship" pop-up becomes the live survival picture
const _sv_lcsHtml = lcsHtml;
lcsHtml = function () {
  if (!svOn() || !svCur()) return _sv_lcsHtml.apply(this, arguments);
  const R = RACE, S = G.sv, fin = svFinal(G, G.round), k = R.sprint || (typeof exOn === 'function' && exOn()) ? 0 : S.sched[G.round] || 0, run = R.order().filter(c => svAlive(S, c.d.id)), lead = run[0], lap = lead ? Math.min(R.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
  const me = c => (G.player ? c.t.id === G.player : c.d.id === G.follow) ? 'me' : '';
  const rows = run.map((c, i) => { const out = !fin && i >= run.length - k; return `<tr class="${me(c)} ${out ? 'sv-danger' : ''}"><td>${i + 1}</td><td class="l"><i class="lcs-sw" style="background:${c.t.color}"></i>${dkFlag(c.d.nat)} ${esc(c.d.name)}</td><td class="ra">${c.out ? 'DNF' : 'P' + (R.order().indexOf(c) + 1)}</td><td class="ra">${fin ? (i === 0 ? '🏆' : '') : out ? '<b class="bad">OUT</b>' : '<span class="good">SAFE</span>'}</td></tr>`; }).join('');
  const gone = S.pool.filter(id => S.out[id]).map(id => G.drivers[id]).filter(Boolean);
  return `<div class="dkx-mod lcs-mod" id="lcsmod"><div class="dkx-hd"><div><h2>🏁 LIVE SURVIVAL</h2><div class="dk-mut lcs-sub">${R.sprint ? 'Sprint — nobody is eliminated' : esc(svCountTxt(G, G.round))} &nbsp;|&nbsp; Lap ${lap}/${R.laps}</div></div><span class="sp"></span><button class="dkx-x" data-a="lcsclose">✕</button></div>
    <div class="lcs-grid"><section><div class="lcs-h">🪖 STILL IN · ${run.length}</div><div class="lcs-scroll"><table class="lcs-t"><thead><tr><th>#</th><th class="l">Driver</th><th class="ra">Race</th><th class="ra">If it ended now</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section><div class="lcs-h">⛔ ELIMINATED · ${gone.length}</div><div class="lcs-scroll"><table class="lcs-t"><tbody>${gone.sort((a, b) => S.out[b.id].r - S.out[a.id].r).map(d => `<tr><td class="l">${dkFlag(d.nat)} ${esc(d.name)}</td><td class="ra dk-mut">R${S.out[d.id].r + 1} ${esc(roundTrack(G, S.out[d.id].r).short)}</td></tr>`).join('') || '<tr><td class="dk-mut">Nobody yet</td></tr>'}</tbody></table></div></section></div>
    <div class="lcs-foot"><span class="dk-mut">Order among drivers still in the competition · retirements count as last</span><span class="sp"></span><button data-a="lcsclose">✕ Close <kbd>Esc</kbd></button></div></div>`;
};
const _sv_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  let html = _sv_dkRaceView.apply(this, arguments);
  if (!svOn()) return html;
  const s = G.results[o.k];
  html = html.replace('<th class="ra">Pts</th></tr></thead>', '<th class="ra">Survival</th></tr></thead>');
  html = html.replace(/<section><div class="dk-h"><b>(DRIVERS|TEAMS) STANDINGS AFTER[\s\S]*?<\/section>/g, ''); // no points → no points tables
  html = html.replace(/<tr class="([^"]*)" data-prof="([^"]+)"([\s\S]*?)<td class="ra plain">[^<]*<\/td><\/tr>/g, (m, cls, id, mid) => {
    let t = '';
    if (!o.sprint && s && s.surv && s.surv.rev !== undefined) t = [].concat(s.surv.rev || []).includes(id) ? '<b class="good">♻️ REVIVED</b>' : '<span class="dk-mut">Still out</span>';
    else if (!o.sprint && s && s.surv) { if (s.surv.final) t = s.surv.champ === id ? '<b class="sv-champ">🏆 CHAMPION</b>' : G.sv && G.sv.final && G.sv.final.includes(id) ? 'Finalist' : '';
      else if (s.surv.elim.includes(id)) t = '<b class="bad">ELIMINATED</b>'; else if (G.sv && G.sv.pool.includes(id)) t = '<span class="good">Safe</span>'; }
    return `<tr class="${cls}" data-prof="${id}"${mid}<td class="ra plain">${t}</td></tr>`;
  });
  if (!o.sprint && s && s.surv && s.surv.rev !== undefined) {}
  else if (!o.sprint && s && s.surv && !s.surv.final) {
    const el = s.surv.elim.map(id => G.drivers[id]).filter(Boolean);
    html = html.replace('<table class="dkfp dkrr">', `<div class="heat-strip sv-strip"><span><b>🏁 Survival</b> · ${el.length ? `Eliminated: ${el.map(d => esc(d.name)).join(', ')}` : 'Non-elimination round — everyone races on'}</span><span>${G.sv ? G.sv.pool.filter(id => !G.sv.out[id] || G.sv.out[id].r > s.round - 1).length : ''} drivers remain</span></div><table class="dkfp dkrr">`);
  } else if (!o.sprint && s && s.surv && s.surv.final && G.drivers[s.surv.champ]) html = html.replace('<table class="dkfp dkrr">', `<div class="heat-strip sv-strip"><span><b>🏆 ${esc(G.drivers[s.surv.champ].name)} wins the final and the survival season!</b></span></div><table class="dkfp dkrr">`);
  return html;
};
// FIA documents: no points table in a survival season
if (typeof docAdd === 'function') { const _sv_docAdd = docAdd; docAdd = function (key) { if (svOn() && key === 'champ') return; return _sv_docAdd.apply(this, arguments); }; }
// no live championship projection numbers anywhere else
if (typeof potLive === 'function') { const _sv_potLive = potLive; potLive = function (R, running) { if (svOn()) { const a = {}; running.forEach(c => { a[c.d.id] = 0; }); return a; } return _sv_potLive.apply(this, arguments); }; }
// sprints score nothing either
const _sv_applySprintResult = applySprintResult;
applySprintResult = function (G0, race) {
  if (!svOn(G0)) return _sv_applySprintResult.apply(this, arguments);
  const dp = {}, tp = {}; Object.values(G0.drivers).forEach(d => { dp[d.id] = d.pts; }); Object.values(G0.teams).forEach(t => { tp[t.id] = t.pts; });
  const rows = _sv_applySprintResult.apply(this, arguments);
  Object.values(G0.drivers).forEach(d => { d.pts = dp[d.id] != null ? dp[d.id] : 0; }); Object.values(G0.teams).forEach(t => { if (tp[t.id] != null) t.pts = tp[t.id]; });
  (rows || []).forEach(r => { r.pts = 0; });
  return rows;
};
// regulations form: in a survival season, hide every rule that only changes points
const SV_PTS_RULES = ['Stand-in &amp; reserve drivers', 'Stand-in & reserve drivers', 'Points system', 'Pole position bonus', 'Fastest lap bonus', 'Dropped scores', 'Three-part GP points', 'Prize pot points', 'Gamble grid slots'];
function svCtx() { return VIEW === 'setup' ? SETUP.comp === 'survival' : svOn(); }
const _sv_dkRegsForm = dkRegsForm;
dkRegsForm = function (r, act) {
  let html = _sv_dkRegsForm.apply(this, arguments);
  if (!svCtx() && !(r && r.format === 'exempt')) return html;
  SV_PTS_RULES.forEach(n => { html = html.replace(new RegExp(`<label class="small"[^>]*>${n.replace(/[()&]/g, '\\$&')}<select[\\s\\S]*?</select></label>`), ''); });
  html = html.replace(/<label class="small">Points for 1st, 2nd, 3rd…[\s\S]*?<\/label>/, '').replace(/(Points system[\s\S]*?)?<span><\/span>/, '');
  html = html.replace('each winner skips the next race, which pays half points', 'each winner skips the next race and is safe from elimination');
  return html.replace(/(<div class="grid g2" style="gap:10px">)/, `$1<div class="small sv-regnote" style="grid-column:1/-1">🏁 Survival season: there are no points, so rules that only change points (points system, pole and fastest-lap bonuses, dropped scores, three-part GP points, prize pot, gamble grid) are hidden, and so are stand-ins — every driver still in the competition races each round.</div>`);
};

// ---------- HQ home: no title fight / points tables in a survival season ----------
function svHomeCard() {
  const S = svView(G); if (!S) return '';
  const alive = S.pool.filter(id => !S.out[id]).map(id => G.drivers[id]).filter(Boolean);
  const gone = S.pool.filter(id => S.out[id]).sort((a, b) => S.out[b].r - S.out[a].r).map(id => G.drivers[id]).filter(Boolean);
  const done = G.results.length, R = G.cal.length;
  const head = S.champ ? `<div class="big">🏆 ${esc(G.drivers[S.champ].name)}</div><div class="mut small">${G.year} survival champion</div>`
    : `<div class="big">${alive.length} still in</div><div class="mut small">${gone.length} eliminated · ${done < R ? `next: R${done + 1} ${esc(roundTrack(G, done).short)} — ${esc(svCountTxt(G, done))}` : ''}</div>`;
  const fav = G.follow && G.drivers[G.follow], st = fav && svStatus(G, fav.id);
  const me = G.player ? S.pool.filter(id => G.drivers[id] && G.drivers[id].team === G.player).map(id => G.drivers[id]) : [];
  const mine = (fav ? [fav] : []).concat(me).map(d => { const s2 = svStatus(G, d.id); return `<div class="news">${G.follow === d.id ? '⭐ ' : ''}${flag(d.nat)} <b>${esc(d.name)}</b> — <span class="${s2.c}">${esc(s2.t)}</span></div>`; }).join('');
  return `<div class="card"><h3>Survival season</h3>${head}${mine}</div>
  <div class="card"><h3>Still in · ${alive.length}</h3><div class="sv-chips">${alive.map(d => `<span class="sv-chipd">${tbar(d.team)}${esc(d.name)}</span>`).join('')}</div>
  ${gone.length ? `<h3 style="margin-top:12px">Eliminated · ${gone.length}</h3><table>${gone.slice(0, 8).map(d => `<tr><td>${tbar(d.team)}${esc(d.name)}</td><td class="mut small" style="text-align:right">R${S.out[d.id].r + 1} ${esc(roundTrack(G, S.out[d.id].r).short)}</td></tr>`).join('')}</table>${gone.length > 8 ? `<div class="mut small">+${gone.length - 8} more on the Standings page</div>` : ''}` : ''}</div>`;
}
function svHomeFix(html) {
  if (!svOn()) return html;
  const re = /<div class="card"><h3>(Title fight|Drivers' championship|Constructors)<\/h3>[\s\S]*?<\/div>\s*(?=<div class="card")/g;
  let first = true;
  html = html.replace(re, () => { if (first) { first = false; return svHomeCard(); } return ''; });
  // manager team card: no points / constructors position
  html = html.replace(/-?\d+ pts · P\d+/g, '');
  return html.replace(/<div><div class="big">P\d+<\/div><div class="mut small">Constructors<\/div><\/div><div><div class="big">-?\d+<\/div><div class="mut small">Points<\/div><\/div>/, '');
}
const _sv_specHome = specHome; specHome = function () { return svHomeFix(_sv_specHome.apply(this, arguments)); };
const _sv_hqHome = hqHome; hqHome = function () { return svHomeFix(_sv_hqHome.apply(this, arguments)); };

// ---------- the weekend format can't change once the game has started ----------
const _sv_dkRegsForm2 = dkRegsForm;
dkRegsForm = function (r, act) {
  let html = _sv_dkRegsForm2.apply(this, arguments);
  const started = G && ((G.results && G.results.length) || (G.histYears && G.histYears.length) || G.round > 0 || WK);
  if (VIEW !== 'setup' && started) html = html.replace(/(<select[^>]*data-k="format"[^>]*)>/, '$1 disabled title="The weekend format is fixed for the whole game">').replace(/(Weekend format)(<select)/, '$1 <span class="dk-mut small">(fixed for this game)</span>$2');
  return html;
};
// storylines: no points-based title fight / constructors stories in a survival season
if (typeof stHeadlines === 'function') {
  const _sv_stHeadlines = stHeadlines;
  stHeadlines = function () {
    const L = _sv_stHeadlines.apply(this, arguments);
    if (!svOn()) return L;
    return L.filter(x => !/world champion|championship|Match point|Neck and neck|Constructors|season preview/i.test(x.title || '') && !/\bpoints?\b/i.test(x.text || ''));
  };
}
