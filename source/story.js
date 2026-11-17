// ===================== Storylines: rivalries, driver market, press room, season narratives =====================
function stEnsure() {
  const S = G.story || (G.story = {});
  if (S.y !== G.year) Object.assign(S, { y: G.year, riv: {}, mkt: [], plan: null, press: {} });
  return S;
}
const stPair = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const stD = id => G.drivers[id];
const stNm = id => stD(id) ? stD(id).name : id;
const stSh = id => stD(id) ? dkShort(stD(id)) : id;
const stWins = id => typeof hxTotal === 'function' ? hxTotal('d', id, G).w : (stD(id) ? stD(id).careerWins || 0 : 0);
const stTeamNm = tid => G.teams[tid] ? G.teams[tid].name : (typeof HIST !== 'undefined' && HIST.teams && HIST.teams[tid] ? HIST.teams[tid][0] : tid);
function stRiv(S, a, b) { const k = stPair(a, b); return S.riv[k] || (S.riv[k] = { a: k.split('|')[0], b: k.split('|')[1], score: 0, battles: 0, close: 0, passes: 0, clashes: 0, last: 0 }); }

// live overtakes feed rivalries (only races you watch)
function storyPass(a, b) { try { const S = stEnsure(), r = stRiv(S, a.d.id, b.d.id); r.passes++; r.score += 0.5; r.last = G.results.length + 1; (r.pw || (r.pw = {}))[a.d.id] = ((r.pw || {})[a.d.id] || 0) + 1; } catch (e) { } }
if (typeof bcEvent === 'function') { const _st_bcEvent = bcEvent; bcEvent = function (R, ev) { if (ev.type === 'pass' && !R.sprint && ev.pos <= 12) storyPass(ev.a, ev.b); return _st_bcEvent.apply(this, arguments); }; }

// ---------- after every Grand Prix ----------
const _st_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _st_applyRaceResult.apply(this, arguments);
  try { if (G0 === G) stAfterRace(G0.results[G0.results.length - 1]); } catch (e) { console.warn('story', e); }
  return out;
};
function stAfterRace(s) {
  const S = stEnsure(), rows = s.rows, rd = G.results.length;
  // rivalries: close finishes between neighbours, and clashes
  const cls = rows.filter(r => !r.out && !r.heatOut).sort((a, b) => a.pos - b.pos);
  for (let i = 1; i < cls.length && i < 10; i++) {
    const A = cls[i - 1], B = cls[i], r = stRiv(S, A.id, B.id); r.battles++; r.score += i <= 3 ? 1.5 : 1; r.last = rd;
    if (A.time != null && B.time != null && A.laps === B.laps && B.time - A.time < 1.2) { r.close++; r.score += 1; }
    (r.ahead || (r.ahead = {}))[A.id] = (r.ahead[A.id] || 0) + 1;
  }
  const clash = rows.filter(r => r.out && /collision|contact|crash/i.test(r.out));
  for (let i = 0; i < clash.length; i++) for (let j = i + 1; j < clash.length; j++) if (Math.abs(clash[i].laps - clash[j].laps) <= 0) { const r = stRiv(S, clash[i].id, clash[j].id); r.clashes++; r.score += 3; r.last = rd; }
  s.press = stPress(s);
  stMarketTick(S, rd);
  const h = stHeadlines().find(x => x.hot); if (h) news(G, `📰 ${h.title}${h.text ? ' — ' + h.text : ''}`);
}

// ---------- press room ----------
function stPress(s) {
  const rows = s.rows, q = [], cls = rows.filter(r => !r.out), ds = standingsDrivers(G);
  const champPos = id => ds.findIndex(d => d.id === id) + 1, lead = ds[0], second = ds[1];
  const tm = r => stTeamNm(r.team);
  const add = (r, role, text) => q.push({ id: r.id, team: r.team, role, q: text });
  const w = cls[0], p2 = cls[1], p3 = cls[2];
  if (w) {
    const d = stD(w.id), mate = cls.find(r => r.team === w.team && r !== w);
    let t = pick([`What a day. The car was mega and the team gave me everything I needed.`, `We controlled it from the front. A big thank-you to everyone at ${tm(w)}.`, `I'm really proud of this one. We managed the tyres perfectly.`]);
    if (d && stWins(w.id) === 1) t = pick([`My first win in Formula 1… I don't have the words. I've dreamed about this since I was a kid.`, `First Grand Prix win! I'll need a few days for this to sink in.`]);
    else if (w.grid >= 5) t = pick([`Starting P${w.grid}, I honestly didn't think this was possible today. The strategy was perfect.`, `From P${w.grid} to the top step — we stayed out of trouble and the pace came alive in the race.`]);
    else if (mate && mate.pos === 2) t = `A one-two for ${tm(w)}! That's the best result we could ask for. Great job by everyone.`;
    if (lead && lead.id === w.id && second) t += ` ${lead.pts - second.pts > 25 ? `The gap in the championship is nice, but we keep our feet on the ground.` : `It's tight at the top, so every point matters.`}`;
    else if (champPos(w.id) > 1 && lead) t += ` We're chasing ${stSh(lead.id)} in the standings and today we took a bite out of that gap.`;
    add(w, 'Winner', t);
  }
  if (p2) {
    const gap = w && p2.time != null && w.time != null && p2.laps === w.laps ? p2.time - w.time : null;
    add(p2, 'P2', gap != null && gap < 1.5 ? pick([`So close! One more lap and I think we'd have had him.`, `${gap.toFixed(1)} seconds… it hurts a little, but it was a great fight.`]) : pick([`Good points today. We didn't quite have the pace for the win, but it's a solid weekend.`, `P2 is a good result. We'll look at where we lost time to ${w ? stSh(w.id) : 'the leader'}.`]));
  }
  if (p3) add(p3, 'P3', p3.grid >= 8 ? `From P${p3.grid} to the podium — I'll take that every day.` : pick([`Nice to be back on the podium. The team deserves this.`, `A podium is always special. Tricky race with the tyres, but we managed it.`]));
  // biggest climber outside the podium
  const climb = cls.filter(r => r.pos > 3 && r.pos <= 10 && r.grid - r.pos >= 6).sort((a, b) => (b.grid - b.pos) - (a.grid - a.pos))[0];
  if (climb) add(climb, `Driver of the climb (P${climb.grid} → P${climb.pos})`, pick([`We came alive in the race. Overtaking all afternoon — that was fun!`, `Bad qualifying, great race. That's the spirit of this team.`]));
  // a championship contender who retired
  const dnf = rows.filter(r => r.out && !r.heatOut && champPos(r.id) && champPos(r.id) <= 5).sort((a, b) => champPos(a.id) - champPos(b.id))[0];
  if (dnf) add(dnf, `Retired · ${dnf.out}`, /collision|contact/i.test(dnf.out) ? pick([`I don't know what he was thinking. He just turned in on me.`, `Racing incident, maybe. But it cost us a lot of points.`]) : pick([`Very frustrating. We were on for a strong result and it's gone.`, `It hurts, especially in a championship this tight. We'll bounce back.`]));
  // team-mate tension: neighbours on track, with live passes between them or a close finish
  const S = stEnsure();
  for (let i = 1; i < cls.length && i < 10; i++) {
    const A = cls[i - 1], B = cls[i];
    if (A.team !== B.team) continue;
    const r = S.riv[stPair(A.id, B.id)];
    const fought = (r && r.pw && r.pw[A.id] && G.results.length === r.last) || (A.time != null && B.time != null && B.time - A.time < 1.0);
    if (fought) { add(B, `Team-mate tension with ${stSh(A.id)}`, pick([`I'd rather not comment. We'll talk about it inside the team.`, `We were told to hold position… I need to understand why.`, `He's fast, but he's not the only one in this team who wants to win.`])); break; }
  }
  return q;
}

// ---------- driver market ----------
function stMarketPlan(S) {
  const N = G.cal.length, plan = [], seed = seeded('mkt' + G.year + (G.seed || ''));
  const at = (lo, hi) => Math.max(1, Math.min(N, Math.round(lo + seed() * (hi - lo))));
  const ly = G.timeline && typeof HIST !== 'undefined' ? (typeof mixLineYear === 'function' && G.mix ? mixLineYear(G, G.year + 1) : G.year + 1) : null;
  const curLine = G.lineYear || G.year;
  if (ly && HIST.years[ly] && ly !== curLine) {
    const nx = new Map(HIST.years[ly].drivers.map(row => [HIST.drivers[row[0]][0], row[1]]));
    const act = Object.values(G.drivers).filter(d => d.team);
    // team renames: every continuing driver of a team goes to the same, new team id
    const ren = {}; act.forEach(d => { const nt = nx.get(d.id); if (nt && nt !== d.team) (ren[d.team] || (ren[d.team] = new Set())).add(nt); });
    const nextTeams = new Set(HIST.years[ly].teams.map(t => t[0]));
    const renamed = {}; Object.entries(ren).forEach(([t, s]) => { const mates = act.filter(d => d.team === t && nx.has(d.id)); if (s.size === 1 && mates.length >= 2 && mates.every(d => nx.get(d.id) === [...s][0]) && !G.teams[[...s][0]] && !nextTeams.has(t)) renamed[t] = [...s][0]; });
    Object.entries(renamed).forEach(([t, n]) => plan.push({ kind: 'rename', team: t, to: n, at: at(N * 0.55, N * 0.9) }));
    act.forEach(d => {
      const nt = nx.get(d.id);
      if (nt == null) plan.push({ kind: d.age >= 34 ? 'retire' : 'leave', id: d.id, team: d.team, at: at(N * 0.45, N), rum: 0 });
      else if (nt !== d.team && renamed[d.team] !== nt) plan.push({ kind: 'move', id: d.id, team: d.team, to: nt, at: at(N * 0.4, N * 0.95) });
    });
    HIST.years[ly].drivers.forEach(row => { const D = HIST.drivers[row[0]]; if (!act.some(d => d.id === D[0])) plan.push({ kind: 'rookie', id: D[0], name: D[1], to: row[1], at: at(N * 0.6, N) }); });
  } else if (!G.timeline) {
    const exp = Object.values(G.drivers).filter(d => d.team && d.team !== G.player && d.until <= G.year);
    const fate = {}; exp.forEach(d => { const o = overall(d); fate[d.id] = d.age >= 37 && Math.random() < 0.5 ? 'retire' : Math.random() < (o > 86 ? 0.8 : o > 83 ? 0.6 : 0.4) ? 'extend' : 'free'; });
    const taken = new Set();
    exp.filter(d => fate[d.id] === 'free').sort((a, b) => overall(b) - overall(a)).forEach(x => {
      const y = exp.filter(o => o.team !== x.team && o.team !== G.player && (fate[o.id] === 'free' || fate[o.id] === 'retire') && !taken.has(o.id) && overall(o) < overall(x) - 0.5 && appeal(G, o.team) >= appeal(G, x.team) - 0.15).sort((a, b) => appeal(G, b.team) - appeal(G, a.team))[0];
      if (y && Math.random() < 0.75) { taken.add(y.id); fate[x.id] = 'move'; plan.push({ kind: 'move', id: x.id, team: x.team, to: y.team, out: fate[y.id] === 'free' ? y.id : null, at: at(N * 0.4, N * 0.95) }); }
    });
    exp.forEach(d => { const f = fate[d.id]; if (f === 'extend') plan.push({ kind: 'extend', id: d.id, team: d.team, yrs: rint(1, 3), at: at(N * 0.25, N * 0.85), rum: 0 }); else if (f === 'retire') plan.push({ kind: 'retire', id: d.id, team: d.team, at: at(N * 0.5, N * 0.9), rum: 0 });
      else if (f === 'free' && !taken.has(d.id)) plan.push({ kind: 'leave', id: d.id, team: d.team, at: at(N * 0.6, N), rum: 0 }); });
    plan.filter(p => p.kind === 'move' && p.out).forEach(p => { if (!plan.some(x => x.id === p.out)) plan.push({ kind: 'leave', id: p.out, team: p.to, at: Math.min(N, p.at + 1), rum: 0 }); });
  }
  plan.forEach(p => { if (p.rum == null) p.rum = Math.max(1, p.at - rint(2, 4)); });
  return plan;
}
function stMarketTick(S, rd) {
  if (!S.plan) S.plan = stMarketPlan(S);
  const ny = G.year + 1, items = [];
  S.plan.forEach(p => {
    if (p.rum && !p.rdone && rd >= p.rum && rd < p.at) {
      p.rdone = true;
      if (p.kind === 'move') items.push({ k: 'rumour', s: `${stNm(p.id)} is in talks with ${stTeamNm(p.to)} about a seat for ${ny}.` });
      if (p.kind === 'rookie') items.push({ k: 'rumour', s: `${p.name} is tipped for a race seat at ${stTeamNm(p.to)}.` });
    }
    if (!p.done && rd >= p.at) {
      p.done = true;
      const d = stD(p.id);
      if (p.kind === 'move') { items.push({ k: 'done', s: `Confirmed: ${stNm(p.id)} will leave ${stTeamNm(p.team)} and join ${stTeamNm(p.to)} for ${ny}.` }); if (!G.timeline && d) d.next = { team: p.to, salary: askingSalary(d), until: G.year + rint(2, 3) }; }
      if (p.kind === 'extend') { items.push({ k: 'done', s: `${stNm(p.id)} signs a new deal with ${stTeamNm(p.team)} until ${G.year + p.yrs}.` }); if (d) d.until = G.year + p.yrs; }
      if (p.kind === 'leave') { items.push({ k: 'leave', s: `${stNm(p.id)} will not be at ${stTeamNm(p.team)} in ${ny}.` }); if (!G.timeline && d) d.mkOut = true; }
      if (p.kind === 'retire') { items.push({ k: 'leave', s: `${stNm(p.id)} announces he will retire from Formula 1 at the end of the season.` }); if (!G.timeline && d) d.mkRetire = true; }
      if (p.kind === 'rookie') items.push({ k: 'done', s: `${p.name} will race for ${stTeamNm(p.to)} in ${ny}.` });
      if (p.kind === 'rename') items.push({ k: 'done', s: `${stTeamNm(p.team)} will race as ${stTeamNm(p.to)} from ${ny}.` });
    }
  });
  items.forEach(it => { S.mkt.unshift(Object.assign(it, { r: rd })); news(G, (it.k === 'rumour' ? '🗣️ Rumour: ' : '✍️ ') + it.s); });
}
// season end (free-running seasons): carry out the announced departures and retirements
const _st_endSeason = endSeason;
endSeason = function (G0) {
  const marked = Object.values(G0.drivers).filter(d => d.mkOut || d.mkRetire).map(d => ({ d, out: d.mkOut, ret: d.mkRetire }));
  const s = _st_endSeason.apply(this, arguments);
  try {
    let changed = false;
    marked.forEach(({ d, out, ret }) => {
      delete d.mkOut; delete d.mkRetire;
      if (d.retired || G0.player && d.team === G0.player) return;
      if (ret) { if (d.team) changed = true; d.retired = true; d.team = null; s.retired && s.retired.push(d.name); }
      else if (out && d.team && !d.next) { s.moves && s.moves.push(`${d.name} leaves ${G0.teams[d.team] ? G0.teams[d.team].name : d.team}`); d.leftTeam = d.team; d.team = null; changed = true; }
    });
    // a team can end up with 3 drivers when an incoming signing meets a driver the AI kept: drop the extra one
    Object.values(G0.teams).forEach(t => { if (t.id === G0.player) return; const ds = teamDrivers(G0, t.id); while (ds.length > 2) { const x = ds.sort((a, b) => overall(a) - overall(b)).shift(); x.team = null; changed = true; s.moves && s.moves.push(`${x.name} leaves ${t.name}`); } });
    if (changed) { fillAISeats(G0, s); Object.values(G0.drivers).forEach(d => delete d.leftTeam); }
  } catch (e) { console.warn('story season end', e); }
  return s;
};

// ---------- season narratives ----------
function stHeadlines() {
  const out = [], done = G.results.length, N = G.cal.length, left = N - done, ds = standingsDrivers(G), ts = standingsTeams(G);
  const PT = (G.rules && G.rules.points) || POINTS, per = PT[0] + (G.rules && G.rules.fl ? 1 : 0);
  let spLeft = 0; for (let i = done; i < N; i++) if (isSprintRound(G, i)) spLeft++;
  const maxLeft = left * per + spLeft * 8;
  const nm = d => dkShort(d);
  if (!done) {
    const ch = G.history && G.history.length ? G.history[G.history.length - 1].champ : null;
    out.push({ ic: '🏁', title: `${G.year} season preview`, text: `${N} races ahead.${ch ? ` ${ch.name} starts as the reigning champion.` : ''} Everyone starts on zero.`, hot: false });
    return out;
  }
  const [a, b] = ds;
  if (a && b) {
    const gap = a.pts - b.pts;
    if (!left) out.push({ ic: '🏆', title: `${a.name} is the ${G.year} world champion!`, text: gap ? `Champion by ${gap} point${gap === 1 ? '' : 's'}.` : `Level on points with ${nm(b)} — the title goes to ${nm(a)} on countback.`, hot: true });
    else if (gap > maxLeft) out.push({ ic: '🏆', title: `${a.name} is the ${G.year} world champion!`, text: left ? `An unassailable ${gap}-point lead with ${left} race${left === 1 ? '' : 's'} still to go.` : `Champion by ${gap} points.`, hot: true });
    else if (left && gap > maxLeft - per) out.push({ ic: '🎯', title: `Match point for ${nm(a)}`, text: `${gap} points clear of ${nm(b)}. Leave ${roundTrack(G, done).short} more than ${maxLeft - per} points ahead and the title is his.`, hot: true });
    else out.push({ ic: '⚔️', title: gap <= per ? `Neck and neck: ${nm(a)} vs ${nm(b)}` : `${nm(a)} leads the championship`, text: `${a.pts} – ${b.pts} (${gap === 0 ? 'level on points' : gap + ' point' + (gap === 1 ? '' : 's')}) with ${left} race${left === 1 ? '' : 's'} left${ds[2] && a.pts - ds[2].pts <= per * 1.2 ? `, and ${nm(ds[2])} is still within ${a.pts - ds[2].pts}` : ''}.`, hot: gap <= per });
  }
  if (ts[0] && ts[1]) { const g = ts[0].pts - ts[1].pts; out.push({ ic: '🏗️', title: `Constructors: ${ts[0].name} ${g > maxLeft * 2 ? 'are champions' : g < 20 ? `vs ${ts[1].name} is on a knife edge` : `lead by ${g}`}`, text: `${ts[0].pts} – ${ts[1].pts}.`, hot: false }); }
  // streaks
  const winners = G.results.map(r => (r.rows.find(x => x.pos === 1 && !x.out) || {}).id);
  let st = 1; for (let i = winners.length - 2; i >= 0 && winners[i] === winners[winners.length - 1]; i--) st++;
  if (st >= 2 && winners[winners.length - 1]) out.push({ ic: '🔥', title: `${stNm(winners[winners.length - 1])} has won ${st} in a row`, text: st >= 4 ? 'Is anyone going to stop him?' : 'Momentum is building.', hot: st >= 3 });
  const uniq = new Set(winners.filter(Boolean)); if (done >= 5 && uniq.size >= 5 && uniq.size / done >= 0.3) out.push({ ic: '🎲', title: `${uniq.size} different winners in ${done} races`, text: 'Nobody has been able to dominate.', hot: false });
  const first = Object.values(G.drivers).filter(d => d.wins > 0 && stWins(d.id) === d.wins); if (first.length) out.push({ ic: '🌟', title: `First-time winner${first.length > 1 ? 's' : ''} this season`, text: first.map(d => d.name).join(', '), hot: false });
  // form: points from the last three rounds
  if (done >= 3) {
    const last = G.results.slice(-3), pts = {}; last.forEach(r => { r.rows.forEach(x => pts[x.id] = (pts[x.id] || 0) + x.pts); (r.sprint || []).forEach(x => pts[x.id] = (pts[x.id] || 0) + (x.pts || 0)); });
    const f = Object.entries(pts).sort((x, y) => y[1] - x[1])[0]; if (f && f[1] > 0) out.push({ ic: '📈', title: `Form driver: ${stNm(f[0])}`, text: `${f[1]} points from the last three races.`, hot: false });
    const slump = ds.slice(0, 5).find(d => G.results.slice(-2).every(r => { const x = r.rows.find(y => y.id === d.id); return x && x.pts === 0; }));
    if (slump) out.push({ ic: '📉', title: `${slump.name} is in a slump`, text: 'No points in the last two races.', hot: true });
  }
  // closest team-mate battle
  const mates = Object.values(G.teams).map(t => teamDrivers(G, t.id)).filter(x => x.length === 2 && x[0].pts + x[1].pts >= 20).sort((x, y) => Math.abs(x[0].pts - x[1].pts) / (x[0].pts + x[1].pts) - Math.abs(y[0].pts - y[1].pts) / (y[0].pts + y[1].pts))[0];
  const close = mates && Math.abs(mates[0].pts - mates[1].pts) / (mates[0].pts + mates[1].pts) < 0.1;
  if (close) out.push({ ic: '🤜', title: `Civil war at ${G.teams[mates[0].team].name}`, text: `${nm(mates[0])} ${mates[0].pts} – ${mates[1].pts} ${nm(mates[1])}.`, hot: false });
  const rook = ds.filter(d => d.rookie && d.team)[0]; if (rook) out.push({ ic: '🐣', title: `Rookie of the year race: ${rook.name} leads`, text: `P${ds.indexOf(rook) + 1} in the championship with ${rook.pts} points.`, hot: false });
  return out;
}

// ---------- Storylines page ----------
const STV = { press: null };
function hqStory() {
  const S = stEnsure(), done = G.results.length;
  const heads = stHeadlines();
  const card = h => `<div class="st-head ${h.hot ? 'hot' : ''}"><span class="st-ic">${h.ic}</span><div><b>${esc(h.title)}</b>${h.text ? `<div class="dk-mut">${esc(h.text)}</div>` : ''}</div></div>`;
  const riv = Object.values(S.riv).filter(r => stD(r.a) && stD(r.b)).sort((x, y) => y.score - x.score).slice(0, 6);
  const rivHtml = riv.length ? `<table class="st-riv"><thead><tr><th class="l">Rivalry</th><th>Fights</th><th class="hm">Close finishes</th><th class="hm">Passes seen</th><th>Clashes</th><th class="ra">Points</th></tr></thead><tbody>${riv.map(r => {
    const A = stD(r.a), B = stD(r.b), same = A.team && A.team === B.team, ah = r.ahead || {};
    const ca = G.teams[A.team] ? G.teams[A.team].color : '#666', cb = G.teams[B.team] ? G.teams[B.team].color : '#666';
    return `<tr><td class="l"><span class="st-sw" style="background:${ca}"></span><a data-prof="${A.id}">${esc(dkShort(A))}</a> <span class="dk-mut">${ah[A.id] || 0}–${ah[B.id] || 0}</span> <a data-prof="${B.id}">${esc(dkShort(B))}</a><span class="st-sw" style="background:${cb}"></span>${same ? ' <span class="st-pill">TEAM-MATES</span>' : ''}</td><td>${r.battles}</td><td class="hm">${r.close}</td><td class="hm">${r.passes}</td><td>${r.clashes ? '💥 ' + r.clashes : '–'}</td><td class="ra">${A.pts}–${B.pts}</td></tr>`; }).join('')}</tbody></table><div class="dk-mut st-note">Fights = finished next to each other in the top 10 (the numbers between the names are who came out ahead). Passes = overtakes between the two on track.</div>`
    : '<div class="dk-empty">Rivalries form as drivers finish next to each other, clash on track and fight for the same places.</div>';
  const mkt = S.mkt.length ? S.mkt.slice(0, 30).map(m => `<div class="st-mk"><span class="st-tag ${m.k}">${m.k === 'rumour' ? 'RUMOUR' : m.k === 'leave' ? 'DEPARTURE' : 'CONFIRMED'}</span><span class="dk-mut">R${m.r}</span><span>${esc(m.s)}</span></div>`).join('')
    : `<div class="dk-empty">${G.timeline && G.mix && G.mix.mode === 'stay' ? 'You chose to keep this line-up every season, so the driver market stays quiet.' : 'Quiet for now. Contract talk usually starts around a third of the way through the season.'}</div>`;
  const pr = STV.press == null ? done - 1 : Math.min(done - 1, Math.max(0, STV.press)), R = G.results[pr];
  let press = '<div class="dk-empty">The press room opens after the first race.</div>';
  if (R) {
    const Q = R.press || [];
    press = `<div class="st-prnav"><button data-a="stpress" data-v="${pr - 1}" ${pr > 0 ? '' : 'disabled'}>‹</button><b>R${R.round} · ${esc(R.gp || '')}</b><button data-a="stpress" data-v="${pr + 1}" ${pr < done - 1 ? '' : 'disabled'}>›</button></div>`
      + (Q.length ? Q.map(x => { const d = stD(x.id), tm = G.teams[x.team]; return `<div class="st-q" style="--tc:${tm ? tm.color : '#666'}"><div class="st-qh"><a data-prof="${x.id}"><b>${esc(d ? d.name : x.id)}</b></a><span class="dk-mut">${esc(x.role)}${tm ? ' · ' + esc(tm.name) : ''}</span></div><div>“${esc(x.q)}”</div></div>`; }).join('') : '<div class="dk-mut">No quotes were recorded for this race.</div>');
  }
  return `<div class="dk dk-page" id="dk"><div class="dk-pagehead"><h1>Storylines</h1><span class="sp"></span><span class="dk-mut">${G.year} · Round ${done} of ${G.cal.length}</span><button data-a="tab" data-v="home">Back</button></div>
  <div class="st-grid">
    <section class="st-sec"><div class="dk-h"><b>HEADLINES</b></div><div class="st-body">${heads.map(card).join('')}</div></section>
    <section class="st-sec"><div class="dk-h"><b>PRESS ROOM</b></div><div class="st-body">${press}</div></section>
    <section class="st-sec"><div class="dk-h"><b>RIVALRIES</b></div><div class="st-body">${rivHtml}</div></section>
    <section class="st-sec"><div class="dk-h"><b>DRIVER MARKET · ${G.year + 1}</b></div><div class="st-body">${mkt}</div></section>
  </div></div>`;
}
Object.assign(A, {
  stpress(el) { STV.press = +el.dataset.v; render(); },
  stpressmod() { const r = G.results[G.results.length - 1]; if (!r || !r.press) return; STV.press = G.results.length - 1;
    hxOpen(`<div class="dkx-mod"><div class="dkx-hd"><div><h2>Press Room · ${esc(r.gp || '')}</h2><div class="dk-mut">What the drivers said after the race</div></div><span class="sp"></span><button class="dkx-x" data-a="hxclose">✕</button></div><div class="dkx-body"><section>${r.press.map(x => { const d = stD(x.id), tm = G.teams[x.team]; return `<div class="st-q" style="--tc:${tm ? tm.color : '#666'}"><div class="st-qh"><b>${esc(d ? d.name : x.id)}</b><span class="dk-mut">${esc(x.role)}${tm ? ' · ' + esc(tm.name) : ''}</span></div><div>“${esc(x.q)}”</div></div>`; }).join('')}</section></div></div>`); },
});
// press-room button on the race results page
if (typeof deskRaceRes === 'function') {
  const _st_deskRaceRes = deskRaceRes;
  deskRaceRes = function (sprint) {
    const html = _st_deskRaceRes.apply(this, arguments);
    const r = G.results[G.results.length - 1];
    if (sprint || !r || !r.press || !r.press.length) return html;
    return html.replace('<button data-a="dkextras">', '<button data-a="stpressmod">📰 Press Room</button><button data-a="dkextras">');
  };
}
