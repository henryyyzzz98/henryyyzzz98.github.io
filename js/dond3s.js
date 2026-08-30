/* =========================================================
   DEAL OR NO DEAL — 3 STRIKES MODE
   Separate variant: 26 cases, 9 rounds
========================================================= */

const BASE_PRIZES = [
  0.01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000, 5000, 10000,
  25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000,
];

const TOTAL_CASES = 26;
const ROUND_CASES = [6, 5, 4, 3, 2, 1, 1, 1, 1];
const CASE_RESULTS = [
  ...Array(14).fill("UP 1"),
  ...Array(4).fill("UP 2"),
  ...Array(2).fill("UP 3"),
  ...Array(3).fill("DOWN 1"),
  ...Array(3).fill("STRIKE"),
];

let maxPrize = 1000000;
let prizes = [];
let cases = [];
let currentPrizeIndex = 0;
let round = 1;
let casesToOpen = 0;
let openedCasesThisRound = 0;
let gameOver = false;
let waitingForDeal = false;
let gameLog = [];
let gameStartTime = null;

const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const maxPrizeInput = document.getElementById("maxPrize");
const startButton = document.getElementById("startButton");
const casesContainer = document.getElementById("casesContainer");
const instruction = document.getElementById("instruction");
const roundNumber = document.getElementById("roundNumber");
const casesLeftElement = document.getElementById("casesLeft");
const leftMoneyBoard = document.getElementById("leftMoneyBoard");
const rightMoneyBoard = document.getElementById("rightMoneyBoard");
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
  if (!maxPrize || maxPrize <= 0) {
    alert("Please enter a valid maximum prize.");
    return;
  }

  resetGame();
  gameStartTime = new Date();
  prizes = generatePrizeBoard(maxPrize);
  cases = createCases();

  addLog({
    type: "GAME_START",
    date: formatDateTime(gameStartTime),
    maximumPrize: maxPrize,
    prizeBoard: [...prizes],
    caseDistribution: {
      "UP 1": 14,
      "UP 2": 4,
      "UP 3": 2,
      "DOWN 1": 3,
      STRIKE: 3,
    },
  });

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  currentPrizeIndex = 0;
  casesToOpen = ROUND_CASES[0];
  openedCasesThisRound = 0;

  renderMoneyBoard();
  renderCases();
  updateGameInfo();
  updateCurrentPrizeDisplay();

  instruction.textContent = `OPEN ${casesToOpen} CASES`;
  message.textContent = "START CLIMBING. CHOOSE A CASE.";
}

function resetGame() {
  prizes = [];
  cases = [];
  currentPrizeIndex = 0;
  round = 1;
  casesToOpen = 0;
  openedCasesThisRound = 0;
  gameOver = false;
  waitingForDeal = false;
  gameLog = [];
  gameStartTime = null;

  bankerSection.classList.add("hidden");
  bankerWaiting.classList.remove("hidden");
  bankerOfferContent.classList.add("hidden");
  newGameButton.classList.add("hidden");
  message.textContent = "";

  const logButton = document.getElementById("downloadLogButton");
  if (logButton) logButton.remove();
}

function generatePrizeBoard(maximumPrize) {
  const multiplier = maximumPrize / 1000000;
  const generated = BASE_PRIZES.map((value) => smartRound(value * multiplier));
  generated[generated.length - 1] = maximumPrize;

  for (let i = 1; i < generated.length; i++) {
    if (generated[i] <= generated[i - 1]) {
      generated[i] = generated[i - 1] + getMinimumIncrement(generated[i - 1]);
    }
  }
  generated[generated.length - 1] = maximumPrize;
  return generated;
}

function smartRound(value) {
  if (value < 0.01) return 0.01;
  if (value < 1) return Math.round(value * 100) / 100;
  return Math.round(value);
}

function smartRoundOffer(value) {
  if (value < 0.01) return 0.01;
  if (value < 1) return Math.round(value * 100) / 100;
  if (value < 10) return Math.round(value);
  if (value < 100) return Math.round(value);
  if (value < 1000) return Math.round(value / 10) * 10;
  if (value < 10000) return Math.round(value / 100) * 100;
  return Math.round(value / 1000) * 1000;
}

function getMinimumIncrement(value) {
  return value < 1 ? 0.01 : 1;
}

function createCases() {
  const results = shuffle([...CASE_RESULTS]);
  return results.map((result, index) => ({
    number: index + 1,
    result,
    opened: false,
  }));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderCases() {
  casesContainer.innerHTML = "";
  cases.forEach((gameCase) => {
    const button = document.createElement("button");
    button.className = "case";
    button.dataset.caseNumber = gameCase.number;

    if (gameCase.opened) {
      button.classList.add(
        "disabled",
        "revealed",
        resultClass(gameCase.result),
      );
      button.textContent = gameCase.result;
    } else {
      button.textContent = String(gameCase.number).padStart(2, "0");
      if (!gameOver && !waitingForDeal) {
        button.addEventListener("click", () => openCase(gameCase));
      }
    }
    casesContainer.appendChild(button);
  });
}

function resultClass(result) {
  return result.toLowerCase().replace(/\s+/g, "-");
}

async function openCase(gameCase) {
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
  await delay(700);

  gameCase.opened = true;
  openedCasesThisRound++;
  button.classList.remove("opening");
  button.classList.add("revealed", resultClass(gameCase.result));
  button.textContent = gameCase.result;

  const beforeIndex = currentPrizeIndex;
  const beforePrize = prizes[currentPrizeIndex];
  const result = gameCase.result;

  addLog({
    type: "CASE_OPENED",
    round,
    caseNumber: gameCase.number,
    result,
    prizeBefore: beforePrize,
    positionBefore: beforeIndex,
    strikesRemainingBefore: getStrikesRemaining(),
  });

  message.textContent = getResultMessage(result);
  await delay(1300);

  applyResult(result);
  renderMoneyBoard();
  updateGameInfo();
  updateCurrentPrizeDisplay();

  if (gameOver) return;

  await delay(350);

  if (openedCasesThisRound >= casesToOpen) {
    // Give the player time to see the final case result
    // and the updated prize position before the Banker appears.
    showBanker();
  } else {
    waitingForDeal = false;
    renderCases();

    const remaining = casesToOpen - openedCasesThisRound;
    instruction.textContent = `OPEN ${remaining} MORE CASE${remaining === 1 ? "" : "S"}`;
  }
}

function getResultMessage(result) {
  switch (result) {
    case "UP 1":
      return "UP 1! CLIMB ONE LEVEL.";
    case "UP 2":
      return "UP 2! CLIMB TWO LEVELS.";
    case "UP 3":
      return "UP 3! CLIMB THREE LEVELS.";
    case "DOWN 1":
      return "DOWN 1! DROP ONE LEVEL.";
    case "STRIKE":
      return "STRIKE! THE HIGHEST PRIZE IS STRUCK OUT.";
    default:
      return result;
  }
}

function applyResult(result) {
  if (result === "UP 1") currentPrizeIndex += 1;
  if (result === "UP 2") currentPrizeIndex += 2;
  if (result === "UP 3") currentPrizeIndex += 3;
  if (result === "DOWN 1") currentPrizeIndex -= 1;

  if (result === "STRIKE") {
    const strikesRemaining = getStrikesRemaining();
    const strikeNumber = 3 - strikesRemaining;

    // Third Strike = immediate game-ending loss.
    if (strikeNumber >= 3) {
      addLog({
        type: "STRIKE",
        round,
        strikeNumber: 3,
        strikesRemaining: 0,
        finalResult: "GAME OVER - 3RD STRIKE",
        winnings: 0,
      });
      loseOnThirdStrike();
      return;
    }

    if (prizes.length > 1) {
      const removedPrize = prizes.pop();
      addLog({
        type: "STRIKE",
        round,
        strikeNumber,
        removedPrize,
        newTopPrize: prizes[prizes.length - 1],
        strikesRemaining,
      });
    }
    if (currentPrizeIndex >= prizes.length)
      currentPrizeIndex = prizes.length - 1;
  }

  currentPrizeIndex = Math.max(
    0,
    Math.min(currentPrizeIndex, prizes.length - 1),
  );

  addLog({
    type: "PRIZE_POSITION_CHANGED",
    round,
    result,
    currentPrize: prizes[currentPrizeIndex],
    currentPrizeIndex,
    topPrize: prizes[prizes.length - 1],
    strikesRemaining: getStrikesRemaining(),
  });

  if (currentPrizeIndex === prizes.length - 1) {
    winTopPrize();
  }
}

function loseOnThirdStrike() {
  if (gameOver) return;

  gameOver = true;
  waitingForDeal = false;

  bankerSection.classList.add("hidden");
  bankerWaiting.classList.add("hidden");
  bankerOfferContent.classList.add("hidden");

  instruction.textContent = "THREE STRIKES!";
  message.textContent = "GAME OVER — YOU WIN $0.";

  updateGameInfo();
  updateCurrentPrizeDisplay();
  renderCases();

  addLog({
    type: "GAME_END",
    reason: "THIRD_STRIKE",
    winnings: 0,
    round,
    currentPrize: prizes[currentPrizeIndex],
    topPrize: prizes[prizes.length - 1],
  });

  showGameLogButton();
  newGameButton.classList.remove("hidden");
}

function winTopPrize() {
  if (gameOver) return;
  const winnings = prizes[currentPrizeIndex];
  gameOver = true;
  waitingForDeal = false;
  bankerSection.classList.add("hidden");
  instruction.textContent = "TOP PRIZE REACHED!";
  message.textContent = `YOU WIN ${formatMoney(winnings)}!`;
  renderCases();
  updateGameInfo();
  updateCurrentPrizeDisplay();

  addLog({
    type: "GAME_END",
    reason: "TOP_PRIZE_REACHED",
    winnings,
    round,
    currentPrize: winnings,
  });
  showGameLogButton();
  newGameButton.classList.remove("hidden");
}

function renderMoneyBoard() {
  leftMoneyBoard.innerHTML = "";
  rightMoneyBoard.innerHTML = "";
  const half = Math.ceil(prizes.length / 2);

  prizes.forEach((value, index) => {
    const element = document.createElement("div");
    element.className = "money-value";
    element.dataset.value = value;
    if (index === currentPrizeIndex) element.classList.add("current-prize");

    const formatted = formatMoney(value).replace("$", "");
    element.innerHTML = `<span class="money-symbol">$</span><span class="money-amount">${formatted}</span>`;

    if (index < half) leftMoneyBoard.appendChild(element);
    else rightMoneyBoard.appendChild(element);
  });
}

function updateCurrentPrizeDisplay() {
  if (!prizes.length) return;
  currentPrizeElement.textContent = formatMoney(prizes[currentPrizeIndex]);
  topPrizeElement.textContent = formatMoney(prizes[prizes.length - 1]);
  strikesRemainingElement.textContent = getStrikesRemaining();
}

function updateGameInfo() {
  roundNumber.textContent = round;
  casesLeftElement.textContent = cases.filter(
    (gameCase) => !gameCase.opened,
  ).length;
  updateCurrentPrizeDisplay();
}

function getStrikesRemaining() {
  return cases.filter(
    (gameCase) => !gameCase.opened && gameCase.result === "STRIKE",
  ).length;
}

async function showBanker() {
  waitingForDeal = true;
  const normalOffer = calculateBankerOffer();
  const buyoutAvailable = getStrikesRemaining() === 1;
  const offer = buyoutAvailable
    ? calculateBuyoutOffer(normalOffer)
    : normalOffer;

  bankerOffer.textContent = formatMoney(offer);
  bankerSection.classList.remove("hidden");
  bankerWaiting.classList.remove("hidden");
  bankerOfferContent.classList.add("hidden");

  instruction.textContent = buyoutAvailable
    ? "THE BANKER HAS A SPECIAL OFFER"
    : "THE BANKER IS CALLING...";
  message.textContent = buyoutAvailable
    ? "ONE STRIKE REMAINS. THE BANKER WANTS TO BUY YOU OUT."
    : "PLEASE WAIT FOR THE BANKER'S OFFER.";

  addLog({
    type: buyoutAvailable ? "BANKER_BUYOUT" : "BANKER_OFFER",
    round,
    offer,
    normalOffer,
    buyoutAvailable,
    currentPrize: prizes[currentPrizeIndex],
    topPrize: prizes[prizes.length - 1],
    strikesRemaining: getStrikesRemaining(),
    unopenedCases: cases
      .filter((gameCase) => !gameCase.opened)
      .map((gameCase) => ({
        caseNumber: gameCase.number,
        result: gameCase.result,
      })),
  });

  await delay(1600);
  bankerWaiting.classList.add("hidden");
  bankerOfferContent.classList.remove("hidden");

  const title = bankerOfferContent.querySelector(".banker-title");
  if (title)
    title.textContent = buyoutAvailable ? "BANKER BUYOUT" : "BANK OFFER";

  const buttons = bankerOfferContent.querySelector(".deal-buttons");
  if (buttons) {
    buttons.classList.toggle("buyout-buttons", buyoutAvailable);
  }

  message.textContent = buyoutAvailable
    ? "TAKE THE BUYOUT OR KEEP CLIMBING."
    : "WILL YOU TAKE THE DEAL?";
}

function calculateBuyoutOffer(normalOffer) {
  const expectedValue = calculateExpectedValue();
  const generous = normalOffer * 1.35;
  const capped = expectedValue * 0.95;
  return smartRoundOffer(Math.max(normalOffer, Math.min(generous, capped)));
}

function calculateExpectedValue() {
  if (!prizes.length) return 0;
  return prizes.reduce((sum, value) => sum + value, 0) / prizes.length;
}

function calculateBankerOffer() {
  if (!prizes.length) return 0;

  /*
     3 STRIKES BANKER LOGIC
     -----------------------
     Unlike normal Deal or No Deal, there is no case value to protect.
     The contestant's CURRENT POSITION is the amount they have effectively
     climbed to, so the Banker offer must be anchored to that position.

     We calculate a one-step positional expected value from the actual
     unopened UP / DOWN / STRIKE results. This keeps the existing round,
     risk and case-count offer structure, while making the offer respond
     directly to where the contestant currently sits on the board.
  */

  const currentPrize = prizes[currentPrizeIndex];
  const topPrize = prizes[prizes.length - 1];
  const remainingCases = cases.filter((gameCase) => !gameCase.opened);
  const casesRemaining = remainingCases.length;

  if (!currentPrize || !casesRemaining) return currentPrize || 0;

  /* ---------------------------------------------------------
     Calculate the expected prize after one random unopened case.
     This is based on the player's CURRENT POSITION, not the
     average value of the money board.
  --------------------------------------------------------- */
  let positionalTotal = 0;

  remainingCases.forEach((gameCase) => {
    let simulatedIndex = currentPrizeIndex;
    let simulatedPrizes = prizes;

    if (gameCase.result === "UP 1") {
      simulatedIndex += 1;
    } else if (gameCase.result === "UP 2") {
      simulatedIndex += 2;
    } else if (gameCase.result === "UP 3") {
      simulatedIndex += 3;
    } else if (gameCase.result === "DOWN 1") {
      simulatedIndex -= 1;
    } else if (gameCase.result === "STRIKE") {
      // A Strike removes the current highest prize.
      // If the current position was that prize, it falls to the new top.
      simulatedPrizes = prizes.slice(0, -1);
      simulatedIndex = Math.min(simulatedIndex, simulatedPrizes.length - 1);
    }

    simulatedIndex = Math.max(
      0,
      Math.min(simulatedIndex, simulatedPrizes.length - 1),
    );

    positionalTotal += simulatedPrizes[simulatedIndex];
  });

  const positionalExpectedValue = positionalTotal / casesRemaining;

  /* ---------------------------------------------------------
     How much upside remains from the player's position?
  --------------------------------------------------------- */
  const upsideRatio = currentPrize > 0 ? topPrize / currentPrize : 1;

  /* ---------------------------------------------------------
     Existing round structure retained from the original game.
  --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     Risk factor.

     Here the risk is based on how far the player is from the
     current top prize. A huge gap means the Banker is safer and
     can offer less aggressively. A player already near the top
     receives a stronger offer.
  --------------------------------------------------------- */
  let riskFactor;

  if (upsideRatio >= 100000) {
    riskFactor = 0.82;
  } else if (upsideRatio >= 100) {
    riskFactor = 0.86;
  } else if (upsideRatio >= 20) {
    riskFactor = 0.9;
  } else if (upsideRatio >= 5) {
    riskFactor = 0.96;
  } else if (upsideRatio >= 2) {
    riskFactor = 1.0;
  } else {
    riskFactor = 1.05;
  }

  /* ---------------------------------------------------------
     Case-count factor retained from the normal Banker logic.
  --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     Blend the player's guaranteed current position with the
     positional expected value.

     As the game gets later, the offer relies increasingly on
     the current position itself. This prevents a low current
     position from receiving an absurdly large offer simply
     because the board still contains a large jackpot.
  --------------------------------------------------------- */
  const positionWeight = 0.65 + roundFactor * 0.25;
  const futureWeight = 1 - positionWeight;

  let offerBase =
    currentPrize * positionWeight + positionalExpectedValue * futureWeight;

  /* Existing Banker modifiers. */
  let offer = offerBase * roundFactor * riskFactor * caseFactor;

  /* Small Banker-to-Banker variation. */
  offer *= 0.95 + Math.random() * 0.1;

  /*
     Keep the offer meaningful relative to the player's current
     position. It can be generous, but it should not become an
     unrelated jackpot-sized number while the player is still low.
  */
  const minimumOffer = currentPrize * Math.max(0.1, roundFactor * 0.5);
  const maximumPositionOffer =
    Math.max(currentPrize, positionalExpectedValue) *
    (0.75 + roundFactor * 0.55);

  offer = Math.max(offer, minimumOffer);
  offer = Math.min(offer, maximumPositionOffer);

  offer = smartRoundOffer(offer);

  return Math.max(0.01, offer);
}

function takeDeal() {
  if (gameOver) return;
  const offer = Number(bankerOffer.textContent.replace(/[$,]/g, ""));
  const buyout = getStrikesRemaining() === 1;

  addLog({
    type: buyout ? "BUYOUT_ACCEPTED" : "DEAL",
    round,
    amount: offer,
    currentPrize: prizes[currentPrizeIndex],
  });

  gameOver = true;
  waitingForDeal = false;
  bankerSection.classList.add("hidden");
  instruction.textContent = buyout ? "BUYOUT ACCEPTED!" : "DEAL!";
  message.textContent = buyout
    ? `YOU ACCEPTED THE BUYOUT: ${formatMoney(offer)}!`
    : `YOU ACCEPTED ${formatMoney(offer)}!`;

  addLog({
    type: "GAME_END",
    reason: buyout ? "BUYOUT" : "DEAL",
    winnings: offer,
    currentPrize: prizes[currentPrizeIndex],
  });
  showGameLogButton();
  newGameButton.classList.remove("hidden");
}

function continueGame() {
  if (gameOver) return;

  addLog({
    type: getStrikesRemaining() === 1 ? "BUYOUT_REJECTED" : "NO_DEAL",
    round,
    offer: Number(bankerOffer.textContent.replace(/[$,]/g, "")),
    currentPrize: prizes[currentPrizeIndex],
    strikesRemaining: getStrikesRemaining(),
  });

  waitingForDeal = false;
  bankerSection.classList.add("hidden");
  bankerWaiting.classList.add("hidden");
  bankerOfferContent.classList.add("hidden");
  message.textContent = "NO DEAL! KEEP CLIMBING.";
  openedCasesThisRound = 0;
  round++;

  if (round > ROUND_CASES.length) {
    finishAfterFinalRound();
    return;
  }

  casesToOpen = ROUND_CASES[round - 1];
  instruction.textContent = `OPEN ${casesToOpen} CASE${casesToOpen === 1 ? "" : "S"}`;
  updateGameInfo();
}

function finishAfterFinalRound() {
  gameOver = true;
  waitingForDeal = false;
  const winnings = prizes[currentPrizeIndex];
  instruction.textContent = "GAME COMPLETE";
  message.textContent = `FINAL PRIZE: ${formatMoney(winnings)}!`;

  addLog({
    type: "GAME_END",
    reason: "FINAL_ROUND_COMPLETE",
    winnings,
    currentPrize: winnings,
    topPrize: prizes[prizes.length - 1],
  });
  showGameLogButton();
  newGameButton.classList.remove("hidden");
  renderCases();
}

function addLog(event) {
  gameLog.push({ timestamp: new Date(), ...event });
}

function formatMoney(value) {
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: value < 1 && value !== Math.floor(value) ? 2 : 0,
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

function generateGameLog() {
  let output = "";
  output += "========================================\n";
  output += "       DEAL OR NO DEAL - 3 STRIKES\n";
  output += "========================================\n\n";

  const start = gameLog.find((e) => e.type === "GAME_START");
  output += `Game Date: ${start ? start.date : "Unknown"}\n`;
  output += `Maximum Prize: ${start ? formatMoney(start.maximumPrize) : "Unknown"}\n`;
  output +=
    "Case Distribution: 14 UP 1 | 4 UP 2 | 2 UP 3 | 3 DOWN 1 | 3 STRIKE\n\n";

  if (start?.prizeBoard) {
    output += "PRIZE BOARD\n----------------------------------------\n";
    start.prizeBoard.forEach((v) => (output += `${formatMoney(v)}\n`));
    output += "\n";
  }

  const rounds = {};
  gameLog.forEach((event) => {
    if (!event.round) return;
    (rounds[event.round] ||= []).push(event);
  });

  Object.keys(rounds)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((r) => {
      output += "========================================\n";
      output += `ROUND ${r}\n`;
      output += "========================================\n\n";

      rounds[r]
        .filter((e) => e.type === "CASE_OPENED")
        .forEach((e) => {
          output += `Case #${e.caseNumber} → ${e.result} | Prize before: ${formatMoney(e.prizeBefore)}\n`;
        });

      rounds[r]
        .filter((e) => e.type === "PRIZE_POSITION_CHANGED")
        .forEach((e) => {
          output += `After ${e.result}: Current Prize ${formatMoney(e.currentPrize)} | Top Prize ${formatMoney(e.topPrize)} | Strikes Remaining: ${e.strikesRemaining}\n`;
        });

      rounds[r]
        .filter((e) => e.type === "STRIKE")
        .forEach((e) => {
          if (e.strikeNumber === 3) {
            output += "STRIKE #3: GAME OVER — PLAYER WINS $0\n";
          } else {
            output += `STRIKE #${e.strikeNumber}: ${formatMoney(e.removedPrize)} removed | New Top Prize: ${formatMoney(e.newTopPrize)}\n`;
          }
        });

      rounds[r]
        .filter((e) => e.type === "BANKER_OFFER" || e.type === "BANKER_BUYOUT")
        .forEach((e) => {
          output += `${e.type === "BANKER_BUYOUT" ? "BANKER BUYOUT" : "Banker's Offer"}: ${formatMoney(e.offer)}\n`;
          if (e.normalOffer != null && e.type === "BANKER_BUYOUT")
            output += `Normal Offer Before Buyout: ${formatMoney(e.normalOffer)}\n`;
          output += `Current Prize: ${formatMoney(e.currentPrize)} | Top Prize: ${formatMoney(e.topPrize)} | Strikes Remaining: ${e.strikesRemaining}\n`;
          if (e.unopenedCases?.length) {
            output += "Unopened Cases and Results:\n";
            e.unopenedCases.forEach(
              (c) => (output += `Case #${c.caseNumber} → ${c.result}\n`),
            );
          }
        });

      rounds[r]
        .filter((e) =>
          ["DEAL", "BUYOUT_ACCEPTED", "BUYOUT_REJECTED", "NO_DEAL"].includes(
            e.type,
          ),
        )
        .forEach((e) => {
          if (e.type === "DEAL")
            output += `Decision: DEAL → ${formatMoney(e.amount)}\n`;
          if (e.type === "BUYOUT_ACCEPTED")
            output += `Decision: BUYOUT ACCEPTED → ${formatMoney(e.amount)}\n`;
          if (e.type === "BUYOUT_REJECTED")
            output += "Decision: BUYOUT REJECTED / NO DEAL\n";
          if (e.type === "NO_DEAL") output += "Decision: NO DEAL\n";
        });
      output += "\n";
    });

  output +=
    "========================================\nFINAL RESULT\n========================================\n\n";
  const end = [...gameLog].reverse().find((e) => e.type === "GAME_END");
  if (end) {
    output += `Reason: ${end.reason}\n`;
    output += `Winnings: ${formatMoney(end.winnings)}\n`;
    if (end.currentPrize != null)
      output += `Final Current Prize: ${formatMoney(end.currentPrize)}\n`;
    if (end.topPrize != null)
      output += `Final Top Prize: ${formatMoney(end.topPrize)}\n`;
  }
  output +=
    "\n========================================\n              END OF GAME\n========================================\n";
  return output;
}

function downloadGameLog() {
  const blob = new Blob([generateGameLog()], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const now = new Date();
  link.href = url;
  link.download = `DealOrNoDeal_3Strikes_GameLog_${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, "-")}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showGameLogButton() {
  let logButton = document.getElementById("downloadLogButton");
  if (!logButton) {
    logButton = document.createElement("button");
    logButton.id = "downloadLogButton";
    logButton.textContent = "DOWNLOAD GAME LOG";
    logButton.className = "download-log-button";
    logButton.addEventListener("click", downloadGameLog);
    newGameButton.parentElement.appendChild(logButton);
  }
  logButton.classList.remove("hidden");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
