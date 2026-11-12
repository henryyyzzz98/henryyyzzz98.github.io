// ===== TRACK LIBRARY (custom layouts & circuits) + IMAGE TRACER =====
TRACKS.forEach(t => { t.origPts = t.pts; t.origLaps = t.laps; });
const TRACK_TYPES = {
  balanced: { name: 'Balanced', v: 210, ot: .5, df: .55, pw: .55, wear: .5 },
  fast: { name: 'High-speed', v: 240, ot: .6, df: .35, pw: .8, wear: .4 },
  technical: { name: 'Technical', v: 200, ot: .35, df: .75, pw: .45, wear: .6 },
  street: { name: 'Street circuit', v: 175, ot: .2, df: .8, pw: .35, wear: .4 }
};
function loadLib() { try { const s = localStorage.getItem('pitwall_tracks'); if (s) { const o = JSON.parse(s); return { layouts: o.layouts || {}, custom: o.custom || [], laps: o.laps || {}, sets: o.sets || {} }; } } catch (e) { } return { layouts: {}, custom: [], laps: {}, sets: {} }; }
let LIB = loadLib();
function saveLib() { try { localStorage.setItem('pitwall_tracks', JSON.stringify(LIB)); } catch (e) { } }
function makeCustomTrack(c) {
  const ty = TRACK_TYPES[c.type] || TRACK_TYPES.balanced;
  const t = T(c.id, c.name, c.short || c.name, c.cc || 'US', +c.km || 5, ty.v, ty.ot, ty.df, ty.pw, ty.wear, (c.rain ?? 15) / 100, 'custom', null);
  t.base = +(t.km * 3600 / t.v).toFixed(3); t.laps = c.laps || Math.max(10, Math.round(305 / t.km)); t.pit = t.km > 10 ? 30 : 21; t.origPts = null; t.origLaps = t.laps;
  return t;
}
function applyLib() {
  LIB.custom.forEach(c => {
    const t = makeCustomTrack(c);
    const i = TRACKS.findIndex(x => x.id === c.id);
    if (i >= 0) TRACKS[i] = t; else TRACKS.push(t);
    TRACK_BY_ID[c.id] = t;
  });
  TRACKS.forEach(t => { const L = LIB.layouts[t.id]; t.pts = L && L.length >= 3 ? L : t.origPts; delete GEO[t.id]; const n = (LIB.laps || {})[t.id]; t.laps = n ? n : t.origLaps; });
}
function mergeLib(other) {
  if (!other) return;
  (other.custom || []).forEach(c => { if (!LIB.custom.some(x => x.id === c.id)) LIB.custom.push(c); });
  Object.entries(other.layouts || {}).forEach(([k, v]) => { LIB.layouts[k] = v; });
  LIB.laps = LIB.laps || {}; Object.entries(other.laps || {}).forEach(([k, v]) => { LIB.laps[k] = v; });
  LIB.sets = LIB.sets || {}; Object.entries(other.sets || {}).forEach(([k, v]) => { LIB.sets[k] = v; });
  saveLib(); applyLib();
}
applyLib();
function clearGeo() { Object.keys(GEO).forEach(k => delete GEO[k]); }
// layout versions: LIB.sets[trackId] = [{from, to, pts}]
function layoutVersions(id) { return (LIB.sets && LIB.sets[id]) || []; }
function layoutForYear(t, year) {
  const vs = layoutVersions(t.id).filter(v => year >= v.from && year <= v.to && v.pts && v.pts.length >= 3);
  if (!vs.length) return t;
  const v = vs.sort((a, b) => b.from - a.from)[0];
  return Object.assign({}, t, { pts: v.pts, geoKey: t.id + '@' + v.from + '-' + v.to });
}

// ---------- image tracing ----------
// Returns an ordered closed loop (in processing-pixel coords) of the track line containing (x,y).
function traceImage(data, w, h, x, y, tol) {
  x = Math.round(x); y = Math.round(y);
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
  // target colour: average 3x3 around tap
  let tr = 0, tg = 0, tb = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const p = px(yy * w + xx); tr += p[0]; tg += p[1]; tb += p[2]; n++; }
  tr /= n; tg /= n; tb /= n;
  const t2 = tol * tol;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const r = data[i * 4] - tr, g = data[i * 4 + 1] - tg, b = data[i * 4 + 2] - tb; if (data[i * 4 + 3] > 40 && r * r + g * g + b * b < t2) mask[i] = 1; }
  // dilate once to bridge anti-aliasing gaps
  const m2 = new Uint8Array(w * h);
  for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
    const i = yy * w + xx; if (mask[i] || mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w] || mask[i - w - 1] || mask[i - w + 1] || mask[i + w - 1] || mask[i + w + 1]) m2[i] = 1;
  }
  // seed near tap
  let seed = -1, bestD = 1e9;
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; if (m2[yy * w + xx] && dx * dx + dy * dy < bestD) { bestD = dx * dx + dy * dy; seed = yy * w + xx; } }
  if (seed < 0) return { err: 'No track line found where you tapped. Tap right on the line.' };
  // flood fill component (8-connected)
  const comp = new Uint8Array(w * h); const stack = [seed]; comp[seed] = 1; let count = 0, first = seed;
  while (stack.length) {
    const i = stack.pop(); count++; if (i < first) first = i;
    const xx = i % w, yy = (i - xx) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx; if (m2[j] && !comp[j]) { comp[j] = 1; stack.push(j); }
    }
  }
  if (count < 60) return { err: 'That shape is too small. Tap on the main track line, or raise the colour tolerance.' };
  // Moore-neighbour boundary trace (clockwise in screen coords)
  const D = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const fg = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && comp[yy * w + xx] === 1;
  const sx = first % w, sy = (first - sx) / w;
  const out = [[sx, sy]]; let cx = sx, cy = sy, dir = 0, steps = 0, firstDir = -1;
  // start: came from the west (background)
  let back = 0;
  while (steps++ < 400000) {
    let found = -1;
    for (let k = 1; k <= 8; k++) { const d = (back + k) % 8; if (fg(cx + D[d][0], cy + D[d][1])) { found = d; break; } }
    if (found < 0) break; // isolated pixel
    if (firstDir < 0) firstDir = found;
    else if (cx === sx && cy === sy && found === firstDir) break;
    cx += D[found][0]; cy += D[found][1];
    back = (found + 4) % 8; // direction pointing back to previous pixel
    out.push([cx, cy]);
  }
  if (out.length < 20) return { err: 'Could not follow the outline. Try a cleaner image or adjust tolerance.' };
  out.pop();
  // contour length
  let per = 0; for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const width = Math.min(count / per, Math.max(w, h) * 0.03);
  let pts = resampleLoop(out, 120);
  pts = smoothLoop(pts, 2);
  // offset inward by half the line width to approximate the centre line
  const inward = inwardSign(pts);
  pts = pts.map((p, i) => {
    const a = pts[(i - 2 + pts.length) % pts.length], b = pts[(i + 2) % pts.length];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return [p[0] + -ty * inward * width / 2, p[1] + tx * inward * width / 2];
  });
  pts = smoothLoop(resampleLoop(pts, 64), 1);
  return { pts, width, count };
}
function pointInPoly(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; }
function inwardSign(pts) {
  let votes = 0;
  for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 12))) {
    const a = pts[(i - 2 + pts.length) % pts.length], b = pts[(i + 2) % pts.length];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    votes += pointInPoly([pts[i][0] - ty * 2, pts[i][1] + tx * 2], pts) ? 1 : -1;
  }
  return votes >= 0 ? 1 : -1;
}
function resampleLoop(pts, n) {
  const cum = [0]; for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const L = cum[cum.length - 1], out = []; let j = 0;
  for (let k = 0; k < n; k++) {
    const tgt = k / n * L; while (cum[j + 1] < tgt) j++;
    const a = pts[j], b = pts[(j + 1) % pts.length], f = (tgt - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}
function smoothLoop(pts, passes) {
  for (let p = 0; p < passes; p++) pts = pts.map((q, i) => { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
  return pts;
}

// ---------- band tracer (outlined tracks, any colour) ----------
// Finds the track "band" (ink + gaps closed), its outer edge and its inner (infield) edge,
// then returns the centre line midway between the two edges.
function bgColour(data, w, h) {
  const counts = new Map(); const add = (x, y) => { const i = (y * w + x) * 4; const k = (data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4); counts.set(k, (counts.get(k) || 0) + 1); };
  for (let x = 0; x < w; x += 2) { add(x, 0); add(x, h - 1); add(x, Math.floor(h / 2)); }
  for (let y = 0; y < h; y += 2) { add(0, y); add(w - 1, y); add(Math.floor(w / 2), y); }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(v => +v * 16 + 8);
  return best;
}
function boxMorph(src, w, h, r, dilate) {
  // separable square dilation/erosion
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let run = 0; const row = y * w;
    for (let x = 0; x < w; x++) { let v = dilate ? 0 : 1; for (let k = -r; k <= r; k++) { const xx = x + k; const s = xx < 0 || xx >= w ? (dilate ? 0 : 1) : src[row + xx]; if (dilate ? s : !s) { v = dilate ? 1 : 0; break; } } tmp[row + x] = v; } }
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { let v = dilate ? 0 : 1; for (let k = -r; k <= r; k++) { const yy = y + k; const s = yy < 0 || yy >= h ? (dilate ? 0 : 1) : tmp[yy * w + x]; if (dilate ? s : !s) { v = dilate ? 1 : 0; break; } } out[y * w + x] = v; }
  return out;
}
function mooreTrace(set, w, h) {
  let first = -1; for (let i = 0; i < w * h; i++) if (set[i]) { first = i; break; }
  if (first < 0) return [];
  const D = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const fg = (x, y) => x >= 0 && y >= 0 && x < w && y < h && set[y * w + x] === 1;
  const sx = first % w, sy = (first - sx) / w; const out = [[sx, sy]];
  let cx = sx, cy = sy, back = 0, steps = 0, firstDir = -1;
  while (steps++ < 600000) {
    let found = -1; for (let k = 1; k <= 8; k++) { const d = (back + k) % 8; if (fg(cx + D[d][0], cy + D[d][1])) { found = d; break; } }
    if (found < 0) break;
    if (firstDir < 0) firstDir = found; else if (cx === sx && cy === sy && found === firstDir) break;
    cx += D[found][0]; cy += D[found][1]; back = (found + 4) % 8; out.push([cx, cy]);
  }
  out.pop(); return out;
}
function floodLabel(mask, w, h, seed, val) { // returns Uint8Array of the 8-connected component of pixels where mask===val
  const comp = new Uint8Array(w * h); if (mask[seed] !== val) return comp;
  const st = [seed]; comp[seed] = 1; let n = 0;
  while (st.length) { const i = st.pop(); n++; const x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (!comp[j] && mask[j] === val) { comp[j] = 1; st.push(j); } } }
  comp.count = n; return comp;
}
function traceBand(data, w, h, x, y, tol, gap) {
  x = Math.round(x); y = Math.round(y);
  const bg = bgColour(data, w, h), t2 = tol * tol;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const r = data[i * 4] - bg[0], g = data[i * 4 + 1] - bg[1], b = data[i * 4 + 2] - bg[2]; if (r * r + g * g + b * b > t2) ink[i] = 1; }
  // close small gaps (e.g. a thin white centre line inside a black outline)
  const band = gap > 0 ? boxMorph(boxMorph(ink, w, h, gap, true), w, h, gap, false) : ink;
  // pick the band component nearest the tap
  let seed = -1, bd = 1e9;
  for (let dy = -18; dy <= 18; dy++) for (let dx = -18; dx <= 18; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; if (band[yy * w + xx] && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; seed = yy * w + xx; } }
  if (seed < 0) return { err: 'No track found where you tapped. Tap on the track itself.' };
  const comp = floodLabel(band, w, h, seed, 1);
  if (comp.count < 80) return { err: 'That shape is too small — tap on the main track.' };
  // track drawn as two separate edge lines (outline only): find the other edge inside the infield
  {
    const R = loopRegions(comp, w, h);
    if (R.hole) {
      const insideInk = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (R.hole[i] && band[i]) insideInk[i] = 1;
      let bestSeed = -1, bestN = 0; const seen = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) { if (!insideInk[i] || seen[i]) continue; const c = floodLabel(insideInk, w, h, i, 1); for (let j = 0; j < w * h; j++) if (c[j]) seen[j] = 1; if (c.count > bestN) { bestN = c.count; bestSeed = i; } }
      if (bestN > comp.count * 0.45) {
        const edge2 = floodLabel(insideInk, w, h, bestSeed, 1);
        const R2 = loopRegions(edge2, w, h);
        const thin = (n, per) => n / Math.max(1, per);
        if (R2.hole && R2.holeN > 30) {
          // region between the two edge lines (incl. the lines) = not outside of edge 1, not infield of edge 2
          const region = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (!R.outside[i] && !R2.hole[i]) region[i] = 1;
          // only use it if the gap between edges is narrow compared with the whole track (i.e. it really is a track outline)
          let rn = 0; for (let i = 0; i < w * h; i++) rn += region[i];
          if (rn < R.holeN * 0.9) { const r = centreOfLoop(region, w, h); if (r) return Object.assign(r, { method: 'outline' }); }
        }
      }
    }
  }
  // if the track has a centre line drawn inside it (e.g. white line inside a black outline), follow that line instead
  const inner = new Uint8Array(w * h); let ic = 0; for (let i = 0; i < w * h; i++) if (comp[i] && !ink[i]) { inner[i] = 1; ic++; }
  if (ic > comp.count * 0.06) {
    let bestSeed = -1, bestN = 0; const seen = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { if (!inner[i] || seen[i]) continue; const c = floodLabel(inner, w, h, i, 1); let n = 0; for (let j = 0; j < w * h; j++) if (c[j]) { seen[j] = 1; n++; } if (n > bestN) { bestN = n; bestSeed = i; } if (bestN > ic * 0.5) break; }
    if (bestN > comp.count * 0.05) {
      const line = floodLabel(inner, w, h, bestSeed, 1);
      const r = centreOfLoop(line, w, h);
      if (r) return Object.assign(r, { method: 'centre line' });
    }
  }
  const r = centreOfLoop(comp, w, h);
  if (r) return Object.assign(r, { method: 'band' });
  return traceImage(data, w, h, x, y, tol);
}
function loopRegions(comp, w, h) {
  const notComp = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) notComp[i] = comp[i] ? 0 : 1;
  const outside = new Uint8Array(w * h); const st = [];
  const push = i => { if (notComp[i] && !outside[i]) { outside[i] = 1; st.push(i); } };
  for (let xx = 0; xx < w; xx++) { push(xx); push((h - 1) * w + xx); }
  for (let yy = 0; yy < h; yy++) { push(yy * w); push(yy * w + w - 1); }
  while (st.length) { const i = st.pop(); const xx = i % w, yy = (i - xx) / w; if (xx > 0) push(i - 1); if (xx < w - 1) push(i + 1); if (yy > 0) push(i - w); if (yy < h - 1) push(i + w); }
  const lab = new Int32Array(w * h); let nextId = 0, bestId = 0, bestN = 0; const q = [];
  for (let i = 0; i < w * h; i++) {
    if (!notComp[i] || outside[i] || lab[i]) continue;
    const id = ++nextId; let n = 0; lab[i] = id; q.push(i);
    while (q.length) { const k = q.pop(); n++; const xx = k % w, yy = (k - xx) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (notComp[j] && !outside[j] && !lab[j]) { lab[j] = id; q.push(j); } } }
    if (n > bestN) { bestN = n; bestId = id; }
  }
  let hole = null; if (bestId) { hole = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (lab[i] === bestId) hole[i] = 1; }
  return { outside, hole, holeN: bestN };
}
// centre line of a closed loop-shaped pixel region: midway between its outer edge and its infield edge
function centreOfLoop(comp, w, h) {
  const { outside, hole: best, holeN: bestN } = loopRegions(comp, w, h);
  if (!best || bestN < 30) return null;
  const filled = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) filled[i] = outside[i] ? 0 : 1;
  const outer = mooreTrace(filled, w, h), inner = mooreTrace(best, w, h);
  if (outer.length < 20 || inner.length < 10) return null;
  const N = 900; const O = resampleLoop(outer, N), I = resampleLoop(inner, N);
  const near = (p, C) => { let bi = 0, bd2 = 1e18; for (let k = 0; k < C.length; k++) { const dx = C[k][0] - p[0], dy = C[k][1] - p[1], dd = dx * dx + dy * dy; if (dd < bd2) { bd2 = dd; bi = k; } } return C[bi]; };
  let mid = O.map(p => { const q2 = near(p, I); return [(p[0] + q2[0]) / 2, (p[1] + q2[1]) / 2, Math.hypot(q2[0] - p[0], q2[1] - p[1])]; });
  const widths = mid.map(m => m[2]).sort((a, b) => a - b); const medW = widths[Math.floor(widths.length / 2)];
  mid = mid.filter(m => m[2] < medW * 2.2).map(m => [m[0], m[1]]);
  const clean = []; mid.forEach(p => { const q2 = clean[clean.length - 1]; if (!q2 || Math.hypot(p[0] - q2[0], p[1] - q2[1]) > 0.8) clean.push(p); });
  let per = 0; for (let i = 0; i < clean.length; i++) { const a = clean[i], b = clean[(i + 1) % clean.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const n = clamp(Math.round(per / 6), 60, 220);
  let pts = resampleLoop(smoothLoop(clean, 1), n);
  if (medW > 3) { // refine onto the line between the two edges (only matters for thick bands)
    const half = medW / 2;
    const dist = (p, C) => { const q2 = near(p, C); return Math.hypot(q2[0] - p[0], q2[1] - p[1]); };
    for (let it = 0; it < 3; it++) {
      pts = pts.map(p => {
        const o = near(p, outer), i2 = near(p, inner);
        const dir = (from, to, alt) => { let dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy); if (l < 0.5) { dx = from[0] - alt[0]; dy = from[1] - alt[1]; l = Math.hypot(dx, dy) || 1; } return [dx / l, dy / l]; };
        const u1 = dir(o, p, i2), u2 = dir(i2, p, o);
        const c1 = [o[0] + u1[0] * half, o[1] + u1[1] * half], c2 = [i2[0] + u2[0] * half, i2[1] + u2[1] * half];
        const e1 = Math.abs(dist(c1, inner) - half), e2 = Math.abs(dist(c2, outer) - half);
        const m = e1 <= e2 ? c1 : c2;
        return Math.hypot(m[0] - p[0], m[1] - p[1]) < medW ? m : p; });
      pts = resampleLoop(pts, n);
    }
  }
  return { pts, width: medW, count: per };
}
