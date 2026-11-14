// ===================== Desktop: standings, results screens, global theme =====================
const DK2 = { st: 'd', legend: true, modern: true, markers: 0, panel: 'grid' };
const DK_MARKERS = ['none', 'pole & fastest lap', 'sprint results'];
const dkMine = r => G.player ? r.team === G.player : r.id === G.follow;
function dkCsv(name, rows) {
  const csv = rows.map(r => r.map(x => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
const dkTeamCell = tid => { const t = G.teams[tid]; return t ? `<td class="l tcell" style="--tc:${t.color};--ti:${dkInk(t.color)}">${esc(t.name)}</td>` : '<td class="l">—</td>'; };
const dkEngCell = tid => { const t = G.teams[tid]; if (!t) return '<td></td>'; const e = G.engines[t.engine]; const owner = Object.values(G.teams).find(x => x.works && x.engine === t.engine) || t;
  return `<td class="l tcell" style="--tc:${owner.color};--ti:${dkInk(owner.color)}">${esc(e ? e.name : '')}</td>`; };

// ---------- result cell colouring ----------
function dkResCls(r) { if (!r) return ''; if (r.out) return /disq/i.test(r.out) ? 'c-dsq' : 'c-ret'; if (r.pos === 1) return 'c-1'; if (r.pos === 2) return 'c-2'; if (r.pos === 3) return 'c-3'; return r.pts > 0 ? 'c-pts' : 'c-np'; }
function dkResTxt(r, res) {
  if (!r) return ''; let t = r.out ? (/disq/i.test(r.out) ? 'DSQ' : 'RET') : String(r.pos);
  if (DK2.markers === 1) { if (r.grid === 1) t = `<b class="pl">${t}</b>`; if (res.fastest && res.fastest.code === r.code) t = `<i>${t}</i>`; }
  if (DK2.markers === 2 && res.sprint) { const s = res.sprint.find(x => x.id === r.id); if (s && !s.out) t += `<sup>${s.pos}</sup>`; }
  return t;
}

// ---------- championship standings ----------
function deskStandings() {
  const rounds = G.cal.length, done = G.results.length, mode = DK2.st;
  const flags = G.cal.map((id, i) => { const t = roundTrack(G, i); return `<th class="fl ${i < done ? '' : 'todo'}" title="R${i + 1} ${esc(t.short)}">${dkFlag(t.cc)}</th>`; }).join('');
  let body = '';
  if (DK2.panel === 'graph') body = dkPointsGraph(mode);
  else if (DK2.panel === 'hist') body = dkHistory();
  else if (mode === 'd') {
    const sd = standingsDrivers(G).filter(d => d.team || d.pts > 0 || G.results.some(r => r.rows.some(x => x.id === d.id)));
    body = `<div class="dk-h"><b>Driver Championship</b></div><div class="dk-scroll"><table class="dkst ${DK2.modern ? 'modern' : 'classic'}"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Driver</th><th></th><th class="l">Team</th>${flags}<th class="pts">Pts</th></tr></thead><tbody>${sd.map((d, i) => {
      const cells = G.cal.map((_, k) => { const res = G.results[k]; const r = res && res.rows.find(x => x.id === d.id); return `<td class="rc ${dkResCls(r)}">${r ? dkResTxt(r, res) : ''}</td>`; }).join('');
      const tc = d.team ? G.teams[d.team].color : '#444';
      return `<tr class="${(G.player ? d.team === G.player : d.id === G.follow) ? 'me' : ''}"><td class="pos" style="border-left:3px solid ${tc}">${i + 1}</td><td class="l nm">${esc(d.name)}</td><td class="flc">${dkFlag(d.nat)}</td>${d.team ? dkTeamCell(d.team) : '<td class="l dim">—</td>'}${cells}<td class="pts">${d.pts}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else {
    body = `<div class="dk-h"><b>Constructor Championship</b></div><div class="dk-scroll"><table class="dkst cons ${DK2.modern ? 'modern' : 'classic'}"><thead><tr><th class="stk0">Pos</th><th class="l stk1">Team</th><th class="l">Engine</th>${flags}<th class="pts">Pts</th></tr></thead><tbody>${standingsTeams(G).map((t, i) => {
      const cells = G.cal.map((_, k) => { const res = G.results[k]; if (!res) return '<td class="rc"></td>'; const rs = res.rows.filter(x => x.team === t.id).sort((a, b) => (a.out ? 99 : a.pos) - (b.out ? 99 : b.pos));
        return `<td class="rc2">${rs.map(r => `<div class="${dkResCls(r)}">${dkResTxt(r, res)}</div>`).join('')}</td>`; }).join('');
      return `<tr class="${t.id === G.player ? 'me' : ''}"><td class="pos" style="border-left:3px solid ${t.color}">${i + 1}</td>${dkTeamCell(t.id).replace('class="l tcell"', 'class="l tcell stk1"')}${dkEngCell(t.id)}${cells}<td class="pts">${t.pts}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  const legend = [['c-1', '1st'], ['c-2', '2nd'], ['c-3', '3rd'], ['c-pts', 'Pts'], ['c-np', 'No pts'], ['c-ret', 'RET'], ['c-dsq', 'DSQ']];
  return `<div class="dk dk-page" id="dk"><div class="dk-pagehead"><h1>Championship Standings</h1><span class="sp"></span><span class="dk-mut">${G.year} · Round ${done} of ${rounds}${G.spectator ? ' · Spectator' : ' · ' + esc(G.teams[G.player] ? G.teams[G.player].name : '')}</span><button data-a="tab" data-v="home">Back</button></div>
  <div class="dk-pagebar"><span class="dk-tabs2">${[['d', 'Drivers'], ['t', 'Constructors']].map(([k, v]) => `<button class="${mode === k && DK2.panel === 'grid' ? 'on' : ''}" data-a="dkst" data-v="${k}">${v}</button>`).join('')}</span>
    <button data-a="dkst2" data-v="legend">${DK2.legend ? 'Hide' : 'Show'} legend</button><button data-a="dkst2" data-v="color">${DK2.modern ? 'Modern' : 'Classic'} coloring</button><button data-a="dkst2" data-v="markers">Markers: ${DK_MARKERS[DK2.markers]}</button>
    <span class="sp"></span><button class="${DK2.panel === 'graph' ? 'on' : ''}" data-a="dkst2" data-v="graph">Points Graph</button><button class="${DK2.panel === 'hist' ? 'on' : ''}" data-a="dkst2" data-v="hist">History</button></div>
  <section class="dk-stbox">${body}</section>
  ${DK2.legend && DK2.panel === 'grid' ? `<div class="dk-legend ${DK2.modern ? 'modern' : 'classic'}">${legend.map(([c, l]) => `<span class="${c}">${l}</span>`).join('')}${DK2.markers === 1 ? '<span class="dk-mut"><b>Bold</b> = pole · <i>Italic</i> = fastest lap</span>' : DK2.markers === 2 ? '<span class="dk-mut">Superscript = sprint finish</span>' : ''}</div>` : ''}</div>`;
}
function dkPointsGraph(mode) {
  const N = G.results.length; if (!N) return '<div class="dk-empty">No races yet — the points graph appears after round 1.</div>';
  const series = mode === 'd'
    ? standingsDrivers(G).slice(0, 10).map(d => ({ name: d.code, col: d.team ? G.teams[d.team].color : '#888', pts: G.results.map(r => { const x = r.rows.find(y => y.id === d.id); const s = r.sprint && r.sprint.find(y => y.id === d.id); return (x ? x.pts : 0) + (s ? s.pts || 0 : 0); }) }))
    : standingsTeams(G).map(t => ({ name: t.name, col: t.color, pts: G.results.map(r => r.rows.filter(y => y.team === t.id).reduce((a, y) => a + y.pts, 0) + (r.sprint ? r.sprint.filter(y => y.team === t.id).reduce((a, y) => a + (y.pts || 0), 0) : 0)) }));
  series.forEach(s => { let c = 0; s.cum = s.pts.map(p => c += p); });
  const max = Math.max(1, ...series.map(s => s.cum[N - 1])), W = 1000, H = 420, L = 50, R = 140, T = 20, B = 40;
  const X = i => L + (N === 1 ? 0 : i / (N - 1)) * (W - L - R), Y = v => T + (1 - v / max) * (H - T - B);
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${Y(max * f)}" y2="${Y(max * f)}" stroke="#1b2742"/><text x="${L - 8}" y="${Y(max * f) + 4}" fill="#7f8aa3" font-size="12" text-anchor="end">${Math.round(max * f)}</text>`).join('');
  const xs = G.results.map((r, i) => `<text x="${X(i)}" y="${H - 14}" fill="#7f8aa3" font-size="11" text-anchor="middle">R${r.round}</text>`).join('');
  const labels = series.map(s => ({ s, y: Y(s.cum[N - 1]) })).sort((a, b) => a.y - b.y); for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 13); for (let i = labels.length - 1; i >= 0; i--) labels[i].y = Math.min(labels[i].y, (i === labels.length - 1 ? H - B : labels[i + 1].y - 13));
  const lines = series.map(s => `<polyline fill="none" stroke="${s.col}" stroke-width="2.5" points="${s.cum.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>${s.cum.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${s.col}"><title>${esc(s.name)} R${i + 1}: ${v}</title></circle>`).join('')}`).join('');
  const lab = labels.map(({ s, y }) => `<text x="${W - R + 8}" y="${y + 4}" fill="${s.col}" font-size="12" font-weight="700">${esc(s.name)} ${s.cum[N - 1]}</text>`).join('');
  return `<div class="dk-h"><b>${mode === 'd' ? 'Drivers — top 10' : 'Constructors'} · cumulative points</b></div><div class="dk-graph"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${xs}${lines}${lab}</svg></div>`;
}
function dkHistory() {
  if (!G.history.length) return '<div class="dk-empty">Finish a season to start your history book.</div>';
  return `<div class="dk-h"><b>Season history</b></div><div class="dk-scroll"><table class="dkres"><thead><tr><th>Year</th><th class="l">Drivers' champion</th><th>Pts</th><th class="l">Constructors' champion</th><th>Pts</th>${G.spectator ? '' : '<th class="l">You</th>'}</tr></thead><tbody>${G.history.slice().reverse().map(h => `<tr><td>${h.year}</td><td class="l">${h.champ ? esc(h.champ.name) : '—'}${h.realChamp && h.champ && h.realChamp !== h.champ.name ? ` <span class="dk-mut">(real: ${esc(h.realChamp)})</span>` : ''}</td><td>${h.champ ? h.champ.pts : ''}</td>${G.teams[h.cchamp.id] ? dkTeamCell(h.cchamp.id) : `<td class="l">${esc(h.cchamp.name)}</td>`}<td>${h.cchamp.pts}</td>${G.spectator ? '' : `<td class="l">P${h.playerPos} · ${h.playerPts} pts${h.teamName ? ' · ' + esc(h.teamName) : ''}</td>`}</tr>`).join('')}</tbody></table></div>`;
}

// ---------- qualifying results screen ----------
function deskQualiRes(key) {
  const I = qualiInfo(key), QS = I.QS, t = WK.track, done = QS.stage > 3, last = QS.rounds[QS.rounds.length - 1], mine = myEntries();
  const name = I.sprint ? 'Sprint Qualifying' : 'Qualifying';
  let title, rows, cut = null, cols3 = false;
  if (!last) title = `${name} - ${esc(t.short)}`;
  else if (done) {
    title = `${name} Results - ${esc(t.short)}`;
    const grid = I.sprint ? WK.sgrid : WK.grid;
    const timeIn = (e, st) => { const r = QS.rounds.find(x => x.stage === st); const x = r && r.res.find(y => y.e === e); return x ? x : null; };
    cols3 = !I.single && QS.rounds.length >= 3;
    rows = grid.map(e => { const q = [1, 2, 3].map(s => timeIn(e, s)); const best = I.single ? timeIn(e, last.stage) : [...q].reverse().find(x => x && x.t != null) || q.find(Boolean); return { e, q, best }; });
  } else {
    title = `${I.single ? name : (I.sprint ? 'SQ' : 'Q') + last.stage} Results - ${esc(t.short)}`;
    rows = last.res.map(x => ({ e: x.e, best: x })); cut = last.stage < 3 && !I.single ? last.res.length - qCut(WK.entries.length) : null;
  }
  const tyre = TYRES[WK.weather.quali > 0.65 ? 'W' : WK.weather.quali > 0.25 ? 'I' : 'S'].name;
  const lead = rows && rows.find(r => r.best && r.best.t != null);
  const fmt = x => !x ? '' : x.crash || x.t == null ? 'NO TIME' : fmtTime(x.t);
  const table = rows ? `<table class="dkfp"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="l hm">Engine</th><th class="l">Tyre</th>${cols3 ? '<th class="ra">Q1</th><th class="ra">Q2</th><th class="ra">Q3</th>' : '<th class="ra">Lap</th>'}<th class="ra">Gap</th></tr></thead><tbody>${rows.map((r, i) => {
    const e = r.e, gap = i === 0 || !r.best || r.best.t == null || !lead ? '--' : cols3 && i >= 10 ? '' : '+' + (r.best.t - lead.best.t).toFixed(3);
    return `<tr class="${isMine(e) ? 'me' : ''} ${cut != null && i >= cut ? 'elim' : ''} ${cut === i ? 'cut' : ''}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="l hm">${esc(e.t.name)}</td><td class="l hm">${esc(dkEngine(e.t))}</td><td class="l">${tyre}</td>
    ${cols3 ? r.q.map(x => `<td class="ra">${fmt(x)}</td>`).join('') : `<td class="ra">${fmt(r.best)}</td>`}<td class="ra">${gap}</td></tr>`; }).join('')}</tbody></table>` : '';
  const riskBtns = e => [['safe', 'Safe'], ['normal', 'Normal'], ['all', 'All-out']].map(([k, v]) => `<button class="${(WK.risks[e.d.id] || 'normal') === k ? 'on' : ''}" data-a="risk" data-d="${e.d.id}" data-v="${k}">${v}</button>`).join('');
  const alive = QS.alive || WK.entries;
  const plan = !done && !G.spectator && mine.length ? `<div class="dk-fpplan">${mine.map(e => alive.includes(e) ? `<div class="dk-fpd" style="--tc:${e.t.color}"><b>${esc(e.d.name)}</b><span class="dk-seg">${riskBtns(e)}</span></div>` : `<div class="dk-fpd" style="--tc:${e.t.color}"><b>${esc(e.d.name)}</b><span class="dk-mut">knocked out</span></div>`).join('')}</div>` : '';
  const next = done ? `<button class="pri" data-a="togrid" data-enter="1">Continue</button>`
    : `<button data-a="runq">Skip ${I.label}</button><button class="pri" data-a="qlive" data-enter="1">Watch ${I.label} live</button>`;
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">${title}<span class="dk-mut">ROUND ${WK.round + 1} · ${G.year}${!done ? ` · NEXT: ${I.label} · ${Math.round(I.dur / 60)} MIN · ${I.n} CARS${I.cut ? ' · ' + I.cut + ' OUT' : ''}` : ''}</span></div>${plan}
  <div class="dk-fpbox">${table || `<div class="dk-fpempty"><div>${dkFlag(t.cc, 'xl')}</div><b>${esc(t.name)}</b><div class="dk-mut">${I.single ? 'One session · fastest lap takes pole' : 'Knockout qualifying: Q1 → Q2 → Q3'}${WK.weather.quali > 0.25 ? ' · 🌧️ wet session' : ''}</div><div class="dk-mut">${G.spectator ? 'Watch every flying lap live, or skip straight to the result.' : 'Choose how hard each driver pushes, then head out.'}</div></div>`}</div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">Press ENTER/SPACE or click ${done ? 'Continue' : 'Watch live'}.</span><span class="sp"></span>${last ? '<button data-a="dkqexport">Export Logs</button>' : ''}${next}</div></div>`;
}

// ---------- race / sprint results screen ----------
function deskRaceRes(sprint) {
  const t = WK.track, summary = sprint ? null : WK.applied.summary, rows = sprint ? WK.sprintRows : summary.rows, lead = rows[0];
  const last = G.round >= G.cal.length;
  const timeOf = r => r.out ? `DNF (${r.out.length > 14 ? r.out.split(/[ (]/)[0] : r.out})` : r.pos === 1 ? fmtTime(r.time) : r.laps < lead.laps ? '+' + (lead.laps - r.laps) + ' Lap' + (lead.laps - r.laps > 1 ? 's' : '') : '+' + (r.time - lead.time).toFixed(3);
  const ord = rows.filter(r => !r.out).concat(rows.filter(r => r.out));
  const table = `<table class="dkfp dkrr"><thead><tr><th>Pos</th><th>Grid</th><th class="l">Driver</th><th class="l hm">Team</th><th class="l hm">Engine</th><th class="hm">Stp</th><th class="hm">Laps</th><th class="ra">Time/Gap</th><th class="ra">Pts</th></tr></thead><tbody>${ord.map(r => { const tm = G.teams[r.team] || { color: '#444', name: '' }; const d = G.drivers[r.id];
    return `<tr class="${dkMine(r) ? 'me' : ''} ${r.out ? 'dnf' : ''}" style="--tc:${tm.color};--ti:${dkInk(tm.color)}"><td class="pos">${r.out ? '' : String(r.pos).padStart(2, '0')}</td><td>${r.grid || ''}</td><td class="l">${d ? dkFlag(d.nat) : ''} ${dkNm(r.name)}</td><td class="l hm">${esc(tm.name)}</td><td class="l hm">${esc(dkEngine(tm))}</td><td class="hm">${r.stops ?? ''}</td><td class="hm">${r.laps ?? ''}</td><td class="ra plain">${timeOf(r)}</td><td class="ra plain">${r.pts || 0}</td></tr>`; }).join('')}</tbody></table>`;
  // podium
  const pod = [rows[1], rows[0], rows[2]].map((r, k) => { if (!r) return '<div></div>'; const tm = G.teams[r.team] || {}; const d = G.drivers[r.id]; const p = [2, 1, 3][k];
    return `<div class="dkpod p${p}" style="--tc:${tm.color}"><div class="n">${p}</div><div class="f">${d ? dkFlag(d.nat, 'lg') : ''}</div><b>${esc(dkShort(r))}</b><span>${esc(tm.name || '')}</span><em>${p === 1 ? fmtTime(r.time) : timeOf(r)}</em></div>`; }).join('');
  // standings before/after
  const ptsNow = new Map(), ptsWas = new Map(), tNow = new Map(), tWas = new Map();
  Object.values(G.drivers).forEach(d => { ptsNow.set(d.id, d.pts || 0); ptsWas.set(d.id, d.pts || 0); });
  rows.forEach(r => ptsWas.set(r.id, (ptsWas.get(r.id) || 0) - (r.pts || 0)));
  Object.values(G.teams).forEach(tm => { tNow.set(tm.id, tm.pts); tWas.set(tm.id, tm.pts); }); rows.forEach(r => tWas.set(r.team, (tWas.get(r.team) || 0) - (r.pts || 0)));
  const nR = G.results.length, prevUpto = sprint ? nR : nR - 1; // results already include this GP (not the sprint)
  const dNow = standingsDrivers(G).map(d => d.id), dWas = standingsDrivers(G, prevUpto, d => ptsWas.get(d.id) || 0).map(d => d.id);
  const teNow = standingsTeams(G).map(t => t.id), teWas = standingsTeams(G, prevUpto, t => tWas.get(t.id) || 0).map(t => t.id);
  const fresh = prevUpto === 0 && new Set(ptsWas.values()).size <= 1;
  const delta = (id, now, was) => { if (fresh) return '<span class="dim">–</span>'; const a = now.indexOf(id), b = was.indexOf(id); const dd = b - a; return dd > 0 ? `<span class="g">▲+${dd}</span>` : dd < 0 ? `<span class="r">▼${dd}</span>` : '<span class="dim">–</span>'; };
  const dTab = dNow.slice(0, 10).map((id, i) => { const d = G.drivers[id]; return `<tr class="${(G.player ? d.team === G.player : id === G.follow) ? 'me' : ''}"><td>${i + 1}</td><td class="l">${dkFlag(d.nat)} ${esc(d.name)}</td><td class="ra">${ptsNow.get(id)}</td><td class="ra">${delta(id, dNow, dWas)}</td></tr>`; }).join('');
  const tTab = teNow.slice(0, 6).map((id, i) => { const tm = G.teams[id]; return `<tr class="${id === G.player ? 'me' : ''}"><td>${i + 1}</td><td class="l"><i class="tsw" style="background:${tm.color}"></i>${esc(tm.name)}</td><td class="ra">${tNow.get(id)}</td><td class="ra">${delta(id, teNow, teWas)}</td></tr>`; }).join('');
  const env = dkEnv(0, 0.5);
  const fl = summary && summary.fastest;
  const cont = sprint ? `<button class="pri" data-a="toquali" data-enter="1">Continue</button>` : `<button class="pri" data-a="${last ? 'endseason' : 'tohq'}" data-enter="1">Continue</button>`;
  return `<div class="dk dk-fp dk-res" id="dk"><div class="dk-reshead">${dkFlag(t.cc, 'lg')}<div><h1>${sprint ? 'Sprint' : 'Race'} Results - ${esc(t.short)}</h1><div class="dk-mut">${esc(t.name)} | Round ${WK.round + 1} of ${G.cal.length} | 🌡 Avg ${Math.round(env.air + 3)}°C | ${lead.laps} Laps${fl ? ` | ⏱ Fastest lap ${esc(fl.code)} ${fmtTime(fl.t)}` : ''}${G.timeline && t.realWin >= 0 && !sprint ? ` | 📜 Real winner: ${esc(histDriverName(t.realWin))}` : ''}</div></div></div>
  <div class="dk-resgrid"><div class="dk-fpbox">${table}</div>
    <div class="dk-resside"><section><div class="dk-h dk-c"><b>🏆 ${sprint ? 'SPRINT' : 'RACE'} PODIUM 🏆</b></div><div class="dkpods">${pod}</div></section>
    <section><div class="dk-h"><b>DRIVERS STANDINGS AFTER ${sprint ? 'SPRINT' : 'RACE'}</b><span class="sp"></span><span class="dk-mut">Top 10</span></div><table class="dkres"><thead><tr><th>#</th><th class="l">Driver</th><th class="ra">Pts</th><th class="ra">Δ</th></tr></thead><tbody>${dTab}</tbody></table></section>
    <section><div class="dk-h"><b>TEAMS STANDINGS AFTER ${sprint ? 'SPRINT' : 'RACE'}</b><span class="sp"></span><span class="dk-mut">Top 6</span></div><table class="dkres"><thead><tr><th>#</th><th class="l hm">Team</th><th class="ra">Pts</th><th class="ra">Δ</th></tr></thead><tbody>${tTab}</tbody></table></section></div></div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">ENTER or Continue to ${sprint ? 'go on to qualifying' : last ? 'see the season review' : 'return to HQ'}.</span><span class="sp"></span><button data-a="dkrexport" data-v="${sprint ? 's' : 'r'}">Export Logs</button>${sprint ? '' : '<button data-a="dkextras">Highlights &amp; Driver of the Day</button>'}${cont}</div></div>`;
}

// ---------- routing ----------
const _dk2_viewWeekend = viewWeekend;
viewWeekend = function () {
  if (deskOn() && WK && !DK2.extras) {
    if ((WK.stage === 'quali' || WK.stage === 'squali') && !(curQS().live && !curQS().live.done)) return deskQualiRes(WK.stage === 'squali' ? 'SQ' : 'Q');
    if (WK.stage === 'results' && WK.applied) return deskRaceRes(false);
    if (WK.stage === 'sresults' && WK.sprintRows) return deskRaceRes(true);
  }
  return _dk2_viewWeekend();
};
const _dk2_hqStandings = hqStandings;
hqStandings = function () { return deskOn() ? deskStandings() : _dk2_hqStandings(); };
const _dk2_render = render;
render = function () {
  if (VIEW !== 'weekend' || !WK || !['results', 'sresults'].includes(WK.stage)) DK2.extras = false;
  _dk2_render();
  document.body.classList.toggle('dt', deskOn());
  document.body.classList.toggle('dk-on', !!document.getElementById('dk'));
};
window.addEventListener('resize', () => { const want = deskOn(); if (document.body.classList.contains('dt') !== want && VIEW !== 'tracer' && VIEW !== 'studio') render(); });
document.addEventListener('keydown', e => {
  const dk = document.getElementById('dk'); if (!dk || document.getElementById('modal') || (e.target.closest && e.target.closest('input,textarea,select'))) return;
  if ((e.key === 'Enter' || e.key === ' ') && !dkStage()) { const b = dk.querySelector('[data-enter]'); if (b) { e.preventDefault(); b.click(); } }
});
Object.assign(A, {
  dkst(el) { DK2.st = el.dataset.v; DK2.panel = 'grid'; render(); },
  dkst2(el) { const v = el.dataset.v;
    if (v === 'legend') DK2.legend = !DK2.legend; else if (v === 'color') DK2.modern = !DK2.modern; else if (v === 'markers') DK2.markers = (DK2.markers + 1) % DK_MARKERS.length;
    else DK2.panel = DK2.panel === v ? 'grid' : v; render(); },
  dkextras() { DK2.extras = true; _dk2_render(); document.body.classList.remove('dk-on'); window.scrollTo(0, 0); },
  dkqexport() {
    const QS = curQS(), out = [['Session', 'Pos', 'Driver', 'Team', 'Engine', 'Lap', 'Gap']];
    QS.rounds.forEach(r => { const l = r.res.find(x => x.t != null); r.res.forEach((x, i) => out.push([(WK.stage === 'squali' ? 'SQ' : 'Q') + r.stage, i + 1, x.e.d.name, x.e.t.name, dkEngine(x.e.t), x.t != null ? fmtTime(x.t) : 'NO TIME', x.t != null && l && i ? (x.t - l.t).toFixed(3) : ''])); });
    dkCsv(`qualifying-${WK.track.id}-${G.year}.csv`, out);
  },
  dkrexport(el) {
    const rows = el.dataset.v === 's' ? WK.sprintRows : WK.applied.summary.rows;
    dkCsv(`${el.dataset.v === 's' ? 'sprint' : 'race'}-${WK.track.id}-${G.year}.csv`, [['Pos', 'Grid', 'Driver', 'Team', 'Engine', 'Stops', 'Laps', 'Time', 'Status', 'Points']].concat(rows.map(r => [r.out ? 'DNF' : r.pos, r.grid, r.name, G.teams[r.team] ? G.teams[r.team].name : '', G.teams[r.team] ? dkEngine(G.teams[r.team]) : '', r.stops, r.laps, r.time ? fmtTime(r.time) : '', r.out || 'Finished', r.pts || 0])));
  },
});
// menu switch for the broadcast layout (so it can be turned back on from the classic look)
const _dk2_hqMenu = hqMenu;
hqMenu = function () {
  let on = true; try { on = localStorage.getItem('pitwall_desk') !== 'off'; } catch (e) { }
  return _dk2_hqMenu() + `<div class="card" style="margin-top:12px"><h3>Layout</h3><label class="row"><input type="checkbox" data-a="dklayout" ${on ? 'checked' : ''}> Broadcast layout (results, standings, live timing &amp; telemetry screens)</label><div class="small mut" style="margin-top:6px">Turn off to use the classic layout on this device.</div></div>`;
};
A.dklayout = el => { try { localStorage.setItem('pitwall_desk', el.checked ? 'on' : 'off'); } catch (e) { } render(); };
