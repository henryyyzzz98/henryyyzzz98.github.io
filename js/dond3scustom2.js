/* =========================================================
   MOVE ON UP — 3 STRIKES ACCUMULATOR
   25 cases:
     21 MONEY
      1 WIN
      3 STRIKE

   MONEY:
     21 random positive amounts are generated.
     Each money case is at least 0.5% of the selected top prize.
     All 21 money-case amounts add up to exactly the selected top prize.

   BAILOUT:
     After Strike #2, every subsequent Bailout offer is exactly
     75% of the accumulated total.

   WIN:
     Selection #1 -> automatic top-prize win.
     Later -> contestant may accept current total or continue.

   STRIKE:
     Strike #1 -> continue.
     Strike #2 -> Bailout becomes available after every
                  subsequent case.
     Strike #3 -> immediate GAME OVER at $0.

   JACKPOT:
     The accumulated total is capped at the top prize.
     Reaching/exceeding the top prize immediately ends
     the game with the exact top prize.
========================================================= */

const TOTAL_CASES = 25;
const MONEY_CASES = 21;
const WIN_CASES = 1;
const STRIKE_CASES = 3;
const MIN_MONEY_PERCENT = 0.5;

let maxPrize = 1000000;
let cases = [];
let accumulatedPrize = 0;
let gameOver = false;
let waitingForDeal = false;
let openedCases = 0;
let strikesHit = 0;
let gameLog = [];
let gameStartTime = null;
let currentOfferType = null;

const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const maxPrizeInput = document.getElementById("maxPrize");
const startButton = document.getElementById("startButton");
const casesContainer = document.getElementById("casesContainer");
const instruction = document.getElementById("instruction");
const roundNumber = document.getElementById("roundNumber");
const casesLeftElement = document.getElementById("casesLeft");
const bankerSection = document.getElementById("bankerSection");
const bankerWaiting = document.getElementById("bankerWaiting");
const bankerOfferContent = document.getElementById("bankerOfferContent");
const bankerOffer = document.getElementById("bankerOffer");
const dealButton = document.getElementById("dealButton");
const noDealButton = document.getElementById("noDealButton");
const message = document.getElementById("message");
const newGameButton = document.getElementById("newGameButton");
const strikesRemainingElement = document.getElementById("strikesRemaining");
const currentPrizeElement = document.getElementById("currentPrize");
const topPrizeElement = document.getElementById("topPrize");

startButton.addEventListener("click", startGame);
dealButton.addEventListener("click", takeDeal);
noDealButton.addEventListener("click", continueGame);

newGameButton.addEventListener("click", () => {
  gameScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
});

function startGame() {
  maxPrize = Number(maxPrizeInput.value);

  if (!Number.isFinite(maxPrize) || maxPrize <= 0) {
    alert("Please enter a valid maximum prize.");
    return;
  }

  resetGame();

  gameStartTime = new Date();
  cases = createCases();

  addLog({
    type: "GAME_START",
    date: formatDateTime(gameStartTime),
    maximumPrize: maxPrize,
    caseDistribution: {
      MONEY: MONEY_CASES,
      WIN: WIN_CASES,
      STRIKE: STRIKE_CASES,
    },
    moneyMinimum: `${MIN_MONEY_PERCENT.toFixed(1)}% of top prize`,
  });

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  renderCases();
  updateGameInfo();

  instruction.textContent = "CHOOSE YOUR CASE";
  message.textContent = "START ACCUMULATING. CHOOSE A CASE.";
}

function resetGame() {
  cases = [];
  accumulatedPrize = 0;
  gameOver = false;
  waitingForDeal = false;
  openedCases = 0;
  strikesHit = 0;
  gameLog = [];
  gameStartTime = null;
  currentOfferType = null;

  bankerSection.classList.add("hidden");
  bankerWaiting.classList.remove("hidden");
  bankerOfferContent.classList.add("hidden");
  newGameButton.classList.add("hidden");
  message.textContent = "";

  // Remove the previous game's download log button.
  const logButton = document.getElementById("downloadLogButton");
  if (logButton) {
    logButton.remove();
  }
  updateAccumulatedProgress();
}

function createCases() {
  const generated = [];

  // 0.5% of the selected top prize is the minimum amount per Money case.
  // Example: $1,000,000 top prize -> $5,000 minimum.
  const moneyUnit = getMoneyUnit();
  const minimumAmount = Math.max(
    moneyUnit,
    Math.ceil((maxPrize * (MIN_MONEY_PERCENT / 100)) / moneyUnit) * moneyUnit,
  );

  // Reserve the minimum for all 21 Money cases first.
  const remainingAmount = maxPrize - minimumAmount * MONEY_CASES;

  if (remainingAmount < 0) {
    throw new Error(
      `Top prize is too small to generate ${MONEY_CASES} money cases with the minimum amount.`,
    );
  }

  // Randomly distribute the remainder across the 21 Money cases.
  // This guarantees every Money case meets the minimum and that the
  // combined value is exactly the selected top prize.
  const extraAmounts = randomPartition(
    Math.floor(remainingAmount / moneyUnit),
    MONEY_CASES,
  );

  for (let i = 0; i < MONEY_CASES; i++) {
    const amount = minimumAmount + extraAmounts[i] * moneyUnit;

    generated.push({
      type: "MONEY",
      amount,
      opened: false,
    });
  }

  for (let i = 0; i < WIN_CASES; i++) {
    generated.push({
      type: "WIN",
      amount: maxPrize,
      opened: false,
    });
  }

  for (let i = 0; i < STRIKE_CASES; i++) {
    generated.push({
      type: "STRIKE",
      amount: 0,
      opened: false,
    });
  }

  shuffle(generated);

  return generated.map((gameCase, index) => ({
    ...gameCase,
    number: index + 1,
  }));
}

function getMoneyUnit() {
  if (maxPrize >= 1000000) return 1000;
  if (maxPrize >= 100000) return 100;
  if (maxPrize >= 10000) return 10;
  return 1;
}

function randomPartition(totalUnits, count) {
  if (count <= 0) return [];
  if (totalUnits <= 0) return Array(count).fill(0);

  const cuts = [];

  for (let i = 0; i < count - 1; i++) {
    cuts.push(Math.floor(Math.random() * (totalUnits + 1)));
  }

  cuts.sort((a, b) => a - b);

  const parts = [];
  let previous = 0;

  for (const cut of cuts) {
    parts.push(cut - previous);
    previous = cut;
  }

  parts.push(totalUnits - previous);

  shuffle(parts);
  return parts;
}

function roundMoneyValue(value) {
  if (maxPrize >= 1000000) {
    return Math.round(value / 1000) * 1000;
  }

  if (maxPrize >= 100000) {
    return Math.round(value / 100) * 100;
  }

  if (maxPrize >= 10000) {
    return Math.round(value / 10) * 10;
  }

  return Math.round(value);
}

function openCase(gameCase) {
  if (gameOver || waitingForDeal || gameCase.opened) return;

  waitingForDeal = true;

  const button = document.querySelector(
    `.case[data-case-number="${gameCase.number}"]`,
  );

  if (!button) {
    waitingForDeal = false;
    return;
  }

  button.classList.add("opening");
  instruction.textContent = `OPENING CASE ${String(gameCase.number).padStart(2, "0")}...`;

  delay(700).then(() => {
    if (gameOver) return;

    gameCase.opened = true;
    openedCases++;

    button.classList.remove("opening");
    button.classList.add("revealed", resultClass(gameCase.type));

    if (gameCase.type === "MONEY") {
      button.textContent = formatMoney(gameCase.amount);
    } else if (gameCase.type === "WIN") {
      button.textContent = "WIN";
    } else {
      button.textContent = "STRIKE";
    }

    addLog({
      type: "CASE_OPENED",
      selectionNumber: openedCases,
      caseNumber: gameCase.number,
      result: gameCase.type,
      amount: gameCase.amount,
      totalBefore: accumulatedPrize,
      strikesHitBefore: strikesHit,
    });

    if (gameCase.type === "MONEY") {
      handleMoneyCase(gameCase);
      return;
    }

    if (gameCase.type === "STRIKE") {
      handleStrikeCase(gameCase);
      return;
    }

    handleWinCase();
  });
}

function handleMoneyCase(gameCase) {
  const previousTotal = accumulatedPrize;
  accumulatedPrize = Math.min(maxPrize, accumulatedPrize + gameCase.amount);

  addLog({
    type: "MONEY_ADDED",
    selectionNumber: openedCases,
    caseNumber: gameCase.number,
    amount: gameCase.amount,
    percentage: gameCase.percentage,
    totalBefore: previousTotal,
    totalAfter: accumulatedPrize,
  });

  message.textContent = `+${formatMoney(gameCase.amount)}! YOUR TOTAL IS NOW ${formatMoney(accumulatedPrize)}.`;

  updateGameInfo();
  renderCases();

  if (accumulatedPrize >= maxPrize) {
    winTopPrize("ACCUMULATED");
    return;
  }

  finishCaseAndContinue();
}

function handleStrikeCase() {
  strikesHit += 1;

  const previousTotal = accumulatedPrize;
  const newTotal = roundStrikeTotal(previousTotal * 0.75);
  const penaltyAmount = previousTotal - newTotal;

  accumulatedPrize = newTotal;

  gameLog.push({
    type: "STRIKE",
    selectionNumber: openedCases,
    strikeNumber: strikesHit,
    previousTotal,
    penaltyAmount,
    newTotal: accumulatedPrize,
  });

  updateGameInfo();
  updateAccumulatedProgress();

  message.textContent =
    `STRIKE ${strikesHit}! ${formatMoney(penaltyAmount)} deducted. ` +
    `Current total: ${formatMoney(accumulatedPrize)}.`;

  finishCaseAndContinue();
}

function handleWinCase() {
  message.textContent =
    openedCases === 1
      ? "WIN! YOU HIT THE WIN CASE ON YOUR FIRST SELECTION!"
      : `WIN! YOUR CURRENT TOTAL IS ${formatMoney(accumulatedPrize)}.`;

  addLog({
    type: "WIN_CASE_FOUND",
    selectionNumber: openedCases,
    accumulatedPrize,
    strikesHit,
  });

  if (openedCases === 1) {
    winTopPrize("WIN_CASE_FIRST_SELECTION");
    return;
  }

  showWinDecision();
}

function showWinDecision() {
  currentOfferType = "WIN";

  bankerSection.classList.remove("hidden");
  bankerWaiting.classList.remove("hidden");
  bankerOfferContent.classList.add("hidden");

  bankerOffer.textContent = formatMoney(accumulatedPrize);

  instruction.textContent = "THE WIN CASE HAS BEEN FOUND";
  message.textContent = `TAKE ${formatMoney(accumulatedPrize)} OR DECLINE AND KEEP PLAYING.`;

  addLog({
    type: "WIN_CASE_DECISION",
    selectionNumber: openedCases,
    offer: accumulatedPrize,
    accumulatedPrize,
    strikesHit,
  });

  delay(900).then(() => {
    if (gameOver || currentOfferType !== "WIN") return;

    bankerWaiting.classList.add("hidden");
    bankerOfferContent.classList.remove("hidden");

    const title = bankerOfferContent.querySelector(".banker-title");
    if (title) title.textContent = "WIN CASE";

    const buttons = bankerOfferContent.querySelector(".deal-buttons");
    if (buttons) buttons.classList.add("buyout-buttons");
  });
}

function takeDeal() {
  if (gameOver || !currentOfferType) return;

  const offer = Number(bankerOffer.textContent.replace(/[$,]/g, ""));

  const offerType = currentOfferType;

  addLog({
    type: offerType === "WIN" ? "WIN_ACCEPTED" : "BAILOUT_ACCEPTED",
    selectionNumber: openedCases,
    amount: offer,
    accumulatedPrize,
    strikesHit,
  });

  gameOver = true;
  waitingForDeal = false;

  bankerSection.classList.add("hidden");

  instruction.textContent =
    offerType === "WIN" ? "WIN ACCEPTED!" : "BAILOUT ACCEPTED!";

  message.textContent = `YOU WON ${formatMoney(offer)}!`;

  addLog({
    type: "GAME_END",
    reason: offerType === "WIN" ? "WIN CASE ACCEPTED" : "BAILOUT ACCEPTED",
    winnings: offer,
    accumulatedPrize,
    strikesHit,
  });

  updateGameInfo();
  renderCases();
  showGameLogButton();
  newGameButton.classList.remove("hidden");
  currentOfferType = null;
}

function continueGame() {
  if (gameOver || !currentOfferType) return;

  const offerType = currentOfferType;
  const offer = Number(bankerOffer.textContent.replace(/[$,]/g, ""));

  addLog({
    type: offerType === "WIN" ? "WIN_DECLINED" : "BAILOUT_REJECTED",
    selectionNumber: openedCases,
    offer,
    accumulatedPrize,
    strikesHit,
  });

  bankerSection.classList.add("hidden");
  currentOfferType = null;

  message.textContent =
    offerType === "WIN"
      ? "WIN DECLINED. KEEP PLAYING."
      : "BAILOUT DECLINED. KEEP PLAYING.";

  finishCaseAndContinue();
}

function finishCaseAndContinue() {
  if (gameOver) return;

  delay(350).then(() => {
    if (gameOver) return;

    const unopened = cases.filter((gameCase) => !gameCase.opened);

    if (!unopened.length) {
      finishAllCases();
      return;
    }

    waitingForDeal = false;
    renderCases();

    instruction.textContent = "CHOOSE YOUR CASE";
    updateGameInfo();
  });
}

function finishAllCases() {
  if (gameOver) return;

  gameOver = true;
  waitingForDeal = false;

  const winnings = Math.min(accumulatedPrize, maxPrize);

  instruction.textContent = "GAME COMPLETE";
  message.textContent = `FINAL TOTAL: ${formatMoney(winnings)}!`;

  addLog({
    type: "GAME_END",
    reason: "ALL CASES OPENED",
    winnings,
    accumulatedPrize: winnings,
    strikesHit,
  });

  renderCases();
  updateGameInfo();
  showGameLogButton();
  newGameButton.classList.remove("hidden");
}

function winTopPrize(reason) {
  if (gameOver) return;

  accumulatedPrize = maxPrize;
  gameOver = true;
  waitingForDeal = false;
  currentOfferType = null;

  bankerSection.classList.add("hidden");

  instruction.textContent = "TOP PRIZE REACHED!";
  message.textContent = `YOU WON THE TOP PRIZE: ${formatMoney(maxPrize)}!`;

  addLog({
    type: "GAME_END",
    reason,
    winnings: maxPrize,
    accumulatedPrize: maxPrize,
    strikesHit,
  });

  updateGameInfo();
  renderCases();
  showGameLogButton();
  newGameButton.classList.remove("hidden");
}

function renderCases() {
  casesContainer.innerHTML = "";

  cases.forEach((gameCase) => {
    const button = document.createElement("button");
    button.className = "case";
    button.dataset.caseNumber = gameCase.number;

    if (gameCase.opened) {
      button.classList.add("disabled", "revealed", resultClass(gameCase.type));

      if (gameCase.type === "MONEY") {
        button.textContent = formatMoney(gameCase.amount);
      } else if (gameCase.type === "WIN") {
        button.textContent = "WIN";
      } else {
        button.textContent = "STRIKE";
      }
    } else {
      button.textContent = String(gameCase.number).padStart(2, "0");

      if (!gameOver && !waitingForDeal) {
        button.addEventListener("click", () => openCase(gameCase));
      }
    }

    casesContainer.appendChild(button);
  });
}

function updateAccumulatedProgress() {
  const progressBar = document.getElementById("accumulatedProgressBar");
  const progressText = document.getElementById("accumulatedProgressText");

  if (!progressBar || !progressText) return;

  const topPrize = Number(maxPrize) || 0;
  const total = Number(accumulatedPrize) || 0;
  const percentage =
    topPrize > 0 ? Math.max(0, Math.min(100, (total / topPrize) * 100)) : 0;

  progressBar.style.width = `${percentage}%`;
  progressText.textContent = `${percentage.toFixed(1)}%`;
}

function getStrikeRoundingUnit() {
  if (maxPrize >= 1000000) return 1000;
  if (maxPrize >= 100000) return 100;
  if (maxPrize >= 10000) return 10;
  return 1;
}

function roundStrikeTotal(value) {
  const unit = getStrikeRoundingUnit();
  return Math.round(value / unit) * unit;
}

function updateGameInfo() {
  const remaining = cases.filter((gameCase) => !gameCase.opened).length;

  casesLeftElement.textContent = remaining;
  roundNumber.textContent = Math.max(1, openedCases);
  strikesRemainingElement.textContent = Math.max(0, 3 - strikesHit);
  currentPrizeElement.textContent = formatMoney(accumulatedPrize);
  topPrizeElement.textContent = formatMoney(maxPrize);
  updateAccumulatedProgress();
}

function resultClass(result) {
  return result.toLowerCase().replace(/\s+/g, "-");
}

function getLastOpenedCaseNumber() {
  for (let i = cases.length - 1; i >= 0; i--) {
    if (cases[i].opened) return cases[i].number;
  }
  return null;
}

function smartRoundOffer(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;

  let rounded;

  if (value >= 1000000) rounded = Math.round(value / 5000) * 5000;
  else if (value >= 100000) rounded = Math.round(value / 1000) * 1000;
  else if (value >= 10000) rounded = Math.round(value / 500) * 500;
  else if (value >= 1000) rounded = Math.round(value / 100) * 100;
  else rounded = Math.round(value / 10) * 10;

  return Math.min(maxPrize, Math.max(0, rounded));
}

function formatMoney(value) {
  return (
    "$" +
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

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

function addLog(event) {
  gameLog.push({
    timestamp: new Date(),
    ...event,
  });
}

function showGameLogButton() {
  let button = document.getElementById("downloadLogButton");

  if (button) return;

  button = document.createElement("button");
  button.id = "downloadLogButton";
  button.className = "new-game";
  button.textContent = "DOWNLOAD GAME LOG";
  button.addEventListener("click", downloadGameLog);

  newGameButton.parentNode.insertBefore(button, newGameButton);
}

function generateGameLog() {
  let output = "";
  output += "========================================\n";
  output += "     ACCUMULATOR\n";
  output += "========================================\n\n";

  const start = gameLog.find((event) => event.type === "GAME_START");

  output += `Game Date: ${start?.date || "Unknown"}\n`;
  output += `Maximum Prize: ${formatMoney(start?.maximumPrize || maxPrize)}\n\n`;

  output += "CASE RESULTS\n";
  output += "----------------------------------------\n";

  gameLog
    .filter((event) => event.type === "CASE_OPENED")
    .forEach((event) => {
      if (event.result === "MONEY") {
        output +=
          `Selection #${event.selectionNumber} | Case #${event.caseNumber} → ` +
          `${formatMoney(event.amount)}\n`;
      } else {
        output +=
          `Selection #${event.selectionNumber} | Case #${event.caseNumber} → ` +
          `${event.result}\n`;
      }
    });

  output += "\nACCUMULATION\n";
  output += "----------------------------------------\n";

  gameLog
    .filter((event) => event.type === "MONEY_ADDED")
    .forEach((event) => {
      output +=
        `Selection #${event.selectionNumber}: +${formatMoney(event.amount)} ` +
        `→ Total ${formatMoney(event.totalAfter)}\n`;
    });

  output += "\nWIN DECISIONS\n";
  output += "----------------------------------------\n";

  gameLog
    .filter((event) =>
      [
        "WIN_CASE_DECISION",
        "WIN_ACCEPTED",
        "WIN_DECLINED",
      ].includes(event.type),
    )
    .forEach((event) => {
      if (event.type === "WIN_CASE_DECISION") {
        output +=
          `WIN Decision Offered: ${formatMoney(event.offer)} | ` +
          `Total: ${formatMoney(event.accumulatedPrize)}\n`;
      } else if (
        event.type === "BAILOUT_ACCEPTED" ||
        event.type === "WIN_ACCEPTED"
      ) {
        output += `${event.type}: ${formatMoney(event.amount)}\n`;
      } else {
        output += `${event.type}: ${formatMoney(event.offer)}\n`;
      }
    });

  const end = [...gameLog].reverse().find((event) => event.type === "GAME_END");

  output += "\n========================================\n";
  output += "GAME RESULT\n";
  output += "========================================\n";
  output += `Reason: ${end?.reason || "Unknown"}\n`;
  output += `Winnings: ${formatMoney(end?.winnings || 0)}\n`;
  output += `Final Accumulated Total: ${formatMoney(accumulatedPrize)}\n`;
  output += `Strikes Hit: ${strikesHit}/3\n`;

  return output;
}

function downloadGameLog() {
  const blob = new Blob([generateGameLog()], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `accumulator-${Date.now()}.txt`;
  link.click();

  URL.revokeObjectURL(url);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
