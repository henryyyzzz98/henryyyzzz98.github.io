let cards = [];
let firstGroup = [];
let specialGroup = [];
let selectedCard = null;
let selectedIndex = null;
let hasConfirmed = false;

// Load card data from JSON file
async function loadCards() {
    try {
        const response = await fetch('cards.json'); // Load from JSON file
        const data = await response.json();
        cards = data;

        // Categorize cards
        firstGroup = cards.filter(card => card.group === "First");
        specialGroup = cards.filter(card => card.group === "Special");

        // Generate a set of 16 cards based on probability rules
        generateRandomSet();

        // Display cards on screen
        displayCards();
    } catch (error) {
        console.error("Error loading cards:", error);
    }
}

// Function to generate 16 cards based on probability
function generateRandomSet() {
    const probabilityOptions = [
        { first: 14, special: 1, fail: 1 },
        { first: 14, special: 0, fail: 2 },
        { first: 14, special: 2, fail: 0 }
    ];

    // Randomly pick one of the three probability options
    let selectedOption = probabilityOptions[Math.floor(Math.random() * probabilityOptions.length)];

    let selectedCards = [];

    // Pick "First" group cards
    selectedCards.push(...shuffleAndPick(firstGroup, selectedOption.first));

    // Pick "Special" group cards (if applicable)
    if (selectedOption.special > 0) {
        selectedCards.push(...shuffleAndPick(specialGroup, selectedOption.special));
    }

    // Add "Fail" cards (if applicable)
    for (let i = 0; i < selectedOption.fail; i++) {
        selectedCards.push({ name: "Fail", group: "Fail", image: "images/fail.png" });
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
    if (selectedIndex === null) return; // Prevent accidental clicks if no card was selected

    hasConfirmed = true; // Lock further selections

    const selectedCardElement = document.querySelectorAll(".card")[selectedIndex];
    selectedCardElement.querySelector(".placeholder").style.display = "none"; // Hide placeholder
    selectedCardElement.querySelector(".card-image").style.display = "block"; // Show actual card image

    if (selectedCard.name === "Fail") {
        alert("Unfortunately, you didn't win a card.");
    } else {
        alert(`Congratulations! You won: ${selectedCard.name}`);
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
    document.querySelectorAll(".card").forEach(card => {
        card.querySelector(".placeholder").style.display = "none"; // Hide placeholder
        card.querySelector(".card-image").style.display = "block"; // Show actual card image
    });
}

// Load cards when the page starts
loadCards();
