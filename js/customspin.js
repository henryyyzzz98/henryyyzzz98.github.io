let cards = [];
let firstGroup = [];
let specialGroup = [];
let shopGroup = [];
let eventGroup = [];
let premierGroup = [];
let selectedCard = null;
let selectedIndex = null;
let hasConfirmed = false;

document.getElementById("reveal-all-btn").disabled = true;
document.getElementById("try-again-btn").disabled = true;

// Load saved settings from localStorage
let customCombination = JSON.parse(localStorage.getItem("customCombination") || "null");
let useCustomSettings = localStorage.getItem("useCustomSettings") === "true";

// Load card data from JSON file
async function loadCards() {
    try {
        const response = await fetch("json/allcards.json");
        const data = await response.json();
        cards = data;

        // Categorize cards
        firstGroup = cards.filter(card => card.group === "First");
        specialGroup = cards.filter(card => card.group === "Special");
        shopGroup = cards.filter(card => card.group === "Shop");
        eventGroup = cards.filter(card => card.group === "Event");
        premierGroup = cards.filter(card => card.group === "Premier");

        // Generate 16 cards
        generateRandomSet();
        displayCards();
    } catch (error) {
        console.error("Error loading cards:", error);
    }
}

// Weighted default combination
function getCombination() {
    if (useCustomSettings && customCombination) {
        return customCombination;
    }

    const rand = Math.random();
    if (rand < 0.60) return { first: 12, special: 1, shop: 1, event: 1, premier: 0, fail: 1 };
    else if (rand < 0.90) return { first: 12, special: 0, shop: 1, event: 1, premier: 0, fail: 2 };
    else if (rand < 0.97) return { first: 12, special: 0, shop: 0, event: 2, premier: 0, fail: 2 };
    else if (rand < 0.98) return { first: 12, special: 0, shop: 2, event: 0, premier: 1, fail: 1 };
    else if (rand < 0.99) return { first: 12, special: 0, shop: 1, event: 1, premier: 1, fail: 1 };
    else return { first: 12, special: 0, shop: 0, event: 2, premier: 1, fail: 1 };
}

function generateRandomSet() {
    const useCustom = localStorage.getItem("useCustomSettings") === "true";
    const savedCombo = JSON.parse(localStorage.getItem("customCombination") || "null");
    const selectedOption = (useCustom && savedCombo) ? savedCombo : getCombination();

    if (!selectedOption) {
        alert("Invalid settings — reverting to default combination.");
        return;
    }

    let selectedCards = [];

    // Pick "First" group cards
    selectedCards.push(...shuffleAndPick(firstGroup, selectedOption.first));

    // Pick "Special" group cards
    if (selectedOption.special > 0) {
        selectedCards.push(...shuffleAndPick(specialGroup, selectedOption.special));
    }

    // Pick "Shop" group cards
    if (selectedOption.shop > 0) {
        selectedCards.push(...shuffleAndPick(shopGroup, selectedOption.shop));
    }

    // Pick "Event" group cards
    if (selectedOption.event > 0) {
        selectedCards.push(...shuffleAndPick(eventGroup, selectedOption.event));
    }

    // Pick "Premier" group cards
    if (selectedOption.premier > 0) {
        selectedCards.push(...shuffleAndPick(premierGroup, selectedOption.premier));
    }

    // Add "Fail" cards
    for (let i = 0; i < selectedOption.fail; i++) {
        selectedCards.push({ name: "Fail", group: "Fail", image: "images/fail.png" });
    }

    // Validate total
    if (selectedCards.length !== 16) {
        alert(`⚠️ Invalid total objekt count (${selectedCards.length}). Must equal 16.`);
        return;
    }

    shuffleArray(selectedCards);
    cards = selectedCards;
}

function shuffleAndPick(array, count) {
    let shuffled = [...array];
    shuffleArray(shuffled);
    return shuffled.slice(0, count);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function displayCards() {
    const container = document.getElementById("card-container");
    container.innerHTML = "";

    cards.forEach((card, index) => {
        let cardElement = document.createElement("div");
        cardElement.classList.add("card");
        cardElement.onclick = () => selectCard(index);

        let placeholder = document.createElement("img");
        placeholder.classList.add("placeholder");
        placeholder.src = "images/spincard.png";
        placeholder.alt = "?";

        let image = document.createElement("img");
        image.classList.add("card-image");
        image.src = card.image;
        image.alt = card.name;
        image.style.display = "none";

        cardElement.appendChild(placeholder);
        cardElement.appendChild(image);
        container.appendChild(cardElement);
    });
}

function selectCard(index) {
    if (hasConfirmed) return;
    document.querySelectorAll(".card").forEach(card => card.classList.remove("selected"));
    selectedCard = cards[index];
    selectedIndex = index;
    document.querySelectorAll(".card")[index].classList.add("selected");
}

function revealCard() {
    document.getElementById("reveal-all-btn").disabled = false;
    document.getElementById("confirm-btn").disabled = true;
    document.getElementById("try-again-btn").disabled = false;

    if (selectedIndex === null) return;
    hasConfirmed = true;

    const selectedCardElement = document.querySelectorAll(".card")[selectedIndex];
    selectedCardElement.querySelector(".placeholder").style.display = "none";
    selectedCardElement.querySelector(".card-image").style.display = "block";

    const getTag = document.createElement("div");
    getTag.classList.add("get-tag");
    getTag.textContent = "Get";
    selectedCardElement.appendChild(getTag);

    const spinStatus = document.getElementById("spinStatus");
    const spinResult = document.getElementById("spinResult");

    if (selectedCard.name === "Fail") {
        spinStatus.textContent = "Spin failed";
        spinResult.textContent = "Please try again next time.";
    } else {
        spinStatus.textContent = "Spin was successful!";
        spinResult.innerHTML = `Chosen the <span style="color: #B09EF8;">${selectedCard.name}</span> Objekt.`;
    }

    document.querySelectorAll(".card").forEach(card => card.classList.add("disabled"));
}

function revealAll() {
    document.getElementById("confirm-btn").disabled = true;
    document.querySelectorAll(".card").forEach(card => {
        card.querySelector(".placeholder").style.display = "none";
        card.querySelector(".card-image").style.display = "block";
    });
}

function tryAgain() {
    location.reload();
}

loadCards();