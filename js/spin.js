const SET_SIZE = 16;

const SEASONS = [
  { id: "atom01", 
    label: "Atom01", 
    file: "json/a1triples.json", 
    accent: "#ffdd00" 
  },
  {
    id: "binary01",
    label: "Binary01",
    file: "json/b1triples.json",
    accent: "#75fb4c",
  },
  {
    id: "cream01",
    label: "Cream01",
    file: "json/c1triples.json",
    accent: "#ff7477",
  },
  {
    id: "divine01",
    label: "Divine01",
    file: "json/d1triples.json",
    accent: "#b400ff",
  },
  { id: "ever01", 
    label: "Ever01", 
    file: "json/e1triples.json", 
    accent: "#33ecfd" 
  },
  { id: "atom02", 
    label: "Atom02", 
    file: "json/a2triples.json", 
    accent: "#ffdd00" 
  },
  {
    id: "binary02",
    label: "Binary02",
    file: "json/b2triples.json",
    accent: "#75fb4c",
  },
  {
    id: "cream02",
    label: "Cream02",
    file: "json/c2triples.json",
    accent: "#ff7477",
  },
];

const ORIGINAL_ALLOWED = {
  atom01: ["101-120", 201, 202, 216, 217, 218, 219],
  binary01: ["101-120", 201, 202, 203, 204, 205, 206],
  cream01: ["101-120", 201, 202, 203, 204, 205, 206],
  divine01: ["101-120", 201, 202, 203, 204, 205, 206],
  ever01: ["101-120", 201, 202, 203, 204, 205, 206, 402],
  atom02: ["101-120", 201, 202, 203, 204, 205, 206, 402],
  binary02: ["101-120", 402],
  cream02: ["101-120", 402],
};

function cardNumber(card) {
  const m = String(card.name || "").match(/(\d+)[A-Za-z]*$/);
  return m ? Number(m[1]) : NaN;
}

function allowedInOriginal(card, seasonId) {
  const rules = ORIGINAL_ALLOWED[seasonId];
  if (!rules) return true;
  const n = cardNumber(card);
  return rules.some((rule) => {
    if (typeof rule === "number") return n === rule;
    const [a, b] = String(rule).split("-").map(Number);
    return n >= a && n <= b;
  });
}

const REWARDS = {
  first: 1,
  double: 2,
  motion: 3,
  unit: 4,
  special: 5,
  premier: 10,
  fail: 0,
};

function rewardFor(card) {
  return REWARDS[String(card.group || "").toLowerCase()] ?? 0;
}

const POINTS = {
  first: 1,
  double: 2,
  motion: 3,
  unit: 4,
  special: 5,
  premier: 10,
  fail: 0,
};

function pointsFor(card) {
  return POINTS[String(card.group || "").toLowerCase()] ?? 0;
}

const Score = (() => {
  const KEY = "spinSim.score";
  let total = 0;
  try {
    const n = Number(localStorage.getItem(KEY));
    if (Number.isFinite(n) && n > 0) total = n;
  } catch (_) {}
  return {
    get() {
      return total;
    },
    add(n) {
      total += n;
      try {
        localStorage.setItem(KEY, String(total));
      } catch (_) {}
    },
  };
})();

const Tickets = (() => {
  const KEY = "spinSim.tickets";
  const START = 20;
  const REGEN_CAP = 20;
  const REGEN_MS = 5 * 60 * 1000;

  let state = null;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && Number.isFinite(raw.tickets) && Number.isFinite(raw.last))
      state = raw;
  } catch (_) {}
  if (!state) state = { tickets: START, last: Date.now() };

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {}
  };

  function sync(now = Date.now()) {
    if (now < state.last) state.last = now;
    if (state.tickets >= REGEN_CAP) {
      state.last = now;
      return;
    }
    const gained = Math.floor((now - state.last) / REGEN_MS);
    if (gained > 0) {
      state.tickets = Math.min(REGEN_CAP, state.tickets + gained);
      state.last =
        state.tickets >= REGEN_CAP ? now : state.last + gained * REGEN_MS;
    }
  }
  sync();
  save();

  return {
    get() {
      sync();
      return state.tickets;
    },
    msToNext() {
      sync();
      return state.tickets >= REGEN_CAP
        ? null
        : REGEN_MS - (Date.now() - state.last);
    },
    spend(n = 1) {
      sync();
      if (state.tickets < n) return false;
      state.tickets -= n;
      save();
      return true;
    },
    add(n) {
      sync();
      state.tickets += n;
      save();
    },
  };
})();

const FAIL_CARD = { name: "Fail", group: "Fail", image: "images/fail.png" };

let OBJEKTS = [];

function getCombination() {
  let rand = Math.random();

  if (rand < 0.6) {
    return { first: 14, special: 1, fail: 1 };
  } else if (rand < 0.9) {
    return { first: 14, special: 0, fail: 2 };
  } else {
    return { first: 14, special: 2, fail: 0 };
  }
}

const BONUS_COST = 2;
const BONUS_MIN_SPECIAL = 1;
const BONUS_GROUPS = {
  double: { guaranteed: 2, chance: 0.2, from: "atom01" },
  motion: { guaranteed: 2, chance: 0.2, from: "binary02" },
  unit: { guaranteed: 0, chance: 0.03, from: "binary02" },
  premier: { guaranteed: 0, chance: 0.02, from: "divine01" },
};

function groupAvailable(group, seasonId) {
  const cur = SEASONS.findIndex((s) => s.id === seasonId);
  const from = SEASONS.findIndex((s) => s.id === BONUS_GROUPS[group].from);
  return cur >= from;
}

function getBonusCombination(seasonId) {
  const combo = { double: 0, motion: 0, unit: 0, premier: 0 };
  for (const group in BONUS_GROUPS) {
    if (!groupAvailable(group, seasonId)) continue;
    const cfg = BONUS_GROUPS[group];
    combo[group] = cfg.guaranteed + (Math.random() < cfg.chance ? 1 : 0);
  }
  return combo;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(all) {
  const pool = {};
  all.forEach((c) => {
    const g = String(c.group || "").toLowerCase();
    (pool[g] = pool[g] || []).push(c);
  });
  return pool;
}

function numberSlots(set) {
  return shuffle(set).map((card, i) => ({
    ...card,
    slot: String(i + 1).padStart(2, "0"),
  }));
}

function generateSet(pool, seasonId) {
  const combo = getCombination();
  const firsts = shuffle(
    (pool.first || []).filter((c) => allowedInOriginal(c, seasonId)),
  );
  const specials = shuffle(
    (pool.special || []).filter((c) => allowedInOriginal(c, seasonId)),
  );

  const set = [
    ...firsts.slice(0, combo.first),
    ...specials.slice(0, combo.special),
    ...Array.from({ length: combo.fail }, () => ({ ...FAIL_CARD })),
  ];

  const spare = firsts.slice(combo.first);
  while (set.length < SET_SIZE && spare.length) set.push(spare.shift());

  return numberSlots(set);
}

function generateBonusSet(pool, seasonId) {
  const base = getCombination();
  const bonus = getBonusCombination(seasonId);
  const specialCount = Math.max(base.special, BONUS_MIN_SPECIAL);
  const bonusCount = Object.values(bonus).reduce((a, b) => a + b, 0);
  const firstCount = SET_SIZE - specialCount - base.fail - bonusCount;

  const firsts = shuffle(pool.first || []);
  const set = [];
  ["premier", "unit", "motion", "double"].forEach((group) => {
    set.push(...shuffle(pool[group] || []).slice(0, bonus[group]));
  });
  set.push(...shuffle(pool.special || []).slice(0, specialCount));
  set.push(...Array.from({ length: base.fail }, () => ({ ...FAIL_CARD })));
  set.push(...firsts.slice(0, firstCount));

  const spare = firsts.slice(firstCount);
  while (set.length < SET_SIZE && spare.length) set.push(spare.shift());

  return numberSlots(set);
}

const carousel = document.getElementById("carousel");
const spinBtn = document.getElementById("spinBtn");
const chooseBtn = document.getElementById("chooseBtn");
const againBtn = document.getElementById("againBtn");
const hint = document.getElementById("hint");
const resultPanel = document.getElementById("resultPanel");
const resultImage = document.getElementById("resultImage");
const resultName = document.getElementById("resultName");
const resultFront = document.getElementById("resultFront");
const resultText = document.getElementById("resultText");
const ticketCount = document.getElementById("ticketCount");
const ticketTimer = document.getElementById("ticketTimer");
const scoreCount = document.getElementById("scoreCount");
const bonusBtn = document.getElementById("bonusBtn");
const seasonTag = document.getElementById("seasonTag");
const seasonPanel = document.getElementById("seasonPanel");
const packCarousel = document.getElementById("packCarousel");
const packName = document.getElementById("packName");
const packSub = document.getElementById("packSub");
const packPrev = document.getElementById("packPrev");
const packNext = document.getElementById("packNext");
const seasonMsg = document.getElementById("seasonMsg");
const enterBtn = document.getElementById("enterBtn");
const gridPanel = document.getElementById("gridPanel");
const gridBoard = document.getElementById("gridBoard");
const viewAllBtn = document.getElementById("viewAllBtn");
const gridCloseBtn = document.getElementById("gridCloseBtn");
const HINT_DEFAULT = hint.innerHTML;

let centerIndex = 0;
let spinning = false;
let cards = [];
let pointerStartX = null;
let pointerMoved = false;
let resetTimer = null;
let activeSpin = false;
let round = { mode: "main", season: null };
let bonusReady = false;
let lastRound = null;
let selectedSeason = (() => {
  try {
    const id = localStorage.getItem("spinSim.season");
    if (SEASONS.some((s) => s.id === id)) return id;
  } catch (_) {}
  return SEASONS[0].id;
})();
const seasonPools = {};
const seasonStatus = {};

function buildCards() {
  carousel.innerHTML = "";
  cards = OBJEKTS.map((objekt, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.index = index;
    card.innerHTML = `<div class="card-shell" aria-label="Mystery Objekt"></div>`;
    carousel.appendChild(card);
    return card;
  });
  render();
}

function shortestOffset(index) {
  let d = index - centerIndex;
  const n = cards.length;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

function render() {
  cards.forEach((card, index) => {
    const d = shortestOffset(index);
    const abs = Math.abs(d);

    const x = d * 185;
    const z = -abs * 125;
    const rot = d * -24;
    const scale = d === 0 ? 1 : Math.max(0.62, 1 - abs * 0.12);

    card.style.setProperty("--x", `${x}px`);
    card.style.setProperty("--z", `${z}px`);
    card.style.setProperty("--rot", `${rot}deg`);
    card.style.setProperty("--scale", scale);
    card.style.opacity = abs > 2 ? "0" : String(Math.max(0.28, 1 - abs * 0.25));
    card.style.zIndex = String(20 - abs);
    card.classList.toggle("is-center", d === 0);
  });

  chooseBtn.disabled = spinning || !activeSpin;
}

function move(step) {
  if (spinning || cards.length === 0) return;
  centerIndex = (centerIndex + step + cards.length) % cards.length;
  render();
}

function spin() {
  if (spinning || !activeSpin) return;

  spinning = true;
  chooseBtn.disabled = true;
  spinBtn.disabled = true;
  hint.textContent = "Choosing at random...";

  const destination =
    (Math.floor(Math.random() * cards.length) + 1) % cards.length;
  const loops = 3 + Math.floor(Math.random() * 2);
  const totalSteps = loops * cards.length + destination;

  let step = 0;
  let delay = 45;

  const tick = () => {
    centerIndex = (centerIndex + 1) % cards.length;
    render();
    step++;

    if (step >= totalSteps) {
      setTimeout(() => {
        spinning = false;
        spinBtn.disabled = false;
        chooseBtn.disabled = false;
        hint.textContent =
          "Choose the Objekt you want by swiping it left or right.";
      }, 450);
      return;
    }

    const progress = step / totalSteps;
    delay = 35 + Math.pow(progress, 3.2) * 430;
    setTimeout(tick, delay);
  };

  tick();
}

function choose() {
  if (spinning || !activeSpin || !OBJEKTS.length) return;

  const chosen = OBJEKTS[centerIndex];
  const isFail = chosen.group === "Fail";
  const reward = rewardFor(chosen);
  const points = pointsFor(chosen);

  activeSpin = false;
  chooseBtn.disabled = true;
  Tickets.add(reward);
  Score.add(points);
  bonusReady = round.mode === "main";
  lastRound = { set: OBJEKTS.slice(), chosenIndex: centerIndex };

  if (chosen.image) {
    resultImage.src = chosen.image;
    resultImage.alt = chosen.name;
    resultImage.hidden = false;
    resultName.hidden = true;
  } else {
    resultImage.hidden = true;
    resultName.textContent = chosen.name.toUpperCase();
    resultName.hidden = false;
  }

  resultFront.classList.toggle(
    "is-special",
    ["Special", "Premier"].includes(chosen.group),
  );
  resultFront.classList.toggle("is-fail", isFail);
  resultText.textContent = isFail
    ? "Spin failed. Please try again next time."
    : "Spin was successful. Chosen the " + chosen.name + " Objekt.";

  const rewardEl = document.createElement("div");
  rewardEl.className = "reward";
  rewardEl.textContent =
    reward > 0
      ? `+${reward} ticket${reward > 1 ? "s" : ""} 🎟`
      : "No tickets earned";
  resultText.appendChild(rewardEl);

  const pointsEl = document.createElement("div");
  pointsEl.className = "points";
  pointsEl.textContent =
    points > 0
      ? `+${points} point${points > 1 ? "s" : ""} ★`
      : "No points earned";
  resultText.appendChild(pointsEl);

  bonusBtn.hidden = !bonusReady;
  bonusBtn.disabled = Tickets.get() < BONUS_COST;

  clearTimeout(resetTimer);
  resultPanel.classList.add("show");
  Reveal.play();
}

function hideResult() {
  Reveal.stop();
  closeGrid();
  resultPanel.classList.remove("show");
  clearTimeout(resetTimer);
  resetTimer = setTimeout(
    () => resultPanel.classList.remove("charging", "revealed"),
    500,
  );
}

function closeResult() {
  hideResult();
  bonusReady = false;
  showSeasonPanel();
}

function startBonus() {
  if (!bonusReady || spinning) return;
  const pool = seasonPools[round.season];
  if (!pool) return;
  const set = generateBonusSet(pool, round.season);
  if (!Tickets.spend(BONUS_COST)) {
    renderHud();
    return;
  }

  bonusReady = false;
  hideResult();

  OBJEKTS = set;
  centerIndex = Math.floor(Math.random() * set.length);
  spinning = false;
  activeSpin = true;
  round = { mode: "bonus", season: round.season };
  spinBtn.disabled = false;
  hint.innerHTML = HINT_DEFAULT;
  seasonTag.textContent =
    SEASONS.find((s) => s.id === round.season).label.toUpperCase() + " · BONUS";
  buildCards();
  renderHud();
}

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function renderHud() {
  ticketCount.textContent = Tickets.get();
  scoreCount.textContent = Score.get();
  if (bonusReady) bonusBtn.disabled = Tickets.get() < BONUS_COST;
  const ms = Tickets.msToNext();
  ticketTimer.textContent = ms === null ? "FULL" : "+1 in " + fmtTime(ms);
  updateEnterBtn();
}

async function loadSeason(id) {
  if (seasonPools[id]) return seasonPools[id];
  const season = SEASONS.find((s) => s.id === id);
  const res = await fetch(season.file);
  if (!res.ok) throw new Error(`${season.file}: ${res.status}`);
  seasonPools[id] = buildPool(await res.json());
  return seasonPools[id];
}

function probeSeasons() {
  SEASONS.forEach((s) => {
    seasonStatus[s.id] = "loading";
    loadSeason(s.id)
      .then(() => {
        seasonStatus[s.id] = "ready";
      })
      .catch(() => {
        seasonStatus[s.id] = "missing";
      })
      .finally(renderPacks);
  });
}

let packEls = [];

function packHTML(s) {
  const code = s.label[0].toUpperCase() + s.label.slice(-2);
  return `
    <div class="pack-body">
      <div class="pack-foil"></div>
      <div class="pack-crimp top"></div>
      <div class="pack-sticker">${s.label.toUpperCase()}</div>
      <div class="pack-seal"><b>${code}</b><i>tripleS</i></div>
      <div class="pack-band">
        <div class="pack-vert">SPIN PACK</div>
        <div class="pack-fine">Only manufactured for<br>Jyuubin318 Spin Simulator</div>
        <div class="pack-vert-right">SPIN PACK</div>
      </div>
      <div class="pack-crimp bottom"></div>
      <div class="pack-sheen"></div>
      <div class="pack-soon">COMING SOON</div>
    </div>`;
}

function buildPacks() {
  packCarousel.innerHTML = "";
  packEls = SEASONS.map((s, i) => {
    const el = document.createElement("article");
    el.className = "pack";
    el.dataset.index = i;
    el.style.setProperty("--accent", s.accent || "#5ee7ff");
    el.setAttribute("aria-label", s.label + " pack");
    el.innerHTML = packHTML(s);
    packCarousel.appendChild(el);
    return el;
  });
}

function renderPacks() {
  const sel = SEASONS.findIndex((s) => s.id === selectedSeason);
  packEls.forEach((el, i) => {
    const d = i - sel,
      abs = Math.abs(d);
    el.style.setProperty("--d", d);
    el.style.setProperty("--abs", abs);
    el.style.opacity = abs > 2 ? "0" : String(Math.max(0.35, 1 - abs * 0.28));
    el.style.zIndex = String(20 - abs);
    el.style.pointerEvents = abs > 2 ? "none" : "auto";
    el.classList.toggle("is-center", d === 0);
    el.classList.toggle(
      "is-missing",
      seasonStatus[SEASONS[i].id] === "missing",
    );
  });

  const cur = SEASONS[sel];
  const st = seasonStatus[cur.id];
  packName.textContent = cur.label.toUpperCase();
  packSub.textContent =
    st === "missing"
      ? "Coming soon"
      : st === "ready"
        ? "Swipe to browse packs"
        : "Loading…";
  packPrev.disabled = sel <= 0;
  packNext.disabled = sel >= SEASONS.length - 1;
  updateEnterBtn();
}

function selectSeasonIndex(i) {
  i = Math.max(0, Math.min(SEASONS.length - 1, i));
  selectedSeason = SEASONS[i].id;
  try {
    localStorage.setItem("spinSim.season", selectedSeason);
  } catch (_) {}
  renderPacks();
}

function stepSeason(step) {
  selectSeasonIndex(SEASONS.findIndex((s) => s.id === selectedSeason) + step);
}

function updateEnterBtn() {
  const st = seasonStatus[selectedSeason];
  const hasTickets = Tickets.get() > 0;
  enterBtn.disabled = st !== "ready" || !hasTickets;
  if (!hasTickets) {
    const ms = Tickets.msToNext();
    seasonMsg.textContent = "Out of tickets — next one in " + fmtTime(ms ?? 0);
  } else if (st === "missing") {
    seasonMsg.textContent = "This season isn't available yet.";
  } else if (st !== "ready") {
    seasonMsg.textContent = "Loading season…";
  } else {
    seasonMsg.textContent = "";
  }
}

function showSeasonPanel() {
  activeSpin = false;
  spinning = false;
  OBJEKTS = [];
  cards = [];
  carousel.innerHTML = "";
  spinBtn.disabled = true;
  chooseBtn.disabled = true;
  seasonTag.textContent = "";
  seasonPanel.classList.add("show");
  renderPacks();
}

async function enterSpin() {
  if (enterBtn.disabled) return;
  enterBtn.disabled = true;
  try {
    const pool = await loadSeason(selectedSeason);
    const set = generateSet(pool, selectedSeason);
    if (!Tickets.spend(1)) return;

    OBJEKTS = set;
    centerIndex = Math.floor(Math.random() * set.length);
    spinning = false;
    activeSpin = true;
    round = { mode: "main", season: selectedSeason };
    bonusReady = false;
    spinBtn.disabled = false;
    hint.innerHTML = HINT_DEFAULT;
    seasonTag.textContent = SEASONS.find(
      (s) => s.id === selectedSeason,
    ).label.toUpperCase();
    buildCards();
    seasonPanel.classList.remove("show");
  } catch (err) {
    console.error(err);
    seasonMsg.textContent = "Could not load this season's data.";
  } finally {
    renderHud();
  }
}

function openGrid() {
  if (!lastRound) return;
  gridBoard.innerHTML = "";
  lastRound.set.forEach((card, i) => {
    const g = String(card.group || "").toLowerCase();
    const cell = document.createElement("div");
    cell.className =
      `grid-cell group-${g}` +
      (i === lastRound.chosenIndex ? " is-chosen" : "");

    if (card.image) {
      const img = document.createElement("img");
      img.src = card.image;
      img.alt = card.name;
      img.loading = "lazy";
      cell.appendChild(img);
    } else {
      const n = document.createElement("span");
      n.className = "cell-name";
      n.textContent = card.name;
      cell.appendChild(n);
    }

    const tag = document.createElement("span");
    tag.className = "cell-tag";
    tag.textContent = g === "fail" ? "FAIL" : "+" + rewardFor(card);
    cell.appendChild(tag);

    if (i === lastRound.chosenIndex) {
      const yours = document.createElement("span");
      yours.className = "cell-yours";
      yours.textContent = "YOURS";
      cell.appendChild(yours);
    }
    gridBoard.appendChild(cell);
  });
  gridPanel.classList.add("show");
}

function closeGrid() {
  gridPanel.classList.remove("show");
}

const Reveal = (() => {
  const T_CHARGE = 1.9;
  const T_FLASH = 3.1;
  const T_END = 4.3;

  const stage = document.getElementById("revealStage");
  const wrap = document.getElementById("resultWrap");
  const flashEl = document.getElementById("revealFlash");
  const bgEl = document.getElementById("revealBg");
  const back = document.getElementById("orbitBack");
  const front = document.getElementById("orbitFront");
  const bctx = back.getContext("2d");
  const fctx = front.getContext("2d");

  const SIN_A = 0.24,
    COS_A = Math.sqrt(1 - SIN_A * SIN_A);
  const ribbons = [
    { cy: 0.24, roll: -0.16, phase: 0, dir: 1, k: 1.0, w: 1.0 },
    { cy: -0.27, roll: 0.2, phase: Math.PI * 0.8, dir: -1, k: 0.8, w: 0.75 },
  ];

  let W = 0,
    H = 0,
    dpr = 1,
    raf = null;
  let start = 0,
    last = 0,
    theta = 0,
    flashed = false,
    sparks = [];

  for (let i = 0; i < 30; i++) {
    const d = document.createElement("div");
    const size = 3 + Math.random() * 9;
    d.className = "bokeh";
    d.style.cssText =
      `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
      `--d:${4 + Math.random() * 6}s;--delay:${-Math.random() * 6}s;` +
      `--dx:${(Math.random() - 0.5) * 40}px;--dy:${-10 - Math.random() * 30}px;`;
    bgEl.appendChild(d);
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    W = r.width;
    H = r.height;
    [back, front].forEach((c) => {
      c.width = W * dpr;
      c.height = H * dpr;
    });
    [bctx, fctx].forEach((ctx) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "butt";
    });
  }

  function clear() {
    bctx.clearRect(0, 0, W, H);
    fctx.clearRect(0, 0, W, H);
  }

  function project(rib, th, R, cardH) {
    const s = Math.sin(th),
      c = Math.cos(th);
    const x = R * c,
      y = R * s * SIN_A,
      z = R * s * COS_A;
    const rx = x * Math.cos(rib.roll) - y * Math.sin(rib.roll);
    const ry = x * Math.sin(rib.roll) + y * Math.cos(rib.roll);
    const f = R * 3.5,
      sc = f / (f - z);
    return { x: W / 2 + rx * sc, y: H / 2 + rib.cy * cardH + ry * sc, z, sc };
  }

  function star(ctx, x, y, r, a) {
    if (a <= 0.01 || r <= 0.1) return;
    const n = r * 0.2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(200,170,255,1)";
    ctx.shadowBlur = r * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + n, y - n);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + n, y + n);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - n, y + n);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - n, y - n);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawRibbon(rib, th, L, R, cardH, alpha, t) {
    const N = 90;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = project(rib, th - rib.dir * L * (1 - u), R, cardH);
      if (prev) {
        const ctx = (p.z + prev.z) / 2 > 0 ? fctx : bctx;
        const a = Math.pow(u, 1.6) * alpha;
        const w = (0.4 + 6.5 * Math.pow(u, 1.2)) * p.sc * rib.w;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.lineWidth = w * 3.6;
        ctx.strokeStyle = `rgba(150,110,255,${a * 0.22})`;
        ctx.stroke();
        ctx.lineWidth = w;
        ctx.strokeStyle = `rgba(238,228,255,${a * 0.85})`;
        ctx.stroke();
      }
      prev = p;
    }

    const head = project(rib, th, R, cardH);
    const hctx = head.z > 0 ? fctx : bctx;
    star(hctx, head.x, head.y, 11 * head.sc * rib.w, alpha);
    [0.45, 0.7, 0.88].forEach((u, k) => {
      const p = project(rib, th - rib.dir * L * (1 - u), R, cardH);
      const tw = 0.5 + 0.5 * Math.sin(t * 9 + k * 2.3 + rib.phase);
      star(
        p.z > 0 ? fctx : bctx,
        p.x,
        p.y,
        (4 + 4 * tw) * p.sc,
        alpha * (0.4 + 0.6 * tw),
      );
    });
  }

  function burst() {
    const cx = W / 2,
      cy = H / 2;
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 380;
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0,
        max: 0.8 + Math.random() * 0.8,
        r: 2 + Math.random() * 5,
      });
    }
  }

  const ease = (x) => x * x * (3 - 2 * x);

  function frame(now) {
    if (!start) {
      start = now;
      last = now;
    }
    const t = (now - start) / 1000;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const panel = document.getElementById("resultPanel");
    if (t >= T_CHARGE) panel.classList.add("charging");
    if (!flashed && t >= T_FLASH) {
      flashed = true;
      panel.classList.add("revealed");
      flashEl.classList.remove("go");
      void flashEl.offsetWidth;
      flashEl.classList.add("go");
      burst();
    }

    const charge =
      t < T_CHARGE
        ? 0
        : ease(Math.min(1, (t - T_CHARGE) / (T_FLASH - T_CHARGE)));
    const omega = 1.3 + 6.2 * charge;
    theta += omega * dt;
    const L = 1.5 + 3.4 * charge;
    const cw = wrap.offsetWidth,
      cardH = cw * 1.5;
    const R = Math.min(cw * 1.0, W * 0.4) * (1 - 0.18 * charge);
    const alpha =
      Math.min(1, t / 0.5) *
      (t > T_FLASH ? Math.max(0, 1 - (t - T_FLASH) / 0.7) : 1);

    clear();
    if (alpha > 0.01) {
      ribbons.forEach((rib) =>
        drawRibbon(
          rib,
          rib.phase + rib.dir * theta * rib.k,
          L,
          R,
          cardH,
          alpha,
          t,
        ),
      );
    }

    sparks = sparks.filter((p) => (p.life += dt) < p.max);
    sparks.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      star(
        fctx,
        p.x,
        p.y,
        p.r * (1 - (p.life / p.max) * 0.5),
        1 - p.life / p.max,
      );
    });

    if (t < T_END || sparks.length) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = null;
      clear();
    }
  }

  function play() {
    stop();
    size();
    start = 0;
    theta = 0;
    flashed = false;
    sparks = [];
    const panel = document.getElementById("resultPanel");
    panel.classList.remove("charging", "revealed");
    flashEl.classList.remove("go");
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    clear();
  }

  window.addEventListener("resize", () => {
    if (raf) size();
  });

  return { play, stop };
})();

carousel.addEventListener("pointerdown", (event) => {
  if (spinning) return;
  pointerStartX = event.clientX;
  pointerMoved = false;
  carousel.setPointerCapture?.(event.pointerId);
});

carousel.addEventListener("pointermove", (event) => {
  if (pointerStartX === null || spinning) return;
  if (Math.abs(event.clientX - pointerStartX) > 10) pointerMoved = true;
});

carousel.addEventListener("pointerup", (event) => {
  if (pointerStartX === null || spinning) return;

  const delta = event.clientX - pointerStartX;
  pointerStartX = null;

  if (!pointerMoved || Math.abs(delta) < 35) return;

  move(delta < 0 ? 1 : -1);
});

carousel.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (!card || spinning) return;

  const index = Number(card.dataset.index);
  const d = shortestOffset(index);

  if (d !== 0) {
    centerIndex = index;
    render();
  }
});

spinBtn.addEventListener("click", spin);
chooseBtn.addEventListener("click", choose);
enterBtn.addEventListener("click", enterSpin);
viewAllBtn.addEventListener("click", openGrid);
gridCloseBtn.addEventListener("click", closeGrid);
againBtn.addEventListener("click", closeResult);
bonusBtn.addEventListener("click", startBonus);
packPrev.addEventListener("click", () => stepSeason(-1));
packNext.addEventListener("click", () => stepSeason(1));

let packStartX = null;
let packDragged = false;

packCarousel.addEventListener("pointerdown", (event) => {
  packStartX = event.clientX;
  packDragged = false;
});

packCarousel.addEventListener("pointermove", (event) => {
  if (packStartX !== null && Math.abs(event.clientX - packStartX) > 10)
    packDragged = true;
});

window.addEventListener("pointerup", (event) => {
  if (packStartX === null) return;
  const dx = event.clientX - packStartX;
  packStartX = null;
  if (packDragged && Math.abs(dx) > 35) stepSeason(dx < 0 ? 1 : -1);
});

packCarousel.addEventListener("click", (event) => {
  if (packDragged) {
    packDragged = false;
    return;
  }
  const pack = event.target.closest(".pack");
  if (pack) selectSeasonIndex(Number(pack.dataset.index));
});

document.addEventListener("keydown", (event) => {
  if (!seasonPanel.classList.contains("show")) return;
  if (event.key === "ArrowLeft") stepSeason(-1);
  if (event.key === "ArrowRight") stepSeason(1);
  if (event.key === "Enter") enterSpin();
});

buildPacks();
renderHud();
setInterval(renderHud, 1000);
showSeasonPanel();
probeSeasons();
