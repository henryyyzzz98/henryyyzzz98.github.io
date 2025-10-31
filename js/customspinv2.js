let allCards = [];
let cards = [];
let selectedCard = null;
let selectedIndex = null;
let hasConfirmed = false;
let selectedCollections = JSON.parse(localStorage.getItem("selectedCollections") || "[]");

document.getElementById("reveal-all-btn").disabled = true;
document.getElementById("try-again-btn").disabled = true;

// --- Toggle collapsible ---
const toggleBtn = document.getElementById("toggleCollectionsBtn");
const collectionsContainer = document.getElementById("collectionsContainer");
toggleBtn.addEventListener("click", () => {
const isVisible = collectionsContainer.style.display === "block";
collectionsContainer.style.display = isVisible ? "none" : "block";
toggleBtn.textContent = isVisible ? "📂 Show Collections" : "📂 Hide Collections";
});

// --- Load collections & render tabs ---
async function loadCollections() {
    try {
        const res = await fetch("json/allcustomv2.json");
        allCards = await res.json();

        const collections = [...new Set(allCards.map(c => c.collection).filter(Boolean))];
        const groups = {};
        collections.forEach(c => {
        const prefix = c.startsWith("AA") ? "AA" : c[0].toUpperCase();
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(c);
        });

        const tabContainer = document.getElementById("collectionTabs");
        tabContainer.innerHTML = "";
        Object.keys(groups).forEach(prefix => {
        const tab = document.createElement("button");
        tab.textContent = prefix;
        tab.className = "collection-tab";
        tab.onclick = () => renderCollectionGroup(prefix, groups[prefix]);
        tabContainer.appendChild(tab);
        });

        const firstKey = Object.keys(groups)[0];
        if (firstKey) renderCollectionGroup(firstKey, groups[firstKey]);
    } catch (e) {
        console.error(e);
    }
}

// --- Render collections for a tab ---
function renderCollectionGroup(prefix, collectionList) {
    const grid = document.getElementById("collectionGrid");
    grid.innerHTML = "";

    collectionList.forEach(c => {
        const btn = document.createElement("button");
        btn.textContent = c;
        btn.className = "collection-btn";
        if (selectedCollections.includes(c)) btn.classList.add("selected");

        btn.onclick = () => {
        if (selectedCollections.includes(c)) {
            selectedCollections = selectedCollections.filter(x => x !== c);
            btn.classList.remove("selected");
        } else {
            selectedCollections.push(c);
            btn.classList.add("selected");
        }
        updateTabHighlights();
        updateSelectedCollectionsMessage();
        };
        grid.appendChild(btn);
    });

    updateTabHighlights();
    updateSelectedCollectionsMessage();
}

// --- Update selected collections bar ---
function updateSelectedCollectionsMessage() {
    const msgBar = document.getElementById("selectedCollectionsMsg");
    if (selectedCollections.length === 0)
        msgBar.textContent = "No collections selected.";
    else
        msgBar.textContent = "Selected collections: " + selectedCollections.join(", ");
}

// --- Update tab highlights ---
function updateTabHighlights() {
    const tabs = document.querySelectorAll(".collection-tab");
    tabs.forEach(tab => {
        const prefix = tab.textContent;
        const anySelected = selectedCollections.some(c => c.startsWith(prefix));
        tab.classList.toggle("active", anySelected);
    });
    }

    // --- Save selections ---
    document.getElementById("saveCollectionBtn").addEventListener("click", () => {
    localStorage.setItem("selectedCollections", JSON.stringify(selectedCollections));
    generateRandomSet();
    displayCards();
    updateTabHighlights();
    updateSelectedCollectionsMessage();
    alert("✅ Collection selections saved!");
    location.reload();
});

// --- Shuffle helpers ---
function shuffleAndPick(array, count) {
    const shuffled = [...array];
    shuffleArray(shuffled);
    return shuffled.slice(0, count);
    }
    function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Generate random set ---
function generateRandomSet() {
    if (!selectedCollections.length) {
        cards = [];
        return;
    }

    const filteredCards = allCards.filter(
        c =>
        c.collection &&
        selectedCollections.some(
            sel => sel.trim().toLowerCase() === c.collection.trim().toLowerCase()
        )
    );

    let selectedCards = [];
    if (filteredCards.length >= 16) {
        selectedCards = shuffleAndPick(filteredCards, 16);
    } else {
        selectedCards = [...filteredCards];
        const missing = 16 - selectedCards.length;
        for (let i = 0; i < missing; i++) {
        selectedCards.push({ name: "Fail", group: "Fail", image: "images/fail.png" });
        }
    }

    shuffleArray(selectedCards); // randomize fail card positions
    cards = selectedCards;
}

// --- Display cards ---
function displayCards() {
    const container = document.getElementById("card-container");
    container.innerHTML = "";
    cards.forEach((card, i) => {
        const div = document.createElement("div");
        div.className = "card";
        div.onclick = () => selectCard(i);

        const placeholder = document.createElement("img");
        placeholder.src = "images/spincard.png";
        placeholder.className = "placeholder";

        const img = document.createElement("img");
        img.src = card.image;
        img.alt = card.name;
        img.className = "card-image";

        div.appendChild(placeholder);
        div.appendChild(img);
        container.appendChild(div);
    });
}

// --- Select / reveal logic ---
function selectCard(i) {
    if (hasConfirmed) return;
    document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
    selectedCard = cards[i];
    selectedIndex = i;
    document.querySelectorAll(".card")[i].classList.add("selected");
}

function revealCard() {
    if (selectedIndex === null) return;
    hasConfirmed = true;
    document.getElementById("reveal-all-btn").disabled = false;
    document.getElementById("confirm-btn").disabled = true;
    document.getElementById("try-again-btn").disabled = false;

    const el = document.querySelectorAll(".card")[selectedIndex];
    el.querySelector(".placeholder").style.display = "none";
    el.querySelector(".card-image").style.display = "block";
    const tag = document.createElement("div");
    tag.className = "get-tag";
    tag.textContent = "Get";
    el.appendChild(tag);

    const spinStatus = document.getElementById("spinStatus");
    const spinResult = document.getElementById("spinResult");
    if (selectedCard.name === "Fail") {
        spinStatus.textContent = "Spin failed";
        spinResult.textContent = "Please try again next time.";
    } else {
        spinStatus.textContent = "Spin was successful!";
        spinResult.innerHTML = `Chosen the <span style="color:#B09EF8;">${selectedCard.name}</span> Objekt.`;
    }

    document.querySelectorAll(".card").forEach(c => c.classList.add("disabled"));
}

function revealAll() {
    document.getElementById("confirm-btn").disabled = true;
    document.querySelectorAll(".card").forEach(c => {
        c.querySelector(".placeholder").style.display = "none";
        c.querySelector(".card-image").style.display = "block";
    });
}

function tryAgain() {
    selectedCard = null;
    selectedIndex = null;
    hasConfirmed = false;
    document.getElementById("reveal-all-btn").disabled = true;
    document.getElementById("confirm-btn").disabled = false;
    document.getElementById("try-again-btn").disabled = true;
    generateRandomSet();
    displayCards();
    location.reload();
}

// --- Init ---
window.onload = async () => {
    await loadCollections();
    if (selectedCollections.length > 0) {
        generateRandomSet();
        displayCards();
    }
    updateSelectedCollectionsMessage();
    updateTabHighlights();
};