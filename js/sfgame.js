const S = {
  jackpot: 0,
  ladder: [],
  env: [],
  groups: {},
  round: 1,
  selected: null,
  final: [],
  busy: false,
  gameOver: false,
};
const defs = [
  ["red", "RED"],
  ["orange", "ORANGE"],
  ["yellow", "YELLOW"],
  ["green", "GREEN"],
  ["blue", "BLUE"],
  ["purple", "PURPLE"],
];
const $ = (id) => document.getElementById(id),
  money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/*
 * ============================================================
 * MONEY LADDER
 * ============================================================
 * Edit the 24 values below.
 * The final value is automatically replaced by the custom jackpot.
 * Keep the values in ascending order.
 */
const BASE_MONEY_LADDER = [
  100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12000,
  14000, 16000, 18000, 20000, 25000, 30000, 35000, 40000, 50000, 75000, 100000,
];

function ladder(jackpot) {
  const baseJackpot = 100000;
  return BASE_MONEY_LADDER.map((value, index) => {
    if (index === BASE_MONEY_LADDER.length - 1) return jackpot;
    const scaled = Math.round(((value / baseJackpot) * jackpot) / 1) * 1;
    return Math.max(1, scaled);
  });
}

function startGame() {
  let j = Math.max(
    100,
    Math.round((Number($("jackpot").value) || 100000) / 100) * 100,
  );
  S.jackpot = j;
  S.ladder = ladder(j);
  S.env = shuffle(S.ladder).map((v, i) => ({
    id: i + 1,
    value: v,
    group: null,
    dead: false,
  }));
  S.round = 1;
  S.gameOver = false;
  resetGroups();
  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  $("jackpotText").textContent = money(j);
  $("round").textContent = "ROUND 1";
  $("instruction").textContent =
    "Distribute all 24 envelopes among the six colour groups.";
  msg("Each group must contain 4 envelopes.");
  tree();
  placement();
}
function resetGroups() {
  S.groups = {};
  defs.forEach((x) => (S.groups[x[0]] = []));
  S.selected = null;
}
function msg(x) {
  $("message").textContent = x;
}
function tree() {
  $("tree").innerHTML = S.ladder
    .map((v) => `<div class="step">${money(v)}</div>`)
    .join("");
}
function placement() {
  let cap = S.round === 1 ? 4 : 3;
  let avail = S.env.filter((e) => !e.dead);
  $("pool").innerHTML = avail
    .map(
      (e) =>
        `<button class="envelope ${e.group ? "selected" : ""}" data-id="${e.id}">${e.id}</button>`,
    )
    .join("");
  document.querySelectorAll(".envelope").forEach(
    (b) =>
      (b.onclick = () => {
        S.selected = +b.dataset.id;
        placement();
      }),
  );
  $("groups").innerHTML = defs
    .map(([id, n]) => {
      let a = S.groups[id] || [];
      return `<div class="group ${id}" data-g="${id}"><h3>${n}</h3><div class="group-count">${a.length}/${cap}</div>${a.map((id) => `<span class="mini">${id}</span>`).join("")}</div>`;
    })
    .join("");
  document.querySelectorAll(".group").forEach(
    (g) =>
      (g.onclick = () => {
        if (S.selected == null) return;
        let id = g.dataset.g;
        if (S.groups[id].length >= cap) return;
        let e = S.env.find((e) => e.id === S.selected);
        if (e.group)
          S.groups[e.group] = S.groups[e.group].filter((x) => x !== e.id);
        S.groups[id].push(e.id);
        e.group = id;
        S.selected = null;
        placement();
      }),
  );
  let total = Object.values(S.groups).reduce((x, a) => x + a.length, 0);
  $("lock").disabled = total !== (S.round === 1 ? 24 : 18);
  $("lock").style.opacity = total === (S.round === 1 ? 24 : 18) ? 1 : 0.45;
}
$("lock").onclick = lock;
async function lock() {
  if (S.busy) return;
  S.busy = true;
  let ids = [];
  for (let [id] of defs) {
    let a = S.groups[id].map((x) => S.env.find((e) => e.id === x));
    ids.push(a.reduce((x, y) => (x.value <= y.value ? x : y)));
  }
  msg(
    "Groups locked. The computer is revealing the lowest envelope in each group...",
  );
  await wait(700);
  for (let e of ids) {
    e.dead = true;
    e.group = null;
    await reveal(e, "LOWEST IN ITS GROUP");
  }
  S.busy = false;
  if (S.round === 1) {
    S.round = 2;
    resetGroups();
    $("round").textContent = "ROUND 2";
    $("instruction").textContent =
      "Distribute the remaining 18 envelopes among the six colour groups.";
    msg("Round 2: each group must contain 3 envelopes.");
    placement();
  } else {
    round3();
  }
}
async function reveal(e, title) {
  return new Promise((resolve) => {
    $("modalTitle").textContent = title;
    $("modalEnv").textContent = e.id;
    $("modalMoney").textContent = money(e.value);
    $("continue").onclick = () => {
      $("modal").classList.add("hidden");
      resolve();
    };
    $("modal").classList.remove("hidden");
  });
}
function round3() {
  S.round = 3;
  $("placement").classList.add("hidden");
  $("choice").classList.remove("hidden");
  $("round").textContent = "ROUND 3";
  let a = shuffle(S.env.filter((e) => !e.dead)),
    A = a.slice(0, 6),
    B = a.slice(6, 12);
  S.groups = { A: A.map((e) => e.id), B: B.map((e) => e.id) };
  $("avgA").textContent = money(A.reduce((s, e) => s + e.value, 0) / 6);
  $("avgB").textContent = money(B.reduce((s, e) => s + e.value, 0) / 6);
  msg("Choose Group A or B. The average is your only clue.");
}
document
  .querySelectorAll("[data-g]")
  .forEach((b) => b.addEventListener("click", () => choose(b.dataset.g)));

function choose(g) {
  let ids = S.groups[g];
  S.env.forEach((e) => {
    if (!ids.includes(e.id)) e.dead = true;
  });
  S.final = shuffle(
    ids.map((id) => {
      let e = S.env.find((x) => x.id === id);
      return { id: e.id, value: e.value, dead: false };
    }),
  );
  $("choice").classList.add("hidden");
  $("final").classList.remove("hidden");
  $("round").textContent = "FINAL ROUND";
  msg(`Group ${g} selected. The six envelopes are being shuffled.`);
  renderFinal();
}
function renderFinal() {
  let a = S.final.filter((e) => !e.dead);
  $("finalInstruction").textContent =
    a.length === 2
      ? "Two envelopes remain. Choose one to claim your Secret Fortune."
      : `Choose an envelope to eliminate. ${a.length} envelopes remain.`;
  $("finalEnvelopes").innerHTML = a
    .map((e) => `<button class="final-envelope" data-id="${e.id}">?</button>`)
    .join("");
  document
    .querySelectorAll(".final-envelope")
    .forEach((b) => (b.onclick = () => finalPick(+b.dataset.id)));
}
async function finalPick(id) {
  if (S.busy || S.gameOver) return;
  let a = S.final.filter((e) => !e.dead),
    e = S.final.find((x) => x.id === id);
  if (!e) return;
  if (a.length > 2) {
    e.dead = true;
    await reveal(e, "ENVELOPE ELIMINATED");
    renderFinal();
    msg(`${S.final.filter((x) => !x.dead).length} envelopes remain.`);
  } else {
    S.busy = true;
    await reveal(e, "YOUR SECRET FORTUNE");
    S.gameOver = true;
    $("final").classList.add("hidden");
    $("result").classList.remove("hidden");
    $("amount").textContent = money(e.value);
    $("round").textContent = "GAME COMPLETE";
    msg("Your Secret Fortune has been revealed.");
    S.busy = false;
  }
}
$("start").onclick = startGame;
