// ===================================================================
// PITWALL EXPANSION — core systems (state, Team Principal, fan, stats)
// ===================================================================
const XP_ROLES = {
  td: { name: 'Technical Director', desc: 'Boosts every R&D project and next-year development' },
  aero: { name: 'Head of Aerodynamics', desc: 'Extra gains on aero parts' },
  eng: { name: 'Chief Race Engineer', desc: 'Clearer setup feedback, better race calls' },
  crew: { name: 'Pit Crew Chief', desc: 'Faster, more consistent pit stops' }
};
const XP_FAC = {
  tunnel: { name: 'Wind tunnel', desc: '+6% aero gains per level' },
  sim: { name: 'Driver simulator', desc: '+8% practice gains per level' },
  factory: { name: 'Factory', desc: 'Cheaper and faster part builds' },
  crew: { name: 'Pit-stop training centre', desc: 'Raises the pit crew training limit' }
};
const XP_PARTS = {
  fw: { name: 'Front wing', area: 'aero' }, floor: { name: 'Floor', area: 'aero' }, rw: { name: 'Rear wing', area: 'aero' },
  susp: { name: 'Suspension', area: 'chassis' }, side: { name: 'Sidepods & cooling', area: 'chassis' },
  pu: { name: 'Power unit upgrade', area: 'power' }, gbx: { name: 'Gearbox', area: 'rel' }, elec: { name: 'Electronics', area: 'rel' }
};
const SPONSOR_NAMES = ['Apex Energy', 'NovaByte Cloud', 'Helix Watches', 'Orbit Telecom', 'Kestrel Air', 'Lumen Bank', 'Vanta Tyres', 'Pulse Drinks', 'Quanta AI', 'Meridian Shipping', 'Solstice Solar', 'Halcyon Hotels', 'Torque Tools', 'Zephyr Mobility', 'Crest Insurance', 'Ironbark Logistics'];
const PUNDITS = [{ id: 'prof', name: 'The Professor', style: 'stats' }, { id: 'pete', name: 'Pit Lane Pete', style: 'bold' }, { id: 'gw', name: 'Grid Walker', style: 'safe' }];
const WHATIFS = [
  { id: 'senna94', label: 'Senna survives Imola 1994', start: 1994, driver: 'ayrton-senna', team: 'williams', from: 1994, to: 1999, desc: 'Ayrton Senna stays at Williams through to 1999.' },
  { id: 'rindt70', label: 'Rindt survives Monza 1970', start: 1970, driver: 'jochen-rindt', team: 'lotus', from: 1970, to: 1974, desc: 'Jochen Rindt keeps racing for Lotus until 1974.' },
  { id: 'clark68', label: 'Clark survives Hockenheim 1968', start: 1968, driver: 'jim-clark', team: 'lotus', from: 1968, to: 1972, desc: 'Jim Clark leads Lotus into the 1970s.' },
  { id: 'gilles82', label: 'Gilles Villeneuve survives Zolder 1982', start: 1982, driver: 'gilles-villeneuve', team: 'ferrari', from: 1982, to: 1986, desc: 'Gilles Villeneuve stays a Ferrari driver to 1986.' },
  { id: 'schumi07', label: 'Schumacher never retires (2007)', start: 2007, driver: 'michael-schumacher', team: 'ferrari', from: 2007, to: 2009, desc: 'Michael Schumacher races on at Ferrari from 2007 to 2009.' }
];
const FAMOUS = [
  [1976, 'Hunt vs Lauda — the Nürburgring, the rain in Japan'], [1984, 'Lauda beats Prost by half a point'], [1988, 'Senna vs Prost, McLaren team-mates'],
  [1994, 'Schumacher vs Hill, Adelaide'], [2008, 'Hamilton vs Massa, the last corner in Brazil'], [2010, 'Four drivers in the final-round title fight'], [2021, 'Verstappen vs Hamilton, Abu Dhabi']
];

function xpRand(seed) { return seeded(String(seed)); }
function personName(r) { const cc = Object.keys(NAME_POOL)[Math.floor(r() * Object.keys(NAME_POOL).length)]; const p = NAME_POOL[cc]; return p[0][Math.floor(r() * p[0].length)] + ' ' + p[1][Math.floor(r() * p[1].length)]; }
function makeStaff(role, rating, r) { r = r || Math.random; return { role, name: personName(r), rating: Math.round(rating), salary: +(Math.pow(rating / 60, 3) * 1.2).toFixed(1) }; }

function ensureXP(G) {
  if (!G) return;
  if (!G.xp) G.xp = {};
  const X = G.xp;
  X.v = 1;
  if (!X.staff) {
    const me = G.player && G.teams[G.player];
    const base = me ? clamp((me.aero + me.chassis) / 2 - 8, 55, 88) : 70;
    X.staff = {}; Object.keys(XP_ROLES).forEach(k => X.staff[k] = makeStaff(k, base + rnd(-6, 6)));
  }
  if (!X.fac) X.fac = { tunnel: 2, sim: 2, factory: 2, crew: 2 };
  if (!X.building) X.building = [];
  if (!X.academy) X.academy = [];
  if (X.focus == null) X.focus = 20;
  if (X.nextPool == null) X.nextPool = 0;
  if (!X.pu) X.pu = {};
  if (X.rivalry == null) X.rivalry = 15;
  if (!X.sponsors) X.sponsors = { offers: [], active: [] };
  if (!X.board) X.board = null;
  if (!X.trophies) X.trophies = [];
  if (!X.fan) X.fan = { preds: {}, predPts: 0, pundits: Object.fromEntries(PUNDITS.map(p => [p.id, 0])), fantasy: null, dotd: {} };
  if (!X.settings) X.settings = { sound: true, volume: 0.5, cam: 'track', text: 'm', motion: true, contrast: false };
  if (!X.staffMarket) X.staffMarket = [];
  if (!X.regYear) X.regYear = G.year + 5 - ((G.year - 2026) % 5 + 5) % 5 || G.year + 5;
  Object.values(G.drivers).forEach(d => { if (d.morale == null) d.morale = 70; });
  if (G.player && !X.board) xpNewSeasonBusiness(G, true);
  if (G.player && !X.sponsors.offers.length && !X.sponsors.active.length) xpSponsorOffers(G);
  if (!X.staffMarket.length) xpStaffMarket(G);
  applyAccessibility(G);
  return X;
}

// ---------- staff & facilities ----------
function xpStaffMarket(G) {
  const X = G.xp; X.staffMarket = [];
  Object.keys(XP_ROLES).forEach(role => { for (let i = 0; i < 3; i++) X.staffMarket.push(makeStaff(role, rnd(58, 94))); });
}
function staffMul(G, role) { const s = G.xp && G.xp.staff[role]; return s ? s.rating / 75 : 1; }
function facLevel(G, k) { return (G.xp && G.xp.fac[k]) || 1; }
function facCost(level) { return 6 + level * 7; }
function atrFactor(G) {
  if (!G.rules ? false : !G.rules.capOn) return 1;
  if (G.year < 2021) return 1;
  const pos = G.round === 0 ? (G.xp.lastPos || 6) : teamRank(G, G.player);
  const n = Object.keys(G.teams).length;
  return +(0.7 + (pos - 1) / Math.max(1, n - 1) * 0.45).toFixed(2);
}

// ---------- R&D multipliers (wrap the base game's project completion) ----------
function xpPartGainMul(G, area) {
  let m = 0.75 + staffMul(G, 'td') * 0.25;
  if (area === 'aero') m *= (0.85 + staffMul(G, 'aero') * 0.15) * (1 + (facLevel(G, 'tunnel') - 1) * 0.06) * atrFactor(G);
  m *= 1 - (G.xp.focus / 100) * 0.6;
  return m;
}

// ---------- power unit allocation ----------
function puRules(G) { const y = G.year; if (y < 2014) return null; return { limit: Math.max(2, Math.round(G.cal.length / 6)), life: G.cal.length / Math.max(2, Math.round(G.cal.length / 6)) }; }
function puState(G, did) { const X = G.xp; if (!X.pu[did]) X.pu[did] = { units: 1, wear: 0 }; return X.pu[did]; }

// ---------- tyre sets ----------
function tyreAllocation(G, sprint) { if (G.year < 2007) return null; return sprint ? { S: 6, M: 4, H: 2 } : { S: 8, M: 3, H: 2 }; }
function initSets(WK) {
  const al = tyreAllocation(G, WK.sprint); WK.sets = null; if (!al) return;
  WK.sets = {}; WK.entries.forEach(e => { WK.sets[e.d.id] = { S: Array(al.S).fill(0), M: Array(al.M).fill(0), H: Array(al.H).fill(0) }; });
}
function takeSet(did, comp, prefer) {
  if (!WK || !WK.sets || !WK.sets[did] || !WK.sets[did][comp]) return 0;
  const arr = WK.sets[did][comp]; if (!arr.length) return 0.35;
  let idx = 0; arr.forEach((w, i) => { if (w < arr[idx]) idx = i; });
  if (prefer === 'used') { let best = -1; arr.forEach((w, i) => { if (w > 0 && w < 0.5 && (best < 0 || w < arr[best])) best = i; }); if (best >= 0) idx = best; }
  const w = arr[idx]; arr.splice(idx, 1); return w;
}
function setsLeft(did, comp) { if (!WK || !WK.sets || !WK.sets[did]) return null; const a = WK.sets[did][comp] || []; return { fresh: a.filter(w => w === 0).length, used: a.filter(w => w > 0).length }; }
function returnSet(did, comp, wear) { if (WK && WK.sets && WK.sets[did] && WK.sets[did][comp]) WK.sets[did][comp].push(+wear.toFixed(2)); }

// ---------- setup puzzle ----------
const SETUP_KEYS = [['fw', 'Front wing'], ['rw', 'Rear wing'], ['susp', 'Suspension'], ['ride', 'Ride height']];
function setupOptimum(track, d) { const r = xpRand(track.id + d.id + G.year); const o = {}; SETUP_KEYS.forEach(([k]) => { o[k] = 2 + Math.round(r() * 6); }); o.rw = clamp(Math.round(2 + track.df * 7 + (r() - 0.5) * 2), 1, 10); o.fw = clamp(o.rw + Math.round((r() - 0.5) * 3), 1, 10); return o; }
function setupScore(cur, opt) { let s = 0; SETUP_KEYS.forEach(([k]) => s += Math.abs(cur[k] - opt[k])); return clamp(1 - s / 22, 0, 1); }
function setupFeedback(cur, opt, d, engRating) {
  const lines = []; const noisy = engRating < 70 ? 1 : 0;
  const say = (k, txt) => lines.push({ k, txt });
  const df = (k) => (cur[k] - opt[k]) + (noisy && Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0);
  const fw = df('fw'), rw = df('rw'), su = df('susp'), rh = df('ride');
  if (fw > 1) say('fw', 'Too much front end — the car is nervous on entry, the rear wants to step out.'); else if (fw < -1) say('fw', 'Understeer in the slow corners, the front just won\'t bite.'); else if (fw !== 0) say('fw', 'Front end is close, maybe a click ' + (fw > 0 ? 'less' : 'more') + ' front wing.');
  if (rw > 1) say('rw', 'We\'re slow on the straights, too much drag.'); else if (rw < -1) say('rw', 'The rear is loose in the fast corners, I need more rear wing.'); else if (rw !== 0) say('rw', 'Rear wing almost there — a touch ' + (rw > 0 ? 'less' : 'more') + '.');
  if (su > 1) say('susp', 'Too stiff — it\'s bouncing over the kerbs.'); else if (su < -1) say('susp', 'It\'s wallowing in the direction changes, stiffen it up.'); else if (su !== 0) say('susp', 'Suspension feels nearly right, maybe ' + (su > 0 ? 'softer' : 'stiffer') + '.');
  if (rh > 1) say('ride', 'The car feels lazy, we\'re losing downforce — try it lower.'); else if (rh < -1) say('ride', 'It\'s bottoming out on the straights, raise it.'); else if (rh !== 0) say('ride', 'Ride height is very close, one click ' + (rh > 0 ? 'down' : 'up') + '.');
  if (!lines.length) say('', 'The car feels fantastic. Don\'t touch anything!');
  return lines;
}

// ---------- sponsors ----------
function xpSponsorOffers(G) {
  const X = G.xp; const me = G.teams[G.player]; if (!me) return;
  const rank = Math.max(1, teamRank(G, G.player) || 5), n = Object.keys(G.teams).length;
  const strength = 1 - (rank - 1) / Math.max(1, n - 1);
  const used = new Set(X.sponsors.active.map(s => s.name)); const names = SPONSOR_NAMES.filter(s => !used.has(s)).sort(() => Math.random() - 0.5);
  const rivals = Object.values(G.teams).filter(t => t.id !== G.player);
  const cal = G.cal.map((id, i) => i).filter(i => i >= G.round);
  X.sponsors.offers = names.slice(0, 5).map((name, k) => {
    const types = ['points', 'podium', 'beat', 'gp', 'pos'];
    const type = types[k % types.length];
    let obj;
    if (type === 'points') obj = { type, n: Math.max(2, Math.round(G.cal.length * (0.25 + strength * 0.5))), text: '' };
    else if (type === 'podium') obj = { type, n: Math.max(1, Math.round(1 + strength * 5)) };
    else if (type === 'beat') { const r = rivals.sort((a, b) => teamRank(G, a.id) - teamRank(G, b.id)).find(t => teamRank(G, t.id) <= rank) || pick(rivals); obj = { type, team: r.id }; }
    else if (type === 'gp') { const i = cal.length ? pick(cal) : 0; obj = { type, round: i, pos: Math.max(1, Math.round(10 - strength * 7)) }; }
    else obj = { type, pos: Math.max(1, rank - (Math.random() < 0.5 ? 1 : 0)) };
    return { id: 's' + Math.random().toString(36).slice(2, 8), name, perRace: +(0.6 + strength * 2.2 + Math.random()).toFixed(1), bonus: +(5 + Math.random() * 10 + strength * 8).toFixed(1), obj, progress: 0, done: false, failed: false };
  });
}
function sponsorText(G, s) {
  const o = s.obj;
  if (o.type === 'points') return `Score points in ${o.n} races`;
  if (o.type === 'podium') return `Take ${o.n} podium${o.n > 1 ? 's' : ''}`;
  if (o.type === 'beat') return `Beat ${G.teams[o.team] ? G.teams[o.team].name : 'a rival'} in the constructors' standings`;
  if (o.type === 'gp') { const t = TRACK_BY_ID[G.cal[o.round]]; return `Finish top ${o.pos} at ${G.calInfo && G.calInfo[o.round] ? G.calInfo[o.round].gp : t ? t.short : 'a race'} (round ${o.round + 1})`; }
  return `Finish P${o.pos} or better in the constructors' standings`;
}

// ---------- board ----------
function xpNewSeasonBusiness(G, fresh) {
  const X = G.xp; if (!G.player || !G.teams[G.player]) return;
  const carRank = Object.values(G.teams).map(t => ({ t, s: (t.aero + t.chassis + G.engines[t.engine].power) / 3 })).sort((a, b) => b.s - a.s).findIndex(x => x.t.id === G.player) + 1;
  const prevConf = X.board ? X.board.conf : 60;
  X.board = { target: Math.max(1, carRank - (Math.random() < 0.4 ? 1 : 0)), conf: fresh ? 60 : clamp(prevConf * 0.5 + 35, 25, 80), year: G.year, notes: [] };
}
function boardUpdateRace(G, summary) {
  const X = G.xp; if (!X.board || !G.player) return;
  const pos = teamRank(G, G.player); const d = X.board.target - pos;
  let delta = clamp(d * 0.6, -1.6, 1.6);
  const mine = summary.rows.filter(r => r.team === G.player);
  if (mine.some(r => !r.out && r.pos === 1)) delta += 3; else if (mine.some(r => !r.out && r.pos <= 3)) delta += 1.5;
  if (mine.every(r => r.out)) delta -= 3;
  X.board.conf = clamp(X.board.conf + delta, 0, 100);
}

// ---------- morale & rivalry ----------
function moraleAfterRace(G, summary) {
  if (!G.player) return;
  const X = G.xp; const n = Object.keys(G.teams).length;
  const rank = teamRank(G, G.player) || 5; const expect = rank * 2 - 0.5;
  const mine = summary.rows.filter(r => r.team === G.player);
  mine.forEach(r => { const d = G.drivers[r.id]; if (!d) return; let m = 0;
    if (r.out) m -= /Crash|wall|Collision|gravel/.test(r.out) ? 2 : 4; else m += clamp((expect - r.pos) * 1.2, -6, 8);
    if (!r.out && r.pos === 1) m += 6;
    d.morale = clamp((d.morale ?? 70) + m + (70 - (d.morale ?? 70)) * 0.08, 5, 100); });
  if (mine.length === 2) {
    const [a, b] = mine; const da = G.drivers[a.id], db = G.drivers[b.id];
    if (da && db && Math.abs(da.pts - db.pts) < 25 && !a.out && !b.out && Math.abs(a.pos - b.pos) <= 2) X.rivalry = clamp(X.rivalry + 4, 0, 100);
    else X.rivalry = clamp(X.rivalry - 2, 0, 100);
  }
  Object.values(G.drivers).forEach(d => { if (d.team !== G.player) d.morale = clamp((d.morale ?? 70) + (70 - (d.morale ?? 70)) * 0.2, 5, 100); });
}

// ---------- power units before the race (AI always, player when a unit is worn out) ----------
function puPreRace(G, WK) {
  const pr = puRules(G); if (!pr || WK.puChecked || !WK.grid) return; WK.puChecked = true;
  WK.entries.forEach(e => { const st = puState(G, e.d.id); const mine = e.t.id === G.player;
    if ((!mine && st.wear > 0.95) || (mine && st.wear >= 1 && !(WK.newPU && WK.newPU[e.d.id]))) { st.units++; st.wear = 0; if (mine) news(G, `🔧 ${e.d.name}'s power unit was worn out — a new one has been fitted.`); if (st.units > pr.limit) applyGridPenalty(e, 10, 'new power unit'); } });
}
function applyGridPenalty(e, n, why) {
  const g = WK.grid; const i = g.indexOf(e); if (i < 0) return;
  g.splice(i, 1); g.splice(Math.min(g.length, i + n), 0, e);
  (WK.penalties = WK.penalties || []).push({ code: e.d.code, n, why });
  news(G, `⚠️ ${e.d.name}: ${n}-place grid penalty (${why}).`);
}

// ---------- records (real history from F1DB + this save) ----------
let REAL_WINS = null;
function realWinsBefore(year) {
  if (!REAL_WINS) { REAL_WINS = {}; Object.entries(HIST.years).forEach(([y, Y]) => Y.cal.forEach(c => { if (c[7] >= 0) { const id = HIST.drivers[c[7]][0]; (REAL_WINS[id] = REAL_WINS[id] || []).push(+y); } })); }
  const out = {}; Object.entries(REAL_WINS).forEach(([id, ys]) => { const n = ys.filter(y => y < year).length; if (n) out[id] = n; }); return out;
}
function realTitlesBefore(year) { const out = {}; Object.entries(HIST.years).forEach(([y, Y]) => { if (+y < year && Y.champ >= 0) { const id = HIST.drivers[Y.champ][0]; out[id] = (out[id] || 0) + 1; } }); return out; }
const MODERN_TO_HIST = { norris: 'lando-norris', piastri: 'oscar-piastri', russell: 'george-russell', antonelli: 'andrea-kimi-antonelli', leclerc: 'charles-leclerc', hamilton: 'lewis-hamilton', verstappen: 'max-verstappen', hadjar: 'isack-hadjar', albon: 'alexander-albon', sainz: 'carlos-sainz-jr', lawson: 'liam-lawson', lindblad: 'arvid-lindblad', alonso: 'fernando-alonso', stroll: 'lance-stroll', ocon: 'esteban-ocon', bearman: 'oliver-bearman', hulkenberg: 'nico-hulkenberg', bortoleto: 'gabriel-bortoleto', gasly: 'pierre-gasly', colapinto: 'franco-colapinto', perez: 'sergio-perez', bottas: 'valtteri-bottas', tsunoda: 'yuki-tsunoda', doohan: 'jack-doohan' };
function recordBase(G) {
  if (G.xp.recBase && G.xp.recBase.year === (G.startYear || 2026)) return G.xp.recBase;
  const y0 = G.startYear || (G.timeline ? G.year : 2026);
  const w = realWinsBefore(y0), t = realTitlesBefore(y0);
  const names = {}; HIST.drivers.forEach(d => names[d[0]] = d[1]);
  G.xp.recBase = { year: y0, wins: w, titles: t, names };
  return G.xp.recBase;
}
function careerWins(G, d) { const B = recordBase(G); const hid = MODERN_TO_HIST[d.id] || d.id; return (B.wins[hid] || 0) + (d.careerWins || 0); }
function careerTitles(G, d) { const B = recordBase(G); const hid = MODERN_TO_HIST[d.id] || d.id; return (B.titles[hid] || 0) + (d.titles || 0); }
function winsLeaderboard(G, n = 15) {
  const B = recordBase(G); const map = {};
  Object.entries(B.wins).forEach(([id, w]) => map[id] = { name: B.names[id] || id, wins: w, live: false });
  Object.values(G.drivers).forEach(d => { const hid = MODERN_TO_HIST[d.id] || d.id; const e = map[hid] || (map[hid] = { name: d.name, wins: 0 }); e.wins = (B.wins[hid] || 0) + (d.careerWins || 0); e.live = !d.retired; e.id = d.id; });
  return Object.values(map).filter(e => e.wins > 0).sort((a, b) => b.wins - a.wins).slice(0, n);
}
function milestoneNews(G, winner) {
  const w = careerWins(G, winner); const board = winsLeaderboard(G, 40);
  const idx = board.findIndex(e => e.id === winner.id);
  const peer = board.find(e => e.id !== winner.id && e.wins === w);
  if (w === 1) return `🎉 ${winner.name} takes a first-ever Grand Prix victory!`;
  if (peer) return `📈 ${winner.name}'s win #${w} draws level with ${peer.name} on the all-time list.`;
  if ([10, 25, 50, 75, 100].includes(w)) return `📈 Win number ${w} for ${winner.name}!`;
  if (idx === 0) return `👑 ${winner.name} extends the all-time record to ${w} wins.`;
  return null;
}

// ---------- predictions & fantasy ----------
function punditPicks(G, WK, kind) {
  const pool = WK.entries.map(e => ({ e, s: carScore(G, e.t, WK.track) * 0.7 + e.d.pace * 0.3 }));
  return Object.fromEntries(PUNDITS.map(p => {
    const noise = p.style === 'bold' ? 4 : p.style === 'safe' ? 0.8 : 1.8;
    const ranked = pool.map(x => ({ id: x.e.d.id, s: x.s + gauss() * noise })).sort((a, b) => b.s - a.s).map(x => x.id);
    return [p.id, { pole: ranked[0], win: ranked[0], podium: ranked.slice(0, 3), fl: ranked[Math.floor(Math.random() * 4)] }];
  }));
}
function scorePrediction(pred, res) {
  if (!pred) return 0; let p = 0;
  if (pred.pole && res.pole === pred.pole) p += 5;
  if (pred.win && res.win === pred.win) p += 10;
  (pred.podium || []).forEach((id, i) => { if (!id) return; const at = res.podium.indexOf(id); if (at >= 0) p += 3 + (at === i ? 2 : 0); });
  if (pred.fl && res.fl === pred.fl) p += 3;
  return p;
}
function fantasyPrices(G) {
  const out = { drivers: {}, teams: {} };
  const scored = Object.values(G.drivers).filter(d => d.team).map(d => ({ d, s: overall(d) * 0.45 + ((G.teams[d.team].aero + G.teams[d.team].chassis + G.engines[G.teams[d.team].engine].power) / 3) * 0.55 }));
  const min = Math.min(...scored.map(x => x.s)), max = Math.max(...scored.map(x => x.s));
  scored.forEach(x => out.drivers[x.d.id] = +(5 + Math.pow((x.s - min) / Math.max(1, max - min), 1.6) * 25).toFixed(1));
  Object.values(G.teams).forEach(t => { const s = (t.aero + t.chassis + G.engines[t.engine].power) / 3; out.teams[t.id] = +(5 + Math.pow(clamp((s - min) / Math.max(1, max - min), 0, 1), 1.4) * 20).toFixed(1); });
  return out;
}
function fantasyScoreRace(G, summary) {
  const F = G.xp.fan.fantasy; if (!F || !F.drivers || F.drivers.length < 5) return null;
  const PT = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  let total = 0; const lines = [];
  F.drivers.forEach(id => { const r = summary.rows.find(x => x.id === id); if (!r) return; let p = r.out ? -5 : (PT[r.pos - 1] || 0) + Math.max(0, r.grid - r.pos);
    if (summary.poleId === id) p += 3; if (summary.fastest && summary.fastest.id === id) p += 3; total += p; lines.push([r.code, p]); });
  if (F.team) { const tp = Math.round(summary.rows.filter(r => r.team === F.team).reduce((s, r) => s + (r.out ? 0 : (PT[r.pos - 1] || 0)), 0) / 2); total += tp; lines.push([G.teams[F.team] ? G.teams[F.team].name : F.team, tp]); }
  total -= F.pendingPenalty || 0; F.pendingPenalty = 0;
  F.pts += total; F.history.push({ round: summary.round, pts: total }); F.freeTransfers = Math.min(3, (F.freeTransfers || 0) + 2);
  return { total, lines };
}

// ---------- after-race processing (wraps the base game) ----------
const _baseApplyRace = applyRaceResult;
applyRaceResult = function (G, race, wk) {
  ensureXP(G);
  const out = _baseApplyRace(G, race, wk);
  const s = out.summary; const X = G.xp;
  // richer stats for charts
  s.lapPos = race.lapPos || null; s.stints = race.stintLog || null;
  s.poleId = wk.grid && wk.grid[0] ? wk.grid[0].d.id : null;
  if (race.fastest) s.fastest.id = race.fastest.c.d.id;
  // records & milestones
  const win = s.rows[0] && G.drivers[s.rows[0].id];
  if (win) { const m = milestoneNews(G, win); if (m) news(G, m); s.milestone = m; }
  // team principal systems
  if (G.player && G.teams[G.player]) {
    moraleAfterRace(G, s); boardUpdateRace(G, s);
    // PU wear
    const pr = puRules(G);
    if (pr) race.cars.forEach(c => { const st = puState(G, c.d.id); st.wear = clamp(st.wear + (1 / pr.life) * (c.puStress || 1) * rnd(0.9, 1.1), 0, 1.2); });
    // facility builds & next-year development
    X.building.forEach(b => b.left--);
    X.building.filter(b => b.left <= 0).forEach(b => { X.fac[b.key] = Math.min(5, X.fac[b.key] + 1); news(G, `🏗️ ${XP_FAC[b.key].name} upgraded to level ${X.fac[b.key]}.`); });
    X.building = X.building.filter(b => b.left > 0);
    X.nextPool += (X.focus / 100) * 0.3 * (0.75 + staffMul(G, 'td') * 0.25);
    // staff wages (per race)
    const wages = Object.values(X.staff).reduce((a, st) => a + st.salary, 0) / G.cal.length;
    G.teams[G.player].money -= wages; out.moneyLog.player && (out.moneyLog.player.staff = wages);
    // academy growth
    X.academy.forEach(id => { const d = G.drivers[id]; if (!d) return; ['pace', 'craft', 'cons', 'wet', 'tyre'].forEach(k => d[k] = +clamp(d[k] + rnd(0, 0.12) * (1 + d.pot / 4) * (0.8 + facLevel(G, 'sim') * 0.1), 50, 95).toFixed(2)); });
    // sponsors
    const mine = s.rows.filter(r => r.team === G.player); let sp = 0;
    X.sponsors.active.forEach(sn => {
      sp += sn.perRace; if (sn.done || sn.failed) return; const o = sn.obj;
      if (o.type === 'points' && mine.some(r => r.pts > 0)) sn.progress++;
      if (o.type === 'podium') sn.progress += mine.filter(r => !r.out && r.pos <= 3).length;
      if (o.type === 'gp' && s.round - 1 === o.round) { if (mine.some(r => !r.out && r.pos <= o.pos)) { sn.progress = 1; } else sn.failed = true; }
      const goal = o.type === 'points' || o.type === 'podium' ? o.n : o.type === 'gp' ? 1 : null;
      if (goal && sn.progress >= goal) { sn.done = true; G.teams[G.player].money += sn.bonus; X.board && (X.board.conf = clamp(X.board.conf + 4, 0, 100)); news(G, `🤝 ${sn.name} target hit — ${fmtM(sn.bonus)} bonus!`); X.trophies.push({ y: G.year, t: 'sponsor', s: `${sn.name}: ${sponsorText(G, sn)}` }); }
    });
    if (sp) { G.teams[G.player].money += sp; if (out.moneyLog.player) out.moneyLog.player.sponsorDeals = sp; }
    // trophies
    mine.forEach(r => { if (!r.out && r.pos === 1) X.trophies.push({ y: G.year, t: 'win', s: `${r.name} wins the ${s.gp || wk.track.short} GP` }); });
  }
  // fan: predictions, pundits, fantasy, driver of the day candidates
  const res = { pole: s.poleId, win: s.rows[0].id, podium: s.rows.slice(0, 3).map(r => r.id), fl: s.fastest ? s.fastest.id : null };
  const P = X.fan.preds[G.year + ':' + s.round];
  if (P) { P.score = scorePrediction(P.mine, res); X.fan.predPts += P.score; Object.entries(P.pundits || {}).forEach(([k, v]) => X.fan.pundits[k] = (X.fan.pundits[k] || 0) + scorePrediction(v, res)); s.pred = { score: P.score }; }
  s.fantasy = fantasyScoreRace(G, s);
  const gainers = s.rows.filter(r => !r.out).map(r => ({ r, g: r.grid - r.pos })).sort((a, b) => b.g - a.g);
  const cands = [s.rows[0]].concat(gainers.slice(0, 3).map(x => x.r)); if (G.follow) { const f = s.rows.find(r => r.id === G.follow); if (f) cands.push(f); }
  s.dotdCands = [...new Set(cands.map(r => r.id))].slice(0, 5);
  // title clinched?
  s.clinched = titleClinched(G);
  return out;
};
function titleClinched(G) {
  if (G.xp.clinchedYear === G.year) return null;
  const ds = standingsDrivers(G); if (ds.length < 2) return null;
  const P1 = ((G.rules && G.rules.points) || POINTS)[0]; let left = (G.cal.length - G.round) * (P1 + 1);
  for (let i = G.round; i < G.cal.length; i++) if (isSprintRound(G, i)) left += 8;
  if (ds[0].pts - ds[1].pts > left) { G.xp.clinchedYear = G.year; return { id: ds[0].id, name: ds[0].name, team: ds[0].team }; }
  return null;
}

// ---------- R&D completion: scale part gains ----------
XPH.partMul = (G, p) => G.xp ? xpPartGainMul(G, p.area) : 1;

// ---------- season end (wrap both modes) ----------
function xpSeasonEnd(G, summary) {
  const X = G.xp; if (!X) return;
  if (G.player && G.teams[G.player]) {
    const me = G.teams[G.player];
    // next-year car
    const regChange = G.year >= X.regYear;
    let pool = X.nextPool * (regChange ? 1.8 : 1);
    if (G.timeline) { G.bonus.aero += pool / 2; G.bonus.chassis += pool / 2; } else { me.aero = clamp(me.aero + pool / 2, 40, 99); me.chassis = clamp(me.chassis + pool / 2, 40, 99); }
    summary.nextYear = +pool.toFixed(2);
    if (regChange && !G.timeline) {
      Object.values(G.teams).forEach(t => { if (t.id === G.player) return; t.aero = +(80 + (t.aero - 80) * 0.6 + rnd(-2.5, 2.5)).toFixed(2); t.chassis = +(80 + (t.chassis - 80) * 0.6 + rnd(-2.5, 2.5)).toFixed(2); });
      me.aero = +(80 + (me.aero - 80) * 0.6 + pool * 0.6).toFixed(2); me.chassis = +(80 + (me.chassis - 80) * 0.6 + pool * 0.6).toFixed(2);
      news(G, `📜 New regulations for ${G.year}! The pecking order has been shaken up.`); X.regYear = G.year + 5; summary.regChange = true;
    }
    X.nextPool = 0;
    // board verdict
    if (X.board) {
      const pos = summary.playerPos || teamRank(G, G.player);
      X.board.conf = clamp(X.board.conf + (pos <= X.board.target ? 15 : -(pos - X.board.target) * 8), 0, 100);
      summary.board = { target: X.board.target, pos, conf: Math.round(X.board.conf) };
      if (X.board.conf < 15) { summary.sacked = true; X.sacked = true; }
    }
    X.lastPos = summary.playerPos || teamRank(G, G.player);
    // sponsor season-end objectives
    X.sponsors.active.forEach(sn => { if (sn.done || sn.failed) return; const o = sn.obj; let ok = false;
      if (o.type === 'beat') ok = summary.finalTable ? summary.finalTable.indexOf(G.player) < summary.finalTable.indexOf(o.team) : false;
      if (o.type === 'pos') ok = (summary.playerPos || 99) <= o.pos;
      if (ok) { me.money += sn.bonus; X.trophies.push({ y: summary.year, t: 'sponsor', s: `${sn.name}: ${sponsorText(G, sn)}` }); } });
    X.sponsors.active = []; X.pu = {};
    // rival teams can trigger release clauses on star drivers
    teamDrivers(G, G.player).forEach(d => { if (!d.release || overall(d) < 85) return; const suitor = Object.values(G.teams).filter(t => t.id !== G.player && appeal(G, t.id) > appeal(G, G.player)).sort((a, b) => appeal(G, b.id) - appeal(G, a.id))[0];
      if (suitor && Math.random() < 0.35) { const out = teamDrivers(G, suitor.id).sort((a, b) => overall(a) - overall(b))[0]; if (out) out.team = null; d.team = suitor.id; d.no1 = false; me.money += d.release; summary.moves = summary.moves || []; summary.moves.push(`${d.name} leaves for ${suitor.name} — release clause paid (${fmtM(d.release)})`); news(G, `💸 ${suitor.name} trigger ${d.name}'s release clause!`); d.release = 0; } });
    // trophies
    if (summary.champ && G.drivers[summary.champ.id] && G.drivers[summary.champ.id].team === G.player) X.trophies.push({ y: summary.year, t: 'title', s: `Drivers' champion: ${summary.champ.name}` });
    if (summary.cchamp && summary.cchamp.id === G.player) X.trophies.push({ y: summary.year, t: 'title', s: `Constructors' champions` });
    // hall of fame
    hofAdd({ y: summary.year, team: me.name, pos: summary.playerPos, mode: G.timeline ? 'timeline' : 'modern' });
  }
  // fan season wrap
  X.fan.seasonLog = X.fan.seasonLog || []; X.fan.seasonLog.push({ y: summary.year, pred: X.fan.predPts, fantasy: X.fan.fantasy ? X.fan.fantasy.pts : 0 });
  X.clinchedYear = null;
  xpStaffMarket(G);
}
function xpSeasonStart(G) {
  const X = G.xp; if (!X) return;
  Object.values(G.drivers).forEach(d => { if (d.morale == null) d.morale = 70; });
  X.academy = X.academy.filter(id => G.drivers[id] && !G.drivers[id].team && !G.drivers[id].retired);
  if (G.player && G.teams[G.player]) { xpNewSeasonBusiness(G, false); X.sponsors.offers = []; xpSponsorOffers(G); }
  if (X.fan.fantasy) { X.fan.fantasy.freeTransfers = 99; X.fan.fantasy.seasonPts = 0; }
  X.fan.predPts = 0; X.fan.pundits = Object.fromEntries(PUNDITS.map(p => [p.id, 0]));
}
const _baseEndSeason = endSeason;
endSeason = function (G) {
  ensureXP(G);
  const table = standingsTeams(G).map(t => t.id); const prePos = G.player ? table.indexOf(G.player) + 1 : 0;
  const s = _baseEndSeason(G);
  s.finalTable = table; s.playerPos = s.playerPos || prePos;
  if (s.champ && !s.champ.id) s.champ.id = (Object.values(G.drivers).find(d => d.name === s.champ.name) || {}).id;
  xpSeasonEnd(G, s); xpSeasonStart(G);
  return s;
};
const _baseEndTimeline = endSeasonTimeline;
endSeasonTimeline = function (G) {
  ensureXP(G);
  const table = standingsTeams(G).map(t => t.id); const prePos = G.player ? table.indexOf(G.player) + 1 : 0;
  const champId = standingsDrivers(G)[0] && standingsDrivers(G)[0].id;
  const s = _baseEndTimeline(G);
  s.finalTable = table; s.playerPos = s.playerPos || prePos; if (s.champ) s.champ.id = s.champ.id || champId;
  xpSeasonEnd(G, s); xpSeasonStart(G);
  return s;
};

// ---------- what-if scenarios (wrap loadSeason) ----------
let PENDING_WHATIF = null;
const _baseLoadSeason = loadSeason;
loadSeason = function (G, y) {
  _baseLoadSeason(G, y);
  const wid = G.whatIf || PENDING_WHATIF;
  const W = wid && WHATIFS.find(w => w.id === wid);
  if (!W || y < W.from || y > W.to || !G.teams[W.team]) return;
  if (Object.values(G.drivers).some(d => d.id === W.driver && d.team === W.team)) return;
  // latest real ratings for the driver
  let row = null, rowYear = 0;
  for (let yy = y; yy >= 1950; yy--) { const Y = HIST.years[yy]; if (!Y) continue; const idx = HIST.drivers.findIndex(x => x[0] === W.driver); const r = Y.drivers.find(x => x[0] === idx); if (r) { row = r; rowYear = yy; break; } }
  if (!row) return;
  const D = HIST.drivers[row[0]]; const age = y - D[4]; const decay = Math.max(0, age - 33) * (y - rowYear) * 0.25;
  const mates = Object.values(G.drivers).filter(d => d.team === W.team).sort((a, b) => a.pace - b.pace);
  if (mates.length >= (G.teams[W.team].cars || 2)) { mates[0].team = null; }
  const c = G.careers[D[0]] || { titles: 0, wins: 0 };
  G.drivers[D[0]] = { id: D[0], name: D[1], code: D[2], num: row[2], nat: D[3], age, pace: row[3] - decay, craft: row[4] - decay * 0.5, cons: row[5], wet: row[6] - decay * 0.5, tyre: row[7],
    salary: 10, until: y, pot: 0, team: W.team, pts: 0, res: [], wins: 0, pods: 0, poles: 0, careerWins: c.wins, titles: c.titles, next: null, morale: 75, whatIf: true };
  news(G, `🔮 What-if: ${D[1]} races for ${G.teams[W.team].name} in ${y}.`);
};

// ---------- hall of fame (across careers, this browser) ----------
function hofLoad() { try { return JSON.parse(localStorage.getItem('pitwall_hof') || '[]'); } catch (e) { return []; } }
function hofAdd(e) { try { const h = hofLoad(); h.push(e); localStorage.setItem('pitwall_hof', JSON.stringify(h.slice(-200))); } catch (er) { } }

// ---------- accessibility ----------
function applyAccessibility(G) {
  const s = G && G.xp && G.xp.settings; if (!s || typeof document === 'undefined') return;
  const b = document.body; if (!b) return;
  b.classList.toggle('xp-text-s', s.text === 's'); b.classList.toggle('xp-text-l', s.text === 'l'); b.classList.toggle('xp-text-xl', s.text === 'xl');
  b.classList.toggle('xp-nomotion', !s.motion); b.classList.toggle('xp-contrast', !!s.contrast);
}
