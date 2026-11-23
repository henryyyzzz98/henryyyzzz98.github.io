// ===================== SURVIVAL SEASON (Amazing Race-style competition mode) =====================
// No points at all. Each Grand Prix eliminates the last-placed driver(s) still in the competition for the rest of
// the season, spread so that 3 drivers reach the final round, and the winner of the final is champion.
// Express pass races (if on): the winner sits out the next round and is safe from elimination.
const svOn = (G0) => !!((G0 || G) && (G0 || G).survival);
const svCur = (G0) => { G0 = G0 || G; return G0 && G0.sv && G0.sv.year === G0.year ? G0.sv : null; };

// ---------- setup page: choose the competition ----------
const _sv_viewSetup = viewSetup;
viewSetup = function () {
  let html = _sv_viewSetup.apply(this, arguments);
  const c = SETUP.comp || 'points';
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
  let ids = base.filter(e => !e.standin).map(e => e.d.id);
  if (G0.rot && G0.rot.year === G0.year && G0.rot.pool) ids = G0.rot.pool.slice();
  G0.sv = { year: G0.year, pool: ids, out: {}, sched: null, R: G0.cal.length, champ: null };
  G0.sv.sched = svPlan(G0, ids);
  return G0.sv;
}
const svAlive = (S, id) => S.pool.includes(id) && !S.out[id];
const svFinal = (G0, i) => i === G0.cal.length - 1;
function svCountTxt(G0, i) { const S = svCur(G0); if (!S) return ''; if (svFinal(G0, i)) return '🏁 FINAL — the winner is champion'; const k = S.sched[i] || 0; return k ? `⛔ ${k} driver${k > 1 ? 's' : ''} eliminated` : '🟢 Non-elimination round'; }

const _sv_weekendEntries = weekendEntries;
weekendEntries = function (G0) {
  const L = _sv_weekendEntries.apply(this, arguments);
  if (!svOn(G0)) return L;
  const S = svState(G0, L);
  return L.filter(e => !S.out[e.d.id]);
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
  const S = svCur(G0); if (!S || !S.pool.includes(id)) return { t: '—', c: 'dk-mut' };
  if (S.champ === id) return { t: '🏆 CHAMPION', c: 'sv-champ' };
  if (S.final && S.final.includes(id)) return { t: `FINAL P${S.final.indexOf(id) + 1}`, c: 'sv-in' };
  const o = S.out[id]; if (o) return { t: `OUT · R${o.r + 1} ${roundTrack(G0, o.r).short.toUpperCase()}`, c: 'sv-out' };
  return { t: 'STILL IN', c: 'sv-in' };
}

// ---------- championship page → survival board ----------
const _sv_deskStandings = deskStandings;
deskStandings = function () {
  if (!svOn() ) return _sv_deskStandings.apply(this, arguments);
  const S = svCur(G);
  const rounds = G.cal.length, done = G.results.length, mode = DK2.st;
  const flags = G.cal.map((id, i) => { const t = roundTrack(G, i), k = S && S.sched ? S.sched[i] : 0; return `<th class="fl ${i < done ? '' : 'todo'}" title="R${i + 1} ${esc(t.short)} — ${esc(svCountTxt(G, i))}">${dkFlag(t.cc)}<div class="sv-k">${svFinal(G, i) ? 'F' : k ? '−' + k : '·'}</div></th>`; }).join('');
  const alive = S ? S.pool.filter(id => !S.out[id]).length : 0;
  let body;
  if (mode === 'd') {
    const sd = standingsDrivers(G).filter(d => S && S.pool.includes(d.id) || G.results.some(r => r.rows.some(x => x.id === d.id)));
    body = `<div class="dk-h"><b>Survival Board</b><span class="dk-mut"> · ${alive} still in · ${S ? S.pool.length - alive : 0} eliminated</span></div><div class="dk-scroll"><table class="dkst ${DK2.modern ? 'modern' : 'classic'}"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Driver</th><th></th><th class="l">Team</th>${flags}<th class="pts">Status</th></tr></thead><tbody>${sd.map((d, i) => {
      const cells = G.cal.map((_, k) => { const res = G.results[k]; const r = res && res.rows.find(x => x.id === d.id); const gone = S && S.out[d.id] && S.out[d.id].r === k;
        const skip = !r && res && typeof expInfo === 'function' && (() => { const E = expInfo(); const h = E && expHalf(E, k); return h && h.win === d.id; })();
        return `<td class="rc ${dkResCls(r)} ${gone ? 'sv-gone' : ''}">${r ? dkResTxt(r, res) : skip ? '<span class="sv-skip" title="Express pass — skipped and safe">EXP</span>' : S && S.out[d.id] && k > S.out[d.id].r ? '<span class="dk-mut">×</span>' : ''}</td>`; }).join('');
      const tc = d.team ? G.teams[d.team].color : '#444', st = svStatus(G, d.id);
      return `<tr class="${(G.player ? d.team === G.player : d.id === G.follow) ? 'me' : ''} ${S && S.out[d.id] ? 'sv-dim' : ''}"><td class="pos" style="border-left:3px solid ${tc}">${i + 1}</td><td class="l nm">${esc(d.name)}</td><td class="flc">${dkFlag(d.nat)}</td>${d.team ? dkTeamCell(d.team) : '<td class="l"></td>'}${cells}<td class="pts ${st.c}">${st.t}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else {
    const ts = standingsTeams(G).filter(t => S && S.pool.some(id => G.drivers[id] && G.drivers[id].team === t.id) || G.results.some(r => r.rows.some(x => x.team === t.id)));
    body = `<div class="dk-h"><b>Constructors — drivers still in</b></div><div class="dk-scroll"><table class="dkst cons"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Team</th><th class="l">Still in</th><th class="l">Eliminated</th></tr></thead><tbody>${ts.map((t, i) => {
      const ds = S ? S.pool.map(id => G.drivers[id]).filter(d => d && d.team === t.id) : [];
      return `<tr class="${t.id === G.player ? 'me' : ''}"><td class="pos" style="border-left:3px solid ${t.color}">${i + 1}</td>${dkTeamCell(t.id).replace('class="l tcell"', 'class="l tcell stk1"')}<td class="l">${ds.filter(d => !S.out[d.id]).map(d => esc(d.code)).join(', ') || '—'}</td><td class="l dk-mut">${ds.filter(d => S.out[d.id]).map(d => `${esc(d.code)} (R${S.out[d.id].r + 1})`).join(', ') || '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  const nx = done < rounds ? `<span class="dk-mut">Next: R${done + 1} ${esc(roundTrack(G, done).short)} — ${esc(svCountTxt(G, done))}</span>` : (S && S.champ ? `<b class="sv-champ">🏆 ${esc(G.drivers[S.champ].name)} is champion</b>` : '');
  return `<div class="dk dk-page" id="dk"><div class="dk-pagehead"><h1>Survival Season</h1><span class="sp"></span><span class="dk-mut">${G.year} · Round ${done} of ${rounds} · no points</span></div>
  <div class="dk-pagebar"><span class="dk-tabs2">${[['d', 'Drivers'], ['t', 'Constructors']].map(([k, v]) => `<button class="${mode === k ? 'on' : ''}" data-a="dkst" data-v="${k}">${v}</button>`).join('')}</span><span class="sp"></span>${nx}</div>
  <section class="dk-stbox">${body}</section>
  <div class="dk-legend"><span class="dk-mut">Under each flag: −N = drivers eliminated that round · · = non-elimination round · F = final. The last-placed drivers still in the competition are eliminated; retirements count as last.</span></div></div>`;
};

// ---------- race weekend: grid note, live board, results ----------
const _sv_deskGrid = deskGrid;
deskGrid = function (sprint) {
  let html = _sv_deskGrid.apply(this, arguments);
  if (!svOn()) return html;
  html = html.replace(/, which pays half points\./g, ' and is safe from elimination.').replace(/½ <b>Half points this race\.<\/b>/g, '🎟️ <b>Express pass in use.</b>');
  if (sprint) return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note">🏁 Survival season: the sprint is for glory only — nobody is eliminated.</div>$1`);
  return html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note sv-note"><b>🏁 Survival season · ${esc(svCountTxt(G, G.round))}.</b> ${svFinal(G, G.round) ? '' : (G.sv && G.sv.sched[G.round]) ? 'The last-placed driver(s) at the flag are out for the rest of the season.' : 'Everyone races on, whatever the result.'}</div>$1`);
};
if (typeof deskCalendar === 'function') {
  const _sv_deskCalendar = deskCalendar;
  deskCalendar = function () {
    let html = _sv_deskCalendar.apply(this, arguments);
    if (!svOn()) return html;
    html = html.replace(/½ PTS/g, '🎟️ SAFE');
    G.cal.forEach((_, i) => { const S = svCur(); if (!S || !S.sched) return; const t = svFinal(G, i) ? 'FINAL' : S.sched[i] ? `−${S.sched[i]}` : 'NO ELIM';
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
    if (!svOn() || !RACE || RACE.sprint || !svCur()) return r;
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
  const R = RACE, S = G.sv, fin = svFinal(G, G.round), k = R.sprint ? 0 : S.sched[G.round] || 0, run = R.order().filter(c => svAlive(S, c.d.id)), lead = run[0], lap = lead ? Math.min(R.laps, lead.laps + (lead.finished ? 0 : 1)) : 0;
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
  html = html.replace(/<tr class="([^"]*)" data-prof="([^"]+)"([\s\S]*?)<td class="ra plain">[^<]*<\/td><\/tr>/g, (m, cls, id, mid) => {
    let t = '';
    if (!o.sprint && s && s.surv) { if (s.surv.final) t = s.surv.champ === id ? '<b class="sv-champ">🏆 CHAMPION</b>' : G.sv && G.sv.final && G.sv.final.includes(id) ? 'Finalist' : '';
      else if (s.surv.elim.includes(id)) t = '<b class="bad">ELIMINATED</b>'; else if (G.sv && G.sv.pool.includes(id)) t = '<span class="good">Safe</span>'; }
    return `<tr class="${cls}" data-prof="${id}"${mid}<td class="ra plain">${t}</td></tr>`;
  });
  if (!o.sprint && s && s.surv && !s.surv.final) {
    const el = s.surv.elim.map(id => G.drivers[id]).filter(Boolean);
    html = html.replace('<table class="dkfp dkrr">', `<div class="heat-strip sv-strip"><span><b>🏁 Survival</b> · ${el.length ? `Eliminated: ${el.map(d => esc(d.name)).join(', ')}` : 'Non-elimination round — everyone races on'}</span><span>${G.sv ? G.sv.pool.filter(id => !G.sv.out[id] || G.sv.out[id].r > s.round - 1).length - el.length : ''} drivers remain</span></div><table class="dkfp dkrr">`);
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
