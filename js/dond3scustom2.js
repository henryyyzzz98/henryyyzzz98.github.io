/* =========================================================
   MOVE ON UP — 3 STRIKES ACCUMULATOR
   25 cases:
     21 MONEY
      1 WIN
      3 STRIKE

   MONEY:
     Randomly worth 3.0%–7.0% of the top prize.
     Values are generated in 0.1% increments and rounded.

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
const MIN_MONEY_PERCENT = 3.0;
const MAX_MONEY_PERCENT = 7.0;

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
    moneyRange: `${MIN_MONEY_PERCENT.toFixed(1)}%-${MAX_MONEY_PERCENT.toFixed(1)}%`,
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
}

function createCases() {
  const generated = [];

  for (let i = 0; i < MONEY_CASES; i++) {
    const percentage =
      Math.round(
        (MIN_MONEY_PERCENT +
          Math.random() * (MAX_MONEY_PERCENT - MIN_MONEY_PERCENT)) *
          10,
      ) / 10;

    const rawAmount = maxPrize * (percentage / 100);
    const amount = roundMoneyValue(rawAmount);

    generated.push({
      type: "MONEY",
      percentage,
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
      percentage: gameCase.percentage ?? null,
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
  strikesHit++;

  addLog({
    type: "STRIKE",
    selectionNumber: openedCases,
    caseNumber:
      cases.find(
        (gameCase) =>
          gameCase.opened && gameCase.number === getLastOpenedCaseNumber(),
      )?.number ?? null,
    strikeNumber: strikesHit,
    strikesRemaining: 3 - strikesHit,
    accumulatedPrize,
  });

  updateGameInfo();
  renderCases();

  if (strikesHit >= 3) {
    loseOnThirdStrike();
    return;
  }

  message.textContent = `STRIKE ${strikesHit}/3! YOUR TOTAL REMAINS ${formatMoney(accumulatedPrize)}.`;

  if (strikesHit >= 2) {
    delay(350).then(() => {
      if (!gameOver) showBailoutOffer();
    });
  } else {
    finishCaseAndContinue();
  }
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

function calculateBailoutOffer() {
  const currentTotal = accumulatedPrize;

  const remainingMoney = cases.filter(
    (gameCase) => !gameCase.opened && gameCase.type === "MONEY",
  );

  const averageRemaining =
    remainingMoney.length > 0
      ? remainingMoney.reduce((sum, gameCase) => sum + gameCase.amount, 0) /
        remainingMoney.length
      : 0;

  // After two Strikes, the contestant is risking a $0 result on the
  // next Strike. The Banker therefore pays a premium over the current
  // accumulated amount, while still keeping the offer below the jackpot.
  const riskAdjustedContinuation = currentTotal + averageRemaining * 0.65;

  const minimumOffer =
    currentTotal > 0 ? currentTotal * 1.25 : averageRemaining * 0.4;

  const maximumOffer = Math.min(
    maxPrize,
    Math.max(currentTotal * 2, currentTotal + averageRemaining),
  );

  const offer = Math.max(
    minimumOffer,
    Math.min(maximumOffer, riskAdjustedContinuation),
  );

  return smartRoundOffer(Math.min(maxPrize, offer));
}

function showBailoutOffer() {
  currentOfferType = "BAILOUT";

  const offer = calculateBailoutOffer();

  bankerSection.classList.remove("hidden");
  bankerWaiting.classList.remove("hidden");
  bankerOfferContent.classList.add("hidden");

  bankerOffer.textContent = formatMoney(offer);

  instruction.textContent = "BAILOUT OFFER";
  message.textContent = `TAKE ${formatMoney(offer)} OR DECLINE AND KEEP PLAYING.`;

  addLog({
    type: "BAILOUT_OFFER",
    selectionNumber: openedCases,
    offer,
    accumulatedPrize,
    strikesHit,
    strikesRemaining: 3 - strikesHit,
    remainingMoneyCases: cases.filter(
      (gameCase) => !gameCase.opened && gameCase.type === "MONEY",
    ).length,
  });

  delay(900).then(() => {
    if (gameOver || currentOfferType !== "BAILOUT") return;

    bankerWaiting.classList.add("hidden");
    bankerOfferContent.classList.remove("hidden");

    const title = bankerOfferContent.querySelector(".banker-title");
    if (title) title.textContent = "BAILOUT OFFER";

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

function loseOnThirdStrike() {
  if (gameOver) return;

  gameOver = true;
  waitingForDeal = false;
  currentOfferType = null;

  bankerSection.classList.add("hidden");

  instruction.textContent = "THIRD STRIKE!";
  message.textContent = "GAME OVER — YOU WIN $0.";

  addLog({
    type: "GAME_END",
    reason: "THIRD STRIKE",
    winnings: 0,
    accumulatedPrize,
    strikesHit: 3,
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

function updateGameInfo() {
  const remaining = cases.filter((gameCase) => !gameCase.opened).length;

  casesLeftElement.textContent = remaining;
  roundNumber.textContent = Math.max(1, openedCases);
  strikesRemainingElement.textContent = Math.max(0, 3 - strikesHit);
  currentPrizeElement.textContent = formatMoney(accumulatedPrize);
  topPrizeElement.textContent = formatMoney(maxPrize);
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
  output += "     MOVE ON UP - 3 STRIKES ACCUMULATOR\n";
  output += "========================================\n\n";

  const start = gameLog.find((event) => event.type === "GAME_START");

  output += `Game Date: ${start?.date || "Unknown"}\n`;
  output += `Maximum Prize: ${formatMoney(start?.maximumPrize || maxPrize)}\n`;
  output += `Money Range: ${MIN_MONEY_PERCENT.toFixed(1)}%-${MAX_MONEY_PERCENT.toFixed(1)}%\n\n`;

  output += "CASE DISTRIBUTION\n";
  output += "----------------------------------------\n";
  output += `Money: ${MONEY_CASES}\n`;
  output += `WIN: ${WIN_CASES}\n`;
  output += `STRIKE: ${STRIKE_CASES}\n\n`;

  output += "CASE RESULTS\n";
  output += "----------------------------------------\n";

  gameLog
    .filter((event) => event.type === "CASE_OPENED")
    .forEach((event) => {
      if (event.result === "MONEY") {
        output +=
          `Selection #${event.selectionNumber} | Case #${event.caseNumber} → ` +
          `${formatMoney(event.amount)} (${event.percentage.toFixed(1)}%)\n`;
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

  output += "\nSTRIKES\n";
  output += "----------------------------------------\n";

  gameLog
    .filter((event) => event.type === "STRIKE")
    .forEach((event) => {
      output +=
        `Strike #${event.strikeNumber} | Remaining: ${event.strikesRemaining} ` +
        `| Total: ${formatMoney(event.accumulatedPrize)}\n`;
    });

  output += "\nBAILOUT / WIN DECISIONS\n";
  output += "----------------------------------------\n";

  gameLog
    .filter((event) =>
      [
        "BAILOUT_OFFER",
        "BAILOUT_ACCEPTED",
        "BAILOUT_REJECTED",
        "WIN_CASE_DECISION",
        "WIN_ACCEPTED",
        "WIN_DECLINED",
      ].includes(event.type),
    )
    .forEach((event) => {
      if (event.type === "BAILOUT_OFFER") {
        output +=
          `Bailout Offer: ${formatMoney(event.offer)} | ` +
          `Total: ${formatMoney(event.accumulatedPrize)} | ` +
          `Strikes: ${event.strikesHit}/3\n`;
      } else if (event.type === "WIN_CASE_DECISION") {
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
  link.download = `move-on-up-3-strikes-${Date.now()}.txt`;
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
