let cards = [];
let firstGroup = [];
let specialGroup = [];
let selectedCardName = null;
let selectedIndex = null;
let isRandomSelecting = false;

// Load card data from JSON file
async function loadCards() {
    try {
        const response = await fetch('cards.json'); // Load from JSON file
        const data = await response.json();
        cards = data;

        // Categorize cards into groups
        firstGroup = cards.filter(card => card.group === "First");
        specialGroup = cards.filter(card => card.group === "Special");

        // Randomize card display order
        shuffleArray(cards);

        // Display cards on screen
        displayCards();

    } catch (error) {
        console.error("Error loading cards:", error);
    }
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

    cards.slice(0, 16).forEach((card, index) => {
        let cardElement = document.createElement("div");
        cardElement.classList.add("card");
        cardElement.textContent = card.name;
        cardElement.onclick = () => selectCard(index);
        container.appendChild(cardElement);
    });
}

// Function to handle manual selection
function selectCard(index) {
    if (isRandomSelecting) return; // Prevent selection during animation

    document.querySelectorAll(".card").forEach(card => card.classList.remove("selected"));
    selectedCardName = cards[index].name;
    selectedIndex = index;
    document.querySelectorAll(".card")[index].classList.add("selected");

    // Show confirm button
    document.getElementById("confirm-btn").style.display = "block";
}

// Function to handle random spin selection
function startSelectionAnimation() {
    isRandomSelecting = true;
    let currentIndex = 0;
    let totalCards = 16;
    let highlightInterval = 100;
    let iterations = 0;
    const maxIterations = 30;

    const interval = setInterval(() => {
        document.querySelectorAll(".card").forEach((card, index) => {
            card.classList.toggle("highlight", index === currentIndex);
        });

        currentIndex = (currentIndex + 1) % totalCards;
        iterations++;

        if (iterations > maxIterations - 10) highlightInterval += 20;
        if (iterations > maxIterations) {
            clearInterval(interval);
            
            // Use weighted selection
            selectedCardName = getRandomCard();

            if (selectedCardName === "Fail") {
                alert("You didn't win a card. Try again!");
            } else {
                selectedIndex = cards.findIndex(card => card.name === selectedCardName);
                document.querySelectorAll(".card").forEach((card, index) => {
                    card.classList.toggle("highlight", index === selectedIndex);
                });

                document.querySelectorAll(".card")[selectedIndex].classList.add("selected");
                document.getElementById("confirm-btn").style.display = "block";
            }

            isRandomSelecting = false;
        }
    }, highlightInterval);
}

// Function to get a random card based on probability
function getRandomCard() {
    let rand = Math.random() * 100; // Generate a number between 0-100

    if (rand < 87.5) {
        // Pick a random card from the "First" group
        return firstGroup[Math.floor(Math.random() * firstGroup.length)].name;
    } else if (rand < 87.5 + 3.13) {
        // Pick a random card from the "Special" group
        return specialGroup[Math.floor(Math.random() * specialGroup.length)].name;
    } else {
        return "Fail"; // No card won (9.37% chance)
    }
}

// Function to reveal the selected card
function revealCard() {
    if (selectedCardName === "Fail") {
        alert("Unfortunately, you didn't win a card.");
    } else {
        alert(`Congratulations! You won: ${selectedCardName}`);
    }
}

// Load cards when the page starts
loadCards();
