// ===================== Group lottery qualifying =====================
// Before qualifying, a number lottery splits the field into three equal groups (A, B, C).
// The groups run one after another (like Q1, Q2, Q3), so they never meet on track. Within a group the cars are released
// in lottery order, spaced out so nobody catches the car ahead. Each driver gets an out lap, 3 timed laps and an in lap;
// their best lap counts. Grid: the fastest of each group fill P1–P3 (sorted by time), the second fastest of each group
// P4–P6, and so on — so the slowest of each group make up the back of the grid.
function qGroups() { return !!(G && WK && WK.stage === 'quali' && G.rules && G.rules.quali === 'groups'); }
const QG_NAMES = ['A', 'B', 'C'];
// The draw: drivers come up one at a time (championship order) and each draws a numbered ball from the lottery machine.
// Numbers 1..n1 are Group A, then Group B, then Group C. qgEnsure(true) finishes any draw still in progress at random.
function qgDrawState(QS) {
  if (!QS.draw) {
    const ds = typeof standingsDrivers === 'function' ? standingsDrivers(G) : [];
    const rank = e => { if (!G.results.length) return 0; const i = ds.findIndex(d => d.id === e.d.id); return i < 0 ? 999 : i; }; // round 1: team order
    const order = WK.entries.slice().sort((a, b) => rank(a) - rank(b) || WK.entries.indexOf(a) - WK.entries.indexOf(b));
    QS.draw = { order, picks: [] };
  }
  return QS.draw;
}
function qgSizes(N) { const base = Math.floor(N / 3), extra = N % 3; return [0, 1, 2].map(k => base + (k < extra ? 1 : 0)); }
function qgGroupOfNum(n, N) { const s = qgSizes(N); return n <= s[0] ? 0 : n <= s[0] + s[1] ? 1 : 2; }
function qgFinishDraw(QS) {
  const D = qgDrawState(QS), N = WK.entries.length, used = new Set(D.picks.map(p => p.n));
  const left = shuffle([...Array(N)].map((_, i) => i + 1).filter(n => !used.has(n)));
  D.order.slice(D.picks.length).forEach((e, i) => D.picks.push({ e, n: left[i] }));
  const lot = D.picks.map(p => ({ e: p.e, n: p.n })).sort((a, b) => a.n - b.n);
  let k = 0; QS.groups = qgSizes(N).map(sz => { const g = lot.slice(k, k + sz); k += sz; return g; });
  QS.groups.forEach((g, gi) => g.forEach(x => { x.g = gi; }));
  QS.lot = lot; QS.gres = QS.gres || [];
}
function qgEnsure(force = true) {
  if (!qGroups()) return null;
  const QS = WK.Q;
  if (!QS.lot) { qgDrawState(QS); if (!force) return QS; qgFinishDraw(QS); }
  if (QS.stage <= 3) QS.alive = QS.groups[QS.stage - 1].map(x => x.e);
  return QS;
}
if (typeof shuffle !== 'function') window.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const _qg_qCut = qCut;
qCut = function (n) { return qGroups() ? 0 : _qg_qCut.apply(this, arguments); };
const _qg_qualiInfo = qualiInfo;
qualiInfo = function (key) {
  if (key === 'Q') qgEnsure(false);
  const I = _qg_qualiInfo.apply(this, arguments);
  if (key === 'Q' && qGroups()) {
    const st = Math.min(I.stage, 3);
    Object.assign(I, { groups: true, single: false, cut: 0, runs: 3, label: 'Group ' + QG_NAMES[st - 1], n: WK.Q.groups ? (WK.Q.groups[st - 1] || []).length : qgSizes(WK.entries.length)[st - 1], dur: 600 });
  }
  return I;
};

const _qg_QualiLive = QualiLive;
QualiLive = class extends _qg_QualiLive {
  constructor(G0, wk, list, opts) {
    const grp = qGroups() && !opts.elim;
    if (grp) { qgEnsure(true); list = WK.Q.alive; }
    if (grp) { const st = Math.min(WK.Q.stage, 3); opts = Object.assign({}, opts, { label: 'Group ' + QG_NAMES[st - 1], cut: 0, runs: 1, dur: 600 }); }
    super(G0, wk, list, opts);
    if (grp) this.groupSetup(WK.Q.stage);
  }
  groupSetup(stage) {
    const base = this.base, QS = WK.Q, order = (QS.groups[stage - 1] || []).map(x => x.e);
    this.groupMode = true; this.gName = QG_NAMES[stage - 1];
    // release order = lottery order; gap big enough that a faster car can't catch the one ahead over 3 laps
    const gap = Math.max(10, base * 0.13); let last = 0;
    const cars = order.map(e => this.cars.find(c => c.e === e)).filter(Boolean);
    cars.forEach((c, i) => {
      const t0 = 5 + i * gap, OL = base * 1.4 * rnd(0.98, 1.02), IL = base * 1.45 * rnd(0.98, 1.02);
      const evo = Math.min(0.3, (stage - 1) * 0.08 + t0 / 900 * 0.1); // the track rubbers in a little through the session
      c.runs = []; let t = t0;
      [0.18, 0, 0.22].forEach((adj, k) => { // lap 1 tyres still coming in, lap 2 the peak, lap 3 the tyres fade
        const q = qualiLap(this.G, c.e, this.track, this.wet, c.risk);
        const fly = (q.crash ? base * rnd(1, 1.02) : q.t) - evo + adj;
        const ol = k === 0 ? OL : 0.05, il = k === 2 ? IL : 0.05;
        c.runs.push({ start: t, OL: ol, IL: il, fly, crash: q.crash, crashAt: rnd(0.2, 0.9), done: false, aborted: false });
        t += ol + fly + il;
      });
      c.qgNo = (QS.lot.find(x => x.e === c.e) || {}).n; last = Math.max(last, t);
    });
    this.dur = Math.ceil(last + 20); this.log = []; this.events = [];
    this.msg(`🟢 ${this.label} is under way — ${cars.length} cars, released ${gap.toFixed(0)} s apart in lottery order. Out lap, 3 timed laps, in lap — best lap counts.`, true);
  }
};

// quick-simulated sessions use the same live model
const _qg_runQualiSession = runQualiSession;
runQualiSession = function (G0, wk, list, stage, risks) {
  if (!qGroups()) return _qg_runQualiSession.apply(this, arguments);
  qgEnsure();
  const Q = new QualiLive(G0, wk, WK.Q.alive, { risks: risks || {} }); let n = 0;
  while (!Q.done && n++ < 40000) Q.step(0.5);
  return Q.result;
};

function qgGrid(QS) {
  const R = QS.gres, rows = [], depth = Math.max(...R.map(r => r.length));
  for (let k = 0; k < depth; k++) {
    const tier = R.map((r, g) => r[k] ? Object.assign({}, r[k], { qg: g, qgPos: k + 1 }) : null).filter(Boolean);
    tier.sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
    rows.push(...tier);
  }
  return rows;
}
const _qg_applyQualiStage = applyQualiStage;
applyQualiStage = function (QS, res) {
  if (!qGroups()) return _qg_applyQualiStage.apply(this, arguments);
  qgEnsure();
  const g = QS.stage - 1;
  QS.gres[g] = res.map(r => Object.assign({}, r, { qg: g }));
  QS.rounds.push({ stage: QS.stage, res });
  QS.stage++;
  if (QS.stage > 3) { QS.top = qgGrid(QS); WK.grid = QS.top.map(r => r.e); QS.alive = WK.entries.slice(); }
  else QS.alive = QS.groups[QS.stage - 1].map(x => x.e);
};

// ---------- weekend page: the lottery, the groups and the grid being built ----------
function qgPanel() {
  const QS = qgEnsure(); if (!QS) return '';
  const st = QS.stage, mine = e => (G.player && e.t.id === G.player) || G.follow === e.d.id;
  const cols = QS.groups.map((g, gi) => {
    const res = QS.gres[gi], state = gi + 1 < st ? 'done' : gi + 1 === st ? 'next' : 'wait';
    const rows = res ? res.map((r, i) => `<tr class="${mine(r.e) ? 'me' : ''}"><td>${i + 1}</td><td>${flag(r.e.d.nat)} ${esc(r.e.d.code || r.e.d.name)}</td><td class="mut small">${esc(r.e.t.name)}</td><td style="text-align:right">${r.t != null ? fmtTime(r.t) : (r.crash ? 'Crash' : 'No time')}</td></tr>`).join('')
      : g.map(x => `<tr class="${mine(x.e) ? 'me' : ''}"><td class="mut">#${x.n}</td><td>${flag(x.e.d.nat)} ${esc(x.e.d.code || x.e.d.name)}</td><td class="mut small">${esc(x.e.t.name)}</td><td></td></tr>`).join('');
    return `<div class="qg-col qg-${state}"><h4>Group ${QG_NAMES[gi]} <span class="small mut">${state === 'done' ? 'finished' : state === 'next' ? 'runs next' : 'waiting'} · ${g.length} cars</span></h4><table class="qg-t">${rows}</table></div>`;
  }).join('');
  let grid = '';
  if (st > 3 && QS.top) {
    grid = `<h4 style="margin-top:10px">Starting grid</h4><div class="small mut">Fastest of each group take P1–P3, second fastest P4–P6, and so on.</div><table class="qg-t">${QS.top.map((r, i) => `<tr class="${mine(r.e) ? 'me' : ''}"><td><b>P${i + 1}</b></td><td>${flag(r.e.d.nat)} ${esc(r.e.d.name)}</td><td class="mut small">Group ${QG_NAMES[r.qg]} · ${r.qgPos}${['st', 'nd', 'rd'][r.qgPos - 1] || 'th'}</td><td style="text-align:right">${r.t != null ? fmtTime(r.t) : 'No time'}</td></tr>`).join('')}</table>`;
  }
  return `<div class="card qg-card"><h3>🎱 Group lottery qualifying</h3>
    <div class="small mut">The lottery drew a number for every driver: numbers 1–${QS.groups[0].length} are Group A, then Group B, then Group C. Groups run one after another and never meet on track. Each driver does 3 timed laps; the best counts. The grid takes the fastest of each group first, then the second fastest of each group, and so on.</div>
    <div class="qg-cols">${cols}</div>${grid}</div>`;
}
const _qg_wkQuali = wkQuali;
wkQuali = function (key) {
  let html = _qg_wkQuali.apply(this, arguments);
  if (key !== 'Q' || !qGroups()) return html;
  const QS = WK.Q; if (QS.live && !QS.live.done) return html;
  html = html.replace(' · the top 10 shoot-out for pole', ' · 3 timed laps each, best lap counts')
    .replace(/Knockout qualifying decides the grid\. Watch every flying lap live\./, 'Group lottery qualifying decides the grid.')
    .replace(/<h3>(Group [ABC]) · \d+ minutes<\/h3>/, '<h3>$1</h3>').replace(/>Q([123]) classification</, (m, s) => `>Group ${QG_NAMES[s - 1]} classification<`);
  return qgPanel() + html;
};

// broadcast-style (desk) qualifying page: the lottery draw, the three groups and the grid
function qgDeskBox() {
  const QS = qgEnsure(), st = QS.stage, tyre = TYRES[WK.weather.quali > 0.65 ? 'W' : WK.weather.quali > 0.25 ? 'I' : 'S'].name;
  const row = (e, a, b, c, extra) => `<tr class="${isMine(e) ? 'me' : ''}" data-prof="${e.d.id}" style="--tc:${e.t.color};--ti:${dkInk(e.t.color)}"><td class="pos">${a}</td><td class="l">${dkFlag(e.d.nat)} ${dkNm(e.d.name)}</td><td class="l hm">${esc(e.t.name)}</td>${extra || ''}<td class="ra">${b}</td><td class="ra">${c}</td></tr>`;
  const fmt = r => r.t != null ? fmtTime(r.t) : r.crash ? 'CRASH' : 'NO TIME';
  const groups = QS.groups.map((g, gi) => {
    const res = QS.gres[gi], state = gi + 1 < st ? 'FINISHED' : gi + 1 === st ? 'NEXT ON TRACK' : 'WAITING';
    const body = res ? res.map((r, i) => row(r.e, 'P' + (i + 1), fmt(r), i === 0 || r.t == null || res[0].t == null ? '--' : '+' + (r.t - res[0].t).toFixed(3))).join('')
      : g.map(x => row(x.e, '#' + x.n, '', '')).join('');
    return `<div class="qg-dcol ${gi + 1 === st ? 'qg-next' : ''}"><div class="qg-dh"><b>GROUP ${QG_NAMES[gi]}</b><span class="dk-mut">${state} · ${g.length} CARS</span></div><table class="dkfp"><thead><tr><th>${res ? 'Pos' : 'No.'}</th><th class="l">Driver</th><th class="l hm">Team</th><th class="ra">Lap</th><th class="ra">Gap</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }).join('');
  let grid = '';
  if (st > 3 && QS.top) {
    const lead = QS.top.find(r => r.t != null);
    grid = `<div class="qg-dh" style="margin-top:1em"><b>STARTING GRID</b><span class="dk-mut">Fastest of each group take P1–P3 (in time order), second fastest P4–P6, and so on</span></div>
    <table class="dkfp"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="l hm">Team</th><th class="l">Group</th><th class="l hm">Tyre</th><th class="ra">Lap</th><th class="ra">Gap to fastest</th></tr></thead><tbody>${QS.top.map((r, i) => row(r.e, 'P' + String(i + 1).padStart(2, '0'), fmt(r), r.t == null || !lead || r === lead ? '--' : '+' + (r.t - lead.t).toFixed(3), `<td class="l">${QG_NAMES[r.qg]} · ${r.qgPos}${['st', 'nd', 'rd'][r.qgPos - 1] || 'th'}</td><td class="l hm">${tyre}</td>`)).join('')}</tbody></table>`;
  }
  const intro = st === 1 && !QS.gres.length ? `<div class="dk-mut qg-intro">🎱 Lottery drawn — numbers 1–${QS.groups[0].length} are Group A, then B, then C. The groups run one after another and never meet on track; cars are released in number order. Out lap, 3 timed laps, in lap — best lap counts.${WK.weather.quali > 0.25 ? ' 🌧️ Wet session.' : ''}</div>` : '';
  return `<div class="dk-fpbox">${intro}${st > 3 ? grid + `<div class="qg-dcols" style="margin-top:1em">${groups}</div>` : `<div class="qg-dcols">${groups}</div>`}</div>`;
}
if (typeof deskQualiRes === 'function') {
  const _qg_deskQualiRes = deskQualiRes;
  deskQualiRes = function (key) {
    const html = _qg_deskQualiRes.apply(this, arguments);
    if (key !== 'Q' || !qGroups()) return html;
    const Q0 = qgEnsure(false);
    if (Q0 && !Q0.lot && Q0.stage === 1) { const a0 = html.indexOf('<div class="dk-fpbox">'); if (a0 >= 0) return html.slice(0, a0).replace(/Q1 [^<]*?- /, 'Qualifying Lottery - ').replace(/ · \d+ MIN · /, ' · ') + qgLotteryBox() + '</div>'; }
    const QS = qgEnsure(), a = html.indexOf('<div class="dk-fpbox">'), b = html.indexOf('<div class="dk-fpfoot">'); if (a < 0 || b < 0) return html;
    let out = html.slice(0, a) + qgDeskBox() + '\n  ' + html.slice(b);
    const t = esc(WK.track.short);
    if (QS.stage > 3) out = out.replace(/Qualifying Results - [^<]*/, `Qualifying Results - ${t}`);
    else if (QS.gres.length) out = out.replace(/Q\d Results - [^<]*/, `Group ${QG_NAMES[QS.gres.length - 1]} Results - ${t}`);
    return out.replace(/ · \d+ MIN · /, ' · ');
  };
}


// ===================== The lottery machine =====================
const LOT = { balls: [], key: null, raf: 0, last: 0, phase: null, t: 0, ball: null, auto: false, shown: null, autoT: 0 };
const LOT_COL = ['#e10600', '#f5c400', '#1e6fff'];
function lotNextDriver() { const D = WK.Q.draw; return D.order[D.picks.length]; }
function lotBoard() {
  const QS = WK.Q, D = QS.draw, N = WK.entries.length, sz = qgSizes(N), mine = e => (G.player && e.t.id === G.player) || G.follow === e.d.id;
  const cols = [0, 1, 2].map(g => {
    const nums = [...Array(sz[g])].map((_, i) => (g ? sz.slice(0, g).reduce((x, y) => x + y, 0) : 0) + i + 1);
    return `<div class="lot-col"><div class="lot-ch" style="--gc:${LOT_COL[g]}">GROUP ${QG_NAMES[g]} <span class="dk-mut">balls ${nums[0]}–${nums[nums.length - 1]}</span></div>${nums.map(n => { const p = D.picks.find(x => x.n === n);
      return `<div class="lot-slot ${p ? 'on' : ''} ${p && mine(p.e) ? 'me' : ''}"><span class="lot-num" style="--gc:${LOT_COL[g]}">${n}</span>${p ? `${dkFlag(p.e.d.nat)} <b>${esc(dkShort(p.e.d))}</b> <span class="dk-mut hm">${esc(p.e.t.name)}</span>` : '<span class="dk-mut">—</span>'}</div>`; }).join('')}</div>`;
  }).join('');
  const nx = lotNextDriver(), left = D.order.length - D.picks.length;
  const queue = D.order.slice(D.picks.length, D.picks.length + 6).map((e, i) => `<span class="${i ? '' : 'lot-now'}">${esc(dkShort(e.d))}</span>`).join(' › ');
  return `<div class="lot-status">${nx ? `<b>Next to draw:</b> ${dkFlag(nx.d.nat)} ${esc(nx.d.name)} <span class="dk-mut">(${esc(nx.t.name)}) · ${left} ball${left === 1 ? '' : 's'} left</span><div class="dk-mut lot-q">Draw order: ${queue}${left > 6 ? ' …' : ''}</div>` : '<b>Draw complete!</b>'}</div><div class="lot-cols">${cols}</div>`;
}
function qgLotteryBox() {
  const D = WK.Q.draw, busy = !!LOT.phase;
  return `<div class="dk-fpbox lot-box"><div class="dk-mut lot-intro">🎱 Before qualifying, every driver draws a numbered ball from the lottery machine${G.results.length ? ', in championship order' : ''}. Balls 1–${qgSizes(WK.entries.length)[0]} go into Group A, the next into Group B, the rest into Group C. Groups run one after another; within a group, cars go out in ball order.</div>
  <div class="lot-wrap"><div class="lot-mach"><canvas id="qglot"></canvas></div><div class="lot-board" id="qglotb">${lotBoard()}</div></div></div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">ENTER/SPACE draws the next ball.</span><span class="sp"></span><button data-a="lotall">Finish the draw instantly</button><button data-a="lotauto" id="lotautob" class="${LOT.auto ? 'on' : ''}">${LOT.auto ? '⏸ Stop auto draw' : '▶ Auto draw'}</button><button class="pri" data-a="lotdraw" data-enter="1" id="lotdrawb" ${busy ? 'disabled' : ''}>🎱 Draw ball</button></div>`;
}
function lotInit(cv) {
  const D = WK.Q.draw, key = WK.round + ':' + G.year;
  if (LOT.key !== key) { Object.assign(LOT, { key, balls: [], phase: null, ball: null, auto: false, shown: null, started: false }); }
  const used = new Set(D.picks.map(p => p.n));
  if (!LOT.balls.length || LOT.balls.some(b => used.has(b.n))) {
    LOT.balls = [...Array(WK.entries.length)].map((_, i) => i + 1).filter(n => !used.has(n) && !(LOT.ball && LOT.ball.n === n))
      .map(n => ({ n, x: rnd(-0.6, 0.6), y: rnd(0.3, 0.8), vx: 0, vy: 0 }));
  }
}
function lotStep(dt, strong) {
  const B = LOT.balls, r = 0.105, g = 3.2, idle = !LOT.started; // the blower is off until the first draw
  B.forEach(b => {
    b.vy += g * dt;
    // air jets from the bottom of the drum keep the balls dancing
    if (!idle && b.y > 0.45 && Math.random() < (strong ? 0.5 : 0.12)) { b.vy -= rnd(1.2, strong ? 4.2 : 2.6); b.vx += rnd(-1.2, 1.2); }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const d = Math.hypot(b.x, b.y), lim = 1 - r;
    if (d > lim) { const nx = b.x / d, ny = b.y / d, vn = b.vx * nx + b.vy * ny; b.x = nx * lim; b.y = ny * lim; if (vn > 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } b.vx += -ny * 0.4 * dt * 10; b.vy += nx * 0.4 * dt * 10; b.vx *= 0.97; b.vy *= 0.97; }
  });
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < 2 * r) { const nx = dx / d, ny = dy / d, o = (2 * r - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const k = -0.9 * rv; a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny; } }
  }
}
function lotBall(ctx, x, y, R, n) {
  const col = LOT_COL[qgGroupOfNum(n, WK.entries.length)];
  const gr = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R); gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, col); gr.addColorStop(1, '#00000099');
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.3); ctx.fill(); ctx.fillStyle = gr; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, R * 0.55, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(R * 0.68)}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, x, y + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function lotFrame(now) {
  const cv = document.getElementById('qglot');
  if (!cv || !WK || !WK.Q || !WK.Q.draw) { LOT.raf = 0; return; }
  LOT.raf = requestAnimationFrame(lotFrame);
  if (!cv._w) dkSize(cv); if (!cv._w) return;
  lotInit(cv);
  const dt = Math.min(0.033, (now - (LOT.last || now)) / 1000); LOT.last = now;
  const strong = LOT.phase === 'mix';
  lotStep(dt / 2, strong); lotStep(dt / 2, strong);
  // drawing phases: mix → the ball nearest the hatch is sucked up the tube → shown → recorded
  if (LOT.phase) {
    LOT.t += dt;
    if (LOT.phase === 'mix' && LOT.t > 1.1) {
      let best = null; LOT.balls.forEach(b => { const d = Math.hypot(b.x, b.y + 1); if (!best || d < best.d) best = { b, d }; });
      if (best) { LOT.ball = best.b; LOT.balls = LOT.balls.filter(b => b !== best.b); LOT.phase = 'lift'; LOT.t = 0; LOT.ball.sx = LOT.ball.x; LOT.ball.sy = LOT.ball.y; }
    } else if (LOT.phase === 'lift' && LOT.t > 0.9) { LOT.phase = 'show'; LOT.t = 0; }
    else if (LOT.phase === 'show' && LOT.t > (LOT.auto ? 0.9 : 1.3)) lotCommit();
  } else if (LOT.auto && now > LOT.autoT && lotNextDriver()) lotStart();
  // draw
  const ctx = cv.getContext('2d'), w = cv._w, h = cv._h; ctx.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const R = Math.min(w * 0.42, h * 0.36), cx = w * 0.5, cy = h * 0.6, X = x => cx + x * R, Y = y => cy + y * R, br = 0.105 * R;
  // stand
  ctx.fillStyle = '#1b2742'; ctx.beginPath(); ctx.moveTo(cx - R * 0.5, cy + R * 0.9); ctx.lineTo(cx + R * 0.5, cy + R * 0.9); ctx.lineTo(cx + R * 0.7, h - 4); ctx.lineTo(cx - R * 0.7, h - 4); ctx.closePath(); ctx.fill();
  // tube to the top tray
  const ty = Math.max(br * 2.4, cy - R * 1.75);
  ctx.strokeStyle = '#9fb0cf55'; ctx.lineWidth = br * 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, ty); ctx.stroke();
  ctx.strokeStyle = '#0b1220'; ctx.lineWidth = br * 2.2; ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, ty); ctx.stroke();
  // drum
  const gl = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R); gl.addColorStop(0, '#ffffff22'); gl.addColorStop(1, '#ffffff08');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.fill();
  LOT.balls.forEach(b => lotBall(ctx, X(b.x), Y(b.y), br, b.n));
  ctx.strokeStyle = '#cfd8ea'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.stroke();
  ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 1.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, R, R * k / 4, 0, 0, 6.3); ctx.stroke(); }
  if (!LOT.started) { ctx.fillStyle = '#9fb0cf'; ctx.font = '700 12px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText('PRESS DRAW BALL OR AUTO DRAW TO START', cx, cy + R + 18); ctx.textAlign = 'left'; }
  if (LOT.phase === 'mix') { ctx.fillStyle = '#9fb0cf'; ctx.font = '700 12px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText('MIXING…', cx, cy + R + 18); ctx.textAlign = 'left'; }
  // the drawn ball
  if (LOT.ball && (LOT.phase === 'lift' || LOT.phase === 'show')) {
    const b = LOT.ball; let x, y, s = 1;
    if (LOT.phase === 'lift') { const f = Math.min(1, LOT.t / 0.9), e = f < 0.4 ? f / 0.4 : 1; const hx = X(b.sx) + (cx - X(b.sx)) * e, hy = Y(b.sy) + (cy - R - Y(b.sy)) * e; x = hx; y = f < 0.4 ? hy : (cy - R) + (ty - (cy - R)) * ((f - 0.4) / 0.6); }
    else { x = cx; y = ty; s = 1 + Math.min(1, LOT.t / 0.25) * 0.9; }
    lotBall(ctx, x, y, br * s, b.n);
    if (LOT.phase === 'show') { const e = lotNextDriver(); ctx.fillStyle = '#fff'; ctx.font = '800 13px ui-monospace,monospace'; ctx.textAlign = 'left'; const g = qgGroupOfNum(b.n, WK.entries.length);
      if (e) { ctx.fillText(`${e.d.code} → BALL ${b.n}`, cx + br * 2.4, ty - 4); ctx.fillStyle = LOT_COL[g]; ctx.fillText(`GROUP ${QG_NAMES[g]}`, cx + br * 2.4, ty + 13); } }
  }
}
function lotStart() {
  if (LOT.phase || !lotNextDriver() || !LOT.balls.length) return;
  LOT.started = true; LOT.phase = 'mix'; LOT.t = 0; const bt = document.getElementById('lotdrawb'); if (bt) bt.disabled = true;
}
function lotCommit() {
  const QS = WK.Q, D = QS.draw, e = lotNextDriver(), b = LOT.ball;
  if (e && b) D.picks.push({ e, n: b.n });
  LOT.ball = null; LOT.phase = null; LOT.t = 0; LOT.autoT = performance.now() + 450;
  const bd = document.getElementById('qglotb'); if (bd) bd.innerHTML = lotBoard();
  const bt = document.getElementById('lotdrawb'); if (bt) bt.disabled = false;
  if (!lotNextDriver()) { qgFinishDraw(QS); LOT.auto = false; autosave(); setTimeout(() => { render(); }, 1200); }
}
Object.assign(A, {
  lotdraw() { lotStart(); },
  lotauto(el) { LOT.auto = !LOT.auto; if (LOT.auto) LOT.started = true; LOT.autoT = 0; el.classList.toggle('on', LOT.auto); el.textContent = LOT.auto ? '⏸ Stop auto draw' : '▶ Auto draw'; },
  lotall() { LOT.phase = null; LOT.ball = null; LOT.auto = false; qgFinishDraw(WK.Q); autosave(); render(); },
});
const _lot_render = render;
render = function () { const r = _lot_render.apply(this, arguments); if (document.getElementById('qglot') && !LOT.raf) { LOT.last = 0; LOT.raf = requestAnimationFrame(lotFrame); } return r; };
