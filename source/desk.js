// ===================== Desktop broadcast layout =====================
// On wide screens, practice, live qualifying and the race get a full-screen "pit wall" layout,
// plus a telemetry page you can flip to (button or T key) without stopping the session.
const DK = { view: 'live', tab: 'order', gap: 'leader', evf: 'all', ev: [], seen: new WeakSet(), prev: null, key: '', pace: 'median', rsig: '', vmax: {} };
function deskOn() {
  let off = false; try { off = localStorage.getItem('pitwall_desk') === 'off'; } catch (e) { }
  return !off;
}
function dkStage() {
  if (!WK || VIEW !== 'weekend') return null;
  if ((WK.stage === 'race' || WK.stage === 'sprint') && RACE) return 'race';
  if ((WK.stage === 'quali' || WK.stage === 'squali') && curQS().live && !curQS().live.done) return 'quali';
  if (WK.stage === 'fp') return 'fp';
  return null;
}
const dkActive = () => deskOn() && !!dkStage();

// ---------- small helpers ----------
function dkInk(hex) {
  let h = String(hex || '#777').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#0b0d12' : '#fff';
}
function dkFlag(cc, cls = '') {
  if (cc && /^[A-Z]{2}$/.test(cc) && !FLAGS[cc]) return `<img class="dkfl ${cls}" src="https://flagcdn.com/w80/${cc.toLowerCase()}.png" alt="${cc}" onerror="this.outerHTML='<span class=&quot;dkfe ${cls}&quot;>${flag(cc)}</span>'">`;
  return `<span class="dkfe ${cls}">${flag(cc)}</span>`;
}
const dkEngine = t => (G.engines[t.engine] && G.engines[t.engine].name) || '';
const dkNm = n => { const p = String(n).split(' '); const sh = p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : n; return `<span class="fn">${esc(n)}</span><span class="sn">${esc(sh)}</span>`; };
const dkShort = d => { const p = d.name.split(' '); return (p.length > 1 ? p[0][0] + '. ' : '') + p[p.length - 1]; };
const dkTy = t => { const [l, c] = TYRE_LETTER[t] || ['?', '#888']; return `<b class="dkty" style="color:${c}">${l}</b>`; };
const dkT = s => s == null ? '--:--.---' : fmtTime(s);
const dkS = s => s == null ? '-.-' : s.toFixed(1);

// ---------- track model: speed profile, corners, sector split ----------
function dkProf(track) {
  const g = trackGeometry(track); if (g._prof) return g._prof;
  const P = g.P, N = P.length, head = [], k = [];
  for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N]; head.push(Math.atan2(b[1] - a[1], b[0] - a[0])); }
  for (let i = 0; i < N; i++) { let d = head[(i + 1) % N] - head[i]; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; const ds = (g.cum[i + 1] - g.cum[i]) || 1e-6; k.push(Math.abs(d) / ds); }
  const sm = (arr, w) => arr.map((_, i) => { let s = 0; for (let j = -w; j <= w; j++) s += arr[(i + j + N) % N]; return s / (2 * w + 1); });
  const ks = sm(k, 4), kc = sm(k, 10);
  const v = ks.map(x => 0.27 + 0.73 * Math.exp(-x / 7));
  let T = 0; const seg = [0, 0, 0];
  for (let i = 0; i < N; i++) { const ds = g.cum[i + 1] - g.cum[i], dt = ds / v[i]; T += dt; seg[Math.min(2, Math.floor(g.cum[i] / g.len * 3))] += dt; }
  const mean = g.len / T; const p = v.map(x => x / mean);
  // corners = separate peaks of curvature
  let corners = 0, lastPeak = -1e9;
  for (let i = 0; i < N; i++) { const a = kc[(i - 1 + N) % N], b = kc[i], c = kc[(i + 1) % N]; if (b > 5 && b >= a && b > c && g.cum[i] - lastPeak > g.len * 0.018) { corners++; lastPeak = g.cum[i]; } }
  g._prof = { p, g, corners: Math.max(corners, 4), w: seg.map(x => x / T), max: Math.max(...p) };
  return g._prof;
}
function dkPAt(track, frac) {
  const pr = dkProf(track), g = pr.g; frac = ((frac % 1) + 1) % 1; const tgt = frac * g.len; let lo = 0, hi = g.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (g.cum[m] <= tgt) lo = m; else hi = m; }
  return pr.p[lo % pr.p.length];
}
function dkSplit(track, lt, seedStr) {
  const w = dkProf(track).w, r = seeded(seedStr); const n1 = (r() - 0.5) * 0.008, n2 = (r() - 0.5) * 0.008;
  const s1 = lt * w[0] * (1 + n1), s2 = lt * w[1] * (1 + n2); return [s1, s2, lt - s1 - s2];
}
function dkEnv(wet, prog, tr, rd) {
  const t = tr || WK.track, r = seeded(t.id + ':' + G.year + ':' + (rd != null ? rd : WK.round));
  const air = 13 + r() * 16, sun = r(), wb = 4 + r() * 16, d0 = r() * 360;
  return { air: air - wet * 5, track: air + 5 + sun * 13 - wet * 12 + Math.sin(prog * 2.1) * 1.2, rain: wet > 0.05 ? wet * 9 : 0, wind: Math.max(1, wb + Math.sin(prog * 6 + sun * 4) * 3), dir: (d0 + Math.sin(prog * 4) * 25 + 360) % 360 };
}
const dkCompass = d => ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'][Math.round(d / 45) % 8];

// ---------- race data: sectors, fuel, speed ----------
const _dkRaceStep = Race.prototype.step;
Race.prototype.step = function (dt) {
  const pre = this.cars.map(c => c.dist), t0 = this.t;
  _dkRaceStep.call(this, dt);
  const S = this.L / 3, dtt = this.t - t0;
  this.cars.forEach((c, i) => {
    const a = pre[i], b = c.dist; if (!this.started && !(b > a)) return; if (!(b > a) || c.out) return;
    for (let k = Math.floor(a / S) + 1; k <= Math.floor(b / S); k++) {
      const tx = this.t - dtt * (b - k * S) / (b - a);
      if (c._st == null || k <= 0) { c._st = tx; c._cs = [null, null, null]; continue; }
      const si = ((k - 1) % 3 + 3) % 3; let st = tx - c._st; c._st = tx;
      const w = dkProf(this.track).w, nz = seeded(c.d.id + ':' + k)(); st = st * 3 * w[si] * (1 + (nz - 0.5) * 0.004); c._cs[si] = st;
      c._bs = c._bs || [null, null, null]; if (c._bs[si] == null || st < c._bs[si]) c._bs[si] = st;
      this._bs = this._bs || [null, null, null]; if (this._bs[si] == null || st < this._bs[si]) this._bs[si] = st;
      if (si === 2) { c._ls = c._cs.slice(); c._cs = [null, null, null]; }
    }
  });
};
const _dkLapDone = QualiLive.prototype.lapDone;
QualiLive.prototype.lapDone = function (c, lt) {
  const r = c.runs.find(r => r.timed && !r._dk); if (r) r._dk = 1;
  const sp = (r && r._sp) || dkSplit(this.track, lt, c.d.id + ':' + c.laps);
  c._ls = sp; c._bs = c._bs || [null, null, null]; this._bs = this._bs || [null, null, null];
  sp.forEach((s, i) => { if (c._bs[i] == null || s < c._bs[i]) c._bs[i] = s; if (this._bs[i] == null || s < this._bs[i]) this._bs[i] = s; });
  return _dkLapDone.call(this, c, lt);
};
function dkQRun(Q, c) { return c.runs.find(r => !r.done && !r.aborted && Q.t >= r.start + r.OL && Q.t < r.start + r.OL + r.fly); }
function dkFuel(c, R) {
  // fuel burn per lap, scaled so a full race distance always fits the 110 kg limit
  const fpl = Math.min(0.31 * R.track.km, 104 / R.laps);
  if (c._f0 == null) { const r = seeded(c.d.id + R.laps); c._f0 = Math.min(110, R.laps * fpl * (1.015 + r() * 0.035) + 1); }
  const used = Math.max(0, c.dist) / R.L * fpl * (c.mode === 'push' ? 1.04 : c.mode === 'save' ? 0.95 : 1);
  return Math.max(0.3, c._f0 - used);
}
function dkSpeed(c, kind, Q) {
  if (kind === 'race') {
    if (c.out || !RACE.started) return 0; if (c.finished) return 120; if (c.pitT > 0) return 80;
    return RACE.L / c.curLT * 3.6 * dkPAt(RACE.track, c.dist / RACE.L) * (RACE.sc ? 0.62 : RACE.vsc ? 0.7 : 1);
  }
  if (c.out || c.phase === 'garage' || c.phase === 'crashed') return 0;
  const r = c.runs.find(r => !r.done && Q.t >= r.start); if (!r) return 0;
  const lt = c.phase === 'flying' ? r.fly : c.phase === 'out' ? r.OL : r.IL;
  return Q.L / lt * 3.6 * dkPAt(Q.track, c.frac);
}
function dkLapTimes(c) { const o = []; for (let n = 1; n < c.cross.length; n++) if (c.cross[n] != null && c.cross[n - 1] != null) o.push(c.cross[n] - c.cross[n - 1]); return o; }

// ---------- events feed ----------
function dkCat(s) {
  if (/📻|radio/i.test(s)) return 'radio';
  if (/OVERTAKE|overtak|passes|gets past|moves (up|past)|takes P\d|into the lead|lead!/i.test(s)) return 'pass';
  if (/\bpit|box|stop|tyres|🔧|🛞|change/i.test(s)) return 'pit';
  if (/❌|💥|🟥|🟡|crash|safety|VSC|spin|puncture|retire|penalt|red flag|yellow|damage|DNF|off at|failure|wall/i.test(s)) return 'inc';
  return 'info';
}
const DK_CAT = { pass: ['OVERTAKE', '#1f9d55'], pit: ['PIT', '#2d6cdf'], inc: ['INCIDENT', '#c0392b'], radio: ['RADIO', '#8e44ad'], info: ['INFO', '#3b4252'] };
function dkCollect(kind, src) {
  const key = kind === 'race' ? 'r' + WK.round + (RACE.sprint ? 's' : '') + G.year : 'q' + WK.round + src.label + G.year;
  if (DK.key !== key) { DK.key = key; DK.ev = []; DK.seen = new WeakSet(); DK.prev = null; DK.vmax = {}; }
  for (let i = src.log.length - 1; i >= 0; i--) { const l = src.log[i]; if (DK.seen.has(l)) continue; DK.seen.add(l); if (/^⚔️ \w+ passes \w+/.test(l.s)) continue;
    DK.ev.unshift({ lab: kind === 'race' ? 'L' + l.lap : fmtClock(src.dur - l.t), cat: dkCat(l.s), s: l.s.replace(/^\p{Extended_Pictographic}️?\s*/u, '') }); }
  if (kind === 'race' && RACE.started && !RACE.chequered) {
    const ord = RACE.order().filter(c => !c.out), pos = new Map(ord.map((c, i) => [c.d.id, i]));
    if (DK.prev) { let n = 0;
      ord.forEach((c, i) => { const was = DK.prev.pos.get(c.d.id); if (was == null || was <= i || c.pitT > 0 || DK.prev.pit.has(c.d.id)) return;
        ord.slice(i + 1).forEach(b => { const wb = DK.prev.pos.get(b.d.id); if (wb == null || wb >= was || b.pitT > 0 || DK.prev.pit.has(b.d.id) || n >= 4 || RACE.sc) return;
          n++; DK.ev.unshift({ lab: 'L' + Math.min(RACE.laps, RACE.leaderLap + 1), cat: 'pass', s: `${dkShort(c.d)} on ${dkShort(b.d)}` }); }); }); }
    DK.prev = { pos, pit: new Set(RACE.cars.filter(c => c.pitT > 0).map(c => c.d.id)) };
  }
  if (DK.ev.length > 250) DK.ev.length = 250;
}

// ---------- shared pieces ----------
function dkSpd() {
  if (RACE && dkStage() === 'race' && !RACE.started) {
    return LIGHTS && LIGHTS.phase !== 'idle' ? '<button class="dk-go" disabled>LIGHTS…</button>' : '<button class="dk-go" data-a="lights" id="lightsbtn">● START THE LIGHTS</button>';
  }
  const sp = [[1, 4], [2, 16], [3, 32], [4, 64], [5, 256]];
  return sp.map(([n, v]) => `<button class="spd ${!PAUSED && SPEED === v ? 'on' : ''}" data-a="spd" data-v="${v}" title="${v}× speed">${n}</button>`).join('') + `<button class="spd ${PAUSED ? 'on' : ''}" data-a="spd" data-v="pause" title="Pause">❚❚</button>`
    + (dkStage() === 'race' ? '<button class="spd wide" data-a="simend" title="Simulate to the flag">⏭</button>' : '<button class="spd wide" data-a="qskip" title="Skip to the end of the session">⏭</button>');
}
function dkFlagState(kind, S) {
  if (kind === 'race') return !RACE.started ? ['FORMATION', 'grey'] : RACE.chequered ? ['CHEQUERED FLAG', 'chq'] : RACE.redFlag ? ['RED FLAG', 'red'] : RACE.sc ? ['SAFETY CAR', 'yellow'] : RACE.vsc ? ['VIRTUAL SAFETY CAR', 'yellow'] : ['GREEN FLAG', 'green'];
  return S.chequered ? ['CHEQUERED FLAG', 'chq'] : S.cars.some(c => c.phase === 'crashed') && S.t - (S._redT || 0) < 60 ? ['RED FLAG', 'red'] : ['GREEN FLAG', 'green'];
}
function dkWall(kind, S, ord) {
  const mine = (kind === 'race' ? RACE.cars : S.cars).filter(c => c.player);
  if (kind === 'race' && mine.length) {
    const mn = typeof modeNames === 'function' ? modeNames(G) : null;
    return mine.map(c => { const pos = ord.indexOf(c) + 1;
      if (c.out) return `<div class="dk-cmd1"><b style="--tc:${c.t.color}">P${pos} ${esc(c.d.code)}</b><span class="bad">Retired: ${esc(c.out)}</span></div>`;
      if (c.finished) return `<div class="dk-cmd1"><b style="--tc:${c.t.color}">P${pos} ${esc(c.d.code)}</b><span>🏁 Finished</span></div>`;
      return `<div class="dk-cmd1"><b style="--tc:${c.t.color}">P${pos} ${esc(c.d.code)}</b>${dkTy(c.tyre)}<span class="mut">${c.age}L · ${Math.round(c.wear * 100)}%</span>
      <span class="dk-seg">${[['save', 'SAVE'], ['std', 'STD'], ['push', 'PUSH']].map(([k, v]) => `<button class="${c.mode === k ? 'on' : ''}" data-a="mode" data-d="${c.d.id}" data-v="${k}">${v}</button>`).join('')}</span>
      ${mn && c.ers ? `<span class="dk-seg">${Object.entries(mn).map(([k, v]) => `<button class="${c.ers === k ? 'on' : ''}" data-a="xpers" data-d="${c.d.id}" data-v="${k}">${esc(String(v).split(' ')[0])}</button>`).join('')}</span>` : ''}
      <span class="dk-seg">${c.pitReq ? `<button class="on" data-a="pit" data-d="${c.d.id}" data-v="">BOX ${TYRES[c.pitReq].name.toUpperCase()} ✕</button>` : Object.keys(TYRES).map(k => `<button data-a="pit" data-d="${c.d.id}" data-v="${k}" title="Box for ${TYRES[k].name}">${dkTy(k)}</button>`).join('')}</span>
      <label class="dk-auto"><input type="checkbox" data-a="rauto" data-d="${c.d.id}" ${c.auto ? 'checked' : ''}> AUTO</label></div>`; }).join('');
  }
  if (kind === 'quali') {
    const cut = S.cut ? ord.length - S.cut : null;
    if (cut != null) { const z = ord.slice(cut - 1, cut + 3);
      return `<div class="dk-mut">DROP ZONE · bottom ${S.cut} are knocked out</div>` + z.map((c, i) => `<div class="dk-cmd1 ${cut - 1 + i >= cut ? 'elim' : ''}"><b style="--tc:${c.t.color}">P${cut + i}</b><span>${esc(dkShort(c.d))}</span><span class="sp"></span><span>${dkT(c.best)}</span><span class="mut">${c.phase === 'flying' ? 'FLYING' : c.out ? 'OUT' : c.phase.toUpperCase()}</span></div>`).join(''); }
    const top = ord.slice(0, 3); return `<div class="dk-mut">POLE FIGHT</div>` + top.map((c, i) => `<div class="dk-cmd1"><b style="--tc:${c.t.color}">P${i + 1}</b><span>${esc(dkShort(c.d))}</span><span class="sp"></span><span>${dkT(c.best)}</span></div>`).join('');
  }
  // spectator race: closest fight + followed driver
  let best = null; for (let i = 1; i < Math.min(ord.length, 12); i++) { const a = ord[i - 1], b = ord[i]; if (a.out || b.out || a.pitT > 0 || b.pitT > 0) continue; const gap = (a.dist - b.dist) / (RACE.L / b.curLT); if (gap > 0 && (!best || gap < best.gap)) best = { a, b, i, gap }; }
  const fav = RACE.cars.find(c => c.fav);
  return (best ? `<div class="dk-mut">BATTLE FOR P${best.i}</div><div class="dk-cmd1"><b style="--tc:${best.a.t.color}">${esc(best.a.d.code)}</b><span>vs</span><b style="--tc:${best.b.t.color}">${esc(best.b.d.code)}</b><span class="sp"></span><span>${best.gap.toFixed(3)}s</span></div>` : '<div class="dk-mut">No close battles</div>')
    + (fav ? `<div class="dk-mut" style="margin-top:6px">FOLLOWING</div><div class="dk-cmd1"><b style="--tc:${fav.t.color}">P${ord.indexOf(fav) + 1} ${esc(fav.d.code)}</b>${dkTy(fav.tyre)}<span class="mut">${fav.age}L · stops ${fav.stops}</span><span class="sp"></span><span>${dkT(fav.lastLap)}</span></div>` : '<div class="dk-mut" style="margin-top:6px">Click a driver to follow them.</div>');
}

// ---------- live broadcast page ----------
function deskLive(kind) {
  const t = WK.track, pr = dkProf(t), S = kind === 'race' ? RACE : curQS().live;
  if (DK.view === 'tele') return deskTele(kind);
  const tabs = kind === 'race' ? [['order', 'Race Order'], ['sectors', 'Sectors'], ['tyres', 'Tyre History']] : [['order', 'Order'], ['sectors', 'Sectors'], ['tyres', 'Tyre History']];
  return `<div class="dk" id="dk">
  <div class="dk-topbar">
    <div class="dk-loc">${dkFlag(t.cc, 'lg')}<div><b>${esc(t.short.toUpperCase())}</b><small>LIVE SESSION</small></div></div>
    <div class="dk-sess"><i></i><div><b>${kind === 'race' ? (RACE.sprint ? 'SPRINT' : 'RACE') : (/^SQ/.test(S.label) ? 'SPRINT QUALIFYING' : 'QUALIFYING')}</b><small id="dksess"></small></div></div>
    <div class="dk-stat"><span class="ic">☀</span><div><b id="dktemp"></b><small>TRACK TEMP</small></div></div>
    <div class="dk-stat"><span class="ic">💧</span><div><b id="dkrain"></b><small id="dkrains"></small></div></div>
    <div class="dk-stat"><span class="ic">≋</span><div><b id="dkwind"></b><small>WIND</small></div></div>
    <div class="dk-btns"><button data-a="dkmodal" data-v="${kind === 'race' ? 'gps' : 'trap'}">${kind === 'race' ? '📍 GPS Data' : '📶 Speed Trap'}</button><button data-a="dkmodal" data-v="weather">⛅ Weather Forecast</button><button data-a="dkview" data-v="tele">📊 Telemetry <kbd>T</kbd></button><button class="ico" data-a="dkmodal" data-v="settings" title="Settings">⚙</button></div>
  </div>
  <div class="dk-grid">
    <section class="dk-map"><div class="dk-bar"><span class="dk-flagst" id="dkflag"></span><span class="sp"></span><span class="dk-spd" id="rctl">${dkSpd()}</span><span class="dk-km">${t.km.toFixed(3)} km · ${pr.corners} corners</span></div>
      <div class="dk-mapbox"><canvas id="cv"></canvas>
        <div class="dk-maptitle">${dkFlag(t.cc, 'xl')}<span>${esc(t.short)}</span></div>
        ${kind === 'race' ? `<div class="gantry dk-gantry ${RACE.started && !(LIGHTS && LIGHTS.phase === 'out') ? 'gone' : ''}" id="gantry">${[0, 1, 2, 3, 4].map(() => '<div class="glamp"><i></i><i></i></div>').join('')}</div><div class="lomsg" id="lomsg"></div>` : ''}
        <div id="rbanner" class="${raceBanner ? 'banner' : ''}">${raceBanner ? esc(raceBanner) : ''}</div></div></section>
    <section class="dk-order"><div class="dk-tabs">${tabs.map(([k, v]) => `<button class="${DK.tab === k ? 'on' : ''}" data-a="dktab" data-v="${k}">${v}</button>`).join('')}</div><div class="dk-table" id="dktable"></div></section>
    <section class="dk-events"><div class="dk-h"><b>${kind === 'race' ? 'RACE EVENTS' : 'SESSION EVENTS'}</b><span class="dk-filt">${[['all', 'All'], ['pass', 'Passes'], ['pit', 'Pits'], ['inc', 'Incidents'], ['radio', 'Radio']].map(([k, v]) => `<button class="${DK.evf === k ? 'on' : ''}" data-a="dkevf" data-v="${k}">${v}</button>`).join('')}</span></div><div class="dk-evlist" id="dkev"></div></section>
    <section class="dk-chars"><div class="dk-h"><b>TRACK CHARACTERISTICS</b></div><div id="dkchars"></div></section>
    <section class="dk-wall"><div class="dk-h"><b>${kind === 'race' && myEntries().length ? 'PIT WALL' : kind === 'race' ? 'BATTLE WATCH' : 'SESSION WATCH'}</b><span class="dk-mut">${G.player ? esc(G.teams[G.player].name) : 'Spectator'}</span></div><div id="dkwall" class="dk-wallb"></div></section>
  </div></div>`;
}
function dkOrderTable(kind, S, ord) {
  const leader = ord[0];
  if (DK.tab === 'tyres') {
    return `<table class="dkt"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="l">Tyre history</th><th>Age</th></tr></thead><tbody>${ord.map((c, i) => {
      const st = kind === 'race' ? (c.stints || [{ tyre: c.tyre }]).map(s => s.tyre) : (c.laps ? ['S'] : []);
      return `<tr class="${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''}" style="--tc:${c.t.color};--ti:${dkInk(c.t.color)}" data-a="follow" data-v="${c.d.id}"><td>${i + 1}</td><td class="l">${esc(dkShort(c.d))}</td><td class="l hm">${esc(c.t.name)}</td><td class="l">${st.map(x => `<span class="dkchip" style="--c:${TYRES[x].col}">${x}</span>`).join('<span class="dkarr">›</span>')}</td><td>${kind === 'race' ? c.age : c.laps}</td></tr>`; }).join('')}</tbody></table>`;
  }
  if (DK.tab === 'sectors') {
    const SB = S._bs || [];
    const cell = (c, i) => { let v = null, live = false;
      if (kind === 'race') { v = c._cs && c._cs[i] != null ? c._cs[i] : c._ls ? c._ls[i] : null; live = !!(c._cs && c._cs[i] != null); }
      else { const r = c.phase === 'flying' && dkQRun(S, c); if (r) { r._sp = r._sp || dkSplit(S.track, r.fly, c.d.id + ':' + r.start.toFixed(1)); v = c.frac >= (i + 1) / 3 ? r._sp[i] : null; live = true; } else v = c._ls ? c._ls[i] : null; }
      if (v == null) return `<td>${live ? '<span class="dk-mut">···</span>' : '-.-'}</td>`;
      const cls = SB[i] != null && Math.abs(v - SB[i]) < 1e-6 ? 'pu' : c._bs && Math.abs(v - c._bs[i]) < 1e-6 ? 'gr' : 'ye';
      return `<td><span class="dksec ${cls}">${v.toFixed(3)}</span></td>`; };
    return `<table class="dkt"><thead><tr><th>Pos</th><th class="l">Driver</th><th>S1</th><th>S2</th><th>S3</th><th>Last</th><th>Best</th></tr></thead><tbody>${ord.map((c, i) => `<tr class="${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''}" style="--tc:${c.t.color};--ti:${dkInk(c.t.color)}" data-a="follow" data-v="${c.d.id}"><td>${i + 1}</td><td class="l">${esc(dkShort(c.d))}</td>${cell(c, 0)}${cell(c, 1)}${cell(c, 2)}<td>${dkT(kind === 'race' ? c.lastLap : c.last)}</td><td>${dkT(c.best)}</td></tr>`).join('')}</tbody></table>`;
  }
  if (kind === 'quali') {
    const cut = S.cut ? ord.length - S.cut : null;
    return `<table class="dkt"><thead><tr><th>Pos</th><th>St</th><th class="l">Driver</th><th class="l hm">Team</th><th>Best Lap</th><th>Gap</th><th>Last Lap</th><th>Tyre</th><th>Laps</th></tr></thead><tbody>${ord.map((c, i) => {
      const purple = S.best && S.best.c === c;
      const st = c.out ? '✕' : c.phase === 'flying' ? '<span class="dkfly">●</span>' : c.phase === 'out' ? '↗' : c.phase === 'in' ? '↘' : '▪';
      return `<tr class="${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''} ${cut != null && i >= cut ? 'elim' : ''} ${cut === i ? 'cut' : ''}" style="--tc:${c.t.color};--ti:${dkInk(c.t.color)}" data-a="follow" data-v="${c.d.id}">
      <td>${i + 1}</td><td>${st}</td><td class="l">${esc(dkShort(c.d))}</td><td class="l hm">${esc(c.t.name)}</td><td class="${purple ? 'pu' : ''}">${dkT(c.best)}</td><td>${c.best == null || i === 0 ? '—' : '+' + (c.best - leader.best).toFixed(3)}</td><td>${dkT(c.last)}</td><td>${c.laps || c.phase !== 'garage' ? dkTy(S.wet > 0.65 ? 'W' : S.wet > 0.25 ? 'I' : 'S') : '-'}</td><td>${c.laps}</td></tr>`; }).join('')}</tbody></table>`;
  }
  const gapOf = (c, i) => {
    if (c.out) return 'OUT'; if (i === 0) return 'Leader'; if (c.pitT > 0) return 'PIT';
    const lapped = leader.dist - c.dist > RACE.L && leader.laps - c.laps >= 1;
    if (DK.gap === 'leader') return lapped ? '+' + Math.floor((leader.dist - c.dist) / RACE.L) + ' Lap' : '+' + gapSeconds(c, leader).toFixed(1) + 's';
    const p = ord[i - 1]; return p.dist - c.dist > RACE.L ? '+1 Lap' : '+' + Math.max(0.1, (p.dist - c.dist) / (RACE.L / c.curLT)).toFixed(1) + 's';
  };
  return `<table class="dkt"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th><button class="dkgap" data-a="dkgap">‹ ${DK.gap === 'leader' ? 'Gap' : 'Int'} ›</button></th><th>Lap</th><th>Last</th><th>Tyre</th><th>%</th><th>Fuel</th><th>Pit</th><th>Stp</th></tr></thead><tbody>${ord.map((c, i) => {
    const gain = c.grid - (i + 1);
    return `<tr class="${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''}" style="--tc:${c.t.color};--ti:${dkInk(c.t.color)}" data-a="follow" data-v="${c.d.id}">
    <td>${i + 1}</td><td class="l"><span class="dkmv ${gain > 0 ? 'up' : gain < 0 ? 'dn' : ''}">${gain > 0 ? '▲' : gain < 0 ? '▼' : '•'}</span>${esc(dkShort(c.d))}</td><td class="l hm">${esc(c.t.name)}</td><td>${gapOf(c, i)}</td><td>${Math.min(RACE.laps, c.laps)}/${RACE.laps}</td><td>${dkT(c.lastLap)}</td><td>${c.out ? '' : dkTy(c.tyre)}</td><td>${c.out ? '' : Math.round(c.wear * 100) + '%'}</td><td>${c.out ? '' : dkFuel(c, RACE).toFixed(1)}</td><td>${c.pitReq ? 'BOX' : c.pitT > 0 ? 'IN' : ''}</td><td>${c.stops}</td></tr>`; }).join('')}</tbody></table>`;
}
function dkChars(kind, S) {
  const t = WK.track, prog = kind === 'race' ? Math.min(1, (RACE.leaderLap || 0) / RACE.laps) : Math.min(1, S.t / S.dur);
  const rel = (seeded(t.id + 'rel')() * 0.5 + 0.3), fuel = clamp(t.pw * 0.8 + t.km / 30, 0, 1);
  const rubber = Math.round((kind === 'race' ? 62 : 38) + prog * (kind === 'race' ? 30 : 45) - (S.wet || 0) * 40);
  const bar = (lab, v, txt) => { const col = v > 0.66 ? '#ff4d4d' : v > 0.4 ? '#ffd23f' : '#3ddc84'; return `<div class="dkc"><span>${lab}</span><i><b style="width:${Math.round(v * 100)}%;background:${col}"></b></i><em style="color:${col}">${txt}</em></div>`; };
  const L = v => v > 0.66 ? 'High' : v > 0.4 ? 'Medium' : 'Low';
  return bar('Tyre Wear', t.wear, L(t.wear)) + bar('Reliability', rel, L(rel)) + bar('Fuel Burn', fuel, L(fuel)) + bar('Overtaking', 1 - t.ot, t.ot > 0.66 ? 'Easy' : t.ot > 0.4 ? 'Normal' : 'Hard')
    + `<div class="dkc"><span>Rubber</span><i><b style="width:${clamp(rubber, 0, 100)}%;background:#3ddc84"></b></i><em style="color:#3ddc84">${clamp(rubber, 0, 100)}%</em></div>`;
}

// ---------- telemetry page ----------
function deskTele(kind) {
  const S = kind === 'race' ? RACE : curQS().live;
  return `<div class="dk dk-tele" id="dk">
  <div class="dk-thead"><span class="dk-dot"></span><b>Telemetry screen</b><span class="dk-mut">${esc(WK.track.short)} · ${kind === 'race' ? (RACE.sprint ? 'Sprint' : 'Grand Prix') : esc(S.label)}</span><span class="sp"></span><span class="dk-spd" id="rctl">${dkSpd()}</span><button data-a="dkview" data-v="live">BROADCAST <kbd>T</kbd></button><button class="ico" data-a="dkmodal" data-v="settings">⚙</button></div>
  <div class="dk-tmain"><section class="dk-ttable"><div id="dkttable" class="dk-scroll"></div><div class="dk-tfoot" id="dktfoot"></div></section>
    <section class="dk-cross"><div class="dk-h"><b>${kind === 'race' ? 'CROSSING ORDER' : 'ON TRACK'}</b></div><div id="dkcross" class="dk-scroll"></div></section>
    <section class="dk-status"><div class="dk-h"><b>STATUS</b></div><div id="dkstatus" class="dk-scroll"></div></section></div>
  <section class="dk-pace"><div class="dk-h"><b>${kind === 'race' ? 'RACE PACE' : 'LAP TIMES'}</b><span class="dk-filt">${[['median', 'MEDIAN'], ['leader', 'VS LEADER'], ['pb', 'VS PB']].map(([k, v]) => `<button class="${DK.pace === k ? 'on' : ''}" data-a="dkpace" data-v="${k}">${v}</button>`).join('')}</span><span class="dk-mut"><i class="kf"></i>faster <i class="ks"></i>±0.5s <i class="kl"></i>slower <i class="kb"></i>best</span></div><div id="dkpace" class="dk-scroll"></div></section>
  <div class="dk-tbot">
    <section class="dk-gps"><div class="dk-h"><b>TRACK GPS</b><span class="dk-flagst sm" id="dkflag"></span><span class="dk-mut" id="dklapc"></span></div><div class="dk-gpsbox"><canvas id="tgps"></canvas><div class="dk-minilog" id="dkminilog"></div></div></section>
    <section class="dk-windp"><div class="dk-h"><b>WIND</b></div><div id="dkwindp"></div></section>
    <section class="dk-data"><div class="dk-h"><b>DATA</b></div><div class="dk-datab">
      <button data-a="dkmodal" data-v="weather">WEATHER</button><button data-a="dkmodal" data-v="strategy">TYRE STRATEGY</button><button data-a="dkpace" data-v="median">PACE TRACES</button><button data-a="dkmodal" data-v="sectors">SECTOR DELTA</button><button data-a="dkmodal" data-v="${kind === 'race' ? 'gps' : 'trap'}">SPEED PROFILE</button></div></section>
    <section class="dk-cmd"><div class="dk-h"><b>PIT WALL COMMAND</b></div><div id="dkwall" class="dk-wallb"></div></section>
  </div></div>`;
}
function dkTeleTable(kind, S, ord) {
  const leader = ord[0], SB = S._bs || [];
  const secCell = (c, i) => { let v = null;
    if (kind === 'race') v = c._cs && c._cs[i] != null ? c._cs[i] : c._ls ? c._ls[i] : null;
    else { const r = c.phase === 'flying' && dkQRun(S, c); if (r) { r._sp = r._sp || dkSplit(S.track, r.fly, c.d.id + ':' + r.start.toFixed(1)); v = c.frac >= (i + 1) / 3 ? r._sp[i] : null; } else v = c._ls ? c._ls[i] : null; }
    if (v == null) return '<td class="dim">-.-</td>';
    const cls = SB[i] != null && Math.abs(v - SB[i]) < 1e-6 ? 'pu' : c._bs && Math.abs(v - c._bs[i]) < 1e-6 ? 'gr' : 'ye';
    return `<td class="${cls}">${v.toFixed(3)}</td>`; };
  const rows = ord.map((c, i) => {
    const sp = Math.round(dkSpeed(c, kind, S)); DK.vmax[c.d.id] = Math.max(DK.vmax[c.d.id] || 0, sp);
    if (kind === 'race') {
      const gl = c.out ? 'OUT' : i === 0 ? 'LEADER' : gapSeconds(c, leader).toFixed(3);
      const p = ord[i - 1]; const it = c.out || i === 0 ? '--' : '+' + Math.max(0, (p.dist - c.dist) / (RACE.L / c.curLT)).toFixed(2) + 's';
      const lts = dkLapTimes(c), n = c.laps; let trd = '-';
      if (n >= 2 && leader.cross[n] != null && leader.cross[n - 1] != null && c.cross[n] != null && c.cross[n - 1] != null && i > 0) { const d = (c.cross[n] - leader.cross[n]) - (c.cross[n - 1] - leader.cross[n - 1]); trd = `<span class="${d < 0 ? 'g' : 'r'}">${d < 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)}</span>`; }
      const delta = c.lastLap != null && c.best != null ? c.lastLap - c.best : null;
      const gain = c.grid - (i + 1);
      return `<tr class="${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''}" data-a="follow" data-v="${c.d.id}"><td class="${gain > 0 ? 'g' : gain < 0 ? 'r' : 'dim'}">${gain > 0 ? '+' + gain : gain < 0 ? gain : '-'}</td><td>${i + 1}</td><td><span class="dkcode" style="--tc:${c.t.color};--ti:${dkInk(c.t.color)}">${esc(c.d.code)}</span></td>
      <td>${gl}</td><td>${it}</td><td>${trd}</td>${secCell(c, 0)}${secCell(c, 1)}${secCell(c, 2)}<td>${dkT(c.lastLap)}</td><td class="${RACE.fastest && RACE.fastest.c === c ? 'pu' : ''}">${dkT(c.best)}</td><td>${delta == null ? '—' : delta < 0.0005 ? '<span class="g">PB</span>' : '+' + delta.toFixed(3)}</td>
      <td>${c.out ? '' : `<span style="color:${TYRES[c.tyre].col}">${c.tyre}</span>/${Math.round((1 - c.wear) * 100)}%`}</td><td>${c.age}</td><td>${c.out ? '' : dkFuel(c, RACE).toFixed(1)}</td><td>${c.battery != null ? Math.round(c.battery) + '%' : '100%'}</td><td>${c.stops}</td><td>${sp || '--'}</td></tr>`;
    }
    const gl = c.best == null ? '--' : i === 0 ? 'POLE' : '+' + (c.best - leader.best).toFixed(3);
    const p = ord[i - 1]; const it = c.best == null || i === 0 || p.best == null ? '--' : '+' + (c.best - p.best).toFixed(3);
    const delta = c.last != null && c.best != null ? c.last - c.best : null;
    const ty = S.wet > 0.65 ? 'W' : S.wet > 0.25 ? 'I' : 'S';
    return `<tr class="${c.player || c.fav ? 'me' : ''} ${c.out ? 'out' : ''}" data-a="follow" data-v="${c.d.id}"><td class="dim">-</td><td>${i + 1}</td><td><span class="dkcode" style="--tc:${c.t.color};--ti:${dkInk(c.t.color)}">${esc(c.d.code)}</span></td>
    <td>${gl}</td><td>${it}</td><td>${c.phase === 'flying' ? '<span class="pu">FLY</span>' : '-'}</td>${secCell(c, 0)}${secCell(c, 1)}${secCell(c, 2)}<td>${dkT(c.last)}</td><td class="${S.best && S.best.c === c ? 'pu' : ''}">${dkT(c.best)}</td><td>${delta == null ? '—' : delta < 0.0005 ? '<span class="g">PB</span>' : '+' + delta.toFixed(3)}</td>
    <td><span style="color:${TYRES[ty].col}">${ty}</span>/${c.phase === 'garage' ? 100 : Math.round(100 - c.laps * 3 - (c.phase === 'flying' ? c.frac * 3 : 0))}%</td><td>${c.laps}</td><td>${(c.phase === 'garage' ? 12 : 9).toFixed(1)}</td><td>100%</td><td>0</td><td>${sp || '--'}</td></tr>`;
  }).join('');
  return `<table class="dktt"><thead><tr><th>+/-</th><th>POS</th><th>DRIVER</th><th>GAP</th><th>INT</th><th>TRD</th><th>S1</th><th>S2</th><th>S3</th><th>LAST</th><th>BEST</th><th>DELTA</th><th>TY/%</th><th>AGE</th><th>FUEL</th><th>ERS</th><th>ST</th><th>SPD</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function dkPace(kind, S, ord) {
  const cars = ord.filter(c => !c.out || (kind === 'race' ? c.laps > 0 : c.laps > 0));
  const laps = c => kind === 'race' ? dkLapTimes(c) : (c._lt || []);
  const maxN = Math.max(0, ...cars.map(c => laps(c).length));
  const from = Math.max(0, maxN - 6), rows = [];
  for (let n = from; n < Math.max(maxN, 1); n++) {
    const vals = cars.map(c => laps(c)[n]).filter(v => v != null).sort((a, b) => a - b);
    const med = vals.length ? vals[Math.floor(vals.length / 2)] : null, bestLap = vals[0];
    const lead = laps(ord[0])[n];
    rows.push(`<tr><td class="dim">L${n + 1}</td>${cars.map(c => { const v = laps(c)[n]; if (v == null) return '<td class="dim">--</td>';
      const ref = DK.pace === 'leader' ? lead : DK.pace === 'pb' ? Math.min(...laps(c)) : med; const d = ref == null ? 0 : v - ref;
      const cls = v === bestLap ? 'pb' : d < -0.5 ? 'pf' : d > 0.5 ? 'ps' : 'pm';
      return `<td class="${cls}" title="${fmtTime(v)}">${DK.pace === 'median' ? fmtTime(v).replace(/^\d+:/, '') : (d >= 0 ? '+' : '') + d.toFixed(2)}</td>`; }).join('')}</tr>`);
  }
  const stint = `<tr class="dkstint"><td class="dim">STINT</td>${cars.map(c => kind === 'race' ? `<td><span style="color:${TYRES[c.tyre].col}">${c.tyre}</span>${(c.stints || [1]).length}</td>` : `<td>${c.runs.filter(r => r.done).length + 1}</td>`).join('')}</tr>`;
  return `<table class="dkpt"><thead><tr><th></th>${cars.map(c => `<th style="--tc:${c.t.color}">${esc(c.d.code)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}${stint}</tbody></table>`;
}
function dkCross(kind, S, ord) {
  if (kind === 'race') {
    const n = ord[0].laps; const list = RACE.cars.filter(c => c.cross[n] != null && !c.out).sort((a, b) => a.cross[n] - b.cross[n]);
    const t0 = list[0] ? list[0].cross[n] : 0;
    return `<div class="dk-mut">LAP ${n} · ${list.length}/${RACE.cars.filter(c => !c.out).length} crossed</div>` + list.map((c, i) => `<div class="dkx ${i === 0 ? 'first' : ''}"><span>P${i + 1}</span><i style="background:${c.t.color}"></i><b>${c.d.num || ''}</b><span class="nm">${esc(c.d.name)}</span><span class="lp">${n}</span><span>${i ? '+' + (c.cross[n] - t0).toFixed(1) : ''}</span></div>`).join('');
  }
  const on = S.cars.filter(c => !c.out && c.phase !== 'garage').sort((a, b) => b.frac - a.frac);
  return `<div class="dk-mut">${on.length} cars on track</div>` + on.map((c, i) => `<div class="dkx"><span>${i + 1}</span><i style="background:${c.t.color}"></i><b>${c.d.num || ''}</b><span class="nm">${esc(c.d.name)}</span><span class="lp ${c.phase === 'flying' ? 'pu' : ''}">${c.phase === 'flying' ? 'PUSH' : c.phase === 'out' ? 'OUT' : 'IN'}</span><span>${Math.round(c.frac * 100)}%</span></div>`).join('');
}
function dkStatus(kind, S, ord) {
  return ord.map(c => { let s, cl;
    if (kind === 'race') { s = c.out ? 'RETIRED' : c.finished ? 'FINISHED' : c.pitT > 0 ? 'IN PIT' : c.pitReq ? 'BOX BOX' : 'ON TRACK'; cl = c.out ? 'r' : c.pitT > 0 || c.pitReq ? 'y' : 'g'; }
    else { s = c.out ? 'OUT' : c.phase === 'garage' ? 'GARAGE' : c.phase === 'flying' ? 'FLYING' : c.phase === 'out' ? 'OUT LAP' : 'IN LAP'; cl = c.out ? 'r' : c.phase === 'garage' ? 'dim' : c.phase === 'flying' ? 'pu' : 'g'; }
    const rel = kind === 'race' && !c.out ? (c.puStress > 1.15 ? 'y' : 'g') : 'dim';
    return `<div class="dks"><i style="background:${c.t.color}"></i><span>${esc(c.d.code)}</span><b class="${cl}">${s}</b><em class="${rel}">◆</em><em class="${c.out ? 'r' : 'g'}">●</em></div>`; }).join('');
}

// ---------- drawing ----------
function dkTerrain(w, h) {
  const k = w + 'x' + h; if (DK._terr && DK._terr.k === k) return DK._terr.c;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2d3a26'); gr.addColorStop(0.5, '#33432b'); gr.addColorStop(1, '#283321'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  const r = seeded('terrain' + (WK && WK.track.id)); // patchwork fields
  for (let i = 0; i < 70; i++) { x.save(); x.translate(r() * w, r() * h); x.rotate((r() - 0.5) * 0.6); x.fillStyle = `hsla(${80 + r() * 40},${20 + r() * 20}%,${18 + r() * 14}%,0.55)`; x.fillRect(-r() * 120, -r() * 80, 60 + r() * 160, 40 + r() * 110); x.restore(); }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.06})`; x.fillRect(r() * w, r() * h, 2, 2); }
  DK._terr = { k, c }; return c;
}
function dkDrawMap(cv, kind, S, mini) {
  if (!cv || !cv._w) return;
  const ctx = cv.getContext('2d'), w = cv._w, h = cv._h, dpr = cv._dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = trackGeometry(S.track), top = mini ? 0 : Math.min(h * 0.16, 90), pad = mini ? 18 : 30, s = Math.min(w * 0.94, h - top) - pad * 2, ox = (w - s) / 2 + (mini ? 0 : w * 0.03), oy = top + (h - top - s) / 2;
  const X = p => ox + p[0] * s, Y = p => oy + p[1] * s;
  if (mini) { ctx.clearRect(0, 0, w, h); } else { ctx.drawImage(dkTerrain(w, h), 0, 0, w, h); if (S.wet > 0.05) { ctx.fillStyle = `rgba(30,60,110,${S.wet * 0.3})`; ctx.fillRect(0, 0, w, h); } }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const path = () => { ctx.beginPath(); g.P.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.closePath(); };
  const yel = kind === 'race' && (RACE.sc || RACE.vsc);
  if (mini) { path(); ctx.strokeStyle = yel ? '#e8c22d' : '#1aa3d9'; ctx.lineWidth = 3; ctx.stroke(); }
  else { path(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 17; ctx.stroke(); ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 13; ctx.stroke(); ctx.strokeStyle = yel ? '#4d4419' : '#30343a'; ctx.lineWidth = 10; ctx.stroke(); }
  // sector marks + start line
  [1 / 3, 2 / 3].forEach((f, i) => { const p = pointAt(g, f), n = p[2] + Math.PI / 2; ctx.strokeStyle = mini ? '#cfe8ff' : '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(p) + Math.cos(n) * 7, Y(p) + Math.sin(n) * 7); ctx.lineTo(X(p) - Math.cos(n) * 7, Y(p) - Math.sin(n) * 7); ctx.stroke();
    if (mini) { ctx.fillStyle = '#cfe8ff'; ctx.font = '11px ui-monospace,monospace'; ctx.fillText('S' + (i + 2), X(p) + 9, Y(p) + 4); } });
  const s0 = pointAt(g, 0); ctx.save(); ctx.translate(X(s0), Y(s0)); ctx.rotate(s0[2] + Math.PI / 2); for (let k = -3; k < 3; k++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (k + j) % 2 ? '#fff' : '#111'; ctx.fillRect(k * 2.5, -2.5 + j * 2.5, 2.5, 2.5); } ctx.restore();
  // cars
  const ord = kind === 'race' ? RACE.order() : S.order(); const r0 = mini ? 4.5 : 9;
  const list = [];
  ord.forEach((c, i) => {
    let frac, x, y, dim = false;
    if (kind === 'race') { if (c.out) return; frac = c.finished ? 0.002 * i : (RACE.started ? c.dist : c.dist * 2.6) / RACE.L; const p = pointAt(g, frac); x = X(p); y = Y(p);
      if (!RACE.started) { const n = p[2] + Math.PI / 2, sd = (c.grid % 2 ? -1 : 1) * 5; x += Math.cos(n) * sd; y += Math.sin(n) * sd; }
      if (c.pitT > 0) { const n = p[2] + Math.PI / 2; x += Math.cos(n) * 16; y += Math.sin(n) * 16; dim = true; } }
    else { if (c.out || c.phase === 'garage' || c.phase === 'crashed') return; const p = pointAt(g, c.frac); x = X(p); y = Y(p); dim = c.phase !== 'flying'; }
    list.push({ c, x, y, dim, i });
  });
  for (let k = list.length - 1; k >= 0; k--) { const { c, x, y, dim, i } = list[k]; const hi = c.player || c.fav;
    ctx.globalAlpha = dim ? 0.55 : 1; ctx.beginPath(); ctx.arc(x, y, hi ? r0 + 2 : r0, 0, 6.283); ctx.fillStyle = c.t.color; ctx.fill(); ctx.lineWidth = hi ? 2.5 : 1.5; ctx.strokeStyle = hi ? '#ffd400' : '#fff'; ctx.stroke();
    if (!mini) { ctx.fillStyle = dkInk(c.t.color); ctx.font = `bold ${hi ? 11 : 10}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(kind === 'race' ? String(i + 1) : String(c.d.num || c.d.code[0]), x, y + 0.5); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; }
    else if (hi || i === 0) { ctx.fillStyle = '#fff'; ctx.font = '11px ui-monospace,monospace'; ctx.fillText(c.d.code, x + 7, y - 6); }
    ctx.globalAlpha = 1; }
}
function dkSize(cv) {
  if (!cv) return; const box = cv.parentElement; const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv._w = w; cv._h = h; cv._dpr = dpr;
}

// ---------- live update ----------
function dkUpdate() {
  const kind = dkStage(); if (!kind || kind === 'fp' || !document.getElementById('dk')) return;
  const S = kind === 'race' ? RACE : curQS().live; if (!S) return;
  dkCollect(kind, S);
  const ord = kind === 'race' ? RACE.order() : S.order();
  const set = (id, html) => { const el = document.getElementById(id); if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
  const prog = kind === 'race' ? RACE.t / 3000 : S.t / 3000, env = dkEnv(S.wet || 0, prog);
  const [fl, fc] = dkFlagState(kind, S);
  const fe = document.getElementById('dkflag'); if (fe) { fe.textContent = fl; fe.className = 'dk-flagst ' + fc + (fe.classList.contains('sm') ? ' sm' : ''); }
  const leader = ord[0];
  set('dksess', kind === 'race' ? `LAP ${Math.min(RACE.laps, leader.laps + (leader.finished ? 0 : RACE.started ? 1 : 0))} / ${RACE.laps}` : `${esc(S.label)} · TIME ${fmtClock(S.clock())}`);
  set('dktemp', env.track.toFixed(1) + '°C'); set('dkrain', env.rain.toFixed(1) + ' mm'); set('dkrains', env.rain > 4 ? 'Heavy rain' : env.rain > 1.5 ? 'Wet' : env.rain > 0 ? 'Damp' : 'Dry'); set('dkwind', Math.round(env.wind) + ' km/h');
  const sig = (RACE && RACE.started ? 1 : 0) + ':' + PAUSED + ':' + SPEED + ':' + (LIGHTS ? LIGHTS.phase : '');
  if (DK.rsig !== sig || !document.querySelector('#rctl .spd, #rctl .dk-go')) { DK.rsig = sig; const rc = document.getElementById('rctl'); if (rc) rc.innerHTML = dkSpd(); }
  set('dkwall', dkWall(kind, S, ord));
  if (DK.view === 'tele') {
    set('dkttable', dkTeleTable(kind, S, ord));
    const SB = S._bs || []; const fast = kind === 'race' ? RACE.fastest : S.best; const top = Object.entries(DK.vmax).sort((a, b) => b[1] - a[1])[0];
    set('dktfoot', `FASTEST: <b class="pu">${fast ? dkT(fast.t) + ' ' + esc(fast.c.d.code) : '--:--.---'}</b> <span class="pu">S1 ${SB[0] ? SB[0].toFixed(3) : '--.-'}</span> <span class="pu">S2 ${SB[1] ? SB[1].toFixed(3) : '--.-'}</span> <span class="pu">S3 ${SB[2] ? SB[2].toFixed(3) : '--.-'}</span> LED: <b>${esc(leader.d.code)}</b> TOP: <b>${top && top[1] ? top[1] + ' km/h ' + esc(G.drivers[top[0]] ? G.drivers[top[0]].code : '') : '--.- km/h'}</b>`);
    set('dkcross', dkCross(kind, S, ord)); set('dkstatus', dkStatus(kind, S, ord)); set('dkpace', dkPace(kind, S, ord));
    set('dklapc', kind === 'race' ? `LAP ${Math.min(RACE.laps, leader.laps)} / ${RACE.laps}` : fmtClock(S.clock()));
    set('dkwindp', `<div class="dkwind"><span class="arr" style="transform:rotate(${(env.dir + 90).toFixed(0)}deg)">➜</span><b>${Math.round(env.wind)} km/h</b></div><div class="dk-mut">toward ${dkCompass(env.dir)} (${Math.round(env.dir)}°)</div><div class="r">Impact: +${(env.wind * 0.008).toFixed(3)}s</div><div class="dk-mut">Air ${env.air.toFixed(1)}°C · Track ${env.track.toFixed(1)}°C</div>`);
    set('dkminilog', `<div class="dk-h"><b>${kind === 'race' ? 'RACE EVENT LOG' : 'SESSION LOG'}</b></div>` + DK.ev.slice(0, 6).map(e => `<div><span style="color:${DK_CAT[e.cat][1]}">${DK_CAT[e.cat][0]}:</span> ${esc(e.s)}</div>`).join(''));
  } else {
    set('dktable', dkOrderTable(kind, S, ord));
    set('dkev', DK.ev.filter(e => DK.evf === 'all' || e.cat === DK.evf).slice(0, 40).map(e => `<div class="dkev"><span class="tag" style="background:${DK_CAT[e.cat][1]}">${DK_CAT[e.cat][0]}</span><span class="lab">${e.lab}</span><span>${esc(e.s)}</span></div>`).join('') || '<div class="dk-mut">No events yet</div>');
    set('dkchars', dkChars(kind, S));
  }
}
function dkDraw() {
  const kind = dkStage(); if (!kind || kind === 'fp') return;
  const S = kind === 'race' ? RACE : curQS().live; if (!S) return;
  const cv = document.getElementById('cv'), tg = document.getElementById('tgps');
  if (cv && !cv._w) dkSize(cv); if (tg && !tg._w) dkSize(tg);
  if (cv) dkDrawMap(cv, kind, S, false); if (tg) dkDrawMap(tg, kind, S, true);
}

// ---------- practice results page ----------
function deskPractice() {
  const t = WK.track, mine = myEntries(), last = WK.fp[WK.fp.length - 1], done = WK.session > WK.sessions;
  const sess = WK.fp.length ? (WK.sprint ? 'Practice' : 'FP' + WK.fp.length) : (WK.sprint ? 'Practice' : 'FP' + WK.session);
  const lead = last && last[0];
  const rows = last ? last.map((r, i) => { const e = r.e, ty = r.tyre || 'S';
    return `<tr class="${isMine(e) ? 'me' : ''}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">P${String(i + 1).padStart(2, '0')}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="l hm">${esc(e.t.name)}</td><td class="l hm">${esc(dkEngine(e.t))}</td><td class="l">${TYRES[ty].name}</td><td class="ra">${fmtTime(r.t)}</td><td class="ra">${i ? '+' + (r.t - lead.t).toFixed(3) : '--'}</td><td class="ra dimc">${r.laps}</td></tr>`; }).join('') : '';
  const progBtns = e => Object.entries(PROGRAMS).map(([k, p]) => `<button class="${(WK.programs[e.d.id] || 'setup') === k ? 'on' : ''}" data-a="prog" data-d="${e.d.id}" data-v="${k}">${p.name}</button>`).join('');
  const pct = v => Math.round(v * 100) + '%';
  return `<div class="dk dk-fp" id="dk">
  <div class="dk-fptitle">${last ? `${sess} Results` : `${WK.sprint ? 'Practice' : 'Free Practice ' + WK.session}`} - ${esc(t.short)} <span class="dk-mut">ROUND ${WK.round + 1} · ${G.year}${WK.sprint ? ' · SPRINT WEEKEND' : ''}</span></div>
  ${mine.length && !done ? `<div class="dk-fpplan">${mine.map(e => `<div class="dk-fpd" style="--tc:${e.t.color}"><b>${esc(e.d.name)}</b><span class="dk-seg">${progBtns(e)}</span><span class="dk-mut">Setup ${pct(e.setup)} · Tyres ${pct(e.tyreKnow)} · Quali ${pct(e.qualiPrep)}</span></div>`).join('')}</div>` : ''}
  <div class="dk-fpbox">${last ? `<table class="dkfp"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="l hm">Engine</th><th class="l">Tyre</th><th class="ra">Lap</th><th class="ra">Gap</th><th class="ra">Laps</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="dk-fpempty"><div>${dkFlag(t.cc, 'xl')}</div><b>${esc(t.name)}</b><div class="dk-mut">${t.km.toFixed(3)} km · ${t.laps} laps · ${esc(WK.forecast || '')}</div><div class="dk-mut">${G.spectator ? 'Teams are about to head out to dial in their set-ups.' : 'Choose a run plan for each driver, then start the session.'}</div></div>`}</div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">Press ENTER/SPACE or click ${done ? 'Continue' : 'Run session'}.</span><span class="sp"></span>
    ${last ? '<button data-a="dkexport">Export Logs</button>' : ''}
    ${!done && WK.sessions > 1 && WK.session <= WK.sessions ? '<button data-a="skipfp">Skip practice</button>' : ''}
    <button data-a="autorace">Skip to the ${WK.sprint && !WK.sprintRows ? 'Sprint' : 'race'}</button>
    <button class="pri" data-a="dkcont">${done ? (WK.sprint ? 'Continue to Sprint Qualifying' : 'Continue to Qualifying') : 'Run ' + (WK.sprint ? 'Practice' : 'FP' + WK.session)}</button></div></div>`;
}

// ---------- hooks into the base game ----------
const _dk_viewWeekend = viewWeekend;
viewWeekend = function () {
  const k = deskOn() ? dkStage() : null;
  document.body.classList.toggle('dk-on', !!k);
  if (k === 'fp') return deskPractice();
  if (k === 'race' || k === 'quali') return deskLive(k);
  return _dk_viewWeekend();
};
const _dk_render = render;
render = function () { _dk_render(); if (VIEW !== 'weekend') document.body.classList.remove('dk-on'); if (document.getElementById('dk')) { DK.rsig = ''; requestAnimationFrame(() => { dkSize(document.getElementById('cv')); dkSize(document.getElementById('tgps')); dkUpdate(); }); } };
const _dk_drawRace = drawRace; drawRace = function () { if (document.getElementById('dk')) return dkDraw(); return _dk_drawRace(); };
const _dk_drawQuali = drawQuali; drawQuali = function (Q) { if (document.getElementById('dk')) return dkDraw(); return _dk_drawQuali(Q); };
const _dk_sizeCanvas = sizeCanvas; sizeCanvas = function () { if (document.getElementById('dk')) { dkSize(document.getElementById('cv')); dkSize(document.getElementById('tgps')); return; } return _dk_sizeCanvas(); };
const _dk_updRace = updateRaceUI; updateRaceUI = function (f) { _dk_updRace(f); if (document.getElementById('dk')) dkUpdate(); };
const _dk_updQuali = updateQualiUI; updateQualiUI = function () { _dk_updQuali(); if (document.getElementById('dk')) dkUpdate(); };
window.addEventListener('resize', () => {
  const on = !!document.getElementById('dk'), want = VIEW === 'weekend' && dkActive();
  if (on !== want) { render(); return; }
  if (on) { DK._terr = null; dkSize(document.getElementById('cv')); dkSize(document.getElementById('tgps')); }
});
// practice rows remember the tyre they set their time on
const _dk_runPractice = runPractice;
runPractice = function (G0, wk, session, programs) { const rows = _dk_runPractice(G0, wk, session, programs); rows.forEach(r => { if (!r.tyre) r.tyre = wk.weather.quali > 0.65 && session === 2 ? 'W' : r.prog === 'quali' ? 'S' : r.prog === 'long' ? pick(['M', 'H', 'M']) : pick(['S', 'M', 'S']); }); return rows; };

Object.assign(A, {
  dkview(el) { DK.view = el.dataset.v; render(); },
  dktab(el) { DK.tab = el.dataset.v; document.querySelectorAll('.dk-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === DK.tab)); const t = document.getElementById('dktable'); if (t) t._h = null; dkUpdate(); },
  dkgap() { DK.gap = DK.gap === 'leader' ? 'int' : 'leader'; dkUpdate(); },
  dkevf(el) { DK.evf = el.dataset.v; document.querySelectorAll('.dk-filt button[data-a=dkevf]').forEach(b => b.classList.toggle('on', b.dataset.v === DK.evf)); dkUpdate(); },
  dkpace(el) { DK.pace = el.dataset.v; document.querySelectorAll('[data-a=dkpace]').forEach(b => b.classList.toggle('on', b.dataset.v === DK.pace)); dkUpdate(); },
  dkcont() { if (WK.session > WK.sessions) A.toquali(); else A.runfp({ dataset: {} }); },
  dkexport() {
    const rows = [['Session', 'Pos', 'Driver', 'Team', 'Engine', 'Tyre', 'Lap', 'Gap', 'Laps']];
    WK.fp.forEach((s, k) => s.forEach((r, i) => rows.push([WK.sprint ? 'Practice' : 'FP' + (k + 1), i + 1, r.e.d.name, r.e.t.name, dkEngine(r.e.t), TYRES[r.tyre || 'S'].name, fmtTime(r.t), i ? (r.t - s[0].t).toFixed(3) : '', r.laps])));
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `practice-${WK.track.id}-${G.year}.csv`; document.body.appendChild(a); a.click(); a.remove();
  },
  dkmodal(el) {
    const v = el.dataset.v, kind = dkStage(), S = kind === 'race' ? RACE : kind === 'quali' ? curQS().live : null;
    if (v === 'settings') {
      modal(`<h3>Display settings</h3><label class="row" style="margin:8px 0"><input type="checkbox" data-a="dkclassic"> Use the classic layout on this device</label>
      <label class="row" style="margin:8px 0"><input type="checkbox" data-a="dkautop" ${G.autoPause ? 'checked' : ''}> Auto-pause for safety cars, rain and my car's problems</label>
      <div class="small mut">Keyboard: <b>T</b> telemetry / broadcast · <b>Space</b> pause · <b>1–5</b> speed</div><div class="row" style="margin-top:12px"><span class="sp"></span><button data-a="close">Close</button></div>`); return;
    }
    if (v === 'weather') {
      const env = dkEnv(S ? S.wet || 0 : 0, S ? S.t / 3000 : 0);
      const plan = (kind === 'race' ? RACE.plan : WK.weather.plan) || [];
      modal(`<h3>⛅ Weather forecast · ${esc(WK.track.short)}</h3><div style="margin:6px 0">${esc(WK.forecast || '')}</div>
      <div class="small">Air ${env.air.toFixed(1)}°C · Track ${env.track.toFixed(1)}°C · Wind ${Math.round(env.wind)} km/h toward ${dkCompass(env.dir)}</div>
      <div class="small" style="margin-top:6px">Qualifying rain chance: <b>${Math.round(WK.weather.quali * 100)}%</b> · Race start: <b>${WK.weather.start > 0.22 ? 'wet' : 'dry'}</b></div>
      ${plan.length ? plan.map(p => `<div class="small" style="margin-top:4px">${p.target > 0.05 ? '🌧️ Rain expected around lap ' : '🌤️ Drying from around lap '}${p.lap}</div>`).join('') : '<div class="small mut" style="margin-top:6px">No rain change expected in the race.</div>'}
      <div class="row" style="margin-top:12px"><span class="sp"></span><button data-a="close">Close</button></div>`); return;
    }
    if (!S) return;
    const cars = kind === 'race' ? RACE.cars : S.cars;
    if (v === 'trap' || v === 'gps') {
      const list = cars.map(c => ({ c, v: DK.vmax[c.d.id] || Math.round(S.L / ((kind === 'race' ? c.curLT : (S.base || 90))) * 3.6 * dkProf(S.track).max) })).sort((a, b) => b.v - a.v);
      modal(`<h3>📶 Speed trap · top speed</h3><div class="dk-mut small" style="margin-bottom:6px">Fastest point of the lap, ${esc(WK.track.short)}</div>${list.map((x, i) => `<div class="row small"><span style="width:26px">${i + 1}</span><i style="width:4px;height:14px;background:${x.c.t.color}"></i><b style="width:44px">${esc(x.c.d.code)}</b><span class="sp mut">${esc(x.c.t.name)}</span><b>${x.v} km/h</b></div>`).join('')}<div class="row" style="margin-top:12px"><span class="sp"></span><button data-a="close">Close</button></div>`); return;
    }
    if (v === 'strategy') {
      if (kind !== 'race') { modal(`<h3>Tyre strategy</h3><div class="mut">Everyone runs new softs in qualifying${S.wet > 0.25 ? ' — or wets/inters in the rain' : ''}.</div><div class="row" style="margin-top:12px"><span class="sp"></span><button data-a="close">Close</button></div>`); return; }
      const ord = RACE.order(), L = RACE.laps;
      modal(`<h3>Tyre strategy</h3>${ord.map(c => { const st = c.stints || [{ tyre: c.tyre, from: 0 }]; return `<div class="row small" style="gap:6px"><b style="width:40px">${esc(c.d.code)}</b><div class="dkstrat">${st.map((s, k) => { const to = k + 1 < st.length ? st[k + 1].from : Math.max(c.laps, s.from + 1); return `<i style="left:${s.from / L * 100}%;width:${Math.max(0.5, (to - s.from) / L * 100)}%;background:${TYRES[s.tyre].col}"></i>`; }).join('')}</div></div>`; }).join('')}<div class="row" style="margin-top:12px"><span class="sp"></span><button data-a="close">Close</button></div>`); return;
    }
    if (v === 'sectors') {
      const SB = S._bs || [], ord = kind === 'race' ? RACE.order() : S.order();
      modal(`<h3>Sector delta to the best</h3><div class="small mut">Each driver's best sector vs the session best</div>${ord.filter(c => c._bs).map(c => `<div class="row small" style="gap:10px"><b style="width:40px">${esc(c.d.code)}</b>${[0, 1, 2].map(i => c._bs[i] != null && SB[i] != null ? `<span style="width:80px" class="${c._bs[i] - SB[i] < 1e-6 ? 'pu' : ''}">S${i + 1} +${(c._bs[i] - SB[i]).toFixed(3)}</span>` : '<span style="width:80px" class="mut">S' + (i + 1) + ' --</span>').join('')}</div>`).join('') || '<div class="mut">No sectors yet.</div>'}<div class="row" style="margin-top:12px"><span class="sp"></span><button data-a="close">Close</button></div>`);
    }
  },
  dkclassic(el) { try { localStorage.setItem('pitwall_desk', el.checked ? 'off' : 'on'); } catch (e) { } closeModal(); render(); },
  dkautop(el) { G.autoPause = el.checked; autosave(); },
});

// quali lap list for the pace table
const _dk_lapDone2 = QualiLive.prototype.lapDone;
QualiLive.prototype.lapDone = function (c, lt) { (c._lt = c._lt || []).push(lt); return _dk_lapDone2.call(this, c, lt); };

document.addEventListener('keydown', e => {
  if (!document.getElementById('dk') || e.target.closest && e.target.closest('input,textarea,select') || document.getElementById('modal')) return;
  const kind = dkStage();
  if (kind === 'fp') { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); A.dkcont(); } return; }
  if (kind !== 'race' && kind !== 'quali') return;
  if (e.key === 't' || e.key === 'T') { DK.view = DK.view === 'tele' ? 'live' : 'tele'; render(); }
  else if (e.key === ' ') { e.preventDefault(); if (kind === 'race' && !RACE.started) A.lights(); else { PAUSED = !PAUSED; DK.rsig = ''; dkUpdate(); } }
  else if (/^[1-5]$/.test(e.key) && !(kind === 'race' && !RACE.started)) { PAUSED = false; SPEED = [4, 16, 32, 64, 256][+e.key - 1]; raceBanner = ''; const b = document.getElementById('rbanner'); if (b) { b.className = ''; b.textContent = ''; } DK.rsig = ''; dkUpdate(); }
});
