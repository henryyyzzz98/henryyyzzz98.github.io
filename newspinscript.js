const sheetURL = "https://docs.google.com/spreadsheets/d/1bSt-Ou4QycD3USl1hf59jEcpPQ18B8WJ660CBOnpS-0/gviz/tq?tqx=out:json"; 

let cards = [];
let selectedIndex = null;
let isRandomSelecting = false;

// Fetch card names from Google Sheets
async function fetchCards() {
    try {
        const response = await fetch(sheetURL);
        const text = await response.text();
        
        const jsonData = JSON.parse(text.substring(47, text.length - 2));
        const rows = jsonData.table.rows;

        // Ensure we're getting data from row 7 onward (index 6)
        let rawCards = rows.slice(6).map(row => row.c[2]?.v || "Unknown").filter(name => name !== "Unknown");

        // Shuffle the card list for randomness
        cards = rawCards.sort(() => Math.random() - 0.5);

        // Ensure we always have 16 cards (pad if necessary)
        while (cards.length < 16) {
            cards.push("Unknown");
        }

        generateCards();
    } catch (error) {
        console.error("Error fetching Google Sheets data:", error);
    }
}

// Generate card elements dynamically
function generateCards() {
    const container = document.getElementById("card-container");
    container.innerHTML = ""; // Clear existing cards

    for (let i = 0; i < 16; i++) {
        let card = document.createElement("div");
        card.classList.add("card");
        card.innerText = "?";
        card.onclick = () => handleManualSelection(i);
        container.appendChild(card);
    }
}

// Handle manual card selection
function handleManualSelection(index) {
    if (!isRandomSelecting) {
        selectedIndex = index;

        // Remove previous selection
        document.querySelectorAll(".card").forEach(card => card.classList.remove("selected"));
        document.querySelectorAll(".card")[index].classList.add("selected");

        document.getElementById("confirm-btn").style.display = "block";
    }
}

// Random card selection
document.getElementById("random-btn").onclick = () => {
    if (!isRandomSelecting) {
        startSelectionAnimation();
    }
};

// Start selection animation
function startSelectionAnimation() {
    isRandomSelecting = true;
    let currentIndex = 0;
    const totalCards = 16;
    const interval = setInterval(() => {
        document.querySelectorAll(".card").forEach((card, index) => {
            card.classList.toggle("highlight", index === currentIndex);
        });
        currentIndex = (currentIndex + 1) % totalCards;
    }, 100);

    setTimeout(() => {
        clearInterval(interval);
        selectedIndex = Math.floor(Math.random() * totalCards);
        document.querySelectorAll(".card")[selectedIndex].classList.add("selected");
        isRandomSelecting = false;
        document.getElementById("confirm-btn").style.display = "block";
    }, 2000);
}

// Reveal the selected card
document.getElementById("confirm-btn").onclick = () => {
    if (selectedIndex !== null) {
        document.querySelectorAll(".card")[selectedIndex].innerText = cards[selectedIndex];
        document.getElementById("confirm-btn").style.display = "none";
        document.getElementById("reveal-btn").style.display = "block";
    }
};

// Reveal all unchosen cards
document.getElementById("reveal-btn").onclick = () => {
    document.querySelectorAll(".card").forEach((card, index) => {
        if (index !== selectedIndex) {
            card.innerText = cards[index];
        }
    });
};

// Load cards from Google Sheets on page load
fetchCards();
