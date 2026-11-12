// ===== TRACK STUDIO & TRACER UI =====
let TR = null, STUDIO_BACK = 'title', STUDIO_FILT = 'all';
function viewStudio() {
  const list = TRACKS.filter(t => STUDIO_FILT === 'all' || (STUDIO_FILT === 'cur' ? t.era === 'current' : STUDIO_FILT === 'custom' ? t.era === 'custom' : STUDIO_FILT === 'traced' ? !!(LIB.layouts[t.id] || layoutVersions(t.id).length) : (t.era !== 'current' && t.era !== 'custom')));
  return `<div class="wrap"><div class="row"><span class="logo">PIT<b>WALL</b></span><h2 style="margin:0 0 0 8px" class="sp">Track Studio</h2><button data-a="studioback">Back</button></div>
  <div class="card" style="margin-top:12px"><div class="small">Tap 🔁 Laps to change any circuit's race length. Pick a circuit and tap ✏️ to trace its layout from an image (a track map screenshot works best). You can also create brand-new circuits. Layouts are saved in this browser and travel with your save code.</div>
  <div class="row" style="margin-top:8px"><button class="pri" data-a="newcircuit" data-back="studio">+ New circuit</button></div></div>
  <div class="card" style="margin-top:12px"><div class="row" style="margin-bottom:8px">${[['all', 'All'], ['cur', '2026'], ['hist', 'Historic'], ['custom', 'Custom'], ['traced', 'Traced']].map(([k, v]) => `<button class="sm ${STUDIO_FILT === k ? 'on' : ''}" data-a="studiofilt" data-v="${k}">${v}</button>`).join('')}</div>
  ${list.map(t => `<div class="cal-item">${trackSVG(t, 44)} <span class="sp">${flag(t.cc)} <b>${esc(t.short)}</b><div class="mut small">${esc(t.name)} · ${t.km.toFixed(3)} km · <b class="${LIB.laps && LIB.laps[t.id] ? 'warn' : ''}">${t.laps} laps</b> · ${t.era === 'current' ? '2026' : t.era}${LIB.layouts[t.id] ? ' · <span class="good">traced</span>' : t.origPts ? '' : ' · <span class="warn">placeholder shape</span>'}${layoutVersions(t.id).length ? ` · <span class="good">${layoutVersions(t.id).length} dated version${layoutVersions(t.id).length > 1 ? 's' : ''}</span>` : ''}</div></span>
  <button class="sm" data-a="laps" data-v="${t.id}">🔁 Laps</button><button class="sm" data-a="trace" data-v="${t.id}" data-back="studio">✏️ Trace</button>${t.era === 'custom' ? `<button class="sm" data-a="delcircuit" data-v="${t.id}">🗑</button>` : ''}</div>`).join('') || '<div class="mut">Nothing here yet.</div>'}</div></div>`;
}
function editorPts(t) {
  if (!t.pts) return [];
  const g = trackGeometry(t); return g.P.filter((_, i) => i % 40 === 0).map(p => [p[0] * 900 + 50, p[1] * 900 + 50]);
}
function openTracer(id, back, ver) {
  const t = TRACK_BY_ID[id];
  ver = ver === undefined ? -1 : ver;
  let src = t, from = null, to = null;
  if (ver !== -1 && ver !== 'new') { const v = layoutVersions(id)[ver]; src = Object.assign({}, t, { pts: v.pts, geoKey: id + '@edit' + Date.now() }); from = v.from; to = v.to; }
  const pts = editorPts(src);
  const hasShape = pts.length >= 3;
  TR = { id, back, ver, from, to, img: TR && TR.id === id ? TR.img : null, proc: TR && TR.id === id ? TR.proc : null, pts, mode: hasShape ? 'adjust' : 'draw', tol: 60, fresh: !hasShape,
    msg: hasShape ? 'Upload a track image to trace it, or drag the points to adjust this layout.' : 'Upload a track image, or tap points around the track in order to draw it.', undo: [] };
  if (TR.img && !hasShape) TR.mode = 'auto';
  VIEW = 'tracer'; render(); window.scrollTo(0, 0);
}
function versionSection(t) {
  const vs = layoutVersions(t.id);
  const real = (typeof HIST !== 'undefined' && HIST.layouts && HIST.layouts[t.id]) || [];
  const chips = [`<button class="sm ${TR.ver === -1 ? 'on' : ''}" data-a="trver" data-v="-1">Default</button>`]
    .concat(vs.map((v, k) => `<button class="sm ${TR.ver === k ? 'on' : ''}" data-a="trver" data-v="${k}">${v.from}–${v.to}</button>`))
    .concat([`<button class="sm ${TR.ver === 'new' ? 'on' : ''}" data-a="trver" data-v="new">+ New version</button>`]).join('');
  const editingVersion = TR.ver !== -1;
  return `<h3>Layout version</h3><div class="small mut" style="margin-bottom:6px">Circuits change over the years. Give a layout a year range and races in those years use it; any other year uses the default.</div>
  <div class="row">${chips}</div>
  ${editingVersion ? `<div class="row" style="margin-top:8px"><span class="small">Used from</span><input id="tfrom" type="number" min="1900" max="2200" value="${TR.from ?? ''}" style="width:84px"><span class="small">to</span><input id="tto" type="number" min="1900" max="2200" value="${TR.to ?? ''}" style="width:84px">${TR.ver !== 'new' ? '<button class="sm" data-a="trdelver">🗑 Delete version</button>' : ''}</div>` : `<div class="small mut" style="margin-top:6px">Editing the default layout${vs.length ? ` (used outside ${vs.map(v => v.from + '–' + v.to).join(', ')})` : ' (used for every year)'}.</div>`}
  ${real.length ? `<div class="small mut" style="margin-top:8px">Real layouts at this circuit${editingVersion ? ' — tap one to use its years' : ''}:</div><div class="row" style="margin-top:4px">${real.map(r => `<button class="sm" ${editingVersion ? `data-a="trrealyrs" data-from="${r[1]}" data-to="${r[2]}"` : 'disabled'}>${r[1] === r[2] ? r[1] : r[1] + '–' + r[2]} · ${(+r[3]).toFixed(3)} km</button>`).join('')}</div>` : ''}`;
}
function viewTracer() {
  const t = TRACK_BY_ID[TR.id];
  const modes = [['auto', '🪄 Auto-trace'], ['draw', '➕ Add points'], ['adjust', '✋ Drag points'], ['erase', '🧽 Remove points']];
  return `<div class="wrap"><div class="row"><h2 class="sp" style="margin:0">✏️ ${flag(t.cc)} ${esc(t.name)}${TR.ver !== -1 ? ` <span class="pill" style="background:#a8822e">${TR.ver === 'new' ? 'new version' : (TR.from + '–' + TR.to)}</span>` : ''}</h2><button data-a="tracerback">Cancel</button><button class="pri" data-a="tracersave" ${TR.pts.length >= 4 ? '' : 'disabled'}>Save layout</button></div>
  <div class="grid g2" style="margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
  <div><div class="cvbox" style="background:#11141b"><canvas id="tcv" style="touch-action:none"></canvas></div>
  <div class="small ${TR.err ? 'bad' : 'mut'}" id="tmsg" style="margin-top:6px">${esc(TR.msg)}</div></div>
  <div class="card">${versionSection(t)}<h3 style="margin-top:12px">1 · Image</h3><label class="row"><input type="file" id="timg" accept="image/*,.svg" style="max-width:100%"></label>
  ${TR.img ? `<div class="row" style="margin-top:6px"><span class="small mut">Image opacity</span><input type="range" id="topac" min="0" max="100" value="${TR.opac ?? 70}"></div>` : ''}
  <h3 style="margin-top:12px">2 · Shape</h3><div class="row">${modes.map(([k, v]) => `<button class="sm ${TR.mode === k ? 'on' : ''}" data-a="trmode" data-v="${k}" ${k === 'auto' && !TR.img ? 'disabled' : ''}>${v}</button>`).join('')}</div>
  <div class="small mut" style="margin-top:6px">${({ auto: 'Tap anywhere on the track in the image. Works with solid lines, outlined tracks (like a black outline with a white centre line) and coloured maps — the tracer finds both edges of the track and follows the middle.', draw: TR.fresh ? 'Tap around the track in driving order. The loop closes itself.' : 'Tap near the line between two points to add a point there.', adjust: 'Drag any point to fine-tune the shape.', erase: 'Tap a point to remove it.' })[TR.mode]}</div>
  ${TR.mode === 'auto' ? `<div class="row" style="margin-top:6px"><span class="small mut" style="width:110px">Ink sensitivity</span><input type="range" id="ttol" min="15" max="160" value="${TR.tol}"><b id="ttolv" class="small">${TR.tol}</b></div>
  <div class="row"><span class="small mut" style="width:110px">Gap filling</span><input type="range" id="tgap" min="0" max="10" value="${TR.gap ?? 4}"><b id="tgapv" class="small">${TR.gap ?? 4}</b></div>
  <div class="small mut">If the line comes out wrong, tap again after nudging these: lower ink sensitivity picks up fainter lines; more gap filling joins broken or double outlines.</div>` : ''}
  <div class="row" style="margin-top:8px"><button class="sm" data-a="trundo" ${TR.undo.length ? '' : 'disabled'}>↶ Undo</button><button class="sm" data-a="trclear">Clear</button><button class="sm" data-a="trsimplify" ${TR.pts.length > 12 ? '' : 'disabled'}>Simplify</button></div>
  <h3 style="margin-top:12px">3 · Start line & direction</h3><div class="small mut">The green dot is the start/finish line; the arrow shows racing direction.</div>
  <div class="row" style="margin-top:6px"><button class="sm" data-a="trstart" data-v="-1">◀ Move start</button><button class="sm" data-a="trstart" data-v="1">Move start ▶</button><button class="sm" data-a="trrev">⇄ Reverse direction</button></div>
  <h3 style="margin-top:12px">4 · Race length</h3><div class="row"><span class="small">${t.laps} laps · ${(t.laps * t.km).toFixed(1)} km${LIB.laps && LIB.laps[t.id] ? ' <span class="warn">(custom)</span>' : ''}</span><button class="sm" data-a="laps" data-v="${t.id}">Change laps</button></div>
  <h3 style="margin-top:12px">Preview</h3><div class="row"><div id="tprev"></div><div class="small mut sp">${TR.pts.length} points${LIB.layouts[TR.id] ? '<br>Currently using a traced layout.' : ''}</div></div>
  ${LIB.layouts[TR.id] && TR.ver === -1 ? '<button class="sm" style="margin-top:6px" data-a="trreset">Restore original default layout</button>' : ''}</div></div></div>`;
}
function trPush() { TR.undo.push(JSON.stringify(TR.pts)); if (TR.undo.length > 40) TR.undo.shift(); }
function trFit() {
  if (!TR.img) return null; const iw = TR.iw || TR.img.naturalWidth, ih = TR.ih || TR.img.naturalHeight; const s = 1000 / Math.max(iw, ih);
  return { s, ox: (1000 - iw * s) / 2, oy: (1000 - ih * s) / 2, iw, ih };
}
function trSpline(pts, seg = 10) {
  const out = [], N = pts.length; if (N < 3) return pts.slice();
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    for (let j = 0; j < seg; j++) { const s = j / seg, s2 = s * s, s3 = s2 * s; out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3))); }
  }
  return out;
}
function drawTracer() {
  const cv = document.getElementById('tcv'); if (!cv) return;
  const ctx = cv.getContext('2d'); const w = cv._w, dpr = cv._dpr; const k = w / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, w);
  // grid
  ctx.strokeStyle = '#1b2030'; ctx.lineWidth = 1; for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(i * w / 10, 0); ctx.lineTo(i * w / 10, w); ctx.moveTo(0, i * w / 10); ctx.lineTo(w, i * w / 10); ctx.stroke(); }
  const f = trFit();
  if (f) { ctx.globalAlpha = (TR.opac ?? 70) / 100; ctx.fillStyle = '#fff'; ctx.fillRect(f.ox * k, f.oy * k, f.iw * f.s * k, f.ih * f.s * k); ctx.drawImage(TR.img, f.ox * k, f.oy * k, f.iw * f.s * k, f.ih * f.s * k); ctx.globalAlpha = 1; }
  const P = TR.pts;
  if (P.length >= 3) {
    const sp = trSpline(P); ctx.beginPath(); sp.forEach((p, i) => i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)); ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 3.5; ctx.stroke();
  } else if (P.length === 2) { ctx.beginPath(); ctx.moveTo(P[0][0] * k, P[0][1] * k); ctx.lineTo(P[1][0] * k, P[1][1] * k); ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 3; ctx.stroke(); }
  const many = P.length > 90, editing = TR.mode === 'adjust' || TR.mode === 'erase' || TR.mode === 'draw';
  P.forEach((p, i) => { if (i && (!editing && many)) return; ctx.beginPath(); ctx.arc(p[0] * k, p[1] * k, i === 0 ? 7 : many ? 2.6 : (editing ? 6 : 4), 0, 6.283); ctx.fillStyle = i === 0 ? '#2ecc71' : many ? 'rgba(255,255,255,.85)' : '#fff'; ctx.fill(); if (!many || i === 0) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke(); } });
  if (many && P.length >= 3) { const sp = trSpline(P); ctx.beginPath(); sp.forEach((p, i) => i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)); ctx.closePath(); ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 2; ctx.stroke(); }
  if (P.length >= 2) { // direction arrow
    const a = P[0], b = P[1]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const x = a[0] * k + Math.cos(ang) * 22, y = a[1] * k + Math.sin(ang) * 22;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fillStyle = '#2ecc71'; ctx.fill(); ctx.restore();
  }
  const pv = document.getElementById('tprev');
  if (pv) {
    if (P.length >= 3) { const sp = trSpline(P, 6); let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9; sp.forEach(([x, y]) => { mnx = Math.min(mnx, x); mny = Math.min(mny, y); mxx = Math.max(mxx, x); mxy = Math.max(mxy, y); }); const sc = 80 / Math.max(mxx - mnx, mxy - mny, 1);
      pv.innerHTML = `<svg width="90" height="90" viewBox="0 0 90 90"><polygon points="${sp.map(([x, y]) => ((x - mnx) * sc + 5).toFixed(1) + ',' + ((y - mny) * sc + 5).toFixed(1)).join(' ')}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="${((P[0][0] - mnx) * sc + 5).toFixed(1)}" cy="${((P[0][1] - mny) * sc + 5).toFixed(1)}" r="4" fill="#2ecc71"/></svg>`; }
    else pv.innerHTML = '<div class="mut small">—</div>';
  }
}
function trMsg(s, err) { TR.msg = s; TR.err = !!err; const m = document.getElementById('tmsg'); if (m) { m.textContent = s; m.className = 'small ' + (err ? 'bad' : 'mut'); } }
function initTracer() {
  const cv = document.getElementById('tcv'); if (!cv) return;
  const w = Math.min(cv.parentElement.clientWidth, 700); const dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = w * dpr; cv.style.width = w + 'px'; cv.style.height = w + 'px'; cv._w = w; cv._dpr = dpr;
  drawTracer();
  const toBoard = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1000, (e.clientY - r.top) / r.height * 1000]; };
  const nearest = (p, maxD) => { let bi = -1, bd = maxD; TR.pts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
  let drag = -1;
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); const p = toBoard(e);
    if (TR.mode === 'auto') return autoTraceAt(p);
    if (TR.mode === 'draw') {
      trPush();
      if (TR.fresh || TR.pts.length < 3) TR.pts.push(p);
      else { // insert into nearest segment
        let bi = 0, bd = 1e9; const N = TR.pts.length;
        for (let i = 0; i < N; i++) { const a = TR.pts[i], b = TR.pts[(i + 1) % N]; const dx = b[0] - a[0], dy = b[1] - a[1]; const tt = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1); const d = Math.hypot(a[0] + dx * tt - p[0], a[1] + dy * tt - p[1]); if (d < bd) { bd = d; bi = i; } }
        TR.pts.splice(bi + 1, 0, p);
      }
      refreshTracerSide(); return;
    }
    if (TR.mode === 'adjust') { drag = nearest(p, 45); if (drag >= 0) { trPush(); cv.setPointerCapture(e.pointerId); } return; }
    if (TR.mode === 'erase') { const i = nearest(p, 45); if (i >= 0 && TR.pts.length > 3) { trPush(); TR.pts.splice(i, 1); refreshTracerSide(); } }
  });
  cv.addEventListener('pointermove', e => { if (drag < 0) return; TR.pts[drag] = toBoard(e).map(v => clamp(v, 0, 1000)); drawTracer(); });
  const end = () => { if (drag >= 0) { drag = -1; refreshTracerSide(); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const fi = document.getElementById('timg');
  if (fi) fi.addEventListener('change', () => {
    const file = fi.files && fi.files[0]; if (!file) return;
    const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
    const useImage = (src, iw, ih) => { const img = new Image(); img.onload = () => {
      iw = iw || img.naturalWidth; ih = ih || img.naturalHeight;
      if (!iw || !ih) return trMsg('Could not read the size of that image.', true);
      TR.img = img; TR.iw = iw; TR.ih = ih;
      const ps = Math.min(isSvg ? 4 : 1, 800 / Math.max(iw, ih));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(iw * ps)); c.height = Math.max(1, Math.round(ih * ps));
      const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
      TR.proc = { data: cx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, ps };
      TR.mode = 'auto'; TR.msg = 'Image loaded. Now tap anywhere on the track.'; TR.err = false; render();
    }; img.onerror = () => trMsg('Could not read that image.', true); img.src = src; };
    const rd = new FileReader();
    if (isSvg) {
      rd.onload = () => {
        try {
          const doc = new DOMParser().parseFromString(rd.result, 'image/svg+xml'); const svg = doc.documentElement;
          if (!svg || svg.nodeName.toLowerCase() !== 'svg') return trMsg('That SVG file could not be read.', true);
          const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
          let w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
          if (/%/.test(svg.getAttribute('width') || '')) w = NaN; if (/%/.test(svg.getAttribute('height') || '')) h = NaN;
          if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { if (!(w > 0) || !(h > 0)) { const sc = 1600 / Math.max(vb[2], vb[3]); w = vb[2] * sc; h = vb[3] * sc; } }
          if (!(w > 0) || !(h > 0)) { w = 1000; h = 1000; }
          const sc = 1600 / Math.max(w, h); w *= sc; h *= sc; // render large and crisp
          svg.setAttribute('width', w); svg.setAttribute('height', h);
          if (!svg.getAttribute('viewBox') && vb.length !== 4) svg.setAttribute('viewBox', `0 0 ${w / sc} ${h / sc}`);
          const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
          const fr = new FileReader(); fr.onload = () => useImage(fr.result, Math.round(w), Math.round(h)); fr.readAsDataURL(blob);
        } catch (e) { trMsg('That SVG file could not be read.', true); }
      };
      rd.readAsText(file);
    } else { rd.onload = () => useImage(rd.result); rd.readAsDataURL(file); }
  });
  const gp = document.getElementById('tgap'); if (gp) gp.addEventListener('input', () => { TR.gap = +gp.value; document.getElementById('tgapv').textContent = gp.value; });
  const tol = document.getElementById('ttol'); if (tol) tol.addEventListener('input', () => { TR.tol = +tol.value; document.getElementById('ttolv').textContent = tol.value; });
  const op = document.getElementById('topac'); if (op) op.addEventListener('input', () => { TR.opac = +op.value; drawTracer(); });
}
function refreshTracerSide() { const y = window.scrollY; render(); window.scrollTo(0, y); }
function autoTraceAt(p) {
  const f = trFit(); if (!f || !TR.proc) return;
  const ix = (p[0] - f.ox) / f.s, iy = (p[1] - f.oy) / f.s;
  if (ix < 0 || iy < 0 || ix >= f.iw || iy >= f.ih) return trMsg('Tap inside the image.', true);
  trMsg('Tracing…');
  setTimeout(() => {
    const pr = TR.proc; const res = traceBand(pr.data, pr.w, pr.h, ix * pr.ps, iy * pr.ps, TR.tol, TR.gap ?? 4);
    if (res.err) return trMsg(res.err, true);
    trPush();
    TR.pts = res.pts.map(q => [q[0] / pr.ps * f.s + f.ox, q[1] / pr.ps * f.s + f.oy]);
    TR.fresh = false; TR.mode = 'adjust';
    TR.msg = `Traced ${TR.pts.length} points (${res.method || 'line'} mode). Check the red line follows the track, then set the start line and direction. Drag points to fix any spots, e.g. where a pit lane joins.`; TR.err = false;
    refreshTracerSide();
  }, 20);
}
Object.assign(A, {
  studio() { STUDIO_BACK = VIEW === 'hq' ? 'hq' : 'title'; VIEW = 'studio'; render(); window.scrollTo(0, 0); },
  studioback() { VIEW = STUDIO_BACK; render(); },
  studiofilt(el) { STUDIO_FILT = el.dataset.v; render(); },
  trace(el) { openTracer(el.dataset.v, el.dataset.back || 'studio'); },
  tracerback() { VIEW = TR.back; TR = null; render(); },
  trmode(el) { TR.mode = el.dataset.v; if (TR.mode === 'draw' && TR.pts.length === 0) TR.fresh = true; refreshTracerSide(); },
  trundo() { if (!TR.undo.length) return; TR.pts = JSON.parse(TR.undo.pop()); refreshTracerSide(); },
  trclear() { trPush(); TR.pts = []; TR.fresh = true; TR.mode = TR.img ? 'auto' : 'draw'; refreshTracerSide(); },
  trsimplify() { trPush(); TR.pts = resampleLoop(TR.pts, Math.max(8, Math.round(TR.pts.length * 0.7))); refreshTracerSide(); },
  trstart(el) { if (TR.pts.length < 3) return; trPush(); const d = +el.dataset.v; if (d > 0) TR.pts.push(TR.pts.shift()); else TR.pts.unshift(TR.pts.pop()); refreshTracerSide(); },
  trrev() { if (TR.pts.length < 3) return; trPush(); const f = TR.pts[0]; TR.pts = [f].concat(TR.pts.slice(1).reverse()); refreshTracerSide(); },
  trreset() { delete LIB.layouts[TR.id]; clearGeo(); saveLib(); applyLib(); if (G) autosave(); toast('Original layout restored'); openTracer(TR.id, TR.back); },
  tracersave() {
    if (TR.pts.length < 4) return;
    const pts = TR.pts.map(p => [+(p[0] / 10).toFixed(2), +(p[1] / 10).toFixed(2)]);
    const name = TRACK_BY_ID[TR.id].short;
    if (TR.ver === -1) LIB.layouts[TR.id] = pts;
    else {
      const f = parseInt((document.getElementById('tfrom') || {}).value), t = parseInt((document.getElementById('tto') || {}).value);
      if (!f || !t || f > t) return trMsg('Set a valid year range first (from ≤ to).', true);
      LIB.sets = LIB.sets || {}; const vs = LIB.sets[TR.id] = LIB.sets[TR.id] || [];
      const v = { from: f, to: t, pts };
      if (TR.ver === 'new') vs.push(v); else vs[TR.ver] = v;
      vs.sort((a, b) => a.from - b.from);
    }
    saveLib(); applyLib(); clearGeo(); if (G) autosave();
    toast(TR.ver === -1 ? 'Default layout saved for ' + name : `${name} layout saved for ${(document.getElementById('tfrom') || {}).value}–${(document.getElementById('tto') || {}).value}`); VIEW = TR.back; TR = null; render();
  },
  trver(el) { const v = el.dataset.v; const ver = v === 'new' ? 'new' : +v;
    if (ver === 'new') { const keep = TR.pts.slice(); const real = (HIST.layouts && HIST.layouts[TR.id]) || []; const used = layoutVersions(TR.id);
      const sug = real.find(r => !used.some(u => u.from === r[1] && u.to === r[2]));
      openTracer(TR.id, TR.back, 'new'); TR.pts = keep; TR.fresh = keep.length < 3; TR.mode = keep.length >= 3 ? 'adjust' : (TR.img ? 'auto' : 'draw');
      TR.from = sug ? sug[1] : 1950; TR.to = sug ? sug[2] : new Date().getFullYear();
      TR.msg = 'New version: set its years, then trace or adjust the shape. It starts as a copy of the layout you were viewing.'; render(); }
    else openTracer(TR.id, TR.back, ver); },
  trrealyrs(el) { const f = document.getElementById('tfrom'), t = document.getElementById('tto'); if (f) f.value = el.dataset.from; if (t) t.value = el.dataset.to; TR.from = +el.dataset.from; TR.to = +el.dataset.to; refreshTracerSide(); },
  trdelver() { const vs = layoutVersions(TR.id); vs.splice(TR.ver, 1); saveLib(); applyLib(); clearGeo(); if (G) autosave(); toast('Version deleted'); openTracer(TR.id, TR.back, -1); },
  newcircuit(el) {
    const back = el.dataset.back || 'studio';
    modal(`<div class="row"><h2 class="sp">New circuit</h2><button class="sm" data-a="close">✕</button></div>
    <div class="grid" style="gap:8px"><label>Circuit name<input id="nc_name" style="width:100%" placeholder="e.g. Marina Bay Night Loop"></label>
    <label>Grand Prix name<input id="nc_short" style="width:100%" placeholder="e.g. Singapore"></label>
    <div class="row"><label class="sp">Country<select id="nc_cc" style="width:100%">${Object.keys(FLAGS).sort().map(c => `<option value="${c}" ${c === 'SG' ? 'selected' : ''}>${FLAGS[c]} ${c}</option>`).join('')}</select></label>
    <label>Lap length (km)<input id="nc_km" type="number" step="0.001" min="1" max="30" value="5.000" style="width:110px"></label></div>
    <div class="row"><label class="sp">Character<select id="nc_type" style="width:100%">${Object.entries(TRACK_TYPES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
    <label>Rain chance %<input id="nc_rain" type="number" min="0" max="100" value="20" style="width:90px"></label></div>
    <label>Race laps <span class="mut small">(leave blank for a standard ~305 km race)</span><input id="nc_laps" type="number" min="1" max="200" placeholder="auto" style="width:110px;display:block"></label>
    <button class="pri" data-a="createcircuit" data-back="${back}">Create & trace layout →</button></div>`);
  },
  createcircuit(el) {
    const v = id => document.getElementById(id).value.trim();
    const name = v('nc_name'); if (!name) return toast('Give it a name');
    const c = { id: 'c' + Date.now().toString(36), name, short: v('nc_short') || name, cc: v('nc_cc'), km: clamp(parseFloat(v('nc_km')) || 5, 1, 30), type: v('nc_type'), rain: clamp(parseInt(v('nc_rain')) || 0, 0, 100) };
    const nl = parseInt(v('nc_laps')); if (nl > 0) { LIB.laps = LIB.laps || {}; LIB.laps[c.id] = clamp(nl, 1, 200); }
    LIB.custom.push(c); saveLib(); applyLib(); if (G) autosave(); closeModal();
    openTracer(c.id, el.dataset.back);
    TR.pts = []; TR.fresh = true; TR.mode = 'draw'; TR.msg = 'Upload an image of the layout to auto-trace it, or tap points around the track in order.'; render();
  },
  laps(el) {
    const t = TRACK_BY_ID[el.dataset.v]; const custom = LIB.laps && LIB.laps[t.id];
    modal(`<div class="row"><h2 class="sp">🔁 ${flag(t.cc)} ${esc(t.short)}</h2><button class="sm" data-a="close">✕</button></div>
    <div class="mut small">${esc(t.name)} · ${t.km.toFixed(3)} km per lap · standard length ${t.origLaps} laps</div>
    <div class="row" style="margin:12px 0"><button data-a="lapstep" data-v="-5">−5</button><button data-a="lapstep" data-v="-1">−1</button>
    <input id="lp_n" type="number" min="1" max="200" value="${t.laps}" style="width:80px;text-align:center;font-size:20px;font-weight:700"><button data-a="lapstep" data-v="1">+1</button><button data-a="lapstep" data-v="5">+5</button></div>
    <div class="small" id="lp_info"></div>
    <div class="row" style="margin-top:6px">${[['Sprint-ish', 100], ['Half race', 150], ['Full race', 305], ['Endurance', 600]].map(([n, km]) => `<button class="sm" data-a="lapset" data-v="${Math.max(1, Math.round(km / t.km))}">${n} (${Math.max(1, Math.round(km / t.km))})</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="pri" data-a="lapsave" data-v="${t.id}">Save</button>${custom ? `<button data-a="lapreset" data-v="${t.id}">Reset to ${t.origLaps}</button>` : ''}</div>
    <div class="small mut" style="margin-top:8px">Applies to the Grand Prix from the next race weekend on. Sprints stay ~100 km. Long races mean more pit stops and more time for chaos.</div>`);
    const inp = document.getElementById('lp_n'); const upd = () => { const n = clamp(parseInt(inp.value) || 1, 1, 200); document.getElementById('lp_info').textContent = `${n} laps = ${(n * t.km).toFixed(1)} km race distance`; };
    inp.addEventListener('input', upd); upd(); A._lapUpd = upd;
  },
  lapstep(el) { const i = document.getElementById('lp_n'); i.value = clamp((parseInt(i.value) || 1) + +el.dataset.v, 1, 200); A._lapUpd && A._lapUpd(); },
  lapset(el) { const i = document.getElementById('lp_n'); i.value = clamp(+el.dataset.v, 1, 200); A._lapUpd && A._lapUpd(); },
  lapsave(el) {
    const id = el.dataset.v, t = TRACK_BY_ID[id]; const n = clamp(parseInt(document.getElementById('lp_n').value) || t.origLaps, 1, 200);
    LIB.laps = LIB.laps || {}; if (n === t.origLaps) delete LIB.laps[id]; else LIB.laps[id] = n;
    saveLib(); applyLib(); if (G) autosave(); closeModal(); toast(`${t.short}: ${n} laps`); refreshAfterLaps();
  },
  lapreset(el) { const id = el.dataset.v; if (LIB.laps) delete LIB.laps[id]; saveLib(); applyLib(); if (G) autosave(); closeModal(); toast('Reset to standard length'); refreshAfterLaps(); },
  delcircuit(el) {
    const id = el.dataset.v; if (LIB.sets) delete LIB.sets[id];
    if (G && (G.cal.includes(id) || (G.calNext || []).includes(id))) return toast('Remove it from your calendar first');
    LIB.custom = LIB.custom.filter(c => c.id !== id); delete LIB.layouts[id]; if (LIB.laps) delete LIB.laps[id];
    const i = TRACKS.findIndex(t => t.id === id); if (i >= 0) TRACKS.splice(i, 1); delete TRACK_BY_ID[id];
    saveLib(); toast('Circuit deleted'); render();
  }
});

function refreshAfterLaps() { if (VIEW === 'tracer') refreshTracerSide(); else { const y = window.scrollY; render(); window.scrollTo(0, y); } }
