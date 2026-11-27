// ===================== Race distance cap (custom regulation) =====================
// Modern rule: the race is the fewest laps that cover 305 km (Monaco: 260 km). Only shortens — races that were
// already shorter keep their real length.
const distCap = (G0) => !!(G0 && G0.regs && G0.regs.dist === 'cap');
const isMonaco = t => t.id === 'mon' || /monaco|monte.?carlo/i.test((t.id || '') + ' ' + (t.name || '') + ' ' + (t.short || ''));
function capLaps(t) { const km = t.km || 5, lim = isMonaco(t) ? 260 : 305, n = Math.ceil(lim / km - 1e-9); return Math.min(t.laps, Math.max(1, n)); }
const _dc_roundTrack = roundTrack;
roundTrack = function (G0, i) {
  const t = _dc_roundTrack.apply(this, arguments);
  if (!distCap(G0) || !t || !t.laps) return t;
  const n = capLaps(t); if (n >= t.laps) return t;
  return Object.assign({}, t, { laps: n, realLaps: t.laps });
};
