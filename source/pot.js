// ===================== Prize pot (custom regulation) =====================
// Each driver gets an allowance of 10 × the number of rounds for the season.
// After free practice and before qualifying, every driver agrees with their team principal how many points to chip
// into that Grand Prix's pot (at least 1, and they must keep 1 for each race still to come). Stakes stay secret:
// only the pot's total is announced before the race. After the race the whole pot is paid out as championship
// points: every finisher gets at least 1, the rest is shared on a linear sliding scale (P1 weighs F, last finisher 1). Retirements get nothing.
const potOn = () => !!(G && G.regs && G.regs.pot === 'on');
const POT_PER_RACE = 10;
function potState() {
  if (!G.pot || G.pot.year !== G.year) G.pot = { year: G.year, bank: {}, hist: [] };
  return G.pot;
}
function potRacesAfter() { return Math.max(0, G.cal.length - G.round - 1); }
function potBank(id) { const S = potState(); if (S.bank[id] == null) { S.bank[id] = POT_PER_RACE * Math.max(1, G.cal.length - G.round); S.start = S.start || {}; S.start[id] = S.bank[id]; } return S.bank[id]; }
function potMax(id) { return Math.max(1, potBank(id) - potRacesAfter()); }
const potControlled = e => G.player ? e.t.id === G.player : (() => { const f = WK.entries.find(x => x.d.id === G.follow); return !!f && f.t.id === e.t.id; })();

// ---------- AI: how much to chip in ----------
function potFpRank() { // pace order from the last free practice session
  const fp = WK.fp && WK.fp[WK.fp.length - 1];
  const order = fp && (fp.rows || fp.res || (Array.isArray(fp) ? fp : null));
  if (order && order.length) return new Map(order.map((r, i) => [(r.e || r).d.id, i]));
  return new Map(WK.entries.map((e, i) => [e.d.id, i]));
}
function potAiStake(e, rank, n) {
  const id = e.d.id, max = potMax(id), left = G.cal.length - G.round;
  if (left <= 1) return { ask: max, final: max };
  const avg = potBank(id) / left, str = n > 1 ? 1 - rank / (n - 1) : 0.5;
  const base = avg * (0.4 + 1.5 * Math.pow(str, 1.4)) * rnd(0.8, 1.25);
  const ego = 1 + ((e.d.aggr || e.d.racecraft || 70) - 70) / 120 + rnd(-0.05, 0.25);
  const clampS = v => Math.max(1, Math.min(max, Math.round(v)));
  return { ask: clampS(base * ego), final: clampS(base) };
}
function potTalk(e, s) {
  const first = String(e.d.name).split(' ').slice(-1)[0];
  const strong = s.ask >= s.final;
  const d = s.ask > s.final * 1.25 ? `“I feel quick here after practice — I want to put in ${s.ask}.”`
    : s.ask < s.final * 0.8 ? `“Not my weekend so far. I'd rather keep my points — ${s.ask} at most.”`
    : `“The car feels about right. Something like ${s.ask} makes sense.”`;
  const tp = s.final === s.ask ? `“Agreed, ${s.final} it is.”`
    : s.final < s.ask ? `“Let's not overspend this early, ${first}. We go with ${s.final}.”`
    : `“We have the pace for more — I want ${s.final} on the table.”`;
  return { d, tp };
}
function potDecide() {
  const rank = potFpRank(), n = WK.entries.length;
  const P = WK.pot = { stakes: {}, talks: {}, locked: false, total: 0 };
  WK.entries.forEach(e => { const s = potAiStake(e, rank.has(e.d.id) ? rank.get(e.d.id) : n - 1, n); P.stakes[e.d.id] = s.final; if (potControlled(e)) P.talks[e.d.id] = Object.assign({ ask: s.ask, tpPick: s.final }, potTalk(e, s)); });
  return P;
}
function potLock() {
  const P = WK.pot, S = potState(); if (!P || P.locked) return;
  WK.entries.forEach(e => { const id = e.d.id; const v = Math.max(1, Math.min(potMax(id), P.stakes[id] || 1)); P.stakes[id] = v; S.bank[id] = potBank(id) - v; });
  P.total = Object.values(P.stakes).reduce((a, b) => a + b, 0); P.locked = true;
}

// ---------- paying out ----------
function potPayout(total, finishers) {
  const F = finishers; if (F <= 0) return [];
  // linear weightage over every finisher: P1 weighs F, P2 F-1 ... last finisher 1, so every place shares in the pot
  const W = Array.from({ length: F }, (_, i) => F - i);
  const out = new Array(F).fill(1); let rest = Math.max(0, total - F);
  const sw = W.reduce((a, b) => a + b, 0);
  if (rest > 0 && sw > 0) {
    const raw = W.map(w => rest * w / sw), fl = raw.map(Math.floor); let left = rest - fl.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { fl[i]++; left--; } });
    fl.forEach((v, i) => out[i] += v);
  }
  return out.sort((a, b) => b - a); // never pay a lower place more than a higher one
}
const _pot_applyRaceResult = applyRaceResult;
applyRaceResult = function (G0, race, wk) {
  const out = _pot_applyRaceResult.apply(this, arguments);
  try {
    if (!potOn() || !race || race.sprint || !wk.pot || !wk.pot.locked) return out;
    const s = G0.results[G0.results.length - 1], P = wk.pot;
    const fin = s.rows.filter(r => !r.out).sort((a, b) => a.pos - b.pos), pay = potPayout(P.total, fin.length), payOf = new Map(fin.map((r, i) => [r, pay[i]]));
    const teamDelta = {};
    s.rows.forEach(r => {
      const nw = payOf.get(r) || 0, d = G0.drivers[r.id] || (race.result.find(x => x.id === r.id) || {}).c && race.result.find(x => x.id === r.id).c.d;
      if (!d) return; const dl = nw - (r.pts || 0);
      d.pts += dl; if (d.res && d.res.length) d.res[d.res.length - 1] = nw;
      G0.teams[r.team].pts += dl; teamDelta[r.team] = (teamDelta[r.team] || 0) + dl;
      r.stake = P.stakes[r.id]; r.pts = nw;
    });
    Object.entries(teamDelta).forEach(([t, dl]) => { G0.teams[t].money += dl * 0.12; if (out && out.moneyLog && out.moneyLog.player && t === G0.player) { out.moneyLog.player.income += dl * 0.12; out.moneyLog.player.racePts += dl; } });
    s.pot = { total: P.total, n: Object.keys(P.stakes).length, fin: fin.length, top: pay[0] || 0 };
    potState().hist.push({ round: G0.round + 1, total: P.total });
    if (G0.rules && G0.rules.bestN && typeof recomputePoints === 'function') recomputePoints(G0);
  } catch (e) { console.error(e); }
  return out;
};
// live championship projection while the race runs
function potLive(R, running) {
  if (!potOn() || R.sprint || !WK.pot || !WK.pot.locked) return null;
  const pay = potPayout(WK.pot.total, running.length), add = {};
  running.forEach((c, i) => { add[c.d.id] = pay[i]; }); return add;
}

// ---------- the decision step: after free practice, before qualifying ----------
const _pot_toquali = A.toquali;
A.toquali = function (q) {
  if (potOn() && WK && WK.stage === 'fp' && !(WK.pot && WK.pot.locked)) {
    if (!WK.pot) potDecide();
    if (q === true || !Object.keys(WK.pot.talks).length) { potLock(); return _pot_toquali.apply(this, arguments); }
    WK.stage = 'pot'; render(); window.scrollTo(0, 0); return;
  }
  return _pot_toquali.apply(this, arguments);
};
Object.assign(A, {
  potadj(el) { const P = WK.pot, id = el.dataset.d, v = el.dataset.v, max = potMax(id);
    P.stakes[id] = v === 'min' ? 1 : v === 'max' ? max : v === 'ask' ? P.talks[id].ask : v === 'tp' ? P.talks[id].tpPick : Math.max(1, Math.min(max, (P.stakes[id] || 1) + +v)); render(); },
  potlock() { if (!WK.pot) return; potLock(); WK.stage = 'fp'; _pot_toquali.call(A); }
});
const _pot_dkcont = A.dkcont;
if (_pot_dkcont) A.dkcont = function () { if (WK && WK.stage === 'pot') return A.potlock(); return _pot_dkcont.apply(this, arguments); };
function potPage() {
  const P = WK.pot, t = WK.track, after = potRacesAfter(), mine = WK.entries.filter(potControlled);
  const card = e => { const id = e.d.id, T = P.talks[id], v = P.stakes[id], max = potMax(id), bank = potBank(id);
    const btn = (val, lab) => `<button class="sm" data-a="potadj" data-d="${id}" data-v="${val}">${lab}</button>`;
    return `<div class="pot-card" style="--tc:${e.t.color}"><div class="pot-who">${dkFlag(e.d.nat)} <b>${esc(e.d.name)}</b><span class="dk-mut"> · ${esc(e.t.name)}</span></div>
    <div class="pot-talk"><div><span class="pot-lab">${esc(String(e.d.name).split(' ').slice(-1)[0])}</span> ${T.d}</div><div><span class="pot-lab">Team principal</span> ${T.tp}</div></div>
    <div class="pot-num"><span class="dk-mut">Chip in</span><b>${v}</b><span class="dk-mut">of ${max} possible · allowance ${bank} → ${bank - v}</span></div>
    <div class="row pot-btns">${btn('min', 'Min 1')}${btn(-5, '−5')}${btn(-1, '−1')}${btn(1, '+1')}${btn(5, '+5')}${btn('max', 'Max')}${btn('ask', `Driver's ask (${T.ask})`)}${btn('tp', `Principal's call (${T.tpPick})`)}</div></div>`; };
  const others = WK.entries.length - mine.length;
  return `<div class="dk dk-fp" id="dk"><div class="dk-fptitle">Prize Pot Talks - ${esc(t.short)}<span class="dk-mut">ROUND ${WK.round + 1} OF ${G.cal.length} · ${G.year} · ${after} RACE${after === 1 ? '' : 'S'} AFTER THIS ONE · KEEP 1 POINT FOR EACH</span></div>
  <div class="dk-fpbox"><div class="dk-mut heat-note">💰 Practice is done. Each driver agrees with their team principal how many points to chip into this Grand Prix's pot — at least 1. Stakes stay secret; only the total is announced before the race. After the race the whole pot is paid out: every finisher gets at least 1 point, the rest is shared by finishing position on a sliding scale down to the last finisher, and retirements get nothing.</div>
  <div class="pot-grid">${mine.map(card).join('')}</div>
  <div class="dk-mut" style="margin-top:.8em">🔒 The other ${others} drivers have agreed their amounts with their own team principals in secret.</div></div>
  <div class="dk-fpfoot"><span class="dk-mut kbhint">Press ENTER/SPACE or click Lock in.</span><span class="sp"></span><button data-a="potview">💰 Allowances and past pots</button><button class="pri" data-a="potlock" data-enter="1">Lock in and go to qualifying →</button></div></div>`;
}
const _pot_viewWeekend = viewWeekend;
viewWeekend = function () {
  if (WK && WK.stage === 'pot' && WK.pot) return potPage();
  return _pot_viewWeekend.apply(this, arguments);
};

// ---------- announcing the total: grid page, race start, live header, results ----------
const potNote = () => `💰 Prize pot: <b>${WK.pot.total}</b> points from ${Object.keys(WK.pot.stakes).length} drivers — every finisher gets at least 1, retirements get nothing.`;
if (typeof deskGrid === 'function') {
  const _pot_deskGrid = deskGrid;
  deskGrid = function (sprint) {
    let html = _pot_deskGrid.apply(this, arguments);
    if (!sprint && potOn() && WK.pot && WK.pot.locked) html = html.replace(/(<div class="dk-mut dkg-note">)/, `<div class="dk-mut dkg-note pot-ann">${potNote()}</div>$1`);
    return html;
  };
}
hxChain('raceInit', race => {
  if (race.sprint || !potOn() || race.wk !== WK || !WK.pot || !WK.pot.locked) return;
  if (!race.grp || race.grp === 1) if (!race.heat || race.heat === 1) race.msg(`💰 Prize pot announced: ${WK.pot.total} points to be shared after the race`, true);
});
const _pot_updRace = updateRaceUI;
updateRaceUI = function () {
  const r = _pot_updRace.apply(this, arguments);
  try {
    if (!RACE || RACE.sprint || !potOn() || !WK.pot || !WK.pot.locked) return r;
    const ds = document.getElementById('dksess'); if (!ds) return r;
    if (!ds.querySelector('.pot-chip')) ds.insertAdjacentHTML('beforeend', ` <span class="pot-chip" data-a="potview" title="Open the prize pot">💰 POT ${WK.pot.total}</span>`);
  } catch (e) { }
  return r;
};
const _pot_dkRaceView = dkRaceView;
dkRaceView = function (o) {
  let html = _pot_dkRaceView.apply(this, arguments);
  const s = G.results[o.k];
  if (s && s.pot && !o.sprint) {
    const strip = `<div class="heat-strip pot-strip"><span><b>💰 Prize pot ${s.pot.total} pts</b> from ${s.pot.n} drivers</span><span>Winner +${s.pot.top}</span><span>${s.pot.fin} finishers paid · at least 1 each</span><span>Retirements: 0</span><button class="sm" data-a="potview">Stakes and allowances →</button></div>`;
    html = html.replace('<table class="dkfp dkrr">', strip + '<table class="dkfp dkrr">');
  }
  return html;
};

// ---------- Prize Pot view: allowances left + round-by-round breakdown ----------
// Secrecy: a stake locked for a race that hasn't been run yet stays hidden, so other drivers'
// "left" figures only drop once that race is over. Your own team's figures are always up to date.
let POTV = { open: {} };
function potPending() { return WK && WK.pot && WK.pot.locked && !(WK.applied && WK.stage === 'results') && G.results.length <= G.round ? WK.pot : null; }
function potMine(id) { if (G.player) return G.drivers[id] && G.drivers[id].team === G.player; const f = G.drivers[G.follow]; return !!f && !!G.drivers[id] && G.drivers[id].team === f.team; }
function potRows() {
  const S = potState(), pend = potPending(), won = {}, used = {};
  G.results.forEach(r => { if (r.pot) r.rows.forEach(x => { won[x.id] = (won[x.id] || 0) + (x.pts || 0); }); });
  const ids = Object.keys(S.bank);
  return ids.map(id => {
    const d = G.drivers[id]; if (!d) return null;
    const hid = pend && pend.stakes[id] != null && !potMine(id) ? pend.stakes[id] : 0;
    const left = S.bank[id] + hid, start = (S.start || {})[id] != null ? S.start[id] : POT_PER_RACE * G.cal.length;
    return { id, d, team: d.team, start, left, used: start - left, won: won[id] || 0, cur: pend && potMine(id) ? pend.stakes[id] : null };
  }).filter(Boolean).sort((a, b) => b.left - a.left || b.won - a.won);
}
function potViewHtml(modal) {
  const S = potState(), rows = potRows(), pend = potPending(), after = Math.max(0, G.cal.length - Math.min(G.round, G.cal.length) - (pend ? 1 : 0));
  const rounds = G.results.filter(r => r.pot);
  const paid = rounds.reduce((a, r) => a + r.pot.total, 0);
  const tc = t => (G.teams[t] || {}).color || '#888';
  const nm = r => `<span class="pot-dn" style="--tc:${tc(r.team)}">${esc(r.d.name)}</span>`;
  const stat = (l, v) => `<div class="pot-stat"><span>${l}</span><b>${v}</b></div>`;
  const allow = `<div class="pot-sc"><table class="dkfp pot-tab"><thead><tr><th class="l">Driver</th><th class="l hm">Team</th><th class="ra hm">Allowance</th><th class="ra">Chipped in</th><th class="ra">Left</th><th class="ra hm">Per race left</th><th class="ra">Pot points won</th></tr></thead><tbody>${rows.map(r => `<tr class="${potMine(r.id) ? 'me' : ''}"><td class="l">${nm(r)}${r.cur != null ? ` <span class="pot-cur">${r.cur} in this GP</span>` : ''}</td><td class="l hm">${esc((G.teams[r.team] || {}).name || '')}</td><td class="ra hm">${r.start}</td><td class="ra">${r.used}</td><td class="ra"><b>${r.left}</b></td><td class="ra hm">${after ? (r.left / after).toFixed(1) : '—'}</td><td class="ra">${r.won}</td></tr>`).join('')}</tbody></table></div>`;
  const hist = rounds.length ? rounds.slice().reverse().map(r => {
    const k = r.round, fin = r.rows.filter(x => !x.out), rows2 = r.rows.slice().sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || a.pos - b.pos);
    const open = !!POTV.open[k], best = fin.reduce((m, x) => x.stake && (x.pts / x.stake) > (m ? m.pts / m.stake : 0) ? x : m, null);
    return `<div class="pot-rd"><button class="pot-rdh ${open ? 'on' : ''}" data-a="potrd" data-v="${k}"><b>R${k} ${esc(r.gp || '')}</b><span>Pot <b>${r.pot.total}</b></span><span class="hm">${r.pot.fin} finishers paid</span><span>Winner +${r.pot.top}</span>${best ? `<span class="hm">Best return ${esc(best.code)} ${best.stake}→${best.pts}</span>` : ''}<span class="sp"></span><span>${open ? '▲' : '▼'}</span></button>
    ${open ? `<div class="pot-sc"><table class="dkfp pot-tab"><thead><tr><th>Pos</th><th class="l">Driver</th><th class="ra">Chipped in</th><th class="ra">Paid out</th><th class="ra">Net</th></tr></thead><tbody>${rows2.map(x => { const net = (x.pts || 0) - (x.stake || 0); return `<tr class="${potMine(x.id) ? 'me' : ''}"><td class="pos">${x.out ? 'DNF' : 'P' + x.pos}</td><td class="l"><span class="pot-dn" style="--tc:${tc(x.team)}">${esc(x.name)}</span></td><td class="ra">${x.stake != null ? x.stake : '—'}</td><td class="ra">${x.pts || 0}</td><td class="ra ${net > 0 ? 'good' : net < 0 ? 'bad' : ''}">${net > 0 ? '+' : ''}${net}</td></tr>`; }).join('')}</tbody></table></div>` : ''}</div>`;
  }).join('') : '<div class="dk-mut" style="padding:.6em 0">No Grand Prix has paid out yet this season.</div>';
  const cur = pend ? `<div class="pot-live">💰 This Grand Prix's pot: <b>${pend.total}</b> points from ${Object.keys(pend.stakes).length} drivers. Other drivers' stakes are revealed after the race.</div>` : '';
  const body = `${cur}<div class="pot-stats">${stat('Allowance per driver', POT_PER_RACE * G.cal.length)}${stat('Grands Prix paid out', rounds.length + ' / ' + G.cal.length)}${stat('Points paid out so far', paid)}${stat('Races still to chip into', after)}</div>
  <h3 class="grp-h">Points left for each driver</h3>${allow}
  <h3 class="grp-h" style="margin-top:1em">Prize pot by round</h3><div class="dk-mut small" style="margin-bottom:.4em">Tap a round to see every driver's stake and payout.</div>${hist}`;
  if (modal) return `<div class="dkx-mod pot-mod"><div class="dkx-hd"><div><h2>Prize Pot</h2><div class="dk-mut">${G.year} · ${esc(G.cal.length + ' rounds')}</div></div><span class="sp"></span><button class="dkx-x" data-a="hxclose">✕</button></div><div class="dkx-body pot-body">${body}</div></div>`;
  return `<div class="card pot-page"><h3>💰 Prize Pot — ${G.year}</h3>${body}</div>`;
}
Object.assign(A, {
  potview() { hxOpen(potViewHtml(true)); },
  potrd(el) { const k = el.dataset.v; POTV.open[k] = !POTV.open[k]; if (document.getElementById('dkx-ov')) hxOpen(potViewHtml(true)); else render(); }
});
const _pot_hqTabs = hqTabs;
hqTabs = function () { const t = _pot_hqTabs.apply(this, arguments); if (potOn() && !t.includes('pot')) { const i = t.indexOf('standings'); t.splice(i + 1, 0, 'pot'); } return t; };
TAB_NAMES.pot = '💰 Prize Pot';
const _pot_viewHQ = viewHQ;
viewHQ = function () { if (TAB === 'pot' && potOn()) { ensureXP(G); return potViewHtml(false); } return _pot_viewHQ.apply(this, arguments); };
