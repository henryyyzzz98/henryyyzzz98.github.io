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
