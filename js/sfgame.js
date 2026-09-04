const S = {
  jackpot: 100000,
  ladder: [],
  env: [],
  groups: {},
  round: 1,
  selected: null,
  final: [],
  round3Pool: [],
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

const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ===================== MONEY LADDER ===================== */
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
/* ======================================================== */

function startGame() {
  const input = $("jackpot");
  let entered = input ? Number(input.value) : 100000;
  if (!Number.isFinite(entered) || entered < 100) entered = 100000;

  const jackpot = Math.max(100, Math.round(entered / 1) * 1);

  S.jackpot = jackpot;
  S.ladder = ladder(jackpot);
  S.env = shuffle(S.ladder).map((value, index) => ({
    id: index + 1,
    value,
    group: null,
    dead: false,
  }));
  S.round = 1;
  S.selected = null;
  S.final = [];
  S.round3Pool = [];
  S.busy = false;
  S.gameOver = false;

  resetGroups();

  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  $("jackpotText").textContent = money(jackpot);
  $("round").textContent = "ROUND 1";
  $("instruction").textContent =
    "Distribute all 24 envelopes among the six colour groups.";
  msg("Each group must contain 4 envelopes.");

  tree();
  renderPlacement();
}

function resetGroups() {
  S.groups = {};
  defs.forEach(([id]) => (S.groups[id] = []));
  S.selected = null;
}

function msg(text) {
  $("message").textContent = text;
}

function tree() {
  $("tree").innerHTML = S.ladder
    .map((value) => `<div class="step">${money(value)}</div>`)
    .join("");
}

/* ======================== ROUNDS 1/2 ======================== */

function renderPlacement() {
  const capacity = S.round === 1 ? 4 : 3;
  const available = S.env.filter((e) => !e.dead);

  $("pool").innerHTML = available
    .map(
      (e) => `
    <button class="envelope ${S.selected === e.id ? "selected" : ""}" data-id="${e.id}">
      ${e.id}
    </button>
  `,
    )
    .join("");

  document.querySelectorAll("#pool .envelope").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);
      S.selected = S.selected === id ? null : id;
      renderPlacement();
    });
  });

  $("groups").innerHTML = defs
    .map(([id, name]) => {
      const items = S.groups[id] || [];
      return `
      <div class="group ${id}" data-group="${id}">
        <h3>${name}</h3>
        <div class="group-count">${items.length}/${capacity}</div>
        ${items.map((id) => `<span class="mini">${id}</span>`).join("")}
      </div>
    `;
    })
    .join("");

  document.querySelectorAll("#groups .group").forEach((group) => {
    group.addEventListener("click", () => {
      if (S.selected === null) return;

      const groupId = group.dataset.group;
      if (S.groups[groupId].length >= capacity) return;

      const envelope = S.env.find((e) => e.id === S.selected);
      if (!envelope) return;

      if (envelope.group) {
        S.groups[envelope.group] = S.groups[envelope.group].filter(
          (id) => id !== envelope.id,
        );
      }

      S.groups[groupId].push(envelope.id);
      envelope.group = groupId;
      S.selected = null;

      renderPlacement();
    });
  });

  const total = Object.values(S.groups).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  const needed = S.round === 1 ? 24 : 18;
  const complete = total === needed;

  $("lock").disabled = !complete;
  $("lock").style.opacity = complete ? "1" : ".45";
}

async function lock() {
  if (S.busy) return;

  const needed = S.round === 1 ? 24 : 18;
  const total = Object.values(S.groups).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  if (total !== needed) return;

  S.busy = true;

  const lowest = [];
  for (const [groupId] of defs) {
    const members = S.groups[groupId]
      .map((id) => S.env.find((e) => e.id === id))
      .filter(Boolean);

    if (!members.length) {
      S.busy = false;
      return;
    }

    lowest.push(members.reduce((a, b) => (a.value <= b.value ? a : b)));
  }

  msg(
    "Groups locked. The computer is revealing the lowest envelope in each group...",
  );
  await wait(700);

  for (const envelope of lowest) {
    envelope.dead = true;
    envelope.group = null;
    await reveal(envelope, "LOWEST IN ITS GROUP");
  }

  S.busy = false;

  if (S.round === 1) {
    S.round = 2;
    resetGroups();
    $("round").textContent = "ROUND 2";
    $("instruction").textContent =
      "Distribute the remaining 18 envelopes among the six colour groups.";
    msg("Round 2: each group must contain 3 envelopes.");
    renderPlacement();
  } else {
    beginRound3();
  }
}

/* ======================== ROUND 3 ======================== */

function beginRound3() {
  S.round = 3;
  S.groups = { A: [], B: [] };
  S.selected = null;

  const remaining = shuffle(S.env.filter((e) => !e.dead));
  S.round3Pool = remaining.map((e) => e.id);

  $("placement").classList.add("hidden");
  $("choice").classList.remove("hidden");
  $("averageChoices").classList.add("hidden");
  $("lockRound3").classList.remove("hidden");

  $("round").textContent = "ROUND 3";
  $("round3Instruction").textContent =
    "Choose an envelope, then click Group A or Group B. Each group must contain 6 envelopes.";
  msg("You decide how the 12 envelopes are divided. No computer allocation.");

  renderRound3();
}

function renderRound3() {
  const ids = S.round3Pool;

  $("round3Pool").innerHTML = ids
    .map((id) => {
      const envelope = S.env.find((e) => e.id === id);
      const isSelected = S.selected === id;
      const placed = envelope && envelope.group ? ` — ${envelope.group}` : "";

      return `
      <button class="envelope ${isSelected ? "selected" : ""}" data-r3-id="${id}">
        ${id}${placed}
      </button>
    `;
    })
    .join("");

  document.querySelectorAll("#round3Pool .envelope").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.r3Id);
      const envelope = S.env.find((e) => e.id === id);
      if (!envelope) return;

      // Clicking a placed envelope selects it for moving.
      S.selected = S.selected === id ? null : id;
      renderRound3();
    });
  });

  renderRound3Groups();

  const complete = S.groups.A.length === 6 && S.groups.B.length === 6;

  $("lockRound3").disabled = !complete;
  $("lockRound3").style.opacity = complete ? "1" : ".45";
}

function renderRound3Groups() {
  $("countA").textContent = `${S.groups.A.length} / 6`;
  $("countB").textContent = `${S.groups.B.length} / 6`;

  $("listA").innerHTML = S.groups.A.map(
    (id) =>
      `<span class="mini" data-r3-remove="${id}" data-r3-group="A">${id}</span>`,
  ).join("");

  $("listB").innerHTML = S.groups.B.map(
    (id) =>
      `<span class="mini" data-r3-remove="${id}" data-r3-group="B">${id}</span>`,
  ).join("");

  document.querySelectorAll("[data-r3-remove]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();

      const id = Number(item.dataset.r3Remove);
      const group = item.dataset.r3Group;
      const envelope = S.env.find((e) => e.id === id);

      S.groups[group] = S.groups[group].filter((x) => x !== id);
      if (envelope) envelope.group = null;

      S.selected = null;
      renderRound3();
    });
  });

  // Clicking the large Group A/B boxes places the selected envelope.
  $("groupA").onclick = () => placeRound3("A");
  $("groupB").onclick = () => placeRound3("B");
}

function placeRound3(group) {
  if (S.selected === null) {
    msg("Select an envelope first, then click Group A or Group B.");
    return;
  }

  if (S.groups[group].length >= 6) {
    msg(`Group ${group} already contains 6 envelopes.`);
    return;
  }

  const id = S.selected;
  const envelope = S.env.find((e) => e.id === id);
  if (!envelope) return;

  // Remove it from its previous group if it was already placed.
  if (envelope.group === "A" || envelope.group === "B") {
    S.groups[envelope.group] = S.groups[envelope.group].filter((x) => x !== id);
  }

  S.groups[group].push(id);
  envelope.group = group;
  S.selected = null;

  renderRound3();
  msg(`Envelope ${id} placed in Group ${group}.`);
}

async function lockRound3() {
  if (S.busy) return;

  if (S.groups.A.length !== 6 || S.groups.B.length !== 6) {
    msg("Each group must contain exactly 6 envelopes.");
    return;
  }

  S.busy = true;

  const A = S.groups.A.map((id) => S.env.find((e) => e.id === id));
  const B = S.groups.B.map((id) => S.env.find((e) => e.id === id));

  const avgA = A.reduce((sum, e) => sum + e.value, 0) / 6;
  const avgB = B.reduce((sum, e) => sum + e.value, 0) / 6;

  $("round3Pool").innerHTML = "";
  $("listA").innerHTML = S.groups.A.map(
    (id) => `<span class="mini">${id}</span>`,
  ).join("");
  $("listB").innerHTML = S.groups.B.map(
    (id) => `<span class="mini">${id}</span>`,
  ).join("");

  $("lockRound3").classList.add("hidden");
  $("round3Instruction").textContent =
    "Your groups are locked. The averages are your only clue. Choose A or B.";
  $("avgA").textContent = money(avgA);
  $("avgB").textContent = money(avgB);
  $("averageChoices").classList.remove("hidden");

  S.busy = false;
  msg(
    "Both groups are locked. Choose the group you want to take into the Final Round.",
  );
}

function choose(group) {
  if (S.busy || S.gameOver) return;

  const ids = S.groups[group];
  if (!ids || ids.length !== 6) return;

  // Only the chosen group survives.
  S.env.forEach((e) => {
    if (!ids.includes(e.id)) e.dead = true;
  });

  S.final = shuffle(
    ids.map((id) => {
      const e = S.env.find((x) => x.id === id);
      return { id: e.id, value: e.value, dead: false };
    }),
  );

  $("choice").classList.add("hidden");
  $("final").classList.remove("hidden");
  $("round").textContent = "FINAL ROUND";

  msg(`Group ${group} selected. The six envelopes are being shuffled.`);
  renderFinal();
}

/* ======================== FINAL ROUND ======================== */

function renderFinal() {
  const active = S.final.filter((e) => !e.dead);

  $("finalInstruction").textContent =
    active.length === 2
      ? "Two envelopes remain. Choose one to claim your Secret Fortune."
      : `Choose an envelope to eliminate. ${active.length} envelopes remain.`;

  $("finalEnvelopes").innerHTML = active
    .map(
      (e) =>
        `<button class="final-envelope" data-final-id="${e.id}">?</button>`,
    )
    .join("");

  document.querySelectorAll(".final-envelope").forEach((button) => {
    button.addEventListener("click", () =>
      finalPick(Number(button.dataset.finalId)),
    );
  });
}

async function finalPick(id) {
  if (S.busy || S.gameOver) return;

  const active = S.final.filter((e) => !e.dead);
  const envelope = S.final.find((e) => e.id === id);

  if (!envelope) return;

  S.busy = true;

  if (active.length > 2) {
    envelope.dead = true;
    await reveal(envelope, "ENVELOPE ELIMINATED");
    renderFinal();
    msg(`${S.final.filter((e) => !e.dead).length} envelopes remain.`);
    S.busy = false;
  } else {
    await reveal(envelope, "YOUR SECRET FORTUNE");
    S.gameOver = true;
    $("final").classList.add("hidden");
    $("result").classList.remove("hidden");
    $("amount").textContent = money(envelope.value);
    $("round").textContent = "GAME COMPLETE";
    msg("Your Secret Fortune has been revealed.");
    S.busy = false;
  }
}

/* ======================== REVEAL ======================== */

function reveal(envelope, title) {
  return new Promise((resolve) => {
    $("modalTitle").textContent = title;
    $("modalEnv").textContent = envelope.id;
    $("modalMoney").textContent = money(envelope.value);

    $("continue").onclick = () => {
      $("modal").classList.add("hidden");
      resolve();
    };

    $("modal").classList.remove("hidden");
  });
}

/* ======================== INITIALIZE ======================== */

document.addEventListener("DOMContentLoaded", () => {
  $("start").addEventListener("click", startGame);
  $("lock").addEventListener("click", lock);
  $("lockRound3").addEventListener("click", lockRound3);

  document.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", () => choose(button.dataset.g));
  });
});
