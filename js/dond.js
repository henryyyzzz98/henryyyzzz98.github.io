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
  100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12000,
  14000, 16000, 18000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000,
  75000, 100000,
];

/* =========================================================
   GAME SETTINGS
========================================================= */

const TOTAL_CASES = 26;

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

const ROUND_CASES = [1, 1, 1, 3, 2, 1, 1, 1, 1];

/* =========================================================
   GAME STATE
========================================================= */

let maxPrize = 100000;

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
const buyoutOfferContent = document.getElementById("buyoutOfferContent");
const buyoutOffer = document.getElementById("buyoutOffer");
const buyoutButton = document.getElementById("buyoutButton");
const rejectBuyoutButton = document.getElementById("rejectBuyoutButton");

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

/* =========================================================
   START GAME
========================================================= */

startButton.addEventListener("click", startGame);

function startGame() {
  maxPrize = Number(maxPrizeInput.value);

  if (!maxPrize || maxPrize <= 0) {
    alert("Please enter a valid maximum prize.");

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

  bankerSection.classList.add("hidden");

  bankerWaiting.classList.remove("hidden");

  bankerOfferContent.classList.add("hidden");

  if (buyoutOfferContent) {
    buyoutOfferContent.classList.add("hidden");
  }

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
  const multiplier = maximumPrize / 100000;

  let generated = BASE_PRIZES.map((value) => {
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

    button.className = "case";

    button.dataset.caseNumber = gameCase.number;

    /*
                Player's case.
            */

    if (gameCase.isPlayerCase) {
      button.classList.add("player-selected");
    }

    /*
                Opened case.
            */

    if (gameCase.opened) {
      button.classList.add("disabled", "revealed");

      button.textContent = formatMoney(gameCase.value);
    } else {
      button.textContent = String(gameCase.number).padStart(2, "0");
    }

    /*
                Only unopened cases
                can be selected.
            */

    if (!gameCase.opened && !gameOver) {
      button.addEventListener("click", () => {
        handleCaseClick(gameCase);
      });
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

  await delay(1800);

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

  caseButton.textContent = formatMoney(gameCase.value);

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
  const matchingElements = document.querySelectorAll(
    `.money-value[data-value="${value}"]`,
  );

  matchingElements.forEach((element) => {
    element.classList.add("eliminated");
  });
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
    if (!gameCase.opened) {
      return;
    }

    const matchingElements = document.querySelectorAll(
      `.money-value[data-value="${gameCase.value}"]`,
    );

    matchingElements.forEach((element) => {
      element.classList.add("eliminated");
    });
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

  return playerPrizeIndex < half ? "LEFT" : "RIGHT";
}

/* =========================================================
   SHOW BANKER
========================================================= */

async function showBanker() {
  waitingForDeal = true;

  const offer = calculateBankerOffer();
  const shouldShowBuyout = isBuyoutTriggered();

  const unopenedCases = cases
    .filter((gameCase) => !gameCase.opened)
    .map((gameCase) => ({
      caseNumber: gameCase.number,
      value: gameCase.value,
      isPlayerCase: gameCase.isPlayerCase,
    }));

  /*
        A Buyout replaces the normal Banker offer when
        only one prize remains on the RIGHT side of the board.
    */
  if (shouldShowBuyout) {
    const buyout = calculateBankerBuyout(offer);

    buyoutOffer.textContent = formatMoney(buyout);

    addLog({
      type: "BUYOUT_OFFER",
      round: round,
      offer: buyout,
      normalBankerOffer: offer,
      unopenedCases: unopenedCases,
    });
  } else {
    bankerOffer.textContent = formatMoney(offer);

    addLog({
      type: "BANKER_OFFER",
      round: round,
      offer: offer,
      unopenedCases: unopenedCases,
    });
  }

  bankerSection.classList.remove("hidden");
  bankerWaiting.classList.remove("hidden");
  bankerOfferContent.classList.add("hidden");
  buyoutOfferContent.classList.add("hidden");

  instruction.textContent = "THE BANKER IS CALLING...";
  message.textContent = shouldShowBuyout
    ? "THE BANKER HAS A SPECIAL OFFER FOR YOU."
    : "PLEASE WAIT FOR THE BANKER'S OFFER.";

  await delay(1800);

  bankerWaiting.classList.add("hidden");

  if (shouldShowBuyout) {
    buyoutOfferContent.classList.remove("hidden");
    instruction.textContent = "THE BANKER HAS A SPECIAL OFFER";
    message.textContent = "THE BANKER WANTS TO BUY YOU OUT.";
    return;
  }

  bankerOfferContent.classList.remove("hidden");

  if (superChestBenefitAvailable && !superChestBenefitUsed) {
    superChestBenefitButton.classList.remove("hidden");
  } else {
    superChestBenefitButton.classList.add("hidden");
  }

  hideLegacyCounterOfferUI();

  instruction.textContent = "THE BANKER HAS MADE AN OFFER";

  const bankerHint = getBankerHint();

  if (round === 3 && bankerHint) {
    bankerHintElement.textContent = `💡 BANKER'S HINT: YOUR CASE IS ON THE ${bankerHint} SIDE OF THE BOARD.`;

    bankerHintElement.classList.remove("hidden");

    addLog({
      type: "BANKER_HINT",
      round: round,
      side: bankerHint,
    });
  } else {
    bankerHintElement.classList.add("hidden");
  }

  message.textContent = "DEAL OR NO DEAL?";
}

/* =========================================================
   SUPER CHEST
========================================================= */

superChestBenefitButton.addEventListener("click", useSuperChestBenefit);
superChestContinueButton.addEventListener("click", finishSuperChest);

function startSuperChest() {
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
  superChestPhase = "select";

  /*const values = [
    100, 100, 100, 100, 200, 200, 200, 200, 300, 300, 300, 300, 400, 400, 400,
    400, 500, 500, 500, 500,
  ];*/
  const values = [
    5, 5, 5, 5, 5, 5, 5, 5, 10, 10, 10, 10, 10, 10, 50, 50, 50, 50, 100, 100,
  ];
  if (values.length !== SUPER_CHEST_CASE_COUNT)
    throw new Error("Super Chest must contain exactly 20 cases.");
  shuffle(values);
  superChestCases = values.map((value, index) => ({
    number: index + 1,
    value,
    status: "available",
    owner: null,
  }));

  waitingForDeal = true;
  bankerSection.classList.add("hidden");
  finalChoice.classList.add("hidden");
  superChestElement.classList.remove("hidden");
  superChestInstruction.textContent =
    "Choose one case to reveal. Then KEEP it or THROW it to the Banker.";
  superChestResultElement.classList.add("hidden");
  superChestContinueButton.classList.add("hidden");
  updateSuperChestScoreboard();
  renderSuperChestCases();
  instruction.textContent = "SUPER CHEST";
  message.textContent =
    "WIN THE SUPER CHEST TO EARN A ONE-TIME +50% BANKER OFFER BENEFIT.";
  addLog({
    type: "SUPER_CHEST_START",
    round: 3,
    caseCount: superChestCases.length,
    values: superChestCases.map(({ number, value }) => ({
      caseNumber: number,
      value,
    })),
  });
}

function renderSuperChestCases() {
  superChestCasesElement.innerHTML = "";
  superChestCases.forEach((miniCase) => {
    const button = document.createElement("button");
    button.className = "super-chest-case";
    button.textContent =
      miniCase.status === "available"
        ? String(miniCase.number).padStart(2, "0")
        : formatMoney(miniCase.value);
    button.dataset.miniCaseNumber = miniCase.number;
    if (miniCase.owner === "player") button.classList.add("selected");
    if (miniCase.status !== "available") button.classList.add("revealed");
    button.disabled =
      miniCase.status !== "available" ||
      superChestPhase !== "select" ||
      superChestBusy;
    if (!button.disabled)
      button.addEventListener("click", () => selectSuperChestCase(miniCase));
    superChestCasesElement.appendChild(button);
  });
}

async function selectSuperChestCase(miniCase) {
  if (
    superChestPhase !== "select" ||
    superChestBusy ||
    miniCase.status !== "available"
  )
    return;
  superChestBusy = true;
  superChestPhase = "decision";
  superChestPendingCase = miniCase;
  miniCase.status = "pending";
  miniCase.owner = "pending";
  superChestTurn++;
  addLog({
    type: "SUPER_CHEST_CASE_REVEALED",
    round: 3,
    turn: superChestTurn,
    caseNumber: miniCase.number,
    value: miniCase.value,
  });
  renderSuperChestCases();
  const button = superChestCasesElement.querySelector(
    `.super-chest-case[data-mini-case-number="${miniCase.number}"]`,
  );
  if (button) button.classList.add("banker-reveal");
  await delay(350);
  if (button) button.classList.add("revealed");
  superChestInstruction.textContent = `Case ${String(miniCase.number).padStart(2, "0")} contains ${formatMoney(miniCase.value)}. Choose KEEP or THROW TO BANKER.`;
  renderSuperChestDecisionButtons();
  superChestBusy = false;
}

function renderSuperChestDecisionButtons() {
  document.getElementById("superChestDecision")?.remove();
  const choices = document.createElement("div");
  choices.id = "superChestDecision";
  choices.className = "super-chest-decision";
  const keep = document.createElement("button");
  keep.type = "button";
  keep.textContent = "KEEP";
  keep.addEventListener("click", () => resolveSuperChestChoice("keep"));
  const throwCase = document.createElement("button");
  throwCase.type = "button";
  throwCase.textContent = "THROW TO BANKER";
  throwCase.disabled = !superChestCases.some(
    (item) => item.status === "available",
  );
  throwCase.title = throwCase.disabled
    ? "No unpicked cases remain for a replacement."
    : "Give this case to the Banker and receive a random unpicked case.";
  throwCase.addEventListener("click", () => resolveSuperChestChoice("throw"));
  choices.append(keep, throwCase);
  superChestCasesElement.after(choices);
}

async function resolveSuperChestChoice(choice) {
  if (
    superChestPhase !== "decision" ||
    superChestBusy ||
    !superChestPendingCase
  )
    return;
  const selectedCase = superChestPendingCase;
  if (
    choice === "throw" &&
    !superChestCases.some((item) => item.status === "available")
  )
    return;
  superChestBusy = true;
  document.getElementById("superChestDecision")?.remove();
  selectedCase.status = "allocated";
  selectedCase.owner = choice === "keep" ? "player" : "banker";
  if (choice === "keep") {
    superChestPlayerCases.push(selectedCase);
    superChestPlayerTotal += selectedCase.value;
    addLog({
      type: "SUPER_CHEST_KEEP",
      round: 3,
      turn: superChestTurn,
      caseNumber: selectedCase.number,
      value: selectedCase.value,
      owner: "player",
    });
    superChestInstruction.textContent = `${formatMoney(selectedCase.value)} stays on your side.`;
  } else {
    superChestBankerCases.push(selectedCase);
    superChestBankerTotal += selectedCase.value;
    const available = superChestCases.filter(
      (item) => item.status === "available",
    );
    const replacement = available[Math.floor(Math.random() * available.length)];
    replacement.status = "allocated";
    replacement.owner = "player";
    superChestPlayerCases.push(replacement);
    superChestPlayerTotal += replacement.value;
    addLog({
      type: "SUPER_CHEST_THROW_AND_REPLACE",
      round: 3,
      turn: superChestTurn,
      thrownCase: {
        caseNumber: selectedCase.number,
        value: selectedCase.value,
      },
      replacementCase: {
        caseNumber: replacement.number,
        value: replacement.value,
      },
      bankerTotal: superChestBankerTotal,
      playerTotal: superChestPlayerTotal,
    });
    superChestInstruction.textContent = `You gave ${formatMoney(selectedCase.value)} to the Banker. Random replacement: Case ${String(replacement.number).padStart(2, "0")} — ${formatMoney(replacement.value)} added to your side.`;
  }
  superChestPendingCase = null;
  superChestPhase = "select";
  renderSuperChestCases();
  updateSuperChestScoreboard();
  if (superChestPlayerCases.length >= 10) {
    await revealRemainingSuperChestForBanker();
    return;
  }
  await delay(800);
  if (superChestCases.every((item) => item.status !== "available"))
    await finishSuperChestAllocation();
  else {
    superChestInstruction.textContent =
      "Choose one of the remaining cases to reveal.";
    superChestBusy = false;
    renderSuperChestCases();
  }
}

async function revealRemainingSuperChestForBanker() {
  superChestPhase = "banker-reveal";
  superChestBusy = true;
  document.getElementById("superChestDecision")?.remove();
  const remaining = superChestCases.filter(
    (item) => item.status === "available",
  );
  superChestInstruction.textContent =
    "YOU HAVE 10 CASES. THE BANKER'S REMAINING CASES ARE BEING REVEALED...";
  for (const miniCase of remaining) {
    miniCase.status = "allocated";
    miniCase.owner = "banker";
    superChestBankerCases.push(miniCase);
    superChestBankerTotal += miniCase.value;
    addLog({
      type: "SUPER_CHEST_BANKER_REVEAL",
      round: 3,
      caseNumber: miniCase.number,
      value: miniCase.value,
      reason: "PLAYER_REACHED_10_CASES",
    });
    renderSuperChestCases();
    const button = superChestCasesElement.querySelector(
      `.super-chest-case[data-mini-case-number="${miniCase.number}"]`,
    );
    if (button) button.classList.add("banker-reveal");
    updateSuperChestScoreboard();
    await delay(350);
  }
  addLog({
    type: "SUPER_CHEST_AUTO_BANKER_ALLOCATION_COMPLETE",
    round: 3,
    playerCaseCount: superChestPlayerCases.length,
    bankerCaseCount: superChestBankerCases.length,
    remainingCasesRevealed: remaining.length,
  });
  await finishSuperChestAllocation();
}

async function finishSuperChestAllocation() {
  superChestPhase = "complete";
  superChestBusy = false;
  const playerWins = superChestPlayerTotal > superChestBankerTotal;
  superChestBenefitAvailable = playerWins;
  addLog({
    type: "SUPER_CHEST_RESULT",
    round: 3,
    turns: superChestTurn,
    playerTotal: superChestPlayerTotal,
    bankerTotal: superChestBankerTotal,
    won: playerWins,
    tie: superChestPlayerTotal === superChestBankerTotal,
    benefit: playerWins ? "+50% BANKER OFFER ONCE" : "NONE",
    playerCases: superChestPlayerCases.map((c) => ({
      caseNumber: c.number,
      value: c.value,
    })),
    bankerCases: superChestBankerCases.map((c) => ({
      caseNumber: c.number,
      value: c.value,
    })),
  });
  superChestResultElement.classList.remove("hidden");
  superChestResultElement.innerHTML = playerWins
    ? `<strong>🎉 YOU WIN THE SUPER CHEST!</strong><br>You: ${formatMoney(superChestPlayerTotal)} &nbsp;|&nbsp; Banker: ${formatMoney(superChestBankerTotal)}<br><span>You've earned a one-time +50% Banker Offer benefit.</span>`
    : superChestPlayerTotal === superChestBankerTotal
      ? `<strong>THE SUPER CHEST IS A TIE.</strong><br>You: ${formatMoney(superChestPlayerTotal)} &nbsp;|&nbsp; Banker: ${formatMoney(superChestBankerTotal)}<br><span>No benefit this time.</span>`
      : `<strong>THE BANKER WINS THE SUPER CHEST.</strong><br>You: ${formatMoney(superChestPlayerTotal)} &nbsp;|&nbsp; Banker: ${formatMoney(superChestBankerTotal)}<br><span>No benefit this time.</span>`;
  superChestInstruction.textContent = "All 20 cases have been allocated.";
  superChestContinueButton.classList.remove("hidden");
}

/* Legacy function retained as an explicit entry point for old saved pages. */
async function revealSuperChestBankerCases() {
  if (superChestCases.every((item) => item.status !== "available"))
    await finishSuperChestAllocation();
}

/*
  Old ten-pick implementation removed. The turn based choices above
  allocate each case exactly once and log both the reveal and decision.
*/
function updateSuperChestScoreboard() {
  superChestPlayerTotalElement.textContent = formatMoney(superChestPlayerTotal);
  superChestBankerTotalElement.textContent = formatMoney(superChestBankerTotal);
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
  const boostedOffer = smartRoundOffer(currentOffer * 1.5);
  superChestBenefitUsed = true;
  superChestBenefitAvailable = false;
  bankerOffer.textContent = formatMoney(boostedOffer);
  superChestBenefitButton.classList.add("hidden");
  addLog({
    type: "SUPER_CHEST_BENEFIT_USED",
    round,
    originalOffer: currentOffer,
    boostedOffer,
    multiplier: 1.5,
  });
  instruction.textContent = "SUPER CHEST BENEFIT ACTIVATED";
  message.textContent = `THE BANKER'S OFFER HAS BEEN INCREASED BY 50%: ${formatMoney(boostedOffer)}.`;
}

/* =========================================================
   BANKER BUYOUT
========================================================= */

function isBuyoutTriggered() {
  if (!rightMoneyBoard) {
    return false;
  }

  const remainingRightSidePrizes = rightMoneyBoard.querySelectorAll(
    ".money-value:not(.eliminated)",
  ).length;

  return remainingRightSidePrizes === 1;
}

function calculateBankerBuyout(normalOffer) {
  const remainingValues = cases
    .filter((gameCase) => !gameCase.opened)
    .map((gameCase) => gameCase.value);

  if (remainingValues.length === 0) {
    return normalOffer;
  }

  const expectedValue =
    remainingValues.reduce((sum, value) => sum + value, 0) /
    remainingValues.length;

  /*
        The Buyout is intentionally generous: 135% of the
        normal offer, but never more than 95% of expected value.
    */
  let buyout = Math.min(normalOffer * 1.35, expectedValue * 0.95);

  buyout = Math.max(buyout, normalOffer);

  return smartRoundOffer(buyout);
}

function acceptBuyout() {
  const amount = Number(buyoutOffer.textContent.replace(/[$,]/g, ""));

  addLog({
    type: "BUYOUT_ACCEPTED",
    round: round,
    amount: amount,
  });

  gameOver = true;
  waitingForDeal = false;

  bankerSection.classList.add("hidden");
  buyoutOfferContent.classList.add("hidden");

  instruction.textContent = "BUYOUT ACCEPTED!";
  message.textContent = `YOU ACCEPTED THE BANKER'S BUYOUT OF ${formatMoney(amount)}!`;

  revealPlayerCase();

  addLog({
    type: "GAME_END",
    reason: "BUYOUT",
    winnings: amount,
    playerCase: playerCase,
    playerCaseValue: playerCaseValue,
  });

  showGameLogButton();
  newGameButton.classList.remove("hidden");
}

function rejectBuyout() {
  addLog({
    type: "BUYOUT_REJECTED",
    round: round,
    amount: Number(buyoutOffer.textContent.replace(/[$,]/g, "")),
  });

  buyoutOfferContent.classList.add("hidden");
  bankerSection.classList.add("hidden");

  message.textContent = "BUYOUT REJECTED. NO DEAL! THE GAME CONTINUES.";

  continueGame(false);
}

buyoutButton.addEventListener("click", acceptBuyout);
rejectBuyoutButton.addEventListener("click", rejectBuyout);

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

  bankerSection.classList.add("hidden");

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

  bankerSection.classList.add("hidden");

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

      /*
                Banker offer
            */

      const buyout = events.find((event) => event.type === "BUYOUT_OFFER");

      if (buyout) {
        output += `Banker Buyout Offer: ${formatMoney(buyout.offer)}\n`;
        output += `Normal Banker Offer: ${formatMoney(buyout.normalBankerOffer)}\n`;

        if (buyout.unopenedCases && buyout.unopenedCases.length > 0) {
          output += "\nUnopened Cases and Amounts:\n";

          buyout.unopenedCases.forEach((gameCase) => {
            const playerLabel = gameCase.isPlayerCase ? " (PLAYER'S CASE)" : "";
            output +=
              `Case #${gameCase.caseNumber} → ` +
              `${formatMoney(gameCase.value)}${playerLabel}\n`;
          });
        }
      }

      const buyoutAccepted = events.find(
        (event) => event.type === "BUYOUT_ACCEPTED",
      );

      if (buyoutAccepted) {
        output += `\nBuyout Decision: ACCEPTED\n`;
        output += `Buyout Amount: ${formatMoney(buyoutAccepted.amount)}\n`;
      }

      const buyoutRejected = events.find(
        (event) => event.type === "BUYOUT_REJECTED",
      );

      if (buyoutRejected) {
        output += `\nBuyout Decision: REJECTED\n`;
        output += "Result: NO DEAL\n";
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
    } else if (finalGameEnd.reason === "BUYOUT") {
      output += `Result: BANKER BUYOUT ACCEPTED\n`;
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
