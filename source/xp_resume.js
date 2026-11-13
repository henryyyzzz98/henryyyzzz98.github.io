// ---------- Resume a race weekend after closing the tab ----------
// The season save (G) only covered the HQ. This file also checkpoints the current
// weekend (WK) and any live race / qualifying session, so Continue drops you back
// where you left off.
const WK_KEY = 'f1mgr_wk';
const WK_CLASSES = { Race: () => Race.prototype, QualiLive: () => QualiLive.prototype };
const WK_SKIP = new Set(['replay', 'pendingClips']); // big, rebuilt as the race goes on

function wkRefs() {
  const m = new Map(); if (!G) return m;
  m.set(G, { $g: 1 });
  Object.keys(G.drivers || {}).forEach(k => m.set(G.drivers[k], { $d: k }));
  Object.keys(G.teams || {}).forEach(k => m.set(G.teams[k], { $t: k }));
  return m;
}
function wkPack(root) {
  const refs = wkRefs(), seen = new Map(); let n = 0;
  const enc = v => {
    if (typeof v === 'number') return isFinite(v) ? v : { $n: String(v) };
    if (v === null || typeof v !== 'object') return (typeof v === 'function' || v === undefined) ? undefined : v;
    if (refs.has(v)) return refs.get(v);
    if (seen.has(v)) return { $r: seen.get(v) };
    if (typeof Node !== 'undefined' && v instanceof Node) return undefined;
    const id = n++; seen.set(v, id);
    if (Array.isArray(v)) return { $i: id, $a: v.map(x => { const y = enc(x); return y === undefined ? null : y; }) };
    if (v instanceof Set) return { $i: id, $s: [...v].map(enc) };
    if (v instanceof Map) return { $i: id, $m: [...v].map(([a, b]) => [enc(a), enc(b)]) };
    if (ArrayBuffer.isView(v)) return { $i: id, $ta: v.constructor.name, $a: Array.from(v) };
    const o = { $i: id }; const p = Object.getPrototypeOf(v);
    for (const c in WK_CLASSES) if (p === WK_CLASSES[c]()) o.$c = c;
    for (const k of Object.keys(v)) { if (WK_SKIP.has(k)) continue; const y = enc(v[k]); if (y !== undefined) o[k.startsWith('$') ? '$' + k : k] = y; }
    return o;
  };
  return enc(root);
}
function wkUnpack(data) {
  const reg = [];
  const dec = v => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(dec);
    if ('$n' in v) return Number(v.$n);
    if ('$g' in v) return G;
    if ('$d' in v) return G.drivers[v.$d];
    if ('$t' in v) return G.teams[v.$t];
    if ('$r' in v) return reg[v.$r];
    if ('$s' in v) { const s = new Set(); reg[v.$i] = s; v.$s.forEach(x => s.add(dec(x))); return s; }
    if ('$m' in v) { const m = new Map(); reg[v.$i] = m; v.$m.forEach(([a, b]) => m.set(dec(a), dec(b))); return m; }
    if ('$ta' in v) { const C = window[v.$ta] || Float64Array; const a = new C(v.$a); reg[v.$i] = a; return a; }
    if ('$a' in v) { const a = []; reg[v.$i] = a; v.$a.forEach(x => a.push(dec(x))); return a; }
    const o = v.$c && WK_CLASSES[v.$c] ? Object.create(WK_CLASSES[v.$c]()) : {};
    reg[v.$i] = o;
    for (const k of Object.keys(v)) { if (k === '$i' || k === '$c') continue; o[k.startsWith('$$') ? k.slice(1) : k] = dec(v[k]); }
    return o;
  };
  return dec(data);
}

function wkCheckpoint() {
  if (!G || VIEW !== 'weekend' || !WK) return;
  try {
    if (!G.wkTag) G.wkTag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const live = RACE && (WK.stage === 'race' || WK.stage === 'sprint');
    const pack = wkPack({ wk: WK, race: live ? RACE : null });
    save(G);
    localStorage.setItem(WK_KEY, JSON.stringify({ tag: G.wkTag, year: G.year, round: WK.round, data: pack }));
  } catch (e) { /* storage full: weekend just won't resume */ }
}
function wkClear() { try { localStorage.removeItem(WK_KEY); } catch (e) { } if (G) G.wkTag = null; }
function wkSaved() { try { const s = JSON.parse(localStorage.getItem(WK_KEY)); return s && G && s.tag && s.tag === G.wkTag ? s : null; } catch (e) { return null; } }

function wkRestore() {
  const s = wkSaved(); if (!s) return false;
  try {
    const out = wkUnpack(s.data);
    WK = out.wk; RACE = out.race || null;
    if ((WK.stage === 'race' || WK.stage === 'sprint') && !RACE) WK.stage = WK.stage === 'sprint' ? 'sgrid' : 'grid';
    if (RACE) { RACE.replay = []; RACE.pendingClips = []; if (RACE.started) { LIGHTS = null; PAUSED = true; } else { LIGHTS = null; PAUSED = false; } }
    const Q = (WK.stage === 'quali' || WK.stage === 'squali') && curQS().live; if (Q && !Q.done) PAUSED = true;
    VIEW = 'weekend'; return true;
  } catch (e) { WK = null; RACE = null; wkClear(); return false; }
}

// New weekend gets a fresh tag, so an old checkpoint is never loaded into the wrong round.
const _xr_startWeekend = startWeekend;
startWeekend = function () { G.wkTag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); _xr_startWeekend(); };

// Checkpoint on every weekend screen change; clear it once you are back at HQ.
const _xr_render = render;
render = function () {
  _xr_render();
  if (VIEW === 'weekend') wkCheckpoint();
};
const _xr_tohq = A.tohq;
A.tohq = function () { wkClear(); if (G) save(G); _xr_tohq.apply(this, arguments); };

// During a live race or quali session, checkpoint every few seconds and when the app is hidden.
setInterval(() => { if (VIEW === 'weekend' && !document.hidden) wkCheckpoint(); }, 4000);
document.addEventListener('visibilitychange', () => { if (document.hidden) wkCheckpoint(); });
window.addEventListener('pagehide', wkCheckpoint);

// Continue → straight back into the weekend if one was in progress.
const _xr_continue = A.continue;
A.continue = function () {
  _xr_continue();
  if (wkRestore()) {
    render(); window.scrollTo(0, 0);
    const live = RACE && RACE.started && !RACE.done;
    toast(live ? `Back at ${WK.track.short} — race paused on lap ${Math.min(RACE.leaderLap + 1, RACE.laps)}` : `Back at the ${WK.track.short} weekend`);
  }
};
const _xr_endseason = A.endseason;
A.endseason = function () { wkClear(); WK = null; RACE = null; _xr_endseason.apply(this, arguments); };
