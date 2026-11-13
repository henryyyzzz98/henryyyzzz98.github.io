// ===================================================================
// PITWALL EXPANSION — race-time systems (hooks into the Race engine)
// ===================================================================
function ersOn(G) { return G.year >= 2014; }
function modeNames(G) { return ersOn(G) ? { harvest: 'Harvest', balanced: 'Balanced', overtake: 'Overtake' } : { harvest: 'Lean mix', balanced: 'Standard', overtake: 'Rich mix' }; }

XPH.raceInit = race => {
  const G = race.G; ensureXP(G);
  race.lapPos = []; race.replay = []; race.highlights = []; race.pendingClips = []; race.radio = []; race.comm = []; race.teamOrder = 'free';
  race.pitGfx = null; race.lastLeader = null; race.outCount = 0; race.lastRec = 0; race.commLap = 0;
  race.cars.forEach(c => {
    c.ers = 'balanced'; c.battery = 60; c.stints = [{ tyre: c.tyre, from: 0 }]; c.puStress = 1; c.radioFlags = {};
    if (typeof WK !== 'undefined' && WK && WK.sets && WK.sets[c.d.id]) c.wear = takeSet(c.d.id, c.tyre, c.grid <= 10 && G.year >= 2014 && G.year < 2022 ? 'used' : null);
  });
};
XPH.lapDelta = (race, c) => {
  if (!c.ers) return 0;
  if (c.ers === 'overtake' && c.battery > 0) return -0.35;
  if (c.ers === 'harvest') return 0.25;
  return 0;
};
XPH.passMul = (race, c, ahead) => {
  let m = 1;
  if (c.player && ahead.player) {
    if (ahead.yieldTo === c.d.id) return Infinity;
    if (race.teamOrder === 'hold' && !c.ignoring) return 0;
  }
  if (c.ers === 'overtake' && c.battery > 0) m *= 1.6;
  if (ahead.ers === 'overtake' && ahead.battery > 0) m *= 0.75;
  if (race.G.year >= 2011 && c.laps >= 2) m *= 1.25; // DRS
  return m;
};
XPH.pitService = (race, c) => {
  if (!c.player || !race.G.xp) return undefined;
  const r = race.G.xp.staff.crew.rating;
  return clamp(3.25 - (r - 50) * 0.026 + gauss() * 0.22, 1.85, 4.5);
};
XPH.slowStopP = (race, c) => clamp(0.05 - race.G.xp.staff.crew.rating * 0.00045, 0.006, 0.05);
XPH.pitTyre = (race, c, comp) => (typeof WK !== 'undefined' && WK && WK.sets ? takeSet(c.d.id, comp) : 0);
XPH.onPit = (race, c, comp, svc) => {
  c.stints.push({ tyre: comp, from: c.laps }); c.radioFlags.tyre = false;
  if (c.player || c.fav || race.order().indexOf(c) < 5) race.pitGfx = { c, svc, t: race.t, comp };
  SND.pit();
};
XPH.relMul = (race, c) => {
  const st = race.G.xp && race.G.xp.pu[c.d.id]; let m = 1;
  if (st && st.wear > 0.8) m *= 1 + (st.wear - 0.8) * 9;
  if (c.ers === 'overtake') m *= 1.1;
  return m;
};
XPH.onLap = (race, c, n) => {
  const G = race.G; const ord = race.order(); const pos = ord.indexOf(c); const ahead = ord[pos - 1];
  const gapAhead = ahead && !ahead.out ? (ahead.dist - c.dist) / (race.L / c.curLT) : 99;
  // battery / engine mode
  if (c.ers === 'overtake') { c.battery -= 28; c.puStress += 0.02; if (c.battery <= 0) { c.battery = 0; c.ers = 'balanced'; if (c.player) radio(race, c, 'Battery is empty, back to balanced mode.'); } }
  else if (c.ers === 'harvest') c.battery = Math.min(100, c.battery + 22);
  else c.battery = Math.min(100, c.battery + 4);
  if (!c.player || c.auto) c.ers = gapAhead < 1 && c.battery > 40 ? 'overtake' : c.battery < 25 ? 'harvest' : 'balanced';
  // lap chart snapshot when the leader completes a lap
  if (pos === 0 && n > race.lapPos.length) race.lapPos.push(ord.filter(x => !x.out).map(x => x.d.id));
  if (c.ignoring && n > c.ignoring) c.ignoring = 0;
  if (c.yieldTo && n > c.yieldLap + 1) c.yieldTo = null;
  // team radio
  const loud = c.player || c.fav;
  if (loud && !c.finished && !c.out) {
    if (c.wear > 0.72 && !c.radioFlags.tyre) { c.radioFlags.tyre = true; radio(race, c, pick(['The tyres are gone, I can\'t push anymore.', 'Rears are finished, mate.', 'I\'m losing so much grip, these tyres are dead.']), c.player ? [['Box this lap', 'box'], ['Stay out', 'stay']] : null); }
    if (race.wet > 0.25 && 'SMH'.includes(c.tyre) && !c.radioFlags.rain) { c.radioFlags.rain = true; radio(race, c, pick(['It\'s raining in sector 2!', 'Track is getting really slippery here.', 'Rain! I need inters.']), c.player ? [['Box for inters', 'inter'], ['Stay out', 'stay']] : null); }
    if (race.wet < 0.15 && 'IW'.includes(c.tyre) && !c.radioFlags.dry) { c.radioFlags.dry = true; radio(race, c, 'There\'s a dry line now, slicks soon?', c.player ? [['Box for slicks', 'slick'], ['Stay out', 'stay']] : null); }
    if (c.player && ahead && ahead.player && race.teamOrder !== 'hold' && ahead.curLT - c.curLT > 0.35 && gapAhead < 1.5 && !c.radioFlags.swap) { c.radioFlags.swap = n; radio(race, c, `I'm much faster than ${ahead.d.code}, let me through!`, [['Swap positions', 'swap'], ['Hold positions', 'hold']]); }
    if (c.radioFlags.swap && n - c.radioFlags.swap > 6) c.radioFlags.swap = 0;
  }
  if (n === race.laps && pos === 0) radio(race, c, pick(['YES! Get in there! What a car!', 'Let\'s gooo! Thank you guys!', 'Unbelievable. That one\'s for the whole team.']));
  // commentary on the battle at the front every few laps
  if (pos === 0 && n >= race.commLap + 4 && !race.chequered) {
    race.commLap = n;
    const b = topBattle(race); if (b) comment(race, pick([`${b.b.d.name.split(' ').pop()} is all over the back of ${b.a.d.name.split(' ').pop()} in the fight for P${b.pos} — just ${b.gap.toFixed(1)}s between them.`, `Pressure building for P${b.pos}: ${b.b.d.code} is ${b.gap.toFixed(1)} seconds behind ${b.a.d.code}.`, `Keep an eye on P${b.pos}, ${b.b.d.code} has closed right up on ${b.a.d.code}.`]));
    else comment(race, `Lap ${n} of ${race.laps}: ${c.d.name} leads${ord[1] ? `, ${(gapSecondsSafe(race, ord[1], c)).toFixed(1)}s clear of ${ord[1].d.code}` : ''}.`);
  }
};
function gapSecondsSafe(race, c, leader) { return Math.max(0, (leader.dist - c.dist) / (race.L / leader.curLT)); }
function topBattle(race, maxPos = 10) {
  const ord = race.order().filter(c => !c.out && !c.finished && c.pitT <= 0); let best = null;
  for (let i = 1; i < Math.min(ord.length, maxPos); i++) { const a = ord[i - 1], b = ord[i]; const gap = (a.dist - b.dist) / (race.L / b.curLT); if (gap < 1.2 && gap > 0 && (!best || i < best.pos - 1 || gap < best.gap * 0.6)) best = { a, b, gap, pos: i }; }
  return best;
}
function radio(race, c, txt, actions) { race.radio.unshift({ t: race.t, lap: race.leaderLap, c, txt, actions: actions || null, id: Math.random().toString(36).slice(2, 7) }); if (race.radio.length > 6) race.radio.pop(); SND.blip(); }
function comment(race, txt) { race.comm.unshift({ lap: race.leaderLap, txt }); if (race.comm.length > 40) race.comm.pop(); }

// commentary from race-control messages
const _raceMsg = Race.prototype.msg;
Race.prototype.msg = function (s, imp) {
  _raceMsg.call(this, s, imp);
  if (!this.comm) return;
  const m = s.match(/^⚔️ (\w+) passes (\w+)/); const name = code => { const c = this.cars.find(x => x.d.code === code); return c ? c.d.name.split(' ').pop() : code; };
  if (m) { const c = this.cars.find(x => x.d.code === m[1]); const p = c ? this.order().indexOf(c) + 1 : 0; comment(this, p === 1 ? `NEW LEADER! ${name(m[1])} gets past ${name(m[2])} and takes the lead of the race!` : pick([`${name(m[1])} makes it stick on ${name(m[2])}${p ? ` for P${p}` : ''}.`, `Lovely move from ${name(m[1])}, through on ${name(m[2])}!`, `${name(m[2])} can't hold off ${name(m[1])}.`])); return; }
  if (/SAFETY CAR deployed/.test(s)) return comment(this, 'The safety car is out! That could change everything for strategy.');
  if (/VIRTUAL SAFETY CAR/.test(s)) return comment(this, 'Virtual safety car — a cheap pit stop for anyone who wants one.');
  if (/^❌ (\w+) out: (.*)/.test(s)) { const [, code, why] = s.match(/^❌ (\w+) out: (.*)/); return comment(this, /Crash|wall|Collision|gravel/.test(why) ? `Oh no, ${name(code)} is in the wall! Race over.` : `Smoke from the back of ${name(code)}'s car… ${why.toLowerCase()}. That's heartbreak.`); }
  if (/🌀 (\w+) spins/.test(s)) return comment(this, `${name(s.match(/🌀 (\w+)/)[1])} has spun! Lost a lot of time there.`);
  if (/Rain is starting/.test(s)) return comment(this, 'Here comes the rain! Who blinks first on tyres?');
  if (/🏁 (.*) wins!/.test(s)) { SND.cheer(); return comment(this, `${s.match(/🏁 (.*) wins!/)[1]} takes the chequered flag and WINS the Grand Prix!`); }
  if (/Lights out/.test(s)) return comment(this, 'Lights out and away we go!');
  if (/Safety car in/.test(s)) return comment(this, 'Safety car is in this lap — get ready for the restart!');
};

// replay buffer + highlight clips
XPH.onStep = (race, dt) => {
  if (race.t - race.lastRec >= 0.5) {
    race.lastRec = race.t;
    race.replay.push({ t: race.t, d: race.cars.map(c => c.out ? null : (c.pitT > 0 ? -1e9 + c.dist : c.dist)) });
    if (race.replay.length > 140) race.replay.shift();
  }
  const ord = race.order(); const leader = ord[0];
  if (race.started && race.lastLeader && leader !== race.lastLeader && !race.chequered && race.leaderLap >= 1) clipLater(race, `Lead change: ${leader.d.code} takes P1`);
  race.lastLeader = leader;
  const outN = race.cars.filter(c => c.out).length;
  if (outN > race.outCount) { const c = race.cars.filter(c => c.out).sort((a, b) => b.dnfLap - a.dnfLap)[0]; if (c && /Crash|wall|Collision|gravel/.test(c.out)) clipLater(race, `${c.d.code} crashes out`); race.outCount = outN; }
  race.pendingClips = race.pendingClips.filter(p => { if (race.t >= p.tEnd) { race.highlights.push({ label: p.label, lap: p.lap, frames: race.replay.filter(f => f.t >= p.t0 && f.t <= p.tEnd).map(f => ({ t: f.t, d: f.d.slice() })) }); if (race.highlights.length > 8) race.highlights.shift(); return false; } return true; });
};
function clipLater(race, label) { if (race.pendingClips.some(p => race.t - p.t < 5)) return; race.pendingClips.push({ label, lap: race.leaderLap, t: race.t, t0: race.t - 18, tEnd: race.t + 6 }); }
XPH.raceFinish = race => {
  race.stintLog = {}; race.cars.forEach(c => { const end = c.out ? c.dnfLap : c.laps; race.stintLog[c.d.id] = c.stints.map((s, i) => [s.tyre, Math.max(0, (c.stints[i + 1] ? c.stints[i + 1].from : end) - s.from)]); });
};

// ---------- radio responses (player) ----------
function radioAction(race, id, act) {
  const r = race.radio.find(x => x.id === id); if (!r) return; const c = r.c; r.actions = null; r.answer = act;
  const best = race.slick(c, race.laps - c.laps) || 'M';
  if (act === 'box') c.pitReq = best;
  if (act === 'inter') c.pitReq = race.wet > 0.62 ? 'W' : 'I';
  if (act === 'slick') c.pitReq = best;
  if (act === 'swap') teamOrderSwap(race);
  if (act === 'hold') { race.teamOrder = 'hold'; }
}
function teamOrderSwap(race) {
  const mine = race.order().filter(c => c.player && !c.out && !c.finished);
  if (mine.length < 2) return 'Both cars need to be running.';
  const [a, b] = mine; const gap = (a.dist - b.dist) / (race.L / b.curLT);
  if (gap > 2.5) return `${b.d.code} is ${gap.toFixed(1)}s back — too far to swap.`;
  const X = race.G.xp; const ignoreP = (X.rivalry / 150) + ((a.d.morale ?? 70) < 40 ? 0.15 : 0) + (a.d.no1 ? 0.25 : 0);
  if (Math.random() < ignoreP) { radio(race, a, pick(['No. I\'m not moving over.', 'Why? I\'m racing here!', 'Tell him to pass me on track.'])); X.rivalry = clamp(X.rivalry + 12, 0, 100); a.d.morale = clamp((a.d.morale ?? 70) + 2, 5, 100); b.d.morale = clamp((b.d.morale ?? 70) - 4, 5, 100); race.msg(`📻 ${a.d.code} ignores team orders!`, true); return 'ignored'; }
  a.yieldTo = b.d.id; a.yieldLap = a.laps; a.d.morale = clamp((a.d.morale ?? 70) - 8, 5, 100); b.d.morale = clamp((b.d.morale ?? 70) + 3, 5, 100); X.rivalry = clamp(X.rivalry + 8, 0, 100);
  radio(race, a, pick(['Copy… understood.', 'OK. Not happy, but OK.', 'Fine, let him go.'])); race.msg(`📻 Team orders: ${a.d.code} lets ${b.d.code} through`, false);
  return 'ok';
}

// ---------- quali tyre sets ----------
XPH.qualiSetPenalty = (e, wet) => {
  if (wet > 0.25 || typeof WK === 'undefined' || !WK || !WK.sets || !WK.sets[e.d.id]) return 0;
  const w = takeSet(e.d.id, 'S'); returnSet(e.d.id, 'S', Math.max(w, 0.18));
  return w * 3;
};

// ---------- sound (synthesised with Web Audio, no files) ----------
const SND = (() => {
  let ctx = null, eng = null, engGain = null, master = null;
  const on = () => typeof G !== 'undefined' && G && G.xp && G.xp.settings.sound;
  function init() { if (ctx) return true; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.connect(ctx.destination); return true; } catch (e) { return false; } }
  function vol() { return (G && G.xp ? G.xp.settings.volume : 0.5); }
  function tone(f, d, type = 'square', g = 0.12) { if (!on() || !init()) return; master.gain.value = vol(); const o = ctx.createOscillator(), a = ctx.createGain(); o.type = type; o.frequency.value = f; a.gain.setValueAtTime(g, ctx.currentTime); a.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d); o.connect(a); a.connect(master); o.start(); o.stop(ctx.currentTime + d + 0.02); }
  function noise(d, g, f = 1200, q = 0.7) { if (!on() || !init()) return; master.gain.value = vol(); const b = ctx.createBuffer(1, ctx.sampleRate * d, ctx.sampleRate); const x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length); const s = ctx.createBufferSource(); s.buffer = b; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; const a = ctx.createGain(); a.gain.value = g; s.connect(fl); fl.connect(a); a.connect(master); s.start(); }
  return {
    unlock() { if (on() && init() && ctx.state === 'suspended') ctx.resume(); },
    light() { tone(880, 0.25, 'square', 0.1); },
    go() { noise(1.2, 0.5, 600, 0.5); tone(220, 0.6, 'sawtooth', 0.05); },
    blip() { tone(1320, 0.07, 'sine', 0.05); setTimeout(() => tone(990, 0.07, 'sine', 0.05), 80); },
    pit() { if (!on()) return; for (let i = 0; i < 4; i++) setTimeout(() => noise(0.05, 0.25, 3000, 2), i * 70); },
    cheer() { noise(2.5, 0.35, 900, 0.4); },
    engine(level, pitch) { // level 0..1, pitch 0..1
      if (!on() || !init()) { if (engGain) engGain.gain.value = 0; return; }
      master.gain.value = vol();
      if (!eng) { eng = ctx.createOscillator(); eng.type = 'sawtooth'; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; engGain = ctx.createGain(); engGain.gain.value = 0; eng.connect(f); f.connect(engGain); engGain.connect(master); eng.start(); }
      eng.frequency.setTargetAtTime(60 + pitch * 260, ctx.currentTime, 0.08); engGain.gain.setTargetAtTime(level * 0.06, ctx.currentTime, 0.2);
    },
    stopEngine() { if (engGain && ctx) engGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); }
  };
})();
