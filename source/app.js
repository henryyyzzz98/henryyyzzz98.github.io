// ===== UI =====
let G = null, VIEW = 'title', TAB = 'home', WK = null, RACE = null, SETUP = null, CALED = null, SUB = {}, raf = null;
const $app = () => document.getElementById('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const flag = cc => FLAGS[cc] || (cc && /^[A-Z]{2}$/.test(cc) && cc !== 'XX' ? String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0))) : '🏁');
const teamCol = tid => (G && G.teams[tid] ? G.teams[tid].color : '#888');
const tbar = tid => `<span class="tbar" style="background:${teamCol(tid)}"></span>`;
const tyreB = t => `<span class="tyre" style="border-color:${TYRES[t].col};color:${TYRES[t].col}">${t}</span>`;
function toast(s) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = s; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); }
function modal(html) { closeModal(); const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = `<div class="card">${html}</div>`; m.addEventListener('click', e => { if (e.target === m) closeModal(); }); document.body.appendChild(m); }
function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
function autosave() { if (G) save(G); }
function fixSave(g) { if (!g) return; mergeLib(g.trackLib); g.sprints = g.sprints || []; if (g.spectator === undefined) g.spectator = false; }
function trackSVG(t, w = 120, col = '#fff') {
  const g = trackGeometry(t); const pts = g.P.filter((_, i) => i % 3 === 0).map(p => (p[0] * (w - 10) + 5).toFixed(1) + ',' + (p[1] * (w - 10) + 5).toFixed(1)).join(' ');
  return `<svg width="${w}" height="${w}" viewBox="0 0 ${w} ${w}"><polygon points="${pts}" fill="none" stroke="${col}" stroke-width="${w > 80 ? 3 : 2}" stroke-linejoin="round"/></svg>`;
}
function statBar(label, v, max = 100, min = 60, col) { const p = clamp((v - min) / (max - min), 0, 1) * 100; return `<div class="stat"><span class="mut">${label}</span><div class="bar"><i style="width:${p}%;background:${col || 'var(--good)'}"></i></div><b>${v.toFixed(1)}</b></div>`; }

// ---------- Render root ----------
function render() {
  cancelAnimationFrame(raf);
  const app = $app();
  if (G) document.documentElement.style.setProperty('--tc', G.player && G.teams[G.player] ? G.teams[G.player].color : '#e10600');
  if (VIEW === 'title') app.innerHTML = viewTitle();
  else if (VIEW === 'setup') { app.innerHTML = viewSetup(); const yr = document.getElementById('yr'); if (yr) yr.addEventListener('change', () => { SETUP.year = +yr.value; SETUP.team = null; SETUP.follow = null; render(); }); }
  else if (VIEW === 'caled') app.innerHTML = viewCalEditor();
  else if (VIEW === 'hq') app.innerHTML = topBar() + `<div class="wrap">${viewHQ()}</div>`;
  else if (VIEW === 'weekend') { app.innerHTML = topBar(true) + `<div class="wrap">${viewWeekend()}</div>`; const on = document.querySelector('.steps .on'); if (on && on.scrollIntoView) on.parentElement.scrollLeft = on.offsetLeft - 40; if (WK.stage === 'race' || WK.stage === 'sprint') startRaceLoop(); }
  else if (VIEW === 'studio') app.innerHTML = viewStudio();
  else if (VIEW === 'tracer') { app.innerHTML = viewTracer(); initTracer(); }
  else if (VIEW === 'season') app.innerHTML = topBar(true) + `<div class="wrap">${viewSeasonEnd()}</div>`;
  window.scrollTo && VIEW !== 'weekend' && 0;
}
function topBar(noTabs) {
  const me = G.teams[G.player]; const total = G.cal.length;
  if (!G.spectator && !me) return `<div class="top"><div class="topbar"><span class="logo">PIT<b>WALL</b></span><span class="chip">${G.year} · choose your team</span><span class="chip">💰 ${fmtM(G.bank || 0)}</span></div></div>`;
  const tabs = G.spectator ? ['home', 'calendar', 'standings', 'drivers', 'menu'] : ['home', 'calendar', 'standings', 'car', 'drivers', 'finance', 'menu'];
  if (G.spectator) { const fav = G.follow && G.drivers[G.follow];
    return `<div class="top"><div class="topbar"><span class="logo">PIT<b>WALL</b></span><span class="chip">👀 Spectator</span><span class="chip">${G.year} · R${Math.min(G.round + 1, total)}/${total}</span>${fav ? `<span class="chip">⭐ ${esc(fav.name)}</span>` : ''}</div>
    ${noTabs ? '' : `<div class="tabs">${tabs.map(t => `<button data-a="tab" data-v="${t}" class="${TAB === t ? 'on' : ''}">${({ home: '🏠 Home', calendar: '📅 Calendar', standings: '🏆 Standings', drivers: '👤 Grid', menu: '☰ Menu' })[t]}</button>`).join('')}</div>`}</div>`; }
  const names = { home: '🏠 Home', calendar: '📅 Calendar', standings: '🏆 Standings', car: '🔧 Car & R&D', drivers: '👤 Drivers', finance: '💰 Finance', menu: '☰ Menu' };
  return `<div class="top"><div class="topbar"><span class="logo">PIT<b>WALL</b></span>
  <span class="chip">${tbar(me.id)}${esc(me.name)}</span><span class="chip">${G.year} · R${Math.min(G.round + 1, total)}/${total}</span>
  <span class="chip">💰 ${fmtM(me.money)}</span>${capFor(G) === Infinity ? '<span class="chip">No cost cap</span>' : `<span class="chip">Cap ${fmtM(COST_CAP - me.spent)} left</span>`}</div>
  ${noTabs ? '' : `<div class="tabs">${tabs.map(t => `<button data-a="tab" data-v="${t}" class="${TAB === t ? 'on' : ''}">${names[t]}</button>`).join('')}</div>`}</div>`;
}

// ---------- Title ----------
function viewTitle() {
  const has = loadSave();
  return `<div class="title-screen"><div class="logo">PIT<b>WALL</b></div><div class="mut" style="margin-top:-12px">F1 Team Manager</div>
  <div class="row" style="justify-content:center"><button class="pri" data-a="newgame">🏎️ Manager career</button><button class="pri" data-a="newspec" style="background:#222;border-color:#555">👀 Spectator season</button><button class="pri" data-a="newhist" style="background:#3a2a10;border-color:#a8822e">🕰️ Historic timeline 1950–</button>
  ${has ? `<button data-a="continue">Continue (${has.year} · ${has.spectator ? 'Spectator' : has.player && has.teams[has.player] ? esc(has.teams[has.player].name) : 'choose team'})</button>` : ''}
  <button data-a="importui">Import save code</button><button data-a="studio">✏️ Track Studio</button></div>
  <div class="mut small" style="max-width:460px">Run a real 2026 F1 team — or just sit back in Spectator mode and enjoy the show. Race on tracks from today back to the 1950s, sprint weekends included, and trace your own circuit layouts from images.</div></div>`;
}

// ---------- Setup ----------
function viewSetup() {
  const S = SETUP;
  const presets = { off: '2026 official calendar (24 races, 6 sprints)', classic: 'Classic mix — random historic tracks', all: 'Grand tour — current + classics', custom: 'Custom calendar…' };
  const calCard = `<div class="card"><h3>Calendar</h3>${Object.entries(presets).map(([k, v]) => `<label class="row" style="margin:4px 0"><input type="radio" name="cal" data-a="calpreset" data-v="${k}" ${S.preset === k ? 'checked' : ''}> ${v}</label>`).join('')}
  <div class="small mut">${S.cal.length} races, ${S.sprints.length} sprint${S.sprints.length === 1 ? '' : 's'}: ${S.cal.slice(0, 10).map(id => flag(TRACK_BY_ID[id].cc) + (S.sprints.includes(id) ? '⚡' : '')).join(' ')}${S.cal.length > 10 ? ' …' : ''}</div>
  <button class="sm" style="margin-top:6px" data-a="calpreset" data-v="custom">Edit calendar & sprints…</button></div>`;
  const modeRow = `<div class="row" style="margin:10px 0">${[['manager', '🏎️ Manager'], ['spectator', '👀 Spectator']].map(([k, v]) => `<button data-a="setmode" data-v="${k}" class="${S.mode === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
  const H = S.era === 'hist' ? HIST.years[S.year] : null;
  const eraRow = `<div class="card" style="margin-bottom:12px"><h3>Era</h3><div class="row">${[['modern', '🏁 2026 season'], ['hist', '🕰️ Historic timeline']].map(([k, v]) => `<button data-a="setera" data-v="${k}" class="${S.era === k ? 'on' : ''}">${v}</button>`).join('')}</div>
  ${H ? `<div class="row" style="margin-top:10px"><button class="sm" data-a="yearstep" data-v="-10">−10</button><button class="sm" data-a="yearstep" data-v="-1">−1</button><b style="font-size:28px;min-width:80px;text-align:center">${S.year}</b><button class="sm" data-a="yearstep" data-v="1">+1</button><button class="sm" data-a="yearstep" data-v="10">+10</button></div>
  <input type="range" id="yr" min="${HIST_FIRST}" max="${HIST_LAST}" value="${S.year}" style="width:100%;margin-top:6px">
  <div class="small" style="margin-top:4px">${H.cal.length} races · ${H.teams.length} teams · ${H.drivers.length} cars · real champion: <b>${esc(histDriverName(H.champ) || '—')}</b>${H.cchamp ? ` · constructors: ${esc(H.cchamp)}` : ''}</div>
  <div class="small mut" style="margin-top:4px">Real teams, drivers, calendars, lap times and points rules from that year. Each new season loads the real line-ups of the next year, so you can play through every season to ${HIST_LAST} and beyond.</div>` : '<div class="small mut" style="margin-top:6px">The current 2026 grid with hand-tuned ratings, editable calendars and full driver contracts.</div>'}</div>`;
  let main;
  if (S.mode === 'spectator' && H) {
    const byTeam = H.teams.map(t => `<div style="margin:6px 0"><div class="small" style="color:${HIST.teams[t[0]][1]};font-weight:700">${esc(HIST.teams[t[0]][0])}</div><div class="row">${H.drivers.filter(r => r[1] === t[0]).map(r => { const D = HIST.drivers[r[0]]; return `<button class="sm ${S.follow === D[0] ? 'on' : ''}" data-a="pickfav" data-v="${D[0]}">${flag(D[3])} ${esc(D[1])}</button>`; }).join('')}</div></div>`).join('');
    main = `<div class="card"><h3>Pick a favourite driver (optional)</h3>${byTeam}</div>`;
  } else if (H) {
    const teams = H.teams.map(([cid, full, eng, works, car, rel, cars]) => `<div class="teamcard ${S.team === cid ? 'sel' : ''}" data-a="pickteam" data-v="${cid}"><div class="stripe" style="background:${HIST.teams[cid][1]}"></div>
      <b>${esc(HIST.teams[cid][0])}</b><div class="small mut">${H.drivers.filter(r => r[1] === cid).map(r => esc(HIST.drivers[r[0]][1].split(' ').slice(-1)[0])).join(' / ')}</div>
      <div class="small">Car ${car.toFixed(1)} · ${esc(eng)} · reliability ${rel.toFixed(0)}</div><div class="small mut">${cars} car${cars > 1 ? 's' : ''}</div></div>`).join('');
    main = `<h2 style="margin-top:6px">Choose your team</h2><div class="grid g3">${teams}</div>
    <div class="card" style="margin-top:14px"><h3>Difficulty</h3><div class="row">${['easy', 'normal', 'hard'].map(d => `<button data-a="diff" data-v="${d}" class="${S.difficulty === d ? 'on' : ''}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div></div>`;
  } else if (S.mode === 'spectator') {
    const drivers = TEAMS_2026.map(t => `<div style="margin:6px 0"><div class="small" style="color:${t.color};font-weight:700">${t.name}</div><div class="row">${t.drivers.map(id => { const d = DRIVERS_2026.find(x => x.id === id); return `<button class="sm ${S.follow === id ? 'on' : ''}" data-a="pickfav" data-v="${id}">${flag(d.nat)} ${esc(d.name)}</button>`; }).join('')}</div></div>`).join('');
    main = `<div class="card"><h3>Pick a favourite driver (optional)</h3><div class="small mut" style="margin-bottom:6px">They're highlighted on track and in the timing tower, and the race pauses for their big moments. You can switch any time by tapping a name in the timing tower.</div>${drivers}</div>
    <div class="grid g2" style="margin-top:14px">${calCard}<div class="card"><h3>How it works</h3><div class="small">No budgets, no contracts — the AI runs all 11 teams. You watch practice, qualifying, sprints and races, and in race control you can throw in some chaos: make it rain, call a safety car, or trigger an incident.</div></div></div>`;
  } else {
    const teams = TEAMS_2026.map(t => {
      const avg = (t.aero + t.chassis + ENGINES[t.engine].power) / 3;
      const ds = t.drivers.map(id => DRIVERS_2026.find(d => d.id === id).name.split(' ').slice(-1)[0]).join(' / ');
      return `<div class="teamcard ${S.team === t.id ? 'sel' : ''}" style="--tc:${t.color}" data-a="pickteam" data-v="${t.id}"><div class="stripe" style="background:${t.color}"></div>
      <b>${t.name}</b><div class="small mut">${ds}</div><div class="small">Car ${avg.toFixed(1)} · ${ENGINES[t.engine].name}${t.works ? ' (works)' : ''}</div><div class="small mut">Budget ${fmtM(t.money)}</div></div>`;
    }).join('');
    main = `<h2 style="margin-top:6px">Choose your team</h2><div class="grid g3">${teams}</div>
    <div class="grid g2" style="margin-top:14px"><div class="card"><h3>Difficulty</h3><div class="row">${['easy', 'normal', 'hard'].map(d => `<button data-a="diff" data-v="${d}" class="${S.difficulty === d ? 'on' : ''}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div>
    <div class="small mut" style="margin-top:6px">Controls how fast rival teams develop their cars.</div></div>${calCard}</div>`;
  }
  const ok = S.mode === 'spectator' || S.team;
  const hideCal = !!H;
  return `<div class="wrap"><div class="row"><span class="logo">PIT<b>WALL</b></span><span class="sp"></span><button data-a="totitle">Back</button></div>
  ${modeRow}${eraRow}${main}
  <div class="row" style="margin:16px 0 40px"><span class="sp"></span><button class="pri" data-a="startgame" ${ok ? '' : 'disabled'}>${S.mode === 'spectator' ? 'Start watching →' : 'Start career →'}</button></div></div>`;
}
function presetCal(k) {
  const hist = TRACKS.filter(t => t.era !== 'current').map(t => t.id);
  if (k === 'off') { SETUP.sprints = SPRINT_2026.slice(); return CAL_2026.slice(); }
  SETUP.sprints = [];
  if (k === 'classic') return hist.sort(() => Math.random() - 0.5).slice(0, 18);
  if (k === 'all') { const c = CAL_2026.slice().sort(() => Math.random() - 0.5).slice(0, 14).concat(hist.sort(() => Math.random() - 0.5).slice(0, 10)); return c.sort(() => Math.random() - 0.5); }
  return SETUP.cal;
}

// ---------- Calendar editor ----------
function viewCalEditor() {
  const C = CALED;
  const inCal = new Set(C.cal);
  const filt = C.filter || 'all';
  const list = TRACKS.filter(t => filt === 'all' || (filt === 'cur' ? t.era === 'current' : filt === 'custom' ? t.era === 'custom' : (t.era !== 'current' && t.era !== 'custom')));
  return `<div class="wrap"><div class="row"><h2 style="margin:0">Edit calendar — ${esc(C.title)}</h2><span class="sp"></span><button data-a="caldone" class="pri">Done (${C.cal.length})</button></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><h3>Season order (${C.cal.length} races · ${C.sprints.length} sprints)</h3><div class="small mut" style="margin-bottom:4px">Tap ⚡ to make a round a sprint weekend.</div><div class="list-scroll">
  ${C.cal.map((id, i) => { const t = TRACK_BY_ID[id]; const sp = C.sprints.includes(id); return `<div class="cal-item"><b style="width:22px">${i + 1}</b>${flag(t.cc)} <span class="sp">${esc(t.short)} <span class="mut small">${esc(t.name)}</span></span>
  <button class="sm ${sp ? 'on' : ''}" data-a="calsprint" data-v="${id}" title="Sprint weekend">⚡</button><button class="sm" data-a="calmv" data-v="${i}" data-d="-1">▲</button><button class="sm" data-a="calmv" data-v="${i}" data-d="1">▼</button><button class="sm" data-a="caltog" data-v="${id}">✕</button></div>`; }).join('')}
  </div><div class="row" style="margin-top:8px"><button class="sm" data-a="calshuf">Shuffle</button><button class="sm" data-a="calreset">2026 official</button><button class="sm" data-a="calclear">Clear</button></div></div>
  <div class="card"><div class="row" style="margin-bottom:6px"><h3 class="sp" style="margin:0">All circuits</h3><button class="sm" data-a="newcircuit" data-back="caled">+ New circuit</button></div><div class="row" style="margin-bottom:6px">${[['all', 'All'], ['cur', '2026'], ['hist', 'Historic'], ['custom', 'Custom']].map(([k, v]) => `<button class="sm ${filt === k ? 'on' : ''}" data-a="calfilt" data-v="${k}">${v}</button>`).join('')}</div>
  <div class="list-scroll">${list.map(t => `<div class="cal-item">${trackSVG(t, 34)} ${flag(t.cc)} <span class="sp"><b>${esc(t.short)}</b> <span class="mut small">${esc(t.name)} · ${t.laps} laps · ${t.era === 'current' ? '2026' : t.era}${LIB.layouts[t.id] ? ' · traced' : ''}</span></span>
  <button class="sm" data-a="laps" data-v="${t.id}">🔁</button><button class="sm" data-a="trace" data-v="${t.id}" data-back="caled">✏️</button><button class="sm ${inCal.has(t.id) ? 'on' : ''}" data-a="caltog" data-v="${t.id}">${inCal.has(t.id) ? '✓ In' : '+ Add'}</button></div>`).join('') || '<div class="mut small">No circuits here yet.</div>'}</div></div></div></div>`;
}

// ---------- HQ ----------
function viewHQ() {
  return ({ home: hqHome, calendar: hqCalendar, standings: hqStandings, car: hqCar, drivers: hqDrivers, finance: hqFinance, menu: hqMenu })[TAB]();
}
function seatsOK() { return teamDrivers(G, G.player).length >= Math.min(2, G.teams[G.player].cars || 2); }
function pickTeamView() {
  const ts = Object.values(G.teams).sort((a, b) => b.aero - a.aero);
  return `<div class="banner">Your team didn't enter the ${G.year} championship. Pick a new team to manage — your bank balance (${fmtM(G.bank || 0)}) comes with you.</div>
  <div class="grid g3">${ts.map(t => `<div class="teamcard" data-a="pickhistteam" data-v="${t.id}"><div class="stripe" style="background:${t.color}"></div><b>${esc(t.name)}</b><div class="small mut">${teamDrivers(G, t.id).map(d => esc(d.name.split(' ').slice(-1)[0])).join(' / ')}</div><div class="small">Car ${t.aero.toFixed(1)} · ${esc(G.engines[t.engine].name)}</div></div>`).join('')}</div>`;
}
function hqHome() {
  if (G.needTeam) return pickTeamView();
  const me = G.teams[G.player]; const seasonOver = G.round >= G.cal.length;
  const t = seasonOver ? null : roundTrack(G, G.round);
  if (G.spectator) return specHome(seasonOver, t);
  const ds = teamDrivers(G, G.player);
  const rank = teamRank(G, G.player);
  let next = '';
  if (seasonOver) next = `<div class="card hl"><h3>Season complete</h3><button class="pri" data-a="endseason">Season review →</button></div>`;
  else next = `<div class="card hl"><h3>Next race · Round ${G.round + 1} of ${G.cal.length}</h3><div class="row">${trackSVG(t, 110)}<div class="sp"><div class="big">${flag(t.cc)} ${esc(t.short)} GP</div>
    <div class="mut">${esc(t.name)}${G.timeline ? ` · <span class="mut">${t.date || ''}</span>` : t.era !== 'current' ? ` · <span class="warn">${t.era === 'custom' ? 'custom circuit' : 'classic (' + t.era + ')'}</span>` : ''}</div>${isSprintRound(G, G.round) ? '<div class="pill" style="background:#f5c518;color:#000;margin:3px 0">⚡ SPRINT WEEKEND</div>' : ''}<div class="small">${t.laps} laps · ${t.km.toFixed(3)} km · ${(t.laps * t.km).toFixed(0)} km</div>
    <div class="small mut">Overtaking ${lvl(t.ot)} · Downforce ${lvl(t.df)} · Power ${lvl(t.pw)} · Tyre wear ${lvl(t.wear)} · Rain ${Math.round(t.rain * 100)}%</div></div></div>
    ${seatsOK() ? `<button class="pri" style="margin-top:10px;width:100%" data-a="gowk">Go to race weekend →</button>` : `<div class="banner" style="margin-top:10px">You need two race drivers. Sign one in the Drivers tab.</div>`}</div>`;
  const dcards = ds.map(d => `<div class="row" style="margin:6px 0"><b style="width:30px;color:${me.color}">#${d.num}</b><span class="sp">${flag(d.nat)} ${esc(d.name)} <span class="mut small">OVR ${overall(d).toFixed(1)}</span></span><span>${d.pts} pts · P${standingsDrivers(G).indexOf(d) + 1}</span></div>`).join('');
  const sd = standingsDrivers(G).slice(0, 5), st = standingsTeams(G).slice(0, 5);
  return `${G.round === 0 && !seatsOK() ? '<div class="banner">Off-season: fill both race seats before Round 1.</div>' : ''}
  <div class="grid g2">${next}
  <div class="card"><h3>${esc(me.full)}</h3><div class="row"><div><div class="big">P${rank}</div><div class="mut small">Constructors</div></div><div><div class="big">${me.pts}</div><div class="mut small">Points</div></div><div><div class="big">${fmtM(me.money)}</div><div class="mut small">Bank</div></div></div>
  ${dcards}<div class="small mut">${G.projects.length ? '🔬 ' + G.projects.map(p => `${RD_AREAS[p.area].name} (${p.left} race${p.left > 1 ? 's' : ''})`).join(', ') : 'No R&D projects running.'}</div></div>
  <div class="card"><h3>Drivers' championship</h3><table>${sd.map((d, i) => `<tr class="${d.team === G.player ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(d.team)}${esc(d.name)}</td><td style="text-align:right">${d.pts}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>Constructors</h3><table>${st.map((t, i) => `<tr class="${t.id === G.player ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(t.id)}${esc(t.name)}</td><td style="text-align:right">${t.pts}</td></tr>`).join('')}</table></div>
  <div class="card" style="grid-column:1/-1"><h3>Paddock news</h3>${G.news.slice(0, 10).map(n => `<div class="news"><span class="mut small">${n.y} R${n.r}</span> ${esc(n.s)}</div>`).join('')}</div></div>`;
}
function nextRaceCard(t, btn) {
  return `<div class="card hl"><h3>Next race · Round ${G.round + 1} of ${G.cal.length}</h3><div class="row">${trackSVG(t, 110)}<div class="sp"><div class="big">${flag(t.cc)} ${esc(t.short)} GP</div>
    <div class="mut">${esc(t.name)}${G.timeline ? ` · <span class="mut">${t.date || ''}</span>` : t.era !== 'current' ? ` · <span class="warn">${t.era === 'custom' ? 'custom circuit' : 'classic (' + t.era + ')'}</span>` : ''}</div>${isSprintRound(G, G.round) ? '<div class="pill" style="background:#f5c518;color:#000;margin:3px 0">⚡ SPRINT WEEKEND</div>' : ''}<div class="small">${t.laps} laps · ${t.km.toFixed(3)} km</div>
    <div class="small mut">Overtaking ${lvl(t.ot)} · Downforce ${lvl(t.df)} · Power ${lvl(t.pw)} · Tyre wear ${lvl(t.wear)} · Rain ${Math.round(t.rain * 100)}%</div></div></div>${btn}</div>`;
}
function specHome(seasonOver, t) {
  const fav = G.follow && G.drivers[G.follow];
  const sd = standingsDrivers(G).slice(0, 10), st = standingsTeams(G);
  const next = seasonOver ? `<div class="card hl"><h3>Season complete</h3><button class="pri" data-a="endseason">Season review →</button></div>`
    : nextRaceCard(t, `<div class="row" style="margin-top:10px"><button class="pri sp" data-a="gowk">Watch the weekend →</button><button data-a="gowkrace">⏩ Straight to the ${isSprintRound(G, G.round) ? 'Sprint' : 'race'}</button></div>`);
  const leader = sd[0], gap = sd[1] ? leader.pts - sd[1].pts : 0;
  const P1 = ((G.rules && G.rules.points) || POINTS)[0]; let left = (G.cal.length - G.round) * P1; for (let i = G.round; i < G.cal.length; i++) if (isSprintRound(G, i)) left += 8;
  return `<div class="grid g2">${next}
  <div class="card"><h3>Title fight</h3>${G.round ? `<div class="big">${esc(leader.name)}</div><div class="mut small">leads by ${gap} pts · ${left} pts still available${gap > left ? ' · <b class="good">CHAMPION!</b>' : ''}</div>` : '<div class="mut">The season hasn\'t started yet.</div>'}
  ${fav ? `<div class="news" style="margin-top:8px">⭐ ${flag(fav.nat)} <b>${esc(fav.name)}</b> ${fav.team ? '· ' + esc(G.teams[fav.team].name) : '· not racing'} — P${standingsDrivers(G).indexOf(fav) + 1}, ${fav.pts} pts, ${fav.wins} win${fav.wins === 1 ? '' : 's'}</div>` : '<div class="small mut" style="margin-top:8px">Tip: pick a favourite driver in the Grid tab.</div>'}</div>
  <div class="card"><h3>Drivers' championship</h3><table>${sd.map((d, i) => `<tr class="${d.id === G.follow ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(d.team)}${esc(d.name)}</td><td style="text-align:right">${d.pts}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>Constructors</h3><table>${st.map((tm, i) => `<tr><td>${i + 1}</td><td>${tbar(tm.id)}${esc(tm.name)}</td><td style="text-align:right">${tm.pts}</td></tr>`).join('')}</table></div>
  <div class="card" style="grid-column:1/-1"><h3>Paddock news</h3>${G.news.slice(0, 10).map(n => `<div class="news"><span class="mut small">${n.y} R${n.r}</span> ${esc(n.s)}</div>`).join('')}</div></div>`;
}
const lvl = v => v > 0.7 ? 'High' : v > 0.4 ? 'Med' : 'Low';
function hqCalendar() {
  const rows = G.cal.map((id, i) => {
    const t = roundTrack(G, i); const r = G.results[i];
    const me = r ? r.rows.filter(x => G.player ? x.team === G.player : x.id === G.follow).map(x => x.out ? 'DNF' : 'P' + x.pos).join(', ') : '';
    return `<tr class="${i === G.round ? 'me' : ''}"><td>${i + 1}</td><td>${trackSVG(t, 28)}</td><td>${flag(t.cc)} <b>${esc(t.short)}</b>${isSprintRound(G, i) ? ' <span class="pill" style="background:#f5c518;color:#000">⚡</span>' : ''}<div class="small mut">${esc(t.name)}${G.timeline ? ' · ' + (t.date || '') : t.era !== 'current' ? ' · ' + t.era : ''}</div></td>
    <td class="small">${r ? `🏆 ${esc(r.rows[0].name)}${r.sprint ? `<div class="mut">⚡ ${esc(r.sprint[0].name)}</div>` : ''}` : i === G.round ? '<b>NEXT</b>' : ''}${G.timeline && t.realWin >= 0 ? `<div class="mut">Real: ${esc(histDriverName(t.realWin))}</div>` : ''}</td><td class="small">${me}</td></tr>`;
  }).join('');
  return `<div class="card"><div class="row"><h3 class="sp">${G.year} calendar</h3>
  ${G.timeline ? '<span class="small mut">Real ' + G.year + ' calendar</span>' : `${G.round === 0 ? `<button class="sm" data-a="editcal" data-v="now">Edit this season</button>` : ''}<button class="sm" data-a="editcal" data-v="next">${G.calNext ? 'Edit' : 'Plan'} next season</button>`}</div>
  ${G.calNext ? `<div class="small mut">Next season: ${G.calNext.length} races (${(G.sprintsNext || []).length} sprints) planned.</div>` : ''}
  <table><tr><th>#</th><th></th><th>Grand Prix</th><th>Winner</th><th>${G.spectator ? '⭐' : 'You'}</th></tr>${rows}</table></div>`;
}
function hqStandings() {
  const mode = SUB.st || 'd';
  let body = '';
  if (mode === 'd') body = `<table><tr><th>Pos</th><th>Driver</th><th>Team</th><th>W</th><th>Pod</th><th style="text-align:right">Pts</th></tr>${standingsDrivers(G).map((d, i) => `<tr class="${(G.player ? d.team === G.player : d.id === G.follow) ? 'me' : ''}"><td>${i + 1}</td><td>${flag(d.nat)} ${esc(d.name)}</td><td>${d.team ? tbar(d.team) + esc(G.teams[d.team].name) : '<span class="mut">—</span>'}</td><td>${d.wins}</td><td>${d.pods}</td><td style="text-align:right"><b>${d.pts}</b></td></tr>`).join('')}</table>`;
  else if (mode === 't') body = `<table><tr><th>Pos</th><th>Team</th><th>Drivers</th><th style="text-align:right">Pts</th></tr>${standingsTeams(G).map((t, i) => `<tr class="${t.id === G.player ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(t.id)}${esc(t.name)}</td><td class="small mut">${teamDrivers(G, t.id).map(d => d.code).join(' / ')}</td><td style="text-align:right"><b>${t.pts}</b></td></tr>`).join('')}</table>`;
  else if (mode === 'r') body = G.results.length ? G.results.slice().reverse().map(r => { const t = TRACK_BY_ID[r.track]; return `<div class="news"><b>R${r.round} ${flag(t.cc)} ${esc(r.gp || t.short)}</b> — ${r.rows.slice(0, 3).map((x, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(x.code)}`).join(' ')}${r.sprint ? ` <span class="small">· ⚡ ${esc(r.sprint[0].code)}</span>` : ''} <span class="small mut">· ${G.spectator ? '⭐' : 'You'}: ${r.rows.filter(x => G.player ? x.team === G.player : x.id === G.follow).map(x => x.out ? 'DNF' : 'P' + x.pos).join(', ') || '—'}</span></div>`; }).join('') : '<div class="mut">No races yet.</div>';
  else body = G.history.length ? `<table><tr><th>Year</th><th>Drivers' champion</th><th>Constructors'</th><th>${G.spectator ? '' : 'You'}</th></tr>${G.history.slice().reverse().map(h => `<tr><td>${h.year}</td><td>${h.champ ? esc(h.champ.name) + ` <span class="small mut">${h.champ.pts}</span>` : ''}${h.realChamp ? `<div class="small mut">real: ${esc(h.realChamp)}</div>` : ''}</td><td>${tbar(h.cchamp.id)}${esc(h.cchamp.name)}</td><td>${G.spectator ? '' : 'P' + h.playerPos + ' · ' + h.playerPts + (h.teamName ? `<div class="small mut">${esc(h.teamName)}</div>` : '')}</td></tr>`).join('')}</table>` : '<div class="mut">Finish a season to start your history book.</div>';
  return `<div class="card"><div class="row" style="margin-bottom:8px">${[['d', 'Drivers'], ['t', 'Constructors'], ['r', 'Results'], ['h', 'History']].map(([k, v]) => `<button class="sm ${mode === k ? 'on' : ''}" data-a="sub" data-k="st" data-v="${k}">${v}</button>`).join('')}</div>${body}</div>`;
}
function hqCar() {
  const me = G.teams[G.player], eng = G.engines[me.engine];
  const all = Object.values(G.teams);
  const best = k => Math.max(...all.map(t => k === 'power' ? G.engines[t.engine].power : k === 'relc' ? teamRel(G, t) : t[k]));
  const rankOf = k => all.slice().sort((a, b) => (k === 'power' ? G.engines[b.engine].power - G.engines[a.engine].power : b[k] - a[k])).findIndex(t => t.id === me.id) + 1;
  const sizes = Object.entries(RD_SIZES);
  const capLeft = capFor(G) - me.spent;
  const areas = Object.entries(RD_AREAS).map(([k, a]) => {
    const locked = k === 'power' && !me.works;
    return `<div class="card" style="background:var(--panel2)"><b>${a.name}</b><div class="small mut">${locked ? `Customer engine (${eng.name}). Your supplier develops it.` : a.desc}</div>
    <div class="row" style="margin-top:6px">${locked ? '' : sizes.map(([sk, s]) => `<button class="sm" data-a="rd" data-area="${k}" data-size="${sk}" ${G.projects.length >= 3 || capLeft < s.cost || me.money < s.cost || G.round >= G.cal.length ? 'disabled' : ''}>${s.name} ${fmtM(s.cost)} · ${s.races}r</button>`).join('')}</div></div>`;
  }).join('');
  const comp = all.map(t => ({ t, s: (t.aero + t.chassis + G.engines[t.engine].power) / 3 })).sort((a, b) => b.s - a.s);
  return `<div class="grid g2"><div class="card hl"><h3>Your car</h3>
  ${statBar(`Aero (P${rankOf('aero')})`, me.aero)}${statBar(`Chassis (P${rankOf('chassis')})`, me.chassis)}${statBar(`Power (P${rankOf('power')})`, eng.power)}${statBar('Reliability', teamRel(G, me), 100, 60, '#4aa3ff')}
  <div class="small mut">Best on grid — aero ${best('aero').toFixed(1)}, chassis ${best('chassis').toFixed(1)}, power ${best('power').toFixed(1)}. Engine: ${eng.name}${me.works ? ' (works team)' : ' (customer)'}.</div></div>
  <div class="card"><h3>Grid pecking order</h3><table>${comp.map((c, i) => `<tr class="${c.t.id === me.id ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(c.t.id)}${esc(c.t.name)}</td><td style="width:45%"><div class="bar"><i style="width:${clamp((c.s - 70) / 30, 0, 1) * 100}%;background:${c.t.color}"></i></div></td><td>${c.s.toFixed(1)}</td></tr>`).join('')}</table></div>
  <div class="card" style="grid-column:1/-1"><div class="row"><h3 class="sp">Research & development</h3><span class="chip">${capLeft === Infinity ? 'No cost cap' : 'Cost cap left ' + fmtM(capLeft)}</span><span class="chip">Projects ${G.projects.length}/3</span></div>
  <div class="small mut" style="margin-bottom:8px">Minor = safe small gain. Major = bigger gain, 10% chance of nothing. Radical = could be huge… or a step backwards. Gains shrink as a rating nears 100. Car ratings partly reset toward the pack each winter.</div>
  ${G.projects.length ? `<div style="margin-bottom:10px">${G.projects.map(p => `<div class="row news"><b class="sp">${RD_SIZES[p.size].name} ${RD_AREAS[p.area].name}</b><span class="mut">${p.left} race${p.left > 1 ? 's' : ''} to go</span></div>`).join('')}</div>` : ''}
  <div class="grid g2">${areas}</div></div></div>`;
}
function driverRow(d, opts = {}) {
  const o = overall(d);
  return `<tr class="${d.team === G.player ? 'me' : ''}"><td>${flag(d.nat)} <b>${esc(d.name)}</b>${d.rookie ? ' <span class="pill">ROOKIE</span>' : ''}${d.next ? ` <span class="pill" style="background:${teamCol(d.next.team)}">→ ${esc(G.teams[d.next.team].name)} ${G.year + 1}</span>` : ''}<div class="small mut">#${d.num} · age ${d.age}${d.pot ? ' · ' + '★'.repeat(Math.min(5, d.pot)) : ''}</div></td>
  <td>${d.team ? tbar(d.team) + esc(G.teams[d.team].name) : '<span class="mut">Free agent</span>'}${d.team ? `<div class="small mut">to ${d.until} · ${fmtM(d.salary)}/yr</div>` : ''}</td>
  <td><b>${o.toFixed(1)}</b><div class="small mut">P${d.pace.toFixed(0)} R${d.craft.toFixed(0)} C${d.cons.toFixed(0)} W${d.wet.toFixed(0)} T${d.tyre.toFixed(0)}</div></td>
  <td><button class="sm" data-a="drv" data-v="${d.id}">${opts.btn || 'View'}</button></td></tr>`;
}
function hqDrivers() {
  if (G.spectator) return `<div class="grid g3">${standingsTeams(G).map(t => `<div class="card" style="border-top:4px solid ${t.color}"><b>${esc(t.name)}</b> <span class="mut small">${t.pts} pts · ${G.engines[t.engine].name}</span>
    ${teamDrivers(G, t.id).map(d => `<div class="row" style="margin-top:6px"><span class="sp">${flag(d.nat)} ${esc(d.name)} <span class="mut small">#${d.num} · OVR ${overall(d).toFixed(1)}</span></span>${d.id === G.follow ? '⭐' : ''}<button class="sm" data-a="drv" data-v="${d.id}">View</button></div>`).join('')}</div>`).join('')}</div>`;
  const mine = teamDrivers(G, G.player);
  const fut = Object.values(G.drivers).filter(d => d.next && d.next.team === G.player);
  const mode = SUB.dm || 'free';
  let pool = Object.values(G.drivers).filter(d => !d.retired && d.team !== G.player);
  if (mode === 'free') pool = pool.filter(d => !d.team);
  else pool = pool.filter(d => d.team);
  pool.sort((a, b) => overall(b) - overall(a));
  return `<div class="card hl"><h3>Your drivers</h3><table><tr><th>Driver</th><th>Contract</th><th>OVR</th><th></th></tr>${mine.map(d => driverRow(d, { btn: 'Manage' })).join('')}</table>
  ${fut.length ? `<div class="small" style="margin-top:6px">Signed for ${G.year + 1}: ${fut.map(d => esc(d.name)).join(', ')}</div>` : ''}
  ${G.timeline ? '<div class="small warn" style="margin-top:6px">🕰️ Historic timeline: ratings come from real results, and line-ups reset to real history each season.</div>' : ''}<div class="small mut" style="margin-top:6px">OVR mixes Pace, Racecraft, Consistency, Wet skill and Tyre management. Stars = growth potential.</div></div>
  <div class="card" style="margin-top:12px"><div class="row" style="margin-bottom:6px"><h3 class="sp">Driver market</h3>${[['free', 'Free agents'], ['grid', 'Other teams']].map(([k, v]) => `<button class="sm ${mode === k ? 'on' : ''}" data-a="sub" data-k="dm" data-v="${k}">${v}</button>`).join('')}</div>
  <table><tr><th>Driver</th><th>Status</th><th>OVR</th><th></th></tr>${pool.map(d => driverRow(d, { btn: 'Approach' })).join('')}</table></div>`;
}
function hqFinance() {
  const me = G.teams[G.player];
  const sal = teamDrivers(G, G.player).reduce((s, d) => s + d.salary, 0);
  const n = G.cal.length;
  return `<div class="grid g2"><div class="card hl"><h3>Bank</h3><div class="big">${fmtM(me.money)}</div>
  ${capFor(G) === Infinity ? '<div class="small mut">No cost cap in this era — spend whatever you can afford.</div>' : `<div class="stat"><span class="mut">Cost cap</span><div class="bar"><i style="width:${clamp(me.spent / COST_CAP, 0, 1) * 100}%;background:${me.spent > COST_CAP * 0.9 ? '#ff5b5b' : 'var(--warn)'}"></i></div><b>${Math.round(me.spent)}</b></div>
  <div class="small mut">Spent ${fmtM(me.spent)} of the ${fmtM(COST_CAP)} cost cap this season. Operations and R&D count; driver salaries don't.</div>`}</div>
  <div class="card"><h3>Per race (estimate)</h3><table>
  <tr><td>Sponsors</td><td class="good" style="text-align:right">+${fmtM(me.sponsor)}</td></tr>
  <tr><td>Points bonus</td><td class="good" style="text-align:right">+$0.12M / pt</td></tr>
  <tr><td>Operations</td><td class="bad" style="text-align:right">-${fmtM(OPS_PER_RACE)}</td></tr>
  <tr><td>Driver salaries</td><td class="bad" style="text-align:right">-${fmtM(sal / n)}</td></tr>
  <tr><td>Crash repairs</td><td class="bad" style="text-align:right">-$0.8M per crash</td></tr></table>
  <div class="small mut" style="margin-top:6px">End-of-season prize money: $140M for P1, dropping $9M per place.</div></div></div>`;
}
function hqMenu() {
  return `<div class="grid g2"><div class="card"><h3>Save</h3><div class="row"><button class="pri" data-a="save">Save game</button><button data-a="export">Export save code</button><button data-a="importui">Import</button></div>
  <div class="small mut" style="margin-top:6px">The game also autosaves after every race in this browser.</div></div>
  <div class="card"><h3>Settings</h3>
  <label class="row"><input type="checkbox" data-a="set" data-v="weatherOn" ${G.weatherOn !== false ? 'checked' : ''}> Weather (rain)</label>
  <label class="row"><input type="checkbox" data-a="set" data-v="incidentsOn" ${G.incidentsOn !== false ? 'checked' : ''}> Crashes, failures & safety cars</label>
  <label class="row"><input type="checkbox" data-a="set" data-v="autoPause" ${G.autoPause ? 'checked' : ''}> Auto-pause race on safety car, rain or your retirement</label>
  ${G.spectator ? '' : `<div class="row" style="margin-top:6px"><span class="mut">Difficulty</span>${['easy', 'normal', 'hard'].map(d => `<button class="sm ${G.difficulty === d ? 'on' : ''}" data-a="setdiff" data-v="${d}">${d}</button>`).join('')}</div>`}</div>
  <div class="card"><h3>Tracks</h3><button data-a="studio">✏️ Track Studio</button><div class="small mut" style="margin-top:6px">Trace circuit layouts from images, or create your own circuits.</div></div>
  <div class="card"><h3>Career</h3><button data-a="totitle">Main menu</button></div></div>`;
}

// ---------- Driver modal ----------
function openDriver(id) {
  const d = G.drivers[id]; const mine = d.team === G.player; const ask = askingSalary(d);
  const myDrivers = teamDrivers(G, G.player);
  const endingSoon = myDrivers.filter(x => x.until <= G.year && !Object.values(G.drivers).some(f => f.next && f.next.team === G.player && f.next.replaces === x.id));
  const futCount = Object.values(G.drivers).filter(f => f.next && f.next.team === G.player).length;
  const stayers = myDrivers.filter(x => x.until > G.year).length;
  const canNext = !G.timeline && !mine && stayers + futCount < 2 && !d.next && (!d.team || d.until <= G.year);
  const buyout = d.team && !mine ? +(Math.max(1, d.until - G.year + (G.round >= G.cal.length ? 0 : 1)) * d.salary * 0.6).toFixed(1) : 0;
  const offSeason = G.round === 0 || G.round >= G.cal.length;
  let html = `<div class="row"><h2 class="sp">${flag(d.nat)} ${esc(d.name)}</h2><button class="sm" data-a="close">✕</button></div>
  <div class="mut">#${d.num} · ${d.code} · age ${d.age} · ${d.team ? esc(G.teams[d.team].name) + ` (to ${d.until}, ${fmtM(d.salary)}/yr)` : 'free agent'}</div>
  <div style="margin:10px 0">${statBar('Pace', d.pace)}${statBar('Racecraft', d.craft)}${statBar('Consistency', d.cons)}${statBar('Wet', d.wet)}${statBar('Tyres', d.tyre)}</div>
  <div class="small">Career: ${d.titles} title${d.titles === 1 ? '' : 's'} · ${d.careerWins} wins (in this save) · this season ${d.pts} pts</div>`;
  if (G.spectator) { html += `<button class="pri" style="margin-top:10px" data-a="setfav" data-v="${d.id}">${G.follow === d.id ? '⭐ Your favourite' : '⭐ Follow this driver'}</button>`; return modal(html); }
  if (mine && G.timeline) {
    html += `<div class="small mut" style="margin-top:10px">Historic timeline: line-ups follow real history each season, so contracts aren't needed. You can still swap drivers for the rest of this season from the market.</div><div class="row" style="margin-top:8px"><button data-a="release" data-v="${d.id}">Release driver</button></div>`;
  } else if (mine) {
    html += `<hr style="border-color:#2a3142"><h3>Contract</h3><div class="small mut">Asking about ${fmtM(ask)}/yr for an extension.</div>
    ${negotiateForm(d, ask, 'renew')}
    <div class="row" style="margin-top:10px"><button data-a="release" data-v="${d.id}">Release driver</button><span class="small mut">Pays 50% of remaining salary this season.</span></div>`;
  } else {
    if (d.next) html += `<div class="banner" style="margin-top:8px">Already signed with ${esc(G.teams[d.next.team].name)} for ${G.year + 1}.</div>`;
    else {
      html += `<hr style="border-color:#2a3142"><h3>Make an offer</h3><div class="small mut">Asking around ${fmtM(ask)}/yr. Better-placed teams can offer less.${buyout ? ` Buy-out to release him from ${esc(G.teams[d.team].name)}: <b>${fmtM(buyout)}</b>.` : ''}</div>`;
      const opts = [];
      if (myDrivers.length < 2) opts.push(['now', 'Join now (empty seat)']);
      else if (!offSeason || true) myDrivers.forEach(x => opts.push(['now:' + x.id, `Join now, replacing ${x.name}`]));
      if (canNext) opts.push(['next', `Sign for ${G.year + 1} season`]);
      html += negotiateForm(d, ask, opts, buyout);
    }
  }
  modal(html);
}
function negotiateForm(d, ask, opts, buyout) {
  const sel = opts === 'renew' ? '' : `<select id="ng_when" style="width:100%;margin:6px 0">${opts.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>`;
  return `${sel}<div class="row"><span class="mut">Salary $M/yr</span><input id="ng_sal" type="number" step="0.5" min="0.5" value="${ask.toFixed(1)}" style="width:90px"><span class="mut">Years</span>
  <select id="ng_yrs"><option>1</option><option selected>2</option><option>3</option></select>
  <button class="pri" data-a="offer" data-v="${d.id}" data-mode="${opts === 'renew' ? 'renew' : 'sign'}" data-buy="${buyout || 0}">${opts === 'renew' ? 'Offer extension' : 'Send offer'}</button></div><div id="ng_msg" class="small" style="margin-top:6px"></div>`;
}
function doOffer(id, mode, buyout) {
  const d = G.drivers[id]; const me = G.teams[G.player];
  const sal = parseFloat(document.getElementById('ng_sal').value) || 0; const yrs = parseInt(document.getElementById('ng_yrs').value);
  const msgEl = document.getElementById('ng_msg');
  const stamp = G.year * 100 + G.round;
  if (d.lastAsk === stamp && d.askTries >= 2) { msgEl.innerHTML = '<span class="bad">He won\'t talk again until after the next race.</span>'; return; }
  d.askTries = d.lastAsk === stamp ? (d.askTries || 0) + 1 : 1; d.lastAsk = stamp;
  const ask = askingSalary(d), ap = appeal(G, G.player);
  let req = ask * (1.25 - ap * 0.5) * (mode === 'renew' ? 0.95 : 1) * (d.team && mode !== 'renew' ? 1.1 : 1);
  if (!d.team) req *= 0.9;
  const whenV = mode === 'renew' ? 'renew' : document.getElementById('ng_when').value;
  if (mode !== 'renew' && d.team && !whenV.startsWith('next')) {
    const theirs = appeal(G, d.team);
    if (theirs > ap + 0.15 && Math.random() < 0.75) { msgEl.innerHTML = `<span class="bad">${esc(d.name)} doesn't want to leave ${esc(G.teams[d.team].name)} for a slower team.</span>`; return; }
    if (me.money < buyout) { msgEl.innerHTML = '<span class="bad">Not enough money for the buy-out.</span>'; return; }
  }
  const ok = sal >= req || (sal >= req * 0.85 && Math.random() < 0.4);
  if (!ok) { msgEl.innerHTML = `<span class="bad">Rejected. He's looking for more (try ~${fmtM(req * rnd(0.98, 1.08))}).</span>`; return; }
  if (mode === 'renew') {
    d.salary = +sal.toFixed(1); d.until = G.year + yrs - (G.round === 0 ? 1 : 0);
    news(G, `✍️ ${d.name} extends with ${me.name} until ${d.until}.`); closeModal(); render(); toast('Contract extended!'); autosave(); return;
  }
  if (whenV === 'next') {
    d.next = { team: G.player, salary: +sal.toFixed(1), until: G.year + yrs };
    news(G, `✍️ ${d.name} will join ${me.name} in ${G.year + 1}.`); closeModal(); render(); toast(`${d.name} signed for ${G.year + 1}!`); autosave(); return;
  }
  // join now
  const repl = whenV.startsWith('now:') ? whenV.slice(4) : null;
  const left = G.round >= G.cal.length ? 0 : (G.cal.length - G.round) / G.cal.length;
  if (repl) { const r = G.drivers[repl]; me.money -= r.salary * left * 0.5; r.team = null; r.until = 0; news(G, `👋 ${me.name} release ${r.name}.`); }
  const oldTeam = d.team;
  if (oldTeam) { me.money -= buyout; G.teams[oldTeam].money += buyout; }
  d.team = G.player; d.salary = +sal.toFixed(1); d.until = G.year + yrs - 1 + (G.round >= G.cal.length ? 1 : 0); d.rookie = false;
  news(G, `✍️ ${d.name} joins ${me.name}${oldTeam ? ' from ' + G.teams[oldTeam].name : ''}!`);
  if (oldTeam) aiFillNow(G);
  closeModal(); render(); toast(`${d.name} signed!`); autosave();
}

// ---------- Weekend ----------
function startWeekend() {
  const track = roundTrack(G, G.round);
  const sprint = isSprintRound(G, G.round);
  WK = { track, sprint, stage: 'fp', session: 1, sessions: sprint ? 1 : 3, entries: weekendEntries(G), weather: makeWeather(track, G.weatherOn !== false), programs: {}, fp: [], risks: {},
    SQ: { stage: 1, rounds: [] }, Q: { stage: 1, rounds: [] } };
  WK.stages = sprint ? [['fp', 'Practice'], ['squali', 'Sprint Quali'], ['sgrid', 'Sprint Grid'], ['sprint', 'Sprint'], ['sresults', 'Sprint Result'], ['quali', 'Qualifying'], ['grid', 'Grid'], ['race', 'Race'], ['results', 'Results']]
    : [['fp', 'Practice'], ['quali', 'Qualifying'], ['grid', 'Grid'], ['race', 'Race'], ['results', 'Results']];
  if (sprint) {
    const sl = sprintLaps(track);
    WK.sweather = makeWeather({ laps: sl, rain: track.rain * 0.6 }, G.weatherOn !== false);
    if (WK.weather.quali > 0.3) WK.sweather.start = Math.max(WK.sweather.start, WK.weather.quali * rnd(0.6, 1));
  }
  WK.forecast = forecastText(WK.weather, track);
  VIEW = 'weekend'; render(); window.scrollTo(0, 0);
}
function myEntries() { return G.player ? WK.entries.filter(e => e.t.id === G.player) : []; }
function isMine(e) { return G.player ? e.t.id === G.player : e.d.id === G.follow; }
function viewWeekend() {
  const t = WK.track;
  const idx = WK.stages.findIndex(s => s[0] === WK.stage);
  const live = WK.stage === 'race' || WK.stage === 'sprint';
  const head = `<div class="row"><div class="sp"><h2 style="margin:0">${flag(t.cc)} ${esc(t.short)} Grand Prix ${G.year}${WK.sprint ? ' <span class="pill" style="background:#f5c518;color:#000">⚡ SPRINT</span>' : ''}</h2><div class="mut small">${esc(t.name)} · Round ${G.round + 1} · ${t.laps} laps${WK.sprint ? ` · Sprint ${sprintLaps(t)} laps` : ''}</div></div>${live ? '' : trackSVG(t, 60)}</div>
  <div class="steps">${WK.stages.map((s, i) => `<span class="${i === idx ? 'on' : i < idx ? 'done' : ''}">${i < idx ? '✓ ' : ''}${s[1]}</span>`).join('')}</div>
  ${!live && !['results', 'sresults'].includes(WK.stage) ? `<div class="row" style="margin:-4px 0 10px"><span class="sp"></span><button class="sm" data-a="autorace">⏩ Skip to the ${WK.sprint && !WK.sprintRows ? 'Sprint' : 'race'}</button></div>` : ''}`;
  return head + ({ fp: wkPractice, squali: () => wkQuali('SQ'), sgrid: () => wkGrid(true), sprint: wkRace, sresults: wkSprintResults, quali: () => wkQuali('Q'), grid: () => wkGrid(false), race: wkRace, results: wkResults })[WK.stage]();
}
function wkPractice() {
  const mine = myEntries();
  const last = WK.fp[WK.fp.length - 1];
  const progBtns = e => Object.entries(PROGRAMS).map(([k, p]) => `<button class="sm ${(WK.programs[e.d.id] || 'setup') === k ? 'on' : ''}" data-a="prog" data-d="${e.d.id}" data-v="${k}">${p.name}</button>`).join('');
  const done = WK.session > WK.sessions;
  const nextLabel = WK.sprint ? 'Go to Sprint Qualifying →' : 'Go to qualifying →';
  return `<div class="grid g2"><div class="card hl"><h3>${done ? 'Practice complete' : (WK.sprint ? 'Free Practice (only session this weekend)' : 'Free Practice ' + WK.session)}</h3>
  <div class="small" style="margin-bottom:8px">🌦️ Forecast: ${esc(WK.forecast)}${WK.weather.quali > 0.25 ? ' · Qualifying looks wet' : ''}</div>
  ${mine.map(e => `<div style="margin:10px 0"><b>${esc(e.d.name)}</b>${done ? '' : `<div class="row" style="margin:4px 0">${progBtns(e)}</div>`}
  ${statBar('Setup', e.setup * 100, 100, 0)}${statBar('Tyre know.', e.tyreKnow * 100, 100, 0, '#f5c518')}${statBar('Quali prep', e.qualiPrep * 100, 100, 0, '#4aa3ff')}</div>`).join('')}
  ${G.spectator ? '<div class="small mut">Teams are fine-tuning their cars. Run the session to see the timesheet.</div>' : ''}
  <div class="row" style="margin-top:8px">${done ? `<button class="pri" data-a="toquali">${nextLabel}</button>` : `<button class="pri" data-a="runfp">Run FP${WK.sprint ? '' : WK.session}</button>${WK.sessions > 1 ? '<button data-a="skipfp">Skip practice</button>' : ''}`}</div></div>
  <div class="card"><h3>${last ? 'FP' + WK.fp.length + ' times' : 'Timesheet'}</h3>${last ? `<table>${last.map((r, i) => `<tr class="${isMine(r.e) ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(r.e.t.id)}${r.e.d.code}</td><td>${fmtTime(r.t)}</td><td class="small mut">${i ? '+' + (r.t - last[0].t).toFixed(3) : ''}</td><td class="small mut">${r.laps} laps</td></tr>`).join('')}</table>` : `<div class="mut">${G.spectator ? 'Waiting for the session to start.' : 'Pick a run plan for each driver, then run the session.'}</div>`}</div></div>`;
}
function qCut(n) { return Math.round(n * 0.27); }
function wkQuali(key) {
  const QS = WK[key], sprint = key === 'SQ', P = sprint ? 'SQ' : 'Q';
  const mine = myEntries();
  const last = QS.rounds[QS.rounds.length - 1];
  const alive = QS.alive || WK.entries;
  const myAlive = mine.filter(e => alive.includes(e));
  const riskBtns = e => [['safe', 'Safe'], ['normal', 'Normal'], ['all', 'All-out']].map(([k, v]) => `<button class="sm ${(WK.risks[e.d.id] || 'normal') === k ? 'on' : ''}" data-a="risk" data-d="${e.d.id}" data-v="${k}">${v}</button>`).join('');
  const done = QS.stage > 3;
  const single = !sprint && G.rules && G.rules.quali === 'single';
  let table = `<div class="mut">${G.spectator ? 'Three knockout sessions decide the grid.' : 'Choose how hard each driver pushes. All-out is faster on average but riskier.'}</div>`;
  if (last) {
    const cutAt = !single && last.stage < 3 ? last.res.length - qCut(WK.entries.length) : 99;
    table = `<table>${last.res.map((r, i) => `<tr class="${isMine(r.e) ? 'me' : ''}" ${i === cutAt ? 'style="border-top:2px solid #e10600"' : ''}><td>${i + 1}</td><td>${tbar(r.e.t.id)}${esc(r.e.d.name)}</td><td>${r.crash ? '<span class="bad">CRASH</span>' : fmtTime(r.t)}</td><td class="small mut">${i && r.t ? '+' + (r.t - last.res[0].t).toFixed(3) : ''}</td></tr>`).join('')}</table>`;
  }
  return `<div class="grid g2"><div class="card hl"><h3>${done ? (sprint ? 'Sprint Qualifying complete' : 'Qualifying complete') : single ? 'Qualifying (single session, ' + G.year + ' format)' : P + QS.stage}</h3>
  ${WK.weather.quali > 0.25 ? '<div class="small warn">🌧️ Wet session</div>' : ''}
  ${done || G.spectator ? '' : myAlive.length ? myAlive.map(e => `<div style="margin:8px 0"><b>${esc(e.d.name)}</b><div class="row" style="margin-top:4px">${riskBtns(e)}</div></div>`).join('') : '<div class="mut">Both your drivers are out — simulate the rest.</div>'}
  <div class="row" style="margin-top:8px">${done ? `<button class="pri" data-a="togrid">See the ${sprint ? 'Sprint ' : ''}grid →</button>` : `<button class="pri" data-a="runq">Run ${single ? 'qualifying' : P + QS.stage}</button>`}</div></div>
  <div class="card"><h3>${last ? (single ? 'Qualifying classification' : P + last.stage + ' classification') : 'Timesheet'}</h3>${table}</div></div>`;
}
function wkGrid(sprint) {
  const grid = sprint ? WK.sgrid : WK.grid;
  const W = sprint ? WK.sweather : WK.weather;
  const mine = myEntries(); const dry = W.start <= 0.22;
  const left = G.spectator ? `<div class="card hl"><h3>${sprint ? 'Sprint' : 'Race'} preview</h3><div class="small" style="margin-bottom:6px">🌦️ ${esc(sprint ? forecastText(W, { rain: 0 }) : WK.forecast)}</div>
    ${G.follow ? (() => { const e = grid.find(x => x.d.id === G.follow); return e ? `<div>⭐ ${esc(e.d.name)} starts <b>P${grid.indexOf(e) + 1}</b></div>` : ''; })() : ''}
    <div class="small mut" style="margin-top:6px">${sprint ? `${sprintLaps(WK.track)} laps, no mandatory pit stop. Points for the top 8.` : 'Each car must use two different dry compounds in a dry race.'}</div>
    <button class="pri" style="margin-top:10px" data-a="startrace">Lights out →</button></div>`
    : `<div class="card hl"><h3>${sprint ? 'Sprint' : 'Race'} strategy</h3><div class="small" style="margin-bottom:6px">🌦️ ${esc(sprint ? forecastText(W, { rain: 0 }) : WK.forecast)}</div>
  ${mine.map(e => `<div style="margin:8px 0"><b>P${grid.indexOf(e) + 1} ${esc(e.d.name)}</b>
  ${dry ? `<div class="row" style="margin-top:4px">Start on ${['S', 'M', 'H'].map(c => `<button class="sm ${((sprint ? e.sStartTyre : e.startTyre) || 'M') === c ? 'on' : ''}" data-a="stt" data-d="${e.d.id}" data-v="${c}">${TYRES[c].name}</button>`).join('')}</div>` : '<div class="small mut">Wet start — the team will fit wet-weather tyres.</div>'}
  <label class="row small" style="margin-top:4px"><input type="checkbox" data-a="autostrat" data-d="${e.d.id}" ${e.auto !== false ? 'checked' : ''}> Auto pit strategy (you can still call stops)</label></div>`).join('')}
  <div class="small mut">${sprint ? `Sprint: ${sprintLaps(WK.track)} laps, no mandatory stop, points for the top 8 (8-7-6-5-4-3-2-1).` : 'Dry races: each car must use two different dry compounds (or get +30s).'}</div>
  <button class="pri" style="margin-top:10px" data-a="startrace">Lights out →</button></div>`;
  return `<div class="grid g2">${left}
  <div class="card"><h3>${sprint ? 'Sprint grid' : 'Starting grid'}</h3><table>${grid.map((e, i) => `<tr class="${isMine(e) ? 'me' : ''}"><td>${i + 1}</td><td>${tbar(e.t.id)}${esc(e.d.name)}</td><td class="small mut">${esc(e.t.name)}</td></tr>`).join('')}</table></div></div>`;
}
function wkSprintResults() {
  const rows = WK.sprintRows; const lead = rows[0];
  return `<div class="grid g2"><div class="card hl"><h3>Sprint result</h3><div class="big">🏆 ${esc(lead.name)}</div><div class="mut">${esc(G.teams[lead.team].name)}</div>
  ${rows.filter(r => G.player ? r.team === G.player : r.id === G.follow).map(r => `<div style="margin-top:6px"><b>${r.out ? 'DNF' : 'P' + r.pos}</b> ${esc(r.name)} · from P${r.grid}${r.pts ? ' · +' + r.pts + ' pts' : ''}</div>`).join('')}
  <button class="pri" style="margin-top:12px" data-a="toquali">On to Grand Prix qualifying →</button></div>
  <div class="card"><h3>Sprint classification</h3>${resultTable(rows)}</div></div>`;
}
function resultTable(rows) {
  const lead = rows[0];
  return `<table><tr><th>Pos</th><th>Driver</th><th class="hm"></th><th>Time</th><th>Grid</th><th>Stops</th><th style="text-align:right">Pts</th></tr>${rows.map(r => `<tr class="${(G.player ? r.team === G.player : r.id === G.follow) ? 'me' : ''}"><td>${r.out ? 'DNF' : r.pos}</td><td>${tbar(r.team)}${esc(r.name)}</td><td class="small mut hm">${esc(G.teams[r.team].name)}</td>
  <td class="small">${r.out ? esc(r.out) : r.pos === 1 ? fmtTime(r.time) : r.laps < lead.laps ? '+' + (lead.laps - r.laps) + ' lap' + (lead.laps - r.laps > 1 ? 's' : '') : '+' + (r.time - lead.time).toFixed(3)}</td><td class="small mut">${r.grid}</td><td class="small mut">${r.stops}</td><td style="text-align:right">${r.pts || ''}</td></tr>`).join('')}</table>`;
}

// ---------- Race view ----------
let SPEED = 16, PAUSED = false, lastTs = 0, lastUi = 0, raceBanner = '';
function wkRace() {
  return `${raceBanner ? `<div class="banner" id="rbanner">${esc(raceBanner)}</div>` : '<div id="rbanner"></div>'}
  <div class="racewrap"><div><div class="cvbox"><canvas id="cv"></canvas><div class="hud" id="hud"></div></div>
  <div class="row" style="margin:8px 0">${[['pause', '❚❚ Pause'], [4, '4×'], [16, '16×'], [64, '64×'], [256, '256×']].map(([v, l]) => `<button class="sm spd ${(v === 'pause' ? PAUSED : (!PAUSED && SPEED === v)) ? 'on' : ''}" data-a="spd" data-v="${v}">${l}</button>`).join('')}
  <span class="sp"></span><button class="sm" data-a="simend">Sim to finish ⏭</button></div>
  <div id="ctrls" class="grid g2"></div>
  <div class="card" style="margin-top:10px"><h3>Race control</h3><div class="feed" id="feed"></div></div></div>
  <div class="tower" id="tower"></div></div>`;
}
function startRaceLoop() {
  lastTs = performance.now(); lastUi = 0;
  sizeCanvas(); buildCtrls(); updateRaceUI(true);
  const loop = ts => {
    const dtReal = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
    if (!PAUSED && !RACE.done) {
      let simT = dtReal * SPEED; const step = 0.25;
      while (simT > 0 && !RACE.done) { RACE.step(Math.min(step, simT)); simT -= step; if (checkAutoPause()) break; }
    }
    drawRace();
    if (ts - lastUi > 250) { updateRaceUI(); lastUi = ts; }
    if (RACE.done) { updateRaceUI(true); finishRace(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
function checkAutoPause() {
  if (!RACE.events.length) return false;
  const ev = RACE.events.splice(0);
  if (!G.autoPause) return false;
  const mine = myEntries().map(e => e.d.code); if (G.follow && G.drivers[G.follow]) mine.push(G.drivers[G.follow].code);
  const hit = ev.find(s => /SAFETY CAR|VIRTUAL|Rain is starting|stopped/.test(s) || mine.some(c => s.includes(c) && /❌|Puncture/.test(s)));
  if (hit) { PAUSED = true; raceBanner = hit + ' — paused. Make your calls, then pick a speed.'; const b = document.getElementById('rbanner'); if (b) { b.className = 'banner'; b.textContent = raceBanner; } document.querySelectorAll('.spd').forEach(x => x.classList.toggle('on', x.dataset.v === 'pause')); return true; }
  return false;
}
function sizeCanvas() {
  const cv = document.getElementById('cv'); if (!cv) return;
  const w = cv.parentElement.clientWidth; const h = Math.min(Math.round(w * 0.72), 560);
  const dpr = window.devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px'; cv._w = w; cv._h = h; cv._dpr = dpr;
}
window.addEventListener('resize', () => { if (VIEW === 'weekend' && WK && WK.stage === 'race') sizeCanvas(); });
function drawRace() {
  const cv = document.getElementById('cv'); if (!cv || !RACE) return;
  const ctx = cv.getContext('2d'); const { _w: w, _h: h, _dpr: dpr } = cv;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const g = trackGeometry(RACE.track); const pad = 30; const s = Math.min(w, h) - pad * 2; const ox = (w - s) / 2, oy = (h - s) / 2 + 8;
  const X = p => ox + p[0] * s, Y = p => oy + p[1] * s;
  // wet tint
  if (RACE.wet > 0.05) { ctx.fillStyle = `rgba(40,90,160,${RACE.wet * 0.18})`; ctx.fillRect(0, 0, w, h); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); g.P.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.closePath();
  ctx.strokeStyle = '#2b3242'; ctx.lineWidth = 14; ctx.stroke();
  ctx.strokeStyle = RACE.sc || RACE.vsc ? '#6b5a12' : '#4a5468'; ctx.lineWidth = 2; ctx.stroke();
  // start line
  const s0 = pointAt(g, 0); ctx.save(); ctx.translate(X(s0), Y(s0)); ctx.rotate(s0[2] + Math.PI / 2); ctx.fillStyle = '#fff'; ctx.fillRect(-9, -2, 18, 4); ctx.restore();
  // cars (back to front)
  const ord = RACE.order();
  const L = RACE.L;
  for (let i = ord.length - 1; i >= 0; i--) {
    const c = ord[i]; if (c.out) continue;
    let frac = c.finished ? 0.002 * i : (c.dist / L);
    const p = pointAt(g, frac);
    let x = X(p), y = Y(p);
    if (c.pitT > 0) { const n = p[2] + Math.PI / 2; x += Math.cos(n) * 16; y += Math.sin(n) * 16; }
    const hi = c.player || c.fav; const r = hi ? 7 : 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = c.t.color; ctx.fill();
    if (hi) { ctx.lineWidth = 2; ctx.strokeStyle = c.fav && !c.player ? '#ffd400' : '#fff'; ctx.stroke(); ctx.font = 'bold 11px Titillium Web, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(c.d.code, x + 9, y - 7); }
    else if (i < 3) { ctx.font = '10px Titillium Web, sans-serif'; ctx.fillStyle = '#bbb'; ctx.fillText(c.d.code, x + 7, y - 5); }
  }
}
function buildCtrls() {
  const el = document.getElementById('ctrls'); if (!el) return;
  el.innerHTML = RACE.cars.filter(c => c.player || (G.spectator && c.fav)).map(c => `<div class="ctrl" id="ctl_${c.d.id}"></div>`).join('')
    + (G.spectator ? `<div class="ctrl"><b>🎬 Race director</b><div class="small mut" style="margin:2px 0 6px">Spice it up.</div><div class="row">
    <button class="sm" data-a="chaos" data-v="rain">🌧️ Make it rain</button><button class="sm" data-a="chaos" data-v="dry">☀️ Stop the rain</button>
    <button class="sm" data-a="chaos" data-v="sc">🟨 Safety car</button><button class="sm" data-a="chaos" data-v="vsc">VSC</button><button class="sm" data-a="chaos" data-v="crash">💥 Incident</button></div>
    <div class="small mut" style="margin-top:6px">Tap a driver in the timing tower to follow them.</div></div>` : '');
}
function updateRaceUI(force) {
  if (!RACE) return;
  const ord = RACE.order(); const leader = ord[0];
  const hud = document.getElementById('hud');
  if (hud) {
    const fl = RACE.chequered ? '<span class="flag chq">🏁 CHEQUERED</span>' : RACE.sc ? '<span class="flag sc">SAFETY CAR</span>' : RACE.vsc ? '<span class="flag vsc">VSC</span>' : '<span class="flag green">GREEN</span>';
    const wtxt = RACE.wet > 0.6 ? '🌧️ Heavy rain' : RACE.wet > 0.22 ? '🌦️ Wet' : RACE.wet > 0.05 ? '🌥️ Damp' : '☀️ Dry';
    hud.innerHTML = `<span class="chip">Lap ${Math.min(RACE.laps, leader.laps + 1)}/${RACE.laps}</span>${fl}<span class="chip">${wtxt} ${Math.round(RACE.wet * 100)}%</span>${RACE.fastest ? `<span class="chip">⏱ ${RACE.fastest.c.d.code} ${fmtTime(RACE.fastest.t)}</span>` : ''}`;
  }
  const tower = document.getElementById('tower');
  if (tower) tower.innerHTML = ord.map((c, i) => { const nb = ord[i - 1]; const battle = !RACE.sc && !RACE.vsc && nb && !c.out && !nb.out && !c.finished && c.pitT <= 0 && nb.pitT <= 0 && (nb.dist - c.dist) < (RACE.L / c.curLT) * 1.0 && nb.dist > c.dist;
    return `<div class="tr ${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''}" data-a="follow" data-v="${c.d.id}" style="cursor:pointer"><b>${i + 1}</b><span style="background:${c.t.color};height:14px;border-radius:2px"></span><b style="white-space:nowrap">${c.fav ? '⭐' : ''}${c.d.code}</b>
    <span class="small mut" style="white-space:nowrap;overflow:hidden">${battle ? '⚔️ ' : ''}${c.out ? esc(c.out) : c.finished ? '🏁' : c.lastLap ? fmtTime(c.lastLap) : ''}</span>${c.out ? '<span></span>' : tyreB(c.tyre)}<span style="text-align:right">${RACE.gapStr(c, leader)}</span></div>`; }).join('');
  const feed = document.getElementById('feed');
  if (feed) feed.innerHTML = RACE.log.slice(0, 25).map(l => `<div><span class="mut">L${l.lap}</span> ${esc(l.s)}</div>`).join('');
  RACE.cars.filter(c => c.player || (G.spectator && c.fav)).forEach(c => {
    const el = document.getElementById('ctl_' + c.d.id); if (!el) return;
    if (!c.player) { const pos = ord.indexOf(c) + 1; const ahead = ord[pos - 2], behind = ord[pos];
      const g = (a, b) => a && b && !a.out && !b.out ? ((a.dist - b.dist) / (RACE.L / c.curLT)).toFixed(1) : '—';
      el.innerHTML = `<div class="row"><b style="color:${c.t.color}">P${pos}</b><b class="sp">⭐ ${esc(c.d.name)}</b>${tyreB(c.tyre)}<span class="small mut">${c.age}L</span></div>
      ${c.out ? `<div class="bad">Retired: ${esc(c.out)}</div>` : c.finished ? '<div>🏁 Finished</div>' : `<div class="small mut">Started P${c.grid} · Ahead ${g(ahead, c)}s · Behind ${g(c, behind)}s · Stops ${c.stops}${c.pitT > 0 ? ' · <b class="warn">IN PIT</b>' : ''}</div>
      <div class="stat" style="grid-template-columns:50px 1fr 36px"><span class="mut small">Wear</span><div class="bar"><i style="width:${c.wear * 100}%;background:${c.wear > 0.75 ? '#ff5b5b' : c.wear > 0.5 ? '#f5c518' : '#2ecc71'}"></i></div><b class="small">${Math.round(c.wear * 100)}%</b></div>
      <div class="small">Last lap ${fmtTime(c.lastLap)} · Best ${fmtTime(c.best)}</div>`}`; return; }
    const pos = ord.indexOf(c) + 1;
    const wearCol = c.wear > 0.75 ? '#ff5b5b' : c.wear > 0.5 ? '#f5c518' : '#2ecc71';
    const ahead = ord[pos - 2], behind = ord[pos];
    const gapA = ahead && !c.out && !ahead.out ? ((ahead.dist - c.dist) / (RACE.L / c.curLT)).toFixed(1) : '—';
    const gapB = behind && !c.out && !behind.out ? ((c.dist - behind.dist) / (RACE.L / c.curLT)).toFixed(1) : '—';
    el.innerHTML = `<div class="row"><b style="color:${c.t.color}">P${pos}</b><b class="sp">${esc(c.d.name)}</b>${tyreB(c.tyre)}<span class="small mut">${c.age}L</span></div>
    ${c.out ? `<div class="bad">Retired: ${esc(c.out)}</div>` : c.finished ? '<div>🏁 Finished</div>' : `
    <div class="small mut">Ahead ${gapA}s · Behind ${gapB}s · Stops ${c.stops}${c.pitT > 0 ? ' · <b class="warn">IN PIT</b>' : ''}</div>
    <div class="stat" style="grid-template-columns:50px 1fr 36px"><span class="mut small">Wear</span><div class="bar"><i style="width:${c.wear * 100}%;background:${wearCol}"></i></div><b class="small">${Math.round(c.wear * 100)}%</b></div>
    <div class="seg" style="margin:4px 0">${[['save', 'Save tyres'], ['std', 'Standard'], ['push', 'Push']].map(([k, v]) => `<button class="sm ${c.mode === k ? 'on' : ''}" data-a="mode" data-d="${c.d.id}" data-v="${k}">${v}</button>`).join('')}</div>
    <div class="row small">${c.pitReq ? `<span class="warn sp">Boxing this lap → ${TYRES[c.pitReq].name}</span><button class="sm" data-a="pit" data-d="${c.d.id}" data-v="">Cancel</button>` : `<span class="mut">Box for:</span>${Object.keys(TYRES).map(k => `<button class="sm" data-a="pit" data-d="${c.d.id}" data-v="${k}">${tyreB(k)}</button>`).join('')}`}</div>
    <label class="row small" style="margin-top:4px"><input type="checkbox" data-a="rauto" data-d="${c.d.id}" ${c.auto ? 'checked' : ''}> Auto strategy</label>`}`;
  });
}
function finishRace() {
  cancelAnimationFrame(raf);
  if (RACE.sprint) { WK.sprintRows = applySprintResult(G, RACE); WK.stage = 'sresults'; }
  else { WK.applied = applyRaceResult(G, RACE, WK); WK.stage = 'results'; }
  autosave(); raceBanner = ''; PAUSED = false;
  render(); window.scrollTo(0, 0);
}
function wkResults() {
  const { summary, moneyLog } = WK.applied;
  const m = moneyLog.player;
  const last = G.round >= G.cal.length;
  const mineRows = summary.rows.filter(r => G.player ? r.team === G.player : r.id === G.follow);
  return `<div class="grid g2"><div class="card hl"><h3>${G.spectator ? 'Race result' : 'Your weekend'}</h3>
  ${G.spectator ? `<div class="big">🏆 ${esc(summary.rows[0].name)}</div><div class="mut">${esc(G.teams[summary.rows[0].team].name)} · podium: ${summary.rows.slice(1, 3).map(r => esc(r.code)).join(', ')}</div>` : ''}
  ${mineRows.map(r => `<div class="${G.spectator ? '' : 'big'}" style="${G.spectator ? 'margin-top:8px' : ''}">${G.spectator ? '⭐ ' : ''}${r.out ? 'DNF' : 'P' + r.pos} <span class="mut" style="font-size:16px">${esc(r.name)} · from P${r.grid}${r.pts ? ' · +' + r.pts + ' pts' : ''}</span></div>`).join('')}
  ${m ? `<table style="margin-top:8px"><tr><td>Sponsor & points income</td><td class="good" style="text-align:right">+${fmtM(m.income)}</td></tr><tr><td>Operations</td><td class="bad" style="text-align:right">-${fmtM(m.ops)}</td></tr><tr><td>Salaries</td><td class="bad" style="text-align:right">-${fmtM(m.salaries)}</td></tr>${m.crash ? `<tr><td>Crash damage</td><td class="bad" style="text-align:right">-${fmtM(m.crash)}</td></tr>` : ''}</table>` : ''}
  ${WK.applied.done.length && !G.spectator ? `<div class="small" style="margin-top:6px">🔬 Upgrades delivered: ${WK.applied.done.map(p => `${RD_AREAS[p.area].name} ${p.result >= 0 ? '+' : ''}${p.result.toFixed(2)}`).join(', ')}</div>` : ''}
  ${summary.fastest ? `<div class="small mut" style="margin-top:6px">Fastest lap: ${summary.fastest.code} ${fmtTime(summary.fastest.t)}${G.rules && G.rules.fl ? ' (+1 pt)' : ''}</div>` : ''}
  ${G.timeline && WK.track.realWin >= 0 ? `<div class="small" style="margin-top:6px">📜 In real life, <b>${esc(histDriverName(WK.track.realWin))}</b> won this race.</div>` : ''}
  <div class="small" style="margin-top:8px">Championship: ${standingsDrivers(G).slice(0, 3).map((d, i) => `${i + 1}. ${esc(d.code)} ${d.pts}`).join(' · ')}</div>
  <button class="pri" style="margin-top:12px" data-a="${last ? 'endseason' : 'tohq'}">${last ? 'Season review →' : 'Back to HQ →'}</button></div>
  <div class="card"><h3>Classification</h3>${resultTable(summary.rows)}</div></div>`;
}

// ---------- Season end ----------
let SEASON_SUM = null;
function viewSeasonEnd() {
  const s = SEASON_SUM;
  return `<div class="grid g2"><div class="card hl"><h3>Season ${s.year} review</h3>
  <div class="big">🏆 ${s.champ ? esc(s.champ.name) : '—'}</div><div class="mut">Drivers' champion${s.champ ? ' · ' + esc(s.champ.teamName || (G.teams[s.champ.team] ? G.teams[s.champ.team].name : '')) : ''}</div>
  <div class="big" style="margin-top:8px">${tbar(s.cchamp.id)}${esc(s.cchamp.name)}</div><div class="mut">${s.timeline && s.year < 1958 ? "Top constructor (the official title began in 1958)" : "Constructors' champion"}</div>
  ${s.realChamp ? `<div class="news" style="margin-top:10px">📜 In real life, <b>${esc(s.realChamp)}</b> won the ${s.year} title${s.realCChamp ? ` and <b>${esc(s.realCChamp)}</b> the constructors'` : ''}. ${s.champ && s.champ.name === s.realChamp ? 'History repeated itself!' : 'History has been rewritten!'}</div>` : ''}
  ${G.spectator ? '' : `<div style="margin-top:12px">You finished <b>P${s.playerPos}</b> and earned <b class="good">${fmtM(s.myPrize ?? s.prizes[G.player] ?? 0)}</b> prize money.</div>`}
  ${s.lostTeam ? `<div class="banner" style="margin-top:10px">Your team doesn't enter the ${G.year} championship — you'll pick a new team next.</div>` : ''}
  ${s.handover ? `<div class="banner" style="margin-top:10px;background:#a8822e">That's the end of real history. From ${G.year} on, the sport evolves on its own: drivers age and retire, rookies arrive, and contracts matter.</div>` : ''}
  <button class="pri" style="margin-top:14px" data-a="tohq">${G.spectator ? 'On to ' + G.year + ' →' : 'Into the ' + G.year + ' off-season →'}</button></div>
  <div class="card"><h3>${s.timeline ? `Arriving for ${G.year}` : 'Driver market moves'}</h3>${s.retired.length ? `<div class="small"><b>Retired:</b> ${s.retired.map(esc).join(', ')}</div>` : ''}
  <div class="small" style="margin-top:6px">${s.moves.map(m => `<div class="news">${esc(m)}</div>`).join('') || (s.timeline ? '' : 'No changes.')}</div>
  ${s.rookies.length ? `<div class="small ${s.timeline ? '' : 'mut'}" style="margin-top:6px">${s.timeline ? 'New faces on the grid' : 'New talent on the market'}: ${s.rookies.map(esc).join(', ')}</div>` : ''}</div></div>`;
}

// ---------- Actions ----------
const A = {
  newgame() { SETUP = { era: 'modern', year: 1950, mode: 'manager', team: null, follow: null, difficulty: 'normal', preset: 'off', cal: CAL_2026.slice(), sprints: SPRINT_2026.slice() }; VIEW = 'setup'; render(); window.scrollTo(0, 0); },
  newspec() { A.newgame(); SETUP.mode = 'spectator'; render(); },
  setmode(el) { SETUP.mode = el.dataset.v; render(); },
  pickfav(el) { SETUP.follow = SETUP.follow === el.dataset.v ? null : el.dataset.v; render(); },
  setfav(el) { G.follow = el.dataset.v; autosave(); closeModal(); render(); toast('Following ' + G.drivers[el.dataset.v].name); },
  continue() { G = loadSave(); fixSave(G); VIEW = 'hq'; TAB = 'home'; render(); },
  totitle() { VIEW = 'title'; render(); },
  pickteam(el) { SETUP.team = el.dataset.v; render(); },
  diff(el) { SETUP.difficulty = el.dataset.v; render(); },
  calpreset(el) {
    SETUP.preset = el.dataset.v;
    if (el.dataset.v === 'custom') { CALED = { cal: SETUP.cal.slice(), sprints: SETUP.sprints.slice(), title: 'new game', back: 'setup', apply: (c, sp) => { SETUP.cal = c; SETUP.sprints = sp; } }; VIEW = 'caled'; }
    else SETUP.cal = presetCal(el.dataset.v);
    render();
  },
  startgame() {
    if (SETUP.era === 'hist') { if (SETUP.mode !== 'spectator' && !SETUP.team) return; G = newTimelineGame({ year: SETUP.year, team: SETUP.team, spectator: SETUP.mode === 'spectator', follow: SETUP.mode === 'spectator' ? SETUP.follow : null, difficulty: SETUP.difficulty }); VIEW = 'hq'; TAB = 'home'; autosave(); render(); window.scrollTo(0, 0); return; }
    if (SETUP.cal.length < 3) return toast('Pick at least 3 races'); G = newGame({ team: SETUP.team, difficulty: SETUP.difficulty, cal: SETUP.cal, sprints: SETUP.sprints.filter(id => SETUP.cal.includes(id)), spectator: SETUP.mode === 'spectator', follow: SETUP.mode === 'spectator' ? SETUP.follow : null }); VIEW = 'hq'; TAB = 'home'; autosave(); render(); window.scrollTo(0, 0); },
  setera(el) { SETUP.era = el.dataset.v; SETUP.team = null; SETUP.follow = null; render(); },
  yearstep(el) { SETUP.year = clamp(SETUP.year + +el.dataset.v, HIST_FIRST, HIST_LAST); SETUP.team = null; SETUP.follow = null; render(); },
  newhist() { A.newgame(); SETUP.era = 'hist'; render(); },
  pickhistteam(el) { pickTimelineTeam(G, el.dataset.v); autosave(); render(); },
  tab(el) { TAB = el.dataset.v; render(); window.scrollTo(0, 0); },
  sub(el) { SUB[el.dataset.k] = el.dataset.v; render(); },
  editcal(el) {
    const now = el.dataset.v === 'now';
    CALED = { cal: (now ? G.cal : (G.calNext || G.cal)).slice(), sprints: (now ? G.sprints : (G.sprintsNext || G.sprints) || []).slice(), title: now ? `${G.year} season` : `${G.year + 1} season`, back: 'hq', apply: (c, sp) => { if (now) { G.cal = c; G.sprints = sp; } else { G.calNext = c; G.sprintsNext = sp; } autosave(); } };
    VIEW = 'caled'; render();
  },
  caltog(el) { const id = el.dataset.v; const i = CALED.cal.indexOf(id); if (i >= 0) { CALED.cal.splice(i, 1); CALED.sprints = CALED.sprints.filter(x => x !== id); } else { if (CALED.cal.length >= 30) return toast('Max 30 races'); CALED.cal.push(id); } render(); },
  calsprint(el) { const id = el.dataset.v; const i = CALED.sprints.indexOf(id); if (i >= 0) CALED.sprints.splice(i, 1); else CALED.sprints.push(id); render(); },
  calmv(el) { const i = +el.dataset.v, d = +el.dataset.d, j = i + d; if (j < 0 || j >= CALED.cal.length) return; [CALED.cal[i], CALED.cal[j]] = [CALED.cal[j], CALED.cal[i]]; render(); },
  calshuf() { CALED.cal.sort(() => Math.random() - 0.5); render(); },
  calreset() { CALED.cal = CAL_2026.slice(); CALED.sprints = SPRINT_2026.slice(); render(); },
  calclear() { CALED.cal = []; CALED.sprints = []; render(); },
  calfilt(el) { CALED.filter = el.dataset.v; render(); },
  caldone() { if (CALED.cal.length < 3) return toast('Pick at least 3 races'); CALED.apply(CALED.cal.slice(), CALED.sprints.filter(id => CALED.cal.includes(id))); VIEW = CALED.back; render(); },
  gowk() { startWeekend(); },
  gowkrace() { startWeekend(); A.autorace(); },
  autorace() {
    let guard = 0;
    while (!['race', 'sprint', 'results', 'sresults'].includes(WK.stage) && guard++ < 30) {
      if (WK.stage === 'fp') { if (WK.session <= WK.sessions) A.runfp(true); else A.toquali(true); }
      else if (WK.stage === 'squali' || WK.stage === 'quali') { const QS = WK[WK.stage === 'squali' ? 'SQ' : 'Q']; if (QS.stage <= 3) A.runq(true); else A.togrid(true); }
      else if (WK.stage === 'sgrid' || WK.stage === 'grid') A.startrace(true);
    }
    render(); window.scrollTo(0, 0);
  },
  prog(el) { WK.programs[el.dataset.d] = el.dataset.v; render(); },
  runfp(el) {
    const progs = {}; myEntries().forEach(e => progs[e.d.id] = WK.programs[e.d.id] || 'setup');
    WK.fp.push(runPractice(G, WK, WK.session, progs)); WK.session++; if (!el || el.dataset) render();
  },
  skipfp() { while (WK.session <= WK.sessions) A.runfp(true); render(); },
  toquali(q) { if (WK.stage === 'fp' && WK.sprint) { WK.stage = 'squali'; WK.SQ.alive = WK.entries.slice(); } else { WK.stage = 'quali'; WK.Q.alive = WK.entries.slice(); } if (q !== true) { render(); window.scrollTo(0, 0); } },
  risk(el) { WK.risks[el.dataset.d] = el.dataset.v; render(); },
  runq(q) {
    const QS = WK[WK.stage === 'squali' ? 'SQ' : 'Q'];
    const res = runQualiSession(G, WK, QS.alive, QS.stage, WK.risks);
    QS.rounds.push({ stage: QS.stage, res });
    if (G.rules && G.rules.quali === 'single' && WK.stage === 'quali') { QS.top = res; QS.stage = 4; WK.grid = res.map(r => r.e); if (q !== true) render(); return; }
    const cut = qCut(WK.entries.length);
    if (QS.stage === 1) { QS.out1 = res.slice(-cut); QS.alive = res.slice(0, res.length - cut).map(r => r.e); }
    else if (QS.stage === 2) { QS.out2 = res.slice(-cut); QS.alive = res.slice(0, res.length - cut).map(r => r.e); }
    else QS.top = res;
    QS.stage++;
    if (QS.stage > 3) { const grid = QS.top.map(r => r.e).concat(QS.out2.map(r => r.e), QS.out1.map(r => r.e)); if (WK.stage === 'squali') WK.sgrid = grid; else WK.grid = grid; }
    if (q !== true) render();
  },
  togrid(q) { WK.stage = WK.stage === 'squali' ? 'sgrid' : 'grid'; if (q !== true) render(); },
  stt(el) { const e = WK.entries.find(e => e.d.id === el.dataset.d); if (WK.stage === 'sgrid') e.sStartTyre = el.dataset.v; else e.startTyre = el.dataset.v; render(); },
  autostrat(el) { WK.entries.find(e => e.d.id === el.dataset.d).auto = el.checked; },
  startrace(q) {
    const sprint = WK.stage === 'sgrid';
    const grid = sprint ? WK.sgrid : WK.grid;
    WK.entries.forEach(e => {
      const mine = e.t.id === G.player;
      const pickAI = () => grid.indexOf(e) < 10 ? pick(['M', 'M', 'S']) : pick(['M', 'H', 'H', 'S']);
      e.startTyre = sprint ? (e.sStartTyre || (mine ? 'M' : pick(['M', 'M', 'S', 'S', 'H']))) : (e.startTyre || (mine ? 'M' : pickAI()));
    });
    RACE = sprint ? new Race(G, WK, grid, { sprint: true, laps: sprintLaps(WK.track), weather: WK.sweather }) : new Race(G, WK, grid);
    WK.stage = sprint ? 'sprint' : 'race'; PAUSED = false; SPEED = 16; raceBanner = '';
    if (q !== true) { render(); window.scrollTo(0, 0); }
  },
  follow(el) { if (!RACE) return; const id = el.dataset.v; G.follow = G.follow === id && !G.spectator ? null : id; RACE.cars.forEach(c => c.fav = c.d.id === G.follow); buildCtrls(); updateRaceUI(); },
  chaos(el) { if (!RACE || RACE.done) return; const v = el.dataset.v; if (v === 'rain') RACE.makeRain(); if (v === 'dry') RACE.stopRain(); if (v === 'sc') RACE.startSC(); if (v === 'vsc') RACE.startVSC(); if (v === 'crash') RACE.randomIncident(); RACE.events = []; updateRaceUI(); },
  spd(el) { if (el.dataset.v === 'pause') PAUSED = true; else { PAUSED = false; SPEED = +el.dataset.v; raceBanner = ''; const b = document.getElementById('rbanner'); if (b) { b.className = ''; b.textContent = ''; } } document.querySelectorAll('.spd').forEach(x => x.classList.toggle('on', el.dataset.v === 'pause' ? x.dataset.v === 'pause' : (!PAUSED && +x.dataset.v === SPEED))); },
  simend() { let n = 0; while (!RACE.done && n < 400000) { RACE.step(0.25); n++; } RACE.events = []; },
  mode(el) { const c = RACE.cars.find(c => c.d.id === el.dataset.d); c.mode = el.dataset.v; c.curLT = RACE.lapTime(c, c.laps) - (c.laps === 0 ? 0 : 0); updateRaceUI(); },
  pit(el) { const c = RACE.cars.find(c => c.d.id === el.dataset.d); c.pitReq = el.dataset.v || null; updateRaceUI(); },
  rauto(el) { const c = RACE.cars.find(c => c.d.id === el.dataset.d); c.auto = el.checked; },
  tohq() { VIEW = 'hq'; TAB = 'home'; WK = null; RACE = null; render(); window.scrollTo(0, 0); },
  endseason() { SEASON_SUM = G.timeline ? endSeasonTimeline(G) : endSeason(G); autosave(); VIEW = 'season'; render(); window.scrollTo(0, 0); },
  rd(el) {
    const s = RD_SIZES[el.dataset.size], me = G.teams[G.player];
    if (G.projects.length >= 3 || me.spent + s.cost > capFor(G) || me.money < s.cost) return toast('Not possible right now');
    me.money -= s.cost; me.spent += s.cost; G.projects.push({ area: el.dataset.area, size: el.dataset.size, left: s.races });
    toast(`${s.name} ${RD_AREAS[el.dataset.area].name} project started`); autosave(); render();
  },
  drv(el) { openDriver(el.dataset.v); },
  close() { closeModal(); },
  offer(el) { doOffer(el.dataset.v, el.dataset.mode, +el.dataset.buy); },
  release(el) {
    const d = G.drivers[el.dataset.v], me = G.teams[G.player];
    const left = G.round >= G.cal.length ? 0 : (G.cal.length - G.round) / G.cal.length;
    me.money -= d.salary * left * 0.5; d.team = null; d.until = 0; news(G, `👋 ${me.name} release ${d.name}.`); closeModal(); autosave(); render();
  },
  save() { toast(save(G) ? 'Saved' : 'Could not save in this browser — use Export'); },
  export() { const code = exportCode(G); modal(`<div class="row"><h2 class="sp">Save code</h2><button class="sm" data-a="close">✕</button></div><div class="small mut">Copy this and keep it somewhere safe. Paste it into Import to continue on any device.</div><textarea id="exp" style="width:100%;height:140px;margin:8px 0">${code}</textarea><button class="pri" data-a="copyexp">Copy</button>`); },
  copyexp() { const t = document.getElementById('exp'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Copied'), () => { document.execCommand && document.execCommand('copy'); toast('Copied'); }); },
  importui() { modal(`<div class="row"><h2 class="sp">Import save</h2><button class="sm" data-a="close">✕</button></div><textarea id="imp" style="width:100%;height:140px;margin:8px 0" placeholder="Paste save code"></textarea><button class="pri" data-a="doimport">Load</button>`); },
  doimport() { try { G = importCode(document.getElementById('imp').value); fixSave(G); closeModal(); VIEW = 'hq'; TAB = 'home'; autosave(); render(); toast('Loaded'); } catch (e) { toast('That code didn\'t work'); } },
  set(el) { G[el.dataset.v] = el.checked; autosave(); },
  setdiff(el) { G.difficulty = el.dataset.v; autosave(); render(); }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a; if (!A[a]) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // handled on change
  A[a](el);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-a]'); if (el && el.tagName === 'INPUT' && el.type === 'checkbox' && A[el.dataset.a]) A[el.dataset.a](el); });
render();
