let selectedCard = null;

// When user clicks a card
function selectCard(card) {
    if (selectedCard) return; // Prevent selecting multiple cards
    card.classList.add("selected");
    card.innerHTML = "🎉"; // Show an emoji or image
    selectedCard = card;
}

// Randomly select a card
function randomSelect() {
    if (selectedCard) return;
    let cards = document.querySelectorAll(".card");
    let randomIndex = Math.floor(Math.random() * cards.length);
    selectCard(cards[randomIndex]);
}

// Reveal all unselected cards
function revealAll() {
    let cards = document.querySelectorAll(".card");
    cards.forEach(card => {
        if (!card.classList.contains("selected")) {
            card.classList.add("revealed");
            card.innerHTML = "❔"; // Placeholder for other card values
        }
    });
}
