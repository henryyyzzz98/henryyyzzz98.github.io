// ---------- TV-graphics track map (replaces dkDrawMap) ----------
// Draws the traced layout exactly as stored; only styling is added around it.
const MAPF = {};
const MAP_SEC = ['#e8463f', '#3b8cff', '#f5b82e'];
function mapWrap(a) { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a; }
function mapFeatures(track) {
  const g = trackGeometry(track), nT = (() => { try { return dkTurns(track); } catch (e) { return 12; } })();
  const mk = track.marks || null;
  const key = (track.geoKey || track.id) + ':' + nT + ':' + (mk ? JSON.stringify(mk) : '');
  if (MAPF[key]) return MAPF[key];
  const M = 720, pts = [], hd = [];
  for (let j = 0; j < M; j++) { const p = pointAt(g, j / M); pts.push(p); hd.push(p[2]); }
  const W = 4, cv = [];
  for (let j = 0; j < M; j++) cv.push(mapWrap(hd[(j + W) % M] - hd[(j - W + M) % M]));
  const sm = cv.map((_, j) => (cv[(j - 2 + M) % M] + cv[(j - 1 + M) % M] * 2 + cv[j] * 3 + cv[(j + 1) % M] * 2 + cv[(j + 2) % M]) / 9);
  // corners: strongest curvature peaks, spaced apart, as many as the real turn count
  const peaks = [];
  for (let j = 0; j < M; j++) { const a = Math.abs(sm[j]); if (a > 0.12 && a >= Math.abs(sm[(j - 1 + M) % M]) && a >= Math.abs(sm[(j + 1) % M])) peaks.push({ j, a, s: Math.sign(sm[j]) }); }
  peaks.sort((x, y) => y.a - x.a);
  const pick = [], sep = Math.max(6, Math.round(M * 0.012));
  for (const p of peaks) { if (pick.length >= nT) break; if (pick.every(q => Math.min(Math.abs(q.j - p.j), M - Math.abs(q.j - p.j)) >= sep)) pick.push(p); }
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
function mapDrsOn() { const y = G && G.year; return y >= 2011 && y <= 2025; }
const _mp_clearGeo = clearGeo; clearGeo = function () { _mp_clearGeo(); Object.keys(MAPF).forEach(k => delete MAPF[k]); };
dkDrawMap = function (cv, kind, S, mini) {
  if (!cv || !cv._w) return;
  const ctx = cv.getContext('2d'), w = cv._w, h = cv._h, dpr = cv._dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = trackGeometry(S.track), F = mapFeatures(S.track), [bx0, by0, bx1, by1] = F.box;
  const padS = mini ? 16 : Math.max(24, Math.min(w, h) * 0.05), top = mini ? 6 : Math.min(h * 0.09, 46);
  const s = Math.min((w - padS * 2) / (bx1 - bx0 || 1), (h - top - padS * 2) / (by1 - by0 || 1));
  const ox = (w - (bx1 - bx0) * s) / 2 - bx0 * s, oy = top + (h - top - (by1 - by0) * s) / 2 - by0 * s;
  const X = p => ox + p[0] * s, Y = p => oy + p[1] * s;
  if (mini) ctx.clearRect(0, 0, w, h);
  else { ctx.fillStyle = '#12131a'; ctx.fillRect(0, 0, w, h); }
  if (S.wet > 0.05) { ctx.fillStyle = `rgba(40,80,150,${S.wet * (mini ? 0.15 : 0.28)})`; ctx.fillRect(0, 0, w, h); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const seg = (f0, f1) => { ctx.beginPath(); const n = Math.max(2, Math.ceil((f1 - f0) * 600)); for (let k = 0; k <= n; k++) { const p = pointAt(g, f0 + (f1 - f0) * k / n); k ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p)); } };
  const full = () => { ctx.beginPath(); g.P.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.closePath(); };
  const yel = kind === 'race' && (RACE.sc || RACE.vsc), red = kind === 'race' && RACE.red;
  const tw = mini ? 6 : 12, lw = mini ? 2.5 : 4.5;
  // pit lane (same side the cars are drawn when pitting)
  if (!mini) {
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#5b6070'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k <= 40; k++) { const f = -0.045 + 0.085 * k / 40, p = pointAt(g, f), n = p[2] + Math.PI / 2, e = k < 5 ? k / 5 : k > 35 ? (40 - k) / 5 : 1, d = 16 * e;
      const x = X(p) + Math.cos(n) * d, y = Y(p) + Math.sin(n) * d; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  }
  full(); ctx.strokeStyle = '#2a2d38'; ctx.lineWidth = tw; ctx.stroke();
  if (yel || red) { full(); ctx.strokeStyle = red ? '#ef4444' : '#facc15'; ctx.lineWidth = lw; ctx.stroke(); }
  else [0, 1, 2].forEach(i => { seg(i / 3, (i + 1) / 3); ctx.strokeStyle = MAP_SEC[i]; ctx.lineWidth = lw; ctx.stroke(); });
  if (!mini && mapDrsOn() && !yel && !red) { ctx.strokeStyle = 'rgba(57,211,83,0.62)'; ctx.lineWidth = tw - 1; F.drs.forEach(([a, b]) => { seg(a, b); ctx.stroke(); }); }
  // sector ticks
  [1 / 3, 2 / 3].forEach((f, i) => { const p = pointAt(g, f), n = p[2] + Math.PI / 2, L = mini ? 5 : 8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(p) + Math.cos(n) * L, Y(p) + Math.sin(n) * L); ctx.lineTo(X(p) - Math.cos(n) * L, Y(p) - Math.sin(n) * L); ctx.stroke();
    if (mini) { ctx.fillStyle = '#cfe8ff'; ctx.font = '11px ui-monospace,monospace'; ctx.fillText('S' + (i + 2), X(p) + 9, Y(p) + 4); } });
  // start / finish
  const s0 = pointAt(g, 0), q = mini ? 2 : 3; ctx.save(); ctx.translate(X(s0), Y(s0)); ctx.rotate(s0[2] + Math.PI / 2);
  for (let k = -3; k < 3; k++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (k + j) % 2 ? '#fff' : '#111'; ctx.fillRect(k * q, -q + j * q, q, q); } ctx.restore();
  // corner numbers, placed on the outside of each bend
  if (!mini && s > 180) {
    const fs = s > 420 ? 11 : 10, rr = fs * 0.78; ctx.font = `700 ${fs}px "Titillium Web",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    F.corners.forEach(c => { const p = pointAt(g, c.f), n = p[2] + Math.PI / 2, d = -c.s * (tw / 2 + rr + 4), x = X(p) + Math.cos(n) * d, y = Y(p) + Math.sin(n) * d;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fillStyle = '#2a2d38'; ctx.fill(); ctx.fillStyle = '#e6e8ee'; ctx.fillText(String(c.n), x, y + 0.5); });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  // cars
  const ord = kind === 'race' ? RACE.order() : S.order(); const r0 = mini ? 4.5 : 7.5;
  const list = [];
  ord.forEach((c, i) => {
    let x, y, dim = false;
    if (kind === 'race') { if (c.out) return; const frac = c.finished ? 0.002 * i : (RACE.started ? c.dist : c.dist * 2.6) / RACE.L; const p = pointAt(g, frac); x = X(p); y = Y(p);
      if (!RACE.started) { const n = p[2] + Math.PI / 2, sd = (c.grid % 2 ? -1 : 1) * 5; x += Math.cos(n) * sd; y += Math.sin(n) * sd; }
      if (c.pitT > 0) { const n = p[2] + Math.PI / 2; x += Math.cos(n) * 16; y += Math.sin(n) * 16; dim = true; } }
    else { if (c.out || c.phase === 'garage' || c.phase === 'crashed') return; const p = pointAt(g, c.frac); x = X(p); y = Y(p); dim = c.phase !== 'flying'; }
    list.push({ c, x, y, dim, i });
  });
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
  // driver tags on top of every dot
  ctx.font = '700 11px "Titillium Web",system-ui,sans-serif'; ctx.textBaseline = 'middle';
  tags.forEach(({ c, x, y, r, hi, dim }) => { const t = c.d.code, tw2 = ctx.measureText(t).width + 10, tx = Math.min(w - tw2 - 2, x + r + 4), ty = Math.max(9, y - r - 9);
    ctx.globalAlpha = dim ? 0.6 : 1;
    if (hi) { ctx.fillStyle = c.t.color; ctx.fillRect(tx, ty - 8, tw2, 16); ctx.fillStyle = dkInk(c.t.color); }
    else { ctx.fillStyle = 'rgba(18,19,26,0.75)'; ctx.fillRect(tx, ty - 8, tw2, 16); ctx.fillStyle = c.t.color; ctx.fillRect(tx, ty - 8, 2.5, 16); ctx.fillStyle = '#fff'; }
    ctx.fillText(t, tx + 5 + (hi ? 0 : 1), ty + 0.5); ctx.globalAlpha = 1; });
  ctx.textBaseline = 'alphabetic';
};

// ---------- Track Studio: DRS zone & corner number editing ----------
// marks = { drs: [[f0, f1], ...] | null, corners: [[f, n|null], ...] | null }  (f = fraction of the lap from the start line)
// null means "automatic" (detected from the shape); an array, even an empty one, is the user's own choice.
function trmClone(m) { return m ? JSON.parse(JSON.stringify(m)) : { drs: null, corners: null }; }
function trmGeo() {
  const P = TR.pts; if (P.length < 3) return null;
  const k = JSON.stringify(P); if (TR._mg && TR._mg.k === k) return TR._mg;
  const sp = trSpline(P, 40), cum = [0]; for (let i = 1; i <= sp.length; i++) { const a = sp[i - 1], b = sp[i % sp.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const len = cum[cum.length - 1];
  const gk = '_trm' + (++trmGeo.n), tk = { id: TR.id, geoKey: gk, pts: P.map(p => [p[0] / 10, p[1] / 10]), marks: null };
  let auto = { drs: [], corners: [] }; try { const F = mapFeatures(tk); auto = { drs: F.autoDrs.map(z => [z[0], z[1] % 1]), corners: F.autoCorners.map(c => [c.f, null]) }; } catch (e) { }
  delete GEO[gk]; Object.keys(MAPF).forEach(x => { if (x.startsWith(gk)) delete MAPF[x]; });
  return TR._mg = { k, sp, cum, len, auto };
}
trmGeo.n = 0;
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
