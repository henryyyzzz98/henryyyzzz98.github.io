// ===================== SAVE SLOTS (3 games side by side) =====================
const SLOTS_N = 3;
let SLOT_NEW = null; // where the next new / imported game goes
function slotInfo(n) {
  const has = loadSave(n); if (!has) return null;
  const who = has.spectator ? 'Spectator' + (has.follow && has.drivers && has.drivers[has.follow] ? ' · ' + has.drivers[has.follow].name : '') : has.player && has.teams && has.teams[has.player] ? has.teams[has.player].name : 'choose team';
  const tags = [];
  if (has.custom) tags.push('Custom season'); else if (has.timeline) tags.push('Historic timeline'); else tags.push('2026 season');
  const fmt = has.regs && has.regs.format;
  if (fmt === 'exempt') tags.push('Exemption weekend'); else if (fmt === 'academy') tags.push('F1 Academy');
  else if (has.survival) tags.push('Survival season');
  const rd = has.cal ? `Round ${Math.min((has.round || 0) + 1, has.cal.length)} of ${has.cal.length}` : '';
  return { year: has.year, who, rd, tags, sid: has.sid };
}
function slotFirstEmpty() { for (let n = 1; n <= SLOTS_N; n++) if (!loadSave(n)) return n; return null; }
function slotsHtml() {
  if (SLOT_NEW == null) SLOT_NEW = slotFirstEmpty() || SLOT;
  const cards = Array.from({ length: SLOTS_N }, (_, i) => {
    const n = i + 1, I = slotInfo(n), tgt = SLOT_NEW === n;
    if (!I) return `<div class="slot ${tgt ? 'tgt' : ''}"><div class="slot-h"><b>SLOT ${n}</b><span class="dk-mut">empty</span></div><div class="dk-mut small">${tgt ? '✔ A new game will be saved here' : ''}</div><div class="slot-btns">${tgt ? '' : `<button data-a="slotnew" data-v="${n}">Use for a new game</button>`}</div></div>`;
    return `<div class="slot used ${SLOT === n ? 'last' : ''} ${tgt ? 'tgt' : ''}"><div class="slot-h"><b>SLOT ${n}</b>${SLOT === n ? '<span class="slot-last">LAST PLAYED</span>' : ''}</div>
      <div class="dkt-yr">${I.year}</div><div>${esc(I.who)}</div><div class="dk-mut small">${esc(I.rd)} · ${I.tags.map(esc).join(' · ')}</div>
      ${tgt ? '<div class="slot-warn small">⚠ Starting a new game will replace this save</div>' : ''}
      <div class="slot-btns"><button class="pri" data-a="slotgo" data-v="${n}" ${SLOT === n ? 'data-enter="1"' : ''}>Continue ›</button>${tgt ? '' : `<button data-a="slotnew" data-v="${n}" title="Start the next new game in this slot">Replace</button>`}<button class="slot-del" data-a="slotdel" data-v="${n}">${SLOT_DEL === n ? 'Tap again to delete' : 'Delete'}</button></div></div>`;
  }).join('');
  return `<section class="dkt-slots"><div class="dk-h"><b>SAVE SLOTS</b><span class="sp"></span><span class="dk-mut small">Each slot is a separate game with its own rules — new games go to slot ${SLOT_NEW}</span></div><div class="slots">${cards}</div></section>`;
}
let SLOT_DEL = null;
Object.assign(A, {
  slotgo(el) { const n = +el.dataset.v; SLOT = n; try { localStorage.setItem('pitwall_slot', n); } catch (e) { } SLOT_NEW = null; A.continue(); },
  slotnew(el) { SLOT_NEW = +el.dataset.v; SLOT_DEL = null; render(); },
  slotdel(el) {
    const n = +el.dataset.v;
    if (SLOT_DEL !== n) { SLOT_DEL = n; render(); return; }
    const I = slotInfo(n);
    try {
      localStorage.removeItem(slotKey(n)); localStorage.removeItem(n > 1 ? 'f1mgr_wk_' + n : 'f1mgr_wk');
      if (I && I.sid) Object.keys(localStorage).filter(k => k.includes('_' + I.sid + '_')).forEach(k => localStorage.removeItem(k));
    } catch (e) { }
    SLOT_DEL = null; if (SLOT_NEW === n || SLOT_NEW == null) SLOT_NEW = n;
    if (G && G.sid && I && G.sid === I.sid) G = null;
    toast(`Slot ${n} deleted`); render();
  }
});
// new games and imports go to the chosen slot
const _sl_startgame = A.startgame;
A.startgame = function () { if (SLOT_NEW != null) { SLOT = SLOT_NEW; SLOT_NEW = null; } return _sl_startgame.apply(this, arguments); };
const _sl_doimport = A.doimport;
A.doimport = function () { if (SLOT_NEW != null) { SLOT = SLOT_NEW; SLOT_NEW = null; } return _sl_doimport.apply(this, arguments); };
const _sl_totitle = A.totitle;
A.totitle = function () { if (G) autosave(); SLOT_NEW = null; SLOT_DEL = null; return _sl_totitle.apply(this, arguments); };
// title screen
const _sl_viewTitle = viewTitle;
viewTitle = function () {
  let html = _sl_viewTitle.apply(this, arguments);
  html = html.replace(/<section class="dkt-cont">[\s\S]*?<\/section>/, '');
  const head = '<div class="dk-mut">F1 TEAM MANAGER</div></div>';
  if (html.includes(head)) return html.replace(head, head + slotsHtml());
  return slotsHtml() + html; // classic layout
};
if (VIEW === 'title') render();
const _sl_hqMenu = typeof hqMenu === 'function' ? hqMenu : null;
if (_sl_hqMenu) hqMenu = function () { return _sl_hqMenu.apply(this, arguments).replace('<h3>Save</h3>', `<h3>Save · Slot ${SLOT}</h3>`); };
