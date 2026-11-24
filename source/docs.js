// ===================== Official-style weekend documents =====================
// Entry List, practice classifications, provisional/final qualifying classifications and
// provisional/final starting grids, each published at the matching point of the weekend with a
// document number, date and time on a realistic weekend timetable. Data is snapshotted at release.
// (Layout follows the real timing sheets; no logos or real officials' names are reproduced.)
const ISO3 = { GB: 'GBR', AU: 'AUS', NL: 'NED', DE: 'GER', FR: 'FRA', IT: 'ITA', ES: 'ESP', MC: 'MON', MX: 'MEX', CA: 'CAN', FI: 'FIN', DK: 'DEN', TH: 'THA', JP: 'JPN', CN: 'CHN', US: 'USA', BR: 'BRA', AR: 'ARG', NZ: 'NZL', BE: 'BEL', AT: 'AUT', CH: 'SUI', SE: 'SWE', NO: 'NOR', PL: 'POL', RU: 'RUS', IN: 'IND', ZA: 'RSA', PT: 'POR', IE: 'IRL', CO: 'COL', VE: 'VEN', CL: 'CHI', UY: 'URU', MY: 'MAS', ID: 'INA', HU: 'HUN', CZ: 'CZE', LI: 'LIE', MA: 'MAR', RH: 'RHO', ZW: 'ZIM', SG: 'SGP', BH: 'BRN', SA: 'KSA', AE: 'UAE', QA: 'QAT', AZ: 'AZE', TR: 'TUR', KR: 'KOR', VN: 'VIE', PE: 'PER', EE: 'EST', IL: 'ISR', KE: 'KEN', GR: 'GRE', LU: 'LUX', SK: 'SVK', SI: 'SLO', HR: 'CRO', RO: 'ROU', UA: 'UKR' };
const nat3 = cc => ISO3[String(cc || '').toUpperCase()] || String(cc || '').toUpperCase().slice(0, 3);
const DOC_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// real 2026 calendar race dates (Sundays, Saturdays for Baku and Las Vegas)
const DOC_DATES_2026 = { aus: '03-08', chn: '03-15', jpn: '03-29', bhr: '04-12', sau: '04-19', mia: '05-03', can: '05-24', mon: '06-07', bcn: '06-14', aut: '06-28', gbr: '07-05', bel: '07-19', hun: '07-26', ned: '08-23', ita: '09-06', mad: '09-13', aze: '09-26', sgp: '10-11', usa: '10-25', mex: '11-01', bra: '11-08', lvg: '11-21', qat: '11-29', abu: '12-06' };
function docRaceDate(wk) {
  const t = wk.track;
  if (t.date && /^\d{4}-\d\d-\d\d$/.test(t.date)) return new Date(t.date + 'T12:00:00Z');
  const md = DOC_DATES_2026[t.id];
  if (md) { const d = new Date(G.year + '-' + md + 'T12:00:00Z'); if (G.year !== 2026) { const want = md === '09-26' || md === '11-21' ? 6 : 0; while (d.getUTCDay() !== want) d.setUTCDate(d.getUTCDate() + 1); } return d; }
  const d = new Date(G.year + '-03-01T12:00:00Z'); while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 14 * wk.round); return d;
}
const docDay = (wk, k) => { const d = new Date(docRaceDate(wk)); d.setUTCDate(d.getUTCDate() - (2 - k)); return d; }; // k: 0 Fri, 1 Sat, 2 Sun
const docDateStr = d => String(d.getUTCDate()).padStart(2, '0') + ' ' + DOC_MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
const docHM = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(Math.round(m) % 60).padStart(2, '0');
const docHMS = s => docHM(Math.floor(s / 60)) + ':' + String(Math.floor(s) % 60).padStart(2, '0');
function docLap(t) { if (t == null || !isFinite(t)) return ''; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + s.toFixed(3).padStart(6, '0'); }
const docKmh = (km, t) => t ? (km * 3600 / t).toFixed(3) : '';
// weekend timetable (minutes after midnight, local time) — [day, start, length]
function docSched(wk) {
  return wk.sprint
    ? { fp: [[0, 750, 60]], sq: [0, 990, 44], sprint: [1, 720, 60], q: [1, 960, 60], race: [2, 840] }
    : { fp: [[0, 750, 60], [0, 960, 60], [1, 750, 60]], q: [1, 960, 60], race: [2, 840] };
}
function docName(nm) { const p = String(nm).split(' '); return p.length < 2 ? nm.toUpperCase() : p[0] + ' ' + p.slice(1).join(' ').toUpperCase(); }
function docCons(e) {
  const t = e.t, car = typeof hxCar === 'function' ? hxCar(G, t.id) : null;
  const en0 = (typeof ENGINES !== 'undefined' && t.engine && ENGINES[t.engine]) ? ENGINES[t.engine].name : '';
  if (en0) return en0 === t.name ? t.name : `${t.name} ${en0}`;
  let src = car && car[1] ? String(car[1]).split(' / ')[0] : (typeof dkEngine === 'function' ? String(dkEngine(t) || '') : '');
  const words = []; for (const w of src.split(' ')) { if (/\d/.test(w) || !w) break; words.push(w); }
  const mk = words.join(' ');
  if (mk) { const a = mk.toLowerCase(), b = t.name.toLowerCase(); return b.includes(a) || a.includes(b) || b.startsWith(a.split(' ')[0]) ? t.name : `${t.name} ${mk}`; }
  const en = (typeof ENGINES !== 'undefined' && ENGINES[t.engine]) ? ENGINES[t.engine].name : '';
  return t.works || !en || t.name.includes(en) ? t.name : `${t.name} ${en}`;
}
function docEnt(e, i) { return { id: e.d.id, no: e.d.num != null ? e.d.num : i + 1, code: e.d.code, name: e.d.name, nat: e.d.nat, team: e.t.full || e.t.name, cons: docCons(e), color: e.t.color }; }

const DOCV = { key: null, set: null };
// ---------- release ----------
function docState() {
  if (!WK.docs) {
    const r = docRaceDate(WK);
    WK.docs = { list: [], next: 1, seen: 0, event: dkGpName(G, WK.round, WK.track), year: G.year, km: WK.track.km, circuit: WK.track.name, cc: WK.track.cc,
      dates: (() => { const a = docDay(WK, 0), b = docDay(WK, 2); return (a.getUTCMonth() === b.getUTCMonth() ? String(a.getUTCDate()).padStart(2, '0') : docDateStr(a).replace(/ \d{4}$/, '')) + ' - ' + docDateStr(b); })(),
      ents: WK.entries.map(docEnt), round: WK.round, short: WK.track.short };
  }
  return WK.docs;
}
function docAdd(key, title, desc, day, min, body) {
  const S = docState(); if (S.list.some(d => d.key === key)) return;
  const last = S.list[S.list.length - 1]; // keep the timeline in order: never earlier than the previous document
  if (last && (day < last.day || (day === last.day && min <= last.min))) { day = last.day; min = last.min + rint(3, 8); }
  const doc = { key, no: S.next, title, desc, day, min, date: docDateStr(docDay(WK, day)), time: docHM(min), body };
  S.list.push(doc); S.next++;
  docToast(doc);
}
const docEntOf = id => ((DOCV && DOCV.set) || docState()).ents.find(x => x.id === id);
function docFP(i) {
  const rows = WK.fp[i]; if (!rows) return; const sc = docSched(WK).fp[i] || [0, 750, 60];
  const best = rows[0] && rows[0].t;
  const body = { kind: 'fp', session: i, rows: rows.map((r, k) => ({ id: r.e.d.id, t: r.t, laps: r.laps, tod: (sc[1] + rnd(8, sc[2] - 2)) * 60 + rint(0, 59), gap: k ? r.t - best : null, int: k ? r.t - rows[k - 1].t : null })) };
  const end = sc[1] + sc[2];
  docAdd('fp' + i, `Free Practice ${i + 1} Classification`, 'Timing Sheet', sc[0], end + rint(12, 22), body);
}
function docQRows(QS, sprint) {
  const sc = sprint ? docSched(WK).sq : docSched(WK).q, segs = QS.rounds.length, segLen = sc[2] / Math.max(1, segs);
  const per = new Map(), grp = !sprint && G.rules && G.rules.quali === 'groups';
  QS.rounds.forEach((r, k) => r.res.forEach(x => { const o = per.get(x.e.d.id) || { id: x.e.d.id, seg: [] };
    // group lottery qualifying: exactly 3 timed laps each (fewer if the car crashed); otherwise a normal Q1/Q2/Q3 run plan
    const laps = grp ? (x.crash ? rint(0, 5) : 6) : k === segs - 1 && segs > 1 ? rint(3, 5) : rint(6, 12);
    o.seg[k] = { t: x.crash ? null : x.t, laps: grp ? laps : x.crash ? rint(1, 4) : laps, tod: (sc[1] + k * segLen + rnd(segLen * 0.35, segLen * 0.95)) * 60 + rint(0, 59) }; per.set(x.e.d.id, o); }));
  const order = (sprint ? WK.sgrid : WK.grid) || [];
  return { segs, grp, labels: grp ? ['GROUP A', 'GROUP B', 'GROUP C'] : segs === 1 ? ['TIME'] : ['Q1', 'Q2', 'Q3'], cuts: grp ? [] : QS.rounds.slice(1).map(r => r.res.length), rows: order.map(e => per.get(e.d.id) || { id: e.d.id, seg: [] }) };
}
function docQuali(sprint, final) {
  const QS = sprint ? WK.SQ : WK.Q; if (!QS || !QS.rounds.length) return;
  const sc = sprint ? docSched(WK).sq : docSched(WK).q, nm = sprint ? 'Sprint Qualifying' : 'Qualifying';
  const key = (sprint ? 'sq' : 'q') + (final ? 'F' : 'P');
  const prov = docState().list.find(d => d.key === (sprint ? 'sqP' : 'qP'));
  const body = prov ? { kind: 'quali', sprint, final, ref: prov.key } : Object.assign({ kind: 'quali', sprint, final }, docQRows(QS, sprint));
  const end = sc[1] + sc[2];
  docAdd(key, `${final ? 'Final' : 'Provisional'} ${nm} Classification`, 'Timing Sheet', sc[0], end + (final ? rint(110, 150) : rint(3, 9)), body);
}
function docGrid(sprint, final) {
  const grid = (sprint ? WK.sgrid : WK.grid); if (!grid || !grid.length) return;
  const QS = sprint ? WK.SQ : WK.Q, qt = new Map();
  ((QS && QS.rounds) || []).forEach(r => r.res.forEach(x => { if (x.t != null && !x.crash) qt.set(x.e.d.id, x.t); }));
  const pens = sprint ? [] : (WK.penalties || []).map(p => ({ code: p.code, n: p.n, why: p.why }));
  const penCodes = new Set(pens.map(p => p.code));
  const body = { kind: 'grid', sprint, final, rows: grid.map(e => ({ id: e.d.id, t: qt.get(e.d.id), pen: penCodes.has(e.d.code) })), pens };
  const S = docSched(WK), day = sprint ? S.sprint[0] : S.race[0], start = sprint ? S.sprint[1] : S.race[1];
  const qs = sprint ? S.sq : S.q;
  const min = final ? start - 60 - rint(0, 5) * 0 : qs[1] + qs[2] + rint(125, 160);
  docAdd((sprint ? 'sg' : 'g') + (final ? 'F' : 'P'), `${final ? 'Final' : 'Provisional'} ${sprint ? 'Sprint ' : ''}Starting Grid`, `${final ? 'Final' : 'Provisional'} ${sprint ? 'Sprint ' : ''}Starting Grid`, final ? day : qs[0], min, body);
}
// ---------- race classifications ----------
function docHMSms(t) { if (t == null || !isFinite(t)) return ''; const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t - h * 3600 - m * 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + s.toFixed(3).padStart(6, '0'); }
const lapsTxt = n => n + (n === 1 ? ' LAP' : ' LAPS');
function docRaceData(s) {
  const R = RACE && RACE.wk === WK && !RACE.sprint ? RACE : null, km = WK.track.km;
  const liveOf = id => R ? R.cars.find(c => c.d.id === id) : null;
  const fastOf = id => { const c = liveOf(id); if (!c || !c.cross) return null; let b = null; for (let k = 1; k < c.cross.length; k++) { if (c.cross[k] == null || c.cross[k - 1] == null) continue; const lt = c.cross[k] - c.cross[k - 1]; if (!b || lt < b.t) b = { t: lt, on: k }; } return b; };
  const pens = [];
  if (R) R.cars.forEach(c => { if (c.penalty > 0) pens.push({ id: c.d.id, sec: c.penalty, why: c.penWhy || 'Did not use two different dry tyre compounds' }); });
  const penOf = id => pens.filter(p => p.id === id).reduce((a, p) => a + p.sec, 0);
  const fin = s.rows.filter(r => !r.out).sort((a, b) => a.pos - b.pos);
  const mk = rows => { const lead = rows[0]; return rows.map((r, i) => { const prev = rows[i - 1], f = r.best != null ? { t: r.best, on: (fastOf(r.id) || {}).on } : fastOf(r.id);
    const gap = !i ? '' : r.laps < lead.laps ? lapsTxt(lead.laps - r.laps) : (r.time - lead.time).toFixed(3);
    const int = !i ? '' : r.laps < prev.laps ? lapsTxt(prev.laps - r.laps) : (r.time - prev.time).toFixed(3);
    return { id: r.id, laps: r.laps, time: r.time, gap, int, kmh: r.time ? (r.laps * km * 3600 / r.time).toFixed(3) : '', fast: f ? f.t : null, on: f && f.on, pts: r.pts || 0, pen: penOf(r.id) > 0 }; }); };
  const finalRows = mk(fin);
  // provisional: before the stewards' time penalties were applied
  const provSrc = fin.map(r => Object.assign({}, r, { time: r.time != null ? r.time - penOf(r.id) : r.time })).sort((a, b) => b.laps - a.laps || a.time - b.time);
  const provRows = mk(provSrc).map(x => Object.assign(x, { pen: false }));
  const nc = s.rows.filter(r => r.out).sort((a, b) => b.laps - a.laps).map(r => { const c = liveOf(r.id), f = fastOf(r.id), t = c && c.cross && c.cross[r.laps];
    return { id: r.id, laps: r.laps || 0, time: r.laps ? t : null, why: !r.laps ? 'DNS' : /disq/i.test(r.out || '') ? 'DSQ' : 'DNF', kmh: r.laps && t ? (r.laps * km * 3600 / t).toFixed(3) : '', fast: f ? f.t : null, on: f && f.on }; });
  let fl = null; [...finalRows, ...nc].forEach(r => { if (r.fast != null && (!fl || r.fast < fl.t)) fl = { id: r.id, t: r.fast, on: r.on }; });
  if (s.fastest && (!fl || s.fastest.t < fl.t - 1e-6)) { const e = WK.entries.find(e => e.d.code === s.fastest.code); if (e) fl = { id: e.d.id, t: s.fastest.t, on: null }; }
  const lapsDone = fin.length ? fin[0].laps : 0;
  return { lapsDone, dist: (lapsDone * km).toFixed(3), finalRows, provRows, nc, fl, pens: pens.map(p => ({ code: (WK.entries.find(e => e.d.id === p.id) || { d: {} }).d.code, sec: p.sec, why: p.why })), leadT: fin.length ? fin[0].time : 0 };
}
function docRace(s) {
  if (docState().list.some(d => d.key === 'rF')) return;
  const D = docRaceData(s), S = docSched(WK), end = S.race[1] + Math.round((D.leadT || 5400) / 60);
  docAdd('rP', 'Provisional Race Classification', 'Timing Sheet', S.race[0], end + rint(4, 9), { kind: 'race', final: false, data: D });
  docAdd('rF', 'Final Race Classification', 'Timing Sheet', S.race[0], end + rint(150, 190), { kind: 'race', final: true, ref: 'rP' });
  docAdd('champ', 'Championship Points', 'Championship Points', S.race[0], end + rint(155, 200), { kind: 'champ', upto: WK.round + 1 });
}
// ---------- championship points ----------
function docChampData(upto) {
  upto = upto || G.results.length;
  const rounds = G.cal.map((id, i) => { const t = typeof roundTrack === 'function' ? roundTrack(G, i) : TRACK_BY_ID[id]; return { cc: t ? t.cc : '', code: nat3(t ? t.cc : '') }; });
  const res = G.results.filter(r => r.year === G.year && r.round <= upto), byRound = new Map(res.map(r => [r.round - 1, r]));
  const tot = (pick) => res.reduce((a, r) => a + r.rows.filter(pick).reduce((b, x) => b + (x.pts || 0), 0) + (r.sprint || []).filter(pick).reduce((b, x) => b + (x.pts || 0), 0), 0);
  const cell = (r, pick) => { if (!r) return null; const rows = r.rows.filter(pick); if (!rows.length) return null;
    const sp = (r.sprint || []).filter(pick).reduce((a, x) => a + (x.pts || 0), 0);
    return { pts: rows.reduce((a, x) => a + (x.pts || 0), 0) + sp, pos: rows.map(x => x.out ? 'NC' : x.pos).sort((a, b) => (a === 'NC') - (b === 'NC') || a - b) }; };
  const ids = new Set(); res.forEach(r => r.rows.forEach(x => ids.add(x.id))); Object.values(G.drivers).forEach(d => { if (d.team) ids.add(d.id); });
  const drivers = [...ids].map(id => G.drivers[id]).filter(Boolean).map(d => ({ name: d.name, pts: tot(x => x.id === d.id), cells: rounds.map((_, i) => cell(byRound.get(i), x => x.id === d.id)) }))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  const teams = Object.values(G.teams).filter(t => res.some(r => r.rows.some(x => x.team === t.id)) || Object.values(G.drivers).some(d => d.team === t.id))
    .map(t => ({ name: t.full || t.name, pts: tot(x => x.team === t.id), cells: rounds.map((_, i) => cell(byRound.get(i), x => x.team === t.id)) })).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  return { rounds, drivers, teams, done: res.length };
}
const DOC_ORDER = ['fp', 'pot', 'squali', 'sgrid', 'sprint', 'sresults', 'quali', 'grid', 'race', 'hbreak', 'gbreak', 'results'];
const docAt = st => { const i = DOC_ORDER.indexOf(WK.stage); return i >= 0 && i >= DOC_ORDER.indexOf(st); };
function docsSync() {
  if (!G || !WK || !WK.entries) return;
  const S = docState();
  // archive: every weekend's documents stay browsable for the rest of the season
  if (!G.docArch || G.docArch.year !== G.year) G.docArch = { year: G.year, sets: {} };
  if (S.round == null) { S.round = WK.round; S.short = WK.track.short; }
  G.docArch.sets[WK.round] = S;
  if (!S.list.some(d => d.key === 'entry')) docAdd('entry', 'Entry List', 'Entry List', 0, 630, { kind: 'entry' });
  (WK.fp || []).forEach((_, i) => docFP(i));
  if (WK.sprint) {
    if (WK.SQ && WK.SQ.stage > 3 && WK.sgrid) docQuali(true, false);
    if (docAt('sgrid') && WK.SQ && WK.SQ.stage > 3) { docQuali(true, true); docGrid(true, false); }
    if (docAt('sprint') && (RACE && RACE.sprint || docAt('sresults'))) docGrid(true, true);
  }
  if (WK.Q && WK.Q.stage > 3 && WK.grid) docQuali(false, false);
  if (docAt('grid') && WK.Q && WK.Q.stage > 3) { docQuali(false, true); docGrid(false, false); }
  if ((WK.stage === 'race' || docAt('race')) && RACE && !RACE.sprint || docAt('results')) docGrid(false, true);
  if (docAt('results') && WK.stage === 'results') { const s = G.results[G.results.length - 1]; if (s && s.round === WK.round + 1 && s.year === G.year) docRace(s); }
  docTab();
}

// ---------- notification + edge tab ----------
function docToast(doc) {
  let el = document.getElementById('doc-toast');
  if (!el) { el = document.createElement('div'); el.id = 'doc-toast'; document.body.appendChild(el); }
  const now = Date.now(); docToast.n = el.className === 'show' && now - (docToast.at || 0) < 1500 && doc.no > 1 && docToast.wk === WK ? (docToast.n || 1) + 1 : 1; docToast.wk = WK; docToast.at = now;
  el.innerHTML = `<span>📄 ${docToast.n > 1 ? `${docToast.n} documents published · latest: Document ${doc.no}` : `Document ${doc.no} published`}</span><b>${esc(doc.title)}</b><button data-a="docopen" data-v="${doc.key}">Read</button><button class="sm" data-a="doctoastx" aria-label="Dismiss">✕</button>`;
  el.className = 'show'; clearTimeout(docToast.t); docToast.t = setTimeout(() => { el.className = ''; }, 6000);
}
function docTab() {
  let el = document.getElementById('doc-tab');
  const n = WK && WK.docs ? WK.docs.list.length : 0, any = docSets().length;
  if (!G || !any) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('button'); el.id = 'doc-tab'; el.dataset.a = 'docopen'; document.body.appendChild(el); }
  const unread = n ? n - (WK.docs.seen || 0) : 0;
  el.innerHTML = `📄 FIA DOCS${unread > 0 ? `<i>${unread}</i>` : ''}`;
}
// global click handler for elements living outside #app (tab, toast)
document.addEventListener('click', ev => {
  const b = ev.target.closest('#doc-tab, #doc-toast [data-a]'); if (!b || !b.dataset.a) return;
  ev.stopPropagation(); A[b.dataset.a] && A[b.dataset.a](b);
}, true);

// ---------- rendering the papers ----------
function docHeadTable(doc, D) {
  return `<div class="fd-ev"><h1>${esc(D.year + ' ' + D.event).toUpperCase()}</h1><h2>${esc(D.dates)}</h2></div>
  <table class="fd-meta"><tr><td><b>From</b></td><td>The Stewards</td><td><b>Document</b></td><td>${doc.no}</td></tr>
  <tr><td><b>To</b></td><td>All Teams, All Officials</td><td><b>Date</b></td><td>${doc.date}</td></tr>
  <tr><td></td><td></td><td><b>Time</b></td><td>${doc.time}</td></tr></table>`;
}
function docBrand() { return `<div class="fd-brand"><span class="fd-emb">WC</span><span class="fd-champ">FORMULA 1 WORLD CHAMPIONSHIP</span><span class="fd-chq"></span></div>`; }
function docSigs() { return `<div class="fd-sigs"><b>The Stewards</b></div>`; }
function docCover(doc, D) {
  const file = `${nat3(D.cc)} DOC ${doc.no} - ${doc.title}.pdf`;
  return `<div class="fd-page">${docBrand()}${docHeadTable(doc, D)}
  <table class="fd-tt"><tr><td><b>Title</b></td><td>${esc(doc.title)}</td></tr><tr><td><b>Description</b></td><td>${esc(doc.desc)}</td></tr><tr><td><b>Enclosed</b></td><td>${esc(file)}</td></tr></table>${docSigs()}</div>`;
}
function docSheetHead(doc, D, sub) {
  return `<div class="fd-sh"><div class="fd-brand2"><span class="fd-emb">WC</span><span>Formula 1<br>World Championship</span></div><div class="fd-stamp">Doc ${doc.no} Time ${doc.time}</div></div>
  <div class="fd-bar">FORMULA 1 ${esc(D.event).toUpperCase()} ${D.year} - ${esc(D.circuit)}</div><div class="fd-sub">${esc(sub)}</div>`;
}
const docFlag = cc => typeof dkFlag === 'function' ? dkFlag(cc) : '';
function docPaper(doc) {
  const D = DOCV.set || WK.docs, raw = doc.body;
  let B = raw;
  if (raw.ref) { const src = D.list.find(d => d.key === raw.ref); B = src ? Object.assign({}, src.body, { final: raw.final }) : raw; }
  if (B.kind === 'champ' && !B.data) B = Object.assign({}, B, { data: docChampData(B.upto) });
  const E = id => docEntOf(id) || { no: '', name: id, nat: '', team: '', cons: '', code: '' };
  const foot = `<div class="fd-foot">Simulated in PitWall — timing produced by the game for this weekend.</div>`;
  let sheet = '';
  if (B.kind === 'entry') {
    sheet = `<div class="fd-page">${docBrand()}${docHeadTable(doc, D)}<table class="fd-tab fd-entry"><thead><tr><th>No.</th><th>TLA</th><th>Driver</th><th>Nat</th><th>Team</th><th>Constructor</th></tr></thead><tbody>
    ${D.ents.map(x => `<tr><td>${x.no}</td><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${nat3(x.nat)}</td><td>${esc(x.team)}</td><td>${esc(x.cons)}</td></tr>`).join('')}</tbody></table>${docSigs()}</div>`;
  } else if (B.kind === 'fp') {
    const ord = ['First', 'Second', 'Third'][B.session] || 'Practice';
    sheet = `<div class="fd-page">${docSheetHead(doc, D, `${B.label || ord + ' Practice Session'} Classification`)}<table class="fd-tab fd-time"><thead><tr><th></th><th>NO</th><th class="l">DRIVER</th><th>NAT</th><th class="l">ENTRANT</th><th>TIME</th><th>LAPS</th><th>GAP</th><th>INT</th><th>KM/H</th><th>TIME OF DAY</th></tr></thead><tbody>
    ${B.rows.map((r, i) => { const x = E(r.id); return `<tr><td>${i + 1}</td><td><b>${x.no}</b></td><td class="l"><b>${esc(docName(x.name))}</b></td><td>${docFlag(x.nat)}</td><td class="l">${esc(x.team)}</td><td><b>${docLap(r.t)}</b></td><td><b>${r.laps}</b></td><td>${r.gap != null ? r.gap.toFixed(3) : ''}</td><td>${r.int != null ? r.int.toFixed(3) : ''}</td><td>${docKmh(D.km, r.t)}</td><td>${docHMS(r.tod)}</td></tr>`; }).join('')}</tbody></table>${foot}</div>`;
  } else if (B.kind === 'quali') {
    const segs = B.segs, cutAt = new Set(B.cuts.map(n => n)); let pole = null, fl = null;
    B.rows.forEach(r => r.seg.forEach(s => { if (s && s.t != null && (!fl || s.t < fl.t)) fl = { id: r.id, t: s.t }; }));
    const p0 = B.rows[0]; if (p0) { const s = [...p0.seg].reverse().find(s => s && s.t != null); if (s) pole = { id: p0.id, t: s.t }; }
    const segCells = r => Array.from({ length: segs }, (_, k) => { const s = r.seg[k]; return s ? `<td class="fd-q">${docLap(s.t)}</td><td>${s.laps}</td><td>${docHMS(s.tod)}</td>` : '<td class="fd-q"></td><td></td><td></td>'; }).join('');
    const nm = B.sprint ? 'Sprint Qualifying' : 'Qualifying';
    sheet = `<div class="fd-page fd-wide">${docSheetHead(doc, D, `${nm} Session ${B.final ? 'Final' : 'Provisional'} Classification`)}<table class="fd-tab fd-time fd-qt"><thead><tr><th></th><th>NO</th><th class="l">DRIVER</th><th>NAT</th><th class="l">ENTRANT</th>${B.labels.slice(0, segs).map(l => `<th class="fd-q">${l}</th><th>${B.grp ? 'TIMED LAPS' : 'LAPS'}</th><th>TIME</th>`).join('')}</tr></thead><tbody>
    ${B.rows.map((r, i) => { const x = E(r.id); return `<tr class="${cutAt.has(i + 1) ? 'fd-cut' : ''}"><td>${i + 1}</td><td><b>${x.no}</b></td><td class="l"><b>${esc(docName(x.name))}</b></td><td>${docFlag(x.nat)}</td><td class="l">${esc(x.team)}</td>${segCells(r)}</tr>`; }).join('')}</tbody></table>
    ${pole ? `<div class="fd-pl"><h4>POLE POSITION LAP</h4><div><b>${E(pole.id).no}</b> <b>${esc(docName(E(pole.id).name))}</b> ${docFlag(E(pole.id).nat)} ${esc(E(pole.id).team)}<span>${docLap(pole.t)}</span><span>${docKmh(D.km, pole.t)} KM/H</span></div></div>` : ''}
    ${fl ? `<div class="fd-pl"><h4>FASTEST LAP</h4><div><b>${E(fl.id).no}</b> <b>${esc(docName(E(fl.id).name))}</b> ${docFlag(E(fl.id).nat)} ${esc(E(fl.id).team)}<span>${docLap(fl.t)}</span><span>${docKmh(D.km, fl.t)} KM/H</span></div></div>` : ''}
    ${B.final ? `<div class="fd-sigs fd-sigs2"><b>The Stewards</b></div>` : `<div class="fd-sigs fd-sigs2"><b>Clerk of the Course</b></div>`}${foot}</div>`;
  } else if (B.kind === 'grid') {
    const cell = (r, i) => { const x = E(r.id); return `<div class="fd-slot ${i % 2 ? 'even' : 'odd'}"><span class="fd-gp">${i + 1}</span><div class="fd-gi"><div><b>${x.no}</b> <b>${esc(docName(x.name))}${r.pen ? ' *' : ''}</b><span>${docLap(r.t)}</span></div><div class="fd-gt">${esc(x.team)}</div></div></div>`; };
    const right = B.rows.map((r, i) => i % 2 ? '' : cell(r, i)).join(''), left = B.rows.map((r, i) => i % 2 ? cell(r, i) : '').join('');
    const pl = B.pens.map(p => { const x = D.ents.find(z => z.code === p.code); return `<div>Car ${x ? x.no : p.code} - ${p.n} place grid penalty - ${esc(p.why)}</div>`; }).join('');
    sheet = `<div class="fd-page">${docSheetHead(doc, D, `${B.final ? 'Final' : 'Provisional'} ${B.sprint ? 'Sprint ' : ''}Starting Grid`)}<div class="fd-grid"><div class="fd-col l">${left}</div><div class="fd-col r">${right}</div></div>
    ${pl ? `<div class="fd-pens"><h4>* PENALTIES</h4>${pl}</div>` : ''}${B.final ? docSigs() : ''}${foot}</div>`;
  }
  if (B.kind === 'race') {
    const R = B.data, rows = B.final ? R.finalRows : R.provRows, ttl = `${B.label || 'Race'} ${B.final ? 'Final' : 'Provisional'} Classification after ${R.lapsDone} Laps - ${R.dist} km`;
    const tr = (r, i) => { const x = E(r.id); return `<tr><td>${i + 1}</td><td><b>${x.no}</b></td><td class="l"><b>${esc(docName(x.name))}${r.pen ? ' *' : ''}</b></td><td>${docFlag(x.nat)}</td><td class="l">${esc(x.team)}</td><td>${r.laps}</td><td>${docHMSms(r.time)}</td><td>${r.gap}</td><td>${r.int}</td><td>${r.kmh}</td><td>${docLap(r.fast)}</td><td>${r.on || ''}</td><td>${r.pts || ''}</td></tr>`; };
    const ncr = r => { const x = E(r.id); return `<tr><td></td><td><b>${x.no}</b></td><td class="l"><b>${esc(docName(x.name))}</b></td><td>${docFlag(x.nat)}</td><td class="l">${esc(x.team)}</td><td>${r.laps}</td><td>${docHMSms(r.time)}</td><td>${r.why}</td><td></td><td>${r.kmh}</td><td>${docLap(r.fast)}</td><td>${r.on || ''}</td><td></td></tr>`; };
    const head = '<thead><tr><th></th><th>NO</th><th class="l">DRIVER</th><th>NAT</th><th class="l">ENTRANT</th><th>LAPS</th><th>TIME</th><th>GAP</th><th>INT</th><th>KM/H</th><th>FASTEST</th><th>ON</th><th>PTS</th></tr></thead>';
    const fl = R.fl ? E(R.fl.id) : null;
    const pl = B.final ? R.pens.map(p => { const x = D.ents.find(z => z.code === p.code); return `<div>Car ${x ? x.no : p.code} - ${p.sec} second time penalty - ${esc(p.why)}</div>`; }).join('') : '';
    return docCover(doc, D) + `<div class="fd-page fd-wide">${docSheetHead(doc, D, ttl)}<table class="fd-tab fd-time fd-rt">${head}<tbody>${rows.map(tr).join('')}</tbody></table>
    ${R.nc.length ? `<h4 class="fd-h4">NOT CLASSIFIED</h4><table class="fd-tab fd-time fd-rt fd-nc">${head.replace(/<th[^>]*>[^<]*<\/th>/g, '<th></th>').replace('<thead>', '<thead class="fd-hide">')}<tbody>${R.nc.map(ncr).join('')}</tbody></table>` : ''}
    ${fl ? `<h4 class="fd-h4">FASTEST LAP</h4><div class="fd-fl"><b>${fl.no}</b> <b>${esc(docName(fl.name))}</b> ${docFlag(fl.nat)} ${esc(fl.team)}<span>${docLap(R.fl.t)}</span>${R.fl.on ? `<span>on lap ${R.fl.on}</span>` : ''}<span>${docKmh(D.km, R.fl.t)}</span></div>` : ''}
    ${pl ? `<div class="fd-pens"><h4>* PENALTIES</h4>${pl}</div>` : ''}
    <div class="fd-sigs fd-sigs2"><b>${B.final ? 'The Stewards' : 'Clerk of the Course'}</b></div>${foot}</div>`;
  }
  if (B.kind === 'champ') {
    const C = B.data, short = nm => { const p = String(nm).split(' '); return p.length < 2 ? nm.toUpperCase() : p[0][0] + '. ' + p.slice(1).join(' ').toUpperCase(); };
    const hdr = lab => `<thead><tr><th></th><th class="l">${lab}</th><th>TOTAL</th>${C.rounds.map(r => `<th class="fd-rc">${docFlag(r.cc)}<br>${r.code}</th>`).join('')}</tr></thead>`;
    const cells = row => row.cells.map(c => `<td class="fd-cc">${c ? `<span class="p">${c.pts || ''}</span>${c.pos.map(p => `<span class="q">${p}</span>`).join('')}` : ''}</td>`).join('');
    const pg = (sub, lab, list, nm) => `<div class="fd-page fd-land">${docSheetHead(doc, D, sub)}<table class="fd-tab fd-champ">${hdr(lab)}<tbody>${list.map((x, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(nm(x.name))}</b></td><td><b>${x.pts}</b></td>${cells(x)}</tr>`).join('')}</tbody></table><div class="fd-sigs fd-sigs2"><b>The Stewards</b></div>${foot}</div>`;
    return docCover(doc, D) + pg("Drivers' Championship", 'DRIVER', C.drivers, short) + pg("Constructors' Championship", 'ENTRANT', C.teams, n => n);
  }
  return docCover(doc, D) + sheet;
}
function docSets() { return G && G.docArch && G.docArch.year === G.year ? Object.values(G.docArch.sets).sort((a, b) => a.round - b.round) : (WK && WK.docs ? [WK.docs] : []); }
function docModal() {
  const sets = docSets(); if (!DOCV.set || !sets.includes(DOCV.set)) DOCV.set = (WK && WK.docs) || sets[sets.length - 1];
  const S = DOCV.set, list = S.list.slice().sort((a, b) => a.no - b.no), cur = list.find(d => d.key === DOCV.key) || list[list.length - 1];
  if (WK && S === WK.docs) S.seen = list.length; docTab();
  const picker = sets.length > 1 ? `<select class="doc-rd">${sets.map(x => `<option value="${x.round}" ${x === S ? 'selected' : ''}>R${x.round + 1} · ${esc(x.short || x.event)}${WK && x === WK.docs ? ' (this weekend)' : ''} · ${x.list.length} docs</option>`).join('')}</select>` : '';
  return `<div class="dkx-mod doc-mod"><div class="dkx-hd"><div><h2>Official documents</h2><div class="dk-mut">${esc(S.year + ' ' + S.event)} · ${esc(S.dates)}</div></div><span class="sp"></span>${picker}<button class="dkx-x" data-a="hxclose">✕</button></div>
  <div class="doc-wrap"><div class="doc-list">${list.map(d => `<button class="${d === cur ? 'on' : ''}" data-a="docopen" data-v="${d.key}"><b>Doc ${d.no}</b><span>${esc(d.title)}</span><small>${d.date.replace(/ \d{4}$/, '')} · ${d.time}</small></button>`).join('')}</div>
  <div class="doc-view">${cur ? docPaper(cur) : ''}</div></div></div>`;
}
Object.assign(A, {
  docopen(el) { if (!docSets().length) return; const v = el && el.dataset && el.dataset.v; if (v) DOCV.key = v; else if (!el || el.id === 'doc-tab') { DOCV.set = null; DOCV.key = null; } const t = document.getElementById('doc-toast'); if (t) t.className = ''; hxOpen(docModal()); const vw = document.querySelector('.doc-view'); if (vw) vw.scrollTop = 0; },
  doctoastx() { const t = document.getElementById('doc-toast'); if (t) t.className = ''; }
});
const _doc_render = render;
render = function () { const r = _doc_render.apply(this, arguments); try { docsSync(); } catch (e) { console.error(e); } return r; };

document.addEventListener('change', ev => {
  const el = ev.target; if (!el.matches || !el.matches('select.doc-rd')) return;
  const set = docSets().find(x => String(x.round) === el.value); if (!set) return;
  DOCV.set = set; DOCV.key = null; hxOpen(docModal());
}, true);
const _doc_render2 = render;
render = function () { const r = _doc_render2.apply(this, arguments); try { if (!WK) docTab(); } catch (e) { } return r; };
