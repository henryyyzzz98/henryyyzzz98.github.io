/* =========================================================
   DEAL OR NO DEAL
   COMPLETE GAME SCRIPT
========================================================= */

/* =========================================================
   MASTER PRIZE BOARD
========================================================= */

const BASE_PRIZES = [
  0.01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000, 5000, 10000,
  25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000,
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

const ROUND_CASES = [6, 5, 4, 3, 2, 1, 1, 1, 1];

/* =========================================================
   GAME STATE
========================================================= */

let maxPrize = 1000000;

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
   COUNTER OFFER STATE
========================================================= */

let counterOfferAvailable = true;

let counterOfferInProgress = false;

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

const dealButton = document.getElementById("dealButton");

const noDealButton = document.getElementById("noDealButton");

const counterButton = document.getElementById("counterButton");

/* =========================================================
   COUNTER OFFER ELEMENTS
========================================================= */

const counterPanel = document.getElementById("counterPanel");

const counterInput = document.getElementById("counterInput");

const submitCounterButton = document.getElementById("submitCounterButton");

const cancelCounterButton = document.getElementById("cancelCounterButton");

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

function resetGame() {
  playerCase = null;

  playerCaseValue = null;

  originalPlayerCase = null;

  round = 1;

  casesToOpen = 0;

  openedCasesThisRound = 0;

  gameOver = false;

  waitingForDeal = false;

  /*
        Counter Offer reset.
    */

  counterOfferAvailable = true;

  counterOfferInProgress = false;

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

  /*
        Hide Counter panel.
    */

  counterPanel.classList.add("hidden");

  counterInput.value = "";

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
  const multiplier = maximumPrize / 1000000;

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

  if (value < 10) {
    return Math.round(value * 2) / 2;
  }

  if (value < 100) {
    return Math.round(value / 5) * 5;
  }

  if (value < 1000) {
    return Math.round(value / 10) * 10;
  }

  if (value < 10000) {
    return Math.round(value / 100) * 100;
  }

  if (value < 100000) {
    return Math.round(value / 1000) * 1000;
  }

  return Math.round(value / 5000) * 5000;
}

/* =========================================================
   MINIMUM PRIZE INCREMENT
========================================================= */

function getMinimumIncrement(value) {
  if (value < 1) {
    return 0.01;
  }

  if (value < 10) {
    return 1;
  }

  if (value < 100) {
    return 5;
  }

  if (value < 1000) {
    return 10;
  }

  if (value < 10000) {
    return 100;
  }

  if (value < 100000) {
    return 1000;
  }

  return 5000;
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
      "YOUR CASE HAS BEEN SELECTED. " + "CHOOSE ANOTHER CASE TO OPEN.";

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

  await delay(900);

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

  await delay(1800);

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

    element.innerHTML = `
                <span>
                    ${formatMoney(value)}
                </span>
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
   SHOW BANKER
========================================================= */

async function showBanker() {
  waitingForDeal = true;

  /*
        Calculate offer.
    */

  const offer = calculateBankerOffer();

  bankerOffer.textContent = formatMoney(offer);

  /*
        Record Banker offer.
    */

  addLog({
    type: "BANKER_OFFER",

    round: round,

    offer: offer,
  });

  /*
        Show Banker.
    */

  bankerSection.classList.remove("hidden");

  bankerWaiting.classList.remove("hidden");

  bankerOfferContent.classList.add("hidden");

  counterPanel.classList.add("hidden");

  instruction.textContent = "THE BANKER IS CALLING...";

  message.textContent = "PLEASE WAIT FOR THE BANKER'S OFFER.";

  await delay(1800);

  bankerWaiting.classList.add("hidden");

  bankerOfferContent.classList.remove("hidden");

  /*
        Show Counter only if still
        available.
    */

  if (counterOfferAvailable) {
    counterButton.classList.remove("hidden");
  } else {
    counterButton.classList.add("hidden");
  }

  instruction.textContent = "THE BANKER HAS MADE AN OFFER";

  message.textContent = "WILL YOU TAKE THE DEAL?";
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

  offer = smartRound(offer);

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

  counterPanel.classList.add("hidden");

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

  counterOfferInProgress = false;

  bankerSection.classList.add("hidden");

  bankerWaiting.classList.add("hidden");

  bankerOfferContent.classList.add("hidden");

  counterPanel.classList.add("hidden");

  counterButton.classList.add("hidden");

  /*
      Reset cases opened for the upcoming round.
  */

  openedCasesThisRound = 0;

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
   COUNTER OFFER
========================================================= */

counterButton.addEventListener("click", openCounterPanel);

function openCounterPanel() {
  if (!counterOfferAvailable) {
    return;
  }

  counterOfferInProgress = true;

  /*
        Record that the player chose
        to use their Counter Offer.

        The actual amount is recorded
        when submitted.
    */

  addLog({
    type: "COUNTER_STARTED",

    round: round,

    bankerOffer: Number(bankerOffer.textContent.replace(/[$,]/g, "")),
  });

  bankerOfferContent.classList.add("hidden");

  counterPanel.classList.remove("hidden");

  counterInput.value = "";

  counterInput.focus();

  instruction.textContent = "MAKE YOUR COUNTER OFFER";

  message.textContent =
    "CHOOSE YOUR AMOUNT CAREFULLY. " + "YOU CAN ONLY COUNTER ONCE.";
}

/* =========================================================
   CANCEL COUNTER
========================================================= */

cancelCounterButton.addEventListener("click", cancelCounter);

function cancelCounter() {
  counterOfferInProgress = false;

  /*
        Remove the temporary log entry.
    */

  if (
    gameLog.length > 0 &&
    gameLog[gameLog.length - 1].type === "COUNTER_STARTED"
  ) {
    gameLog.pop();
  }

  counterPanel.classList.add("hidden");

  bankerOfferContent.classList.remove("hidden");

  if (counterOfferAvailable) {
    counterButton.classList.remove("hidden");
  }

  instruction.textContent = "THE BANKER HAS MADE AN OFFER";

  message.textContent = "WILL YOU TAKE THE DEAL?";
}

/* =========================================================
   SUBMIT COUNTER OFFER
========================================================= */

submitCounterButton.addEventListener("click", submitCounterOffer);

function submitCounterOffer() {
  const playerOffer = Number(counterInput.value);

  const currentBankerOffer = Number(
    bankerOffer.textContent.replace(/[$,]/g, ""),
  );

  /*
        Validate amount.
    */

  if (!playerOffer || playerOffer <= 0) {
    message.textContent = "PLEASE ENTER A VALID AMOUNT.";

    return;
  }

  /*
        Counter must be higher than
        the Banker's current offer.
    */

  if (playerOffer <= currentBankerOffer) {
    message.textContent =
      "YOUR COUNTER OFFER MUST BE " + "HIGHER THAN THE BANKER'S OFFER.";

    return;
  }

  /*
        Counter is now permanently used.
    */

  counterOfferAvailable = false;

  counterOfferInProgress = false;

  /*
        Record player's counter.
    */

  addLog({
    type: "COUNTER_OFFER",

    round: round,

    bankerOffer: currentBankerOffer,

    playerOffer: playerOffer,
  });

  counterPanel.classList.add("hidden");

  counterButton.classList.add("hidden");

  waitingForDeal = true;

  instruction.textContent = "THE BANKER IS CONSIDERING...";

  message.textContent = "THE BANKER IS CONSIDERING " + "YOUR COUNTER OFFER.";

  delay(1800).then(() => {
    const result = evaluateCounterOffer(playerOffer, currentBankerOffer);

    handleCounterResult(result);
  });
}

/* =========================================================
   EVALUATE COUNTER OFFER
========================================================= */

function evaluateCounterOffer(playerOffer, currentOffer) {
  const counterRatio = playerOffer / currentOffer;

  /*
      Very reasonable counter:
      Up to 5% above the Banker's offer.
  */

  if (counterRatio <= 1.05) {
    return {
      action: "ACCEPT",
      amount: playerOffer,
    };
  }

  /*
      Reasonable counter:
      5% - 15% above the Banker's offer.

      Banker has a 50% chance to accept.
  */

  if (counterRatio <= 1.15) {
    if (Math.random() < 0.5) {
      return {
        action: "ACCEPT",
        amount: playerOffer,
      };
    }

    return {
      action: "REJECT",
    };
  }

  /*
      Aggressive counter:
      More than 15% above the Banker's offer.

      Automatic rejection.
  */

  return {
    action: "REJECT",
  };
}

/* =========================================================
   HANDLE COUNTER RESULT
========================================================= */

function handleCounterResult(result) {
  if (result.action === "ACCEPT") {
    counterAccepted(result.amount);

    return;
  }

  /*
        Any counter that is not accepted
        is considered rejected.

        Rejection = automatic No Deal.
    */

  rejectCounter();
}

/* =========================================================
   BANKER ACCEPTS COUNTER
========================================================= */

function counterAccepted(amount) {
  /*
        Record Banker acceptance.
    */

  addLog({
    type: "COUNTER_ACCEPTED",

    round: round,

    amount: amount,
  });

  gameOver = true;

  waitingForDeal = false;

  bankerSection.classList.add("hidden");

  counterPanel.classList.add("hidden");

  instruction.textContent = "DEAL!";

  message.textContent = `THE BANKER ACCEPTED ` + `${formatMoney(amount)}!`;

  bankerOffer.textContent = formatMoney(amount);

  revealPlayerCase();

  /*
        Final game log.
    */

  addLog({
    type: "GAME_END",

    reason: "COUNTER_ACCEPTED",

    winnings: amount,

    playerCase: playerCase,

    playerCaseValue: playerCaseValue,
  });

  showGameLogButton();

  newGameButton.classList.remove("hidden");
}

/* =========================================================
   BANKER COUNTERS
========================================================= */

function showBankerCounter(amount) {
  /*
        Record Banker's counter.
    */

  addLog({
    type: "BANKER_COUNTER",

    round: round,

    amount: amount,
  });

  bankerOffer.textContent = formatMoney(amount);

  bankerSection.classList.remove("hidden");

  bankerWaiting.classList.add("hidden");

  bankerOfferContent.classList.remove("hidden");

  /*
        Counter is already consumed.
    */

  counterButton.classList.add("hidden");

  instruction.textContent = "THE BANKER COUNTERS";

  message.textContent =
    `THE BANKER WILL GIVE YOU ` + `${formatMoney(amount)}. DEAL OR NO DEAL?`;

  waitingForDeal = true;
}

/* =========================================================
   BANKER REJECTS COUNTER
========================================================= */

function rejectCounter() {
  /* -----------------------------------------
       RECORD COUNTER REJECTION
    ----------------------------------------- */

  addLog({
    type: "COUNTER_REJECTED",
    round: round,
  });

  /* -----------------------------------------
       LOCK GAME
    ----------------------------------------- */

  waitingForDeal = true;
  counterOfferInProgress = false;

  /* -----------------------------------------
       HIDE ALL BANKER UI
    ----------------------------------------- */

  bankerSection.classList.add("hidden");

  bankerWaiting.classList.add("hidden");

  bankerOfferContent.classList.add("hidden");

  counterPanel.classList.add("hidden");

  counterButton.classList.add("hidden");

  /* -----------------------------------------
       SHOW REJECTION
    ----------------------------------------- */

  instruction.textContent = "NO DEAL!";

  message.textContent = "THE BANKER REJECTED YOUR " + "COUNTER OFFER.";

  /* -----------------------------------------
       AUTOMATICALLY MOVE TO NEXT ROUND
    ----------------------------------------- */

  delay(1800).then(() => {
    startNextRoundAfterCounter();
  });
}

function startNextRoundAfterCounter() {
  /* -----------------------------------------
       RESET ROUND STATE
    ----------------------------------------- */

  waitingForDeal = false;

  counterOfferInProgress = false;

  openedCasesThisRound = 0;

  /* -----------------------------------------
       MOVE TO NEXT ROUND
    ----------------------------------------- */

  round++;

  /* -----------------------------------------
       IF ROUND 9 IS FINISHED,
       GO TO FINAL STAGE
    ----------------------------------------- */

  if (round > ROUND_CASES.length) {
    startFinalStage();

    return;
  }

  /* -----------------------------------------
       SET CASES TO OPEN
    ----------------------------------------- */

  casesToOpen = ROUND_CASES[round - 1];

  /* -----------------------------------------
       UPDATE UI
    ----------------------------------------- */

  instruction.textContent =
    `OPEN ${casesToOpen} CASE` + `${casesToOpen === 1 ? "" : "S"}`;

  message.textContent = "NO DEAL! THE GAME CONTINUES.";

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

      const offer = events.find((event) => event.type === "BANKER_OFFER");

      if (offer) {
        output += `Banker's Offer: ${formatMoney(offer.offer)}\n`;
      }

      /*
                Counter Offer
            */

      const counter = events.find((event) => event.type === "COUNTER_OFFER");

      if (counter) {
        output += `Player's Counter: ${formatMoney(counter.playerOffer)}\n`;
      }

      /*
                Banker Counter
            */

      const bankerCounter = events.find(
        (event) => event.type === "BANKER_COUNTER",
      );

      if (bankerCounter) {
        output += `Banker's Counter: ${formatMoney(bankerCounter.amount)}\n`;
      }

      /*
                Counter accepted
            */

      const counterAcceptedEvent = events.find(
        (event) => event.type === "COUNTER_ACCEPTED",
      );

      if (counterAcceptedEvent) {
        output += `Banker's Response: ACCEPTED\n`;

        output += `Accepted Amount: ${formatMoney(
          counterAcceptedEvent.amount,
        )}\n`;
      }

      /*
                Counter rejected
            */

      const counterRejected = events.find(
        (event) => event.type === "COUNTER_REJECTED",
      );

      if (counterRejected) {
        output += "Banker's Response: REJECTED\n";

        output += "Result: AUTOMATIC NO DEAL\n";
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
    } else if (finalGameEnd.reason === "COUNTER_ACCEPTED") {
      output += `Result: COUNTER OFFER ACCEPTED\n`;
    } else {
      output += `Result: FINAL CASE\n`;
    }

    output += `Winnings: ${formatMoney(finalGameEnd.winnings)}\n`;
  }

  /*
        Counter status
    */

  output += `Counter Offer: ${counterOfferAvailable ? "NOT USED" : "USED"}\n`;

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
