/* =========================================================
   DEAL OR NO DEAL
   COMPLETE GAME SCRIPT
========================================================= */

/* =========================================================
   MASTER PRIZE BOARD
========================================================= */

/*const BASE_PRIZES = [
  0.01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000, 5000, 10000,
  25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000,
];*/

const BASE_PRIZES = [
  0.01, 1, 10, 50, 100, 200, 300, 500, 800, 1000, 3000, 5000, 10000, 50000, 80000, 100000, 150000, 200000, 250000, 300000, 400000, 500000, 600000, 700000, 800000, 1000000,
];

/* =========================================================
   GAME SETTINGS
========================================================= */

const TOTAL_CASES = 26;

/*
    Prize sets shown in the main menu dropdown.
    "ref" is the top prize the base list was written for;
    other top prizes scale the whole list proportionally.
*/

const CLASSIC_PRIZES = [
  0.01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000, 5000, 10000,
  25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000,
];

const SET_1 = [
  1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000, 2000, 2500, 5000, 7500, 10000, 20000, 30000, 40000, 50000, 100000, 200000, 250000, 500000,
];

const SET_2 = [
  100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12000, 14000, 16000, 18000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000,
];

const SET_3 = [
  1, 5, 10, 15, 20, 25, 50, 75, 100, 150, 250, 500, 750, 1000, 1500, 2500, 5000, 7500, 10000, 15000, 25000, 50000, 75000, 100000, 150000, 250000,
];

const PRIZE_SETS = {
  standard: {
    label: "Standard",
    base: BASE_PRIZES,
    ref: 1000000,
    note: "26 values from $0.01, scaled to your top prize.",
  },
  classic: {
    label: "Classic",
    base: CLASSIC_PRIZES,
    ref: 1000000,
    note: "The TV show ladder from 1¢, scaled to your top prize.",
  },
  custom: {
    label: "Custom",
    base: null,
    ref: null,
    note: "Type exactly 26 values. Top prize cases still replace the bottom of the right side.",
  },
  set1: {
    label: "Set 1",
    base: SET_1,
    ref: 500000, // the top value in your list
    note: "This set range from 1 to 500,000",
  },
  set2: {
    label: "Set 2",
    base: SET_2,
    ref: 100000, // the top value in your list
    note: "This set range from 1 to 100,000",
  },
  set3: {
    label: "Set 3",
    base: SET_3,
    ref: 250000, // the top value in your list
    note: "This set range from 1 to 250,000",
  },
};

let prizeSetKey = "standard";
let customPrizeValues = [];

/* Most cases that may share the top prize (keeps the hint side unambiguous) */
const MAX_TOP_PRIZE_CASES = 12;

/*
    Actual Deal or No Deal round structure:

    Round 1 → 6
    Round 2 → 5
    Round 3 → 4
    Round 4 → 3
    Round 5 → 2
    Round 6 → 1
    Round 7 → 1
    Round 8 → 1
    Round 9 → 1
*/

const ROUND_CASES = [6, 5, 4, 3, 2, 1, 1, 1, 1];

/* =========================================================
   GAME STATE
========================================================= */

let maxPrize = 1000000;

let topPrizeCount = 1;

let prizes = [];

let cases = [];

let playerCase = null;

let playerCaseValue = null;

let originalPlayerCase = null;

let round = 1;

let casesToOpen = 0;

let openedCasesThisRound = 0;

let gameOver = false;

let waitingForDeal = false;

/* =========================================================
   SUPER CHEST STATE
========================================================= */

let superChestAvailable = false;
let superChestBenefitAvailable = false;
let superChestBenefitUsed = false;
let superChestCases = [];
let superChestPlayerCases = [];
let superChestBankerCases = [];
let superChestPlayerTotal = 0;
let superChestBankerTotal = 0;
const SUPER_CHEST_CASE_COUNT = 20;
let superChestPhase = "inactive";
let superChestBusy = false;
let superChestTurn = 0;
let superChestPendingCase = null;

/* =========================================================
   GAME LOG
========================================================= */

/*
    Every important game event is stored here.

    The log is converted into a readable
    .txt file when the game ends.
*/

let gameLog = [];

let gameStartTime = null;

/* =========================================================
   DOM ELEMENTS
========================================================= */

const setupScreen = document.getElementById("setupScreen");

const gameScreen = document.getElementById("gameScreen");

const maxPrizeInput = document.getElementById("maxPrize");

const startButton = document.getElementById("startButton");

const casesContainer = document.getElementById("casesContainer");

const playerCaseElement = document.getElementById("playerCase");

const instruction = document.getElementById("instruction");

const instructionRound = document.getElementById("instructionRound");

const roundNumber = document.getElementById("roundNumber");

const casesLeftElement = document.getElementById("casesLeft");

const leftMoneyBoard = document.getElementById("leftMoneyBoard");

const rightMoneyBoard = document.getElementById("rightMoneyBoard");

/* =========================================================
   BANKER ELEMENTS
========================================================= */

const bankerSection = document.getElementById("bankerSection");

const bankerWaiting = document.getElementById("bankerWaiting");

const bankerOfferContent = document.getElementById("bankerOfferContent");

const bankerOffer = document.getElementById("bankerOffer");

const bankerHintElement = document.getElementById("bankerHint");

const superChestBenefitButton = document.getElementById(
  "superChestBenefitButton",
);
const superChestElement = document.getElementById("superChest");
const superChestInstruction = document.getElementById("superChestInstruction");
const superChestCasesElement = document.getElementById("superChestCases");
const superChestPlayerTotalElement = document.getElementById(
  "superChestPlayerTotal",
);
const superChestBankerTotalElement = document.getElementById(
  "superChestBankerTotal",
);
const superChestResultElement = document.getElementById("superChestResult");
const superChestContinueButton = document.getElementById(
  "superChestContinueButton",
);

const dealButton = document.getElementById("dealButton");

const noDealButton = document.getElementById("noDealButton");

/* =========================================================
   FINAL / MESSAGE ELEMENTS
========================================================= */

const finalChoice = document.getElementById("finalChoice");

const keepButton = document.getElementById("keepButton");

const swapButton = document.getElementById("swapButton");

const message = document.getElementById("message");

const newGameButton = document.getElementById("newGameButton");

/* New UI elements */
const setupError = document.getElementById("setupError");
const topCountInput = document.getElementById("topCount");
const prizeSetSelect = document.getElementById("prizeSet");
const prizeSetNote = document.getElementById("prizeSetNote");
const topPrizeField = document.getElementById("topPrizeField");
const customField = document.getElementById("customField");
const customValuesInput = document.getElementById("customValues");
const customCountElement = document.getElementById("customCount");
const openPips = document.getElementById("openPips");
const topPrizeElement = document.getElementById("topPrize");
const prizesLeftElement = document.getElementById("prizesLeft");
const offerHistoryElement = document.getElementById("offerHistory");
const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const resultDetail = document.getElementById("resultDetail");
const prizeToggle = document.getElementById("prizeToggle");
const prizeClose = document.getElementById("prizeClose");
const prizeBackdrop = document.getElementById("prizeBackdrop");

/* =========================================================
   START GAME
========================================================= */

startButton.addEventListener("click", startGame);

function startGame() {
  maxPrize = Number(maxPrizeInput.value);
  setupError.textContent = "";

  topPrizeCount = Number(topCountInput.value);

  if (
    !Number.isInteger(topPrizeCount) ||
    topPrizeCount < 1 ||
    topPrizeCount > MAX_TOP_PRIZE_CASES
  ) {
    setupError.textContent = `Top prize cases must be a whole number from 1 to ${MAX_TOP_PRIZE_CASES}.`;
    topCountInput.focus();
    return;
  }

  prizeSetKey = prizeSetSelect.value;

  if (prizeSetKey === "custom") {
    const parsed = parseCustomPrizes(customValuesInput.value);

    if (parsed.error) {
      setupError.textContent = parsed.error;
      customValuesInput.classList.add("invalid");
      customValuesInput.focus();
      return;
    }

    customValuesInput.classList.remove("invalid");
    customPrizeValues = parsed.values;
    maxPrize = Math.max(...customPrizeValues);
  } else if (!maxPrize || maxPrize <= 0) {
    setupError.textContent = "Enter a top prize greater than 0.";
    maxPrizeInput.focus();

    return;
  }

  resetGame();

  /*
        Record start time.
    */

  gameStartTime = new Date();

  /*
        Generate prize board.
    */

  prizes = generatePrizeBoard(maxPrize);

  /*
        Create cases.
    */

  cases = createCases(prizes);

  /*
        Start game log.
    */

  addLog({
    type: "GAME_START",

    date: formatDateTime(gameStartTime),

    maximumPrize: maxPrize,

    topPrizeCount: topPrizeCount,

    prizeSet: PRIZE_SETS[prizeSetKey].label,

    prizeBoard: [...prizes],
  });

  /*
        Switch screens.
    */

  setupScreen.classList.add("hidden");

  gameScreen.classList.remove("hidden");

  /*
        Render game.
    */

  renderMoneyBoard();

  renderCases();

  updateGameInfo();

  instruction.textContent = "CHOOSE YOUR CASE";

  message.textContent = "";
}

/* =========================================================
   RESET GAME
========================================================= */

function hideLegacyCounterOfferUI() {
  const counterButton = document.getElementById("counterButton");
  const counterPanel = document.getElementById("counterPanel");

  if (counterButton) {
    counterButton.classList.add("hidden");
  }

  if (counterPanel) {
    counterPanel.classList.add("hidden");
  }
}

function resetGame() {
  resetUiExtras();
  if (bankerHintElement) {
    bankerHintElement.classList.add("hidden");
    bankerHintElement.textContent = "";
  }

  playerCase = null;

  playerCaseValue = null;

  originalPlayerCase = null;

  round = 1;

  casesToOpen = 0;

  openedCasesThisRound = 0;

  gameOver = false;

  waitingForDeal = false;

  superChestAvailable = false;
  superChestBenefitAvailable = false;
  superChestBenefitUsed = false;
  superChestCases = [];
  superChestPlayerCases = [];
  superChestBankerCases = [];
  superChestPlayerTotal = 0;
  superChestBankerTotal = 0;
  superChestPhase = "inactive";
  superChestBusy = false;
  superChestTurn = 0;
  superChestPendingCase = null;
  document.getElementById("superChestDecision")?.remove();
  superChestElement.classList.add("hidden");
  superChestBenefitButton.classList.add("hidden");

  /*
        Reset log.
    */

  gameLog = [];

  gameStartTime = null;

  /*
        Hide Banker.
    */

  hideBankerUi();

  bankerWaiting.classList.remove("hidden");

  bankerOfferContent.classList.add("hidden");

  /*
        Hide final choice.
    */

  finalChoice.classList.add("hidden");

  /*
        Hide new game button.
    */

  newGameButton.classList.add("hidden");

  const logButton = document.getElementById("downloadLogButton");

  if (logButton) {
    logButton.remove();
  }

  /*
        Reset player case display.
    */

  playerCaseElement.textContent = "?";

  message.textContent = "";
}

/* =========================================================
   GENERATE PRIZE BOARD
========================================================= */

function generatePrizeBoard(maximumPrize) {
  /*
        Custom set: the player typed every value,
        so use them as they are (sorted ascending).
    */

  if (prizeSetKey === "custom") {
    const custom = [...customPrizeValues].sort((a, b) => a - b);

    for (let k = 0; k < topPrizeCount; k++) {
      custom[custom.length - 1 - k] = maximumPrize;
    }

    return custom;
  }

  const set = PRIZE_SETS[prizeSetKey] || PRIZE_SETS.standard;
  const multiplier = maximumPrize / set.ref;

  let generated = set.base.map((value) => {
    const scaled = value * multiplier;

    return smartRound(scaled);
  });

  /*
        Highest prize must equal
        the user's chosen amount.
    */

  generated[generated.length - 1] = maximumPrize;

  /*
        Keep values ascending.
    */

  for (let i = 1; i < generated.length; i++) {
    if (generated[i] <= generated[i - 1]) {
      generated[i] = generated[i - 1] + getMinimumIncrement(generated[i - 1]);
    }
  }

  /*
        Restore exact maximum.
    */

  generated[generated.length - 1] = maximumPrize;

  /*
        Top prize cases: overwrite the last N slots
        (the right side, counted from the bottom)
        with the jackpot amount.
    */

  for (let k = 0; k < topPrizeCount; k++) {
    generated[generated.length - 1 - k] = maximumPrize;
  }

  return generated;
}

/* =========================================================
   SMART ROUNDING
========================================================= */

function smartRound(value) {
  if (value < 0.01) {
    return 0.01;
  }

  if (value < 1) {
    return Math.round(value * 100) / 100;
  }

  return Math.round(value / 1) * 1;
}

function smartRoundOffer(value) {
  if (value < 0.01) {
    return 0.01;
  }

  if (value < 1) {
    return Math.round(value * 100) / 100;
  }

  if (value < 10) {
    return Math.round(value * 1) / 1;
  }

  if (value < 100) {
    return Math.round(value / 1) * 1;
  }

  if (value < 1000) {
    return Math.round(value / 10) * 10;
  }

  if (value < 10000) {
    return Math.round(value / 100) * 100;
  }

  return Math.round(value / 1000) * 1000;
}

/* =========================================================
   MINIMUM PRIZE INCREMENT
========================================================= */

function getMinimumIncrement(value) {
  if (value < 1) {
    return 0.01;
  }

  return 1;
}

/* =========================================================
   CREATE CASES
========================================================= */

function createCases(prizeValues) {
  const shuffledPrizes = [...prizeValues];

  shuffle(shuffledPrizes);

  return shuffledPrizes.map((value, index) => {
    return {
      number: index + 1,

      value: value,

      opened: false,

      isPlayerCase: false,
    };
  });
}

/* =========================================================
   SHUFFLE
========================================================= */

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/* =========================================================
   RENDER CASES
========================================================= */

function renderCases() {
  casesContainer.innerHTML = "";

  cases.forEach((gameCase) => {
    const button = document.createElement("button");
    const label = String(gameCase.number).padStart(2, "0");
    const showValue = gameCase.opened || gameOver;

    button.type = "button";
    button.className = "case";
    button.dataset.caseNumber = gameCase.number;

    if (gameCase.isPlayerCase) button.classList.add("player-selected");

    if (showValue) {
      button.classList.add("disabled", "revealed");
      button.dataset.tier = getTier(gameCase.value);
      button.textContent = formatCompact(gameCase.value);
      button.disabled = true;
      button.setAttribute(
        "aria-label",
        `Case ${label}${gameCase.isPlayerCase ? ", your case" : ""}: ${formatMoney(gameCase.value)}`,
      );
    } else {
      button.innerHTML = `<span class="case-num">${label}</span>`;
      button.setAttribute(
        "aria-label",
        gameCase.isPlayerCase ? `Case ${label}, your case` : `Case ${label}`,
      );
      button.addEventListener("click", () => handleCaseClick(gameCase));
    }

    casesContainer.appendChild(button);
  });
}

/* =========================================================
   HANDLE CASE CLICK
========================================================= */

function handleCaseClick(gameCase) {
  if (gameOver) {
    return;
  }

  if (waitingForDeal) {
    return;
  }

  if (gameCase.opened) {
    return;
  }

  /*
        FIRST CASE

        Select player's case.
    */

  if (playerCase === null) {
    playerCase = gameCase.number;

    originalPlayerCase = gameCase.number;

    playerCaseValue = gameCase.value;

    gameCase.isPlayerCase = true;

    playerCaseElement.textContent = String(playerCase).padStart(2, "0");

    /*
            Record player's case.
        */

    addLog({
      type: "PLAYER_CASE_SELECTED",

      caseNumber: gameCase.number,

      value: gameCase.value,
    });

    /*
            First round opens 6 cases.
        */

    casesToOpen = ROUND_CASES[0];

    instruction.textContent = `OPEN ${casesToOpen} CASES`;

    updateGameInfo();

    message.textContent =
      "YOUR CASE HAS BEEN SELECTED. " + "CHOOSE A CASE TO START.";

    renderCases();

    return;
  }

  /*
        Cannot open player's own case.
    */

  if (gameCase.number === playerCase) {
    message.textContent = "THAT'S YOUR CASE! " + "CHOOSE ANOTHER ONE.";

    return;
  }

  openCase(gameCase);
}

/* =========================================================
   OPEN CASE
========================================================= */

async function openCase(gameCase) {
  waitingForDeal = true;

  const caseButton = document.querySelector(
    `.case[data-case-number="${gameCase.number}"]`,
  );

  if (!caseButton) {
    waitingForDeal = false;

    return;
  }

  caseButton.classList.add("opening");

  instruction.textContent = `OPENING CASE ${String(gameCase.number).padStart(
    2,
    "0",
  )}...`;

  await delay(1200);

  /*
        Mark opened.
    */

  gameCase.opened = true;

  openedCasesThisRound++;

  caseButton.classList.remove("opening");

  caseButton.classList.add("revealed");

  /*
        Record case opening.
    */

  addLog({
    type: "CASE_OPENED",

    round: round,

    caseNumber: gameCase.number,

    value: gameCase.value,
  });

  /*
        Display amount.
    */

  caseButton.dataset.tier = getTier(gameCase.value);
  caseButton.textContent = formatCompact(gameCase.value);

  caseButton.classList.add("revealed");

  message.textContent =
    `CASE ${String(gameCase.number).padStart(2, "0")} CONTAINS ` +
    `${formatMoney(gameCase.value)}.`;

  await delay(900);

  /*
        Remove prize from board.
    */

  eliminatePrize(gameCase.value);

  renderMoneyBoard();

  renderCases();

  updateGameInfo();

  await delay(500);

  /*
        Only top prize cases left? The player has won.
    */

  if (onlyTopPrizesRemain()) {
    declareTopPrizeWin();

    return;
  }

  /*
        Round complete?
    */

  if (openedCasesThisRound >= casesToOpen) {
    waitingForDeal = true;

    showBanker();
  } else {
    waitingForDeal = false;

    const remaining = casesToOpen - openedCasesThisRound;

    instruction.textContent =
      `OPEN ${remaining} MORE CASE` + `${remaining === 1 ? "" : "S"}`;
  }
}

/* =========================================================
   ELIMINATE PRIZE
========================================================= */

function eliminatePrize(value) {
  /* Only ONE board slot per opened case, even if values repeat. */
  const slot = [...document.querySelectorAll(".money-value")].find(
    (el) => Number(el.dataset.value) === value && !el.classList.contains("eliminated"),
  );

  if (slot) slot.classList.add("eliminated");
}

/* =========================================================
   RENDER MONEY BOARD
========================================================= */

function renderMoneyBoard() {
  leftMoneyBoard.innerHTML = "";
  rightMoneyBoard.innerHTML = "";

  const half = Math.ceil(prizes.length / 2);

  prizes.forEach((value, index) => {
    const element = document.createElement("div");

    element.className = "money-value";
    element.dataset.value = value;
    element.dataset.tier = getTier(value);

    // Remove the "$" from formatMoney() so we can display
    // the currency symbol and amount separately.
    const formattedAmount = formatMoney(value).replace("$", "");

    element.innerHTML = `
      <span class="money-symbol">$</span>
      <span class="money-amount">${formattedAmount}</span>
    `;

    if (index < half) {
      leftMoneyBoard.appendChild(element);
    } else {
      rightMoneyBoard.appendChild(element);
    }
  });

  /*
      Reapply eliminated prizes.
  */

  cases.forEach((gameCase) => {
    if (gameCase.opened) {
      eliminatePrize(gameCase.value);
    }
  });
}

/* =========================================================
   FORMAT MONEY
========================================================= */

function formatMoney(value) {
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: value < 1 && value !== Math.floor(value) ? 2 : 0,

      maximumFractionDigits: 2,
    })
  );
}

/* =========================================================
   UPDATE GAME INFO
========================================================= */

function updateGameInfo() {
  roundNumber.textContent = round;

  const unopenedCases = cases.filter((gameCase) => !gameCase.opened).length;

  casesLeftElement.textContent = unopenedCases;

  refreshHud();
}

/* =========================================================
   BANKER'S HINT
========================================================= */

function getBankerHint() {
  if (round !== 3 || playerCaseValue === null) {
    return null;
  }

  const half = Math.ceil(prizes.length / 2);
  const playerPrizeIndex = prizes.indexOf(playerCaseValue);

  if (playerPrizeIndex === -1) {
    return null;
  }

  /* Same value on both sides of the board: the hint would be a guess. */
  if ((prizes.lastIndexOf(playerCaseValue) < half) !== (playerPrizeIndex < half)) {
    return null;
  }

  return playerPrizeIndex < half ? "LEFT" : "RIGHT";
}

/* =========================================================
   SHOW BANKER
========================================================= */

async function showBanker() {
  waitingForDeal = true;
  document.body.classList.add("banker-active");
  closePrizes();

  const offer = calculateBankerOffer();

  const unopenedCases = cases
    .filter((gameCase) => !gameCase.opened)
    .map((gameCase) => ({
      caseNumber: gameCase.number,
      value: gameCase.value,
      isPlayerCase: gameCase.isPlayerCase,
    }));

  bankerOffer.textContent = formatMoney(offer);

  offerHistory.push(offer);

  addLog({
    type: "BANKER_OFFER",
    round: round,
    offer: offer,
    unopenedCases: unopenedCases,
  });

  bankerSection.classList.remove("hidden");
  bankerWaiting.classList.remove("hidden");
  bankerOfferContent.classList.add("hidden");

  instruction.textContent = "THE BANKER IS CALLING...";
  message.textContent = "PLEASE WAIT FOR THE BANKER'S OFFER.";

  await delay(1200);

  bankerWaiting.classList.add("hidden");

  bankerOfferContent.classList.remove("hidden");

  if (superChestBenefitAvailable && !superChestBenefitUsed) {
    superChestBenefitButton.classList.remove("hidden");
  } else {
    superChestBenefitButton.classList.add("hidden");
  }

  hideLegacyCounterOfferUI();

  instruction.textContent = "DEAL OR NO DEAL?";

  renderOfferLadder(offer);

  renderOfferHistory();

  focusBanker();

  const bankerHint = getBankerHint();

  if (round === 3 && bankerHint) {
    bankerHintElement.textContent = `💡 Hint: your case is on the ${bankerHint} side of the board.`;

    bankerHintElement.classList.remove("hidden");

    addLog({
      type: "BANKER_HINT",
      round: round,
      side: bankerHint,
    });
  } else {
    bankerHintElement.classList.add("hidden");
  }

  message.textContent = "THE CASES ARE LOCKED UNTIL YOU ANSWER.";
}

/* =========================================================
   SUPER CHEST
========================================================= */

superChestBenefitButton.addEventListener("click", useSuperChestBenefit);
superChestContinueButton.addEventListener("click", finishSuperChest);

/* ---------------------------------------------------------
   CHEST DUEL

   You pick 10 of the 20 sealed chests. The Banker gets the
   other 10. Chests are then paired off and opened, and the
   higher total wins.

   Why it is a fair 50-50: every chest is hidden and shuffled,
   so any 10 chests are as good as any other 10. Nothing the
   player can choose gives either side an edge.

   The values add up to an ODD number, so the totals can never tie.
   If you edit the list, keep the sum odd.
--------------------------------------------------------- */

const SUPER_CHEST_VALUES = [
  15, 10, 20, 20, 30, 30, 50, 50, 75, 75, 100, 100, 150, 150, 200, 200, 300,
  400, 500, 1000,
];

const SUPER_CHEST_PICKS = 10;

let duelSwapUsed = false;
let duelSwapSelection = null;

const duelBar = document.getElementById("duelBar");
const duelBarFill = document.getElementById("duelBarFill");
const duelTaunt = document.getElementById("duelTaunt");
const duelActions = document.getElementById("duelActions");
const duelSecondaryButton = document.getElementById("duelSecondaryButton");
const duelPrimaryButton = document.getElementById("duelPrimaryButton");

duelSecondaryButton.addEventListener("click", pickForMe);
duelPrimaryButton.addEventListener("click", () => {
  if (superChestPhase === "pick") lockDuelPicks();
  else if (superChestPhase === "swap") startDuelReveal();
});

function countOwner(owner) {
  return superChestCases.filter((c) => c.owner === owner).length;
}

function padCase(n) {
  return String(n).padStart(2, "0");
}

function startSuperChest() {
  if (SUPER_CHEST_VALUES.length !== SUPER_CHEST_CASE_COUNT) {
    throw new Error("Super Chest must contain exactly 20 chests.");
  }

  if (SUPER_CHEST_VALUES.reduce((t, v) => t + v, 0) % 2 === 0) {
    console.warn("Super Chest values add up to an even number: ties are possible.");
  }

  superChestAvailable = true;
  superChestBenefitAvailable = false;
  superChestBenefitUsed = false;
  superChestPlayerCases = [];
  superChestBankerCases = [];
  superChestPlayerTotal = 0;
  superChestBankerTotal = 0;
  superChestTurn = 0;
  superChestBusy = false;
  superChestPendingCase = null;
  superChestPhase = "pick";
  duelSwapUsed = false;
  duelSwapSelection = null;

  const values = shuffle([...SUPER_CHEST_VALUES]);
  superChestCases = values.map((value, index) => ({
    number: index + 1,
    value,
    owner: null,
    revealed: false,
    duel: null,
  }));

  waitingForDeal = true;
  hideBankerUi();
  finalChoice.classList.add("hidden");
  superChestElement.classList.remove("hidden");
  superChestResultElement.classList.add("hidden");
  superChestContinueButton.classList.add("hidden");
  duelBar.classList.add("hidden");
  duelTaunt.textContent = "";

  instruction.textContent = "SUPER CHEST";
  message.textContent =
    "BEAT THE BANKER TO EARN A ONE-TIME +50% BANKER OFFER BENEFIT.";

  superChestInstruction.textContent = pickPrompt();
  renderSuperChestCases();
  updateSuperChestScoreboard();
  updateDuelControls();

  addLog({
    type: "SUPER_CHEST_START",
    round: 3,
    mode: "DUEL",
    caseCount: superChestCases.length,
    values: superChestCases.map(({ number, value }) => ({
      caseNumber: number,
      value,
    })),
  });
}

function pickPrompt() {
  const n = countOwner("player");

  return n < SUPER_CHEST_PICKS
    ? `Pick ${SUPER_CHEST_PICKS} chests. The Banker gets the rest. (${n} of ${SUPER_CHEST_PICKS})`
    : "10 chests picked. Lock them in, or tap one to swap it out.";
}

function renderSuperChestCases() {
  superChestCasesElement.innerHTML = "";

  superChestCases.forEach((c) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "super-chest-case";
    button.dataset.miniCaseNumber = c.number;
    button.textContent = c.revealed ? formatMoney(c.value) : padCase(c.number);

    if (c.owner === "player") button.classList.add("owner-player");
    if (c.owner === "banker") button.classList.add("owner-banker");
    if (c.revealed) button.classList.add("revealed");
    if (c.duel) button.classList.add(`duel-${c.duel}`);
    if (duelSwapSelection === c) button.classList.add("swap-pick");

    const who = c.owner === "player" ? ", yours" : c.owner === "banker" ? ", the Banker's" : "";
    button.setAttribute(
      "aria-label",
      c.revealed ? `Chest ${padCase(c.number)}${who}: ${formatMoney(c.value)}` : `Chest ${padCase(c.number)}${who}`,
    );

    const interactive =
      !superChestBusy && (superChestPhase === "pick" || superChestPhase === "swap");

    button.disabled = !interactive;
    if (interactive) button.addEventListener("click", () => handleSuperChestClick(c));

    superChestCasesElement.appendChild(button);
  });
}

function updateDuelControls() {
  const phase = superChestPhase;
  const showing = phase === "pick" || phase === "swap";

  duelActions.classList.toggle("hidden", !showing);
  duelSecondaryButton.classList.toggle("hidden", phase !== "pick");

  if (phase === "pick") {
    duelPrimaryButton.textContent = "Lock in picks";
    duelPrimaryButton.disabled = countOwner("player") !== SUPER_CHEST_PICKS;
  } else if (phase === "swap") {
    duelPrimaryButton.textContent = "Start the duel";
    duelPrimaryButton.disabled = false;
  }
}

function handleSuperChestClick(c) {
  if (superChestBusy) return;

  if (superChestPhase === "pick") {
    if (c.owner === "player") {
      c.owner = null;
    } else if (countOwner("player") < SUPER_CHEST_PICKS) {
      c.owner = "player";
    } else {
      superChestInstruction.textContent =
        "You already have 10 chests. Tap one of yours to put it back first.";
      return;
    }

    superChestInstruction.textContent = pickPrompt();
  } else if (superChestPhase === "swap") {
    if (duelSwapUsed) {
      superChestInstruction.textContent = "You've used your swap. Start the duel when you're ready.";
      return;
    }

    if (c.owner === "player") {
      duelSwapSelection = duelSwapSelection === c ? null : c;
      superChestInstruction.textContent = duelSwapSelection
        ? `Chest ${padCase(c.number)} selected. Now tap one of the Banker's chests to trade for it.`
        : swapPrompt();
    } else if (c.owner === "banker") {
      if (!duelSwapSelection) {
        superChestInstruction.textContent = "Tap one of your blue chests first.";
        return;
      }

      const mine = duelSwapSelection;
      mine.owner = "banker";
      c.owner = "player";
      duelSwapUsed = true;
      duelSwapSelection = null;

      addLog({
        type: "SUPER_CHEST_SWAP",
        round: 3,
        gave: mine.number,
        received: c.number,
      });

      superChestInstruction.textContent = `Swapped: Chest ${padCase(mine.number)} for Chest ${padCase(c.number)}. Nobody has seen inside either one.`;
    }
  }

  renderSuperChestCases();
  updateDuelControls();
}

function swapPrompt() {
  return "Chests locked in. Want to trade one blind? Tap one of yours, then one of the Banker's. Or just start.";
}

function pickForMe() {
  if (superChestPhase !== "pick" || superChestBusy) return;

  const open = shuffle(superChestCases.filter((c) => c.owner === null));
  while (countOwner("player") < SUPER_CHEST_PICKS && open.length) {
    open.pop().owner = "player";
  }

  superChestInstruction.textContent = pickPrompt();
  renderSuperChestCases();
  updateDuelControls();
}

function lockDuelPicks() {
  if (superChestPhase !== "pick" || countOwner("player") !== SUPER_CHEST_PICKS) {
    return;
  }

  superChestCases.forEach((c) => {
    if (c.owner === null) c.owner = "banker";
  });

  superChestPhase = "swap";

  addLog({
    type: "SUPER_CHEST_PICKS",
    round: 3,
    playerCaseNumbers: superChestCases.filter((c) => c.owner === "player").map((c) => c.number),
  });

  superChestInstruction.textContent = swapPrompt();
  renderSuperChestCases();
  updateDuelControls();
}

/* Pairs each of your chests with one of the Banker's, lowest stakes first. */
function buildDuelPairs() {
  const mine = superChestCases.filter((c) => c.owner === "player");
  const theirs = shuffle(superChestCases.filter((c) => c.owner === "banker"));

  return mine
    .map((c, i) => ({ player: c, banker: theirs[i] }))
    .sort((x, y) => x.player.value + x.banker.value - (y.player.value + y.banker.value));
}

function duelTauntFor(diff, step, total) {
  if (step === total) {
    return diff > 0 ? "It all comes down to this." : "Last chests. Don't blink.";
  }

  if (step === 1) return "Let's see what you picked.";
  if (diff === 0) return "All square.";

  const lead = Math.abs(diff);
  const big = lead > 300;

  if (diff > 0) {
    return big ? "Enjoy the lead. It won't last." : "A lucky streak. For now.";
  }

  return big ? "The Banker always collects." : "Behind already?";
}

function updateDuelBar() {
  const total = superChestPlayerTotal + superChestBankerTotal;
  const pct = total === 0 ? 50 : (superChestPlayerTotal / total) * 100;

  duelBar.classList.remove("hidden");
  duelBarFill.style.width = `${pct}%`;
}

async function startDuelReveal() {
  if (superChestPhase !== "swap" || superChestBusy) return;

  superChestBusy = true;
  superChestPhase = "reveal";
  duelSwapSelection = null;
  updateDuelControls();

  const pairs = buildDuelPairs();
  superChestPlayerCases = pairs.map((p) => p.player);
  superChestBankerCases = pairs.map((p) => p.banker);

  updateDuelBar();
  renderSuperChestCases();

  for (let i = 0; i < pairs.length; i++) {
    const { player: mine, banker: theirs } = pairs[i];
    const step = i + 1;

    superChestInstruction.textContent = `Round ${step} of ${pairs.length}`;
    duelTaunt.textContent = "";

    mine.duel = "active";
    theirs.duel = "active";
    renderSuperChestCases();

    /* Build the tension: slower as the stakes rise */
    await delay(step < 6 ? 600 : step < pairs.length ? 1000 : 1700);

    mine.revealed = true;
    theirs.revealed = true;
    mine.duel = mine.value > theirs.value ? "win" : "lose";
    theirs.duel = theirs.value > mine.value ? "win" : "lose";

    superChestPlayerTotal += mine.value;
    superChestBankerTotal += theirs.value;

    addLog({
      type: "SUPER_CHEST_DUEL_ROUND",
      round: 3,
      step,
      playerCase: { caseNumber: mine.number, value: mine.value },
      bankerCase: { caseNumber: theirs.number, value: theirs.value },
      playerTotal: superChestPlayerTotal,
      bankerTotal: superChestBankerTotal,
    });

    renderSuperChestCases();
    updateSuperChestScoreboard();
    updateDuelBar();

    duelTaunt.textContent = duelTauntFor(
      superChestPlayerTotal - superChestBankerTotal,
      step,
      pairs.length,
    );

    await delay(step < pairs.length ? 700 : 400);
  }

  await finishSuperChestAllocation();
}

async function finishSuperChestAllocation() {
  superChestPhase = "complete";
  superChestBusy = false;

  const playerWins = superChestPlayerTotal > superChestBankerTotal;
  const tie = superChestPlayerTotal === superChestBankerTotal;
  superChestBenefitAvailable = playerWins;

  addLog({
    type: "SUPER_CHEST_RESULT",
    round: 3,
    mode: "DUEL",
    turns: superChestPlayerCases.length,
    playerTotal: superChestPlayerTotal,
    bankerTotal: superChestBankerTotal,
    won: playerWins,
    tie,
    benefit: playerWins ? "+50% BANKER OFFER ONCE" : "NONE",
    playerCases: superChestPlayerCases.map((c) => ({ caseNumber: c.number, value: c.value })),
    bankerCases: superChestBankerCases.map((c) => ({ caseNumber: c.number, value: c.value })),
  });

  const totals = `You: ${formatMoney(superChestPlayerTotal)} &nbsp;|&nbsp; Banker: ${formatMoney(superChestBankerTotal)}`;

  superChestResultElement.classList.remove("hidden");
  superChestResultElement.innerHTML = playerWins
    ? `<strong>You win the Super Chest!</strong><br>${totals}<br><span>You've earned a one-time +50% Banker offer benefit.</span>`
    : tie
      ? `<strong>The Super Chest is a tie.</strong><br>${totals}<br><span>No benefit this time.</span>`
      : `<strong>The Banker wins the Super Chest.</strong><br>${totals}<br><span>No benefit this time.</span>`;

  superChestInstruction.textContent = playerWins ? "You beat the Banker." : "The Banker takes this one.";
  duelTaunt.textContent = playerWins ? "Well played." : "Better luck next time.";
  updateDuelControls();
  superChestContinueButton.classList.remove("hidden");
}

function updateSuperChestScoreboard() {
  const hidden = superChestPhase === "pick" || superChestPhase === "swap";

  superChestPlayerTotalElement.textContent = hidden ? "?" : formatMoney(superChestPlayerTotal);
  superChestBankerTotalElement.textContent = hidden ? "?" : formatMoney(superChestBankerTotal);
}

function finishSuperChest() {
  if (superChestPhase !== "complete") return;
  superChestElement.classList.add("hidden");
  superChestAvailable = false;
  waitingForDeal = false;
  addLog({
    type: "SUPER_CHEST_COMPLETE",
    round: 3,
    benefitAvailable: superChestBenefitAvailable,
    playerTotal: superChestPlayerTotal,
    bankerTotal: superChestBankerTotal,
    playerCaseNumbers: superChestPlayerCases.map((c) => c.number),
    bankerCaseNumbers: superChestBankerCases.map((c) => c.number),
  });
  round++;
  casesToOpen = ROUND_CASES[round - 1];
  openedCasesThisRound = 0;
  instruction.textContent = `OPEN ${casesToOpen} CASE${casesToOpen === 1 ? "" : "S"}`;
  message.textContent = superChestBenefitAvailable
    ? "SUPER CHEST WON! YOUR +50% BENEFIT CAN BE USED ON ANY FUTURE BANKER OFFER ONCE."
    : "SUPER CHEST COMPLETE. NO BENEFIT THIS TIME.";
  updateGameInfo();
}

/*
 * Super Chest result is shown after all cases have been allocated.
 * A tied total awards no benefit.
 */
function unusedSuperChestCompatibilityMarker() {
  return;
}

function useSuperChestBenefit() {
  if (!superChestBenefitAvailable || superChestBenefitUsed || gameOver) return;
  const currentOffer = Number(bankerOffer.textContent.replace(/[$,]/g, ""));
  if (!currentOffer || currentOffer <= 0) return;

  /*
      The boosted offer can never exceed the biggest prize
      still in play (unopened cases, including the player's).
  */

  const topPrizeInPlay = getTopPrizeInPlay();
  const uncappedOffer = smartRoundOffer(currentOffer * 1.5);
  const boostedOffer = Math.min(uncappedOffer, topPrizeInPlay);
  const wasCapped = uncappedOffer > topPrizeInPlay;

  /*
      An offer already at the top prize cannot be improved,
      so keep the benefit instead of wasting it.
  */

  if (boostedOffer <= currentOffer) {
    message.textContent =
      "THIS OFFER IS ALREADY AT THE TOP PRIZE LEFT. YOUR BONUS IS SAVED FOR LATER.";
    return;
  }

  superChestBenefitUsed = true;
  superChestBenefitAvailable = false;
  bankerOffer.textContent = formatMoney(boostedOffer);
  offerHistory[offerHistory.length - 1] = boostedOffer;
  renderOfferLadder(boostedOffer);
  superChestBenefitButton.classList.add("hidden");
  addLog({
    type: "SUPER_CHEST_BENEFIT_USED",
    round,
    originalOffer: currentOffer,
    boostedOffer,
    multiplier: 1.5,
    cappedAtTopPrize: wasCapped,
    topPrizeInPlay,
  });
  instruction.textContent = "SUPER CHEST BENEFIT ACTIVATED";
  message.textContent = wasCapped
    ? `THE BANKER'S OFFER HAS BEEN RAISED TO ${formatMoney(boostedOffer)}, THE TOP PRIZE STILL IN PLAY.`
    : `THE BANKER'S OFFER HAS BEEN INCREASED BY 50%: ${formatMoney(boostedOffer)}.`;
}

/* =========================================================
   BANKER OFFER CALCULATION
========================================================= */

function calculateBankerOffer() {
  const remainingCases = cases.filter((gameCase) => !gameCase.opened);

  const remainingValues = remainingCases.map((gameCase) => gameCase.value);

  if (remainingValues.length === 0) {
    return playerCaseValue;
  }

  /*
        Expected value.
    */

  const totalValue = remainingValues.reduce((sum, value) => sum + value, 0);

  const expectedValue = totalValue / remainingValues.length;

  /*
        Highest prize.
    */

  const highestPrize = Math.max(...remainingValues);

  /*
        Number of remaining cases.
    */

  const casesRemaining = remainingValues.length;

  /*
        Round factor.
    */

  let roundFactor;

  switch (round) {
    case 1:
      roundFactor = 0.3;
      break;

    case 2:
      roundFactor = 0.4;
      break;

    case 3:
      roundFactor = 0.5;
      break;

    case 4:
      roundFactor = 0.6;
      break;

    case 5:
      roundFactor = 0.7;
      break;

    case 6:
      roundFactor = 0.76;
      break;

    case 7:
      roundFactor = 0.8;
      break;

    case 8:
      roundFactor = 0.84;
      break;

    case 9:
      roundFactor = 0.9;
      break;

    default:
      roundFactor = 0.9;
  }

  /*
        Risk factor.
    */

  const topPrizeRatio = highestPrize / expectedValue;

  let riskFactor;

  if (topPrizeRatio >= 10) {
    riskFactor = 0.85;
  } else if (topPrizeRatio >= 7) {
    riskFactor = 0.9;
  } else if (topPrizeRatio >= 5) {
    riskFactor = 0.95;
  } else if (topPrizeRatio >= 3) {
    riskFactor = 1.0;
  } else {
    riskFactor = 1.05;
  }

  /*
        Case count factor.
    */

  let caseFactor;

  if (casesRemaining > 15) {
    caseFactor = 0.9;
  } else if (casesRemaining > 10) {
    caseFactor = 0.95;
  } else if (casesRemaining > 5) {
    caseFactor = 1.0;
  } else {
    caseFactor = 1.05;
  }

  /*
        Calculate base offer.
    */

  let offer = expectedValue * roundFactor * riskFactor * caseFactor;

  /*
        Random variation.
    */

  const randomFactor = 0.95 + Math.random() * 0.1;

  offer *= randomFactor;

  /*
        Minimum offer.
    */

  const minimumOffer = expectedValue * 0.15;

  offer = Math.max(offer, minimumOffer);

  /*
        Never exceed expected value.
    */

  offer = Math.min(offer, expectedValue);

  /*
        Round amount.
    */

  offer = smartRoundOffer(offer);

  return offer;
}

/* =========================================================
   DEAL
========================================================= */

dealButton.addEventListener("click", takeDeal);

function takeDeal() {
  const offer = Number(bankerOffer.textContent.replace(/[$,]/g, ""));

  /*
        Record Deal.
    */

  addLog({
    type: "DEAL",

    round: round,

    amount: offer,
  });

  gameOver = true;

  waitingForDeal = false;

  hideBankerUi();

  instruction.textContent = "DEAL!";

  message.textContent = `YOU ACCEPTED ` + `${formatMoney(offer)}!`;

  revealPlayerCase();

  /*
        Record final result.
    */

  addLog({
    type: "GAME_END",

    reason: "DEAL",

    winnings: offer,

    playerCase: playerCase,

    playerCaseValue: playerCaseValue,
  });

  showGameLogButton();

  newGameButton.classList.remove("hidden");

  showResult();
}

/* =========================================================
   NO DEAL
========================================================= */

noDealButton.addEventListener("click", continueGame);

function continueGame(isAutomaticNoDeal = false) {
  /*
      Record No Deal.
  */

  addLog({
    type: "NO_DEAL",
    round: round,
    automatic: isAutomaticNoDeal,
  });

  /*
      Show the appropriate message immediately.
  */

  if (isAutomaticNoDeal) {
    message.textContent = "NO DEAL! THE GAME CONTINUES.";
  } else {
    message.textContent = "NO DEAL! THE GAME CONTINUES.";
  }

  /*
      Reset Banker / Counter UI.
  */

  waitingForDeal = false;

  hideBankerUi();

  bankerWaiting.classList.add("hidden");

  bankerOfferContent.classList.add("hidden");

  /*
      Reset cases opened for the upcoming round.
  */

  openedCasesThisRound = 0;

  if (round === 3 && !gameOver) {
    startSuperChest();
    return;
  }
  /*
      Move to next round.
  */

  round++;

  /*
      Final stage.
  */

  if (round > ROUND_CASES.length) {
    startFinalStage();

    return;
  }

  /*
      Set cases to open.
  */

  casesToOpen = ROUND_CASES[round - 1];

  instruction.textContent =
    `OPEN ${casesToOpen} CASE` + `${casesToOpen === 1 ? "" : "S"}`;

  updateGameInfo();
}

/* =========================================================
   FINAL STAGE
========================================================= */

function startFinalStage() {
  const unopenedCases = cases.filter((gameCase) => !gameCase.opened);

  /*
        There should be exactly
        two cases remaining.
    */

  if (unopenedCases.length !== 2) {
    revealFinalResult();

    return;
  }

  instruction.textContent = "ONLY TWO CASES REMAIN";

  message.textContent =
    "YOU REJECTED THE FINAL OFFER. " + "NOW CHOOSE WHETHER TO KEEP OR SWAP.";

  showFinalChoice();
}

/* =========================================================
   FINAL CHOICE
========================================================= */

function showFinalChoice() {
  finalChoice.classList.remove("hidden");
}

/* =========================================================
   KEEP
========================================================= */

keepButton.addEventListener("click", () => {
  completeFinalChoice(false);
});

/* =========================================================
   SWAP
========================================================= */

swapButton.addEventListener("click", () => {
  completeFinalChoice(true);
});

/* =========================================================
   COMPLETE FINAL CHOICE
========================================================= */

function completeFinalChoice(shouldSwap) {
  /*
        Record decision.
    */

  addLog({
    type: "FINAL_DECISION",

    decision: shouldSwap ? "SWAP" : "KEEP",

    originalCase: originalPlayerCase,

    currentCase: playerCase,
  });

  finalChoice.classList.add("hidden");

  /*
        Swap to the other remaining case.
    */

  if (shouldSwap) {
    const otherCase = cases.find(
      (gameCase) => !gameCase.opened && gameCase.number !== playerCase,
    );

    if (otherCase) {
      const oldPlayerCase = cases.find(
        (gameCase) => gameCase.number === playerCase,
      );

      if (oldPlayerCase) {
        oldPlayerCase.isPlayerCase = false;
      }

      otherCase.isPlayerCase = true;

      playerCase = otherCase.number;

      playerCaseValue = otherCase.value;
    }
  }

  revealFinalResult();
}

/* =========================================================
   FINAL REVEAL
========================================================= */

function revealFinalResult() {
  gameOver = true;

  waitingForDeal = false;

  const finalCase = cases.find((gameCase) => gameCase.number === playerCase);

  if (!finalCase) {
    return;
  }

  instruction.textContent = "YOUR FINAL CASE";

  playerCaseElement.textContent = formatMoney(finalCase.value);

  message.textContent = `YOU WON ` + `${formatMoney(finalCase.value)}!`;

  renderCases();

  /*
        Record final result.
    */

  addLog({
    type: "GAME_END",

    reason: "FINAL_CASE",

    winnings: finalCase.value,

    originalCase: originalPlayerCase,

    finalCase: playerCase,

    finalCaseValue: finalCase.value,
  });

  showGameLogButton();

  newGameButton.classList.remove("hidden");

  showResult();
}

/* =========================================================
   REVEAL PLAYER CASE
========================================================= */

function revealPlayerCase() {
  playerCaseElement.textContent = formatMoney(playerCaseValue);
}

/* =========================================================
   GAME LOGGING
========================================================= */

function addLog(event) {
  gameLog.push({
    timestamp: new Date(),

    ...event,
  });
}

/* =========================================================
   FORMAT DATE/TIME
========================================================= */

function formatDateTime(date) {
  return date.toLocaleString("en-SG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* =========================================================
   GENERATE GAME LOG TEXT
========================================================= */

function generateGameLog() {
  let output = "";

  output += "========================================\n";

  output += "       DEAL OR NO DEAL - GAME LOG\n";

  output += "========================================\n\n";

  /*
        GAME INFORMATION
    */

  const gameStart = gameLog.find((event) => event.type === "GAME_START");

  output += `Game Date: ${gameStart ? gameStart.date : "Unknown"}\n`;

  output += `Case Values: ${gameStart && gameStart.prizeSet ? gameStart.prizeSet : "Standard"}\n`;

  output += `Top Prize Cases: ${gameStart ? gameStart.topPrizeCount || 1 : "Unknown"}\n`;

  output += `Maximum Prize: ${
    gameStart ? formatMoney(gameStart.maximumPrize) : "Unknown"
  }\n`;

  /*
        PLAYER CASE
    */

  const playerSelection = gameLog.find(
    (event) => event.type === "PLAYER_CASE_SELECTED",
  );

  if (playerSelection) {
    output += `Player's Original Case: Case #${playerSelection.caseNumber}\n`;
    output += `Player's Original Case Amount: ${formatMoney(playerSelection.value)}\n`;
  }

  output += "\n";

  /*
        PRIZE BOARD
    */

  output += "----------------------------------------\n";

  output += "PRIZE BOARD\n";

  output += "----------------------------------------\n";

  if (gameStart && gameStart.prizeBoard) {
    gameStart.prizeBoard.forEach((value) => {
      output += `${formatMoney(value)}\n`;
    });
  }

  output += "\n";

  /*
        GROUP EVENTS BY ROUND
    */

  const roundEvents = {};

  gameLog.forEach((event) => {
    if (!event.round) {
      return;
    }

    if (!roundEvents[event.round]) {
      roundEvents[event.round] = [];
    }

    roundEvents[event.round].push(event);
  });

  /*
        OUTPUT ROUNDS
    */

  Object.keys(roundEvents)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((roundNumber) => {
      output += "========================================\n";

      output += `ROUND ${roundNumber}\n`;

      output += "========================================\n\n";

      const events = roundEvents[roundNumber];

      /*
                Cases opened
            */

      const opened = events.filter((event) => event.type === "CASE_OPENED");

      if (opened.length > 0) {
        output += "Cases Opened:\n";

        opened.forEach((event) => {
          output += `Case #${event.caseNumber} → ${formatMoney(event.value)}\n`;
        });

        output += "\n";
      }

      const offer = events.find((event) => event.type === "BANKER_OFFER");

      if (offer) {
        output += `Banker's Offer: ${formatMoney(offer.offer)}\n`;

        if (offer.unopenedCases && offer.unopenedCases.length > 0) {
          output += "\nUnopened Cases and Amounts:\n";

          offer.unopenedCases.forEach((gameCase) => {
            const playerLabel = gameCase.isPlayerCase ? " (PLAYER'S CASE)" : "";

            output +=
              `Case #${gameCase.caseNumber} → ` +
              `${formatMoney(gameCase.value)}${playerLabel}\n`;
          });
        }
      }

      const bankerHint = events.find((event) => event.type === "BANKER_HINT");

      if (bankerHint) {
        output += `\nBanker's Hint: ${bankerHint.side} SIDE OF THE BOARD\n`;
      }

      /*
                Normal Deal
            */

      const deal = events.find((event) => event.type === "DEAL");

      if (deal) {
        output += `Decision: DEAL\n`;

        output += `Amount Accepted: ${formatMoney(deal.amount)}\n`;
      }

      /*
                No Deal
            */

      const noDeal = events.find((event) => event.type === "NO_DEAL");

      if (noDeal) {
        output += "Decision: NO DEAL\n";
      }

      output += "\n";
    });

  /*
        FINAL RESULT
    */

  output += "========================================\n";

  output += "FINAL RESULT\n";

  output += "========================================\n\n";

  const finalDecision = gameLog.find(
    (event) => event.type === "FINAL_DECISION",
  );

  if (finalDecision) {
    output += `Final Decision: ${finalDecision.decision}\n`;

    output += `Original Case: #${finalDecision.originalCase}\n`;
  }

  const gameEndEvents = gameLog.filter((event) => event.type === "GAME_END");

  const finalGameEnd = gameEndEvents[gameEndEvents.length - 1];

  if (finalGameEnd) {
    if (finalGameEnd.originalCase) {
      output += `Original Case: #${finalGameEnd.originalCase}\n`;
    }

    if (finalGameEnd.finalCase) {
      output += `Final Case: #${finalGameEnd.finalCase}\n`;
    }

    if (finalGameEnd.playerCase) {
      output += `Player's Case: #${finalGameEnd.playerCase}\n`;
    }

    if (finalGameEnd.reason === "DEAL") {
      output += `Result: DEAL\n`;
    } else if (finalGameEnd.reason === "TOP_PRIZE_GUARANTEED") {
      output += `Result: TOP PRIZE (ALL REMAINING CASES HELD THE TOP PRIZE)\n`;
    } else {
      output += `Result: FINAL CASE\n`;
    }

    output += `Winnings: ${formatMoney(finalGameEnd.winnings)}\n`;
  }

  output += "\n";

  output += "========================================\n";

  output += "              END OF GAME\n";

  output += "========================================\n";

  return output;
}

/* =========================================================
   DOWNLOAD GAME LOG
========================================================= */

function downloadGameLog() {
  const logText = generateGameLog();

  const blob = new Blob([logText], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  const now = new Date();

  const date = now.toISOString().slice(0, 10);

  const time = now.toTimeString().slice(0, 8).replace(/:/g, "-");

  link.href = url;

  link.download = `DealOrNoDeal_GameLog_${date}_${time}.txt`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/* =========================================================
   GAME LOG BUTTON
========================================================= */

function showGameLogButton() {
  let logButton = document.getElementById("downloadLogButton");

  /*
        If button doesn't exist yet,
        create it automatically.

        This means you don't have to
        modify HTML if you don't want to.
    */

  if (!logButton) {
    logButton = document.createElement("button");

    logButton.id = "downloadLogButton";

    logButton.textContent = "DOWNLOAD GAME LOG";

    logButton.className = "download-log-button";

    logButton.addEventListener("click", downloadGameLog);

    /*
            Put it next to the New Game button.
        */

    if (newGameButton && newGameButton.parentElement) {
      newGameButton.parentElement.appendChild(logButton);
    } else {
      document.body.appendChild(logButton);
    }
  }

  logButton.classList.remove("hidden");
}

/* =========================================================
   DELAY
========================================================= */

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/* =========================================================
   NEW GAME
========================================================= */

newGameButton.addEventListener("click", () => {
  gameScreen.classList.add("hidden");

  setupScreen.classList.remove("hidden");
});


/* =========================================================
   REDESIGN ADDITIONS
========================================================= */

let offerHistory = [];

/* Prize tier by share of the top prize: drives colour on board + cases */
function getTier(value) {
  const share = value / maxPrize;
  if (share <= 0.1) return "low";
  if (share <= 0.4) return "mid";
  return "high";
}

/* Short money for small case faces: $100K, $1.5M */
function formatCompact(value) {
  if (value < 1000) return formatMoney(value);
  return (
    "$" +
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)
  );
}

/* Prizes still hidden = board minus opened cases (never reads your own case) */
function refreshHud() {
  const remaining = [...prizes];
  cases.forEach((c) => {
    if (!c.opened) return;
    const idx = remaining.indexOf(c.value);
    if (idx !== -1) remaining.splice(idx, 1);
  });

  if (remaining.length) {
    topPrizeElement.textContent = formatMoney(Math.max(...remaining));
    prizesLeftElement.textContent = remaining.length;
  }

  openPips.innerHTML = "";
  if (playerCase !== null && !gameOver && casesToOpen > 0) {
    for (let i = 0; i < casesToOpen; i++) {
      const pip = document.createElement("b");
      if (i < openedCasesThisRound) pip.className = "done";
      openPips.appendChild(pip);
    }
  }
}

function renderOfferHistory() {
  const earlier = offerHistory.slice(0, -1);
  offerHistoryElement.innerHTML = earlier.length
    ? '<div class="label">Earlier offers</div>' +
      earlier
        .map((o, i) => `<div class="row"><span>Round ${i + 1}</span><strong>${formatMoney(o)}</strong></div>`)
        .join("")
    : "";
}

/* =========================================================
   NEON STUDIO: BANKER BAR + OFFER LADDER
========================================================= */

/* Hides the offer bar and restores the normal top bar */
function hideBankerUi() {
  bankerSection.classList.add("hidden");
  document.body.classList.remove("banker-active");
}

/* Prizes still in play, highest first, with the offer slotted into its place */
function renderOfferLadder(offer) {
  const ladder = document.getElementById("offerLadder");
  if (!ladder) return;

  const remaining = [...prizes];
  cases.forEach((c) => {
    if (!c.opened) return;
    const idx = remaining.indexOf(c.value);
    if (idx !== -1) remaining.splice(idx, 1);
  });
  remaining.sort((a, b) => b - a);

  const row = (v) =>
    `<div class="ladder-row" data-tier="${getTier(v)}"><span class="money-symbol">$</span><span>${formatMoney(v).replace("$", "")}</span></div>`;
  const offerRow =
    `<div class="ladder-offer"><small>Current offer</small><div><span>$</span><span>${formatMoney(offer).replace("$", "")}</span></div></div>`;

  let html = '<div class="ladder-title">Still in play</div>';
  let placed = false;

  remaining.forEach((v) => {
    if (!placed && v < offer) {
      html += offerRow;
      placed = true;
    }
    html += row(v);
  });

  if (!placed) html += offerRow;

  ladder.innerHTML = html;
}

function focusBanker() {
  const panel = document.getElementById("dealButton");
  if (panel) panel.focus({ preventScroll: true });
}

/* Biggest prize in any unopened case (the player's case included) */
function getTopPrizeInPlay() {
  return Math.max(
    ...cases.filter((c) => !c.opened).map((c) => c.value),
  );
}

/* True once every unopened case, including the player's, holds the top prize */
function onlyTopPrizesRemain() {
  const unopened = cases.filter((c) => !c.opened);

  return (
    unopened.length > 0 && unopened.every((c) => c.value === maxPrize)
  );
}

/* Ends the game immediately: the player is guaranteed the top prize */
function declareTopPrizeWin() {
  gameOver = true;
  waitingForDeal = false;

  hideBankerUi();
  finalChoice.classList.add("hidden");

  playerCaseValue = maxPrize;
  revealPlayerCase();

  instruction.textContent = "TOP PRIZE WINNER!";
  message.textContent = `EVERY CASE LEFT HOLDS ${formatMoney(maxPrize)}.`;

  addLog({
    type: "GAME_END",
    reason: "TOP_PRIZE_GUARANTEED",
    round: round,
    winnings: maxPrize,
    playerCase: playerCase,
    playerCaseValue: maxPrize,
  });

  showGameLogButton();
  newGameButton.classList.remove("hidden");
  showResult();
}

function showResult() {
  const end = [...gameLog].reverse().find((e) => e.type === "GAME_END");
  if (!end) return;

  gameOver = true;
  renderCases();
  refreshHud();
  closePrizes();

  if (end.reason === "DEAL") {
    const held = playerCaseValue;
    const diff = held - end.winnings;
    resultTitle.textContent = `You took ${formatMoney(end.winnings)}`;
    resultDetail.textContent =
      diff > 0
        ? `Your case held ${formatMoney(held)}. The Banker came out ${formatMoney(diff)} ahead.`
        : diff < 0
          ? `Your case held ${formatMoney(held)}. You beat it by ${formatMoney(-diff)}.`
          : `Your case held exactly ${formatMoney(held)}.`;
  } else if (end.reason === "TOP_PRIZE_GUARANTEED") {
    resultTitle.textContent = `Top prize: ${formatMoney(end.winnings)}`;
    resultDetail.textContent =
      "You opened every case that held a smaller prize. Every case left holds the top prize, so you win it.";
  } else {
    const other = cases.find((c) => !c.opened && c.number !== playerCase);
    resultTitle.textContent = `You won ${formatMoney(end.winnings)}`;
    resultDetail.textContent = other
      ? `The other case held ${formatMoney(other.value)}.`
      : "";
  }

  resultPanel.classList.remove("hidden");
}

function resetUiExtras() {
  offerHistory = [];
  offerHistoryElement.innerHTML = "";
  openPips.innerHTML = "";
  resultPanel.classList.add("hidden");
  closePrizes();
}

/* Prize board sheet (mobile) */
function openPrizes() {
  document.body.classList.add("prizes-open");
  prizeToggle.setAttribute("aria-expanded", "true");
}
function closePrizes() {
  document.body.classList.remove("prizes-open");
  prizeToggle.setAttribute("aria-expanded", "false");
}
prizeToggle.addEventListener("click", openPrizes);
prizeClose.addEventListener("click", closePrizes);
prizeBackdrop.addEventListener("click", closePrizes);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePrizes();
});

/* Setup presets + Enter to start */
document.querySelectorAll(".presets button").forEach((b) =>
  b.addEventListener("click", () => {
    maxPrizeInput.value = b.dataset.amount;
    setupError.textContent = "";
  }),
);
maxPrizeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startGame();
});


/* =========================================================
   CASE VALUE DROPDOWN (MAIN MENU)
========================================================= */

/*
    Accepts one value per line, or values separated by
    commas, spaces or semicolons. "$" and thousands
    separators ("10,000") are understood.
*/

function tokenizeCustomPrizes(text) {
  const tokens = [];

  text
    .split(/[\s;]+/)
    .filter(Boolean)
    .forEach((chunk) => {
      const clean = chunk.replace(/\$/g, "");

      if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
        tokens.push(clean.replace(/,/g, ""));
      } else {
        clean.split(",").filter(Boolean).forEach((t) => tokens.push(t));
      }
    });

  return tokens;
}

function parseCustomPrizes(text) {
  const tokens = tokenizeCustomPrizes(text);

  const values = tokens.map(Number);

  if (tokens.some((t, i) => !Number.isFinite(values[i]))) {
    const bad = tokens.find((t, i) => !Number.isFinite(values[i]));
    return { error: `"${bad}" is not a number. Use digits only, like 2500 or 0.5.` };
  }

  if (values.some((v) => v <= 0)) {
    return { error: "Every case value must be greater than 0." };
  }

  if (values.some((v) => v > 1e12)) {
    return { error: "Case values must be below $1,000,000,000,000." };
  }

  if (values.length !== TOTAL_CASES) {
    return {
      error: `Enter exactly ${TOTAL_CASES} values. You have ${values.length}.`,
    };
  }

  return { values: values.map((v) => Math.round(v * 100) / 100) };
}

function updateCustomCount() {
  const n = tokenizeCustomPrizes(customValuesInput.value).length;

  customCountElement.textContent = `${n} of ${TOTAL_CASES}`;
  customValuesInput.classList.remove("invalid");
}

function applyPrizeSetChoice() {
  const key = prizeSetSelect.value;
  const isCustom = key === "custom";

  prizeSetNote.textContent = PRIZE_SETS[key].note;
  topPrizeField.classList.toggle("hidden", isCustom);
  customField.classList.toggle("hidden", !isCustom);
  setupError.textContent = "";

  /* First time on Custom: start from the standard list so it is easy to edit */
  if (isCustom && !customValuesInput.value.trim()) {
    const top = Number(maxPrizeInput.value) || 100000;
    const mult = top / PRIZE_SETS.standard.ref;
    customValuesInput.value = PRIZE_SETS.standard.base
      .map((v) => smartRound(v * mult))
      .join("\n");
  }

  updateCustomCount();
}

prizeSetSelect.addEventListener("change", applyPrizeSetChoice);
customValuesInput.addEventListener("input", updateCustomCount);
applyPrizeSetChoice();
