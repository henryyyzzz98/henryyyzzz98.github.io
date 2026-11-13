// ===== ENGINE: helpers, geometry, simulation, season logic =====
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const fmtTime = s => { if (s == null || !isFinite(s)) return '—'; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s - h * 3600 - m * 60; const p2 = x => (x < 10 ? '0' : '') + x; return h ? h + ':' + p2(m) + ':' + (r < 10 ? '0' : '') + r.toFixed(3) : (m ? m + ':' + (r < 10 ? '0' : '') : '') + r.toFixed(3); };
const fmtM = m => (m < 0 ? '-' : '') + '$' + Math.abs(m).toFixed(1) + 'M';

// expansion hooks (filled in by expansion.js)
let XPH = {};
const xh = (name, ...args) => (XPH[name] ? XPH[name](...args) : undefined);

// ---------- Track geometry ----------
const GEO = {};
function trackGeometry(t) {
  const gkey = t.geoKey || t.id;
  if (GEO[gkey]) return GEO[gkey];
  let pts = t.pts;
  if (!pts) { // procedural star-shaped circuit, deterministic per track
    const r = seeded(t.id + t.name);
    const n = 13 + Math.floor(r() * 6);
    const harm = [2, 3, 4, 5].map(k => ({ k, a: (k === 2 ? 0.18 : 0.12) * r(), p: r() * 6.283 }));
    const sx = 0.75 + r() * 0.6;
    pts = [];
    for (let i = 0; i < n; i++) {
      const th = i / n * 6.283 + (r() - 0.5) * 0.25;
      let rad = 0.62; harm.forEach(h => rad += h.a * Math.sin(h.k * th + h.p));
      if (r() < 0.25) rad *= 0.82; // occasional hairpin pinch
      pts.push([50 + Math.cos(th) * rad * 45 * sx, 50 + Math.sin(th) * rad * 45]);
    }
  }
  // closed Catmull-Rom
  const out = [], N = pts.length, seg = 40;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    for (let j = 0; j < seg; j++) {
      const s = j / seg, s2 = s * s, s3 = s2 * s;
      out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)]);
    }
  }
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  out.forEach(([x, y]) => { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); });
  const w = maxx - minx, h = maxy - miny, sc = 1 / Math.max(w, h);
  const P = out.map(([x, y]) => [(x - minx) * sc + (1 - w * sc) / 2, (y - miny) * sc + (1 - h * sc) / 2]);
  const cum = [0];
  for (let i = 1; i <= P.length; i++) { const a = P[i - 1], b = P[i % P.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const g = { P, cum, len: cum[cum.length - 1] };
  GEO[gkey] = g; return g;
}
function pointAt(g, frac) {
  frac = ((frac % 1) + 1) % 1;
  const target = frac * g.len; let lo = 0, hi = g.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (g.cum[m] <= target) lo = m; else hi = m; }
  const a = g.P[lo % g.P.length], b = g.P[(lo + 1) % g.P.length];
  const f = (target - g.cum[lo]) / ((g.cum[lo + 1] - g.cum[lo]) || 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
}

// ---------- Ratings ----------
function overall(d) { return d.pace * 0.45 + d.craft * 0.2 + d.cons * 0.15 + d.wet * 0.1 + d.tyre * 0.1; }
function teamPower(G, team) { return G.engines[team.engine].power; }
function teamRel(G, team) { return (team.rel * 0.6 + G.engines[team.engine].rel * 0.4); }
function carScore(G, team, track) {
  const pw = teamPower(G, team);
  return (team.aero * track.df + pw * track.pw + team.chassis * 0.6) / (track.df + track.pw + 0.6);
}

// ---------- Weather ----------
function makeWeather(track, enabled) {
  // plan: list of {lap, target}; start wetness
  const plan = []; let start = 0;
  if (enabled && Math.random() < track.rain) {
    const kind = Math.random();
    if (kind < 0.3) { start = rnd(0.35, 0.8); plan.push({ lap: rint(Math.floor(track.laps * 0.2), Math.floor(track.laps * 0.6)), target: 0 }); }
    else if (kind < 0.75) { const a = rint(3, Math.floor(track.laps * 0.7)); plan.push({ lap: a, target: rnd(0.3, 0.9) }); if (Math.random() < 0.6) plan.push({ lap: a + rint(6, 20), target: 0 }); }
    else { start = rnd(0.2, 0.5); }
  }
  // quali weather
  const quali = enabled && Math.random() < track.rain * 0.8 ? rnd(0.3, 0.8) : 0;
  return { start, plan, quali };
}
function forecastText(w, track) {
  if (!w.start && !w.plan.length) return track.rain > 0.25 ? '☁️ Dry, clouds about (small chance of a shower)' : '☀️ Dry all race';
  const parts = [];
  if (w.start > 0.6) parts.push('🌧️ Heavy rain at the start'); else if (w.start > 0) parts.push('🌦️ Damp track at the start');
  w.plan.forEach(p => parts.push(p.target > 0.05 ? `🌧️ Rain expected around lap ${p.lap + rint(-3, 3)}` : `🌤️ Drying from around lap ${p.lap + rint(-3, 3)}`));
  return parts.join(' · ');
}

// ---------- Lap model ----------
function lapTimeFor(G, c, track, o) {
  // o: {lap, wet, quali, sc}
  const d = c.d, team = c.t;
  const cs = carScore(G, team, track);
  let lt = track.base * (1 + (100 - cs) * 0.0011 + (100 - d.pace) * 0.0006);
  const ty = TYRES[c.tyre];
  const w = o.wet || 0;
  // compound / weather interaction
  if (c.tyre === 'I') lt += 2.6 + Math.max(0, w - 0.7) * 14 + Math.max(0, 0.22 - w) * 16;
  else if (c.tyre === 'W') lt += 5.0 + Math.max(0, 0.6 - w) * 16;
  else lt += ty.off + w * 26;
  lt += w * (100 - d.wet) * 0.035;
  lt += 2.8 * c.wear * c.wear + Math.max(0, c.wear - 0.8) * 30;
  if (!o.quali) lt += 2.0 * (1 - o.lap / (o.laps || track.laps)); else lt -= 0.4;
  lt += c.mode === 'push' ? -0.35 : c.mode === 'save' ? 0.45 : 0;
  lt += (1 - (c.setup || 0.4)) * 0.5;
  if (d.morale != null) lt -= (d.morale - 70) * 0.005;
  lt += gauss() * (0.12 + (100 - d.cons) * 0.012);
  return lt;
}

// ---------- Practice ----------
const PROGRAMS = {
  setup: { name: 'Setup work', desc: '+ setup confidence (race & quali pace)' },
  long: { name: 'Long runs', desc: '+ tyre knowledge (less tyre wear)' },
  quali: { name: 'Quali sims', desc: '+ one-lap preparation' }
};
function runPractice(G, wk, session, programs) {
  const track = wk.track; const rows = [];
  wk.entries.forEach(e => {
    const prog = programs[e.d.id] || pick(['setup', 'long', 'quali']);
    const gain = rnd(0.10, 0.2) * (0.8 + e.d.craft / 400);
    if (prog === 'setup') e.setup = clamp(e.setup + gain, 0, 1);
    if (prog === 'long') e.tyreKnow = clamp(e.tyreKnow + gain * 0.9, 0, 1);
    if (prog === 'quali') e.qualiPrep = clamp(e.qualiPrep + gain, 0, 1);
    const c = { d: e.d, t: e.t, tyre: pick(['S', 'M', 'S']), wear: 0.05, mode: 'std', setup: e.setup };
    const wet = wk.weather.quali * (session === 2 ? 1 : rnd(0, 1));
    if (wet > 0.3) c.tyre = wet > 0.65 ? 'W' : 'I';
    let t = lapTimeFor(G, c, track, { lap: track.laps * 0.8, wet, quali: false }) - rnd(0.3, 0.9);
    rows.push({ e, t, prog, laps: rint(18, 34) });
  });
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

// ---------- Qualifying ----------
function qualiLap(G, e, track, wet, risk) {
  const c = { d: e.d, t: e.t, tyre: wet > 0.65 ? 'W' : wet > 0.25 ? 'I' : 'S', wear: 0, mode: 'push', setup: e.setup };
  let t = lapTimeFor(G, c, track, { lap: 0, wet, quali: true }) - e.qualiPrep * 0.25 + (xh('qualiSetPenalty', e, wet) || 0);
  const sigma = 0.15 + (100 - e.d.cons) * 0.01;
  if (risk === 'safe') t += 0.12 + Math.abs(gauss()) * sigma * 0.4;
  else if (risk === 'all') t += -0.15 + gauss() * sigma * 1.4;
  else t += gauss() * sigma * 0.8;
  const crashP = (risk === 'all' ? 0.035 : risk === 'safe' ? 0.002 : 0.01) * (1 + wet * 3);
  if (Math.random() < crashP) return { t: null, crash: true };
  return { t, crash: false };
}
function runQualiSession(G, wk, list, stage, risks) {
  const track = wk.track, wet = wk.weather.quali;
  const res = list.map(e => {
    const risk = risks[e.d.id] || (G.player === e.t.id ? 'normal' : pick(['normal', 'normal', 'safe', 'all']));
    const a = qualiLap(G, e, track, wet, risk), b = qualiLap(G, e, track, wet, risk);
    let t = null, crash = false;
    if (a.crash) { crash = true; } else { t = a.t; if (!b.crash) t = Math.min(t, b.t); }
    return { e, t, crash, risk };
  });
  res.sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
  return res;
}

// ---------- Race ----------
class Race {
  constructor(G, wk, grid, opts = {}) {
    this.G = G; this.wk = wk; this.track = wk.track; this.L = wk.track.km * 1000; this.sprint = !!opts.sprint;
    const W = opts.weather || wk.weather;
    this.laps = opts.laps || wk.track.laps; this.t = 0; this.wet = W.start; this.plan = W.plan.slice();
    this.wetTarget = this.wet; this.sc = 0; this.scLapsLeft = 0; this.vsc = 0; this.flag = 'green';
    this.chequered = false; this.done = false; this.log = []; this.events = [];
    this.rules = G.rules || { twoCompound: true, sc: true, vsc: true, wearMul: 1 };
    this.leaderLap = 0; this.redFlag = false; this.weatherOn = G.weatherOn !== false; this.incidentsOn = G.incidentsOn !== false;
    this.cars = grid.map((e, i) => {
      const wet = this.wet;
      let tyre = wet > 0.6 ? 'W' : wet > 0.22 ? 'I' : (i < 10 ? 'M' : pick(['M', 'H', 'M', 'S']));
      if (e.startTyre && wet <= 0.22) tyre = e.startTyre;
      return {
        e, d: e.d, t: e.t, grid: i + 1, dist: -i * 14 - 5, laps: 0, tyre, wear: 0, age: 0, mode: 'std',
        auto: e.t.id !== G.player || e.auto !== false, fav: G.follow === e.d.id, pitReq: null, pitT: 0, out: null, finished: false, finishT: 0,
        cross: [0], lastLap: null, best: null, curLT: 90, used: new Set([tyre]), setup: e.setup, tyreKnow: e.tyreKnow,
        stops: 0, penalty: 0, outLap: false, spin: 0, dnfLap: 0, planStop: rnd(0.62, 0.78), player: !!G.player && e.t.id === G.player
      };
    });
    xh('raceInit', this);
    this.cars.forEach(c => c.curLT = this.lapTime(c, 0) + 2.5 + c.grid * 0.03);
    this.msg(`Lights out${this.sprint ? ' for the Sprint' : ''} at ${this.track.name}! ${this.wet > 0.2 ? 'Wet start.' : ''}`);
  }
  msg(s, imp) { this.log.unshift({ t: this.t, lap: this.leaderLap, s, imp }); if (this.log.length > 60) this.log.pop(); if (imp) this.events.push(s); }
  lapTime(c, lap) {
    let lt = lapTimeFor(this.G, c, this.track, { lap, wet: this.wet, laps: this.laps });
    if (c.outLap) lt += 1.2;
    lt += xh('lapDelta', this, c) || 0;
    return lt;
  }
  wearRate(c) {
    let r = TYRES[c.tyre].wear * (0.5 + this.track.wear) * (1.35 - c.d.tyre / 150) * (1 - (c.tyreKnow || 0) * 0.12);
    r *= c.mode === 'push' ? 1.4 : c.mode === 'save' ? 0.7 : 1;
    r *= this.rules.wearMul || 1;
    if ((c.tyre === 'I' || c.tyre === 'W') && this.wet < 0.2) r *= 3;
    if ((c.tyre === 'S' || c.tyre === 'M' || c.tyre === 'H')) r *= (1 - this.wet * 0.5);
    return r;
  }
  order() {
    return this.cars.slice().sort((a, b) => {
      if (!!a.out !== !!b.out) return a.out ? 1 : -1;
      if (a.out && b.out) return b.dist - a.dist;
      if (a.finished && b.finished) return (b.laps - a.laps) || (a.finishT - b.finishT);
      if (a.finished !== b.finished) { // finished car ahead unless lapped
        const f = a.finished ? a : b, o = a.finished ? b : a;
        if (o.laps >= f.laps) return a.finished ? 1 : -1;
        return a.finished ? -1 : 1;
      }
      return b.dist - a.dist;
    });
  }
  idealTyre() { return this.wet > 0.62 ? 'W' : this.wet > 0.22 ? 'I' : null; }
  aiPit(c) {
    const lapsLeft = this.laps - c.laps;
    if (lapsLeft <= 1) return null;
    const ideal = this.idealTyre();
    const isWetTyre = c.tyre === 'I' || c.tyre === 'W';
    if (ideal && c.tyre !== ideal) {
      if (ideal === 'W' && c.tyre === 'I' && this.wet < 0.72) return null;
      if (ideal === 'I' && c.tyre === 'W' && this.wet > 0.5) return null;
      return ideal;
    }
    if (!ideal && isWetTyre && this.wet < 0.18) return this.slick(c, lapsLeft);
    const cheap = this.sc || this.vsc;
    const thr = cheap ? 0.38 : c.planStop;
    const twoRule = !this.anyWetUsed(c) && c.used.size < 2 && !ideal;
    if (c.wear > thr && lapsLeft > (cheap ? 6 : 4)) return this.slick(c, lapsLeft);
    if (c.wear > 0.9) return this.slick(c, lapsLeft);
    if (twoRule && this.rules.twoCompound && lapsLeft <= 3 && lapsLeft > 1 && !this.sprint) return this.slick(c, lapsLeft, true);
    return null;
  }
  anyWetUsed(c) { return c.used.has('I') || c.used.has('W'); }
  slick(c, lapsLeft, forceNew) {
    const need = !this.sprint && this.rules.twoCompound && !this.anyWetUsed(c) && c.used.size < 2;
    const rate = s => TYRES[s].wear * (0.5 + this.track.wear) * (1.35 - c.d.tyre / 150);
    let opts = ['S', 'M', 'H'].filter(s => lapsLeft * rate(s) < 0.85);
    if (!opts.length) opts = ['H'];
    if (need || forceNew) { const o2 = opts.filter(s => !c.used.has(s)); if (o2.length) opts = o2; }
    return opts[0]; // softest that lasts
  }
  doPit(c, comp) {
    const loss = this.track.pit * (this.sc ? 0.55 : this.vsc ? 0.65 : 1);
    let svc = xh('pitService', this, c) ?? rnd(2.1, 3.2); if (Math.random() < (c.player ? (xh('slowStopP', this, c) ?? 0.03) : 0.03)) { svc += rnd(3, 9); this.msg(`🐢 Slow stop for ${c.d.code}`, c.player || c.fav); }
    c.pitT = loss + svc; c.tyre = comp; c.wear = xh('pitTyre', this, c, comp) || 0; c.age = 0; xh('onPit', this, c, comp, svc); c.used.add(comp); c.stops++; c.outLap = true; c.pitReq = null;
    this.msg(`🔧 ${c.d.code} pits → ${TYRES[comp].name}s (${svc.toFixed(1)}s)`, false);
  }
  retire(c, why, flag) {
    c.out = why; c.dnfLap = c.laps;
    this.msg(`❌ ${c.d.code} out: ${why}`, true);
    if (!this.incidentsOn) return;
    if (!this.rules.sc) { if (flag) this.msg('🟨 Yellow flags — no safety car in this era', false); return; }
    if (!this.rules.vsc && flag === 'vsc') flag = 'auto';
    if (flag === 'sc' || (flag === 'auto' && Math.random() < 0.45)) this.startSC();
    else if (this.rules.vsc && (flag === 'vsc' || (flag === 'auto' && Math.random() < 0.6))) this.startVSC();
  }
  makeRain() { this.wetTarget = rnd(0.45, 0.9); this.msg('🌧️ Rain is starting to fall!', true); }
  stopRain() { this.wetTarget = 0; this.msg('🌤️ The rain has stopped, track drying', true); }
  randomIncident() { const run = this.cars.filter(c => !c.out && !c.finished && c.pitT <= 0); if (!run.length) return; const c = pick(run); if (Math.random() < 0.55) this.retire(c, pick(['Crash', 'Collision', 'Hit the wall']), Math.random() < 0.7 ? 'sc' : 'vsc'); else { c.spin = rnd(8, 16); this.msg(`🌀 ${c.d.code} spins!`, true); } }
  startSC() { if (this.sc || this.chequered) return; this.vsc = 0; this.sc = 1; this.scLapsLeft = rint(3, 5); this.flag = 'sc'; this.msg('🟨 SAFETY CAR deployed', true); }
  startVSC() { if (this.sc || this.vsc || this.chequered) return; this.vsc = rnd(40, 110); this.flag = 'vsc'; this.msg('🟨 VIRTUAL SAFETY CAR', true); }
  onLap(c, tc) {
    // called when car completes a lap; tc = exact crossing time
    const n = c.laps; if (tc == null) tc = this.t;
    const lt = tc - (c.cross[n - 1] ?? 0);
    c.cross[n] = tc;
    if (n >= 1 && !this.sc && !this.vsc && !c.outLap) { c.lastLap = lt; if (!c.best || lt < c.best) c.best = lt; if (!this.fastest || lt < this.fastest.t) this.fastest = { t: lt, c }; }
    else c.lastLap = lt;
    c.outLap = false;
    c.age++; c.wear = clamp(c.wear + this.wearRate(c) * (this.sc ? 0.4 : this.vsc ? 0.6 : 1), 0, 1);
    if (n > this.leaderLap) {
      this.leaderLap = n;
      this.plan.filter(p => p.lap === n).forEach(p => { this.wetTarget = p.target; this.msg(p.target > 0.05 ? '🌧️ Rain is starting to fall!' : '🌤️ The rain has stopped, track drying', true); });
      if (this.sc) { this.scLapsLeft--; if (this.scLapsLeft <= 0) { this.sc = 0; this.flag = 'green'; this.msg('🟩 Safety car in — racing resumes!', true); } }
    }
    if (n >= this.laps || this.chequered) { if (!this.chequered) { this.chequered = true; this.msg(`🏁 ${c.d.name} wins!`, true); } c.finished = true; c.finishT = tc; return; }
    // incidents
    if (this.incidentsOn) {
      const mism = (this.wet > 0.3 && 'SMH'.includes(c.tyre)) ? 6 : 0;
      let pc = 0.0011 * (1 + (100 - c.d.cons) / 25) * (c.mode === 'push' ? 1.7 : c.mode === 'save' ? 0.6 : 1) * (1 + this.wet * 4 + mism) * (n === 1 ? 3 : 1);
      if (Math.random() < pc) {
        if (Math.random() < 0.5) this.retire(c, pick(['Crash', 'Collision', 'Hit the wall', 'Spun into the gravel']), Math.random() < 0.65 ? 'sc' : 'vsc');
        else { c.spin = rnd(6, 14); c.wear = clamp(c.wear + 0.1, 0, 1); this.msg(`🌀 ${c.d.code} spins!`, c.player || c.fav); }
        if (c.out) return;
      }
      const rel = teamRel(this.G, c.t);
      if (Math.random() < 0.00075 * Math.pow((100 - rel) / 15, 1.6) * (xh('relMul', this, c) || 1)) { this.retire(c, pick(['Power unit failure', 'Gearbox', 'Hydraulics', 'Brakes', 'Electrical issue', 'Engine']), Math.random() < 0.5 ? 'vsc' : null); return; }
      if (c.wear > 0.88 && Math.random() < 0.18) {
        if (Math.random() < 0.25) { this.retire(c, 'Tyre failure', 'auto'); return; }
        c.spin = rnd(15, 25); this.msg(`💥 Puncture for ${c.d.code}!`, true); c.pitReq = c.pitReq || this.slick(c, this.laps - n) || 'M';
      }
    }
    // pit decisions
    let comp = null;
    if (c.auto) comp = this.aiPit(c);
    else if (c.pitReq) comp = c.pitReq;
    if (c.pitReq && c.auto) comp = c.pitReq;
    if (comp) this.doPit(c, comp);
    // AI driving mode
    if (c.auto && !c.player) c.mode = (this.laps - n < 8 && c.wear < 0.5) ? 'push' : c.wear > 0.65 ? 'save' : 'std';
    xh('onLap', this, c, n);
    c.curLT = this.lapTime(c, n);
  }
  step(dt) {
    if (this.done) return;
    this.t += dt;
    // weather drift
    if (this.weatherOn) { const rate = 0.0022 * dt; if (this.wet < this.wetTarget) this.wet = Math.min(this.wetTarget, this.wet + rate * 1.6); else this.wet = Math.max(this.wetTarget, this.wet - rate * 0.6); }
    if (this.vsc) { this.vsc -= dt; if (this.vsc <= 0) { this.vsc = 0; this.flag = 'green'; this.msg('🟩 VSC ending — green flag', true); } }
    const ord = this.order().filter(c => !c.out && !c.finished);
    const base = this.track.base;
    let ahead = null;
    for (const c of ord) {
      if (c.pitT > 0) { c.pitT -= dt; continue; }
      let v = this.L / c.curLT;
      if (c.spin > 0) { c.spin -= dt; v *= 0.25; }
      if (this.vsc) v = Math.min(v, this.L / (base * 1.4));
      if (this.sc) {
        if (!ahead) v = this.L / (base * 1.5);
        else { const gap = ahead.dist - c.dist; v = gap > 45 ? Math.min(this.L / (base * 1.1), v * 1.05) : this.L / (base * 1.5) * (gap / 30); }
      }
      let nd = c.dist + v * dt;
      if (ahead && !ahead.finished) {
        const minGap = v * 0.22;
        if (nd > ahead.dist - minGap && c.dist < ahead.dist && ahead.dist - c.dist < this.L / 2) {
          let pass = false;
          if (!this.sc && !this.vsc && c.laps >= 0 && ahead.pitT <= 0) {
            const delta = ahead.curLT - c.curLT;
            const ease = 0.15 + this.track.ot * 1.6;
            const pm = xh('passMul', this, c, ahead); const mul = pm == null ? 1 : pm;
            const chance = dt * (0.015 + Math.max(0, delta) * 0.35) * ease * (c.d.craft / ahead.d.craft) * (c.dist < 400 ? 2 : 1) * mul;
            if (mul === Infinity || (mul > 0 && delta > 0.05 && Math.random() < chance)) pass = true;
          }
          if (pass) { nd = Math.max(nd, ahead.dist + 0.5); const key = c.d.id + ahead.d.id + c.laps; if ((c.player || ahead.player || c.fav || ahead.fav || (this.order().indexOf(c) < 4)) && this.lastPass !== key && c.laps >= 1) { this.lastPass = key; this.msg(`⚔️ ${c.d.code} passes ${ahead.d.code}`, false); } }
          else nd = Math.min(nd, ahead.dist - minGap);
        }
      }
      const prevLap = Math.floor(c.dist / this.L);
      c.dist = Math.max(c.dist, nd);
      const nowLap = Math.floor(c.dist / this.L);
      if (nowLap > prevLap && nowLap >= 1) { c.laps = nowLap; const over = c.dist - nowLap * this.L; this.onLap(c, this.t - over / Math.max(1, v)); }
      if (!c.finished && !c.out) ahead = c;
    }
    // water / speed of wetness
    xh('onStep', this, dt);
    if (this.chequered && this.cars.every(c => c.out || c.finished)) this.finish();
    if (this.t > this.laps * base * 3) this.finish();
  }
  finish() {
    if (this.done) return; this.done = true;
    // two-compound rule
    if (!this.sprint && this.rules.twoCompound) this.cars.forEach(c => { if (!c.out && !this.anyWetUsed(c) && c.used.size < 2) { c.penalty = 30; this.msg(`⚖️ ${c.d.code}: +30s, only one dry compound used`, true); } });
    this.cars.forEach(c => { if (c.finished) c.finishT += c.penalty; });
    const ord = this.order();
    xh('raceFinish', this);
    this.result = ord.map((c, i) => ({ pos: i + 1, c, id: c.d.id, team: c.t.id, out: c.out, laps: c.laps, time: c.finished ? c.finishT : null, grid: c.grid, best: c.best, stops: c.stops }));
  }
  gapStr(c, leader) {
    if (c.out) return 'OUT';
    if (c === leader) return 'Lap ' + Math.min(this.laps, c.laps + (c.finished ? 0 : 1));
    if (c.pitT > 0) return 'PIT';
    const lapDiff = leader.laps - c.laps;
    if (lapDiff >= 1 && leader.dist - c.dist > this.L) return '+' + Math.floor((leader.dist - c.dist) / this.L) + 'L';
    const n = c.laps; const lt = leader.cross[n], ct = c.cross[n];
    if (n === 0 || lt == null || ct == null) { return '+' + ((leader.dist - c.dist) / (this.L / leader.curLT)).toFixed(1); }
    const g = ct - lt;
    return '+' + (g < 0 ? (leader.dist - c.dist) / (this.L / leader.curLT) : g).toFixed(1);
  }
}

// ---------- Game state ----------
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function newGame(opts) {
  const G = {
    v: 2, year: 2026, round: 0, player: opts.spectator ? null : opts.team, spectator: !!opts.spectator, follow: opts.follow || null, sprints: (opts.sprints || []).slice(), sprintsNext: null, difficulty: opts.difficulty || 'normal', weatherOn: true, incidentsOn: true,
    teams: {}, drivers: {}, engines: clone(ENGINES), cal: opts.cal.slice(), calNext: null, results: [], projects: [], news: [], history: [], spent: 0, prizes: {}, autoPause: true
  };
  TEAMS_2026.forEach(t => { G.teams[t.id] = Object.assign(clone(t), { pts: 0, spent: 0 }); });
  DRIVERS_2026.forEach(d => { const team = TEAMS_2026.find(t => t.drivers.includes(d.id)); G.drivers[d.id] = Object.assign(clone(d), { team: team.id, pts: 0, wins: 0, pods: 0, poles: 0, careerWins: 0, titles: 0, next: null }); });
  FREE_2026.forEach(d => { G.drivers[d.id] = Object.assign(clone(d), { team: null, pts: 0, wins: 0, pods: 0, poles: 0, careerWins: 0, titles: 0, next: null }); });
  news(G, G.spectator ? `Welcome to the ${G.year} season! It all starts at ${TRACK_BY_ID[G.cal[0]].short}.` : `Welcome to ${G.teams[G.player].full}! Season ${G.year} starts at ${TRACK_BY_ID[G.cal[0]].short}.`);
  return G;
}
function news(G, s) { G.news.unshift({ y: G.year, r: G.round, s }); if (G.news.length > 80) G.news.pop(); }
function teamDrivers(G, tid) { return Object.values(G.drivers).filter(d => d.team === tid).sort((a, b) => b.pts - a.pts || a.num - b.num); }
function freeAgents(G) { return Object.values(G.drivers).filter(d => !d.team && !d.retired); }
function diffMult(G, tid) { if (tid === G.player) return 1; return { easy: 0.8, normal: 1, hard: 1.25 }[G.difficulty] || 1; }
function devMult(stat) { return clamp((100 - stat) / 15, 0.15, 1.3); }
function standingsDrivers(G) { return Object.values(G.drivers).filter(d => d.team || d.pts > 0).filter(d => !d.retired || d.pts > 0).sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.pods - a.pods); }
function standingsTeams(G) { return Object.values(G.teams).sort((a, b) => b.pts - a.pts); }
function teamRank(G, tid) { return standingsTeams(G).findIndex(t => t.id === tid) + 1; }
function appeal(G, tid) {
  const rank = G.round === 0 ? (Object.values(G.teams).sort((a, b) => (b.aero + b.chassis) - (a.aero + a.chassis)).findIndex(t => t.id === tid) + 1) : teamRank(G, tid);
  return 1 - (rank - 1) / (Object.keys(G.teams).length - 1);
}
function askingSalary(d) { const o = overall(d); const age = d.age > 34 ? 0.8 : 1; return Math.max(0.5, +(Math.pow(Math.max(0, (o - 75) / 20), 2.4) * 50 * age).toFixed(1)); }
const OPS_PER_RACE = 4.6; // $M operations cost, counts to cost cap

function weekendEntries(G) {
  const list = [];
  Object.values(G.teams).forEach(t => teamDrivers(G, t.id).slice(0, t.cars || 2).forEach(d => list.push({ d, t, setup: rnd(0.35, 0.5) + (t.id === G.player ? 0 : rnd(0.1, 0.3)), tyreKnow: t.id === G.player ? 0 : rnd(0.2, 0.5), qualiPrep: t.id === G.player ? 0 : rnd(0.2, 0.5) })));
  return list;
}

function applyRaceResult(G, race, wk) {
  const res = race.result; const track = wk.track;
  const summary = { round: G.round + 1, track: track.id, year: G.year, rows: [] };
  const PT = (G.rules && G.rules.points) || POINTS;
  const flRule = G.rules ? G.rules.fl : null;
  res.forEach(r => {
    const d = r.c.d;
    let pts = (!r.out && r.pos <= PT.length) ? PT[r.pos - 1] : 0;
    if (flRule && race.fastest && race.fastest.c === r.c && !r.out && (flRule === 'any' || r.pos <= 10)) pts += 1;
    d.res = d.res || []; d.res.push(pts);
    d.pts += pts; G.teams[r.team].pts += pts;
    if (!r.out && r.pos === 1) { d.wins++; d.careerWins++; }
    if (!r.out && r.pos <= 3) d.pods++;
    summary.rows.push({ id: d.id, code: d.code, name: d.name, team: r.team, pos: r.pos, grid: r.grid, out: r.out, time: r.time, laps: r.laps, pts, best: r.best, stops: r.stops });
  });
  const pole = wk.grid[0]; if (pole) pole.d.poles++;
  if (race.fastest) summary.fastest = { code: race.fastest.c.d.code, t: race.fastest.t };
  if (wk.sprintRows) summary.sprint = wk.sprintRows;
  summary.gp = track.short; summary.realWin = track.realWin;
  G.results.push(summary);
  if (G.rules && G.rules.bestN && typeof recomputePoints === 'function') recomputePoints(G);
  // finances
  const moneyLog = {};
  Object.values(G.teams).forEach(t => {
    const racePts = summary.rows.filter(r => r.team === t.id).reduce((s, r) => s + r.pts, 0);
    const salaries = teamDrivers(G, t.id).reduce((s, d) => s + d.salary, 0) / G.cal.length;
    const income = t.sponsor + racePts * 0.12;
    const crash = summary.rows.filter(r => r.team === t.id && r.out && /Crash|wall|Collision|gravel/.test(r.out)).length * 0.8;
    t.money += income - OPS_PER_RACE - salaries - crash;
    t.spent += OPS_PER_RACE + crash;
    if (t.id === G.player) moneyLog.player = { income, ops: OPS_PER_RACE, salaries, crash, racePts };
  });
  // AI development
  Object.values(G.teams).forEach(t => {
    if (t.id === G.player) return;
    const m = t.dev * diffMult(G, t.id) * (t.money > 0 ? 1 : 0.5);
    ['aero', 'chassis', 'rel'].forEach(k => { t[k] = Math.min(99, t[k] + rnd(0, 0.42) * m * devMult(t[k])); });
    t.spent += 2.6;
    if (t.works) { const e = G.engines[t.engine]; e.power = Math.min(99, e.power + rnd(0, 0.18) * m * devMult(e.power)); e.rel = Math.min(99, e.rel + rnd(0, 0.25) * m * devMult(e.rel)); }
  });
  // player R&D progress
  const done = [];
  G.projects.forEach(p => { p.left--; if (p.left <= 0) done.push(p); });
  G.projects = G.projects.filter(p => p.left > 0);
  const me = G.teams[G.player];
  if (me) done.forEach(p => {
    const sz = RD_SIZES[p.size];
    let g = sz.fail && Math.random() < sz.fail ? 0 : rnd(sz.min, sz.max);
    const tgt = p.area === 'power' ? G.engines[me.engine] : me;
    const key = p.area === 'power' ? 'power' : p.area;
    if (g > 0) g *= devMult(tgt[key]) * (xh('partMul', G, p) || 1);
    tgt[key] = clamp(tgt[key] + g, 40, 99);
    if (G.timeline && G.bonus) G.bonus[p.area === 'power' ? 'power' : p.area] += g;
    p.result = g;
    news(G, g > 0.01 ? `🔬 ${RD_AREAS[p.area].name} ${sz.name.toLowerCase()} upgrade delivered: +${g.toFixed(2)}` : g < -0.01 ? `🔬 ${RD_AREAS[p.area].name} ${sz.name.toLowerCase()} upgrade backfired: ${g.toFixed(2)}` : `🔬 ${RD_AREAS[p.area].name} ${sz.name.toLowerCase()} upgrade showed no gain.`);
  });
  G.round++;
  const win = summary.rows[0];
  news(G, `🏁 R${summary.round} ${track.short}: ${win.name} wins for ${G.teams[win.team].name}.`);
  return { summary, moneyLog, done };
}

const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const SPRINT_2026 = ['chn', 'mia', 'can', 'gbr', 'ned', 'sgp'];
function sprintLaps(track) { return Math.max(1, Math.min(track.laps, Math.max(5, Math.ceil(100 / track.km)))); }
function applySprintResult(G, race) {
  const SP = (G.rules && G.rules.sprintPts) || SPRINT_POINTS; const rows = race.result.map(r => { const pts = (!r.out && r.pos <= SP.length) ? SP[r.pos - 1] : 0; r.c.d.pts += pts; G.teams[r.team].pts += pts; if (G.teams[r.team]) G.teams[r.team].money += pts * 0.06;
    return { id: r.c.d.id, code: r.c.d.code, name: r.c.d.name, team: r.team, pos: r.pos, grid: r.grid, out: r.out, time: r.time, laps: r.laps, pts, stops: r.stops }; });
  news(G, `⚡ Sprint at ${race.track.short}: ${rows[0].name} wins.`);
  return rows;
}
const RD_AREAS = {
  aero: { name: 'Aerodynamics', desc: 'Downforce: big in corners-heavy tracks' },
  chassis: { name: 'Chassis', desc: 'Mechanical grip & balance: everywhere' },
  power: { name: 'Power Unit', desc: 'Straight-line speed (works teams only)' },
  rel: { name: 'Reliability', desc: 'Fewer mechanical DNFs' }
};
const RD_SIZES = {
  minor: { name: 'Minor', cost: 3, races: 2, min: 0.3, max: 0.8, fail: 0 },
  major: { name: 'Major', cost: 8, races: 4, min: 0.8, max: 2.1, fail: 0.1 },
  radical: { name: 'Radical', cost: 18, races: 6, min: -1, max: 4.6, fail: 0 }
};

function endSeason(G) {
  const ts = standingsTeams(G), ds = standingsDrivers(G);
  const champ = ds[0], cchamp = ts[0];
  if (champ) champ.titles++;
  const prizes = {};
  ts.forEach((t, i) => { const p = 140 - i * 9; t.money += p; prizes[t.id] = p; });
  G.history.push({ year: G.year, champ: champ && { id: champ.id, name: champ.name, team: champ.team, pts: champ.pts }, cchamp: { id: cchamp.id, name: cchamp.name, pts: cchamp.pts },
    playerPos: ts.findIndex(t => t.id === G.player) + 1, playerPts: G.player ? G.teams[G.player].pts : 0,
    driverTable: ds.slice(0, 22).map(d => ({ name: d.name, team: d.team, pts: d.pts })), teamTable: ts.map(t => ({ id: t.id, pts: t.pts })) });
  const summary = { year: G.year, champ, cchamp, prizes, playerPos: ts.findIndex(t => t.id === G.player) + 1, retired: [], moves: [], rookies: [] };
  G.year++;
  // car regression toward pack + reset
  Object.values(G.teams).forEach(t => { ['aero', 'chassis'].forEach(k => t[k] = +(80 + (t[k] - 80) * 0.85 + rnd(-0.5, 0.5)).toFixed(2)); t.rel = +(80 + (t.rel - 80) * 0.9).toFixed(2); t.pts = 0; t.spent = 0; if (t.money < 20 && t.id !== G.player) t.money += 40; });
  Object.values(G.engines).forEach(e => { e.power = +(84 + (e.power - 84) * 0.9).toFixed(2); });
  G.projects = [];
  // aging
  Object.values(G.drivers).forEach(d => {
    if (d.retired) return;
    d.age++;
    let g = d.age <= 23 ? rnd(0.3, 1 + d.pot * 0.8) : d.age <= 29 ? rnd(-0.4, 1) : d.age <= 33 ? rnd(-1, 0.4) : rnd(-2.4, 0);
    ['pace', 'craft', 'cons', 'wet', 'tyre'].forEach(k => d[k] = +clamp(d[k] + g * rnd(0.6, 1.3) + (k === 'craft' || k === 'cons' ? Math.max(0, rnd(-0.2, 0.6)) : 0), 55, 99).toFixed(1));
    if (d.age > 25) d.pot = 0;
    d.pts = 0; d.wins = 0; d.pods = 0; d.poles = 0; d.res = [];
  });
  // retirements
  Object.values(G.drivers).forEach(d => {
    if (d.retired) return;
    const o = overall(d); let p = 0;
    if (d.age >= 36 && o < 84) p = 0.35; if (d.age >= 39) p = Math.max(p, 0.3); if (d.age >= 43) p = 0.6; if (d.age >= 46) p = 1;
    if (!d.team && d.age >= 30 && o < 79) p = Math.max(p, 0.4);
    if (d.next) p = 0;
    if (Math.random() < p) { if (G.player && d.team === G.player && d.until >= G.year) return; if (G.follow === d.id && G.spectator && false) return; d.retired = true; summary.retired.push(d.name + (d.team ? ` (${G.teams[d.team].name})` : '')); d.team = null; }
  });
  // apply future contracts
  Object.values(G.drivers).forEach(d => { if (d.next) { const from = d.team; d.team = d.next.team; d.salary = d.next.salary; d.until = d.next.until; d.next = null; if (from !== d.team) summary.moves.push(`${d.name} → ${G.teams[d.team].name}`); } });
  // expired contracts (AI)
  Object.values(G.drivers).forEach(d => {
    if (!d.team || d.retired || d.until >= G.year) return;
    if (G.player && d.team === G.player) { d.team = null; summary.moves.push(`${d.name} left ${G.teams[G.player].name} (contract expired)`); return; }
    const o = overall(d), keep = o > 86 ? 0.9 : o > 83 ? 0.65 : 0.4;
    if (Math.random() < keep) { d.until = G.year + rint(0, 2); d.salary = askingSalary(d); }
    else { summary.moves.push(`${d.name} released by ${G.teams[d.team].name}`); d.leftTeam = d.team; d.team = null; }
  });
  // rookies
  for (let i = 0; i < 6; i++) { const r = makeRookie(G); summary.rookies.push(r.name); }
  // AI fills seats
  fillAISeats(G, summary);
  Object.values(G.drivers).forEach(d => delete d.leftTeam);
  G.round = 0; G.results = [];
  if (G.calNext) { G.cal = G.calNext; G.calNext = null; G.sprints = G.sprintsNext || []; G.sprintsNext = null; }
  news(G, `📅 Season ${G.year} begins! ${summary.champ ? summary.champ.name + ' is the reigning champion.' : ''}`);
  return summary;
}
function makeRookie(G) {
  const cc = pick(Object.keys(NAME_POOL)); const pool = NAME_POOL[cc];
  let name, tries = 0; do { name = pick(pool[0]) + ' ' + pick(pool[1]); tries++; } while (Object.values(G.drivers).some(d => d.name === name) && tries < 20);
  const used = new Set(Object.values(G.drivers).filter(d => !d.retired).map(d => d.num));
  let num; do { num = rint(2, 99); } while (used.has(num));
  const base = rnd(72, 80);
  const last = name.split(' ').slice(-1)[0].normalize('NFD').replace(/[^A-Za-z]/g, '');
  const d = { id: 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), name, code: last.slice(0, 3).toUpperCase().padEnd(3, 'X'), num, nat: cc, age: rint(18, 21),
    pace: +(base + rnd(-1, 2)).toFixed(1), craft: +(base - rnd(0, 3)).toFixed(1), cons: +(base - rnd(0, 3)).toFixed(1), wet: +(base + rnd(-3, 2)).toFixed(1), tyre: +(base - rnd(0, 2)).toFixed(1),
    salary: 0, until: 0, pot: rint(2, 5), team: null, pts: 0, wins: 0, pods: 0, poles: 0, careerWins: 0, titles: 0, next: null, rookie: true };
  G.drivers[d.id] = d; return d;
}
function fillAISeats(G, summary) {
  const teams = Object.values(G.teams).filter(t => t.id !== G.player).sort((a, b) => appeal(G, b.id) - appeal(G, a.id));
  teams.forEach(t => {
    while (teamDrivers(G, t.id).length < 2) {
      const pool = freeAgents(G).filter(d => !d.next && (d.leftTeam !== t.id || freeAgents(G).length < 4)).sort((a, b) => (overall(b) + b.pot * 0.8 + rnd(-2, 2)) - (overall(a) + a.pot * 0.8 + rnd(-2, 2)));
      const d = pool[0]; if (!d) { const r = makeRookie(G); continue; }
      d.team = t.id; d.until = G.year + rint(0, 2); d.salary = askingSalary(d);
      if (summary) summary.moves.push(`${d.name} signs for ${t.name}`);
      news(G, `✍️ ${d.name} signs for ${t.name}.`);
    }
  });
}
// midseason AI: replace player-poached seats immediately
function aiFillNow(G) { fillAISeats(G, null); }

function save(G) { try { G.trackLib = LIB; localStorage.setItem('f1mgr_save', JSON.stringify(G)); return true; } catch (e) { return false; } }
function loadSave() { try { const s = localStorage.getItem('f1mgr_save'); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function exportCode(G) { G.trackLib = LIB; return btoa(unescape(encodeURIComponent(JSON.stringify(G)))); }
function importCode(s) { return JSON.parse(decodeURIComponent(escape(atob(s.trim())))); }

// ---------- Live qualifying session ----------
class QualiLive {
  constructor(G, wk, list, opts) {
    this.G = G; this.track = wk.track; this.L = wk.track.km * 1000; this.dur = opts.dur; this.label = opts.label;
    this.cut = opts.cut || 0; this.t = 0; this.wet = wk.weather.quali; this.log = []; this.events = []; this.done = false;
    this.best = null; this.chequered = false; this.red = 0;
    const base = (() => { const e = list[0]; const c = { d: e.d, t: e.t, tyre: 'S', wear: 0, mode: 'push', setup: e.setup }; return lapTimeFor(G, c, this.track, { lap: 0, wet: this.wet, quali: true }); })();
    this.base = base;
    const OL = base * 1.4, IL = base * 1.45;
    const nRuns = opts.runs || 2;
    const windows = nRuns === 3 ? [[0.03, 0.22], [0.36, 0.55], [0.7, 0.84]] : [[0.04, 0.3], [0.66, 0.84]];
    this.cars = list.map(e => {
      const risk = (opts.risks && opts.risks[e.d.id]) || (G.player === e.t.id ? 'normal' : pick(['normal', 'normal', 'safe', 'all']));
      const runs = [];
      windows.forEach(([a, b], k) => {
        let start = rnd(a, b) * this.dur;
        start = Math.min(start, this.dur - OL - rnd(2, 15));
        const q = qualiLap(G, e, this.track, this.wet, risk);
        const evo = k * 0.12 + (start / this.dur) * 0.2; // track rubbering in
        runs.push({ start, OL: OL * rnd(0.97, 1.05), IL: IL * rnd(0.97, 1.05), fly: q.crash ? base * rnd(1, 1.02) : q.t - evo, crash: q.crash, crashAt: rnd(0.2, 0.9), done: false, aborted: false });
      });
      if (Math.random() < 0.08 && runs.length > 1) runs.shift(); // some skip a run
      return { e, d: e.d, t: e.t, runs, phase: 'garage', frac: 0, best: null, last: null, out: false, pbT: -999, laps: 0, risk, fav: G.follow === e.d.id, player: !!G.player && e.t.id === G.player };
    });
    this.msg(`🟢 ${this.label} is under way — ${Math.round(this.dur / 60)} minutes on the clock`);
  }
  msg(s, imp) { this.log.unshift({ t: this.t, s }); if (this.log.length > 60) this.log.pop(); if (imp) this.events.push(s); }
  clock() { return Math.max(0, this.dur - this.t); }
  step(dt) {
    if (this.done) return;
    this.t += dt;
    if (!this.chequered && this.t >= this.dur) { this.chequered = true; this.msg('🏁 Chequered flag — drivers on a flying lap can finish it', true); }
    let anyOnTrack = false;
    for (const c of this.cars) {
      if (c.out) continue;
      c.phase = 'garage';
      for (const r of c.runs) {
        if (r.done || this.t < r.start) continue;
        const t1 = r.start + r.OL, t2 = t1 + r.fly, t3 = t2 + r.IL;
        if (this.t < t1) { c.phase = 'out'; c.frac = (this.t - r.start) / r.OL; anyOnTrack = true; break; }
        if (!r.aborted && this.t < t2) {
          if (r.crash && (this.t - t1) / r.fly >= r.crashAt) { this.crash(c, r); break; }
          c.phase = 'flying'; c.frac = (this.t - t1) / r.fly; anyOnTrack = true; break;
        }
        if (!r.aborted && !r.timed) { r.timed = true; this.lapDone(c, r.fly); }
        if (this.t < t3) { c.phase = 'in'; c.frac = (this.t - (r.aborted ? r.abortT : t2)) / r.IL; anyOnTrack = true; if (c.frac >= 1) { r.done = true; c.phase = 'garage'; } break; }
        r.done = true;
      }
    }
    if (this.chequered && !anyOnTrack) this.finish();
    if (this.t > this.dur * 1.6) this.finish();
  }
  lapDone(c, lt) {
    c.last = lt; c.laps++;
    const pb = !c.best || lt < c.best;
    if (pb) { c.best = lt; c.pbT = this.t; }
    if (!this.best || lt < this.best.t) {
      const was = this.best; this.best = { t: lt, c };
      this.msg(`🟣 ${c.d.code} goes fastest: ${fmtTime(lt)}${was ? ` (${(lt - was.t).toFixed(3)})` : ''}`, c.fav || c.player);
    } else if (pb && (c.fav || c.player)) this.msg(`🟢 ${c.d.code} improves to ${fmtTime(lt)} — P${this.order().indexOf(c) + 1}`, false);
  }
  crash(c, r) {
    c.out = true; c.phase = 'crashed';
    this.msg(`🟥 RED FLAG — ${c.d.name} crashes${c.best ? '' : ' without setting a time'}!`, true);
    // everyone on a flying lap has it aborted
    this.cars.forEach(o => { if (o === c || o.out) return; o.runs.forEach(rr => { const t1 = rr.start + rr.OL; if (!rr.done && !rr.aborted && this.t >= t1 && this.t < t1 + rr.fly) { rr.aborted = true; rr.abortT = this.t; } }); });
    // session restarts after a pause: push back all future runs a little
    const pause = 90; this.dur += pause * 0.5;
    this.cars.forEach(o => o.runs.forEach(rr => { if (this.t < rr.start) rr.start += pause * 0.5; }));
  }
  order() {
    return this.cars.slice().sort((a, b) => {
      if (a.best != null && b.best != null) return a.best - b.best;
      if (a.best != null) return -1; if (b.best != null) return 1;
      return (a.out ? 1 : 0) - (b.out ? 1 : 0);
    });
  }
  finish() {
    if (this.done) return; this.done = true;
    this.result = this.order().map(c => ({ e: c.e, t: c.best, crash: c.out && c.best == null, risk: c.risk }));
  }
}
