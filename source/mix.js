// ===================== Alternative history: line-up of one year, calendar of another =====================
// G.mix = { line0, cal0, mode }: line-up from year line0 (kept for the whole game, or advancing a year each season),
// calendar, rules and real-world comparisons from year cal0 + seasons played.
function mixLineYear(G0, y) {
  const M = G0.mix; if (!M) return y;
  if (M.mode === 'stay') return M.line0;
  let ly = M.line0 + (y - M.cal0); while (ly > HIST_FIRST && !HIST.years[ly]) ly--; return Math.min(HIST_LAST, ly);
}
const _mix_loadSeason = loadSeason;
loadSeason = function (G0, y) {
  if (!G0.mix) return _mix_loadSeason.apply(this, arguments);
  const ly = mixLineYear(G0, y), H = HIST.years[y];
  _mix_loadSeason.call(this, G0, ly);                  // teams, cars and drivers of the line-up year
  G0.year = y; G0.lineYear = ly;                        // the season itself: calendar year
  G0.rules = rulesFor(y);
  G0.cal = H.cal.map(c => c[0]);
  G0.calInfo = H.cal.map(c => ({ gp: c[1], km: c[2], laps: c[3], base: c[4], sprint: c[5], date: c[6], win: c[7] }));
  G0.realChamp = H.champ; G0.realCChamp = H.cchamp;
  if (G0.mix.mode === 'stay') Object.values(G0.drivers).forEach(d => { d.age += y - G0.mix.cal0; d.until = y; });
  else Object.values(G0.drivers).forEach(d => { d.until = y; });
  G0.hxY = y;                                            // the calendar year's stand-ins don't apply to this line-up
  if (typeof dkApplyRegs === 'function') dkApplyRegs(G0);
  news(G0, `📅 ${y} season: the real ${y} calendar with the ${ly} line-up${G0.mix.mode === 'stay' ? ' (kept for the whole game)' : ''}`);
};
// setup: choose the calendar year and how the line-up evolves
const _mix_viewSetup = viewSetup;
viewSetup = function () {
  let html = _mix_viewSetup.apply(this, arguments); const S = SETUP;
  if (S.era !== 'hist') return html;
  const ys = HIST_YEARS.slice().reverse();
  const card = `<div class="card" style="margin-top:12px"><h3>Alternative history — mix eras</h3><div class="small mut" style="margin-bottom:8px">Race the ${S.year} line-up on another year's calendar. Each new season loads the real calendar of the following year.</div>
  <div class="grid g2" style="gap:10px"><label class="small">Calendar (and sporting rules)<select data-dkc="mixcal" style="width:100%"><option value="">Same as the line-up — ${S.year}</option>${ys.filter(y => y !== S.year).map(y => `<option value="${y}" ${S.mixCal === y ? 'selected' : ''}>${y} calendar</option>`).join('')}</select></label>
  <label class="small">Line-up as the seasons go by<select data-dkc="mixmode" style="width:100%"><option value="advance" ${S.mixMode !== 'stay' ? 'selected' : ''}>Follow the real line-ups year by year (${S.year}, ${S.year + 1}, …)</option><option value="stay" ${S.mixMode === 'stay' ? 'selected' : ''}>Keep the ${S.year} line-up for the whole game</option></select></label></div>
  ${S.mixCal || S.mixMode === 'stay' ? `<div class="small" style="margin-top:8px;color:#8fb4ff">Season 1: ${S.year} line-up on the ${S.mixCal || S.year} calendar · season 2: ${S.mixMode === 'stay' ? S.year : S.year + 1} line-up on the ${(S.mixCal || S.year) + 1} calendar · …</div>` : ''}</div>`;
  return html.replace('<div class="row" style="margin:16px 0 40px">', card + '<div class="row" style="margin:16px 0 40px">');
};
Object.assign(A, {
  mixcal(el) { SETUP.mixCal = el.value ? +el.value : null; render(); },
  mixmode(el) { SETUP.mixMode = el.value; render(); },
});
const _mix_newTL = newTimelineGame;
newTimelineGame = function (opts) {
  const g = _mix_newTL.apply(this, arguments);
  const cal = SETUP.mixCal && HIST.years[SETUP.mixCal] ? SETUP.mixCal : opts.year;
  if (g && (cal !== opts.year || SETUP.mixMode === 'stay')) {
    g.mix = { line0: opts.year, cal0: cal, mode: SETUP.mixMode === 'stay' ? 'stay' : 'advance' };
    g.hxStart = opts.year; g.startYear = cal; g.news = [];
    loadSeason(g, cal);
    news(g, g.spectator ? `Welcome to an alternative ${cal}: the ${opts.year} grid takes on the ${cal} calendar.` : `Welcome to ${g.teams[g.player].full} — the ${opts.year} grid on the ${cal} calendar.`);
  }
  return g;
};
// the selected year moved: the calendar choice no longer makes sense as "same year"
const _mix_yearstep = A.yearstep;
A.yearstep = function (el) { const r = _mix_yearstep.apply(this, arguments); if (SETUP.mixCal === SETUP.year) SETUP.mixCal = null; return r; };
