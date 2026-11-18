// ===================== TV broadcast layer (live race) =====================
// • Director camera: a zoomed TV picture that cuts to incidents, overtakes, pit stops and the closest battle
// • Lower-third graphics: battle banner with a gap-trend sparkline, pit-window projection, race leader, fastest lap
// • Commentary: a play-by-play voice and an analyst, shown as captions and as a "Commentary" tab in the events panel
// • Team radio: short messages between drivers and engineers, in the events panel under "Radio"
// • Instant replay of the latest overtake or incident, slowed down, in the TV picture
const BC_VOICES = { pbp: 'ROWE', ana: 'ORTEGA' };
const BC = { race: null, buf: [], last: -1, prev: null, inPit: new Set(), outs: new Set(), spin: new Set(), worn: new Set(), leader: null, fl: null, sc: 0, vsc: 0,
  clips: [], cam: null, replay: null, pendRep: null, comm: [], lastComm: 0, lastRadio: 0, cap: null, lastGfx: 0, nextAna: 0, started: false, ltg: {}, pairT: {}, q: [], lastS: '',
  mode: 'auto', hidden: false, cc: true, autoRep: true, finished: false };
try { const s = JSON.parse(localStorage.getItem('pitwall_bc') || '{}'); ['mode', 'hidden', 'cc', 'autoRep'].forEach(k => { if (s[k] != null) BC[k] = s[k]; }); } catch (e) { }
function bcSave() { try { localStorage.setItem('pitwall_bc', JSON.stringify({ mode: BC.mode, hidden: BC.hidden, cc: BC.cc, autoRep: BC.autoRep })); } catch (e) { } }
function bcReset(R) {
  Object.assign(BC, { race: R, buf: [], last: -1, prev: null, inPit: new Set(), outs: new Set(), spin: new Set(), worn: new Set(), leader: null, fl: null, sc: 0, vsc: 0,
    clips: [], cam: null, replay: null, pendRep: null, comm: [], lastComm: 0, lastRadio: 0, cap: null, lastGfx: 0, nextAna: 0, started: false, ltg: {}, finished: false, pairT: {}, q: [], lastS: '' });
}
const bcNow = () => performance.now();
const bcCode = c => c.d.code;
const bcName = c => dkShort(c.d);
const bcLive = () => typeof RACE !== 'undefined' && RACE && WK && (WK.stage === 'race' || WK.stage === 'sprint') && document.getElementById('dk') && DK.view !== 'tele';

// ---------- sampling (game time) ----------
const _bc_step = Race.prototype.step;
Race.prototype.step = function (dt) {
  const r = _bc_step.apply(this, arguments);
  if (this === (typeof RACE !== 'undefined' ? RACE : null)) { try { bcSample(this); } catch (e) { } }
  return r;
};
function bcSample(R) {
  if (BC.race !== R) bcReset(R);
  if (R.t - BC.last < 0.5) return; BC.last = R.t;
  BC.buf.push({ t: R.t, d: R.cars.map(c => c.pitT > 0 ? -c.dist : c.dist) });
  while (BC.buf.length && BC.buf[0].t < R.t - 100) BC.buf.shift();
  if (!R.started) return;
  const ord = R.order().filter(c => !c.out), lead = ord[0];
  if (!BC.started) { BC.started = true; bcComm('pbp', `And it's lights out and away we go at ${R.track.name}!`, 3); }
  if (R.chequered) { if (!BC.finished) { BC.finished = true; bcFinish(R); } return; }
  // overtakes (not through the pits, not under the safety car)
  const pos = new Map(ord.map((c, i) => [c, i]));
  if (BC.prev && !R.sc && !R.vsc) {
    let n = 0;
    ord.forEach((c, i) => {
      const was = BC.prev.get(c); if (was == null || was <= i || c.pitT > 0 || BC.inPit.has(c)) return;
      ord.slice(i + 1).forEach(b => { const wb = BC.prev.get(b); if (wb == null || wb >= was || b.pitT > 0 || BC.inPit.has(b) || n >= 3) return;
        // side-by-side cars swap order back and forth: count one pass per pair every 10 s
        const k = c.d.id < b.d.id ? c.d.id + b.d.id : b.d.id + c.d.id, lt = BC.pairT[k]; BC.pairT[k] = R.t; if (lt != null && R.t - lt < 10) return;
        n++; bcEvent(R, { type: 'pass', a: c, b, pos: i + 1 }); });
    });
  }
  BC.prev = pos;
  R.cars.forEach(c => {
    if (c.out && !BC.outs.has(c)) { BC.outs.add(c); bcEvent(R, { type: 'out', a: c, why: c.out }); }
    if (c.out) return;
    if (c.pitT > 0 && !BC.inPit.has(c)) { BC.inPit.add(c); bcEvent(R, { type: 'pit', a: c, pos: (pos.get(c) ?? 0) + 1 }); }
    else if (c.pitT <= 0) BC.inPit.delete(c);
    const sp = c.spin > 0 || c.off > 0;
    if (sp && !BC.spin.has(c)) { BC.spin.add(c); bcEvent(R, { type: 'spin', a: c, pos: (pos.get(c) ?? 0) + 1 }); } else if (!sp) BC.spin.delete(c);
    if (c.wear > 0.8 && !BC.worn.has(c) && (pos.get(c) ?? 99) < 12 && R.laps - c.laps > 3) { BC.worn.add(c); bcRadio(R, c, 'driver', pick(['The tyres are gone, mate.', 'No grip. Rears are finished.', "I can't keep this pace, the tyres are dead.", 'How much longer on these?'])); }
    if (c.wear < 0.2) BC.worn.delete(c);
  });
  if (lead && BC.leader && lead !== BC.leader && !BC.inPit.has(BC.leader) && !BC.leader.out && R.t > 8) bcEvent(R, { type: 'lead', a: lead, b: BC.leader });
  BC.leader = lead;
  if (R.fastest && R.fastest.t !== BC.fl) { const first = BC.fl == null; BC.fl = R.fastest.t; if (!first || R.leaderLap > 3) bcEvent(R, { type: 'fl', a: R.fastest.c, t: R.fastest.t }); }
  if (R.sc && !BC.sc) bcEvent(R, { type: 'sc' }); if (!R.sc && BC.sc) bcEvent(R, { type: 'scin' }); BC.sc = R.sc ? 1 : 0;
  if (R.vsc && !BC.vsc) bcEvent(R, { type: 'vsc' }); BC.vsc = R.vsc ? 1 : 0;
  const togo = R.laps - (lead ? lead.laps : 0);
  [10, 5, 1].forEach(k => { if (togo === k && !BC.ltg[k] && R.laps > k + 2) { BC.ltg[k] = 1; bcEvent(R, { type: 'togo', k, a: lead }); } });
}
function bcGap(R, a, b) { return Math.max(0, (a.dist - b.dist) / (R.L / Math.max(40, b.curLT))); }

// ---------- events → director, commentary, radio ----------
function bcEvent(R, ev) {
  ev.t = R.t; ev.lap = Math.min(R.laps, (R.leaderLap || 0) + 1);
  const top = c => { const o = R.order(); return o.indexOf(c) < 10; };
  const fav = c => c && (c.fav || c.player);
  const tyre = c => TYRES[c.tyre] ? TYRES[c.tyre].name : '';
  switch (ev.type) {
    case 'pass': {
      const { a, b, pos } = ev, lead = pos === 1;
      bcClip(ev, [a, b], `${bcCode(a)} on ${bcCode(b)}`);
      if (pos <= 10 || fav(a) || fav(b)) bcCut({ kind: 'pass', cars: [a, b], tag: lead ? 'NEW LEADER' : 'OVERTAKE', col: '#1f9d55', text: `${bcName(a)} passes ${bcName(b)} for P${pos}`, prio: lead ? 4 : 3, hold: 4500 });
      if (lead) bcComm('pbp', pick([`${bcName(a)} takes the lead of the Grand Prix!`, `Into the lead goes ${bcName(a)}! ${bcName(b)} couldn't hold on.`]), 3);
      else if (pos <= 10 || fav(a)) bcComm('pbp', pick([`${bcName(a)} goes past ${bcName(b)} — that's P${pos}.`, `Lovely move from ${bcName(a)}, up to P${pos} at ${bcName(b)}'s expense.`, `${bcName(a)} makes it stick on ${bcName(b)}!`, `And ${bcName(b)} has to give way — ${bcName(a)} through into P${pos}.`]), 2);
      if (pos <= 8 && Math.random() < 0.45) {
        const dAge = b.age - a.age;
        bcComm('ana', dAge >= 6 ? `That's the tyre offset doing the work — ${bcName(a)}'s ${tyre(a)}s are ${dAge} laps fresher.` : a.tyre !== b.tyre && TYRES[a.tyre] && TYRES[b.tyre] ? `${tyre(a)} against ${tyre(b)} — different strategies, and right now it favours ${bcName(a)}.` : pick([`Brave, late on the brakes. ${bcName(b)} left the door open.`, `${bcName(a)} had been setting that up for a couple of laps.`, `Great racecraft from ${bcName(a)}.`]), 1);
      }
      if (Math.random() < 0.3) bcRadio(R, a, 'driver', pick(['Yes! Get in there!', 'Easy, easy.', `That's P${pos}!`, 'Mega. Keep pushing?']));
      else if (Math.random() < 0.2) bcRadio(R, b, 'driver', pick(['He just pushed me off the track!', 'No grip, no grip.', "I can't hold him on these tyres.", 'Did you see that? He left me no room.']));
      break;
    }
    case 'lead': break;
    case 'pit': {
      const { a, pos } = ev; if (pos <= 8 || fav(a)) bcCut({ kind: 'pit', cars: [a], tag: 'PIT STOP', col: '#2d6cdf', text: `${bcName(a)} pits from P${pos} → ${tyre(a)}s`, prio: 2, hold: 4500 });
      if (pos <= 6 || fav(a)) bcComm('pbp', `${bcName(a)} peels into the pit lane from P${pos}.`, 1);
      bcRadio(R, a, 'eng', pick([`Box, box. ${tyre(a)}s.`, 'Box this lap, box this lap.', `Pit confirm. ${tyre(a)}s, ${tyre(a)}s.`]));
      break;
    }
    case 'out': {
      const { a, why } = ev; bcClip(ev, [a], `${bcCode(a)} · ${why}`);
      if (/^Eliminated/.test(why)) { bcCut({ kind: 'inc', cars: [a], tag: 'ELIMINATED', col: '#c0392b', text: `${bcName(a)} is eliminated`, prio: 5, hold: 4500 }); bcComm('pbp', `${bcName(a)} is eliminated!`, 2); break; }
      bcCut({ kind: 'inc', cars: [a], tag: 'RETIREMENT', col: '#c0392b', text: `${bcName(a)} is out — ${why}`, prio: 5, hold: 5500 });
      bcComm('pbp', pick([`Oh no — ${bcName(a)} is out of the race! ${why}.`, `That's the end of ${bcName(a)}'s afternoon. ${why}.`]), 3);
      const ds = standingsDrivers(G), p = ds.findIndex(d => d.id === a.d.id);
      if (p >= 0 && p < 3 && G.results.length) bcComm('ana', `A big blow for ${bcName(a)}'s championship — he came into this race P${p + 1} in the standings.`, 2);
      bcRadio(R, a, /crash|collision|wall|accident|spun|barrier/i.test(why) ? 'driver' : 'eng', /crash|collision|wall|accident|spun|barrier/i.test(why) ? pick(["I'm OK. I'm sorry, guys.", 'I just lost it. Sorry.', 'He turned in on me!']) : pick(['Stop the car, stop the car.', "We've lost it, we need to retire the car.", "Sorry, it's over. Pull over safely."]));
      break;
    }
    case 'spin': {
      const { a, pos } = ev; bcClip(ev, [a], `${bcCode(a)} moment`);
      if (pos <= 12 || fav(a)) bcCut({ kind: 'inc', cars: [a], tag: 'INCIDENT', col: '#c0392b', text: `${bcName(a)} has a moment from P${pos}`, prio: 4, hold: 4500 });
      if (pos <= 12 || fav(a)) bcComm('pbp', pick([`${bcName(a)} has a moment! He's lost time there.`, `Big snap of oversteer for ${bcName(a)}!`, `${bcName(a)} off the road — he gets going again.`]), 2);
      if (Math.random() < 0.6) bcRadio(R, a, 'driver', pick(['Sorry guys, I lost the rear.', 'Snap oversteer, no warning.', 'I locked up, sorry.']));
      break;
    }
    case 'fl': if (ev.a && (top(ev.a) || fav(ev.a))) { bcComm('ana', `Fastest lap for ${bcName(ev.a)}, a ${fmtTime(ev.t)}.`, 1); bcRadio(R, ev.a, 'eng', pick(['Fastest lap, nice job.', 'Purple! Fastest lap.', 'Great lap, that is the fastest of the race.'])); } break;
    case 'sc': bcComm('pbp', 'Safety car! The safety car is coming out, and the field will bunch right up.', 3); bcComm('ana', 'A cheap pit stop for anyone who still needs one — watch the pit lane.', 2); { const c = R.order().find(x => !x.out); if (c) bcRadio(R, c, 'eng', 'Safety car, safety car. Stay above the delta.'); } break;
    case 'scin': bcComm('pbp', 'Safety car in this lap — get ready for the restart!', 2); break;
    case 'vsc': bcComm('pbp', 'Virtual safety car deployed. Everyone has to slow down.', 2); break;
    case 'togo': {
      const o = R.order().filter(c => !c.out), a = o[0], b = o[1], g = a && b ? bcGap(R, a, b) : 0;
      bcComm('pbp', ev.k === 1 ? `Last lap! ${a ? bcName(a) + ' leads' + (b ? ` by ${g.toFixed(1)} seconds.` : '.') : ''}` : `${ev.k} laps to go. ${a ? bcName(a) + ' leads' : ''}${b ? ` ${bcName(b)} by ${g.toFixed(1)} seconds.` : '.'}`, 2);
      if (a && ev.k <= 5) bcRadio(R, a, 'eng', ev.k === 1 ? 'Last lap. Bring it home.' : `${ev.k} laps. Gap is ${g.toFixed(1)}, manage it.`);
      break;
    }
  }
}
function bcFinish(R) {
  const o = R.order().filter(c => c.finished), w = o[0]; if (!w) return;
  const gp = WK.track.short;
  bcComm('pbp', `${bcName(w)} wins the ${gp}${R.sprint ? ' Sprint' : ' Grand Prix'}!`, 3);
  if (o[1] && o[2]) bcComm('ana', `${bcName(o[1])} second, ${bcName(o[2])} completes the podium.`, 2);
  bcCut({ kind: 'lead', cars: [w], tag: 'CHEQUERED FLAG', col: '#e6ebf5', text: `${bcName(w)} wins${o[1] ? ` · ${bcName(o[1])} P2 · ` : ''}${o[2] ? bcName(o[2]) + ' P3' : ''}`, prio: 6, hold: 9000 });
  bcRadio(R, w, 'eng', R.sprint ? 'P1 in the sprint! Great job.' : "P1! You've won the Grand Prix! Fantastic job!");
  if (Math.random() < 0.7) bcRadio(R, w, 'driver', pick(['YES! Woohoo! Thank you, guys!', 'What a car, what a team. Thank you!', 'Come on! We did it!']));
}
function bcComm(who, s, prio = 1) {
  const now = bcNow();
  if (s === BC.lastS) return;
  const LV = BC.lastV || (BC.lastV = {}), lastMe = LV[who] || 0;
  if (prio < 3 && (now - lastMe < (prio >= 2 ? 1200 : 2600) || now - BC.lastComm < 700)) { if (who === 'ana' || prio >= 2) { BC.q.push({ who, s, prio, t: now }); if (BC.q.length > 3) BC.q.shift(); } return; }
  LV[who] = now;
  BC.lastS = s;
  BC.lastComm = now;
  const e = { lap: Math.min(RACE.laps, (RACE.leaderLap || 0) + 1), who, s, at: now };
  BC.comm.unshift(e); if (BC.comm.length > 120) BC.comm.pop();
  BC.cap = e;
}
function bcRadio(R, c, from, s) {
  const now = bcNow(); if (!c || now - BC.lastRadio < 1100) return; BC.lastRadio = now;
  R.msg(`📻 ${c.d.code} ${from === 'eng' ? '(engineer)' : ''}: "${s}"`.replace(' :', ':'), false);
}
function bcClip(ev, cars, label) {
  BC.clips.unshift({ t: ev.t, lap: ev.lap, cars, label, kind: ev.type }); if (BC.clips.length > 12) BC.clips.pop();
  if (BC.autoRep && SPEED <= 16 && (ev.type === 'out' || ev.type === 'spin' || (ev.type === 'pass' && ev.pos <= 3)) && !BC.replay) BC.pendRep = { clip: BC.clips[0], at: bcNow() + 3800 };
}
function bcCut(cam) {
  const now = bcNow(), cur = BC.cam;
  if (cur && now < cur.until && cam.prio < cur.prio) return;
  if (BC.mode === 'follow' && RACE.cars.some(c => c.fav) && cam.prio < 5 && !cam.cars.some(c => c.fav)) return;
  BC.cam = Object.assign(cam, { at: now, until: now + cam.hold });
}

// ---------- director idle choices (real time, on each UI update) ----------
function bcDirect() {
  const R = RACE, now = bcNow();
  if (BC.pendRep && now >= BC.pendRep.at && !BC.replay) { bcStartReplay(BC.pendRep.clip); BC.pendRep = null; }
  while (BC.q.length && now - BC.q[0].t > 9000) BC.q.shift();
  if (BC.q.length && now - BC.lastComm > 1500) { const x = BC.q.shift(); bcComm(x.who, x.s, 3); }
  if (BC.cam && now < BC.cam.until) { bcRefreshText(); return; }
  const ord = R.order().filter(c => !c.out);
  const fav = R.cars.find(c => c.fav && !c.out);
  if (!R.started) { BC.cam = { kind: 'grid', cars: [ord[0]], tag: 'THE GRID', col: '#3b4252', text: `${bcName(ord[0])} on pole · ${R.laps} laps`, prio: 0, at: now, until: now + 3000 }; return; }
  if (BC.mode === 'follow' && fav) { BC.cam = { kind: 'follow', cars: [fav], tag: 'ONBOARD', col: fav.t.color, prio: 0, at: now, until: now + 3000 }; bcRefreshText(); return; }
  // pit-window graphic every ~30 s
  if (now - BC.lastGfx > 30000 && R.laps - (ord[0] ? ord[0].laps : 0) > 6) {
    const cand = ord.slice(0, 8).concat(fav ? [fav] : []).filter(c => c.pitT <= 0 && c.wear > 0.42 && !c.finished).sort((a, b) => b.wear - a.wear)[0];
    if (cand) { BC.lastGfx = now; BC.cam = { kind: 'pitwin', cars: [cand], tag: 'PIT WINDOW', col: '#2d6cdf', prio: 1, at: now, until: now + 6500 }; bcRefreshText(); return; }
  }
  let best = null;
  for (let i = 1; i < Math.min(ord.length, 14); i++) { const a = ord[i - 1], b = ord[i]; if (a.pitT > 0 || b.pitT > 0 || a.finished) continue; const g = bcGap(R, a, b); if (g < 1.1 && (!best || g - (i < 4 ? 0.3 : 0) < best.g)) best = { a, b, i, g }; }
  if (best) BC.cam = { kind: 'battle', cars: [best.a, best.b], tag: `BATTLE FOR P${best.i}`, col: '#f59e0b', prio: 1, at: now, until: now + 7000 };
  else if (fav && Math.random() < 0.4) BC.cam = { kind: 'follow', cars: [fav], tag: 'FOLLOWING', col: fav.t.color, prio: 0, at: now, until: now + 6000 };
  else BC.cam = { kind: 'lead', cars: [ord[0]], tag: 'RACE LEADER', col: '#e6ebf5', prio: 0, at: now, until: now + 6000 };
  bcRefreshText();
  if (now > BC.nextAna) { BC.nextAna = now + 14000; bcAnalysis(); }
}
function bcTrend(a, b) {
  const n1 = Math.min(a.cross.length, b.cross.length) - 1, pts = [];
  for (let n = Math.max(1, n1 - 5); n <= n1; n++) if (a.cross[n] != null && b.cross[n] != null) pts.push(b.cross[n] - a.cross[n]);
  return pts;
}
function bcSpark(v) {
  if (v.length < 2) return '';
  const max = Math.max(...v, 0.5), W = 64, H = 18, X = i => i / (v.length - 1) * W, Y = x => H - 2 - (Math.min(x, max) / max) * (H - 4);
  return `<svg class="bc-spark" viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="#fff" stroke-width="1.6" points="${v.map((x, i) => X(i).toFixed(1) + ',' + Y(x).toFixed(1)).join(' ')}"/></svg>`;
}
function bcRefreshText() {
  const R = RACE, C = BC.cam; if (!C) return;
  const ord = R.order(), p = c => ord.indexOf(c) + 1;
  if (C.kind === 'battle') {
    const [a, b] = C.cars, g = bcGap(R, a, b), tr = bcTrend(a, b), d = tr.length >= 2 ? (tr[tr.length - 1] - tr[0]) / (tr.length - 1) : 0;
    C.text = `${bcName(a)} vs ${bcName(b)} · ${g.toFixed(2)} s${Math.abs(d) > 0.05 ? ` · ${d < 0 ? 'closing' : 'pulling away'} ${Math.abs(d).toFixed(2)} s/lap` : ''}`;
    C.spark = bcSpark(tr);
    if (g < 0.6 && C.drs !== b.laps && Math.random() < 0.3) { C.drs = b.laps; bcRadio(R, b, 'eng', `Gap ${g.toFixed(1)}. DRS next lap, go for it.`); }
  } else C.spark = '';
  if (C.kind === 'pitwin') {
    const c = C.cars[0], loss = R.track.pit + 2.6, mine = p(c); let rp = mine, ahead = null;
    ord.slice(mine).forEach(b => { if (!b.out && !b.finished && b.pitT <= 0 && bcGap(R, c, b) < loss) { rp++; ahead = b; } });
    C.text = `${bcName(c)} · ${TYRES[c.tyre].name}s ${c.age} laps old (${Math.round(c.wear * 100)}% worn) · a stop now → rejoin P${rp}${ahead ? ` behind ${bcName(ahead)}` : ''}`;
  }
  if (C.kind === 'lead') { const a = C.cars[0], b = ord.filter(c => !c.out)[1]; if (C.tag === 'RACE LEADER') C.text = `${bcName(a)} · ${TYRES[a.tyre].name}s${b ? ` · leads by ${bcGap(R, a, b).toFixed(1)} s` : ''} · lap ${Math.min(R.laps, a.laps + 1)}/${R.laps}`; }
  if (C.kind === 'follow') { const a = C.cars[0]; C.text = `P${p(a)} ${bcName(a)} · ${TYRES[a.tyre].name}s, ${a.age} laps · ${a.stops} stop${a.stops === 1 ? '' : 's'}${a.lastLap ? ' · last lap ' + fmtTime(a.lastLap) : ''}`; }
}
function bcAnalysis() {
  const R = RACE, ord = R.order().filter(c => !c.out), lead = ord[0]; if (!lead || R.chequered) return;
  const opts = [];
  const toStop = ord.filter(c => c.stops === 0).length;
  if (R.laps - lead.laps > 8 && toStop > 3 && lead.laps > R.laps * 0.25 && !R.sprint) opts.push(`${toStop} cars still haven't stopped — the strategy picture will shake out over the next few laps.`);
  if (!R.sprint && G.results.length && G.rules && !(G.rules.heats)) {
    const PT = (G.rules && G.rules.points) || POINTS, ds = standingsDrivers(G).slice(0, 3);
    const live = ds.map(d => { const c = R.cars.find(x => x.d.id === d.id); const pos = c && !c.out ? ord.indexOf(c) + 1 : 0; return { d, pts: d.pts + (pos && pos <= PT.length ? PT[pos - 1] : 0) }; }).sort((a, b) => b.pts - a.pts);
    if (live.length > 1) opts.push(`As they run, ${dkShort(live[0].d)} would ${live[0].d.id === ds[0].id ? 'extend the championship lead to' : 'take over the championship lead by'} ${live[0].pts - live[1].pts} point${live[0].pts - live[1].pts === 1 ? '' : 's'}.`);
  }
  const fresh = ord.slice(0, 10).filter(c => c.age < 5 && c.stops > 0 && ord.indexOf(c) > 0)[0];
  if (fresh) opts.push(`Watch ${dkShort(fresh.d)} on fresh ${TYRES[fresh.tyre].name.toLowerCase()}s — he should be the fastest man on track for a few laps.`);
  if (R.wet > 0.2) opts.push(R.wet > 0.6 ? 'Full wet conditions — visibility is terrible out there.' : 'Tricky intermediate conditions; one mistake and it is over.');
  const old = ord.slice(0, 6).filter(c => c.wear > 0.6)[0];
  if (old) opts.push(`${dkShort(old.d)}'s tyres are getting old — ${Math.round(old.wear * 100)}% worn. He'll be vulnerable.`);
  if (opts.length) bcComm('ana', pick(opts), 1);
}

// ---------- replay ----------
function bcStartReplay(clip) {
  if (!clip || !BC.buf.length) return;
  const t1 = Math.min(clip.t + 2.5, BC.buf[BC.buf.length - 1].t), t0 = Math.max(BC.buf[0].t, clip.t - 7);
  if (t1 - t0 < 2) return;
  BC.replay = { clip, t0, t1, start: bcNow(), rate: 0.7 };
}
function bcDistAt(i, t) {
  const B = BC.buf; let lo = 0, hi = B.length - 1;
  if (t <= B[0].t) return B[0].d[i]; if (t >= B[hi].t) return B[hi].d[i];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m].t <= t) lo = m; else hi = m; }
  const a = B[lo].d[i], b = B[hi].d[i], f = (t - B[lo].t) / (B[hi].t - B[lo].t || 1);
  if ((a < 0) !== (b < 0)) return f < 0.5 ? a : b;
  return a + (b - a) * f;
}

// ---------- drawing the TV picture ----------
function bcDraw() {
  const cv = document.getElementById('bccam'); if (!cv || BC.hidden || !RACE) return;
  if (!cv._w) dkSize(cv); if (!cv._w) return;
  const R = RACE, ctx = cv.getContext('2d'), w = cv._w, h = cv._h, dpr = cv._dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = trackGeometry(R.track), now = bcNow();
  let rp = BC.replay, tt = null;
  if (rp) { tt = rp.t0 + (now - rp.start) / 1000 * rp.rate; if (tt > rp.t1) { BC.replay = rp = null; tt = null; } }
  const idx = new Map(R.cars.map((c, i) => [c, i]));
  const distOf = c => { if (tt == null) return c.pitT > 0 ? -c.dist : c.dist; return bcDistAt(idx.get(c), tt); };
  const focus = rp ? rp.clip.cars : (BC.cam ? BC.cam.cars : [R.order()[0]]);
  const pts = focus.filter(Boolean).map(c => { const d = distOf(c); return pointAt(g, Math.abs(d) / R.L); });
  if (!pts.length) return;
  let cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // smooth camera motion
  const C = cv._cam || (cv._cam = { x: cx, y: cy });
  const jump = Math.hypot(cx - C.x, cy - C.y) > 0.035; C.x = jump ? cx : C.x + (cx - C.x) * 0.5; C.y = jump ? cy : C.y + (cy - C.y) * 0.5;
  const span = 0.075 + (pts.length > 1 ? Math.min(0.06, Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) * 1.4) : 0);
  const Z = w / span, X = p => (p[0] - C.x) * Z + w / 2, Y = p => (p[1] - C.y) * Z + h / 2;
  // grass
  const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3c5a2d'); gr.addColorStop(1, '#2b4421'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  if (R.wet > 0.05) { ctx.fillStyle = `rgba(40,70,120,${R.wet * 0.35})`; ctx.fillRect(0, 0, w, h); }
  const tw = Math.max(10, Z * 0.0065);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const path = () => { ctx.beginPath(); g.P.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.closePath(); };
  path(); ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = tw * 2.2; ctx.stroke(); // run-off
  path(); ctx.setLineDash([tw * 0.5, tw * 0.5]); ctx.strokeStyle = '#d33'; ctx.lineWidth = tw * 1.18; ctx.stroke(); ctx.setLineDash([]); // kerbs
  path(); ctx.strokeStyle = '#eee'; ctx.lineWidth = tw * 1.08; ctx.stroke();
  path(); ctx.strokeStyle = (R.sc || R.vsc) && !rp ? '#4d4419' : '#3a3d42'; ctx.lineWidth = tw; ctx.stroke();
  // start line
  const s0 = pointAt(g, 0); ctx.save(); ctx.translate(X(s0), Y(s0)); ctx.rotate(s0[2] + Math.PI / 2); const cw = tw / 6; for (let k = -3; k < 3; k++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (k + j) % 2 ? '#fff' : '#111'; ctx.fillRect(k * cw, -cw + j * cw, cw, cw); } ctx.restore();
  // cars
  const ord = R.order();
  ord.slice().reverse().forEach(c => {
    if (c.out && tt == null) return;
    const d = distOf(c); if (d == null) return;
    const p = pointAt(g, Math.abs(d) / R.L); let x = X(p), y = Y(p);
    if (d < 0) { const n = p[2] + Math.PI / 2; x += Math.cos(n) * tw * 1.6; y += Math.sin(n) * tw * 1.6; }
    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) return;
    const L = tw * 0.95, Wd = tw * 0.38;
    ctx.save(); ctx.translate(x, y); ctx.rotate(p[2]);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-L / 2 + 2, -Wd / 2 + 2, L, Wd);
    ctx.fillStyle = '#111'; ctx.fillRect(-L * 0.42, -Wd * 0.75, L * 0.18, Wd * 1.5); ctx.fillRect(L * 0.22, -Wd * 0.75, L * 0.18, Wd * 1.5); // wheels
    ctx.fillStyle = c.t.color; ctx.fillRect(-L / 2, -Wd / 2, L, Wd); ctx.fillRect(L / 2 - 2, -Wd * 0.8, 3, Wd * 1.6); // body + front wing
    ctx.fillStyle = dkInk(c.t.color) === '#fff' ? '#eee' : '#222'; ctx.fillRect(-L * 0.05, -Wd * 0.22, L * 0.18, Wd * 0.44); // halo
    ctx.restore();
    const hi = focus.includes(c) || c.fav;
    ctx.font = `bold ${hi ? 12 : 10}px ui-monospace,monospace`; ctx.textAlign = 'center';
    const lab = `${ord.indexOf(c) + 1} ${c.d.code}`, tw2 = ctx.measureText(lab).width + 8;
    ctx.fillStyle = hi ? c.t.color : 'rgba(0,0,0,.6)'; ctx.fillRect(x - tw2 / 2, y - tw * 1.05 - 13, tw2, 15);
    ctx.fillStyle = hi ? dkInk(c.t.color) : '#fff'; ctx.fillText(lab, x, y - tw * 1.05 - 2); ctx.textAlign = 'left';
  });
  // tags
  ctx.font = 'bold 11px ui-monospace,monospace';
  if (rp) { ctx.fillStyle = '#e10600'; ctx.fillRect(8, 8, 74, 18); ctx.fillStyle = '#fff'; ctx.fillText('⟲ REPLAY', 13, 21); ctx.fillStyle = 'rgba(0,0,0,.6)'; const s = `LAP ${rp.clip.lap} · ${rp.clip.label}`; ctx.fillRect(86, 8, ctx.measureText(s).width + 10, 18); ctx.fillStyle = '#fff'; ctx.fillText(s, 91, 21); }
  else { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(8, 8, 52, 18); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(17, 17, 4, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('LIVE', 25, 21); }
}

// ---------- DOM ----------
function bcCamHtml() {
  return `<div class="bc-cam ${BC.hidden ? 'off' : ''}" id="bccamw"><canvas id="bccam"></canvas>
    <div class="bc-ctl"><button data-a="bcmode" title="Camera: director picks the action, or stay with the driver you follow">${BC.mode === 'auto' ? '🎬 DIRECTOR' : '⭐ FOLLOW'}</button><button data-a="bcrep" id="bcrepb" title="Replay the latest overtake or incident">⟲ REPLAY</button><button data-a="bccc" class="${BC.cc ? 'on' : ''}" title="Commentary captions">CC</button><button data-a="bcauto" class="${BC.autoRep ? 'on' : ''}" title="Automatic replays of big moments">AUTO ⟲</button><button data-a="bchide" title="Hide the TV picture">✕</button></div></div>
    <button class="bc-show ${BC.hidden ? '' : 'off'}" data-a="bchide" id="bcshow">📺 TV</button>
    <div class="bc-l3" id="bcl3"></div><div class="bc-cap" id="bccap"></div>`;
}
const _bc_deskLive = deskLive;
deskLive = function (kind) {
  let html = _bc_deskLive.apply(this, arguments);
  if (kind !== 'race' || DK.view === 'tele') return html;
  html = html.replace('<div class="dk-mapbox"><canvas id="cv"></canvas>', '<div class="dk-mapbox"><canvas id="cv"></canvas>' + bcCamHtml());
  html = html.replace('data-v="radio">Radio</button>', `data-v="radio">Radio</button><button class="${DK.evf === 'comm' ? 'on' : ''}" data-a="dkevf" data-v="comm">Commentary</button>`);
  html = html.replace('<button data-a="dkmodal" data-v="weather">⛅ Weather Forecast</button>', '<button data-a="dkmodal" data-v="strategy">🛞 Tyre Strategy</button><button data-a="dkmodal" data-v="weather">⛅ Weather Forecast</button>');
  return html;
};
const _bc_dkUpdate = dkUpdate;
dkUpdate = function () {
  const r = _bc_dkUpdate.apply(this, arguments);
  try { if (bcLive()) bcUi(); } catch (e) { }
  return r;
};
function bcUi() {
  if (BC.race !== RACE) bcReset(RACE);
  bcDirect();
  const C = BC.cam, l3 = document.getElementById('bcl3');
  const rp = BC.replay;
  const html = rp ? `<span class="bc-tag" style="background:#e10600">REPLAY</span><span class="bc-txt">Lap ${rp.clip.lap} · ${esc(rp.clip.label)}</span>`
    : C && C.text ? `<span class="bc-tag" style="background:${C.col};color:${dkInk(C.col)}">${esc(C.tag)}</span><span class="bc-txt">${esc(C.text)}</span>${C.spark || ''}` : '';
  if (l3 && l3._h !== html) { l3.innerHTML = html; l3._h = html; l3.classList.toggle('on', !!html); }
  const cap = document.getElementById('bccap'), show = BC.cc && BC.cap && bcNow() - BC.cap.at < 7000;
  const ch = show ? `<b>${BC_VOICES[BC.cap.who]}:</b> ${esc(BC.cap.s)}` : '';
  if (cap && cap._h !== ch) { cap.innerHTML = ch; cap._h = ch; cap.classList.toggle('on', !!ch); }
  const rb = document.getElementById('bcrepb'); if (rb) rb.disabled = !BC.clips.length;
  if (DK.evf === 'comm') {
    const ev = document.getElementById('dkev');
    const h = BC.comm.length ? BC.comm.slice(0, 60).map(e => `<div class="dkev bc-cm"><span class="tag" style="background:${e.who === 'pbp' ? '#b45309' : '#0e7490'}">${BC_VOICES[e.who]}</span><span class="lab">L${e.lap}</span><span>${esc(e.s)}</span></div>`).join('') : '<div class="dk-mut">The commentators will pick up the story once the lights go out.</div>';
    if (ev && ev._h !== h) { ev.innerHTML = h; ev._h = h; }
  }
}
const _bc_dkDraw = dkDraw;
dkDraw = function () { const r = _bc_dkDraw.apply(this, arguments); try { if (bcLive()) bcDraw(); } catch (e) { } return r; };
const _bc_render = render;
render = function () { const r = _bc_render.apply(this, arguments); requestAnimationFrame(() => { const cv = document.getElementById('bccam'); if (cv) { cv._w = 0; dkSize(cv); } }); return r; };
window.addEventListener('resize', () => { const cv = document.getElementById('bccam'); if (cv) dkSize(cv); });
Object.assign(A, {
  bcmode() { BC.mode = BC.mode === 'auto' ? 'follow' : 'auto'; if (BC.mode === 'follow' && !RACE.cars.some(c => c.fav)) { BC.mode = 'auto'; toast && toast('Click a driver in the order to follow them first.'); } BC.cam = null; bcSave(); const b = document.querySelector('[data-a=bcmode]'); if (b) b.textContent = BC.mode === 'auto' ? '🎬 DIRECTOR' : '⭐ FOLLOW'; },
  bcrep() { BC.pendRep = null; bcStartReplay(BC.clips[0]); },
  bccc(el) { BC.cc = !BC.cc; el.classList.toggle('on', BC.cc); bcSave(); },
  bcauto(el) { BC.autoRep = !BC.autoRep; el.classList.toggle('on', BC.autoRep); bcSave(); },
  bchide() { BC.hidden = !BC.hidden; bcSave(); const w = document.getElementById('bccamw'), s = document.getElementById('bcshow'); if (w) w.classList.toggle('off', BC.hidden); if (s) s.classList.toggle('off', !BC.hidden); if (!BC.hidden) { const cv = document.getElementById('bccam'); if (cv) dkSize(cv); } },
});
if (typeof toast !== 'function') window.toast = s => { try { RACE && RACE.msg(s); } catch (e) { } };
