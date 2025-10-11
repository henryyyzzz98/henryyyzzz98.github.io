let cards = [];
let firstGroup = [];
let specialGroup = [];
let shopGroup = [];
let eventGroup = [];
let premierGroup = [];
let selectedCard = null;
let selectedIndex = null;
let hasConfirmed = false;

// 🔧 Customization-related globals
let customCombination = null;
let useCustomSettings = false;

document.getElementById("reveal-all-btn").disabled = true; // Initially disable "Reveal All"
document.getElementById("try-again-btn").disabled = true; // Disable "Try Again" initially

// Load card data from JSON file
async function loadCards() {
    try {
        const response = await fetch('json/allcards.json'); // Load from JSON file
        const data = await response.json();
        cards = data;

        // Categorize cards
        firstGroup = cards.filter(card => card.group === "First");
        specialGroup = cards.filter(card => card.group === "Special");
        shopGroup = cards.filter(card => card.group === "Shop");
        eventGroup = cards.filter(card => card.group === "Event");
        premierGroup = cards.filter(card => card.group === "Premier");

        // Generate a set of 16 cards based on probability rules
        generateRandomSet();

        // Display cards on screen
        displayCards();

        // Initialize settings UI if it exists
        setupCustomSettings();
    } catch (error) {
        console.error("Error loading cards:", error);
    }
}

// Function to select a combination based on weighted probability
function getCombination() {
    // 🔧 If user has custom settings, use those instead
    if (useCustomSettings && customCombination) {
        return customCombination;
    }

    let rand = Math.random(); // Generates a number between 0 and 1

    if (rand < 0.60) {
        return { first: 12, special: 1, shop: 1, event: 1, premier: 0, fail: 1 }; // 60% chance
    } else if (rand < 0.90) {
        return { first: 12, special: 0, shop: 1, event: 1, premier: 0, fail: 2 }; // 30% chance
    } else if (rand < 0.97) {
        return { first: 12, special: 0, shop: 0, event: 2, premier: 0, fail: 2 }; // 7% chance
    } else if (rand < 0.98) {
        return { first: 12, special: 0, shop: 2, event: 0, premier: 1, fail: 1 }; // 1% chance
    } else if (rand < 0.99) {
        return { first: 12, special: 0, shop: 1, event: 1, premier: 1, fail: 1 }; // 1% chance
    } else {
        return { first: 12, special: 0, shop: 0, event: 2, premier: 1, fail: 1 }; // 1% chance
    }
}

// Function to generate 16 cards based on probability
function generateRandomSet() {
    const useCustom = localStorage.getItem("useCustom") === "true";
    let selectedOption = useCustom ? getCustomSettings() : getCombination();

    if (!selectedOption) {
        alert("Invalid settings — reverting to default combination.");
        selectedOption = getCombination();
    }

    let selectedCards = [];

    // Pick "First" group cards
    selectedCards.push(...shuffleAndPick(firstGroup, selectedOption.first));

    // Pick "Special" group cards (if applicable)
    if (selectedOption.special > 0) {
        selectedCards.push(...shuffleAndPick(specialGroup, selectedOption.special));
    }

    // Pick "Event" group cards (if applicable)
    if (selectedOption.event > 0) {
        selectedCards.push(...shuffleAndPick(eventGroup, selectedOption.event));
    }

    // Pick "Shop" group cards (if applicable)
    if (selectedOption.shop > 0) {
        selectedCards.push(...shuffleAndPick(shopGroup, selectedOption.shop));
    }

    // Pick "Premier" group cards (if applicable)
    if (selectedOption.premier > 0) {
        selectedCards.push(...shuffleAndPick(premierGroup, selectedOption.premier));
    }

    // Add "Fail" cards (if applicable)
    for (let i = 0; i < selectedOption.fail; i++) {
        selectedCards.push({ name: "Fail", group: "Fail", image: "images/fail.png" });
    }

    if (selectedCards.length !== 16) {
        alert(`Invalid total card count (${selectedCards.length}). Must equal 16.`);
        selectedCards = [];
        selectedCards.push(...shuffleAndPick(firstGroup, 12));
        selectedCards.push({ name: "Fail", group: "Fail", image: "images/fail.png" });
        selectedCards.push({ name: "Fail", group: "Fail", image: "images/fail.png" });
        selectedCards.push(...shuffleAndPick(eventGroup, 2));
    }

    // Shuffle the final 16 cards
    shuffleArray(selectedCards);
    
    // Store the result globally
    cards = selectedCards;
}

// Function to shuffle and pick a specific number of items
function shuffleAndPick(array, count) {
    let shuffled = [...array];
    shuffleArray(shuffled);
    return shuffled.slice(0, count);
}

// Function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Function to display cards
function displayCards() {
    const container = document.getElementById("card-container");
    container.innerHTML = "";

    cards.forEach((card, index) => {
        let cardElement = document.createElement("div");
        cardElement.classList.add("card");
        cardElement.onclick = () => selectCard(index);

        // Placeholder Image
        let placeholder = document.createElement("img");
        placeholder.classList.add("placeholder");
        placeholder.src = "images/spincard.png"; // Replace with your provided image
        placeholder.alt = "?";

        // Hidden Card Image
        let image = document.createElement("img");
        image.classList.add("card-image"); // Add a class for easy selection
        image.src = card.image;
        image.alt = card.name;
        image.style.display = "none"; // Keep it hidden initially

        cardElement.appendChild(placeholder);
        cardElement.appendChild(image);
        container.appendChild(cardElement);
    });
}

// Function to handle manual selection (allows re-selection)
function selectCard(index) {
    if (hasConfirmed) return; // Prevent selection after confirmation

    document.querySelectorAll(".card").forEach(card => card.classList.remove("selected"));
    selectedCard = cards[index];
    selectedIndex = index;
    document.querySelectorAll(".card")[index].classList.add("selected");

    // Show confirm button
    document.getElementById("confirm-btn").style.display = "block";
}

// Function to reveal the selected card
function revealCard() {
    document.getElementById("reveal-all-btn").disabled = false; // Enable "Reveal All"
    document.getElementById("confirm-btn").disabled = true; // Disable "Confirm Selection"
    document.getElementById("try-again-btn").disabled = false; // Enable "Try Again"
    
    if (selectedIndex === null) return; // Prevent accidental clicks if no card was selected

    hasConfirmed = true; // Lock further selections

    const selectedCardElement = document.querySelectorAll(".card")[selectedIndex];
    selectedCardElement.querySelector(".placeholder").style.display = "none"; // Hide placeholder
    selectedCardElement.querySelector(".card-image").style.display = "block"; // Show actual card image

    // Add "GET" tag
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

    // Show "Reveal All" button
    document.getElementById("reveal-all-btn").style.display = "block";

    // Disable selection for all other cards
    document.querySelectorAll(".card").forEach(card => {
        card.classList.add("disabled");
    });
}

// Function to reveal all remaining cards
function revealAll() {
    document.getElementById("confirm-btn").disabled = true; // Ensure "Confirm Selection" stays disabled
    
    document.querySelectorAll(".card").forEach(card => {
        card.querySelector(".placeholder").style.display = "none"; // Hide placeholder
        card.querySelector(".card-image").style.display = "block"; // Show actual card image
    });
}

function tryAgain() {
    location.reload(); // Refresh the page to restart the game
}

// ---------------- Custom Settings ---------------- //

function setupCustomSettings() {
    const container = document.createElement("div");
    container.id = "custom-settings";
    container.style.marginTop = "20px";
    container.style.display = "none";

    container.innerHTML = `
        <label><input type="checkbox" id="useCustom"> Use Custom Settings</label>
        <button id="toggleCustomize">Show/Hide Customize Box</button>
        <div id="customBox" style="display:none; margin-top:10px;">
            <p>Enter number of cards (must total 16):</p>
            <label>First: <input id="firstInput" type="number" min="0" max="16"></label>
            <label>Special: <input id="specialInput" type="number" min="0" max="16"></label>
            <label>Shop: <input id="shopInput" type="number" min="0" max="16"></label>
            <label>Event: <input id="eventInput" type="number" min="0" max="16"></label>
            <label>Premier: <input id="premierInput" type="number" min="0" max="16"></label>
            <label>Fail: <input id="failInput" type="number" min="0" max="16"></label>
            <br><button id="saveCustom">Save Custom Settings</button>
        </div>
    `;

    document.body.appendChild(container);

    const useCustom = document.getElementById("useCustom");
    const toggleBtn = document.getElementById("toggleCustomize");
    const customBox = document.getElementById("customBox");
    const saveBtn = document.getElementById("saveCustom");

    // Load saved settings
    if (localStorage.getItem("useCustom") === "true") {
        useCustom.checked = true;
        const saved = JSON.parse(localStorage.getItem("customSettings") || "{}");
        ["first", "special", "shop", "event", "premier", "fail"].forEach(id => {
            document.getElementById(id + "Input").value = saved[id] || 0;
        });
    }

    toggleBtn.onclick = () => {
        customBox.style.display = customBox.style.display === "none" ? "block" : "none";
    };

    useCustom.onchange = () => {
        localStorage.setItem("useCustom", useCustom.checked);
    };

    saveBtn.onclick = () => {
        const settings = getCustomSettings();
        if (settings) {
            localStorage.setItem("customSettings", JSON.stringify(settings));
            alert("Custom settings saved!");
        }
    };
}

function getCustomSettings() {
    const first = parseInt(document.getElementById("firstInput")?.value || 0);
    const special = parseInt(document.getElementById("specialInput")?.value || 0);
    const shop = parseInt(document.getElementById("shopInput")?.value || 0);
    const event = parseInt(document.getElementById("eventInput")?.value || 0);
    const premier = parseInt(document.getElementById("premierInput")?.value || 0);
    const fail = parseInt(document.getElementById("failInput")?.value || 0);

    const total = first + special + shop + event + premier + fail;
    if (total !== 16) {
        alert(`Total must equal 16. Currently: ${total}`);
        return null;
    }

    return { first, special, shop, event, premier, fail };
}

// Load cards when the page starts
loadCards();
