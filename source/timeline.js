// ===== HISTORIC TIMELINE (data distilled from F1DB) =====
const HIST_YEARS = Object.keys(HIST.years).map(Number).sort((a, b) => a - b);
const HIST_FIRST = HIST_YEARS[0], HIST_LAST = HIST_YEARS[HIST_YEARS.length - 1];
// add circuits that exist only in the historic data
Object.entries(HIST.tracks).forEach(([id, h]) => {
  if (TRACK_BY_ID[id]) return;
  const ty = h.type === 'STREET' ? { v: 175, ot: .2, df: .8, pw: .35, wear: .4 } : h.type === 'ROAD' ? { v: 225, ot: .5, df: .45, pw: .7, wear: .45 } : { v: 205, ot: .45, df: .6, pw: .5, wear: .5 };
  const t = T(id, h.name, h.short, h.cc, h.km, ty.v, ty.ot, ty.df, ty.pw, ty.wear, .25, h.era, null);
  t.base = +(t.km * 3600 / t.v).toFixed(3); t.laps = Math.max(10, Math.round(305 / t.km)); t.pit = 21;
  TRACKS.push(t); TRACK_BY_ID[id] = t;
});
function rulesFor(y) {
  const pts = y < 1960 ? [8, 6, 4, 3, 2] : y === 1960 ? [8, 6, 4, 3, 2, 1] : y < 1991 ? [9, 6, 4, 3, 2, 1] : y < 2003 ? [10, 6, 4, 3, 2, 1] : y < 2010 ? [10, 8, 6, 5, 4, 3, 2, 1] : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const H = HIST.years[y];
  return {
    year: y, points: pts, bestN: H ? H.best : 0,
    fl: y < 1960 ? 'any' : (y >= 2019 && y <= 2024 ? 'top10' : null),
    sprintPts: y === 2021 ? [3, 2, 1] : [8, 7, 6, 5, 4, 3, 2, 1],
    twoCompound: y >= 2007, sc: y >= 1993, vsc: y >= 2015, quali: y >= 2006 ? 'knockout' : 'single',
    capOn: y >= 2021, constructors: y >= 1958, wearMul: y < 1970 ? 0.45 : y < 1994 ? 0.7 : 1
  };
}
function eraSpeed(y) { return y < 1960 ? .62 : y < 1970 ? .7 : y < 1980 ? .8 : y < 1990 ? .86 : y < 2000 ? .9 : y < 2010 ? .96 : 1; }
function capFor(G) { return (G && G.rules && !G.rules.capOn) ? Infinity : COST_CAP; }
function isSprintRound(G, i) { return G.calInfo ? !!(G.calInfo[i] && G.calInfo[i].sprint) : (G.sprints || []).includes(G.cal[i]); }
function roundTrack(G, i) {
  const base = layoutForYear(TRACK_BY_ID[G.cal[i]], G.year);
  const ci = G.calInfo && G.calInfo[i];
  if (!ci) return base;
  const laps = (LIB.laps && LIB.laps[base.id]) || ci.laps || base.laps;
  const km = ci.km || base.km;
  const lapBase = ci.base || +(km * 3600 / (base.v * eraSpeed(G.year))).toFixed(3);
  return Object.assign({}, base, { short: ci.gp, km, laps, base: lapBase, realWin: ci.win, date: ci.date });
}
function histDriverName(i) { return i >= 0 ? HIST.drivers[i][1] : null; }

function newTimelineGame(opts) {
  const G = { v: 3, timeline: true, startYear: opts.year, year: opts.year, round: 0, player: opts.spectator ? null : opts.team, spectator: !!opts.spectator, follow: opts.follow || null,
    difficulty: opts.difficulty || 'normal', weatherOn: true, incidentsOn: true, autoPause: true, teams: {}, drivers: {}, engines: {}, cal: [], results: [], projects: [], news: [], history: [],
    careers: {}, bonus: { aero: 0, chassis: 0, power: 0, rel: 0 }, sprints: [], bank: 100 };
  loadSeason(G, opts.year);
  news(G, G.spectator ? `Welcome to ${G.year}! Watch history unfold — or rewrite it.` : `Welcome to ${G.teams[G.player].full}, ${G.year}. Make history.`);
  return G;
}
function loadSeason(G, y) {
  const H = HIST.years[y];
  const keepMoney = G.player && G.teams[G.player] ? G.teams[G.player].money : G.bank;
  const prevTeam = G.player;
  // save career stats
  Object.values(G.drivers).forEach(d => { G.careers[d.id] = { titles: d.titles || 0, wins: d.careerWins || 0 }; });
  G.year = y; G.round = 0; G.results = []; G.rules = rulesFor(y); G.projects = G.projects || [];
  G.teams = {}; G.engines = {}; G.drivers = {};
  H.teams.forEach(([cid, full, eng, works, car, rel, cars]) => {
    const isMe = cid === G.player;
    const b = isMe ? G.bonus : { aero: 0, chassis: 0, power: 0, rel: 0 };
    const [name, color] = HIST.teams[cid];
    G.teams[cid] = { id: cid, name, full, color, engine: 'e:' + cid, works: !!works, aero: car + b.aero, chassis: car + b.chassis, rel: rel + b.rel, cars,
      money: isMe ? keepMoney : 100, sponsor: +(3 + Math.max(0, car - 70) / 4).toFixed(1), dev: 1, pts: 0, spent: 0 };
    G.engines['e:' + cid] = { name: eng, power: car + b.power, rel: rel + b.rel };
  });
  const mk = (row, team) => {
    const [di] = row; const D = HIST.drivers[di]; const r = team ? row.slice(3) : row.slice(1);
    const c = G.careers[D[0]] || { titles: 0, wins: 0 };
    return { id: D[0], name: D[1], code: D[2], num: team ? row[2] : 0, nat: D[3], age: y - D[4], pace: r[0], craft: r[1], cons: r[2], wet: r[3], tyre: r[4],
      salary: 0, until: y, pot: 0, team: team ? row[1] : null, pts: 0, res: [], wins: 0, pods: 0, poles: 0, careerWins: c.wins, titles: c.titles, next: null };
  };
  H.drivers.forEach(row => { const d = mk(row, true); d.salary = askingSalary(d); G.drivers[d.id] = d; });
  H.free.forEach(row => { const d = mk(row, false); if (!G.drivers[d.id]) G.drivers[d.id] = d; });
  G.cal = H.cal.map(c => c[0]);
  G.calInfo = H.cal.map(c => ({ gp: c[1], km: c[2], laps: c[3], base: c[4], sprint: c[5], date: c[6], win: c[7] }));
  G.realChamp = H.champ; G.realCChamp = H.cchamp;
  G.needTeam = !!(G.player && !G.teams[G.player]);
  if (G.needTeam) { G.bank = keepMoney; G.bonus = { aero: 0, chassis: 0, power: 0, rel: 0 }; G.projects = []; }
  else if (G.player) G.bonus = { aero: G.bonus.aero * 0.7, chassis: G.bonus.chassis * 0.7, power: G.bonus.power * 0.7, rel: G.bonus.rel * 0.7 };
  if (prevTeam && !G.needTeam && G.player) {} // continuing
}
function pickTimelineTeam(G, cid) {
  G.player = cid; G.needTeam = false; G.teams[cid].money = G.bank || 100; G.projects = [];
  news(G, `🤝 You take charge of ${G.teams[cid].full} for ${G.year}.`);
}
// best-N scoring
function recomputePoints(G) {
  const n = G.rules && G.rules.bestN;
  Object.values(G.drivers).forEach(d => {
    const r = (d.res || []).slice();
    if (n && r.length > n) { r.sort((a, b) => b - a); d.pts = r.slice(0, n).reduce((s, x) => s + x, 0); d.dropped = (d.res || []).reduce((s, x) => s + x, 0) - d.pts; }
    else { d.pts = r.reduce((s, x) => s + x, 0); d.dropped = 0; }
  });
}
function endSeasonTimeline(G) {
  const next = G.year + 1;
  const realChamp = histDriverName(G.realChamp), realC = G.realCChamp;
  if (!HIST.years[next]) {
    // history runs out: hand over to the free-running career
    Object.values(G.drivers).forEach(d => { if (d.team) { d.until = G.year + rint(0, 2); d.salary = askingSalary(d); d.pot = d.age < 23 ? rint(2, 4) : 0; } });
    const realCh = realChamp;
    G.timeline = false; G.calInfo = null; G.rules = null; G.sprints = SPRINT_2026.filter(id => G.cal.includes(id));
    // remove duplicate circuits from calendar (free mode needs unique ids)
    G.cal = [...new Set(G.cal)];
    const s = endSeason(G);
    s.realChamp = realCh; s.realCChamp = realC; s.handover = true;
    return s;
  }
  // in timeline: record champion, prize money, then load the real next season
  recomputePoints(G);
  const ts = standingsTeams(G), ds = standingsDrivers(G);
  const champ = ds[0], cchamp = ts[0];
  if (champ) champ.titles = (champ.titles || 0) + 1;
  const prizes = {}; ts.forEach((t, i) => { const p = Math.max(20, 140 - i * 9); t.money += p; prizes[t.id] = p; });
  G.history.push({ year: G.year, champ: champ && { id: champ.id, name: champ.name, team: champ.team, pts: champ.pts }, cchamp: { id: cchamp.id, name: cchamp.name, pts: cchamp.pts },
    playerPos: G.player ? ts.findIndex(t => t.id === G.player) + 1 : 0, playerPts: G.player ? G.teams[G.player].pts : 0, realChamp, realCChamp: realC,
    teamName: G.player ? G.teams[G.player].name : null });
  const summary = { year: G.year, champ: { name: champ.name, team: champ.team, teamName: G.teams[champ.team] ? G.teams[champ.team].name : '' }, cchamp: { id: cchamp.id, name: cchamp.name },
    prizes, playerPos: G.player ? ts.findIndex(t => t.id === G.player) + 1 : 0, retired: [], moves: [], rookies: [], realChamp, realCChamp: realC, timeline: true };
  const before = new Set(Object.values(G.drivers).filter(d => d.team).map(d => d.id));
  const myPrize = G.player ? prizes[G.player] : 0;
  if (G.player) G.bank = G.teams[G.player].money;
  loadSeason(G, next);
  const after = Object.values(G.drivers).filter(d => d.team);
  summary.rookies = after.filter(d => !before.has(d.id) && !(G.careers[d.id] && (G.careers[d.id].wins || G.careers[d.id].titles))).slice(0, 12).map(d => `${d.name} (${G.teams[d.team].name})`);
  summary.moves = [];
  summary.nextTeams = Object.values(G.teams).length;
  summary.lostTeam = G.needTeam;
  summary.myPrize = myPrize;
  news(G, `📅 ${G.year} season: ${G.cal.length} races, ${Object.keys(G.teams).length} teams.`);
  return summary;
}
