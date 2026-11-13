// ===== TRACK LIBRARY (custom layouts & circuits) + IMAGE TRACER =====
TRACKS.forEach(t => { t.origPts = t.pts; t.origLaps = t.laps; });
const TRACK_TYPES = {
  balanced: { name: 'Balanced', v: 210, ot: .5, df: .55, pw: .55, wear: .5 },
  fast: { name: 'High-speed', v: 240, ot: .6, df: .35, pw: .8, wear: .4 },
  technical: { name: 'Technical', v: 200, ot: .35, df: .75, pw: .45, wear: .6 },
  street: { name: 'Street circuit', v: 175, ot: .2, df: .8, pw: .35, wear: .4 }
};
function loadLib() { try { const s = localStorage.getItem('pitwall_tracks'); if (s) { const o = JSON.parse(s); return { layouts: o.layouts || {}, custom: o.custom || [], laps: o.laps || {}, sets: o.sets || {}, defVer: o.defVer || {} }; } } catch (e) { } return { layouts: {}, custom: [], laps: {}, sets: {}, defVer: {} }; }
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
  TRACKS.forEach(t => { const L = LIB.layouts[t.id]; const lv = defaultLink(t.id); t.pts = lv ? lv.pts : L && L.length >= 3 ? L : t.origPts; delete GEO[t.id]; const n = (LIB.laps || {})[t.id]; t.laps = n ? n : t.origLaps; });
}
function mergeLib(other) {
  if (!other) return;
  (other.custom || []).forEach(c => { if (!LIB.custom.some(x => x.id === c.id)) LIB.custom.push(c); });
  Object.entries(other.layouts || {}).forEach(([k, v]) => { LIB.layouts[k] = v; });
  LIB.laps = LIB.laps || {}; Object.entries(other.laps || {}).forEach(([k, v]) => { LIB.laps[k] = v; });
  LIB.sets = LIB.sets || {}; Object.entries(other.sets || {}).forEach(([k, v]) => { LIB.sets[k] = v; });
  LIB.defVer = LIB.defVer || {}; Object.entries(other.defVer || {}).forEach(([k, v]) => { LIB.defVer[k] = v; });
  saveLib(); applyLib();
}
applyLib();
function clearGeo() { Object.keys(GEO).forEach(k => delete GEO[k]); }
// layout versions: LIB.sets[trackId] = [{from, to, pts}]
function layoutVersions(id) { return (LIB.sets && LIB.sets[id]) || []; }
// the default layout can be linked to one of the dated versions (no copying needed)
function defaultLink(id) { const dv = LIB.defVer && LIB.defVer[id]; if (!dv) return null; const v = layoutVersions(id).find(x => x.from === dv.from && x.to === dv.to); return v && v.pts && v.pts.length >= 3 ? v : null; }
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
  // crossovers / merging lines: the line is a network, not a simple loop → drive around it
  {
    const multi = holeCount(comp, w, h, 0.04) >= 2;
    const lines = centreLines(data, w, h, bg, ink, comp);
    const useInner = lines.n > comp.count * 0.06;
    if (multi || useInner) {
      const M = useInner ? lines.mask : comp;
      let skLen = 0; const skm = thinMask(boxMorph(M, w, h, 1, true), w, h); for (let i = 0; i < w * h; i++) skLen += skm[i];
      const bandW = clamp(comp.count / Math.max(1, skLen), 3, 60);
      const r = routeTrace(M, w, h, x, y, bandW);
      if (r && (r.junctions > 0 || multi)) return Object.assign(r, { method: r.junctions ? 'crossover' : 'centre line', note: r.routes > 1 ? 'This drawing has more than one route through where you tapped. If the wrong one was picked, tap a part of the track only your layout uses.' : '' });
    }
  }
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

// ---------- route tracer (figure-8 crossovers, merging/splitting lines) ----------
// Thins the line to a 1-px skeleton, turns it into a graph of junctions and edges, then
// drives around it: at a crossing it goes straight on, at a merge it follows the smooth line,
// and it keeps going until it is back where it started.
function thinMask(mask, w, h) {
  const m = new Uint8Array(mask); let fg = []; for (let i = 0; i < w * h; i++) if (m[i]) { const x = i % w, y = (i - x) / w; if (x > 0 && y > 0 && x < w - 1 && y < h - 1) fg.push(i); else m[i] = 0; }
  const del = [];
  for (let it = 0; it < 200; it++) {
    let changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (const i of fg) {
        if (!m[i]) continue;
        const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1], p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2); if (A !== 1) continue;
        if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(i);
      }
      for (const i of del) m[i] = 0; if (del.length) changed = true;
    }
    fg = fg.filter(i => m[i]);
    if (!changed) break;
  }
  return m;
}
function routeGraph(mask, w, h, bandW) {
  const sk = thinMask(boxMorph(mask, w, h, 1, true), w, h); // fatten 1px first: thinning can erase 2px-wide diagonal lines
  const N8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  const nb = i => { let c = 0; for (const d of N8) c += sk[i + d]; return c; };
  const pix = []; for (let i = 0; i < w * h; i++) if (sk[i]) pix.push(i);
  // junction clusters
  const r = Math.max(3, Math.round(bandW * 0.45));
  const RING = [-w, -w + 1, 1, w + 1, w, w - 1, -1, -w - 1];
  const cross = i => { let a = 0; for (let k = 0; k < 8; k++) if (!sk[i + RING[k]] && sk[i + RING[(k + 1) % 8]]) a++; return a; };
  const node = new Int32Array(w * h); const jn = pix.filter(i => nb(i) >= 3 && cross(i) >= 3);
  { // clumps of pixels at a crossing can hide the junction from the per-pixel test: judge each clump by how many lines leave it
    const cand = new Uint8Array(w * h); pix.forEach(i => { if (nb(i) >= 3) cand[i] = 1; });
    const lab = new Int32Array(w * h); let L = 0;
    for (const i of pix) { if (!cand[i] || lab[i]) continue; L++; const cl = [i]; lab[i] = L;
      for (let k = 0; k < cl.length; k++) for (const d of N8) { const j = cl[k] + d; if (cand[j] && !lab[j]) { lab[j] = L; cl.push(j); } }
      if (cl.length < 2) continue;
      const ring = new Set(); cl.forEach(k => N8.forEach(d => { const j = k + d; if (sk[j] && lab[j] !== L) ring.add(j); }));
      let comps = 0; const seenR = new Set(); for (const r0 of ring) { if (seenR.has(r0)) continue; comps++; const st = [r0]; seenR.add(r0); while (st.length) { const k = st.pop(); for (const d of N8) { const j = k + d; if (ring.has(j) && !seenR.has(j)) { seenR.add(j); st.push(j); } } } }
      if (comps >= 3) cl.forEach(k => jn.push(k)); }
  }
  const near = new Uint8Array(w * h);
  for (const i of jn) { const x = i % w, y = (i - x) / w; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (sk[j]) near[j] = 1; } }
  let nid = 0; const nodes = [null];
  for (const i of pix) {
    if (!near[i] || node[i]) continue; const id = ++nid; const st = [i]; node[i] = id; let sx = 0, sy = 0, n = 0;
    while (st.length) { const k = st.pop(); sx += k % w; sy += Math.floor(k / w); n++; for (const d of N8) { const j = k + d; if (near[j] && !node[j]) { node[j] = id; st.push(j); } } }
    nodes.push({ id, x: sx / n, y: sy / n, ends: [] });
  }
  // edges = connected runs of non-node skeleton pixels
  const seen = new Uint8Array(w * h); const edges = [];
  const bfs = (start, inComp) => { const par = new Map([[start, -1]]); const q = [start]; let last = start;
    for (let qi = 0; qi < q.length; qi++) { const k = q[qi]; last = k; for (const d of N8) { const j = k + d; if (inComp(j) && !par.has(j)) { par.set(j, k); q.push(j); } } }
    return { last, par }; };
  for (const i of pix) {
    if (node[i] || seen[i]) continue;
    const comp = new Set(); const st = [i]; comp.add(i); seen[i] = 1;
    while (st.length) { const k = st.pop(); for (const d of N8) { const j = k + d; if (sk[j] && !node[j] && !seen[j]) { seen[j] = 1; comp.add(j); st.push(j); } } }
    if (comp.size < 3) continue;
    const inC = j => comp.has(j);
    // prefer an end that touches a node or is a dead end
    let start = -1; for (const k of comp) { let c = 0, tn = false; for (const d of N8) { if (comp.has(k + d)) c++; if (node[k + d]) tn = true; } if (tn || c <= 1) { start = k; break; } }
    if (start < 0) { // a closed loop with no junctions on it: walk all the way round
      const s0 = i, walk = [s0], vis = new Set([s0]); let cur = s0;
      for (;;) { let nx = -1; for (const d of [-w, 1, w, -1, -w - 1, -w + 1, w + 1, w - 1]) { const j = cur + d; if (comp.has(j) && !vis.has(j)) { nx = j; break; } } if (nx < 0) break; vis.add(nx); walk.push(nx); cur = nx; }
      if (walk.length < 12) continue;
      const id = nodes.length; nodes.push({ id, x: s0 % w, y: Math.floor(s0 / w), ends: [] });
      const pts = walk.map(k => [k % w, Math.floor(k / w)]); pts.push(pts[0]);
      edges.push({ pts, n0: id, n1: id, len: pts.length, size: comp.size, loop: true }); continue;
    }
    const a = bfs(start, inC).last; const { last: b, par } = bfs(a, inC);
    const path = []; for (let k = b; k !== -1; k = par.get(k)) path.push([k % w, Math.floor(k / w), k]);
    const endNode = p => { const k = p[2]; for (const d of N8) if (node[k + d]) return node[k + d]; for (const d of N8) for (const d2 of N8) { const j = k + d + d2; if (j >= 0 && j < w * h && node[j]) return node[j]; } return 0; };
    edges.push({ pts: path.map(p => [p[0], p[1]]), n0: endNode(path[0]), n1: endNode(path[path.length - 1]), len: path.length, size: comp.size });
  }
  // dead ends become their own nodes
  edges.forEach(e => { ['n0', 'n1'].forEach((k, s) => { if (!e[k]) { const p = s ? e.pts[e.pts.length - 1] : e.pts[0]; const id = nodes.length; nodes.push({ id, x: p[0], y: p[1], ends: [], dead: true }); e[k] = id; } }); });
  return { nodes, edges, sk };
}
function routeTrace(mask, w, h, tapX, tapY, bandW, opts = {}) {
  let { nodes, edges } = routeGraph(mask, w, h, bandW);
  const K = Math.max(8, Math.round(bandW * 1.3));
  const relink = () => { nodes.forEach(n => { if (n) n.ends = []; }); edges.forEach((e, ei) => { if (e.gone) return; nodes[e.n0].ends.push([ei, 0]); nodes[e.n1].ends.push([ei, 1]); }); };
  // drop short spurs (dead-end twigs from thinning) — repeat as they uncover
  for (let pass = 0; pass < 4; pass++) { relink(); let any = false; edges.forEach(e => { if (e.gone) return; const d0 = nodes[e.n0].dead, d1 = nodes[e.n1].dead; if ((d0 || d1) && !(d0 && d1) && e.len < bandW * 2.2 + 6) { e.gone = true; any = true; } if (d0 && d1 && e.len < bandW * 3) { e.gone = true; any = true; } }); if (!any) break; }
  relink();
  const dirAt = (e, side) => { const P = e.pts, n = P.length; const a = side ? P[n - 1] : P[0], b = side ? P[Math.max(0, n - 1 - K)] : P[Math.min(n - 1, K)]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  // bridge gaps: where one line is drawn over another, the lower line's centre stripe gets cut.
  // 1) two cut ends facing each other across a line (crossover bridge) → join them (best pairs first)
  const line = (a, b) => { const L = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))); const o = []; for (let i = 0; i <= L; i++) o.push([a[0] + (b[0] - a[0]) * i / L, a[1] + (b[1] - a[1]) * i / L]); return o; };
  const dead = nodes.filter(n => n && n.dead && n.ends.length === 1);
  const used = new Set(); const pairs = [];
  dead.forEach((a, i) => { const [ea, sa] = a.ends[0]; const da = dirAt(edges[ea], sa); const out = [-da[0], -da[1]];
    dead.forEach((b, j) => { if (j <= i) return; const [eb, sb] = b.ends[0]; if (eb === ea) return; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); if (l > bandW * 4 + 10 || l < 1) return;
      const db = dirAt(edges[eb], sb); const c1 = (out[0] * dx + out[1] * dy) / l, c2 = (db[0] * dx + db[1] * dy) / l; if (c1 < 0.45 || c2 < 0.45) return; pairs.push({ a, b, s: l * (2.1 - c1 - c2) }); }); });
  pairs.sort((p, q) => p.s - q.s).forEach(({ a, b }) => { if (used.has(a.id) || used.has(b.id)) return; used.add(a.id); used.add(b.id);
    const pts = line([a.x, a.y], [b.x, b.y]); edges.push({ pts, n0: a.id, n1: b.id, len: pts.length, bridge: true }); });
  // 2) a cut end that runs into another line (a merge drawn as two paths) → join it onto that line
  relink();
  dead.forEach(a => { if (used.has(a.id) || a.ends.length !== 1) return; const [ea, sa] = a.ends[0]; const da = dirAt(edges[ea], sa); const out = [-da[0], -da[1]];
    let best = null, bs = 1e9; const R = bandW * 2.2 + 6;
    edges.forEach((e, ei) => { if (e.gone || ei === ea || e.bridge) return; for (let k = 1; k < e.pts.length - 1; k++) { const q = e.pts[k], dx = q[0] - a.x, dy = q[1] - a.y, l = Math.hypot(dx, dy); if (l > R || l < 0.5) continue; const c = (out[0] * dx + out[1] * dy) / l; if (c < 0.25) continue; const sc = l / (c * c); if (sc < bs) { bs = sc; best = { ei, k }; } } }); // prefer joining straight ahead
    if (!best) return; used.add(a.id);
    const e = edges[best.ei], q = e.pts[best.k]; const id = nodes.length; nodes.push({ id, x: q[0], y: q[1], ends: [] });
    edges.push({ pts: e.pts.slice(best.k), n0: id, n1: e.n1, len: e.pts.length - best.k });
    e.pts = e.pts.slice(0, best.k + 1); e.n1 = id; e.len = e.pts.length;
    const ed = edges[ea], link = line([a.x, a.y], q);
    if (sa === 0) { ed.pts = link.slice().reverse().concat(ed.pts.slice(1)); ed.n0 = id; } else { ed.pts = ed.pts.concat(link.slice(1)); ed.n1 = id; }
    ed.len = ed.pts.length; a.ends = [];
  });
  relink();
  const live = edges.map((e, i) => i).filter(i => !edges[i].gone);
  if (!live.length) return null;
  const junctions = nodes.filter(n => n && n.ends.length >= 3).length;
  // start on the edge nearest the tap
  let se = -1, sd = 1e18; live.forEach(ei => { const e = edges[ei]; if (e.bridge) return; for (let k = 0; k < e.pts.length; k += 2) { const p = e.pts[k], d = (p[0] - tapX) ** 2 + (p[1] - tapY) ** 2; if (d < sd) { sd = d; se = ei; } } });
  if (se < 0) return null;
  // directed edge = [edge, dir] (dir 0: n0→n1). Walk until we are back on the start edge going the same way.
  // crossings (4 arms): pair the arms that run most nearly straight through each other
  const pairOf = new Map();
  nodes.forEach(n => { if (!n || n.ends.length !== 4) return; const E = n.ends, D = E.map(([ej, s]) => dirAt(edges[ej], s));
    const dd = (a, b) => D[a][0] * D[b][0] + D[a][1] * D[b][1];
    const P = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]].map(pp => ({ pp, s: dd(...pp[0]) + dd(...pp[1]) })).sort((a, b) => a.s - b.s)[0].pp;
    P.forEach(([a, b]) => { pairOf.set(E[a][0] * 2 + E[a][1], E[b]); pairOf.set(E[b][0] * 2 + E[b][1], E[a]); }); });
  const nextOpts = (ei, dir) => {
    const e = edges[ei]; const nodeId = dir ? e.n0 : e.n1; const arriveSide = dir ? 0 : 1;
    const pr = pairOf.get(ei * 2 + arriveSide); if (pr) return [{ ei: pr[0], dir: pr[1], dot: 1 }];
    const din = dirAt(e, arriveSide); const v = [-din[0], -din[1]];
    const c = nodes[nodeId].ends.filter(([ej, s]) => !(ej === ei && s === arriveSide)).map(([ej, s]) => { const d = dirAt(edges[ej], s); return { ei: ej, dir: s, dot: v[0] * d[0] + v[1] * d[1] }; });
    if (!c.length) return [];
    const best = Math.max(...c.map(o => o.dot));
    if (c.length === 1) return c; // nothing else to do here but carry on
    const fork = c.length === 2; // a Y: from the shared stem both branches are fair game
    return c.filter(o => fork ? o.dot > -0.1 && o.dot >= best - 0.6 : o.dot > 0.2 && o.dot >= best - 0.22).sort((a, b) => b.dot - a.dot);
  };
  // the edges that make up the drawing around the tapped spot (ignoring dead-end twigs)
  const target = new Set(); { const seenN = new Set([edges[se].n0, edges[se].n1]); const q = [...seenN];
    while (q.length) { const nId = q.pop(); nodes[nId].ends.forEach(([ej]) => { const e = edges[ej]; if (nodes[e.n0].ends.length > 1 && nodes[e.n1].ends.length > 1) target.add(ej); [e.n0, e.n1].forEach(m => { if (!seenN.has(m)) { seenN.add(m); q.push(m); } }); }); } }
  target.add(se);
  // Search for laps. A lap that drives every part of the drawing wins (a stretch may be driven twice,
  // e.g. a straight shared by both halves of a figure-8); otherwise the smoothest, longest loop.
  const cycles = [], full = []; let budget = 30000;
  const use = new Map(); const bump = (k, d) => use.set(k, (use.get(k) || 0) + d);
  const covered = () => { for (const ej of target) if (!use.get(ej * 2) && !use.get(ej * 2 + 1)) return false; return true; };
  const maxLen = target.size * 2 + 4;
  const dfs = (path, cost) => {
    if (budget-- < 0 || full.length > 6) return;
    const [ei, dir] = path[path.length - 1];
    for (const o of nextOpts(ei, dir)) {
      if (o.ei === se && o.dir === 0) {
        const c = { path: path.slice(), cost: cost + (1 - o.dot) };
        if (covered()) full.push(c); else if (!path.some(([e2, d2], i) => path.findIndex(([e3, d3]) => e3 === e2 && d3 === d2) !== i)) cycles.push(c);
        if (use.get(se * 2) >= 2) continue;
      }
      const key = o.ei * 2 + o.dir; if ((use.get(key) || 0) >= 2 || path.length > maxLen) continue;
      bump(key, 1); path.push([o.ei, o.dir]); dfs(path, cost + (1 - o.dot)); path.pop(); bump(key, -1);
    }
  };
  bump(se * 2, 1); dfs([[se, 0]], 0);
  const lenOf = c => c.path.reduce((s, [ei]) => s + edges[ei].len, 0);
  let pick, routes = 1;
  if (full.length) { full.sort((a, b) => lenOf(a) - lenOf(b)); pick = full[0]; } // shortest lap that covers everything
  else {
    if (!cycles.length) return null;
    const minCost = Math.min(...cycles.map(c => c.cost));
    cycles.sort((a, b) => ((a.cost > minCost + 0.35) - (b.cost > minCost + 0.35)) || (lenOf(b) - lenOf(a)));
    const sig = c => [...new Set(c.path.map(p => p[0]))].sort((a, b) => a - b).join(',');
    routes = [...new Set(cycles.map(sig))].length; pick = cycles[0];
  }
  const raw = []; pick.path.forEach(([ei, dir]) => { const P = dir ? edges[ei].pts.slice().reverse() : edges[ei].pts; P.forEach(p => raw.push(p)); });
  const clean = []; raw.forEach(p => { const q = clean[clean.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.5) clean.push(p); });
  if (clean.length < 20) return null;
  let per = 0; for (let i = 0; i < clean.length; i++) { const a = clean[i], b = clean[(i + 1) % clean.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const n = clamp(Math.round(per / 6), 60, 320);
  const pts = resampleLoop(smoothLoop(clean, 2), n);
  return { pts, width: bandW, count: per, junctions, routes };
}
function holeCount(comp, w, h, minFrac) {
  const { outside } = loopRegions(comp, w, h); const lab = new Uint8Array(w * h); let n = 0, total = 0;
  for (let i = 0; i < w * h; i++) if (!comp[i] && !outside[i]) total++;
  for (let i = 0; i < w * h; i++) { if (comp[i] || outside[i] || lab[i]) continue; const st = [i]; lab[i] = 1; let c = 0;
    while (st.length) { const k = st.pop(); c++; const x = k % w, y = (k - x) / w; for (const j of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1]) if (j >= 0 && !comp[j] && !outside[j] && !lab[j]) { lab[j] = 1; st.push(j); } }
    if (c > total * minFrac && c > 40) n++; }
  return n;
}

// white (light) lines enclosed by the track ink: light components that don't touch the image edge and are thin (not an infield)
function centreLines(data, w, h, bg, ink, comp) {
  let ir = 0, ig = 0, ib = 0, n = 0; for (let i = 0; i < w * h; i += 3) if (comp[i] && ink[i]) { ir += data[i * 4]; ig += data[i * 4 + 1]; ib += data[i * 4 + 2]; n++; }
  const light = new Uint8Array(w * h);
  if (n) { ir /= n; ig /= n; ib /= n; for (let i = 0; i < w * h; i++) { const r0 = data[i * 4], g0 = data[i * 4 + 1], b0 = data[i * 4 + 2]; const dB = (r0 - bg[0]) ** 2 + (g0 - bg[1]) ** 2 + (b0 - bg[2]) ** 2, dI = (r0 - ir) ** 2 + (g0 - ig) ** 2 + (b0 - ib) ** 2; if (dB < dI * 0.8) light[i] = 1; } }
  const lab = new Int32Array(w * h), mask = new Uint8Array(w * h); let id = 0, total = 0;
  for (let i = 0; i < w * h; i++) {
    if (!light[i] || lab[i]) continue; id++; const px = [i]; lab[i] = id; let edge = false, per = 0, near = 0;
    for (let k = 0; k < px.length; k++) { const p = px[k], x = p % w, y = (p - x) / w; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (comp[p]) near++;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]; let b = false;
      for (const j of nb) { if (j < 0) continue; if (light[j]) { if (!lab[j]) { lab[j] = id; px.push(j); } } else b = true; } if (b) per++; }
    if (edge || px.length < 12 || near < px.length * 0.5) continue;
    const thick = px.length / Math.max(1, per / 2);
    if (thick > 12) continue;
    px.forEach(p => mask[p] = 1); total += px.length;
  }
  return { mask, n: total };
}
