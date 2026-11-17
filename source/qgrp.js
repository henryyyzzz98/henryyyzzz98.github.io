// ===================== Group lottery qualifying =====================
// Before qualifying, a number lottery splits the field into three equal groups (A, B, C).
// The groups run one after another (like Q1, Q2, Q3), so they never meet on track. Within a group the cars are released
// in lottery order, spaced out so nobody catches the car ahead. Each driver gets an out lap, 3 timed laps and an in lap;
// their best lap counts. Grid: the fastest of each group fill P1–P3 (sorted by time), the second fastest of each group
// P4–P6, and so on — so the slowest of each group make up the back of the grid.
function qGroups() { return !!(G && WK && WK.stage === 'quali' && G.rules && G.rules.quali === 'groups'); }
const QG_NAMES = ['A', 'B', 'C'];
function qgEnsure() {
  if (!qGroups()) return null;
  const QS = WK.Q;
  if (!QS.lot) {
    const N = WK.entries.length, nums = shuffle(WK.entries.map((_, i) => i + 1));
    const lot = WK.entries.map((e, i) => ({ e, n: nums[i] })).sort((a, b) => a.n - b.n);
    const base = Math.floor(N / 3), extra = N % 3, sizes = [0, 1, 2].map(k => base + (k < extra ? 1 : 0));
    let k = 0; QS.groups = sizes.map(s => { const g = lot.slice(k, k + s); k += s; return g; });
    QS.groups.forEach((g, gi) => g.forEach(x => { x.g = gi; }));
    QS.lot = lot; QS.gres = [];
  }
  if (QS.stage <= 3) QS.alive = QS.groups[QS.stage - 1].map(x => x.e);
  return QS;
}
if (typeof shuffle !== 'function') window.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const _qg_qCut = qCut;
qCut = function (n) { return qGroups() ? 0 : _qg_qCut.apply(this, arguments); };
const _qg_qualiInfo = qualiInfo;
qualiInfo = function (key) {
  if (key === 'Q') qgEnsure();
  const I = _qg_qualiInfo.apply(this, arguments);
  if (key === 'Q' && qGroups()) {
    const st = Math.min(I.stage, 3);
    Object.assign(I, { groups: true, single: false, cut: 0, runs: 3, label: 'Group ' + QG_NAMES[st - 1], n: (WK.Q.groups[st - 1] || []).length, dur: 600 });
  }
  return I;
};

const _qg_QualiLive = QualiLive;
QualiLive = class extends _qg_QualiLive {
  constructor(G0, wk, list, opts) {
    const grp = qGroups() && !opts.elim;
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
    const QS = qgEnsure(), a = html.indexOf('<div class="dk-fpbox">'), b = html.indexOf('<div class="dk-fpfoot">'); if (a < 0 || b < 0) return html;
    let out = html.slice(0, a) + qgDeskBox() + '\n  ' + html.slice(b);
    const t = esc(WK.track.short);
    if (QS.stage > 3) out = out.replace(/Qualifying Results - [^<]*/, `Qualifying Results - ${t}`);
    else if (QS.gres.length) out = out.replace(/Q\d Results - [^<]*/, `Group ${QG_NAMES[QS.gres.length - 1]} Results - ${t}`);
    return out.replace(/ · \d+ MIN · /, ' · ');
  };
}
