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
    let lapSt = 3;
    if (lap) { // Q1 and Q2 knock out the usual knockout number; Q3 runs down to the final three and a shootout
      lapSt = Math.min(3, (WK.Q && WK.Q.stage) || 1);
      const k = lapSt < 3 ? Math.max(1, Math.min(list.length - 1, qCut(WK.entries.length))) : Math.max(1, list.length - 1);
      opts = Object.assign({}, opts, { dur: 1e6, label: 'Q' + lapSt, cut: lapSt < 3 ? k : 0, runs: 1, elim: k, windows: [[0, 1e-6]] });
    }
    else if (qElim() && !opts.elim && WK.stage !== 'squali') { const I = qualiInfo('Q'); opts = Object.assign({}, opts, { dur: I.dur, label: I.label, cut: I.cut, runs: 3, elim: I.elimN, windows: Q16_WIN }); }
    super(G0, wk, list, opts);
    if (lap) { this.lapStage = lapSt; this.lapSetup(); }
  }
  // ---- pole-lap elimination: one open-ended session; the slowest car goes every <current pole lap time> ----
  lapSetup() {
    this.lapMode = true; this.elapsed = true; this.armed = false; this.lastE = null; this.log = []; this.events = [];
    this.pend = null; this.so = null; this.sets = 6;
    const QS = WK.Q; QS.lapSets = QS.lapSets || {}; // tyre sets carry over from Q1 to Q2 to Q3
    this.cars.forEach(c => { c.runs = []; c.sets = Math.max(1, QS.lapSets[c.d.id] != null ? QS.lapSets[c.d.id] : this.sets); c.stintEnd = 0; c.usedLaps = 0; this.planStint(c, rnd(0, this.base * 0.8)); });
    const st = this.lapStage, n = this.cars.length;
    this.msg(st < 3
      ? `🟢 Q${st} is under way — no time limit. Once everyone has a time, the slowest driver is out every 2 × pole lap until ${n - this.elim.left} remain for Q${st + 1}. Laps already started still count. Times reset for the next session.`
      : `🟢 Q3 is under way — no time limit. The slowest driver is out every 2 × pole lap. Final three: one-lap shootout for pole.`, true);
  }
  // one stint: out lap, push laps with cool-down laps between, in lap
  planStint(c, t0) {
    const base = this.base, fresh = c.sets > 0; if (fresh) { c.sets--; c.usedLaps = 0; }
    const n = fresh ? pick([2, 2, 3]) : pick([2, 3]); let t = t0;
    for (let k = 0; k < n; k++) {
      const q = qualiLap(this.G, c.e, this.track, this.wet, c.risk); const crash = q.crash && Math.random() < 0.35;
      const evo = Math.min(0.6, t / 600 * 0.15), fade = (c.usedLaps + k) * 0.14 + (fresh ? 0 : 0.45);
      const OL = k === 0 ? base * 1.4 * rnd(0.97, 1.05) : base * 1.22 * rnd(0.98, 1.04), IL = k === n - 1 ? base * 1.45 * rnd(0.97, 1.05) : 0.5;
      const fly = crash ? base * rnd(1, 1.02) : (q.crash ? q.t || base : q.t) - evo + fade;
      c.runs.push({ start: t, OL, IL, fly, crash, crashAt: rnd(0.2, 0.9), done: false, aborted: false });
      t += OL + fly + IL;
    }
    c.usedLaps += n; c.stintEnd = t;
    if (!fresh && (c.player || c.fav)) this.msg(`🛞 ${c.d.code} is out on used tyres — no fresh sets left`, false);
    else if (fresh && c.sets === 0 && (c.player || c.fav)) this.msg(`🛞 ${c.d.code} fits the last fresh set`, false);
    return t;
  }
  aliveCars() { return this.cars.filter(c => !c.elim); }
  idle(c) { return !c.out && c.runs.every(r => r.done || r.start > this.t + 1e6); }
  // drivers who are safe wait in the garage (saving tyres); those near the drop zone go out
  schedule() {
    const alive = this.order().filter(c => !c.elim), N = alive.length, toNext = this.armed ? (this.elim.next - this.t) : 1e9;
    alive.forEach((c, rank) => {
      if (!this.idle(c) || this.t < c.stintEnd + 35) return;
      const danger = c.best == null || rank >= N - 3, near = rank >= N - 6 && toNext < this.base * 3.2;
      const go = danger || near || (c.sets > 0 && Math.random() < 0.0015);
      if (go && !(c.sets === 0 && !danger)) this.planStint(c, this.t + rnd(3, 15));
    });
  }
  order() {
    if (!this.lapMode || !this.so) return super.order();
    const out = this.elim.order.slice().reverse(), A = this.so.cars;
    const done = A.filter(c => c.so != null).sort((a, b) => a.so - b.so), rest = A.filter(c => c.so == null).sort((a, b) => (a.best ?? 1e9) - (b.best ?? 1e9));
    return this.so.finished ? done.concat(A.filter(c => c.so == null)).concat(out) : done.concat(rest).concat(out);
  }
  clock() { return this.lapMode ? this.t : super.clock(); }
  nextElim() { if (!this.lapMode) return super.nextElim(); return this.armed && !this.so && this.elim.left > 0 && !this.pend ? Math.max(0, this.lastE + this.elim.gap - this.t) : null; }
  crash(c, r) { super.crash(c, r); if (this.lapMode && this.lastE != null) this.lastE += 45; }
  finish() { if (this.lapMode && WK.Q) { WK.Q.lapSets = WK.Q.lapSets || {}; this.cars.forEach(c => { WK.Q.lapSets[c.d.id] = c.sets; }); } return super.finish(); }
  shootout() {
    const S = this.so;
    if (S.phase === 'wait') { // everyone back in the garage first
      if (!S.cars.every(c => c.out || this.idle(c))) return;
      S.queue = S.cars.slice().sort((a, b) => (b.best ?? 1e9) - (a.best ?? 1e9)); S.phase = 'run';
      this.msg(`🎯 SHOOTOUT for pole — one flying lap each, slowest first: ${S.queue.map(c => c.d.code).join(', ')}`, true);
      // staggered: each flying lap starts as the previous one ends, so there is only ever one car on a flying lap
      let t = this.t + 5, prevEnd = 0;
      S.queue.forEach(c => {
        if (c.out) { c.soDone = true; c.so = null; return; }
        const OL = this.base * 1.4 * rnd(0.98, 1.02); const start = Math.max(t, prevEnd + 2 - OL);
        this.planStintOne(c, start, OL); c.soRun = c.runs[c.runs.length - 1]; prevEnd = start + OL + c.soRun.fly; t = start + 1;
      });
    }
    if (S.phase !== 'run') return;
    S.queue.forEach(c => {
      if (c.soDone || !c.soRun) return;
      if (c.soRun.timed || c.out || c.soRun.aborted) {
        c.soDone = true; c.so = c.soRun.crash || c.soRun.aborted || !c.soRun.timed ? null : c.soRun.fly;
        this.msg(c.so != null ? `🎯 ${c.d.name}: ${fmtTime(c.so)}` : `🎯 ${c.d.name}: no time`, true);
      }
    });
    S.cur = S.queue.find(c => !c.soDone) || null;
    if (S.queue.every(c => c.soDone)) {
      S.finished = true; const p = this.order()[0];
      this.msg(`🏆 POLE POSITION: ${p.d.name}${p.so != null ? ' — ' + fmtTime(p.so) : ''}`, true);
      this.finish();
      if (this.result) this.result.forEach(r => { const c = S.cars.find(x => x.e === r.e); if (c) r.t = c.so; });
    }
  }
  planStintOne(c, t, OL) { // a single shootout lap
    const base = this.base, fresh = c.sets > 0; if (fresh) c.sets--;
    const q = qualiLap(this.G, c.e, this.track, this.wet, c.risk); const crash = q.crash && Math.random() < 0.3;
    const fly = crash ? base : (q.crash ? q.t || base : q.t) - Math.min(0.6, t / 600 * 0.15) + (fresh ? 0 : 0.45);
    c.runs.push({ start: t, OL: OL || base * 1.4, IL: base * 1.45, fly, crash, crashAt: rnd(0.2, 0.9), done: false, aborted: false });
  }
  step(dt) {
    if (!this.lapMode) return super.step(dt);
    if (this.done) return;
    const alive = this.aliveCars();
    if (!this.armed) {
      const a2 = alive.filter(c => !c.out);
      if (a2.length && (a2.every(c => c.best != null) || this.t > this.base * 8)) {
        this.armed = true; this.lastE = this.t;
        this.msg(`⏱ Every car has a time — first elimination in ${fmtTime(2 * (this.best ? this.best.t : this.base))} (2 × the pole lap)`, true);
      }
    }
    this.elim.gap = 2 * (this.best ? this.best.t : this.base);
    if (this.so) { this.elim.next = Infinity; super.step(dt); if (!this.done) this.shootout(); return; }
    if (!this.done && this.t > 1) this.schedule();
    // elimination due: laps already under way may finish first
    if (this.armed && !this.pend && this.t >= this.lastE + this.elim.gap) {
      this.pend = { due: this.lastE + this.elim.gap, wait: new Set(alive.filter(c => !c.out && c.phase === 'flying')) };
      if (this.pend.wait.size) this.msg(`⏱ Elimination due — waiting for ${this.pend.wait.size} lap${this.pend.wait.size > 1 ? 's' : ''} in progress (${[...this.pend.wait].map(c => c.d.code).join(', ')})`, false);
    }
    this.elim.next = Infinity;
    if (this.pend) {
      for (const c of [...this.pend.wait]) if (c.out || c.phase !== 'flying') this.pend.wait.delete(c);
      if (!this.pend.wait.size) { this.elim.next = this.t + dt / 2; this.lastE = this.pend.due; this.pend = null; }
    }
    super.step(dt);
    const left = this.aliveCars();
    if (!this.done && this.lapStage === 3 && left.length <= 3 && !this.so) {
      this.so = { phase: 'wait', cars: left, cur: null, queue: [] };
      left.forEach(c => c.runs.forEach(r => { if (r.start > this.t) r.done = true; })); // cancel planned runs
      this.msg(`🎯 Three drivers left — eliminations stop. They return to the pits for a one-lap shootout.`, true);
    }
  }
};
function qLapElim() { return !!(G && WK && WK.stage !== 'squali' && G.rules && G.rules.quali === 'lapelim'); }
const _q16_qualiInfo2 = qualiInfo;
qualiInfo = function (key) {
  const I = _q16_qualiInfo2.apply(this, arguments);
  if (key === 'Q' && qLapElim()) Object.assign(I, { single: false, lapElim: true, label: 'Q' + Math.min(I.stage, 3), dur: 1800, runs: 1 });
  return I;
};
const _q16_applyQualiStage = applyQualiStage;
applyQualiStage = function (QS, res) {
  return _q16_applyQualiStage.apply(this, arguments); // pole-lap elimination now runs as Q1, Q2, Q3 like a knockout
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
    if (Q.lapMode) txt = Q.so ? (Q.so.cur && !Q.so.finished ? `SHOOTOUT: ${Q.so.cur.d.code}` : 'SHOOTOUT') : Q.pend ? 'ELIMINATION DUE: LAPS FINISHING' : Q.armed ? `OUT IN ${fmtClock(nx)}` : 'SETTING TIMES';
    const ds = document.getElementById('dksess');
    if (ds) { const h = `${esc(Q.label)} · ${fmtClock(Q.clock())} · ${left} left${txt ? ` · <span class="q16">${txt}</span>` : ''}${Q.lapMode && Q.armed && !Q.so ? ` · every ${fmtTime(Q.elim.gap)}` : ''}`; if (ds._q16 !== h || ds._q16src !== ds._h) { ds.innerHTML = h; ds._q16 = h; ds._q16src = ds._h; } ds.title = ds.textContent; }
    const hud = document.getElementById('hud'); if (hud && nx != null) hud.insertAdjacentHTML('beforeend', `<span class="chip">⛔ Next out ${fmtClock(nx)} · ${left} left</span>`);
  } catch (e) { }
  return r;
};
