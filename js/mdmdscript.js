const CFG = {
  STARTING_BANK: 1000000,
  QUESTION_TIME: 60,
  QUESTIONS_PER_GAME: 6,
  MAX_FUNDED_ANSWERS: 2,
  STACKS: [25000, 50000, 75000, 100000, 250000, 500000]
};

let questions = [];
let gameQuestions = [];
let qIndex = 0;
let bank = CFG.STARTING_BANK;
let team = "PLAYER";
let timer = null;
let timeLeft = CFG.QUESTION_TIME;
let unplaced = bank;
let placed = [0, 0, 0];
let selectedStackValue = 0;

const $ = id => document.getElementById(id);
const fmt = n => "$" + Math.max(0, Math.round(n)).toLocaleString("en-GB");

const screens = {
  start: $("startScreen"),
  game: $("gameScreen"),
  reveal: $("revealScreen"),
  end: $("endScreen")
};

function show(screen) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadQuestions() {
  try {
    const response = await fetch("questions.json");
    if (!response.ok) throw new Error("questions.json could not be loaded");
    questions = await response.json();
  } catch (error) {
    questions = [
      {question:"Which planet is known as the Red Planet?",answers:["Venus","Mars","Jupiter"],correct:1},
      {question:"Which country is home to Barcelona?",answers:["Portugal","Italy","Spain"],correct:2},
      {question:"Which animal is the largest living land animal?",answers:["African elephant","Giraffe","Hippopotamus"],correct:0},
      {question:"Who painted the Mona Lisa?",answers:["Van Gogh","Leonardo da Vinci","Picasso"],correct:1},
      {question:"Which city was formerly called Constantinople?",answers:["Athens","Istanbul","Alexandria"],correct:1},
      {question:"Which element has the chemical symbol Au?",answers:["Silver","Copper","Gold"],correct:2}
    ];
  }
}

function prepareGameQuestions() {
  if (questions.length < CFG.QUESTIONS_PER_GAME) {
    throw new Error(
      `You need at least ${CFG.QUESTIONS_PER_GAME} questions in questions.json.`
    );
  }

  return shuffle(questions)
    .slice(0, CFG.QUESTIONS_PER_GAME)
    .map(q => {
      const answerObjects = q.answers.map((text, index) => ({
        text,
        correct: index === q.correct
      }));

      const randomized = shuffle(answerObjects);

      return {
        ...q,
        answers: randomized.map(a => a.text),
        correct: randomized.findIndex(a => a.correct)
      };
    });
}

function resetGame() {
  qIndex = 0;
  bank = CFG.STARTING_BANK;
  unplaced = bank;
  placed = [0, 0, 0];
  selectedStackValue = 0;
  $("nextBtn").dataset.gameOver = "false";
  updateHud();
}

function updateHud() {
  $("teamDisplay").textContent = team;
  $("bankDisplay").textContent = fmt(bank);
  $("qNo").textContent = qIndex + 1;
  $("qTotal").textContent = gameQuestions.length;
  $("qTag").textContent = qIndex + 1;
  $("progress").style.width =
    (qIndex / gameQuestions.length) * 100 + "%";

  $("unplaced").textContent = fmt(unplaced);
  $("placed").textContent = fmt(placed.reduce((a, b) => a + b, 0));
}

function render() {
  const q = gameQuestions[qIndex];

  $("questionText").textContent = q.question;
  updateHud();

  const gates = $("gates");
  gates.innerHTML = "";

  q.answers.forEach((answer, i) => {
    const gate = document.createElement("div");
    gate.className = "gate";
    gate.dataset.index = i;

    gate.innerHTML = `
      <div class="gate-header">
        <div class="gate-letter">${String.fromCharCode(65 + i)}</div>
        <div class="gate-answer">${answer}</div>
      </div>
      <div class="gate-door">
        <div class="gate-money"></div>
      </div>
      <div class="gate-total">$0</div>
    `;

    gate.addEventListener("dragover", event => {
      event.preventDefault();
      gate.classList.add("dragover");
    });

    gate.addEventListener("dragleave", () => {
      gate.classList.remove("dragover");
    });

    gate.addEventListener("drop", event => {
      event.preventDefault();
      gate.classList.remove("dragover");

      if (selectedStackValue > 0) {
        placeMoney(i, selectedStackValue);
      }
    });

    // Mobile/click placement:
    gate.addEventListener("click", () => {
      if (selectedStackValue > 0) {
        placeMoney(i, selectedStackValue);
      }
    });

    gates.appendChild(gate);
  });

  renderStacks();
  renderPlaced();
  startTimer();
}

function renderStacks() {
  const wrap = $("stacks");
  wrap.innerHTML = "";

  CFG.STACKS
    .filter(value => value <= unplaced)
    .forEach(value => {
      const stack = document.createElement("div");
      stack.className = "money-stack";
      stack.draggable = true;
      stack.textContent = fmt(value);

      stack.addEventListener("dragstart", () => {
        selectedStackValue = value;
      });

      stack.addEventListener("dragend", () => {
        selectedStackValue = 0;
      });

      stack.addEventListener("click", () => {
        selectedStackValue = value;

        document.querySelectorAll(".money-stack").forEach(s => {
          s.style.outline = "";
        });

        stack.style.outline = "3px solid white";
      });

      wrap.appendChild(stack);
    });
}

function fundedAnswerCount() {
  return placed.filter(amount => amount > 0).length;
}

function placeMoney(answerIndex, amount) {
  if (!amount || amount > unplaced) return;

  // A third funded answer is never allowed.
  if (placed[answerIndex] === 0 &&
      fundedAnswerCount() >= CFG.MAX_FUNDED_ANSWERS) {
    showPlacementMessage(
      `You can only place money on ${CFG.MAX_FUNDED_ANSWERS} answers.`
    );
    return;
  }

  placed[answerIndex] += amount;
  unplaced -= amount;
  selectedStackValue = 0;

  renderStacks();
  renderPlaced();
  updateHud();

  $("lockBtn").disabled =
    placed.reduce((a, b) => a + b, 0) <= 0;
}

function renderPlaced() {
  document.querySelectorAll(".gate").forEach((gate, i) => {
    const moneyArea = gate.querySelector(".gate-money");
    moneyArea.innerHTML = "";

    const count = Math.min(12, Math.ceil(placed[i] / 50000));

    for (let n = 0; n < count; n++) {
      const stack = document.createElement("div");
      stack.className = "stack-placed";
      stack.textContent = n === 0 ? fmt(placed[i]) : "";
      moneyArea.appendChild(stack);
    }

    gate.querySelector(".gate-total").textContent = fmt(placed[i]);
  });
}

function showPlacementMessage(message) {
  const help = document.querySelector(".drag-help");
  if (!help) return;

  const original = help.textContent;
  help.textContent = message;
  help.style.color = "#ffd33d";

  setTimeout(() => {
    help.textContent = original;
    help.style.color = "";
  }, 1800);
}

/*
  This lets the player move money between answers.

  Example:
  A $600,000
  B $400,000
  C $0

  Return $100,000 from B, then place $100,000 on C.
  The two-funded-answer limit is enforced throughout.
*/
function returnFromGate(index) {
  if (placed[index] <= 0) return;

  unplaced += placed[index];
  placed[index] = 0;

  renderStacks();
  renderPlaced();
  updateHud();

  $("lockBtn").disabled =
    placed.reduce((a, b) => a + b, 0) <= 0;
}

function startTimer() {
  clearInterval(timer);

  timeLeft = CFG.QUESTION_TIME;
  $("clock").textContent = timeLeft;
  $("clock").classList.remove("warning");

  timer = setInterval(() => {
    timeLeft--;
    $("clock").textContent = timeLeft;

    if (timeLeft <= 10) {
      $("clock").classList.add("warning");
    }

    if (timeLeft <= 0) {
      clearInterval(timer);

      if (placed.some(amount => amount > 0)) {
        lockIn();
      } else {
        finish(0, "Time ran out before any money was placed.");
      }
    }
  }, 1000);
}

function returnAllMoney() {
  unplaced += placed.reduce((a, b) => a + b, 0);
  placed = [0, 0, 0];
  selectedStackValue = 0;

  renderStacks();
  renderPlaced();
  updateHud();

  $("lockBtn").disabled = true;
}

function lockIn() {
  clearInterval(timer);
  $("lockBtn").disabled = true;
  $("clearBtn").disabled = true;

  const q = gameQuestions[qIndex];

  show(screens.reveal);

  $("correctAnswer").textContent = q.answers[q.correct];

  const revealGates = $("revealGates");
  revealGates.innerHTML = "";

  q.answers.forEach((answer, i) => {
    const gate = document.createElement("div");
    gate.className =
      "reveal-gate " + (i === q.correct ? "correct" : "wrong");

    gate.innerHTML = `
      <div class="rg-answer">
        ${String.fromCharCode(65 + i)} — ${answer}
      </div>
      <div class="reveal-stack"></div>
    `;

    revealGates.appendChild(gate);
  });

  $("revealText").textContent = "Opening the gates...";
  $("revealBank").textContent = "";
  $("nextBtn").hidden = true;

  setTimeout(() => revealResult(q), 1000);
}

function revealResult(q) {
  const oldPlaced = placed.slice();

  bank = oldPlaced[q.correct] || 0;

  document.querySelectorAll(".reveal-gate").forEach((gate, i) => {
    if (oldPlaced[i] > 0) {
      const stack = document.createElement("div");
      stack.className =
        "stack-placed " + (i === q.correct ? "" : "falling");

      stack.style.marginTop = "20px";
      stack.textContent = fmt(oldPlaced[i]);

      gate.querySelector(".reveal-stack").appendChild(stack);
    }
  });

  setTimeout(() => {
    $("revealText").textContent =
      bank > 0
        ? `You kept ${fmt(bank)}!`
        : "Oh no! You lost everything.";

    $("revealBank").textContent = "BANK: " + fmt(bank);

    $("nextBtn").hidden = false;

    // If the player's bank is $0 after this question,
    // the game ends immediately instead of continuing.
    if (bank <= 0) {
      $("nextBtn").textContent = "SEE RESULT";
      $("nextBtn").dataset.gameOver = "true";
    } else {
      $("nextBtn").textContent =
        qIndex === gameQuestions.length - 1
          ? "SEE RESULT"
          : "NEXT QUESTION";
      $("nextBtn").dataset.gameOver = "false";
    }
  }, 1200);
}

function next() {
  $("nextBtn").hidden = true;

  // Bank reaching $0 means the game is over immediately.
  if (bank <= 0) {
    finish(0, "Your bank reached $0. Game over!");
    return;
  }

  if (qIndex === gameQuestions.length - 1) {
    finish(
      bank,
      "Congratulations — you completed the game!"
    );
    return;
  }

  qIndex++;
  unplaced = bank;
  placed = [0, 0, 0];
  selectedStackValue = 0;

  $("clearBtn").disabled = false;

  show(screens.game);
  render();
}

function finish(amount, message) {
  clearInterval(timer);

  $("progress").style.width = "100%";
  $("endTitle").textContent =
    amount > 0 ? "CONGRATULATIONS!" : "GAME OVER";

  $("endTeam").textContent = team;
  $("finalBank").textContent = fmt(amount);
  $("endMessage").textContent = message;

  show(screens.end);
}

$("startBtn").onclick = async () => {
  team = $("teamName").value.trim() || "PLAYER";

  await loadQuestions();

  try {
    gameQuestions = prepareGameQuestions();
  } catch (error) {
    alert(error.message);
    return;
  }

  resetGame();
  show(screens.game);

  $("clearBtn").disabled = false;

  render();
};

$("lockBtn").onclick = lockIn;
$("clearBtn").onclick = returnAllMoney;
$("nextBtn").onclick = next;

$("restartBtn").onclick = async () => {
  await loadQuestions();

  try {
    // A new random selection is generated every time a new game starts.
    gameQuestions = prepareGameQuestions();
  } catch (error) {
    alert(error.message);
    return;
  }

  resetGame();
  show(screens.game);
  $("clearBtn").disabled = false;
  render();
};

load();

document.addEventListener("dblclick", event => {
  const gate = event.target.closest(".gate");
  if (!gate) return;

  const index = Number(gate.dataset.index);
  if (placed[index] > 0) {
    returnFromGate(index);
    showPlacementMessage("Money returned from this answer.");
  }
});
