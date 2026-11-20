// ===================== Custom season: your own line-up and calendar =====================
// Any constructor (with the car of any season it raced) and any driver (with their form from any season they raced)
// from the database; drivers can join any team. The calendar can use any circuit and any of its layout versions.
// After each season the editor opens again so the line-up and calendar can be changed before the next one.
let CX_IDX = null;
function cxIndex() {
  if (CX_IDX) return CX_IDX;
  const team = {}, drv = {};
  Object.keys(HIST.years).map(Number).sort((a, b) => a - b).forEach(y => {
    const H = HIST.years[y];
    H.teams.forEach(r => { (team[r[0]] = team[r[0]] || []).push(y); });
    H.drivers.forEach(r => { (drv[r[0]] = drv[r[0]] || []).push({ y, num: r[2], st: r.slice(3, 8), team: r[1] }); });
    H.free.forEach(r => { const L = drv[r[0]] = drv[r[0]] || []; if (!L.some(x => x.y === y)) L.push({ y, num: 0, st: r.slice(1, 6) }); });
  });
  Object.values(drv).forEach(L => L.sort((a, b) => a.y - b.y));
  const teams = Object.keys(team).filter(c => HIST.teams[c]).sort((a, b) => HIST.teams[a][0].localeCompare(HIST.teams[b][0]));
  const drivers = Object.keys(drv).map(Number).filter(i => HIST.drivers[i]).sort((a, b) => HIST.drivers[a][1].localeCompare(HIST.drivers[b][1]));
  return CX_IDX = { team, drv, teams, drivers };
}
const cxPeak = di => { const L = cxIndex().drv[di] || []; return L.reduce((b, x) => !b || x.st[0] > b.st[0] ? x : b, null); };
const cxForm = (di, y) => { const L = cxIndex().drv[di] || []; return L.find(x => x.y === y) || L[L.length - 1]; };
const cxTeamRow = (cid, y) => (HIST.years[y] && HIST.years[y].teams.find(r => r[0] === cid)) || null;
// a real season as a starting point
function cxFromYear(y) {
  const H = HIST.years[y];
  return {
    teams: H.teams.map(r => ({ cid: r[0], y, drv: H.drivers.filter(d => d[1] === r[0]).map(d => ({ di: d[0], y })) })).filter(t => t.drv.length),
    cal: H.cal.map(c => ({ id: c[0], ver: 'auto', sprint: !!c[5], laps: null }))
  };
}
function cxNewSpec() { const s = cxFromYear(HIST_LAST); return { year: HIST_LAST, rulesY: HIST_LAST, teams: s.teams, cal: s.cal }; }

// ---------- building the season from the spec ----------
function cxLoad(G0, y) {
  const S = G0.customSpec;
  const keepMoney = G0.player && G0.teams[G0.player] ? G0.teams[G0.player].money : G0.bank;
  Object.values(G0.drivers || {}).forEach(d => { G0.careers[d.id] = { titles: d.titles || 0, wins: d.careerWins || 0 }; });
  G0.year = y; G0.round = 0; G0.results = []; G0.rules = rulesFor(clamp(S.rulesY || y, HIST_FIRST, HIST_LAST));
  G0.teams = {}; G0.engines = {}; G0.drivers = {};
  const used = new Set();
  S.teams.forEach(T => {
    const row = cxTeamRow(T.cid, T.y); if (!row) return;
    const [cid, full, eng, works, car, rel] = row, isMe = cid === G0.player, b = isMe ? G0.bonus : { aero: 0, chassis: 0, power: 0, rel: 0 };
    const [name, color] = HIST.teams[cid];
    G0.teams[cid] = { id: cid, name, full, color, engine: 'e:' + cid, works: !!works, aero: car + b.aero, chassis: car + b.chassis, rel: rel + b.rel, cars: Math.max(1, T.drv.length),
      money: isMe ? (keepMoney || 100) : 100, sponsor: +(3 + Math.max(0, car - 70) / 4).toFixed(1), dev: 1, pts: 0, spent: 0, srcY: T.y };
    G0.engines['e:' + cid] = { name: eng, power: car + b.power, rel: rel + b.rel };
    T.drv.forEach(DV => {
      const D = HIST.drivers[DV.di]; if (!D) return; const f = cxForm(DV.di, DV.y); if (!f) return;
      const c = G0.careers[D[0]] || { titles: 0, wins: 0 };
      let num = f.num || ((cxIndex().drv[DV.di] || []).slice().reverse().find(x => x.num) || {}).num || 0;
      while (!num || used.has(num)) num = num ? num + 1 : 2; used.add(num);
      const d = { id: D[0], name: D[1], code: D[2], num, nat: D[3], age: y - D[4], pace: f.st[0], craft: f.st[1], cons: f.st[2], wet: f.st[3], tyre: f.st[4],
        salary: 0, until: y, pot: 0, team: cid, pts: 0, res: [], wins: 0, pods: 0, poles: 0, careerWins: c.wins, titles: c.titles, next: null, formY: f.y };
      d.salary = askingSalary(d); G0.drivers[d.id] = d;
    });
  });
  G0.cal = S.cal.map(r => r.id);
  G0.calInfo = S.cal.map(r => { const t = TRACK_BY_ID[r.id]; return { gp: t.short, km: t.km, laps: r.laps || t.laps, base: null, sprint: !!r.sprint, date: null, win: -1, ver: r.ver || 'auto' }; });
  G0.realChamp = -1; G0.realCChamp = null; G0.hxY = y; // no real-history stand-ins for a custom line-up
  G0.needTeam = !!(G0.player && !G0.teams[G0.player]);
  if (G0.player && !G0.needTeam) G0.bonus = { aero: G0.bonus.aero * 0.7, chassis: G0.bonus.chassis * 0.7, power: G0.bonus.power * 0.7, rel: G0.bonus.rel * 0.7 };
  if (typeof dkApplyRegs === 'function') dkApplyRegs(G0);
}
const _cx_loadSeason = loadSeason;
loadSeason = function (G0, y) { if (G0 && G0.custom) return cxLoad(G0, y); return _cx_loadSeason.apply(this, arguments); };
// each round can use a specific layout version
const _cx_roundTrack = roundTrack;
roundTrack = function (G0, i) {
  const r = _cx_roundTrack.apply(this, arguments), ci = G0 && G0.custom && G0.calInfo && G0.calInfo[i];
  if (!ci || !ci.ver || ci.ver === 'auto') return r;
  const t = TRACK_BY_ID[G0.cal[i]];
  if (ci.ver === 'default') return Object.assign({}, r, { pts: t.pts, marks: t.marks || null, geoKey: t.id });
  const v = layoutVersions(t.id).find(x => x.from + '-' + x.to === ci.ver);
  return v ? Object.assign({}, r, { pts: v.pts, marks: v.marks || null, geoKey: t.id + '@' + ci.ver }) : r;
};
// car names come from each team's own car season
const _cx_hxCar = hxCar;
hxCar = function (G0, tid) {
  if (G0 && G0.custom && G0.teams[tid] && G0.teams[tid].srcY) { const H = HIST.years[G0.teams[tid].srcY]; return H && H.car ? H.car[tid] || null : null; }
  return _cx_hxCar.apply(this, arguments);
};
// season end: record the champions, then hand back to the editor for the next season
const _cx_endSeasonTimeline = endSeasonTimeline;
endSeasonTimeline = function (G0) {
  if (!G0.custom) return _cx_endSeasonTimeline.apply(this, arguments);
  recomputePoints(G0);
  const ts = standingsTeams(G0), ds = standingsDrivers(G0), champ = ds[0], cchamp = ts[0];
  if (champ) champ.titles = (champ.titles || 0) + 1;
  const prizes = {}; ts.forEach((t, i) => { const p = Math.max(20, 140 - i * 9); t.money += p; prizes[t.id] = p; });
  G0.history.push({ year: G0.year, champ: champ && { id: champ.id, name: champ.name, team: champ.team, pts: champ.pts }, cchamp: cchamp && { id: cchamp.id, name: cchamp.name, pts: cchamp.pts },
    playerPos: G0.player ? ts.findIndex(t => t.id === G0.player) + 1 : 0, playerPts: G0.player ? G0.teams[G0.player].pts : 0, teamName: G0.player ? G0.teams[G0.player].name : null, custom: true });
  Object.values(G0.drivers).forEach(d => { G0.careers[d.id] = { titles: d.titles || 0, wins: d.careerWins || 0 }; });
  if (G0.player) G0.bank = G0.teams[G0.player].money;
  const summary = { year: G0.year, champ: champ ? { name: champ.name, team: champ.team, teamName: G0.teams[champ.team] ? G0.teams[champ.team].name : '' } : { name: '—' }, cchamp: cchamp ? { id: cchamp.id, name: cchamp.name } : { name: '—' },
    prizes, playerPos: G0.player ? ts.findIndex(t => t.id === G0.player) + 1 : 0, retired: [], moves: [], rookies: [], timeline: true, myPrize: G0.player ? prizes[G0.player] : 0 };
  // the editor opens for next season, starting from this season's line-up and calendar
  G0.customSpec.year = G0.year + 1; G0.year = G0.year + 1; G0.customEdit = true; G0.round = 0; G0.results = [];
  return summary;
};
// ---------- the editor ----------
let CXE = { q: '', dteam: null, ddrv: null, cteam: null };
function cxSpec() { return G.customSpec; }
function cxEditor() {
  const S = cxSpec(), I = cxIndex(), years = HIST_YEARS;
  const usedT = new Set(S.teams.map(t => t.cid)), usedD = new Set(S.teams.flatMap(t => t.drv.map(d => d.di)));
  const opt = (v, l, sel) => `<option value="${esc(String(v))}" ${sel ? 'selected' : ''}>${esc(l)}</option>`;
  const nDrivers = usedD.size, first = !(G.history && G.history.length);
  const pickTeam = G.spectator ? '' : `<label class="small">Your team <select data-cx="player">${S.teams.map(t => opt(t.cid, HIST.teams[t.cid][0], G.player === t.cid)).join('')}</select></label>`;
  const pickFav = G.spectator ? `<label class="small">Favourite driver <select data-cx="follow">${opt('', '— none —', !G.follow)}${S.teams.flatMap(t => t.drv).map(d => opt(HIST.drivers[d.di][0], HIST.drivers[d.di][1], G.follow === HIST.drivers[d.di][0])).join('')}</select></label>` : '';
  const teamCard = (T, i) => {
    const [nm, col] = HIST.teams[T.cid], row = cxTeamRow(T.cid, T.y);
    return `<div class="cx-team" style="--tc:${col}"><div class="cx-th"><b>${esc(nm)}</b>
      <label class="small">Car <select data-cx="ty" data-i="${i}">${(I.team[T.cid] || []).map(y => opt(y, y + (cxTeamRow(T.cid, y) ? ' · ' + cxTeamRow(T.cid, y)[2] : ''), y === T.y)).join('')}</select></label>
      <span class="small mut">car ${row ? row[4] : '?'} · rel ${row ? row[5] : '?'}</span><span class="sp"></span><button class="sm" data-a="cxdelteam" data-i="${i}" aria-label="Remove team">✕</button></div>
      ${T.drv.map((D, k) => { const H = HIST.drivers[D.di], f = cxForm(D.di, D.y); return `<div class="cx-drv">${flag(H[3])} <b>${esc(H[1])}</b>
        <label class="small">Form <select data-cx="dy" data-i="${i}" data-k="${k}">${(I.drv[D.di] || []).map(x => opt(x.y, `${x.y} · pace ${x.st[0]}`, x.y === D.y)).join('')}</select></label>
        <span class="small mut">pace ${f ? f.st[0] : '?'} · racecraft ${f ? f.st[1] : '?'}</span><span class="sp"></span><button class="sm" data-a="cxdeldrv" data-i="${i}" data-k="${k}" aria-label="Remove driver">✕</button></div>`; }).join('') || '<div class="small warn">No drivers yet — add at least one.</div>'}</div>`;
  };
  const verOpts = id => [['auto', `By season year (${S.year})`], ['default', 'Default layout']].concat(layoutVersions(id).map(v => [v.from + '-' + v.to, `${v.from}–${v.to} layout`]));
  const tracks = TRACKS.slice().sort((a, b) => a.name.localeCompare(b.name));
  const roundRow = (R, i) => `<div class="cx-rd"><b class="cx-n">${i + 1}</b><select data-cx="rt" data-i="${i}">${tracks.map(t => opt(t.id, `${t.short} — ${t.name}`, t.id === R.id)).join('')}</select>
    <select data-cx="rv" data-i="${i}">${verOpts(R.id).map(([v, l]) => opt(v, l, (R.ver || 'auto') === v)).join('')}</select>
    <label class="small">Laps <input type="number" min="5" max="120" data-cx="rl" data-i="${i}" value="${R.laps || TRACK_BY_ID[R.id].laps}" style="width:4.2em"></label>
    <label class="small"><input type="checkbox" data-cx="rs" data-i="${i}" ${R.sprint ? 'checked' : ''}> Sprint</label>
    <span class="sp"></span><button class="sm" data-a="cxmv" data-i="${i}" data-v="-1" aria-label="Move up">↑</button><button class="sm" data-a="cxmv" data-i="${i}" data-v="1" aria-label="Move down">↓</button><button class="sm" data-a="cxdelrd" data-i="${i}" aria-label="Remove round">✕</button></div>`;
  const errs = [];
  if (S.teams.length < 2) errs.push('Add at least 2 constructors.');
  if (S.teams.some(t => !t.drv.length)) errs.push('Every constructor needs at least one driver.');
  if (nDrivers < 2) errs.push('Add at least 2 drivers.');
  if (S.cal.length < 3) errs.push('Add at least 3 rounds.');
  return `<div class="wrap cx"><div class="card"><h2>🧩 Custom season ${S.year}${first ? '' : ' — make your changes for the new season'}</h2>
    <div class="small mut">Pick any constructor with the car of any season it raced, and any driver with their form from any season — drivers can join any team. Build the calendar from any circuit and layout. After each season you can change everything again.</div>
    <div class="row cx-top"><label class="small">Season <input type="number" min="1950" max="2100" data-cx="year" value="${S.year}" style="width:5.5em"></label>
    <label class="small">Rules of <select data-cx="rulesY">${years.map(y => opt(y, y, y === (S.rulesY || S.year))).join('')}</select></label>${pickTeam}${pickFav}</div>
    <div class="row cx-top"><span class="small mut">Start from a real season:</span><select data-cx="copyY">${years.slice().reverse().map(y => opt(y, y, y === CXE.copyY)).join('')}</select><button class="sm" data-a="cxcopy" data-v="all">Line-up and calendar</button><button class="sm" data-a="cxcopy" data-v="teams">Line-up only</button><button class="sm" data-a="cxcopy" data-v="cal">Calendar only</button></div></div>
  <div class="cx-cols"><div class="card"><h3>Line-up · ${S.teams.length} constructors · ${nDrivers} drivers</h3>
    <div class="cx-add"><select data-cx="addT"><option value="">Add a constructor…</option>${I.teams.filter(c => !usedT.has(c)).map(c => opt(c, `${HIST.teams[c][0]} (${I.team[c][0]}–${I.team[c][I.team[c].length - 1]})`, false)).join('')}</select></div>
    <div class="cx-add"><input type="search" placeholder="Search drivers" data-cx="q" value="${esc(CXE.q)}" style="flex:1"><select data-cx="addD"><option value="">Add a driver…</option>${I.drivers.filter(di => !usedD.has(di) && (!CXE.q || HIST.drivers[di][1].toLowerCase().includes(CXE.q.toLowerCase()))).slice(0, 400).map(di => { const p = cxPeak(di); return opt(di, `${HIST.drivers[di][1]} (${(I.drv[di][0] || {}).y}–${(I.drv[di][I.drv[di].length - 1] || {}).y}, peak ${p ? p.st[0] : '?'} in ${p ? p.y : '?'})`, false); }).join('')}</select>
      <select data-cx="addDT">${S.teams.map((t, i) => opt(i, '→ ' + HIST.teams[t.cid][0], CXE.dteam === i)).join('')}</select></div>
    ${S.teams.map(teamCard).join('')}</div>
  <div class="card"><h3>Calendar · ${S.cal.length} rounds · ${S.cal.filter(r => r.sprint).length} sprints</h3>
    <div class="row cx-add"><button class="sm" data-a="cxaddrd">+ Add round</button><button class="sm" data-a="cxcopy26">2026 calendar</button><button class="sm" data-a="cxclrcal">Clear</button></div>
    ${S.cal.map(roundRow).join('')}</div></div>
  <div class="card"><h3>Regulations — alternative history</h3><div class="small mut" style="margin-bottom:8px">These apply on top of the rules of ${S.rulesY || S.year}. Leave everything on “real” to use those rules unchanged.</div>${typeof dkRegsForm === 'function' ? dkRegsForm(G.regs || Object.assign({}, DK_REG0), 'dkreg2') : ''}</div>
  <div class="card cx-go">${errs.length ? `<div class="warn small">${errs.join(' ')}</div>` : `<div class="small mut">${S.teams.length} constructors, ${nDrivers} drivers, ${S.cal.length} rounds.</div>`}<span class="sp"></span><button class="pri" data-a="cxstart" ${errs.length ? 'disabled' : ''}>Start the ${S.year} season →</button></div></div>`;
}
// form controls
document.addEventListener('change', ev => { const el = ev.target; if (el.dataset && el.dataset.cx) cxChange(el, ev.type); }, true);
document.addEventListener('input', ev => { const el = ev.target; if (el.dataset && el.dataset.cx === 'q') { CXE.q = el.value; clearTimeout(cxChange.t); cxChange.t = setTimeout(() => { render(); const q = document.querySelector('[data-cx=q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250); } }, true);
function cxChange(el) {
  if (!G || !G.customSpec) return; const S = G.customSpec, k = el.dataset.cx, i = +el.dataset.i, v = el.value;
  if (k === 'year') S.year = G.year = clamp(parseInt(v) || S.year, 1950, 2100);
  else if (k === 'rulesY') { S.rulesY = +v; G.rules = rulesFor(S.rulesY); if (typeof dkApplyRegs === 'function') dkApplyRegs(G); }
  else if (k === 'player') G.player = v;
  else if (k === 'follow') G.follow = v || null;
  else if (k === 'copyY') { CXE.copyY = +v; return; }
  else if (k === 'ty') S.teams[i].y = +v;
  else if (k === 'dy') S.teams[i].drv[+el.dataset.k].y = +v;
  else if (k === 'addT') { if (!v) return; const ys = cxIndex().team[v]; S.teams.push({ cid: v, y: ys[ys.length - 1], drv: [] }); CXE.dteam = S.teams.length - 1; }
  else if (k === 'addDT') { CXE.dteam = +v; return; }
  else if (k === 'addD') { if (!v) return; const ti = CXE.dteam != null && S.teams[CXE.dteam] ? CXE.dteam : 0, T = S.teams[ti]; if (!T) return toast('Add a constructor first');
    if (T.drv.length >= 3) return toast(`${HIST.teams[T.cid][0]} already has 3 drivers`); const p = cxPeak(+v); T.drv.push({ di: +v, y: p ? p.y : HIST_LAST }); }
  else if (k === 'rt') { S.cal[i].id = v; S.cal[i].ver = 'auto'; S.cal[i].laps = null; }
  else if (k === 'rv') S.cal[i].ver = v;
  else if (k === 'rl') S.cal[i].laps = clamp(parseInt(v) || TRACK_BY_ID[S.cal[i].id].laps, 5, 120);
  else if (k === 'rs') S.cal[i].sprint = el.checked;
  else return;
  render();
}
Object.assign(A, {
  cxdelteam(el) { const S = cxSpec(); S.teams.splice(+el.dataset.i, 1); if (G.player && !S.teams.some(t => t.cid === G.player)) G.player = S.teams[0] ? S.teams[0].cid : null; render(); },
  cxdeldrv(el) { cxSpec().teams[+el.dataset.i].drv.splice(+el.dataset.k, 1); render(); },
  cxaddrd() { const S = cxSpec(); if (S.cal.length >= 30) return toast('Max 30 rounds'); const last = S.cal[S.cal.length - 1]; S.cal.push({ id: last ? last.id : CAL_2026[0], ver: 'auto', sprint: false, laps: null }); render(); },
  cxdelrd(el) { cxSpec().cal.splice(+el.dataset.i, 1); render(); },
  cxmv(el) { const C = cxSpec().cal, i = +el.dataset.i, j = i + +el.dataset.v; if (j < 0 || j >= C.length) return; [C[i], C[j]] = [C[j], C[i]]; render(); },
  cxclrcal() { cxSpec().cal = []; render(); },
  cxcopy26() { cxSpec().cal = CAL_2026.map(id => ({ id, ver: 'auto', sprint: SPRINT_2026.includes(id), laps: null })); render(); },
  cxcopy(el) { const y = CXE.copyY || HIST_LAST, src = cxFromYear(y), S = cxSpec(), w = el.dataset.v;
    if (w !== 'cal') { S.teams = src.teams; if (!G.spectator && !S.teams.some(t => t.cid === G.player)) G.player = S.teams[0].cid; }
    if (w !== 'teams') S.cal = src.cal;
    if (w === 'all') S.rulesY = y; render(); },
  cxstart() {
    const S = cxSpec(); if (!G.spectator && !S.teams.some(t => t.cid === G.player)) G.player = S.teams[0].cid;
    if (G.spectator && G.follow && !S.teams.some(t => t.drv.some(d => HIST.drivers[d.di][0] === G.follow))) G.follow = null;
    const firstStart = VIEW === 'cxsetup';
    loadSeason(G, S.year); G.customEdit = false; DOCV.set = null;
    if (firstStart) news(G, G.spectator ? `Welcome to your custom ${G.year} season — enjoy the show.` : `Welcome to ${G.teams[G.player].full}, ${G.year}. Your custom season starts now.`);
    news(G, `📅 Custom ${G.year} season: ${G.cal.length} races, ${Object.keys(G.teams).length} constructors, ${Object.keys(G.drivers).length} drivers.`);
    autosave(); VIEW = 'hq'; TAB = 'home'; render(); window.scrollTo(0, 0);
  }
});
const _cx_viewHQ = viewHQ;
viewHQ = function () { if (G && G.custom && G.customEdit) return cxEditor(); return _cx_viewHQ.apply(this, arguments); };
const _cx_startWeekend = startWeekend;
startWeekend = function () { if (G && G.custom && G.customEdit) { VIEW = 'hq'; return render(); } return _cx_startWeekend.apply(this, arguments); };

// ---------- new game: the third era ----------
const _cx_viewSetup = viewSetup;
viewSetup = function () {
  if (SETUP.era !== 'custom') {
    // other eras: just add the third era button
    return _cx_viewSetup.apply(this, arguments).replace(/(🕰️ Historic timeline<\/button>)/, `$1<button data-a="setera" data-v="custom">🧩 Custom season</button>`);
  }
  // custom season: only what applies here — everything else is chosen in the line-up and calendar editor next
  const S = SETUP, spect = S.mode === 'spectator';
  const modeRow = `<div class="row" style="margin:10px 0">${[['manager', '🏎️ Manager'], ['spectator', '👀 Spectator']].map(([k, v]) => `<button data-a="setmode" data-v="${k}" class="${S.mode === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
  const eraRow = `<div class="card" style="margin-bottom:12px"><h3>Era</h3><div class="row">${[['modern', '🏁 2026 season'], ['hist', '🕰️ Historic timeline'], ['custom', '🧩 Custom season']].map(([k, v]) => `<button data-a="setera" data-v="${k}" class="${S.era === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <div class="small mut" style="margin-top:8px">Build your own season: any constructors with the car of any season, any drivers in any team, any circuits and layouts, and your own rules. ${spect ? 'Pick your favourite driver' : 'Pick the team you will run'} on the next screen.</div></div>`;
  const diff = spect ? '' : `<div class="card"><h3>Difficulty</h3><div class="row">${['easy', 'normal', 'hard'].map(d => `<button data-a="diff" data-v="${d}" class="${S.difficulty === d ? 'on' : ''}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div><div class="small mut" style="margin-top:6px">Controls how fast rival teams develop their cars.</div></div>`;
  return `<div class="wrap"><div class="row"><span class="logo">PIT<b>WALL</b></span><span class="sp"></span><button data-a="totitle">Back</button></div>
  ${modeRow}${eraRow}${diff}
  <div class="row" style="margin:16px 0 40px"><span class="sp"></span><button class="pri" data-a="startgame">Next: line-up and calendar →</button></div></div>`;
};
const _cx_startgame = A.startgame;
A.startgame = function () {
  if (SETUP.era !== 'custom') return _cx_startgame.apply(this, arguments);
  const spec = cxNewSpec(), spect = SETUP.mode === 'spectator';
  G = { v: 3, timeline: true, custom: true, customEdit: true, customSpec: spec, startYear: spec.year, year: spec.year, round: 0, player: spect ? null : spec.teams[0].cid, spectator: spect, follow: null,
    difficulty: SETUP.difficulty || 'normal', weatherOn: true, incidentsOn: true, autoPause: true, teams: {}, drivers: {}, engines: {}, cal: [], results: [], projects: [], news: [], history: [],
    careers: {}, bonus: { aero: 0, chassis: 0, power: 0, rel: 0 }, sprints: [], bank: 100, rules: rulesFor(spec.rulesY) };
  // alternative regulations for custom seasons are set in the editor (next screen)
  VIEW = 'cxsetup'; render(); window.scrollTo(0, 0); // still part of setting up: nothing is saved until the season starts
};
A.cxback = function () { G = null; VIEW = 'setup'; render(); window.scrollTo(0, 0); };
const _cx_render = render;
render = function () {
  if (VIEW === 'cxsetup' && G && G.custom) {
    cancelAnimationFrame(raf);
    const mode = G.spectator ? '👀 Spectator' : '🏎️ Manager';
    $app().innerHTML = `<div class="cx-setbar"><button data-a="cxback">← Back</button><span class="cx-setstep">New game · ${mode} · 🧩 Custom season · step 2 of 2: line-up and calendar</span></div>${cxEditor()}`;
    const t = document.getElementById('doc-tab'); if (t) t.remove();
    return;
  }
  return _cx_render.apply(this, arguments);
};
