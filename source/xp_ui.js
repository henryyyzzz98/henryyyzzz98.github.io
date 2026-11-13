// ===================================================================
// PITWALL EXPANSION — screens & controls
// ===================================================================
const TAB_NAMES = { home: '🏠 Home', calendar: '📅 Calendar', standings: '🏆 Standings', car: '🔧 Car', team: '🏢 Team', drivers: '👤 Drivers', finance: '💰 Business', stats: '📊 Stats', fan: '🎯 Fan zone', menu: '☰ Menu' };
function hqTabs() { return G.spectator ? ['home', 'calendar', 'standings', 'drivers', 'fan', 'stats', 'menu'] : ['home', 'calendar', 'standings', 'car', 'team', 'drivers', 'finance', 'stats', 'fan', 'menu']; }
let CAM = { mode: null, x: 0, y: 0, z: 1 }, REPLAY = null, CHARTSEL = null;

// ---------- HQ: Home additions ----------
const _hqHomeBase = hqHome;
hqHome = function () {
  ensureXP(G);
  if (G.xp.sacked && G.player) return sackedView();
  let html = _hqHomeBase();
  if (G.player && G.teams[G.player] && G.xp.board) {
    const B = G.xp.board, pos = teamRank(G, G.player);
    const mine = teamDrivers(G, G.player);
    html += `<div class="grid g2" style="margin-top:12px"><div class="card"><h3>The board</h3><div class="row"><div class="sp"><div class="small mut">Target this season</div><div class="big">P${B.target}</div></div><div><div class="small mut">Currently</div><div class="big">P${pos || '—'}</div></div></div>
      ${statBar('Confidence', B.conf, 100, 0, B.conf < 30 ? '#ff5b5b' : B.conf < 55 ? '#f5c518' : '#2ecc71')}<div class="small mut">${B.conf < 30 ? 'The board is losing patience. Finish below target and you could be sacked.' : B.conf < 55 ? 'The board wants to see progress.' : 'The board is happy with your work.'}</div></div>
      <div class="card"><h3>Driver mood</h3>${mine.map(d => `<div class="row" style="margin:6px 0"><span class="sp">${esc(d.name)}${d.no1 ? ' <span class="pill">No.1</span>' : ''}</span>${moraleFace(d.morale)}<span class="small mut" style="width:34px;text-align:right">${Math.round(d.morale)}</span></div>`).join('')}
      ${mine.length === 2 ? statBar('Rivalry', G.xp.rivalry, 100, 0, '#ff8a3d') : ''}<div class="small mut">High rivalry means team orders may be ignored.</div></div></div>`;
  }
  return html;
};
function moraleFace(m) { return `<span title="Morale">${m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : m >= 25 ? '😟' : '😠'}</span>`; }
function sackedView() {
  const me = G.teams[G.player];
  const offers = Object.values(G.teams).filter(t => t.id !== G.player).sort((a, b) => appeal(G, a.id) - appeal(G, b.id)).slice(0, 3);
  return `<div class="card hl"><h2>📰 You've been sacked</h2><div>The ${esc(me.name)} board has lost confidence and ended your contract. Your record: ${G.xp.trophies.length} trophies in the cabinet.</div>
  <h3 style="margin-top:12px">Job offers</h3><div class="grid g3">${offers.map(t => `<div class="teamcard" data-a="xpjob" data-v="${t.id}"><div class="stripe" style="background:${t.color}"></div><b>${esc(t.name)}</b><div class="small mut">P${teamRank(G, t.id)} last season · ${teamDrivers(G, t.id).map(d => esc(d.code)).join(' / ')}</div></div>`).join('')}</div>
  <button style="margin-top:12px" data-a="xpretire">Retire and enter the Hall of Fame</button></div>`;
}

// ---------- HQ: Car (parts, next-year focus, power units) ----------
function hqCar() {
  ensureXP(G);
  const me = G.teams[G.player], eng = G.engines[me.engine], X = G.xp;
  const all = Object.values(G.teams);
  const rankOf = k => all.slice().sort((a, b) => (k === 'power' ? G.engines[b.engine].power - G.engines[a.engine].power : b[k] - a[k])).findIndex(t => t.id === me.id) + 1;
  const capLeft = capFor(G) - me.spent; const fac = facLevel(G, 'factory');
  const comp = all.map(t => ({ t, s: (t.aero + t.chassis + G.engines[t.engine].power) / 3 })).sort((a, b) => b.s - a.s);
  const sizes = Object.entries(RD_SIZES);
  const partCards = Object.entries(XP_PARTS).map(([pk, p]) => {
    const locked = p.area === 'power' && !me.works;
    return `<div class="card" style="background:var(--panel2);padding:10px"><div class="row"><b class="sp">${p.name}</b><span class="small mut">${RD_AREAS[p.area].name}</span></div>
    ${locked ? `<div class="small mut">Customer engine — ${esc(eng.name)} develops it.</div>` : `<div class="row" style="margin-top:6px">${sizes.map(([sk, s]) => { const cost = +(s.cost * (1 - 0.04 * (fac - 1))).toFixed(1), races = Math.max(1, s.races - Math.floor((fac - 1) / 2));
      return `<button class="sm" data-a="xppart" data-p="${pk}" data-size="${sk}" ${G.projects.length >= 3 || capLeft < cost || me.money < cost || G.round >= G.cal.length ? 'disabled' : ''}>${s.name} ${fmtM(cost)} · ${races}r</button>`; }).join('')}</div>`}</div>`;
  }).join('');
  const pr = puRules(G);
  const pu = pr ? teamDrivers(G, G.player).map(d => { const st = puState(G, d.id); return `<div class="row" style="margin:5px 0"><span class="sp">${esc(d.name)}</span><span class="small">Unit ${st.units}/${pr.limit}</span><div class="bar" style="width:90px"><i style="width:${Math.min(100, st.wear * 100)}%;background:${st.wear > 0.8 ? '#ff5b5b' : '#2ecc71'}"></i></div><b class="small">${Math.round(st.wear * 100)}%</b></div>`; }).join('') : '<div class="small mut">No power-unit limits in this era.</div>';
  const atr = atrFactor(G);
  return `<div class="grid g2"><div class="card hl"><h3>Your car</h3>
  ${statBar(`Aero (P${rankOf('aero')})`, me.aero)}${statBar(`Chassis (P${rankOf('chassis')})`, me.chassis)}${statBar(`Power (P${rankOf('power')})`, eng.power)}${statBar('Reliability', teamRel(G, me), 100, 60, '#4aa3ff')}
  <div class="small mut">Engine: ${esc(eng.name)}${me.works ? ' (works team)' : ' (customer)'}.</div></div>
  <div class="card"><h3>Grid pecking order</h3><table>${comp.map((c, i) => `<tr class="${c.t.id === me.id ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(c.t.id)}${esc(c.t.name)}</td><td style="width:45%"><div class="bar"><i style="width:${clamp((c.s - 70) / 30, 0, 1) * 100}%;background:${c.t.color}"></i></div></td><td>${c.s.toFixed(1)}</td></tr>`).join('')}</table></div>
  <div class="card" style="grid-column:1/-1"><div class="row"><h3 class="sp">Design office</h3><span class="chip">${capLeft === Infinity ? 'No cost cap' : 'Cap left ' + fmtM(capLeft)}</span><span class="chip">Projects ${G.projects.length}/3</span>${atr !== 1 ? `<span class="chip">Wind tunnel allowance ${Math.round(atr * 100)}%</span>` : ''}</div>
  <div class="small mut" style="margin:4px 0 8px">Pick a part and a project size. Your Technical Director, Head of Aero and facilities multiply the gain; the factory makes builds cheaper and quicker.</div>
  ${G.projects.length ? `<div style="margin-bottom:8px">${G.projects.map(p => `<div class="row news"><b class="sp">${RD_SIZES[p.size].name} ${p.part ? XP_PARTS[p.part].name : RD_AREAS[p.area].name}</b><span class="mut">${p.left} race${p.left > 1 ? 's' : ''} to go</span></div>`).join('')}</div>` : ''}
  <div class="grid g3">${partCards}</div></div>
  <div class="card"><h3>This year vs next year</h3><div class="row"><span class="small">This year</span><input type="range" id="xpfocus" min="0" max="100" step="5" value="${X.focus}" style="flex:1"><span class="small">Next year</span></div>
  <div class="small" style="margin-top:4px"><b id="xpfocusv">${X.focus}%</b> of the design team works on next year's car. Current-year part gains are cut by up to 60%; banked development so far: <b>+${X.nextPool.toFixed(2)}</b>.</div>
  <div class="small mut" style="margin-top:4px">${G.timeline ? 'In the historic timeline, banked development carries into next season\'s car.' : `Next regulation change: <b>${X.regYear}</b> — development banked for that year counts 1.8× and the field gets shuffled.`}</div></div>
  <div class="card"><h3>Power units</h3>${pr ? `<div class="small mut" style="margin-bottom:4px">${pr.limit} per driver this season. Worn units (80%+) fail more often. A unit beyond the limit costs a grid penalty — fit new ones on the grid screen.</div>` : ''}${pu}</div></div>`;
}

// ---------- HQ: Team (staff, facilities, academy) ----------
function hqTeam() {
  ensureXP(G); const X = G.xp, me = G.teams[G.player];
  const staff = Object.entries(XP_ROLES).map(([k, r]) => { const s = X.staff[k]; return `<div class="row news"><div class="sp"><b>${r.name}</b><div class="small mut">${esc(s.name)} · ${r.desc}</div></div><span class="pill">${s.rating}</span><span class="small mut" style="width:70px;text-align:right">${fmtM(s.salary)}/yr</span></div>`; }).join('');
  const market = X.staffMarket.slice().sort((a, b) => a.role.localeCompare(b.role) || b.rating - a.rating).map((s, i) => `<div class="row news"><div class="sp"><b>${esc(s.name)}</b><div class="small mut">${XP_ROLES[s.role].name}</div></div><span class="pill">${s.rating}</span><span class="small mut">${fmtM(s.salary)}/yr</span><button class="sm" data-a="xphire" data-v="${X.staffMarket.indexOf(s)}" ${s.rating <= X.staff[s.role].rating ? 'disabled' : ''}>Hire</button></div>`).join('');
  const fac = Object.entries(XP_FAC).map(([k, f]) => { const lv = X.fac[k]; const b = X.building.find(x => x.key === k); return `<div class="row news"><div class="sp"><b>${f.name}</b> <span class="small">Lv ${lv}/5</span><div class="small mut">${f.desc}</div></div>${b ? `<span class="small warn">Building · ${b.left} races</span>` : lv >= 5 ? '<span class="small good">Max</span>' : `<button class="sm" data-a="xpfac" data-v="${k}" ${me.money < facCost(lv) ? 'disabled' : ''}>Upgrade ${fmtM(facCost(lv))}</button>`}</div>`; }).join('');
  const cap = 60 + X.fac.crew * 8;
  const acad = X.academy.map(id => G.drivers[id]).filter(Boolean);
  const youngsters = freeAgents(G).filter(d => d.age <= 22 && !X.academy.includes(d.id)).sort((a, b) => (b.pot - a.pot) || overall(b) - overall(a)).slice(0, 6);
  return `<div class="grid g2"><div class="card hl"><h3>Key staff</h3>${staff}</div>
  <div class="card"><h3>Staff market</h3><div class="small mut" style="margin-bottom:6px">Hiring someone better replaces the current person in that role. New candidates every season.</div>${market}</div>
  <div class="card"><h3>Facilities</h3>${fac}</div>
  <div class="card"><h3>Pit crew</h3><div class="row"><span class="sp">Crew rating <b>${X.staff.crew.rating}</b> · limit ${cap}</span><button class="sm" data-a="xpdrill" ${X.drillRound === G.round || X.staff.crew.rating >= cap || me.money < 0.4 ? 'disabled' : ''}>Practice drills $0.4M</button></div>
  <div class="small mut" style="margin-top:4px">One drill session between races. Average stop ≈ ${(3.25 - (X.staff.crew.rating - 50) * 0.026).toFixed(2)}s.</div></div>
  <div class="card" style="grid-column:1/-1"><h3>Junior academy (${acad.length}/2)</h3>
  ${acad.map(d => `<div class="row news"><div class="sp"><b>${flag(d.nat)} ${esc(d.name)}</b> <span class="small mut">age ${d.age} · ${'★'.repeat(Math.max(1, d.pot))}</span></div><span class="pill">OVR ${overall(d).toFixed(1)}</span><button class="sm" data-a="xppromote" data-v="${d.id}">Promote to race seat</button><button class="sm" data-a="xprelease" data-v="${d.id}">Release</button></div>`).join('') || '<div class="small mut">No juniors yet.</div>'}
  ${acad.length < 2 ? `<div class="small" style="margin:8px 0 4px">Scouting report — young free agents ($1M a year each):</div>${youngsters.map(d => `<div class="row news"><span class="sp">${flag(d.nat)} ${esc(d.name)} <span class="small mut">age ${d.age} · ${'★'.repeat(Math.max(1, d.pot))}</span></span><span class="pill">OVR ${overall(d).toFixed(1)}</span><button class="sm" data-a="xpacademy" data-v="${d.id}">Sign to academy</button></div>`).join('')}` : ''}</div></div>`;
}

// ---------- HQ: Business (finance + sponsors + board) ----------
const _hqFinanceBase = hqFinance;
hqFinance = function () {
  ensureXP(G); const X = G.xp;
  const act = X.sponsors.active, offers = X.sponsors.offers;
  const sCard = s => `<div class="row news"><div class="sp"><b>${esc(s.name)}</b><div class="small">${esc(sponsorText(G, s))}</div><div class="small mut">${fmtM(s.perRace)} per race · ${fmtM(s.bonus)} bonus${s.obj.n ? ` · progress ${s.progress}/${s.obj.n}` : ''}</div></div>${s.done ? '<span class="pill" style="background:#0f5f2a">✓ Done</span>' : s.failed ? '<span class="pill" style="background:#5f0f0f">Missed</span>' : ''}</div>`;
  return _hqFinanceBase() + `<div class="grid g2" style="margin-top:12px"><div class="card hl"><h3>Sponsor deals (${act.length}/2)</h3>${act.map(sCard).join('') || '<div class="small mut">No deals signed — pick up to two offers.</div>'}</div>
  <div class="card"><h3>Offers</h3>${offers.length && act.length < 2 ? offers.map((s, i) => `<div class="row news"><div class="sp"><b>${esc(s.name)}</b><div class="small">${esc(sponsorText(G, s))}</div><div class="small mut">${fmtM(s.perRace)} per race · ${fmtM(s.bonus)} bonus</div></div><button class="sm" data-a="xpsponsor" data-v="${i}">Sign</button></div>`).join('') : '<div class="small mut">New offers arrive at the start of each season.</div>'}</div>
  <div class="card"><h3>Staff wages</h3><div class="big">${fmtM(Object.values(X.staff).reduce((a, s) => a + s.salary, 0))}/yr</div><div class="small mut">Paid per race. Facilities are capital spending and don't count towards the cost cap.</div></div></div>`;
};

// ---------- HQ: Stats ----------
function hqStats() {
  ensureXP(G);
  const mode = SUB.stats || 'race';
  const tabs = [['race', 'Last race'], ['title', 'Title fight'], ['h2h', 'Head-to-heads'], ['records', 'Records']].concat(G.player ? [['cabinet', 'Trophy cabinet']] : []);
  let body = '';
  const last = G.results[G.results.length - 1];
  if (mode === 'race') body = last ? `<h3>Lap chart — ${esc(last.gp || TRACK_BY_ID[last.track].short)}</h3>${lapChart(last)}<h3 style="margin-top:14px">Strategy</h3>${strategyChart(last)}` : '<div class="mut">Race once to see charts.</div>';
  if (mode === 'title') body = G.results.length ? `<h3>Points after each round — top 6</h3>${titleChart()}${titleStory()}` : '<div class="mut">The season hasn\'t started.</div>';
  if (mode === 'h2h') body = h2hTable();
  if (mode === 'records') { const lb = winsLeaderboard(G, 20); body = `<h3>All-time race wins</h3><div class="small mut" style="margin-bottom:6px">Real results from F1DB up to ${recordBase(G).year}, plus every win in this save.</div><table>${lb.map((e, i) => `<tr class="${e.live ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}${e.live ? ' <span class="pill">active</span>' : ''}</td><td style="text-align:right"><b>${e.wins}</b></td></tr>`).join('')}</table>`; }
  if (mode === 'cabinet') { const T = G.xp.trophies.slice().reverse(); const h = hofLoad().slice().reverse(); body = `<h3>Trophy cabinet</h3>${T.length ? T.map(t => `<div class="news">${t.t === 'title' ? '🏆' : t.t === 'win' ? '🥇' : '🤝'} <span class="mut small">${t.y}</span> ${esc(t.s)}</div>`).join('') : '<div class="mut small">Win something!</div>'}<h3 style="margin-top:12px">Hall of Fame (all careers in this browser)</h3>${h.length ? `<table>${h.slice(0, 30).map(e => `<tr><td>${e.y}</td><td>${esc(e.team || '')}</td><td>P${e.pos}</td><td class="small mut">${e.mode}${e.retired ? ' · retired' : ''}</td></tr>`).join('')}</table>` : '<div class="mut small">Finish a season to start it.</div>'}`; }
  return `<div class="card"><div class="row" style="margin-bottom:10px">${tabs.map(([k, v]) => `<button class="sm ${mode === k ? 'on' : ''}" data-a="sub" data-k="stats" data-v="${k}">${v}</button>`).join('')}</div>${body}</div>`;
}
function lapChart(r) {
  if (!r.lapPos || r.lapPos.length < 2) return '<div class="mut small">No lap data for this race.</div>';
  const W = 760, H = 330, L = r.lapPos.length, N = Math.max(...r.lapPos.map(a => a.length));
  const x = i => 30 + i / (L - 1) * (W - 90), y = p => 12 + p / Math.max(1, N - 1) * (H - 30);
  const ids = [...new Set(r.lapPos.flat())];
  const hi = new Set(r.rows.filter(x2 => G.player ? x2.team === G.player : x2.id === G.follow).map(x2 => x2.id).concat(r.rows.slice(0, 3).map(x2 => x2.id)));
  const lines = ids.map(id => { const pts = r.lapPos.map((ord, i) => ord.indexOf(id) >= 0 ? `${x(i).toFixed(1)},${y(ord.indexOf(id)).toFixed(1)}` : null).filter(Boolean); const row = r.rows.find(z => z.id === id); const col = row ? teamCol(row.team) : '#888';
    const isHi = hi.has(id); const lastI = r.lapPos.length - 1; const fp = r.lapPos[lastI].indexOf(id);
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${isHi ? 2.6 : 1.2}" opacity="${isHi ? 1 : 0.35}"/>${fp >= 0 && isHi ? `<text x="${x(lastI) + 6}" y="${y(fp) + 4}" font-size="11" fill="#fff" font-weight="700">${row ? esc(row.code) : ''}</text>` : ''}`; }).join('');
  const grid = Array.from({ length: N }, (_, p) => p % 5 === 0 || p === N - 1 ? `<text x="8" y="${y(p) + 4}" font-size="10" fill="#8a93a6">${p + 1}</text>` : '').join('');
  return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:520px;background:#0e1016;border-radius:10px">${grid}${lines}<text x="${W - 60}" y="${H - 4}" font-size="10" fill="#8a93a6">lap ${L}</text></svg></div><div class="small mut">Position by lap. Highlighted: the podium and ${G.player ? 'your drivers' : 'your followed driver'}.</div>`;
}
function strategyChart(r) {
  if (!r.stints) return '<div class="mut small">No strategy data.</div>';
  const maxL = Math.max(...r.rows.map(x => x.laps), 1);
  return `<div class="strat">${r.rows.map(row => { const st = r.stints[row.id] || []; return `<div class="strow ${(G.player ? row.team === G.player : row.id === G.follow) ? 'me' : ''}"><span class="stc">${row.out ? 'DNF' : row.pos}</span><b class="stn">${esc(row.code)}</b><div class="stbar">${st.map(([t, l]) => `<span style="width:${l / maxL * 100}%;background:${TYRES[t].col}" title="${TYRES[t].name} · ${l} laps">${l >= 4 ? l : ''}</span>`).join('')}</div></div>`; }).join('')}</div>`;
}
function titleChart() {
  const top = standingsDrivers(G).slice(0, 6); const R = G.results.length;
  const cum = top.map(d => { let s = 0; return [0].concat(G.results.map(r => { const row = r.rows.find(x => x.id === d.id); const sp = r.sprint ? (r.sprint.find(x => x.id === d.id) || {}).pts || 0 : 0; s += (row ? row.pts : 0) + sp; return s; })); });
  const maxP = Math.max(1, ...cum.flat()); const W = 760, H = 300; const x = i => 40 + i / Math.max(1, R) * (W - 120), y = v => H - 24 - v / maxP * (H - 40);
  return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:520px;background:#0e1016;border-radius:10px">${[0, 0.25, 0.5, 0.75, 1].map(f => `<line x1="40" x2="${W - 80}" y1="${y(maxP * f)}" y2="${y(maxP * f)}" stroke="#1f2430"/><text x="6" y="${y(maxP * f) + 4}" font-size="10" fill="#8a93a6">${Math.round(maxP * f)}</text>`).join('')}
    ${top.map((d, i) => `<polyline points="${cum[i].map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${teamCol(d.team)}" stroke-width="${i === 0 ? 3 : 2}" ${i % 2 ? 'stroke-dasharray="5 3"' : ''}/><text x="${x(R) + 6}" y="${y(cum[i][R]) + 4}" font-size="11" fill="#fff" font-weight="700">${esc(d.code)} ${d.pts}</text>`).join('')}</svg></div>`;
}
function titleStory() {
  const ds = standingsDrivers(G); if (ds.length < 2) return '';
  const gap = ds[0].pts - ds[1].pts; const P1 = ((G.rules && G.rules.points) || POINTS)[0]; const left = (G.cal.length - G.round) * P1;
  return `<div class="news" style="margin-top:8px">${gap > left ? `🏆 <b>${esc(ds[0].name)}</b> is the champion.` : `<b>${esc(ds[0].name)}</b> leads <b>${esc(ds[1].name)}</b> by ${gap} points with ${left} still available.${ds[2] && ds[0].pts - ds[2].pts <= left ? ` ${esc(ds[2].name)} is still in it too.` : ''}`}</div>`;
}
function h2hTable() {
  const rows = Object.values(G.teams).map(t => { const ds = teamDrivers(G, t.id); if (ds.length < 2) return ''; const [a, b] = ds; let qa = 0, qb = 0, ra = 0, rb = 0;
    G.results.forEach(r => { const A = r.rows.find(x => x.id === a.id), B = r.rows.find(x => x.id === b.id); if (!A || !B) return; if (A.grid < B.grid) qa++; else qb++; if (!A.out && !B.out) { if (A.pos < B.pos) ra++; else rb++; } });
    return `<tr><td>${tbar(t.id)}${esc(t.name)}</td><td><b>${esc(a.code)}</b> v ${esc(b.code)}</td><td>${qa}–${qb}</td><td>${ra}–${rb}</td><td>${a.pts}–${b.pts}</td></tr>`; }).join('');
  return `<h3>Team-mate head-to-heads</h3><table><tr><th>Team</th><th>Drivers</th><th>Quali</th><th>Race</th><th>Points</th></tr>${rows}</table>`;
}

// ---------- HQ: Fan zone (predictions, fantasy, driver of the day) ----------
function hqFan() {
  ensureXP(G); const F = G.xp.fan; const mode = SUB.fan || 'pred';
  const tabs = [['pred', 'Predictions'], ['fantasy', 'Fantasy league'], ['dotd', 'Driver of the Day']];
  let body = '';
  if (mode === 'pred') {
    const board = [{ name: 'You', pts: F.predPts, me: true }].concat(PUNDITS.map(p => ({ name: p.name, pts: F.pundits[p.id] || 0 }))).sort((a, b) => b.pts - a.pts);
    const past = Object.entries(F.preds).filter(([k]) => k.startsWith(G.year + ':')).sort((a, b) => +b[0].split(':')[1] - +a[0].split(':')[1]);
    body = `<div class="small mut" style="margin-bottom:8px">Before qualifying, pick the pole sitter. Before the race, pick the winner, the podium and the fastest lap. Pole 5 pts · winner 10 · each podium driver 3 (+2 in the exact spot) · fastest lap 3.</div>
    <h3>Season leaderboard</h3><table>${board.map((b, i) => `<tr class="${b.me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(b.name)}</td><td style="text-align:right"><b>${b.pts}</b></td></tr>`).join('')}</table>
    <h3 style="margin-top:12px">Your picks</h3>${past.map(([k, p]) => `<div class="news">R${k.split(':')[1]}: ${p.mine.win ? 'win ' + esc(dcode(p.mine.win)) : ''} ${p.mine.pole ? '· pole ' + esc(dcode(p.mine.pole)) : ''} ${p.score != null ? `<b class="good">+${p.score}</b>` : '<span class="mut">pending</span>'}</div>`).join('') || '<div class="mut small">No picks yet — you\'ll be asked during the next race weekend.</div>'}`;
  }
  if (mode === 'fantasy') body = fantasyView();
  if (mode === 'dotd') { const list = Object.entries(F.dotd).sort((a, b) => b[1] - a[1]); body = `<div class="small mut">Vote after every race. Fans' choice this season:</div><table>${list.map(([id, n], i) => `<tr><td>${i + 1}</td><td>${esc(dname(id))}</td><td style="text-align:right">${n}×</td></tr>`).join('') || '<tr><td class="mut">No votes yet.</td></tr>'}</table>`; }
  return `<div class="card"><div class="row" style="margin-bottom:10px">${tabs.map(([k, v]) => `<button class="sm ${mode === k ? 'on' : ''}" data-a="sub" data-k="fan" data-v="${k}">${v}</button>`).join('')}</div>${body}</div>`;
}
const dname = id => G.drivers[id] ? G.drivers[id].name : id;
const dcode = id => G.drivers[id] ? G.drivers[id].code : id;
function fantasyView() {
  const F = G.xp.fan; if (!F.fantasy) F.fantasy = { drivers: [], team: null, pts: 0, history: [], budget: 100, freeTransfers: 99 };
  const T = F.fantasy; const P = fantasyPrices(G);
  const spent = T.drivers.reduce((s, id) => s + (P.drivers[id] || 0), 0) + (T.team ? P.teams[T.team] || 0 : 0);
  const left = +(T.budget - spent).toFixed(1);
  const drivers = Object.values(G.drivers).filter(d => d.team).sort((a, b) => (P.drivers[b.id] || 0) - (P.drivers[a.id] || 0));
  const teams = Object.values(G.teams).sort((a, b) => P.teams[b.id] - P.teams[a.id]);
  return `<div class="row"><div class="sp"><div class="big">${T.pts} pts</div><div class="small mut">Budget left ${fmtM(left)} · free transfers ${T.freeTransfers >= 99 ? 'unlimited (pre-season)' : T.freeTransfers} · extra transfers −4 pts</div></div></div>
  <div class="small mut" style="margin:6px 0">Pick 5 drivers and 1 constructor. Scoring: race points (25…1) + places gained, pole +3, fastest lap +3, retirement −5; your constructor scores half its drivers' race points.</div>
  <h3>Drivers (${T.drivers.length}/5)</h3><div class="fgrid">${drivers.map(d => { const on = T.drivers.includes(d.id); return `<button class="fpick ${on ? 'on' : ''}" data-a="xpfd" data-v="${d.id}" style="--tc:${teamCol(d.team)}"><b>${esc(d.code)}</b><span>${fmtM(P.drivers[d.id])}</span></button>`; }).join('')}</div>
  <h3 style="margin-top:10px">Constructor</h3><div class="fgrid">${teams.map(t => `<button class="fpick ${T.team === t.id ? 'on' : ''}" data-a="xpft" data-v="${t.id}" style="--tc:${t.color}"><b>${esc(t.name)}</b><span>${fmtM(P.teams[t.id])}</span></button>`).join('')}</div>
  ${T.history.length ? `<h3 style="margin-top:10px">Round by round</h3><div class="row">${T.history.slice(-12).map(h => `<span class="chip">R${h.round} <b>${h.pts}</b></span>`).join('')}</div>` : ''}`;
}

// ---------- weekend: practice setup puzzle + tyre sets ----------
const _startWeekendBase = startWeekend;
startWeekend = function () { _startWeekendBase(); if (WK && WK.sets === undefined) { initSets(WK); render(); } };
const _wkPracticeBase = wkPractice;
wkPractice = function () {
  ensureXP(G);
  if (!WK.setupCur) { WK.setupCur = {}; WK.setupFb = {}; myEntries().forEach(e => { WK.setupCur[e.d.id] = { fw: 5, rw: 5, susp: 5, ride: 5 }; }); }
  if (WK.sets === undefined) initSets(WK);
  let html = _wkPracticeBase();
  const mine = myEntries(); if (!mine.length) return html;
  const locked = WK.stage !== 'fp';
  html += `<div class="card" style="margin-top:12px"><h3>Setup — talk to your drivers</h3><div class="small mut" style="margin-bottom:8px">Adjust the setup, then run a session with the <b>Setup work</b> plan to hear what the driver thinks. Setups lock (parc fermé) once qualifying starts.</div>
  <div class="grid g2">${mine.map(e => { const cur = WK.setupCur[e.d.id]; const fb = WK.setupFb[e.d.id] || [];
    return `<div class="card" style="background:var(--panel2)"><div class="row"><b class="sp">${esc(e.d.name)}</b><span class="chip">Setup ${Math.round(e.setup * 100)}%</span></div>
    ${SETUP_KEYS.map(([k, lab]) => `<div class="stat" style="grid-template-columns:100px 1fr 26px"><span class="mut small">${lab}</span><input type="range" min="1" max="10" value="${cur[k]}" data-setup="${e.d.id}:${k}" ${locked ? 'disabled' : ''}><b class="small">${cur[k]}</b></div>`).join('')}
    ${fb.length ? `<div class="radio-box">${fb.map(l => `<div>📻 “${esc(l.txt)}”</div>`).join('')}</div>` : '<div class="small mut">No feedback yet.</div>'}
    ${WK.sets ? `<div class="small" style="margin-top:6px">Tyre sets left: ${['S', 'M', 'H'].map(c => { const s = setsLeft(e.d.id, c); return `${tyreB(c)} ${s.fresh} new${s.used ? ` + ${s.used} used` : ''}`; }).join(' · ')}</div>` : ''}</div>`; }).join('')}</div></div>`;
  return html;
};
const _runPracticeBase = runPractice;
runPractice = function (G, wk, session, programs) {
  const rows = _runPracticeBase(G, wk, session, programs);
  if (G.player && wk.setupCur) {
    const eng = G.xp.staff.eng.rating; const simB = 1 + (facLevel(G, 'sim') - 1) * 0.08;
    myEntries().forEach(e => {
      const opt = setupOptimum(wk.track, e.d); const cur = wk.setupCur[e.d.id]; const sc = setupScore(cur, opt);
      e.setup = clamp(0.3 + 0.7 * sc * Math.min(1, 0.85 * simB), 0, 1);
      if ((programs[e.d.id] || 'setup') === 'setup') wk.setupFb[e.d.id] = setupFeedback(cur, opt, e.d, eng);
      else e.tyreKnow = clamp(e.tyreKnow * simB, 0, 1);
    });
  }
  if (wk.sets) wk.entries.forEach(e => { for (let k = 0; k < 2; k++) { const c = Math.random() < 0.6 ? 'S' : 'M'; const w = takeSet(e.d.id, c); if (w < 0.35) returnSet(e.d.id, c, w + rnd(0.15, 0.4)); } });
  return rows;
};

// ---------- weekend: predictions on the quali & grid screens ----------
function predKey() { return G.year + ':' + (WK.round + 1); }
function predCard(kind) {
  ensureXP(G); const P = G.xp.fan.preds[predKey()] || (G.xp.fan.preds[predKey()] = { mine: {}, pundits: punditPicks(G, WK) });
  const opts = sel => WK.entries.slice().sort((a, b) => a.t.name.localeCompare(b.t.name)).map(e => `<option value="${e.d.id}" ${sel === e.d.id ? 'selected' : ''}>${esc(e.d.code)} · ${esc(e.d.name)}</option>`).join('');
  const s = (field, label, i) => { const v = i != null ? (P.mine.podium || [])[i] : P.mine[field]; return `<label class="small" style="display:block;margin:4px 0">${label}<select data-pred="${field}${i != null ? ':' + i : ''}" style="width:100%"><option value="">— pick —</option>${opts(v)}</select></label>`; };
  if (kind === 'quali') return `<div class="card" style="margin-top:12px"><h3>🎯 Prediction: who takes pole?</h3>${s('pole', 'Pole position')}<div class="small mut">Pundit picks: ${PUNDITS.map(p => `${p.name}: <b>${esc(dcode(P.pundits[p.id].pole))}</b>`).join(' · ')}</div></div>`;
  return `<div class="card" style="margin-top:12px"><h3>🎯 Predictions for the race</h3><div class="grid g2"><div>${s('win', 'Winner')}${s('fl', 'Fastest lap')}</div><div>${s('podium', 'P1', 0)}${s('podium', 'P2', 1)}${s('podium', 'P3', 2)}</div></div>
  <div class="small mut">Pundits: ${PUNDITS.map(p => `${p.name} → <b>${esc(dcode(P.pundits[p.id].win))}</b>`).join(' · ')}</div></div>`;
}
const _wkQualiBase = wkQuali;
wkQuali = function (key) {
  const html = _wkQualiBase(key);
  const QS = WK[key]; if (key === 'Q' && QS.stage === 1 && !QS.live) return html + predCard('quali');
  return html;
};
const _wkGridBase = wkGrid;
wkGrid = function (sprint) {
  ensureXP(G);
  let html = _wkGridBase(sprint);
  if (!sprint) {
    // power units (manager) + AI auto changes
    const pr = puRules(G);

    if (pr && G.player) html += `<div class="card" style="margin-top:12px"><h3>Power units</h3>${myEntries().map(e => { const st = puState(G, e.d.id); const over = st.units + 1 > pr.limit;
      return `<div class="row news"><span class="sp"><b>${esc(e.d.name)}</b> · unit ${st.units}/${pr.limit} · wear <b class="${st.wear > 0.8 ? 'bad' : ''}">${Math.round(st.wear * 100)}%</b></span>${WK.newPU && WK.newPU[e.d.id] ? '<span class="pill" style="background:#0f5f2a">New unit fitted</span>' : `<button class="sm" data-a="xpnewpu" data-v="${e.d.id}">Fit new unit${over ? ' (+10 grid places)' : ''}</button>`}</div>`; }).join('')}
      ${(WK.penalties || []).length ? `<div class="small warn" style="margin-top:6px">Grid penalties: ${WK.penalties.map(p => `${esc(p.code)} +${p.n} (${p.why})`).join(', ')}</div>` : ''}</div>`;
    html += predCard('race');
  }
  return html;
};
// ---------- race view: camera, onboard, radio, team orders, graphics, replays ----------
const _wkRaceBase = wkRace;
wkRace = function () {
  ensureXP(G);
  if (!CAM.mode) CAM.mode = G.xp.settings.cam || 'track';
  let html = _wkRaceBase();
  html = html.replace('<div class="row" style="margin:8px 0" id="rctl">', `<div class="camsel">${[['track', 'Full track'], ['director', '🎥 Director'], ['onboard', '🎯 Onboard']].map(([k, v]) => `<button class="${CAM.mode === k ? 'on' : ''}" data-a="xpcam" data-v="${k}">${v}</button>`).join('')}</div><div class="row" style="margin:8px 0" id="rctl">`);
  html = html.replace('<div class="hud" id="hud"></div>', `<div class="hud" id="hud"></div><div class="bgfx" id="bgfx"></div><div class="pitgfx" id="pitgfx"></div><div class="radiogfx" id="radiogfx"></div><div class="replaybadge" id="replaybadge"></div>`);
  html = html.replace('<div class="card" style="margin-top:10px"><h3>Race control</h3><div class="feed" id="feed"></div></div>',
    `<div class="grid g2" style="margin-top:10px"><div class="card"><div class="row"><h3 class="sp" style="margin:0">${G.spectator ? 'Commentary' : 'Race control'}</h3><button class="sm" data-a="xpfeed">${(SUB.feed || (G.spectator ? 'comm' : 'rc')) === 'comm' ? 'Race control' : 'Commentary'}</button></div><div class="feed" id="feed" style="margin-top:6px"></div></div>
    <div class="card"><h3>📻 Team radio</h3><div id="radiolist" class="feed"></div></div>
    <div class="card"><h3>🌦️ Weather radar</h3><div id="radar"></div></div>
    <div class="card"><h3>🎬 Highlights</h3><div id="hlist" class="small mut">Key moments appear here.</div></div></div>`);
  return html;
};
// Replace the base drawRace with a camera-aware version
drawRace = function () {
  const cv = document.getElementById('cv'); if (!cv || !RACE) return;
  const ctx = cv.getContext('2d'); const { _w: w, _h: h, _dpr: dpr } = cv;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const g = trackGeometry(RACE.track); const s = Math.min(w, h) - 60; const ox = (w - s) / 2, oy = (h - s) / 2 + 8;
  const L = RACE.L; const frame = REPLAY ? replayFrame() : null;
  const posOf = (c, i) => { let dist = frame ? frame.d[RACE.cars.indexOf(c)] : (c.pitT > 0 ? c.dist - 1e9 : c.dist); if (dist == null) return null; const inPit = dist < -1e8; if (inPit) dist += 1e9;
    let frac = (!frame && c.finished) ? 0.002 * i : (RACE.started || frame ? dist : dist * 2.6) / L; const p = pointAt(g, frac); let x = ox + p[0] * s, y = oy + p[1] * s;
    if (!RACE.started && !frame) { const n = p[2] + Math.PI / 2, side = (c.grid % 2 ? -1 : 1) * 5; x += Math.cos(n) * side; y += Math.sin(n) * side; }
    if (inPit) { const n = p[2] + Math.PI / 2; x += Math.cos(n) * 16; y += Math.sin(n) * 16; } return [x, y]; };
  // camera target
  let tz = 1, tx = w / 2, ty = h / 2;
  const ord = RACE.order();
  if (CAM.mode !== 'track') {
    let focus = null;
    if (CAM.mode === 'director') { const b = topBattle(RACE, 12); focus = b ? [b.a, b.b] : [ord[0]]; tz = 2.3; }
    else { const c = RACE.cars.find(x => x.fav) || RACE.cars.find(x => x.player) || ord[0]; focus = [c]; tz = 3; }
    const ps = focus.map(c => posOf(c, ord.indexOf(c))).filter(Boolean);
    if (ps.length) { tx = ps.reduce((a, p) => a + p[0], 0) / ps.length; ty = ps.reduce((a, p) => a + p[1], 0) / ps.length; }
  }
  const k = 0.12; CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k; CAM.z += (tz - CAM.z) * k;
  if (!CAM.x) { CAM.x = tx; CAM.y = ty; CAM.z = tz; }
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(CAM.z, CAM.z); ctx.translate(-CAM.x, -CAM.y);
  drawTrackBase(ctx, w, h, RACE.track, { wet: frame ? 0 : RACE.wet, yellow: !frame && (RACE.sc || RACE.vsc) });
  ctx.restore();
  const toScr = p => [(p[0] - CAM.x) * CAM.z + w / 2, (p[1] - CAM.y) * CAM.z + h / 2];
  const labelSet = new Set();
  if (CAM.mode === 'director') { const b = topBattle(RACE, 12); if (b) { labelSet.add(b.a); labelSet.add(b.b); } }
  for (let i = ord.length - 1; i >= 0; i--) { const c = ord[i]; if (c.out && !frame) continue; const p = posOf(c, i); if (!p) continue; const q = toScr(p);
    if (q[0] < -20 || q[1] < -20 || q[0] > w + 20 || q[1] > h + 20) continue;
    const lab = (RACE.started || frame) && (CAM.mode === 'track' ? i < 3 : CAM.mode === 'director' ? labelSet.has(c) : true);
    drawCar(ctx, q[0], q[1], c, lab, false); }
};
function replayFrame() {
  const R = REPLAY; const fr = R.clip.frames; if (!fr.length) return null;
  const el = (performance.now() - R.start) / 1000 * 4; const t = fr[0].t + el;
  if (t >= fr[fr.length - 1].t) { stopReplay(); return null; }
  let i = 0; while (i < fr.length - 2 && fr[i + 1].t < t) i++;
  const a = fr[i], b = fr[i + 1] || a; const f = (t - a.t) / Math.max(0.001, b.t - a.t);
  return { d: a.d.map((v, j) => v == null || b.d[j] == null ? v : v + (b.d[j] - v) * f) };
}
function stopReplay() { REPLAY = null; PAUSED = !!(window._wasPaused); const rb = document.getElementById('replaybadge'); if (rb) rb.innerHTML = ''; }

// extra UI updates after each tick
const _updateRaceUIBase = updateRaceUI;
updateRaceUI = function (force) {
  _updateRaceUIBase(force); if (!RACE) return;
  const feedMode = SUB.feed || (G.spectator ? 'comm' : 'rc');
  const feed = document.getElementById('feed');
  if (feed && feedMode === 'comm') feed.innerHTML = (RACE.comm || []).slice(0, 25).map(l => `<div><span class="mut">L${l.lap}</span> 🎙️ ${esc(l.txt)}</div>`).join('') || '<div class="mut">The commentators are getting ready…</div>';
  // battle box
  const bg = document.getElementById('bgfx');
  if (bg) { const b = RACE.started && !RACE.chequered ? topBattle(RACE, 10) : null; bg.innerHTML = b ? `<div class="bbox"><div class="bt">BATTLE FOR P${b.pos}</div><div class="br"><span style="border-left:4px solid ${b.a.t.color}">${esc(b.a.d.code)}</span><b>${b.gap.toFixed(1)}s</b><span style="border-left:4px solid ${b.b.t.color}">${esc(b.b.d.code)}</span></div></div>` : ''; }
  // pit stop timer graphic
  const pg = document.getElementById('pitgfx');
  if (pg) { const p = RACE.pitGfx; pg.innerHTML = p && RACE.t - p.t < 30 ? `<div class="pbox" style="border-left:5px solid ${p.c.t.color}"><div class="pt">PIT STOP</div><div class="pr"><b>${esc(p.c.d.code)}</b><span class="ptime">${p.svc.toFixed(1)}s</span>${tyreB(p.comp)}</div></div>` : ''; }
  // radio overlay & list
  const latest = RACE.radio && RACE.radio[0];
  const rg = document.getElementById('radiogfx');
  if (rg) rg.innerHTML = latest && RACE.t - latest.t < 20 ? `<div class="rbox" style="border-left:5px solid ${latest.c.t.color}"><div class="rt">📻 ${esc(latest.c.d.name.toUpperCase())}</div><div>“${esc(latest.txt)}”</div></div>` : '';
  const rl = document.getElementById('radiolist');
  if (rl) rl.innerHTML = (RACE.radio || []).map(r => `<div><b style="color:${r.c.t.color}">${esc(r.c.d.code)}</b> “${esc(r.txt)}”${r.actions ? `<div class="row" style="margin:3px 0">${r.actions.map(([lab, act]) => `<button class="sm" data-a="xpradio" data-v="${r.id}" data-act="${act}">${lab}</button>`).join('')}</div>` : r.answer ? ` <span class="mut small">→ ${esc(r.answer)}</span>` : ''}</div>`).join('') || '<div class="mut">Quiet on the radio.</div>';
  // weather radar
  const rd = document.getElementById('radar');
  if (rd) { const lap = RACE.leaderLap; let w = RACE.wet, tgt = RACE.wetTarget; const cells = [];
    for (let k = 1; k <= 10; k++) { const L2 = lap + k; RACE.plan.forEach(p => { if (p.lap === L2) tgt = p.target; }); w += (tgt - w) * 0.35; cells.push([L2, w]); }
    rd.innerHTML = `<div class="radar">${cells.map(([L2, w2]) => `<div title="Lap ${L2}"><i style="height:${Math.max(6, w2 * 100)}%;background:${w2 > 0.6 ? '#2f7bef' : w2 > 0.22 ? '#3bb54a' : w2 > 0.05 ? '#8aa' : '#3a3f4b'}"></i><span>${L2}</span></div>`).join('')}</div><div class="small mut">${cells.some(c => c[1] > 0.22) ? 'Rain expected — inters territory in the blue/green laps.' : 'Dry for the next 10 laps (forecasts can change).'}</div>`; }
  // highlights
  const hl = document.getElementById('hlist');
  if (hl) hl.innerHTML = (RACE.highlights || []).map((c, i) => `<div class="row news"><span class="sp">L${c.lap} · ${esc(c.label)}</span><button class="sm" data-a="xpreplay" data-v="${i}">▶ Replay</button></div>`).join('') || 'Key moments appear here.';
  // extra player controls: engine modes + team orders
  RACE.cars.filter(c => c.player).forEach(c => {
    const el = document.getElementById('ctl_' + c.d.id); if (!el || c.out || c.finished) return;
    const mn = modeNames(G);
    el.insertAdjacentHTML('beforeend', `<div class="small mut" style="margin-top:4px">${ersOn(G) ? 'Battery' : 'Fuel mix'} ${ersOn(G) ? Math.round(c.battery) + '%' : ''}</div><div class="seg">${Object.entries(mn).map(([k, v]) => `<button class="sm ${c.ers === k ? 'on' : ''}" data-a="xpers" data-d="${c.d.id}" data-v="${k}">${v}</button>`).join('')}</div>
    ${WK.sets ? `<div class="small mut" style="margin-top:3px">Sets left: ${['S', 'M', 'H'].map(t => { const s = setsLeft(c.d.id, t); return `${t} ${s.fresh}${s.used ? '+' + s.used : ''}`; }).join(' · ')}</div>` : ''}`);
  });
  const ctrls = document.getElementById('ctrls');
  if (ctrls && G.player && RACE.cars.filter(c => c.player && !c.out).length === 2 && !document.getElementById('xporders')) ctrls.insertAdjacentHTML('beforeend', `<div class="ctrl" id="xporders"></div>`);
  const to = document.getElementById('xporders');
  if (to) to.innerHTML = `<b>Team orders</b><div class="seg" style="margin-top:4px"><button class="sm ${RACE.teamOrder === 'free' ? 'on' : ''}" data-a="xporder" data-v="free">Free to race</button><button class="sm ${RACE.teamOrder === 'hold' ? 'on' : ''}" data-a="xporder" data-v="hold">Hold positions</button><button class="sm" data-a="xporder" data-v="swap">Swap cars</button></div><div class="small mut" style="margin-top:3px">Rivalry ${Math.round(G.xp.rivalry)} — high rivalry means orders may be ignored.</div>`;
  // onboard panel for followed driver (spectator) or my lead car
  const focus = RACE.cars.find(x => x.fav) || (G.player ? RACE.cars.find(x => x.player && !x.out) : null);
  let ob = document.getElementById('onboard');
  if (focus && ctrls) { if (!ob) { ctrls.insertAdjacentHTML('afterbegin', '<div class="ctrl onboard" id="onboard"></div>'); ob = document.getElementById('onboard'); } ob.innerHTML = onboardHTML(focus); }
  else if (ob) ob.remove();
  // engine sound
  if (RACE.started && !PAUSED && !RACE.done && focus) { const sp = onboardSpeed(focus); SND.engine(1, sp / 340); } else SND.stopEngine();
};
function onboardSpeed(c) {
  if (c.out || c.finished) return 0; if (c.pitT > 0) return 80;
  const g = trackGeometry(RACE.track); const f = (c.dist / RACE.L) % 1; const d = 0.004;
  const a1 = pointAt(g, f - d)[2], a2 = pointAt(g, f + d)[2]; let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
  const a3 = pointAt(g, f + d * 3)[2]; let da2 = Math.abs(a3 - a2); if (da2 > Math.PI) da2 = 2 * Math.PI - da2;
  const vmax = 335 * eraSpeed(G.year), vmin = 85;
  let v = vmax - (vmax - vmin) * clamp(da * 4.2, 0, 1);
  if (RACE.sc) v = Math.min(v, 170); if (RACE.vsc) v = Math.min(v, 200); if (!RACE.started) v = 0;
  c._brake = da2 > da * 1.6 && da2 > 0.05; return Math.round(v);
}
function onboardHTML(c) {
  const v = onboardSpeed(c); const gear = v === 0 ? 'N' : v < 95 ? 2 : v < 130 ? 3 : v < 170 ? 4 : v < 210 ? 5 : v < 250 ? 6 : v < 290 ? 7 : 8;
  const brake = c._brake && v > 0; const thr = brake ? 0 : v > 0 ? clamp(40 + v / 4, 0, 100) : 0;
  const ord = RACE.order(); const pos = ord.indexOf(c) + 1; const ahead = ord[pos - 2];
  const drs = G.year >= 2011 && RACE.started && !RACE.sc && !RACE.vsc && ahead && !ahead.out && (ahead.dist - c.dist) / (RACE.L / c.curLT) < 1 && !brake && v > 250 && c.laps >= 2;
  const stints = (c.stints || []).map((s, i) => { const end = c.stints[i + 1] ? c.stints[i + 1].from : c.laps; return `<span style="background:${TYRES[s.tyre].col};color:#000;padding:0 5px;border-radius:4px;font-size:11px;font-weight:700">${s.tyre} ${end - s.from}</span>`; }).join(' ');
  return `<div class="row"><b style="color:${c.t.color}">P${pos}</b><b class="sp">🎯 ${esc(c.d.name)}</b>${tyreB(c.tyre)}</div>
  <div class="obrow"><div class="obspeed"><b>${v}</b><span>km/h</span></div><div class="obgear">${gear}</div><div class="obbars"><div><span>THR</span><i style="width:${thr}%;background:#2ecc71"></i></div><div><span>BRK</span><i style="width:${brake ? 100 : 0}%;background:#ff3b3b"></i></div>${ersOn(G) ? `<div><span>ERS</span><i style="width:${c.battery || 0}%;background:#f5c518"></i></div>` : ''}</div>${drs ? '<div class="drs">DRS</div>' : ''}</div>
  <div class="small mut" style="margin-top:4px">Tyre history: ${stints} · last lap ${fmtTime(c.lastLap)}</div>`;
}

// ---------- results: podium, celebration, DOTD, fan scores ----------
const _wkResultsBase = wkResults;
wkResults = function () {
  ensureXP(G);
  const s = WK.applied.summary; const top = s.rows.slice(0, 3);
  const step = (r, h, n) => `<div class="pstep" style="--tc:${teamCol(r.team)}"><div class="pname">${flag(G.drivers[r.id] ? G.drivers[r.id].nat : '')} <b>${esc(surnameUpper(r.name).last)}</b><small>${esc(G.teams[r.team].name)}</small></div><div class="pblock" style="height:${h}px">${n}</div></div>`;
  const podium = `<div class="podium ${G.xp.settings.motion ? 'anim' : ''}">${top[1] ? step(top[1], 70, 2) : ''}${step(top[0], 100, 1)}${top[2] ? step(top[2], 50, 3) : ''}${G.xp.settings.motion ? '<div class="confetti">' + Array.from({ length: 28 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 7) * 0.3}s;background:${['#ff3b3b', '#ffd400', '#2ecc71', '#4aa3ff', '#fff'][i % 5]}"></i>`).join('') + '</div>' : ''}</div>`;
  const champ = s.clinched ? `<div class="champ-banner">🏆 ${esc(s.clinched.name.toUpperCase())} IS WORLD CHAMPION! <small>${esc(G.teams[s.clinched.team] ? G.teams[s.clinched.team].name : '')}</small></div>` : '';
  const dotd = s.dotdCands ? (WK.dotd ? `<div class="card"><h3>Driver of the Day</h3>${WK.dotd.map((x, i) => `<div class="row" style="margin:4px 0"><span class="sp">${i === 0 ? '⭐ ' : ''}${esc(dname(x.id))}</span><div class="bar" style="width:45%"><i style="width:${x.pct}%;background:${i === 0 ? '#f5c518' : '#4a5468'}"></i></div><b class="small" style="width:40px;text-align:right">${x.pct}%</b></div>`).join('')}</div>`
    : `<div class="card"><h3>Vote: Driver of the Day</h3><div class="row">${s.dotdCands.map(id => `<button data-a="xpdotd" data-v="${id}">${esc(dname(id))}</button>`).join('')}</div></div>`) : '';
  const fan = (s.pred || s.fantasy) ? `<div class="card"><h3>Fan zone</h3>${s.pred ? `<div>🎯 Predictions: <b>+${s.pred.score}</b> pts</div>` : ''}${s.fantasy ? `<div>🏁 Fantasy: <b>${s.fantasy.total >= 0 ? '+' : ''}${s.fantasy.total}</b> pts <span class="small mut">${s.fantasy.lines.map(l => `${esc(l[0])} ${l[1]}`).join(' · ')}</span></div>` : ''}${s.milestone ? `<div class="small" style="margin-top:4px">${esc(s.milestone)}</div>` : ''}</div>` : (s.milestone ? `<div class="card"><div>${esc(s.milestone)}</div></div>` : '');
  const hl = RACE && RACE.highlights && RACE.highlights.length ? `<div class="card"><h3>🎬 Highlights</h3>${RACE.highlights.map((c, i) => `<div class="row news"><span class="sp">L${c.lap} · ${esc(c.label)}</span><button class="sm" data-a="xpreplaypost" data-v="${i}">▶ Watch</button></div>`).join('')}</div>` : '';
  return champ + podium + _wkResultsBase() + `<div class="grid g2" style="margin-top:12px">${dotd}${fan}${hl}</div>`;
};

// ---------- setup screen: create-a-team, famous seasons, what-ifs ----------
const _viewSetupBase = viewSetup;
viewSetup = function () {
  let html = _viewSetupBase(); const S = SETUP;
  if (S.era === 'hist') {
    const fam = `<div class="card" style="margin-top:12px"><h3>Famous seasons</h3><div class="row">${FAMOUS.map(([y, t]) => `<button class="sm ${S.year === y && !S.whatIf ? 'on' : ''}" data-a="xpfamous" data-v="${y}" title="${esc(t)}">${y}</button>`).join('')}</div>${FAMOUS.find(f => f[0] === S.year) ? `<div class="small mut" style="margin-top:4px">${esc(FAMOUS.find(f => f[0] === S.year)[1])}</div>` : ''}
    <h3 style="margin-top:10px">What if…?</h3>${WHATIFS.map(w => `<label class="row small" style="margin:4px 0"><input type="radio" name="whatif" data-a="xpwhatif" data-v="${w.id}" ${S.whatIf === w.id ? 'checked' : ''}> <b>${esc(w.label)}</b> <span class="mut">— ${esc(w.desc)}</span></label>`).join('')}
    ${S.whatIf ? '<button class="sm" data-a="xpwhatif" data-v="">Clear what-if</button>' : ''}</div>`;
    html = html.replace('<div class="row" style="margin:16px 0 40px">', fam + '<div class="row" style="margin:16px 0 40px">');
  } else if (S.mode !== 'spectator') {
    const engs = Object.entries(ENGINES);
    const ct = `<div class="card" style="margin-top:12px"><label class="row"><input type="checkbox" data-a="xpcustomteam" ${S.custom ? 'checked' : ''}> <b>Create your own team</b> <span class="small mut">— join the grid as a new 12th team</span></label>
    ${S.custom ? `<div class="grid g2" style="margin-top:8px"><label class="small">Team name<input id="ct_name" value="${esc(S.custom.name)}" style="width:100%"></label><label class="small">Colour<input id="ct_col" type="color" value="${S.custom.color}" style="width:100%;height:38px"></label>
    <label class="small">Engine supplier<select id="ct_eng" style="width:100%">${engs.map(([k, e]) => `<option value="${k}" ${S.custom.engine === k ? 'selected' : ''}>${e.name}</option>`).join('')}</select></label><div class="small mut">You start with a $120M budget, a car around the back of the grid, and the two best available free agents.</div></div>` : ''}</div>`;
    html = html.replace('<div class="row" style="margin:16px 0 40px">', ct + '<div class="row" style="margin:16px 0 40px">');
    if (S.custom) html = html.replace('data-a="startgame" disabled', 'data-a="startgame"');
  }
  return html;
};
const _newGameBase = newGame;
newGame = function (opts) {
  const G2 = _newGameBase(opts);
  if (opts.customTeam) {
    const c = opts.customTeam; const id = 'myteam';
    G2.teams[id] = { id, name: c.name, full: c.name + ' F1 Team', color: c.color, engine: c.engine, works: false, aero: 74, chassis: 74, rel: 78, money: 120, sponsor: 5, dev: 1, pts: 0, spent: 0, drivers: [] };
    G2.player = id;
    const fa = Object.values(G2.drivers).filter(d => !d.team).sort((a, b) => overall(b) - overall(a)).slice(0, 2);
    fa.forEach(d => { d.team = id; d.until = G2.year + 1; d.salary = askingSalary(d); });
    G2.news = []; news(G2, `🆕 ${c.name} joins the grid! ${fa.map(d => d.name).join(' and ')} will drive.`);
  }
  if (opts.whatIf) G2.whatIf = opts.whatIf;
  ensureXP(G2);
  return G2;
};
const _newTimelineBase = newTimelineGame;
newTimelineGame = function (opts) {
  PENDING_WHATIF = opts.whatIf || null;
  const real = _newTimelineBase(opts);
  PENDING_WHATIF = null;
  if (opts.whatIf) real.whatIf = opts.whatIf;
  if (!real.spectator && !real.teams[real.player]) real.player = Object.keys(real.teams)[0];
  ensureXP(real);
  return real;
};

// ---------- menu: settings for sound, camera, accessibility ----------
const _hqMenuBase = hqMenu;
hqMenu = function () {
  ensureXP(G); const S = G.xp.settings;
  return _hqMenuBase() + `<div class="card" style="margin-top:12px"><h3>Sound & view</h3>
  <label class="row"><input type="checkbox" data-a="xpset" data-v="sound" ${S.sound ? 'checked' : ''}> Sound (engine, start lights, pit stops, crowd)</label>
  <div class="row"><span class="small mut">Volume</span><input type="range" id="xpvol" min="0" max="100" value="${Math.round(S.volume * 100)}"></div>
  <div class="row" style="margin-top:6px"><span class="small mut">Default race camera</span>${[['track', 'Full track'], ['director', 'Director'], ['onboard', 'Onboard']].map(([k, v]) => `<button class="sm ${S.cam === k ? 'on' : ''}" data-a="xpsetcam" data-v="${k}">${v}</button>`).join('')}</div>
  <h3 style="margin-top:12px">Accessibility</h3>
  <div class="row"><span class="small mut">Text size</span>${[['s', 'Small'], ['m', 'Normal'], ['l', 'Large'], ['xl', 'Extra large']].map(([k, v]) => `<button class="sm ${S.text === k ? 'on' : ''}" data-a="xptext" data-v="${k}">${v}</button>`).join('')}</div>
  <label class="row"><input type="checkbox" data-a="xpset" data-v="motion" ${S.motion ? 'checked' : ''}> Animations (confetti, light effects)</label>
  <label class="row"><input type="checkbox" data-a="xpset" data-v="contrast" ${S.contrast ? 'checked' : ''}> High contrast</label>
  <div class="small mut">Tyres always show a letter as well as a colour.</div></div>`;
};

// ---------- actions ----------
Object.assign(A, {
  xpjob(el) { G.player = el.dataset.v; G.xp.sacked = false; G.xp.board = null; xpNewSeasonBusiness(G, true); G.xp.sponsors = { offers: [], active: [] }; xpSponsorOffers(G); news(G, `🤝 You are the new team principal of ${G.teams[G.player].full}.`); autosave(); render(); },
  xpretire() { hofAdd({ y: G.year, team: G.teams[G.player].name, pos: G.xp.lastPos || 0, mode: G.timeline ? 'timeline' : 'modern', retired: true }); G.xp.sacked = false; toast('Career over — see you in the Hall of Fame'); try { localStorage.removeItem('f1mgr_save'); } catch (e) { } G = null; VIEW = 'title'; render(); },
  xppart(el) {
    const me = G.teams[G.player], s = RD_SIZES[el.dataset.size], part = XP_PARTS[el.dataset.p]; const fac = facLevel(G, 'factory');
    const cost = +(s.cost * (1 - 0.04 * (fac - 1))).toFixed(1), races = Math.max(1, s.races - Math.floor((fac - 1) / 2));
    if (G.projects.length >= 3 || me.spent + cost > capFor(G) || me.money < cost) return toast('Not possible right now');
    me.money -= cost; me.spent += cost; G.projects.push({ area: part.area, part: el.dataset.p, size: el.dataset.size, left: races });
    toast(`${s.name} ${part.name} project started`); autosave(); render();
  },
  xphire(el) { const X = G.xp; const s = X.staffMarket[+el.dataset.v]; if (!s) return; const old = X.staff[s.role]; G.teams[G.player].money -= old.salary * 0.5; X.staff[s.role] = s; X.staffMarket.splice(+el.dataset.v, 1); news(G, `👔 ${s.name} joins as ${XP_ROLES[s.role].name}.`); autosave(); render(); },
  xpfac(el) { const k = el.dataset.v, X = G.xp, me = G.teams[G.player]; const c = facCost(X.fac[k]); if (me.money < c || X.building.some(b => b.key === k)) return; me.money -= c; X.building.push({ key: k, left: 4 }); toast(`${XP_FAC[k].name} upgrade started`); autosave(); render(); },
  xpdrill() { const X = G.xp, me = G.teams[G.player]; me.money -= 0.4; X.staff.crew.rating = Math.min(60 + X.fac.crew * 8, X.staff.crew.rating + 1); X.drillRound = G.round; toast('Pit crew drilled: +1'); autosave(); render(); },
  xpacademy(el) { const X = G.xp; if (X.academy.length >= 2) return; X.academy.push(el.dataset.v); G.teams[G.player].money -= 1; news(G, `🎓 ${dname(el.dataset.v)} joins the ${G.teams[G.player].name} junior academy.`); autosave(); render(); },
  xprelease(el) { G.xp.academy = G.xp.academy.filter(id => id !== el.dataset.v); autosave(); render(); },
  xppromote(el) { G.xp.academy = G.xp.academy.filter(id => id !== el.dataset.v); TAB = 'drivers'; render(); openDriver(el.dataset.v); },
  xpsponsor(el) { const X = G.xp; const s = X.sponsors.offers[+el.dataset.v]; if (!s || X.sponsors.active.length >= 2) return; X.sponsors.active.push(s); X.sponsors.offers.splice(+el.dataset.v, 1); news(G, `🤝 ${s.name} signs a sponsorship deal with ${G.teams[G.player].name}.`); autosave(); render(); },
  xpnewpu(el) { const pr = puRules(G); const st = puState(G, el.dataset.v); st.units++; st.wear = 0; (WK.newPU = WK.newPU || {})[el.dataset.v] = true; if (st.units > pr.limit) { const e = WK.entries.find(x => x.d.id === el.dataset.v); applyGridPenalty(e, 10, 'new power unit'); } autosave(); render(); },
  xpcam(el) { CAM.mode = el.dataset.v; document.querySelectorAll('.camsel button').forEach(b => b.classList.toggle('on', b.dataset.v === CAM.mode)); },
  xpfeed(el) { SUB.feed = (SUB.feed || (G.spectator ? 'comm' : 'rc')) === 'comm' ? 'rc' : 'comm'; const b = el; if (b) b.textContent = SUB.feed === 'comm' ? 'Race control' : 'Commentary'; updateRaceUI(); },
  xpradio(el) { radioAction(RACE, el.dataset.v, el.dataset.act); updateRaceUI(); },
  xporder(el) { if (el.dataset.v === 'swap') { const r = teamOrderSwap(RACE); if (r && r !== 'ok' && r !== 'ignored') toast(r); } else RACE.teamOrder = el.dataset.v; updateRaceUI(); },
  xpers(el) { const c = RACE.cars.find(x => x.d.id === el.dataset.d); if (c) { c.ers = el.dataset.v; c.curLT = RACE.lapTime(c, c.laps); } updateRaceUI(); },
  xpreplay(el) { const clip = RACE.highlights[+el.dataset.v]; if (!clip) return; window._wasPaused = PAUSED; PAUSED = true; REPLAY = { clip, start: performance.now() }; const rb = document.getElementById('replaybadge'); if (rb) rb.innerHTML = `<span>⟲ REPLAY · ${esc(clip.label)}</span><button class="sm" data-a="xpreplaystop">Back to live</button>`; window.scrollTo(0, 0); },
  xpreplaystop() { stopReplay(); },
  xpreplaypost(el) {
    const clip = RACE.highlights[+el.dataset.v]; if (!clip) return;
    modal(`<div class="row"><h2 class="sp">🎬 ${esc(clip.label)}</h2><button class="sm" data-a="xpreplayclose">✕</button></div><div class="cvbox"><canvas id="cv"></canvas><div class="replaybadge" id="replaybadge"><span>⟲ REPLAY</span></div></div>`);
    sizeCanvas(); REPLAY = { clip, start: performance.now() }; const loop = () => { if (!REPLAY || !document.getElementById('cv')) return; drawRace(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  },
  xpreplayclose() { REPLAY = null; closeModal(); },
  xpdotd(el) { const s = WK.applied.summary; const c = s.dotdCands; const w = c.map(id => { const r = s.rows.find(x => x.id === id); return { id, w: Math.max(1, (r.grid - r.pos) * 2 + (r.pos === 1 ? 6 : 0) + rnd(0, 6) + (id === el.dataset.v ? 6 : 0)) }; }); const tot = w.reduce((a, x) => a + x.w, 0); WK.dotd = w.map(x => ({ id: x.id, pct: Math.round(x.w / tot * 100) })).sort((a, b) => b.pct - a.pct); G.xp.fan.dotd[WK.dotd[0].id] = (G.xp.fan.dotd[WK.dotd[0].id] || 0) + 1; autosave(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  xpfd(el) { const T = G.xp.fan.fantasy; const id = el.dataset.v; const P = fantasyPrices(G); const i = T.drivers.indexOf(id);
    if (i >= 0) { T.drivers.splice(i, 1); } else { if (T.drivers.length >= 5) return toast('5 drivers max — remove one first'); const spent = T.drivers.reduce((s, x) => s + (P.drivers[x] || 0), 0) + (T.team ? P.teams[T.team] : 0); if (spent + P.drivers[id] > T.budget) return toast('Over budget'); T.drivers.push(id); if (T.freeTransfers < 99) { if (T.freeTransfers > 0) T.freeTransfers--; else T.pendingPenalty = (T.pendingPenalty || 0) + 4; } }
    autosave(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  xpft(el) { const T = G.xp.fan.fantasy; const P = fantasyPrices(G); const spent = T.drivers.reduce((s, x) => s + (P.drivers[x] || 0), 0); if (T.team !== el.dataset.v && spent + P.teams[el.dataset.v] > T.budget) return toast('Over budget'); T.team = T.team === el.dataset.v ? null : el.dataset.v; autosave(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  xpfamous(el) { SETUP.year = +el.dataset.v; SETUP.team = null; SETUP.follow = null; SETUP.whatIf = null; render(); },
  xpwhatif(el) { SETUP.whatIf = el.dataset.v || null; const w = WHATIFS.find(x => x.id === SETUP.whatIf); if (w) { SETUP.year = w.start; SETUP.team = null; SETUP.follow = null; } render(); },
  xpcustomteam(el) { SETUP.custom = el.checked ? { name: 'Lion City Racing', color: '#E4002B', engine: 'MER' } : null; render(); },
  xpset(el) { G.xp.settings[el.dataset.v] = el.checked; applyAccessibility(G); if (el.dataset.v === 'sound' && el.checked) SND.unlock(); autosave(); },
  xpsetcam(el) { G.xp.settings.cam = el.dataset.v; CAM.mode = el.dataset.v; autosave(); render(); },
  xptext(el) { G.xp.settings.text = el.dataset.v; applyAccessibility(G); autosave(); render(); }
});
// wrap the start-game action so new options reach the game
const _startraceBase = A.startrace;
A.startrace = function (q) { if (WK && WK.stage === 'grid') puPreRace(G, WK); return _startraceBase(q); };
const _startgame = A.startgame;
A.startgame = function () {
  if (SETUP.custom) { const n = document.getElementById('ct_name'), c = document.getElementById('ct_col'), e = document.getElementById('ct_eng'); if (n) SETUP.custom = { name: n.value.trim() || 'My Team', color: c.value, engine: e.value }; SETUP.team = SETUP.team || 'mer'; }
  if (SETUP.era === 'hist') {
    if (SETUP.mode !== 'spectator' && !SETUP.team) return;
    G = newTimelineGame({ year: SETUP.year, team: SETUP.team, spectator: SETUP.mode === 'spectator', follow: SETUP.mode === 'spectator' ? SETUP.follow : null, difficulty: SETUP.difficulty, whatIf: SETUP.whatIf });
    VIEW = 'hq'; TAB = 'home'; autosave(); render(); window.scrollTo(0, 0); return;
  }
  if (SETUP.cal.length < 3) return toast('Pick at least 3 races');
  G = newGame({ team: SETUP.team, difficulty: SETUP.difficulty, cal: SETUP.cal, sprints: SETUP.sprints.filter(id => SETUP.cal.includes(id)), spectator: SETUP.mode === 'spectator', follow: SETUP.mode === 'spectator' ? SETUP.follow : null, customTeam: SETUP.mode !== 'spectator' ? SETUP.custom : null });
  VIEW = 'hq'; TAB = 'home'; autosave(); render(); window.scrollTo(0, 0);
};
// inputs that aren't buttons
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.setup) { const [did, k] = t.dataset.setup.split(':'); WK.setupCur[did][k] = +t.value; t.nextElementSibling && (t.nextElementSibling.textContent = t.value); }
  if (t.id === 'xpfocus') { G.xp.focus = +t.value; const v = document.getElementById('xpfocusv'); if (v) v.textContent = t.value + '%'; autosave(); }
  if (t.id === 'xpvol') { G.xp.settings.volume = +t.value / 100; autosave(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.pred) { const P = G.xp.fan.preds[predKey()]; const [f, i] = t.dataset.pred.split(':'); if (i != null) { P.mine.podium = P.mine.podium || []; P.mine.podium[+i] = t.value || null; } else P.mine[f] = t.value || null; autosave(); }
});
document.addEventListener('click', () => SND.unlock(), { once: false, capture: true });
