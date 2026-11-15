// ===================== Starting grid page + main menu in the broadcast style =====================

// ---------- starting grid (before the race / sprint) ----------
function deskGrid(sprint) {
  ensureXP(G);
  const t = WK.track, grid = sprint ? WK.sgrid : WK.grid, W = sprint ? WK.sweather : WK.weather, mine = myEntries(), dry = W.start <= 0.22;
  const laps = sprint ? sprintLaps(t) : t.laps, ac = typeof dkAcad === 'function' && dkAcad();
  const tyreOf = e => W.start > 0.62 ? 'W' : W.start > 0.22 ? 'I' : (sprint ? e.sStartTyre : e.startTyre) || (G.player && isMine(e) ? 'M' : null);
  // best qualifying time of each car (latest session it set a time in)
  const QS = sprint && !ac ? WK.SQ : WK.Q, qt = new Map();
  ((QS && QS.rounds) || []).forEach(r => r.res.forEach(x => { if (x.t != null && !x.crash) qt.set(x.e, x.t); }));
  const qOrder = (sprint && !ac ? WK.sgrid : WK.grid) || grid;
  const pen = new Map((WK.penalties || []).map(p => [p.code, p]));
  const name = sprint ? (ac ? 'Reverse Grid Race' : 'Sprint') : (ac ? 'Feature Race' : 'Grand Prix');
  const carOf = e => typeof hxCar === 'function' ? hxCar(G, e.t.id) : null;
  const makers = new Set(grid.map(e => { const c = carOf(e); return c && c[2] ? c[2].split(' / ')[0] : null; }).filter(Boolean)), tw = makers.size > 1;
  const rows = grid.map((e, i) => { const ty = tyreOf(e), q = qt.get(e), qp = qOrder.indexOf(e) + 1, p = pen.get(e.d.code), car = carOf(e);
    return `<tr class="${isMine(e) ? 'me' : ''}" data-prof="${e.d.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}${G.follow === e.d.id ? ' ⭐' : ''}</td><td class="l hm">${esc(e.t.name)}${car && car[0] ? ` <small class="dkx-car">${esc(car[0])}</small>` : ''}${e.standin ? ' <small class="dkx-car">one-off</small>' : ''}</td><td class="l hm">${esc(car && car[1] ? car[1] : dkEngine(e.t))}</td>${tw ? `<td class="l hm">${esc(car && car[2] ? car[2].split(' / ')[0] : '')}</td>` : ''}
      <td class="ra hm">${q != null ? fmtTime(q) : 'NO TIME'}</td><td class="ra">${qp ? 'P' + qp : ''}${p ? ` <span title="${esc(p.why)}">+${p.n}</span>` : ''}</td>${G.player ? `<td class="l">${ty ? TYRES[ty].name : '—'}</td>` : ''}</tr>`; }).join('');
  const table = `<table class="dkfp"><thead><tr><th>Grid</th><th class="l">Driver</th><th class="l hm">Team / Car</th><th class="l hm">Engine</th>${tw ? '<th class="l hm">Tyres</th>' : ''}<th class="ra hm">Quali time</th><th class="ra">Qualified</th>${G.player ? '<th class="l">Start tyre</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;

  const env = dkEnv(W.start, 0, t, WK.round);
  const forecast = sprint ? forecastText(W, { rain: 0 }) : WK.forecast;
  const rule = sprint ? (ac ? 'No mandatory pit stop.' : 'No mandatory pit stop · points for the top 8.') : G.rules && !G.rules.twoCompound ? 'No compound rule this season.' : 'Dry race: each car must use two different dry compounds (or +30s).';
  const kv = (a, b) => `<div class="dkg-row"><span>${a}</span><b>${b}</b></div>`;
  const fav = G.follow && grid.find(x => x.d.id === G.follow);
  const preview = `<section><div class="dk-h"><b>${name.toUpperCase()} PREVIEW</b></div><div class="dkg-body">
    <div class="dkg-fc">${esc(forecast)}</div>
    ${kv('DISTANCE', `${laps} laps · ${(t.km * laps).toFixed(1)} km`)}${kv('AIR / TRACK', `${Math.round(env.air)}°C / ${Math.round(env.track)}°C`)}${kv('OVERTAKING', lvl(t.ot))}${kv('TYRE WEAR', lvl(t.wear))}
    ${tw ? kv('TYRE WAR', [...makers].join(' vs ')) : ''}${fav ? kv('YOUR DRIVER', `${esc(fav.d.name)} · P${grid.indexOf(fav) + 1}`) : ''}<div class="dk-mut dkg-note">${rule}</div></div></section>`;

  const strat = G.spectator || !mine.length ? '' : `<section><div class="dk-h"><b>RACE STRATEGY</b></div><div class="dkg-body">${mine.map(e => `<div class="dkg-car" style="--tc:${e.t.color}">
    <div class="dkg-cn"><b>P${grid.indexOf(e) + 1} ${esc(e.d.name)}</b></div>
    ${dry ? `<div class="dkg-seg"><span class="dk-mut">Start on</span>${['S', 'M', 'H'].map(c => `<button class="${((sprint ? e.sStartTyre : e.startTyre) || 'M') === c ? 'on' : ''}" data-a="stt" data-d="${e.d.id}" data-v="${c}">${TYRES[c].name}</button>`).join('')}</div>` : '<div class="dk-mut">Wet start — the team will fit wet-weather tyres.</div>'}
    <label class="dkg-chk"><input type="checkbox" data-a="autostrat" data-d="${e.d.id}" ${e.auto !== false ? 'checked' : ''}> Auto pit strategy (you can still call stops)</label></div>`).join('')}</div></section>`;

  let pu = '';
  const pr = !sprint && typeof puRules === 'function' ? puRules(G) : null;
  if (pr && G.player) pu = `<section><div class="dk-h"><b>POWER UNITS</b></div><div class="dkg-body">${mine.map(e => { const st = puState(G, e.d.id); const over = st.units + 1 > pr.limit;
    return `<div class="dkg-pu"><span><b>${esc(e.d.name)}</b><span class="dk-mut"> · unit ${st.units}/${pr.limit} · wear </span><b class="${st.wear > 0.8 ? 'bad' : ''}">${Math.round(st.wear * 100)}%</b></span>${WK.newPU && WK.newPU[e.d.id] ? '<span class="dkg-tag">New unit fitted</span>' : `<button data-a="xpnewpu" data-v="${e.d.id}">Fit new unit${over ? ' (+10 places)' : ''}</button>`}</div>`; }).join('')}
    ${(WK.penalties || []).length ? `<div class="dk-mut dkg-note">Grid penalties: ${WK.penalties.map(p => `${esc(p.code)} +${p.n} (${esc(p.why)})`).join(', ')}</div>` : ''}</div></section>`;

  let pred = '';
  if (!sprint && typeof predCard === 'function') pred = `<section class="dkg-pred"><div class="dk-h"><b>PREDICTIONS</b></div><div class="dkg-body">${predCard('race').replace(/^<div class="card"[^>]*><h3>[^<]*<\/h3>/, '<div>')}</div></section>`;

  const sched = weekendSchedule(), cur = sched.findIndex(s => s[2].includes(WK.stage));
  const schedHtml = `<div class="dkg-sched">${sched.map(([lab, day], i) => `<span class="${i < cur ? 'done' : i === cur ? 'now' : ''}"><small>${day}</small>${esc(lab)}${i < cur ? ' ✓' : ''}</span>`).join('')}</div>`;

  return `<div class="dk dk-fp dk-res dk-sgr" id="dk"><div class="dk-reshead">${dkFlag(t.cc, 'lg')}<div><h1>Starting Grid - ${esc(t.short)}</h1><div class="dk-mut">${esc(t.name)} | Round ${WK.round + 1} of ${G.cal.length} | ${G.year} | ${name}${ac && sprint ? ' | top 8 from qualifying reversed' : ''}</div></div><span class="sp"></span>${schedHtml}</div>
  <div class="dk-resgrid"><div class="dk-fpbox">${table}</div><div class="dk-resside">${preview}${strat}${pu}${pred}</div></div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">Press ENTER or click Cars to the grid.</span><span class="sp"></span><button class="pri" data-a="startrace" data-enter="1">Cars to the grid</button></div></div>`;
}
const _dk5_viewWeekend = viewWeekend;
viewWeekend = function () {
  if (deskOn() && WK && !DK2.extras && (WK.stage === 'grid' || WK.stage === 'sgrid')) { document.body.classList.add('dk-on'); return deskGrid(WK.stage === 'sgrid'); }
  return _dk5_viewWeekend();
};

// ---------- main menu ----------
function deskTitle() {
  const has = loadSave(); let hof = []; try { hof = hofLoad().slice(-5).reverse(); } catch (e) { }
  const tile = (a, h, p, cls = '') => `<button class="dkt-tile ${cls}" data-a="${a}"><b>${h}</b><span>${p}</span></button>`;
  let cont = '';
  if (has) {
    const who = has.spectator ? 'Spectator' + (has.follow && has.drivers && has.drivers[has.follow] ? ' · following ' + esc(has.drivers[has.follow].name) : '') : has.player && has.teams[has.player] ? esc(has.teams[has.player].name) : 'choose team';
    const rd = has.cal ? `Round ${Math.min((has.round || 0) + 1, has.cal.length)} of ${has.cal.length}` : '';
    cont = `<section class="dkt-cont"><div class="dk-h"><b>CONTINUE</b></div><div class="dkt-cbody"><div><div class="dkt-yr">${has.year}</div><div>${who}</div><div class="dk-mut">${rd}${has.timeline ? ' · Historic timeline' : ''}${has.regs && has.regs.format === 'academy' ? ' · F1 Academy rules' : ''}</div></div><span class="sp"></span><button class="pri" data-a="continue" data-enter="1">Continue ›</button></div></section>`;
  }
  return `<div class="dk dk-page dk-title" id="dk"><div class="dkt-wrap">
    <div class="dkt-head"><div class="logo">PIT<b>WALL</b></div><div class="dk-mut">F1 TEAM MANAGER</div></div>
    ${cont}
    <section><div class="dk-h"><b>NEW GAME</b></div><div class="dkt-tiles">
      ${tile('newgame', 'Manager career', 'Run a real 2026 team: drivers, contracts, car development and race strategy.', 'red')}
      ${tile('newspec', 'Spectator season', 'Pick a favourite driver, set your own rules and watch the season unfold.')}
      ${tile('newhist', 'Historic timeline 1950–', 'Real line-ups, calendars and points rules from any season since 1950.', 'gold')}</div></section>
    <div class="dkt-row2"><section><div class="dk-h"><b>TOOLS</b></div><div class="dkt-tiles two">
      ${tile('importui', 'Import save code', 'Load a game exported from another device.')}
      ${tile('studio', 'Track Studio', 'Trace circuit layouts from images, or draw your own.')}</div></section>
      ${hof.length ? `<section><div class="dk-h"><b>HALL OF FAME</b></div><div class="dkt-hof">${hof.map(h => `<div><b>${h.y}</b><span>${esc(h.team || '')}</span><em>${h.pos ? 'P' + h.pos : ''}${h.retired ? ' · retired' : ''}</em></div>`).join('')}</div></section>` : ''}</div>
    <div class="dk-mut dkt-foot">Race on tracks from today back to the 1950s, sprint weekends included, and trace your own circuit layouts from images.${has ? ' · Press ENTER to continue.' : ''}</div>
  </div></div>`;
}
const _dk5_viewTitle = viewTitle;
viewTitle = function () { return deskOn() ? deskTitle() : _dk5_viewTitle(); };
if (VIEW === 'title') render(); // first paint happened before this file loaded
