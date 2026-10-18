"use strict";

const SEASON_FILES = [
  { id: "atom01",   label: "Atom01",   file: "json/a1triples.json" },
  { id: "binary01", label: "Binary01", file: "json/b1triples.json" },
  { id: "cream01",  label: "Cream01",  file: "json/c1triples.json" },
  { id: "divine01", label: "Divine01", file: "json/d1triples.json" },
  { id: "ever01",   label: "Ever01",   file: "json/e1triples.json" },
  { id: "atom02",   label: "Atom02",   file: "json/a2triples.json" },
  { id: "binary02", label: "Binary02", file: "json/b2triples.json" },
  { id: "cream02",  label: "Cream02",  file: "json/c2triples.json" }
];

const START_CHIPS = 25;
const FREE_CHIP_EVERY = 10;         // seconds between free chips...
const FREE_CHIP_BELOW = 25;         // ...while you hold fewer than this

// Chance that a winning slot pays 2 or 3 cards instead of 1 (0.05% = 0.0005).
// You can test it with ?multi=0.5 on the page URL.
const MULTI_CHANCE = (() => {
  const v = parseFloat(new URLSearchParams(location.search).get("multi"));
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.0005;
})();
const THREE_CARD_SHARE = 0.3;

// "id" matches the "group" field in the card JSON.
const LABELS = [
  { id: "first",   text: "FCO",   color: "#FF4145", dark: "#FF4145" },
  { id: "double",  text: "DCO",  color: "#00c65e", dark: "#00c65e" },
  { id: "motion",  text: "MCO",  color: "#BCC1C1", dark: "#BCC1C1" },
  { id: "unit",    text: "UCO",    color: "#C9A753", dark: "#C9A753" },
  { id: "special", text: "SCO", color: "#FA93BD", dark: "#FA93BD" },
  { id: "premier", text: "PCO", color: "#2e3192", dark: "#2e3192" },
  { id: "nowin",   text: "LOSE",  color: "#000", dark: "#000" }
];
const NO_WIN = 6;
const GROUP_ORDER = LABELS.slice(0, 6).map(l => l.id);
// 9 slots, left to right. Starting order: first, double, motion, no win, special, no win, motion, double, first.
// The slots shuffle once every chip in play has landed (see endBatch). When a chip lands in
// Special, that slot turns into Unit or Premier (random) for the next batch of chips, and goes
// back to Special once every chip of that batch has landed.
const NSLOT = 9;
const DEFAULT_LAYOUT = [0, 1, 2, 6, 4, 6, 2, 1, 0];
const SPECIAL = 4;
const slotItems = [];            // one per slot, in position order: { idx, px } (px = drawn position, eases to its index)
const SLOT_LAYOUT = [];          // label index per position (mirror of slotItems, used for scoring)
let swapPos = -1;                // position of the slot currently standing in for Special (-1 = none)
function syncLayout() { SLOT_LAYOUT.length = 0; slotItems.forEach(it => SLOT_LAYOUT.push(it.idx)); }

/* ---------- Storage ---------- */
const SAVE_KEY = "plinko.save";
const COLL_KEY = "plinko.collection";
const FILTER_KEY = "plinko.bookFilter";

const save = { chips: START_CHIPS, drops: 0, wins: {}, centre: 4 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (_) {}
{
  const ok = Array.isArray(save.layout) && save.layout.length === NSLOT && save.layout.every(v => Number.isInteger(v) && v >= 0 && v <= 6)
    && Number.isInteger(save.swapPos) && save.swapPos >= -1 && save.swapPos < NSLOT
    && (save.swapPos < 0 || [3, 5].includes(save.layout[save.swapPos]));
  const lay = ok ? save.layout : DEFAULT_LAYOUT;
  swapPos = ok ? save.swapPos : -1;
  lay.forEach((idx, i) => slotItems.push({ idx, px: i, sw: i === swapPos }));
  syncLayout();
}
let collection = {};
try { collection = JSON.parse(localStorage.getItem(COLL_KEY)) || {}; } catch (_) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {} };
const persistCollection = () => { try { localStorage.setItem(COLL_KEY, JSON.stringify(collection)); } catch (_) {} };
const countOf = card => collection[card.key] || 0;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const $ = id => document.getElementById(id);
const canvas = $("board");
const toastEl = $("toast");
const chipCountEl = $("ballCount");
const fireBtn = $("fireBtn");
const bookBtn = $("bookBtn");

/* ---------- Board + physics (board units, y up) ---------- */
const BW = 300, BH = 470;
const NSLOT = 9, SLOT_W = 30, SX0 = 15;           // slots span x 15..285
const SLOT_TOP = 52;                              // top of the slot dividers
const CHIP_R = 9, PEG_R = 3;
const GRAV = 520, DT = 1 / 240;
const E_PEG = 0.55, E_WALL = 0.4;
const DROP_Y = BH - 22;
const pegs = [];
for (let r = 0; r < 11; r++) {
  const y = 408 - r * 31;
  if (r % 2 === 0) for (let k = 0; k < 9; k++) pegs.push({ x: SX0 + SLOT_W / 2 + k * SLOT_W, y, hit: 0 });
  else for (let k = 1; k < 9; k++) pegs.push({ x: SX0 + k * SLOT_W, y, hit: 0 });
}
const dividers = [];   // thin walls between slots: x, from y=8 to SLOT_TOP
for (let k = 0; k <= NSLOT; k++) dividers.push({ x: SX0 + k * SLOT_W });
const slotOf = x => clamp(Math.floor((x - SX0) / SLOT_W), 0, NSLOT - 1);

/* ---------- State ---------- */
let panelOpen = false;
let toastTimer = 0;
const chips = [];            // {x,y,vx,vy,rot,color,state,t,slot}
const floaters = [];
let aimX = BW / 2;
let aiming = false;
let lastDropT = -1;
const CHIP_COLORS = ["#ffdd00", "#75fb4c", "#ff7477", "#b400ff", "#33ecfd"];

function toast(text, ms = 2600) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

function dropChip(x = aimX) {
  if (save.chips <= 0 || panelOpen || bookPanel.classList.contains("show")) return false;
  save.chips--; save.drops++;
  chips.push({ x: clamp(x, SX0 + CHIP_R + 2, SX0 + NSLOT * SLOT_W - CHIP_R - 2), y: DROP_Y, vx: rand(-4, 4), vy: 0, rot: 0, vr: 0,
    color: CHIP_COLORS[save.drops % CHIP_COLORS.length], state: "fall", t: 0, still: 0 });
  // the first chip dropped while the middle is Unit/Premier is judged on that slot, then it reverts
  if (save.centre !== 4 && !centreClaimed) { chips[chips.length - 1].swap = save.centre; centreClaimed = true; }
  persist();
  return true;
}

function collidePoint(c, px, py, r, e) {
  const ox = c.x - px, oy = c.y - py, minD = CHIP_R + r, d2 = ox * ox + oy * oy;
  if (d2 >= minD * minD) return false;
  const d = Math.sqrt(d2) || 1e-6, nx = ox / d, ny = oy / d;
  c.x = px + nx * minD; c.y = py + ny * minD;
  const vn = c.vx * nx + c.vy * ny;
  if (vn < 0) {
    c.vx -= (1 + e) * vn * nx; c.vy -= (1 + e) * vn * ny;
    c.vr += (c.vx * ny - c.vy * nx) * 0.01;
    return -vn;
  }
  return 0;
}

function stepChip(c, dt) {
  if (c.state === "done") return;
  c.t += dt;
  if (c.state === "rest") { if (c.t > 1.8) c.state = "done"; return; }
  c.vy -= GRAV * dt;
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.rot += c.vr; c.vr *= 0.999;
  const left = SX0 + CHIP_R, right = SX0 + NSLOT * SLOT_W - CHIP_R;
  if (c.x < left) { c.x = left; if (c.vx < 0) c.vx = -c.vx * E_WALL; }
  if (c.x > right) { c.x = right; if (c.vx > 0) c.vx = -c.vx * E_WALL; }
  for (const p of pegs) {
    if (Math.abs(p.x - c.x) > CHIP_R + PEG_R || Math.abs(p.y - c.y) > CHIP_R + PEG_R) continue;
    const imp = collidePoint(c, p.x, p.y, PEG_R, E_PEG);
    if (imp > 20) p.hit = 1;
  }
  if (c.y < SLOT_TOP + CHIP_R) {
    for (const d of dividers) {
      if (Math.abs(d.x - c.x) > CHIP_R + 2) continue;
      // wall: tall thin rectangle, top rounded
      const topY = SLOT_TOP;
      if (c.y < topY) {
        const dx = c.x - d.x, minD = CHIP_R + 1.5;
        if (Math.abs(dx) < minD) { c.x = d.x + Math.sign(dx || 1) * minD; if (c.vx * dx < 0) c.vx = -c.vx * E_WALL; }
      } else collidePoint(c, d.x, topY, 1.5, E_PEG);
    }
  }
  const floor = 8 + CHIP_R;
  if (c.y < floor) { c.y = floor; if (c.vy < 0) c.vy = -c.vy * 0.25; c.vx *= 0.9; }
  // balanced on a peg or divider? give it a nudge
  if (c.y >= SLOT_TOP - 4 && Math.abs(c.vx) + Math.abs(c.vy) < 25) c.idle = (c.idle || 0) + dt; else c.idle = 0;
  if (c.idle > 0.5) { c.vx += (c.x < 60 ? 1 : c.x > 240 ? -1 : (Math.random() < 0.5 ? -1 : 1)) * rand(45, 70); c.vy += 40; c.idle = 0; }
  // landed?
  if (c.y < SLOT_TOP - 4 && Math.abs(c.vy) < 40 && Math.abs(c.vx) < 40) c.still += dt; else c.still = 0;
  if (c.still > 0.12) { c.state = "rest"; c.t = 0; c.slot = slotOf(c.x); landed(c); }
}

function landed(c) {
  const idx = SLOT_LAYOUT[c.slot];
  const lab = LABELS[idx];
  floaters.push({ x: SX0 + c.slot * SLOT_W + SLOT_W / 2, y: SLOT_TOP + 20, t: 0, text: lab.text, color: lab.color });
  if (idx === SPECIAL) batchHitSpecial = true;
  if (idx === NO_WIN) { save.wins.nowin = (save.wins.nowin || 0) + 1; persist(); return; }
  save.wins[lab.id] = (save.wins[lab.id] || 0) + 1; persist();
  if (!window.__noResults) pendingResults.push(idx);
}
const pendingResults = [];
let batchOpen = false;           // chips have been dropped and not all have landed yet
let batchHitSpecial = false;     // a chip landed in Special during this batch

// Runs once every chip in play has landed (and the result page, if any, is closed):
// 1. a stand-in slot goes back to Special, or a Special that was hit turns into Unit/Premier;
// 2. then the slots shuffle.
function endBatch() {
  batchOpen = false;
  let note = "";
  if (swapPos >= 0) {
    slotItems[swapPos].idx = SPECIAL; slotItems[swapPos].sw = false; swapPos = -1;
    note = "Special is back";
  } else if (batchHitSpecial) {
    const k = slotItems.findIndex(it => it.idx === SPECIAL);
    if (k >= 0) { const next = Math.random() < 0.5 ? 3 : 5; slotItems[k].idx = next; slotItems[k].sw = true; swapPos = k; note = `Special slot becomes ${LABELS[next].text}`; }
  }
  batchHitSpecial = false;
  shuffleSlots();
  save.layout = slotItems.map(it => it.idx); save.swapPos = swapPos;
  persist();
  toast(note ? `Slots shuffled · ${note}` : "Slots shuffled", 2200);
}
function shuffleSlots() {
  const before = slotItems.map(it => it.idx).join();
  for (let tries = 0; tries < 20; tries++) {
    for (let i = slotItems.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slotItems[i], slotItems[j]] = [slotItems[j], slotItems[i]]; }
    if (slotItems.map(it => it.idx).join() !== before) break;     // make sure the order really changed
  }
  swapPos = slotItems.findIndex(it => it.sw);
  syncLayout();
}


function simulate(dt) {
  if (panelOpen) return;
  for (const c of chips) stepChip(c, dt);
  for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
    const a = chips[i], b = chips[j];
    if (a.state !== "fall" && b.state !== "fall") continue;
    const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
    if (d2 >= 4 * CHIP_R * CHIP_R) continue;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, push = (2 * CHIP_R - d) / 2;
    a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn < 0) { const j2 = -(1.5) * vn / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny; }
  }
  for (let i = chips.length - 1; i >= 0; i--) if (chips[i].state === "done") chips.splice(i, 1);
  for (const p of pegs) if (p.hit > 0) p.hit = Math.max(0, p.hit - dt * 5);
  flushResults();
}

// Wait until every chip in play has landed, then show all the wins together and shuffle.
function flushResults() {
  if (!batchOpen || panelOpen) return;
  if (chips.some(c => c.state === "fall")) return;
  if (pendingResults.length) showResult(pendingResults.splice(0));   // the shuffle happens when it closes
  else endBatch();
}
function afterResult() {
  panelOpen = false;
  if (batchOpen && !chips.some(c => c.state === "fall")) endBatch();
}

/* ---------- Rendering ---------- */
const ctx = canvas.getContext("2d");
let dpr = 1, sc = 1, ox = 0, oy = 0;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(2, Math.round(r.width * dpr));
  canvas.height = Math.max(2, Math.round(r.height * dpr));
  sc = Math.min(canvas.width / BW, canvas.height / BH);
  ox = (canvas.width - BW * sc) / 2;
  oy = (canvas.height - BH * sc) / 2;
}
window.addEventListener("resize", resize);
const X = x => ox + x * sc, Y = y => oy + (BH - y) * sc, S = v => v * sc;

function drawChip(c, x, y, color, rot, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(-rot);
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.arc(S(1.5), S(-2), S(CHIP_R), 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, S(CHIP_R), 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = S(1.2);
  ctx.beginPath(); ctx.arc(0, 0, S(CHIP_R - 2.2), 0, 7); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.fillRect(S(CHIP_R - 1.6), S(-1), S(1.6), S(2)); ctx.restore(); }
  ctx.restore(); ctx.globalAlpha = 1;
}

function draw(time) {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  // cream board
  const bx = SX0 - 12, bw = NSLOT * SLOT_W + 24;
  c.fillStyle = "#f3e7c9";
  c.beginPath(); c.roundRect(X(bx), Y(BH - 4), S(bw), S(BH - 8), S(10)); c.fill();
  c.strokeStyle = "#caa86a"; c.lineWidth = S(2.5); c.stroke();
  // header
  c.fillStyle = "#1f3f8f"; c.font = `800 ${S(30)}px "Chakra Petch", sans-serif`; c.textAlign = "center";
  c.fillText("COSMO", X(BW / 2), Y(BH - 34));
  // aim marker
  if (!panelOpen) {
    const live = save.chips > 0;
    c.strokeStyle = "rgba(31,63,143,.25)"; c.setLineDash([S(3), S(4)]); c.lineWidth = S(1.5);
    c.beginPath(); c.moveTo(X(aimX), Y(DROP_Y - CHIP_R)); c.lineTo(X(aimX), Y(SLOT_TOP + 8)); c.stroke(); c.setLineDash([]);
    if (live) drawChip(c, aimX, DROP_Y, CHIP_COLORS[(save.drops + 1) % CHIP_COLORS.length], 0, 0.9);
  }
  // pegs
  for (const p of pegs) {
    const h = p.hit;
    c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.arc(X(p.x + 1), Y(p.y - 1.5), S(PEG_R + 0.6), 0, 7); c.fill();
    c.fillStyle = h > 0 ? "#ff7a2f" : "#ffffff"; c.strokeStyle = "#b9a678"; c.lineWidth = S(0.8);
    c.beginPath(); c.arc(X(p.x), Y(p.y), S(PEG_R + h * 1.6), 0, 7); c.fill(); c.stroke();
  }
  // slot floor and labels
  for (let k = 0; k < NSLOT; k++) {
    const L = LABELS[slotItems[k].idx], x = SX0 + slotItems[k].px * SLOT_W;
    const lift = Math.min(1, Math.abs(slotItems[k].px - k)) * 6;
    c.fillStyle = L.color; c.globalAlpha = 0.9;
    c.fillRect(X(x), Y(8 + 40 + lift), S(SLOT_W), S(40));
    c.globalAlpha = 1;
    c.save(); c.translate(X(x + SLOT_W / 2), Y(8 + 20 + lift)); c.rotate(-Math.PI / 2);
    c.fillStyle = "#fff"; c.font = `800 ${S(7.5)}px "Chakra Petch", sans-serif`; c.textAlign = "center";
    c.fillText(L.text, 0, S(3)); c.restore();
  }
  c.fillStyle = "#e8d9b0"; c.fillRect(X(SX0 - 6), Y(8), S(NSLOT * SLOT_W + 12), S(8));
  // dividers
  c.fillStyle = "#fff"; c.strokeStyle = "#b9a678"; c.lineWidth = S(0.8);
  for (const d of dividers) { c.beginPath(); c.roundRect(X(d.x - 1.5), Y(SLOT_TOP), S(3), S(SLOT_TOP - 8), S(1.5)); c.fill(); c.stroke(); }
  // chips
  for (const ch of chips) drawChip(c, ch.x, ch.y, ch.color, ch.rot, ch.state === "rest" ? clamp(1 - (ch.t - 1.2) / 0.6, 0, 1) : 1);
  // floaters
  c.textAlign = "center"; c.font = `800 ${S(12)}px "Chakra Petch", sans-serif`;
  for (const f of floaters) { c.globalAlpha = 1 - f.t / 1.2; c.fillStyle = f.color; c.strokeStyle = "#0008"; c.lineWidth = S(2.5); c.strokeText(f.text, X(f.x), Y(f.y + f.t * 40)); c.fillText(f.text, X(f.x), Y(f.y + f.t * 40)); }
  c.globalAlpha = 1;
}

/* ---------- HUD + input ---------- */
function updateHud() {
  chipCountEl.textContent = save.chips;
  const label = save.chips <= 0 ? "Out of chips - 1 added every minute" : "Drop chip";
  if (fireBtn.textContent !== label) fireBtn.textContent = label;
  fireBtn.disabled = save.chips <= 0;
}
function boardX(ev) {
  const r = canvas.getBoundingClientRect();
  return ((ev.clientX - r.left) * dpr - ox) / sc;
}
canvas.addEventListener("pointerdown", e => { aiming = true; canvas.setPointerCapture?.(e.pointerId); aimX = clamp(boardX(e), SX0 + CHIP_R, SX0 + NSLOT * SLOT_W - CHIP_R); });
canvas.addEventListener("pointermove", e => { if (aiming || e.pointerType === "mouse") aimX = clamp(boardX(e), SX0 + CHIP_R, SX0 + NSLOT * SLOT_W - CHIP_R); });
canvas.addEventListener("pointerup", () => { if (aiming) { aiming = false; dropChip(); } });
canvas.addEventListener("pointercancel", () => { aiming = false; });
fireBtn.addEventListener("click", () => dropChip());
window.addEventListener("keydown", e => {
  if (e.code === "ArrowLeft") aimX = clamp(aimX - 6, SX0 + CHIP_R, SX0 + NSLOT * SLOT_W - CHIP_R);
  else if (e.code === "ArrowRight") aimX = clamp(aimX + 6, SX0 + CHIP_R, SX0 + NSLOT * SLOT_W - CHIP_R);
  else if (e.code === "Space" && !e.repeat) { e.preventDefault(); dropChip(); }
});


/* ---------- Card data ---------- */
let ALL = [];                 // every card from every loaded season
const seasonCards = {};       // season id -> cards
const poolByGroup = {};       // group -> cards (all seasons)

async function loadCards() {
  await Promise.all(SEASON_FILES.map(async s => {
    try {
      const res = await fetch(s.file);
      if (!res.ok) throw new Error(res.status);
      const arr = await res.json();
      seasonCards[s.id] = arr.map(c => ({ ...c, season: s.id, key: s.id + "|" + c.name }));
    } catch (_) { /* season not available */ }
  }));
  ALL = SEASON_FILES.flatMap(s => seasonCards[s.id] || []);
  ALL.forEach(c => { (poolByGroup[String(c.group || "").toLowerCase()] ||= []).push(c); });
}

const shortName = card => {
  const parts = String(card.name).split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : card.name;
};
const isRare = card => String(card.group || "").toLowerCase() !== "first";
const cardNumber = card => {
  const m = String(card.name || "").match(/(\d+)[A-Za-z]*$/);
  return m ? Number(m[1]) : 0;
};


/* ---------- Rewards ---------- */
function drawCards(groupId) {
  let pool = poolByGroup[groupId] || [];
  let fallback = false;
  if (!pool.length) { pool = poolByGroup.first || ALL; fallback = true; }   // no cards loaded for this type
  if (!pool.length) return { cards: [], fallback, multi: false };
  let n = 1;
  if (Math.random() < MULTI_CHANCE) n = Math.random() < THREE_CARD_SHARE ? 3 : 2;
  const cards = Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
  return { cards, fallback, multi: n > 1 };
}

/* ---------- Prize reveal ---------- */
const resPanel = $("resPanel");
const resKicker = $("resKicker");
const resTitle = $("resTitle");
const resGrid = $("resGrid");
const resSub = $("resSub");
const resActions = $("resActions");
const resFlash = $("resFlash");
let resTimers = [];

// Shows every card won since the last result at once. `wins` is a list of slot label indexes.
function showResult(wins) {
  if (!Array.isArray(wins)) wins = [wins];
  panelOpen = true;
  const pulls = [];
  let anyMulti = false, anyFallback = false;
  wins.forEach(idx => {
    const lab = LABELS[idx];
    const { cards, fallback, multi } = drawCards(lab.id);
    anyMulti = anyMulti || multi; anyFallback = anyFallback || fallback;
    cards.forEach(card => {
      const before = countOf(card);
      collection[card.key] = before + 1;       // a repeat inside the same batch shows ×2
      pulls.push({ card, lab, isNew: before === 0, n: before + 1 });
    });
  });

  if (!pulls.length) {
    toast("No objekt data loaded. Serve this folder over http and reload.", 4000);
    panelOpen = false;
    afterResult();
    return;
  }
  persistCollection();

  resTimers.forEach(clearTimeout);
  resTimers = [];
  const single = wins.length === 1;
  const first = LABELS[wins[0]];
  resPanel.style.setProperty("--tc", single ? first.color : "#ffffff");
  resTitle.style.setProperty("--tc", single ? first.color : "#ffffff");
  resKicker.textContent = anyMulti ? `Jackpot · ${pulls.length} objekt` : single ? "You landed on" : `${wins.length} chips landed`;
  resTitle.textContent = single ? first.text : `${pulls.length} objekts`;
  resTitle.classList.toggle("jackpot", anyMulti);
  const cols = Math.min(pulls.length, 4);
  resGrid.style.setProperty("--n", cols);
  resGrid.classList.toggle("many", pulls.length > 4);
  resGrid.innerHTML = "";
  resGrid.scrollTop = 0;
  resSub.textContent = "";
  resActions.hidden = true;

  const cells = pulls.map(p => {
    const cell = document.createElement("div");
    cell.className = "rcard" + (isRare(p.card) ? " rare" : "");
    const inner = document.createElement("div");
    inner.className = "rcard-inner";

    const back = document.createElement("div");
    back.className = "rface rback";
    back.textContent = "✦";

    const front = document.createElement("div");
    front.className = "rface rfront";
    if (p.card.image) {
      const img = document.createElement("img");
      img.src = p.card.image;
      img.alt = p.card.name;
      front.appendChild(img);
    }
    const label = document.createElement("span");
    label.className = "rlabel";
    label.textContent = shortName(p.card);
    front.appendChild(label);
    const badge = document.createElement("span");
    badge.className = "rbadge" + (p.isNew ? " is-new" : "");
    badge.textContent = p.isNew ? "New!" : "×" + p.n;
    front.appendChild(badge);
    if (!single) {
      const tag = document.createElement("span");
      tag.className = "rtype";
      tag.textContent = p.lab.text;
      tag.style.background = p.lab.color;
      front.appendChild(tag);
    }

    inner.append(back, front);
    cell.appendChild(inner);
    resGrid.appendChild(cell);
    return cell;
  });

  resPanel.classList.add("show");
  resTimers.push(setTimeout(() => {
    resFlash.classList.remove("go");
    void resFlash.offsetWidth;
    resFlash.classList.add("go");
  }, 250));
  const gap = Math.min(450, 2800 / cells.length);
  cells.forEach((cell, i) => resTimers.push(setTimeout(() => cell.classList.add("flipped"), 450 + i * gap)));
  resTimers.push(setTimeout(() => {
    const fresh = pulls.filter(p => p.isNew).length;
    let text = fresh
      ? `${fresh} new card${fresh === 1 ? "" : "s"} added to your book`
      : (pulls.length === 1 ? "Already in your book" : "All duplicates this time");
    if (anyFallback) text = "Some types have no objekts loaded yet, so you got FCOs instead. " + text;
    resSub.textContent = text;
    resActions.hidden = false;
  }, 450 + cells.length * gap + 650));
}

function closeResult() {
  resTimers.forEach(clearTimeout);
  resTimers = [];
  resPanel.classList.remove("show");
  setTimeout(() => { panelOpen = false; afterResult(); }, 250);
}

$("resAgain").addEventListener("click", closeResult);
$("resBook").addEventListener("click", () => {
  closeResult();
  openBook();
});


/* ---------- Collection book ---------- */
const bookPanel = $("bookPanel");
const bookTabs = $("bookTabs");
const bookScroll = $("bookScroll");
const bookFilterEl = $("bookFilter");
let bookTab = "all";
let bookFilter = "all";
try {
  const f = localStorage.getItem(FILTER_KEY);
  if (["all", "have", "missing"].includes(f)) bookFilter = f;
} catch (_) {}

const fmtPct = p => p.toFixed(1).replace(/\.0$/, "") + "%";
const availableSeasons = () => SEASON_FILES.filter(s => seasonCards[s.id]);

function sectionsFor(seasonId) {
  const cards = seasonCards[seasonId] || [];
  const byGroup = {};
  cards.forEach(c => { (byGroup[String(c.group || "").toLowerCase()] ||= []).push(c); });
  const rank = g => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? 99 : i; };
  return Object.keys(byGroup)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map(group => ({
      season: seasonId,
      group,
      cards: byGroup[group].sort((a, b) => cardNumber(a) - cardNumber(b) || a.name.localeCompare(b.name))
    }));
}

function progressFor(cards) {
  let owned = 0, pulls = 0;
  cards.forEach(c => { const n = countOf(c); if (n > 0) owned++; pulls += n; });
  return { owned, pulls, total: cards.length, pct: cards.length ? (owned / cards.length) * 100 : 0 };
}

function renderBook() {
  const seasons = availableSeasons();
  if (bookTab !== "all" && !seasonCards[bookTab]) bookTab = "all";

  bookTabs.innerHTML = "";
  const tabs = [{ id: "all", label: "All seasons", cards: ALL }, ...seasons.map(s => ({ id: s.id, label: s.label, cards: seasonCards[s.id] }))];
  tabs.forEach(t => {
    const pr = progressFor(t.cards);
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = t.id;
    b.className = "book-tab" + (t.id === bookTab ? " is-selected" : "");
    b.innerHTML = `<span class="tab-name">${t.label}</span><span class="tab-pct">${fmtPct(pr.pct)}</span>`;
    bookTabs.appendChild(b);
  });
  const selTab = bookTabs.querySelector(".is-selected");
  if (selTab && selTab.scrollIntoView) selTab.scrollIntoView({ inline: "center", block: "nearest" });

  const cur = tabs.find(t => t.id === bookTab);
  const pr = progressFor(cur.cards);
  $("bookName").textContent = cur.label;
  $("bookPercent").textContent = fmtPct(pr.pct);
  $("bookBarFill").style.width = pr.pct + "%";
  $("bookStats").textContent = pr.total
    ? `${pr.owned} of ${pr.total} collected · ${pr.pulls} pulled · ${pr.pulls - pr.owned} duplicate${pr.pulls - pr.owned === 1 ? "" : "s"}`
    : "No card data loaded.";

  bookFilterEl.querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.f === bookFilter)));

  bookScroll.innerHTML = "";
  const seasonIds = bookTab === "all" ? seasons.map(s => s.id) : [bookTab];
  let shown = 0;
  seasonIds.forEach(sid => {
    const label = SEASON_FILES.find(s => s.id === sid).label;
    sectionsFor(sid).forEach(sec => {
      const owned = sec.cards.filter(c => countOf(c) > 0).length;
      const visible = sec.cards.filter(c => {
        const have = countOf(c) > 0;
        return bookFilter === "all" || (bookFilter === "have" ? have : !have);
      });
      if (!visible.length) return;
      shown += visible.length;

      const head = document.createElement("div");
      head.className = "book-section-head";
      const title = bookTab === "all" ? `${label} · ${sec.group}` : sec.group;
      head.innerHTML = `<span></span><span>${owned} of ${sec.cards.length}</span>`;
      head.firstChild.textContent = title.charAt(0).toUpperCase() + title.slice(1);
      bookScroll.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "book-grid";
      visible.forEach(card => {
        const n = countOf(card);
        const cell = document.createElement("div");
        cell.className = "book-cell" + (n > 0 ? " is-collected" : "") + (isRare(card) ? " is-rare" : "");
        cell.title = card.name;
        if (card.image) {
          const img = document.createElement("img");
          img.src = card.image;
          img.alt = card.name;
          img.loading = "lazy";
          cell.appendChild(img);
        }
        const lab = document.createElement("span");
        lab.className = "book-label";
        lab.textContent = shortName(card);
        cell.appendChild(lab);
        if (n > 1) {
          const mult = document.createElement("span");
          mult.className = "book-mult";
          mult.textContent = "×" + n;
          cell.appendChild(mult);
        }
        grid.appendChild(cell);
      });
      bookScroll.appendChild(grid);
    });
  });

  if (!shown) {
    const empty = document.createElement("p");
    empty.className = "book-empty";
    empty.textContent = !ALL.length
      ? "No card data loaded. Serve this folder over http and reload."
      : bookFilter === "have"
        ? "Nothing collected here yet. Land on a card slot to start filling the book."
        : "Nothing missing here. This one is complete.";
    bookScroll.appendChild(empty);
  }
}

function openBook() {
  renderBook();
  bookScroll.scrollTop = 0;
  bookPanel.classList.add("show");
}
function closeBook() { bookPanel.classList.remove("show"); }

bookBtn.addEventListener("click", openBook);
$("bookClose").addEventListener("click", closeBook);
bookTabs.addEventListener("click", e => {
  const tab = e.target.closest(".book-tab");
  if (!tab) return;
  bookTab = tab.dataset.id;
  renderBook();
  bookScroll.scrollTop = 0;
});
bookFilterEl.addEventListener("click", e => {
  const b = e.target.closest("button[data-f]");
  if (!b) return;
  bookFilter = b.dataset.f;
  try { localStorage.setItem(FILTER_KEY, bookFilter); } catch (_) {}
  renderBook();
  bookScroll.scrollTop = 0;
});



/* ---------- Main loop ---------- */
let lastFrame = performance.now(), acc = 0, clock = 0;
// Free chips are worked out from the clock, so they also arrive while the page is closed.
function regenChips() {
  const now = Date.now();
  if (!Number.isFinite(save.lastRegen) || save.lastRegen > now) save.lastRegen = now;
  if (save.chips >= FREE_CHIP_BELOW) { save.lastRegen = now; return; }
  const earned = Math.floor((now - save.lastRegen) / (FREE_CHIP_EVERY * 1000));
  if (earned <= 0) return;
  const give = Math.min(earned, FREE_CHIP_BELOW - save.chips);
  save.chips += give;
  save.lastRegen = save.chips >= FREE_CHIP_BELOW ? now : save.lastRegen + earned * FREE_CHIP_EVERY * 1000;
  persist();
  if (document.visibilityState === "visible" && give > 1) toast(`Welcome back! ${give} free chips added`, 2600);
}
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now; clock += dt; acc += dt;
  let n = 0;
  while (acc >= DT && n++ < 30) { simulate(DT); acc -= DT; }
  if (n >= 30) acc = 0;
  slotItems.forEach((it, k) => { it.px += (k - it.px) * Math.min(1, dt * 7); if (Math.abs(it.px - k) < 0.01) it.px = k; });
  for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].t += dt; if (floaters[i].t > 1.2) floaters.splice(i, 1); }
  regenChips();
  updateHud();
  draw(clock);
  requestAnimationFrame(frame);
}
resize();
regenChips();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") regenChips(); });
loadCards().then(() => {
  if (!ALL.length) toast("Objekt data didn't load. Serve this folder over http and reload.", 5000);
  else toast("Slide along the top and let go to drop a chip.", 3800);
});
requestAnimationFrame(frame);

window.__plinko = {
  save, chips, SLOT_LAYOUT, LABELS, dropChip, simulate, showResult, drawCards,
  get panelOpen() { return panelOpen; },
  // drop n chips headlessly from the given x (random if omitted) and tally the slots
  tally(n, x) {
    const hits = new Array(NSLOT).fill(0);
    for (let i = 0; i < n; i++) {
      const c = { x: x ?? rand(30, 270), y: DROP_Y, vx: rand(-4, 4), vy: 0, rot: 0, vr: 0, color: "#fff", state: "fall", t: 0, still: 0 };
      let g = 0; while (c.state === "fall" && g++ < 200000) stepChip(c, DT);
      hits[c.slot ?? 4]++;
    }
    pendingResults.length = 0; floaters.length = 0;
    return hits;
  }
};
