let allCards = [];
let cards = [];

let selectedCard = null;
let selectedIndex = null;
let hasConfirmed = false;

let selectedidnttCollections = JSON.parse(
  localStorage.getItem("selectedidnttCollections") || "[]",
);

const tryAgainBtn = document.getElementById("try-again-btn");
if (tryAgainBtn) {
  tryAgainBtn.style.display = "none";
}

const toggleBtn = document.getElementById("toggleCollectionsBtn");
const collectionsContainer = document.getElementById("collectionsContainer");

toggleBtn.addEventListener("click", () => {
  const visible = collectionsContainer.style.display === "block";

  collectionsContainer.style.display = visible ? "none" : "block";

  toggleBtn.textContent = visible
    ? "📂 Show Collections"
    : "📂 Hide Collections";
});

async function loadCollections() {
  try {
    const response = await fetch("json/allidntt.json");
    allCards = await response.json();

    const collections = [
      ...new Set(allCards.map((card) => card.collection).filter(Boolean)),
    ];

    const groups = {};

    collections.forEach((collection) => {
      let prefix;

      prefix = collection.substring(0, 8).toUpperCase();

      if (!groups[prefix]) {
        groups[prefix] = [];
      }

      groups[prefix].push(collection);
    });

    const tabContainer = document.getElementById("collectionTabs");

    tabContainer.innerHTML = "";

    Object.keys(groups).forEach((prefix) => {
      const tab = document.createElement("button");

      tab.textContent = prefix;
      tab.className = "collection-tab";

      tab.addEventListener("click", () => {
        renderCollectionGroup(prefix, groups[prefix]);
      });

      tabContainer.appendChild(tab);
    });

    const firstKey = Object.keys(groups)[0];

    if (firstKey) {
      renderCollectionGroup(firstKey, groups[firstKey]);
    }
  } catch (error) {
    console.error("Failed to load collections:", error);
  }
}

function renderCollectionGroup(prefix, collectionList) {
  const grid = document.getElementById("collectionGrid");

  grid.innerHTML = "";

  collectionList.forEach((collection) => {
    const btn = document.createElement("button");

    btn.textContent = collection;
    btn.className = "collection-btn";

    if (selectedidnttCollections.includes(collection)) {
      btn.classList.add("selected");
    }

    btn.addEventListener("click", () => {
      if (selectedidnttCollections.includes(collection)) {
        selectedidnttCollections = selectedidnttCollections.filter(
          (c) => c !== collection,
        );

        btn.classList.remove("selected");
      } else {
        selectedidnttCollections.push(collection);
        btn.classList.add("selected");
      }

      updateTabHighlights();
      updateselectedidnttCollectionsMessage();
    });

    grid.appendChild(btn);
  });

  updateTabHighlights();
  updateselectedidnttCollectionsMessage();
}

function updateselectedidnttCollectionsMessage() {
  const msg = document.getElementById("selectedidnttCollectionsMsg");

  if (!msg) return;

  if (!selectedidnttCollections.length) {
    msg.textContent = "No collections selected.";
    return;
  }

  msg.textContent = "Selected collections: " + selectedidnttCollections.join(", ");
}

function updateTabHighlights() {
  const tabs = document.querySelectorAll(".collection-tab");

  tabs.forEach((tab) => {
    const prefix = tab.textContent;

    const anySelected = selectedidnttCollections.some((collection) => {
      if (prefix === "AA") {
        return collection.startsWith("AA");
      }

      if (prefix === "BB") {
        return collection.startsWith("BB");
      }

      if (prefix === "CC") {
        return collection.startsWith("CC");
      }

      return (
        collection.startsWith(prefix) &&
        !collection.startsWith("AA") &&
        !collection.startsWith("BB") &&
        !collection.startsWith("CC")
      );
    });

    tab.classList.toggle("active", anySelected);
  });
}

document.getElementById("saveCollectionBtn").addEventListener("click", () => {
  localStorage.setItem(
    "selectedidnttCollections",
    JSON.stringify(selectedidnttCollections),
  );

  generateRandomSet();
  displayCards();

  alert("✅ Collection selections saved!");
  location.reload();
});

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }
}

function shuffleAndPick(array, count) {
  const shuffled = [...array];
  shuffleArray(shuffled);
  return shuffled.slice(0, count);
}

function generateRandomSet() {
  if (!selectedidnttCollections.length) {
    cards = [];
    return;
  }

  const filteredCards = allCards.filter(
    (card) =>
      card.collection &&
      selectedidnttCollections.some(
        (selected) =>
          selected.trim().toLowerCase() ===
          card.collection.trim().toLowerCase(),
      ),
  );

  let selectedCards = [];

  if (filteredCards.length >= 16) {
    const failCount = Math.floor(Math.random() * 2) + 1;

    const normalCount = 16 - failCount;

    const pickedNormal = shuffleAndPick(filteredCards, normalCount);

    const failCards = Array.from({ length: failCount }, () => ({
      name: "Fail",
      group: "Fail",
      image: "images/fail.png",
      video: "",
    }));

    selectedCards = [...pickedNormal, ...failCards];
  } else {
    selectedCards = [...filteredCards];

    const missing = 16 - selectedCards.length;

    for (let i = 0; i < missing; i++) {
      selectedCards.push({
        name: "Fail",
        group: "Fail",
        image: "images/fail.png",
        video: "",
      });
    }
  }

  shuffleArray(selectedCards);

  cards = selectedCards;
}

function displayCards() {
  const container = document.getElementById("card-container");

  container.innerHTML = "";

  cards.forEach((card, index) => {
    const cardElement = document.createElement("div");

    cardElement.className = "card";
    cardElement.dataset.revealed = "false";

    if (selectedIndex === index) {
      cardElement.classList.add("selected");
    }

    if (hasConfirmed) {
      cardElement.classList.add("disabled");
    }

    cardElement.onclick = () => selectCard(index);

    const placeholder = document.createElement("img");

    placeholder.src = "images/spincard.png";

    placeholder.className = "placeholder";

    cardElement.appendChild(placeholder);

    const image = document.createElement("img");

    image.src = card.image;
    image.alt = card.name;
    image.className = "card-image";
    image.style.display = "none";

    cardElement.appendChild(image);

    container.appendChild(cardElement);
  });
}

function selectCard(index) {
  if (hasConfirmed) return;

  document
    .querySelectorAll(".card")
    .forEach((card) => card.classList.remove("selected"));

  selectedCard = cards[index];
  selectedIndex = index;

  document.querySelectorAll(".card")[index].classList.add("selected");
}

function revealCard() {
  if (selectedIndex === null) return;
  if (hasConfirmed) return;

  hasConfirmed = true;

  document
    .querySelectorAll(".card")
    .forEach((card) => card.classList.add("disabled"));

  RevealEngine.reveal(
    selectedCard,
    document.getElementById("spinStatus"),
    document.getElementById("spinResult"),
    {
      revealAllFn: revealAll,
    },
  );
}

function revealAll() {
  document.querySelectorAll(".card").forEach((cardEl, index) => {
    if (cardEl.dataset.revealed === "true") {
      return;
    }

    const placeholder = cardEl.querySelector(".placeholder");

    if (placeholder) {
      placeholder.style.display = "none";
    }

    const card = cards[index];

    if (index === selectedIndex && card.video && card.video.trim() !== "") {
      const thumbnail = document.createElement("img");
      thumbnail.src = card.image; // or poster image
      thumbnail.className = "card-image";
      cardEl.appendChild(thumbnail);
    } else {
      const image = cardEl.querySelector(".card-image");

      if (image) {
        image.style.display = "block";
      }
    }

    if (index === selectedIndex) {
      const tag = document.createElement("div");

      tag.className = "get-tag";
      tag.textContent = "Get";

      cardEl.appendChild(tag);
    }

    cardEl.dataset.revealed = "true";
  });

  // Swap buttons
  const confirmBtn = document.getElementById("confirm-btn");

  const tryAgainBtn = document.getElementById("try-again-btn");

  if (confirmBtn) {
    confirmBtn.style.display = "none";
  }

  if (tryAgainBtn) {
    tryAgainBtn.style.display = "inline-block";
  }
}

function tryAgain() {
  selectedCard = null;
  selectedIndex = null;
  hasConfirmed = false;

  document.getElementById("spinStatus").textContent = "";

  document.getElementById("spinResult").textContent = "Select an Objekt";

  const confirmBtn = document.getElementById("confirm-btn");

  const tryAgainBtn = document.getElementById("try-again-btn");

  if (confirmBtn) {
    confirmBtn.style.display = "inline-block";
  }

  if (tryAgainBtn) {
    tryAgainBtn.style.display = "none";
  }

  generateRandomSet();
  displayCards();
}

window.onload = async () => {
  await loadCollections();

  if (selectedidnttCollections.length > 0) {
    generateRandomSet();
    displayCards();
  }

  updateselectedidnttCollectionsMessage();
};
