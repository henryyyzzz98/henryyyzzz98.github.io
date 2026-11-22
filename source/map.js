// ---------- TV-graphics track map (replaces dkDrawMap) ----------
// Draws the traced layout exactly as stored; only styling is added around it.
const MAPF = {};
const MAP_SEC = ['#e8463f', '#3b8cff', '#f5b82e'];
function mapWrap(a) { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a; }
function mapFeatures(track) {
  const g = trackGeometry(track), nT = track.turnsN || (() => { try { return dkTurns(track); } catch (e) { return 12; } })();
  const mk = track.marks || null;
  const key = (track.geoKey || track.id) + ':' + nT + ':' + (mk ? JSON.stringify(mk) : '');
  if (MAPF[key]) return MAPF[key];
  const M = 720, pts = [], hd = [];
  for (let j = 0; j < M; j++) { const p = pointAt(g, j / M); pts.push(p); hd.push(p[2]); }
  const W = 4, cv = [];
  for (let j = 0; j < M; j++) cv.push(mapWrap(hd[(j + W) % M] - hd[(j - W + M) % M]));
  const sm = cv.map((_, j) => (cv[(j - 2 + M) % M] + cv[(j - 1 + M) % M] * 2 + cv[j] * 3 + cv[(j + 1) % M] * 2 + cv[(j + 2) % M]) / 9);
  // corners: always exactly the real turn count (from the turns database).
  // 1) strongest curvature peaks, spaced apart; 2) relax the spacing for chicanes and esses;
  // 3) still short -> add the curviest remaining spots furthest from existing corners (kinks, long multi-apex bends).
  const dist = (x, y) => { const d = Math.abs(x - y); return Math.min(d, M - d); };
  const peaks = [];
  for (let j = 0; j < M; j++) { const a = Math.abs(sm[j]); if (a > 0.015 && a >= Math.abs(sm[(j - 1 + M) % M]) && a >= Math.abs(sm[(j + 1) % M])) peaks.push({ j, a }); }
  for (let j = 0; j < M; j++) { const a = Math.abs(cv[j]); if (a > 0.04 && a > Math.abs(cv[(j - 1 + M) % M]) && a >= Math.abs(cv[(j + 1) % M]) && !peaks.some(q => q.j === j)) peaks.push({ j, a: a * 0.9 }); }
  peaks.sort((x, y) => y.a - x.a);
  const pick = [];
  for (const sep of [Math.round(M * 0.014), Math.round(M * 0.009), Math.round(M * 0.006), 3]) {
    for (const p of peaks) { if (pick.length >= nT) break; if (pick.every(q => dist(q.j, p.j) >= sep)) pick.push(p); }
    if (pick.length >= nT) break;
  }
  while (pick.length < Math.min(nT, M / 3)) {
    let bj = -1, bs = -1;
    for (let j = 0; j < M; j++) { const d = pick.length ? Math.min(...pick.map(q => dist(q.j, j))) : M; if (d < 3) continue; const sc = Math.sqrt(Math.abs(sm[j]) + 0.002) * d; if (sc > bs) { bs = sc; bj = j; } }
    if (bj < 0) break; pick.push({ j: bj, a: Math.abs(sm[bj]) });
  }
  pick.forEach(p => { p.s = Math.sign(sm[p.j]) || Math.sign(cv[p.j]) || 1; });
  pick.sort((x, y) => x.j - y.j);
  const corners = pick.map((p, i) => ({ f: p.j / M, s: p.s, n: i + 1 }));
  // straights: long runs of low curvature (wrap-aware) -> DRS zones on the longest ones
  const flat = sm.map(v => Math.abs(v) < 0.05);
  let start = flat.findIndex(v => !v); if (start < 0) start = 0;
  const runs = []; let r0 = null;
  for (let k = 1; k <= M; k++) { const j = (start + k) % M; if (flat[j]) { if (r0 == null) r0 = start + k; } else if (r0 != null) { runs.push([r0, start + k]); r0 = null; } }
  if (r0 != null) runs.push([r0, start + M + 1]);
  runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const drs = runs.filter((r, i) => (r[1] - r[0]) / M > 0.055 && (i < 2 || (r[1] - r[0]) / M > 0.1)).slice(0, 3)
    .map(r => { const L = r[1] - r[0]; return [(r[0] + L * 0.18) / M, (r[1] - L * 0.04) / M]; });
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  g.P.forEach(([x, y]) => { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); });
  const out = { corners, drs, box: [minx, miny, maxx, maxy], autoCorners: corners, autoDrs: drs };
  if (mk && Array.isArray(mk.drs)) out.drs = mk.drs.map(z => [z[0], z[1] < z[0] ? z[1] + 1 : z[1]]);
  if (mk && Array.isArray(mk.corners)) out.corners = mk.corners.map((c, i) => { const j = Math.round(((c[0] % 1) + 1) % 1 * M) % M; return { f: c[0], n: c[1] != null ? c[1] : i + 1, s: Math.sign(sm[j]) || 1 }; });
  return MAPF[key] = out;
}
// ---------- pit lane ----------
// The game triggers a stop as the car crosses the start/finish line, so the lane starts at the line and
// rejoins the track a little further on. Each team has its own box along the lane.
const PIT_LEN = 0.06, PIT_OFF = 16;
const pitRamp = s => s < 0.15 ? s / 0.15 : s > 0.85 ? (1 - s) / 0.15 : 1;
function pitLanePt(g, base, s, X, Y) { s = Math.max(0, Math.min(1, s)); const p = pointAt(g, base + s * PIT_LEN), n = p[2] + Math.PI / 2, d = PIT_OFF * pitRamp(s); return [X(p) + Math.cos(n) * d, Y(p) + Math.sin(n) * d]; }
function pitBox(race, c) { const ts = [...new Set(race.cars.map(x => x.t.id))], i = Math.max(0, ts.indexOf(c.t.id)); return ts.length > 1 ? 0.25 + 0.5 * i / (ts.length - 1) : 0.5; }
function pitProgress(c) { // where along the lane: drive in, stop at the box for the service, drive out
  const P = c.pitInfo, el = P.T - c.pitT, drive = Math.max(0.1, P.T - P.svc), tin = drive * P.box;
  if (el < tin) return el / tin * P.box;
  if (el < tin + P.svc) return P.box;
  return P.box + (el - tin - P.svc) / Math.max(0.1, drive - tin) * (1 - P.box);
}
hxChain('onPit', (race, c, comp, svc) => { c.pitInfo = { T: c.pitT, svc: svc || 0, base: c.dist / race.L, box: pitBox(race, c) }; });
function mapDrsOn() { const y = G && G.year; return y >= 2011 && y <= 2025; }
const _mp_clearGeo = clearGeo; clearGeo = function () { _mp_clearGeo(); Object.keys(MAPF).forEach(k => delete MAPF[k]); };
// ---- broadcast 3D view (tilted ground, red track with kerbs, number|code tags) ----
let MAP3D = (() => { try { return localStorage.getItem('pw_map3d') !== '0'; } catch (e) { return true; } })();
A.map3d = function () { MAP3D = !MAP3D; try { localStorage.setItem('pw_map3d', MAP3D ? '1' : '0'); } catch (e) { } MAPF._bg = null; const b = document.getElementById('map3dbtn'); if (b) b.textContent = MAP3D ? '2D map' : '3D map'; if (typeof dkDraw === 'function') dkDraw(); };
const M3_TILT = 0.95; // ~54° camera tilt
function m3Proj(F, g) { // perspective projection in map units, cached per track
  if (F._m3) return F._m3;
  const [bx0, by0, bx1, by1] = F.box, cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, span = Math.max(bx1 - bx0, by1 - by0), D = span * 2.3, sn = Math.sin(M3_TILT), cs = Math.cos(M3_TILT);
  const pr = (x, y) => { const u = x - cx, v = y - cy, k = D / (D + v * sn); return [u * k, v * cs * k, k]; };
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  g.P.forEach(p => { const q = pr(p[0], p[1]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
  return (F._m3 = { pr, box: [x0, y0, x1, y1], span, cx, cy, bx: F.box });
}
dkDrawMap = function (cv, kind, S, mini) {
  if (!cv || !cv._w) return;
  const ctx = cv.getContext('2d'), w = cv._w, h = cv._h, dpr = cv._dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = trackGeometry(S.track), F = mapFeatures(S.track), threeD = MAP3D && !mini;
  const padS = mini ? 16 : Math.max(24, Math.min(w, h) * 0.05), top = mini ? 6 : Math.min(h * 0.09, 46);
  let X, Y, K = () => 1, s;
  if (threeD) {
    const M = m3Proj(F, g), [px0, py0, px1, py1] = M.box, pad = Math.max(30, Math.min(w, h) * 0.06);
    s = Math.min((w - pad * 2) / (px1 - px0 || 1), (h - top - pad * 1.6) / (py1 - py0 || 1));
    const ox = (w - (px1 - px0) * s) / 2 - px0 * s, oy = top + (h - top - (py1 - py0) * s) / 2 - py0 * s;
    X = p => ox + M.pr(p[0], p[1])[0] * s; Y = p => oy + M.pr(p[0], p[1])[1] * s; K = p => M.pr(p[0], p[1])[2];
    // static layer (ground, glow, track, kerbs, DRS, pit lane) cached in an offscreen canvas
    const yel0 = kind === 'race' && (RACE.sc || RACE.vsc), red0 = kind === 'race' && RACE.red;
    const key = [S.track.geoKey || S.track.id, w, h, dpr, yel0 ? 'y' : red0 ? 'r' : '', Math.round((S.wet || 0) * 10), mapDrsOn()].join('|');
    if (!MAPF._bg || MAPF._bg.key !== key) {
      const oc = document.createElement('canvas'); oc.width = w * dpr; oc.height = h * dpr; const c2 = oc.getContext('2d'); c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      m3Static(c2, w, h, g, F, M, X, Y, K, s, yel0, red0, S.wet || 0);
      MAPF._bg = { key, oc };
    }
    ctx.drawImage(MAPF._bg.oc, 0, 0, w, h);
    let btn = document.getElementById('map3dbtn');
    if (!btn && cv.parentNode) { cv.parentNode.insertAdjacentHTML('beforeend', `<button id="map3dbtn" class="map3d-btn" data-a="map3d">2D map</button>`); }
  } else {
    const [bx0, by0, bx1, by1] = F.box;
    s = Math.min((w - padS * 2) / (bx1 - bx0 || 1), (h - top - padS * 2) / (by1 - by0 || 1));
    const ox = (w - (bx1 - bx0) * s) / 2 - bx0 * s, oy = top + (h - top - (by1 - by0) * s) / 2 - by0 * s;
    X = p => ox + p[0] * s; Y = p => oy + p[1] * s;
    if (!mini && !document.getElementById('map3dbtn') && cv.parentNode) cv.parentNode.insertAdjacentHTML('beforeend', `<button id="map3dbtn" class="map3d-btn" data-a="map3d">3D map</button>`);
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const seg = (f0, f1) => { ctx.beginPath(); const n = Math.max(2, Math.ceil((f1 - f0) * 600)); for (let k = 0; k <= n; k++) { const p = pointAt(g, f0 + (f1 - f0) * k / n); k ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p)); } };
  const full = () => { ctx.beginPath(); g.P.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.closePath(); };
  const yel = kind === 'race' && (RACE.sc || RACE.vsc), red = kind === 'race' && RACE.red;
  const tw = mini ? 6 : 12, lw = mini ? 2.5 : 4.5;
  if (!threeD) {
    if (mini) ctx.clearRect(0, 0, w, h);
    else { ctx.fillStyle = '#12131a'; ctx.fillRect(0, 0, w, h); }
    if (S.wet > 0.05) { ctx.fillStyle = `rgba(40,80,150,${S.wet * (mini ? 0.15 : 0.28)})`; ctx.fillRect(0, 0, w, h); }
    if (!mini) {
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#5b6070'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= 40; k++) { const [x, y] = pitLanePt(g, 0, k / 40, X, Y); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore();
    }
    full(); ctx.strokeStyle = '#2a2d38'; ctx.lineWidth = tw; ctx.stroke();
    if (yel || red) { full(); ctx.strokeStyle = red ? '#ef4444' : '#facc15'; ctx.lineWidth = lw; ctx.stroke(); }
    else [0, 1, 2].forEach(i => { seg(i / 3, (i + 1) / 3); ctx.strokeStyle = MAP_SEC[i]; ctx.lineWidth = lw; ctx.stroke(); });
    if (!mini && mapDrsOn() && !yel && !red) { ctx.strokeStyle = 'rgba(57,211,83,0.62)'; ctx.lineWidth = tw - 1; F.drs.forEach(([a, b]) => { seg(a, b); ctx.stroke(); }); }
    [1 / 3, 2 / 3].forEach((f, i) => { const p = pointAt(g, f), n = p[2] + Math.PI / 2, L = mini ? 5 : 8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(p) + Math.cos(n) * L, Y(p) + Math.sin(n) * L); ctx.lineTo(X(p) - Math.cos(n) * L, Y(p) - Math.sin(n) * L); ctx.stroke();
      if (mini) { ctx.fillStyle = '#cfe8ff'; ctx.font = '11px ui-monospace,monospace'; ctx.fillText('S' + (i + 2), X(p) + 9, Y(p) + 4); } });
    const s0 = pointAt(g, 0), q = mini ? 2 : 3; ctx.save(); ctx.translate(X(s0), Y(s0)); ctx.rotate(s0[2] + Math.PI / 2);
    for (let k = -3; k < 3; k++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (k + j) % 2 ? '#fff' : '#111'; ctx.fillRect(k * q, -q + j * q, q, q); } ctx.restore();
  }
  // cars
  const ord = kind === 'race' ? RACE.order() : S.order(); const r0 = mini ? 4.5 : threeD ? 6 : 7.5;
  const list = [];
  ord.forEach((c, i) => {
    let x, y, dim = false, p;
    if (kind === 'race') { if (c.out) return; let frac = c.finished ? 0.002 * i : (RACE.started ? c.dist : c.dist * 2.6) / RACE.L;
      if (c.pitInfo && !(c.pitT > 0) && !c.finished) { const rel = c.dist / RACE.L - c.pitInfo.base; if (rel >= 0 && rel < 2 * PIT_LEN) frac = c.pitInfo.base + PIT_LEN + rel / 2; else c.pitInfo = null; }
      p = pointAt(g, frac); x = X(p); y = Y(p);
      if (!RACE.started) { const n = m3Norm(g, frac, X, Y), sd = (c.grid % 2 ? -1 : 1) * 5; x += n[0] * sd; y += n[1] * sd; }
      if (c.pitT > 0) {
        if (c.pitInfo && !mini) [x, y] = pitLanePt3(g, c.pitInfo.base, pitProgress(c), X, Y, threeD);
        else if (c.parked && !mini) [x, y] = pitLanePt3(g, 0, pitBox(RACE, c), X, Y, threeD);
        else { const n = m3Norm(g, frac, X, Y); x += n[0] * PIT_OFF; y += n[1] * PIT_OFF; }
        dim = true; } }
    else { if (c.out || c.phase === 'garage' || c.phase === 'crashed') return; p = pointAt(g, c.frac); x = X(p); y = Y(p); dim = c.phase !== 'flying';
      if (c.phase === 'out' && c.frac < PIT_LEN && !mini) [x, y] = pitLanePt3(g, 0, c.frac / PIT_LEN, X, Y, threeD); }
    list.push({ c, x, y, dim, i, k: threeD ? K(p) : 1 });
  });
  if (threeD) { m3Cars(ctx, w, h, list, kind, r0); return; }
  const tags = [];
  for (let k = list.length - 1; k >= 0; k--) { const { c, x, y, dim, i } = list[k]; const hi = c.player || c.fav, r = hi ? r0 + 1.5 : r0;
    ctx.globalAlpha = dim ? 0.5 : 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = c.t.color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    if (hi) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 6.283); ctx.lineWidth = 1.5; ctx.strokeStyle = c.fav && !c.player ? '#ffd400' : '#fff'; ctx.stroke(); }
    if (kind === 'race' && (c.off > 0 || c.coastF != null)) { ctx.beginPath(); ctx.arc(x, y, r + (hi ? 7 : 4), 0, 6.283); ctx.lineWidth = 2.5; ctx.strokeStyle = c.off > 0 ? '#ef4444' : '#f59e0b'; if (c.coastF != null) ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
    if (!mini) { ctx.fillStyle = dkInk(c.t.color); ctx.font = `bold ${hi ? 10 : 9}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(kind === 'race' ? String(i + 1) : String(c.d.num || c.d.code[0]), x, y + 0.5); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const lab = hi || (kind === 'race' ? RACE.started && i < 3 : c.phase === 'flying' && i < 6) || (kind === 'race' && c.off > 0);
      if (lab) tags.push({ c, x, y, r, hi, dim }); }
    else if (hi || i === 0) { ctx.fillStyle = '#fff'; ctx.font = '11px ui-monospace,monospace'; ctx.fillText(c.d.code, x + 7, y - 6); }
    ctx.globalAlpha = 1; }
  ctx.font = '700 11px "Titillium Web",system-ui,sans-serif'; ctx.textBaseline = 'middle';
  tags.forEach(({ c, x, y, r, hi, dim }) => { const t = c.d.code, tw2 = ctx.measureText(t).width + 10, tx = Math.min(w - tw2 - 2, x + r + 4), ty = Math.max(9, y - r - 9);
    ctx.globalAlpha = dim ? 0.6 : 1;
    if (hi) { ctx.fillStyle = c.t.color; ctx.fillRect(tx, ty - 8, tw2, 16); ctx.fillStyle = dkInk(c.t.color); }
    else { ctx.fillStyle = 'rgba(18,19,26,0.75)'; ctx.fillRect(tx, ty - 8, tw2, 16); ctx.fillStyle = c.t.color; ctx.fillRect(tx, ty - 8, 2.5, 16); ctx.fillStyle = '#fff'; }
    ctx.fillText(t, tx + 5 + (hi ? 0 : 1), ty + 0.5); ctx.globalAlpha = 1; });
  ctx.textBaseline = 'alphabetic';
};
// screen-space unit normal of the track at frac (works for the flat and the tilted view)
function m3Norm(g, f, X, Y) { const a = pointAt(g, f - 0.0015), b = pointAt(g, f + 0.0015), dx = X(b) - X(a), dy = Y(b) - Y(a), l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; }
function pitLanePt3(g, base, sv, X, Y, threeD) {
  if (!threeD) return pitLanePt(g, base, sv, X, Y);
  sv = Math.max(0, Math.min(1, sv)); const f = base + sv * PIT_LEN, p = pointAt(g, f), n = m3Norm(g, f, X, Y), d = PIT_OFF * 0.85 * pitRamp(sv);
  // the 2D lane sits on the +normal side of the heading; keep the same side here
  const n2 = p[2] + Math.PI / 2, sgn = Math.sign(n[0] * Math.cos(n2) + n[1] * Math.sin(n2)) || 1;
  return [X(p) + n[0] * d * sgn, Y(p) + n[1] * d * sgn];
}
function m3Static(c, w, h, g, F, M, X, Y, K, s, yel, red, wet) {
  // background: dark venue with a soft spotlight around the circuit
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0d0f14'); bg.addColorStop(1, '#1a1c22'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  // ground plane: a perspective grid over an expanded area around the circuit
  const [bx0, by0, bx1, by1] = M.bx, ex = (bx1 - bx0) * 0.35, ey = (by1 - by0) * 0.35, gx0 = bx0 - ex, gx1 = bx1 + ex, gy0 = by0 - ey, gy1 = by1 + ey;
  const P = (x, y) => [X([x, y]), Y([x, y])];
  c.beginPath(); [[gx0, gy0], [gx1, gy0], [gx1, gy1], [gx0, gy1]].forEach((q, i) => { const [x, y] = P(q[0], q[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
  const gg = c.createLinearGradient(0, Y([0, gy0]), 0, Y([0, gy1])); gg.addColorStop(0, '#16181e'); gg.addColorStop(1, '#23262d'); c.fillStyle = gg; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1; const step = M.span / 14;
  for (let x = gx0; x <= gx1; x += step) { c.beginPath(); let [a, b] = P(x, gy0); c.moveTo(a, b); [a, b] = P(x, gy1); c.lineTo(a, b); c.stroke(); }
  for (let y = gy0; y <= gy1; y += step) { c.beginPath(); let [a, b] = P(gx0, y); c.moveTo(a, b); [a, b] = P(gx1, y); c.lineTo(a, b); c.stroke(); }
  c.lineJoin = 'round'; c.lineCap = 'round';
  const path = () => { c.beginPath(); g.P.forEach((p, i) => i ? c.lineTo(X(p), Y(p)) : c.moveTo(X(p), Y(p))); c.closePath(); };
  const seg = (f0, f1, off) => { c.beginPath(); const n = Math.max(2, Math.ceil((f1 - f0) * 700)); for (let k = 0; k <= n; k++) { const f = f0 + (f1 - f0) * k / n, p = pointAt(g, f); let x = X(p), y = Y(p); if (off) { const nn = m3Norm(g, f, X, Y); x += nn[0] * off; y += nn[1] * off; } k ? c.lineTo(x, y) : c.moveTo(x, y); } };
  // infield: lighter "lit" ground inside the loop, with a glow
  c.save(); path(); c.fillStyle = 'rgba(70,74,84,0.55)'; c.shadowColor = 'rgba(255,255,255,0.18)'; c.shadowBlur = 60; c.fill(); c.restore();
  c.save(); path(); c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 40; c.shadowColor = 'rgba(255,255,255,0.22)'; c.shadowBlur = 45; c.stroke(); c.restore();
  // pit lane: grey strip alongside the start straight
  c.strokeStyle = '#4b4f59'; c.lineWidth = 6; c.beginPath(); for (let k = 0; k <= 50; k++) { const [x, y] = pitLanePt3(g, 0, k / 50, X, Y, true); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
  const tw = Math.max(8, Math.min(15, w / 90)), base = red ? '#ef4444' : yel ? '#facc15' : '#e5373c';
  // asphalt shoulder + shadow
  c.save(); c.translate(0, 3); path(); c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = tw + 8; c.stroke(); c.restore();
  path(); c.strokeStyle = '#3b3e46'; c.lineWidth = tw + 7; c.stroke();
  // kerbs: red/white striped edges
  path(); c.strokeStyle = '#d42a30'; c.lineWidth = tw + 3.5; c.stroke();
  path(); c.strokeStyle = '#f4f4f4'; c.lineWidth = tw + 3.5; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
  // racing surface
  path(); c.strokeStyle = base; c.lineWidth = tw; c.stroke();
  path(); c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = tw * 0.3; c.stroke();
  if (wet > 0.05) { path(); c.strokeStyle = `rgba(60,110,200,${Math.min(0.5, wet * 0.6)})`; c.lineWidth = tw; c.stroke(); }
  // DRS zones: green lines along both edges
  if (mapDrsOn() && !yel && !red) { c.strokeStyle = '#3ddc62'; c.lineWidth = 2.2; F.drs.forEach(([a, b]) => { [1, -1].forEach(sd => { seg(a, b, sd * (tw / 2 + 5)); c.stroke(); }); }); }
  // sector lines and chequered start line
  [1 / 3, 2 / 3].forEach(f => { const p = pointAt(g, f), n = m3Norm(g, f, X, Y), L = tw / 2 + 3; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(p) + n[0] * L, Y(p) + n[1] * L); c.lineTo(X(p) - n[0] * L, Y(p) - n[1] * L); c.stroke(); });
  const p0 = pointAt(g, 0), n0 = m3Norm(g, 0, X, Y), L0 = tw / 2 + 2, q = 2.5;
  for (let k = -3; k < 3; k++) for (let j = 0; j < 2; j++) { const t = (k + 0.5) / 3 * L0, x = X(p0) + n0[0] * t + n0[1] * (j - 0.5) * q * 1.2, y = Y(p0) + n0[1] * t - n0[0] * (j - 0.5) * q * 1.2; c.fillStyle = (k + j) % 2 ? '#fff' : '#111'; c.fillRect(x - q / 2, y - q / 2, q, q); }
  // vignette
  const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
}
// cars as team-coloured dots with broadcast tags "P | CODE", placed so tags don't overlap
function m3Cars(ctx, w, h, list, kind, r0) {
  const fs = w < 520 ? 10 : 12, pd = fs * 0.5, bh = fs + 8;
  ctx.font = `700 ${fs}px "Titillium Web",system-ui,sans-serif`; ctx.textBaseline = 'middle';
  // dots: far ones first so near ones sit on top
  const byDepth = list.slice().sort((a, b) => a.y - b.y);
  byDepth.forEach(({ c, x, y, dim, k }) => {
    const hi = c.player || c.fav, r = (hi ? r0 + 1.5 : r0) * Math.max(0.75, Math.min(1.3, k));
    ctx.globalAlpha = dim ? 0.55 : 1;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.55, r * 1.1, r * 0.45, 0, 0, 6.283); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = c.t.color; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.stroke();
    if (hi) { ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, 6.283); ctx.lineWidth = 1.5; ctx.strokeStyle = c.fav && !c.player ? '#ffd400' : '#fff'; ctx.stroke(); }
    if (kind === 'race' && (c.off > 0 || c.coastF != null)) { ctx.beginPath(); ctx.arc(x, y, r + (hi ? 6.5 : 4), 0, 6.283); ctx.lineWidth = 2.5; ctx.strokeStyle = c.off > 0 ? '#ef4444' : '#f59e0b'; if (c.coastF != null) ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = 1;
  });
  // tags: highlighted drivers first, then running order; skip a tag that would overlap one already placed
  const placed = [], pri = list.slice().sort((a, b) => ((b.c.player || b.c.fav) ? 1 : 0) - ((a.c.player || a.c.fav) ? 1 : 0) || (b.c.off > 0) - (a.c.off > 0) || a.i - b.i);
  const hit = (b) => placed.some(q => b.x < q.x + q.w + 2 && q.x < b.x + b.w + 2 && b.y < q.y + q.h + 2 && q.y < b.y + b.h + 2);
  pri.forEach(({ c, x, y, dim, i }) => {
    const hi = c.player || c.fav, num = String(i + 1), code = c.d.code || c.d.name.slice(0, 3).toUpperCase();
    const wn = ctx.measureText(num).width, wc = ctx.measureText(code).width, bw = pd * 2 + wn + 9 + wc, cands = [[-bw / 2, -bh - 10], [8, -bh - 4], [-bw - 8, -bh - 4], [8, 4], [-bw - 8, 4], [-bw / 2, 10]];
    let box = null;
    for (const [dx, dy] of cands) { const b = { x: Math.max(2, Math.min(w - bw - 2, x + dx)), y: Math.max(2, Math.min(h - bh - 2, y + dy)), w: bw, h: bh }; if (!hit(b)) { box = b; break; } }
    if (!box) { if (!hi) return; box = { x: Math.max(2, Math.min(w - bw - 2, x - bw / 2)), y: Math.max(2, y - bh - 10), w: bw, h: bh }; }
    placed.push(box);
    ctx.globalAlpha = dim ? 0.65 : 1;
    // stem from the tag to the dot
    const ax = Math.max(box.x, Math.min(box.x + bw, x)), ay = y < box.y ? box.y : y > box.y + bh ? box.y + bh : y;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = hi ? '#f2f2f2' : 'rgba(22,24,30,0.92)'; ctx.fillRect(box.x, box.y, bw, bh);
    ctx.fillStyle = hi ? '#111' : '#fff'; ctx.fillText(num, box.x + pd, box.y + bh / 2 + 0.5);
    ctx.fillStyle = c.t.color; ctx.fillRect(box.x + pd + wn + 3.5, box.y + 4, 2, bh - 8);
    ctx.fillStyle = hi ? '#111' : '#fff'; ctx.fillText(code, box.x + pd + wn + 9, box.y + bh / 2 + 0.5);
    ctx.globalAlpha = 1;
  });
  ctx.textBaseline = 'alphabetic';
}

// ---------- Track Studio: DRS zone & corner number editing ----------
// marks = { drs: [[f0, f1], ...] | null, corners: [[f, n|null], ...] | null }  (f = fraction of the lap from the start line)
// null means "automatic" (detected from the shape); an array, even an empty one, is the user's own choice.
function trmClone(m) { return m ? JSON.parse(JSON.stringify(m)) : { drs: null, corners: null }; }
function trmGeo() {
  const P = TR.pts; if (P.length < 3) return null;
  const k = JSON.stringify(P); if (TR._mg && TR._mg.k === k) return TR._mg;
  const sp = trSpline(P, 40), cum = [0]; for (let i = 1; i <= sp.length; i++) { const a = sp[i - 1], b = sp[i % sp.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const len = cum[cum.length - 1];
  const gk = '_trm' + (++trmGeo.n), tk = { id: TR.id, geoKey: gk, pts: P.map(p => [p[0] / 10, p[1] / 10]), marks: null, turnsN: trmTurnsFor(TR.id, TR.ver === -1 ? null : TR.from, TR.ver === -1 ? null : TR.to) };
  let auto = { drs: [], corners: [] }; try { const F = mapFeatures(tk); auto = { drs: F.autoDrs.map(z => [z[0], z[1] % 1]), corners: F.autoCorners.map(c => [c.f, null]) }; } catch (e) { }
  delete GEO[gk]; Object.keys(MAPF).forEach(x => { if (x.startsWith(gk)) delete MAPF[x]; });
  return TR._mg = { k, sp, cum, len, auto };
}
trmGeo.n = 0;
// real turn count for a layout's years (latest year in the range where this circuit raced), else the circuit's current count
function trmTurnsFor(id, from, to) {
  if (from && to && typeof HIST !== 'undefined' && HIST.years) for (let y = Math.min(to, 2026); y >= from; y--) { const H = HIST.years[y], arr = TURNS_Y[y]; if (!H || !H.cal || !arr) continue; const rd = H.cal.findIndex(c => c[0] === id); if (rd >= 0 && arr[rd]) return arr[rd]; }
  return TURNS_T[id] || null;
}
function trmAt(f) { const G2 = trmGeo(); const t = (((f % 1) + 1) % 1) * G2.len; let lo = 0, hi = G2.cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (G2.cum[m] <= t) lo = m; else hi = m; }
  const a = G2.sp[lo % G2.sp.length], b = G2.sp[(lo + 1) % G2.sp.length], u = (t - G2.cum[lo]) / ((G2.cum[lo + 1] - G2.cum[lo]) || 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
function trmFrac(p) { const G2 = trmGeo(); let bi = 0, bd = 1e9; G2.sp.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; bi = i; } }); return { f: +(G2.cum[bi] / G2.len).toFixed(4), d: bd }; }
function trmEff() { const G2 = trmGeo(), m = TR.marks || {}; return { drs: m.drs || (G2 ? G2.auto.drs : []), corners: m.corners || (G2 ? G2.auto.corners : []), autoD: !m.drs, autoC: !m.corners }; }
function trmSort() { if (TR.marks.corners) TR.marks.corners.sort((a, b) => a[0] - b[0]); if (TR.marks.drs) TR.marks.drs.sort((a, b) => a[0] - b[0]); }
function trmPct(f) { return Math.round(f * 100) + '%'; }
function trmPanel() {
  const e = trmEff(), on = TR.mode === 'drs' || TR.mode === 'corner';
  const drsList = e.drs.length ? e.drs.map((z, i) => `<span class="trm-chip drs">Zone ${i + 1} · ${trmPct(z[0])}→${trmPct(z[1])}${e.autoD ? '' : ` <button class="sm" data-a="trmdeld" data-v="${i}" aria-label="Delete zone">✕</button>`}</span>`).join('') : '<span class="small mut">No DRS zones.</span>';
  const cList = e.corners.length ? e.corners.map((c, i) => `<span class="trm-chip">${e.autoC ? `<b>${c[1] != null ? c[1] : i + 1}</b>` : `<input type="number" min="1" max="99" class="trm-n" data-ci="${i}" value="${c[1] != null ? c[1] : i + 1}">`}<small>${trmPct(c[0])}</small>${e.autoC ? '' : `<button class="sm" data-a="trmdelc" data-v="${i}" aria-label="Delete corner">✕</button>`}</span>`).join('') : '<span class="small mut">No corner numbers.</span>';
  return `<h3 style="margin-top:12px">5 · DRS zones and corner numbers</h3>
  <div class="small mut">Shown on the live map in qualifying and the Grand Prix. DRS zones appear in the 2011–2025 seasons.</div>
  <div class="row" style="margin-top:6px"><button class="sm ${TR.mode === 'drs' ? 'on' : ''}" data-a="trmode" data-v="drs" ${TR.pts.length >= 3 ? '' : 'disabled'}>🟩 Place DRS zones</button><button class="sm ${TR.mode === 'corner' ? 'on' : ''}" data-a="trmode" data-v="corner" ${TR.pts.length >= 3 ? '' : 'disabled'}>🔢 Place corners</button></div>
  ${on ? `<div class="small mut" style="margin-top:4px">${TR.mode === 'drs' ? (TR.drsA != null ? 'Now tap where this DRS zone ends (driving direction).' : 'Tap where a DRS zone starts, then tap where it ends.') : 'Tap the track to add a corner. Tap a corner to remove it. Numbers follow driving order — edit any number below.'}</div>` : ''}
  <div class="trm-h"><b class="small">DRS zones</b> <span class="small ${e.autoD ? 'mut' : 'good'}">${e.autoD ? 'automatic' : 'custom'}</span>${e.autoD ? '' : '<button class="sm" data-a="trmauto" data-v="drs">Use automatic</button>'}<button class="sm" data-a="trmclr" data-v="drs">Clear</button></div>
  <div class="trm-list">${drsList}</div>
  <div class="trm-h"><b class="small">Corners (${e.corners.length})</b> <span class="small ${e.autoC ? 'mut' : 'good'}">${e.autoC ? 'automatic' : 'custom'}</span>${e.autoC ? '' : '<button class="sm" data-a="trmauto" data-v="corners">Use automatic</button><button class="sm" data-a="trmrenum">Renumber 1, 2, 3…</button>'}<button class="sm" data-a="trmclr" data-v="corners">Clear</button></div>
  <div class="trm-list">${cList}</div>`;
}
const _trm_open = openTracer;
openTracer = function (id, back, ver) {
  _trm_open(id, back, ver); if (!TR) return;
  const v = TR.ver !== -1 && TR.ver !== 'new' ? layoutVersions(id)[TR.ver] : null;
  TR.marks = trmClone(v ? v.marks : TR.ver === -1 ? TRACK_BY_ID[id].marks : null); TR.drsA = null;
};
const _trm_view = viewTracer;
viewTracer = function () { let h = _trm_view(); h = h.replace('margin-top:6px">undefined</div>', 'margin-top:6px">Placing DRS zones and corners — see section 5 below.</div>'); const at = '<h3 style="margin-top:12px">Preview</h3>'; return h.includes(at) ? h.replace(at, trmPanel() + at) : h; };
const _trm_draw = drawTracer;
drawTracer = function () {
  _trm_draw(); const cv = document.getElementById('tcv'); if (!cv || !TR || TR.pts.length < 3) return;
  const ctx = cv.getContext('2d'), k = cv._w / 1000, e = trmEff(), on = TR.mode === 'drs' || TR.mode === 'corner';
  ctx.save(); ctx.globalAlpha = on ? 1 : 0.75; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  e.drs.forEach(([a, b], i) => { const bb = b < a ? b + 1 : b, n = Math.max(2, Math.ceil((bb - a) * 300)); ctx.beginPath();
    for (let j = 0; j <= n; j++) { const p = trmAt(a + (bb - a) * j / n); j ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k); }
    ctx.strokeStyle = e.autoD ? 'rgba(57,211,83,0.45)' : 'rgba(57,211,83,0.85)'; ctx.lineWidth = 9; ctx.stroke();
    const q = trmAt(a); ctx.fillStyle = '#39d353'; ctx.font = '700 11px system-ui,sans-serif'; ctx.fillText('DRS ' + (i + 1), q[0] * k + 8, q[1] * k - 8); });
  if (TR.mode === 'drs' && TR.drsA != null) { const q = trmAt(TR.drsA); ctx.beginPath(); ctx.arc(q[0] * k, q[1] * k, 7, 0, 6.283); ctx.fillStyle = '#39d353'; ctx.fill(); }
  ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  e.corners.forEach((c, i) => { const q = trmAt(c[0]); ctx.beginPath(); ctx.arc(q[0] * k, q[1] * k, 9, 0, 6.283); ctx.fillStyle = e.autoC ? 'rgba(42,45,56,0.85)' : '#2a2d38'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = e.autoC ? '#777' : '#fff'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(String(c[1] != null ? c[1] : i + 1), q[0] * k, q[1] * k + 0.5); });
  ctx.restore();
};
const _trm_init = initTracer;
initTracer = function () {
  _trm_init(); const cv = document.getElementById('tcv'); if (!cv || !TR) return;
  cv.addEventListener('pointerdown', ev => {
    if ((TR.mode !== 'drs' && TR.mode !== 'corner') || TR.pts.length < 3) return;
    const r = cv.getBoundingClientRect(), p = [(ev.clientX - r.left) / r.width * 1000, (ev.clientY - r.top) / r.height * 1000];
    const hit = trmFrac(p); if (hit.d > 45) return trMsg('Tap closer to the track line.', true);
    const e = trmEff();
    if (TR.mode === 'corner') {
      if (!TR.marks.corners) TR.marks.corners = e.corners.map(c => c.slice());
      const near = TR.marks.corners.findIndex(c => { const q = trmAt(c[0]); return Math.hypot(q[0] - p[0], q[1] - p[1]) < 24; });
      if (near >= 0) { TR.marks.corners.splice(near, 1); trMsg('Corner removed.'); }
      else { TR.marks.corners.push([hit.f, null]); trmSort(); trMsg('Corner added.'); }
    } else {
      if (TR.drsA == null) { TR.drsA = hit.f; trMsg('Now tap where this DRS zone ends.'); drawTracer(); refreshTracerSide(); return; }
      if (Math.abs(hit.f - TR.drsA) < 0.005) return trMsg('Tap further along the track for the end of the zone.', true);
      if (!TR.marks.drs) TR.marks.drs = e.drs.map(z => z.slice());
      TR.marks.drs.push([TR.drsA, hit.f]); TR.drsA = null; trmSort(); trMsg('DRS zone added.');
    }
    refreshTracerSide();
  });
  document.querySelectorAll('.trm-n').forEach(inp => inp.addEventListener('change', () => {
    const i = +inp.dataset.ci, n = parseInt(inp.value); if (!TR.marks.corners || !TR.marks.corners[i]) return;
    TR.marks.corners[i][1] = n > 0 ? Math.min(99, n) : null; drawTracer();
  }));
};
// keep marks pinned to the same spot when the start line moves or the direction flips
function trmSnapWrap(name, rev) {
  const f = A[name]; A[name] = function (el) {
    if (!TR || !TR.marks || TR.pts.length < 3 || (!TR.marks.drs && !TR.marks.corners)) return f.call(this, el);
    const D = TR.marks.drs && TR.marks.drs.map(z => [trmAt(z[0]), trmAt(z[1])]), C = TR.marks.corners && TR.marks.corners.map(c => [trmAt(c[0]), c[1]]);
    const r = f.call(this, el); if (TR.pts.length < 3) return r;
    if (D) TR.marks.drs = D.map(([a, b]) => rev ? [trmFrac(b).f, trmFrac(a).f] : [trmFrac(a).f, trmFrac(b).f]);
    if (C) TR.marks.corners = C.map(([p, n]) => [trmFrac(p).f, rev ? null : n]);
    trmSort(); refreshTracerSide(); return r;
  };
}
trmSnapWrap('trstart', false); trmSnapWrap('trrev', true);
const _trm_ver = A.trver;
A.trver = function (el) { const keep = TR && TR.marks; const r = _trm_ver.call(this, el); if (el.dataset.v === 'new' && TR && keep) TR.marks = trmClone(keep); return r; };
const _trm_save = A.tracersave;
A.tracersave = function () {
  if (!TR) return _trm_save.call(this);
  const id = TR.id, ver = TR.ver, m = TR.marks && (TR.marks.drs || TR.marks.corners) ? trmClone(TR.marks) : null;
  const f = parseInt((document.getElementById('tfrom') || {}).value), t = parseInt((document.getElementById('tto') || {}).value);
  const r = _trm_save.call(this); if (TR) return r; // save failed (e.g. bad years)
  if (ver === -1) { LIB.marks = LIB.marks || {}; if (m) LIB.marks[id] = m; else delete LIB.marks[id]; }
  else { const v = layoutVersions(id).find(x => x.from === f && x.to === t); if (v) { if (m) v.marks = m; else delete v.marks; } }
  saveLib(); applyLib(); clearGeo(); if (G) autosave(); return r;
};
Object.assign(A, {
  trmdeld(el) { const e = trmEff(); if (!TR.marks.drs) TR.marks.drs = e.drs.map(z => z.slice()); TR.marks.drs.splice(+el.dataset.v, 1); refreshTracerSide(); },
  trmdelc(el) { const e = trmEff(); if (!TR.marks.corners) TR.marks.corners = e.corners.map(c => c.slice()); TR.marks.corners.splice(+el.dataset.v, 1); refreshTracerSide(); },
  trmauto(el) { TR.marks[el.dataset.v] = null; TR.drsA = null; refreshTracerSide(); },
  trmclr(el) { TR.marks[el.dataset.v] = []; TR.drsA = null; refreshTracerSide(); },
  trmrenum() { if (TR.marks.corners) TR.marks.corners.forEach(c => { c[1] = null; }); refreshTracerSide(); }
});
const _trm_mode = A.trmode; A.trmode = function (el) { if (TR) TR.drsA = null; return _trm_mode.call(this, el); };
