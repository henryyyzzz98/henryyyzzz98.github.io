// ===================== 2016 elimination qualifying =====================
// Q1 16 min, Q2 15 min, Q3 14 min. From 7:00 / 6:00 / 5:00 in, the slowest driver is knocked out every 90 seconds
// (a lap in progress doesn't count) until 15 / 8 remain, then Q3 runs down to the last car.
function qElim() {
  if (!G || !WK || WK.stage === 'squali') return false;
  if (G.rules && G.rules.quali === 'elim') return true;
  // real 2016 season, "real format of each season": used at the first two rounds (Australia, Bahrain)
  const era = !G.regs || G.regs.quali === 'era', H = HIST.years[2016];
  return !!(G.timeline && G.year === 2016 && era && G.rules && G.rules.quali === 'knockout' && H && WK.track && [H.cal[0][0], H.cal[1][0]].includes(WK.track.id));
}
const _q16_qCut = qCut;
qCut = function (n) { if (!qElim() || n < 12) return _q16_qCut(n); const k1 = Math.ceil((n - 8) / 2); return WK.Q && WK.Q.stage >= 2 ? n - 8 - k1 : k1; }; // Q3 always has 8 cars
const _q16_qualiInfo = qualiInfo;
qualiInfo = function (key) {
  const I = _q16_qualiInfo.apply(this, arguments);
  if (key === 'Q' && qElim()) {
    const st = Math.min(I.stage, 3);
    I.elim = true; I.single = false; I.dur = [960, 900, 840][st - 1]; I.label = 'Q' + st;
    I.cut = st >= 3 ? 0 : qCut(WK.entries.length); I.elimN = st >= 3 ? Math.max(1, I.n - 1) : I.cut; I.runs = 3;
  }
  return I;
};
const Q16_WIN = [[0, 0.12], [0.28, 0.48], [0.56, 0.84]];
const _q16_QualiLive = QualiLive;
QualiLive = class extends _q16_QualiLive {
  constructor(G0, wk, list, opts) {
    const lap = qLapElim() && !opts.elim;
    if (lap) opts = Object.assign({}, opts, { dur: 1e6, label: 'Qualifying', cut: 0, runs: 1, elim: Math.max(1, list.length - 1), windows: [[0, 1e-6]] });
    else if (qElim() && !opts.elim && WK.stage !== 'squali') { const I = qualiInfo('Q'); opts = Object.assign({}, opts, { dur: I.dur, label: I.label, cut: I.cut, runs: 3, elim: I.elimN, windows: Q16_WIN }); }
    super(G0, wk, list, opts);
    if (lap) this.lapSetup();
  }
  // ---- pole-lap elimination: one open-ended session; the slowest car goes every <current pole lap time> ----
  lapSetup() {
    this.lapMode = true; this.elapsed = true; this.armed = false; this.lastE = null; this.log = []; this.events = [];
    const base = this.base, horizon = (this.cars.length + 6) * base * 1.1 + 900;
    this.cars.forEach(c => {
      const runs = []; let t = rnd(0, base * 0.8);
      while (t < horizon) {
        const n = pick([2, 3, 3, 4]);
        for (let k = 0; k < n; k++) {
          const q = qualiLap(this.G, c.e, this.track, this.wet, c.risk); const crash = q.crash && Math.random() < 0.35;
          const evo = Math.min(0.6, t / 600 * 0.15), fade = k * 0.14;
          const OL = k === 0 ? base * 1.4 * rnd(0.97, 1.05) : base * 1.22 * rnd(0.98, 1.04), IL = k === n - 1 ? base * 1.45 * rnd(0.97, 1.05) : 0.5;
          const fly = crash ? base * rnd(1, 1.02) : (q.crash ? q.t || base : q.t) - evo + fade;
          runs.push({ start: t, OL, IL, fly, crash, crashAt: rnd(0.2, 0.9), done: false, aborted: false });
          t += OL + fly + IL;
        }
        t += rnd(40, 130); // in the garage: fresh tyres
      }
      c.runs = runs;
    });
    this.msg(`🟢 Qualifying is under way — no time limit: once everyone has a time, the slowest driver is out every pole-lap time`, true);
  }
  clock() { return this.lapMode ? this.t : super.clock(); }
  nextElim() { if (!this.lapMode) return super.nextElim(); return this.armed && this.elim.left > 0 ? Math.max(0, this.elim.next - this.t) : null; }
  crash(c, r) { super.crash(c, r); if (this.lapMode && this.lastE != null) this.lastE += 45; }
  step(dt) {
    if (!this.lapMode) return super.step(dt);
    if (this.done) return;
    if (!this.armed) {
      const alive = this.cars.filter(c => !c.out);
      if (alive.length && (alive.every(c => c.best != null) || this.t > this.base * 8)) {
        this.armed = true; this.lastE = this.t;
        this.msg(`⏱ Every car has a time — first elimination in ${fmtTime(this.best ? this.best.t : this.base)} (the pole lap)`, true);
      }
    }
    this.elim.gap = this.best ? this.best.t : this.base;
    this.elim.next = this.armed ? this.lastE + this.elim.gap : Infinity;
    const k = this.elim.order.length; super.step(dt);
    if (this.elim.order.length > k) this.lastE = this.t;
  }
};
function qLapElim() { return !!(G && WK && WK.stage !== 'squali' && G.rules && G.rules.quali === 'lapelim'); }
const _q16_qualiInfo2 = qualiInfo;
qualiInfo = function (key) {
  const I = _q16_qualiInfo2.apply(this, arguments);
  if (key === 'Q' && qLapElim()) Object.assign(I, { single: true, lapElim: true, label: 'Qualifying', cut: 0, dur: 1800, runs: 1 });
  return I;
};
const _q16_applyQualiStage = applyQualiStage;
applyQualiStage = function (QS, res) {
  if (!qLapElim()) return _q16_applyQualiStage.apply(this, arguments);
  QS.rounds.push({ stage: QS.stage, res }); QS.top = res; QS.stage = 4; WK.grid = res.map(r => r.e);
};
// quick-simulated sessions run the same elimination clock
const _q16_runQualiSession = runQualiSession;
runQualiSession = function (G0, wk, list, stage, risks) {
  if (!qElim() && !qLapElim()) return _q16_runQualiSession.apply(this, arguments);
  const Q = new QualiLive(G0, wk, list, { risks: risks || {} }); let n = 0;
  while (!Q.done && n++ < 40000) Q.step(0.5);
  return Q.result;
};
// countdown to the next elimination on the live screens
const _q16_updQ = updateQualiUI;
updateQualiUI = function () {
  const r = _q16_updQ.apply(this, arguments);
  try {
    const Q = curQS().live; if (!Q || !Q.elim) return r;
    const nx = Q.nextElim(), left = Q.cars.filter(c => !c.elim).length;
    // compact so the header keeps its size: "Q1 · 9:12 · OUT IN 0:45 · 18 LEFT"
    let txt = nx == null ? '' : `OUT IN ${fmtClock(nx)}`;
    if (Q.lapMode) txt = Q.armed ? `OUT IN ${fmtClock(nx)}` : 'SETTING TIMES';
    const ds = document.getElementById('dksess');
    if (ds) { const h = `${esc(Q.label === 'Qualifying' ? 'Q' : Q.label)} · ${fmtClock(Q.clock())} · ${left} left${txt ? ` · <span class="q16">${txt}</span>` : ''}${Q.lapMode && Q.armed ? ` · every ${fmtTime(Q.elim.gap)}` : ''}`; if (ds._q16 !== h || ds._q16src !== ds._h) { ds.innerHTML = h; ds._q16 = h; ds._q16src = ds._h; } ds.title = ds.textContent; }
    const hud = document.getElementById('hud'); if (hud && nx != null) hud.insertAdjacentHTML('beforeend', `<span class="chip">⛔ Next out ${fmtClock(nx)} · ${left} left</span>`);
  } catch (e) { }
  return r;
};
