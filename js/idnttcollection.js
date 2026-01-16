let allCards = [];
let cards = [];
let selectedCard = null;
let selectedIndex = null;
let hasConfirmed = false;
let selectedidnttCollections = JSON.parse(localStorage.getItem("selectedidnttCollections") || "[]");

// --- Initial button states ---
document.getElementById("reveal-all-btn").disabled = true;
document.getElementById("try-again-btn").disabled = true;

// --- Toggle collections panel ---
const toggleBtn = document.getElementById("toggleCollectionsBtn");
const collectionsContainer = document.getElementById("collectionsContainer");

toggleBtn.addEventListener("click", () => {
    const isVisible = collectionsContainer.style.display === "block";
    collectionsContainer.style.display = isVisible ? "none" : "block";
    toggleBtn.textContent = isVisible ? "📂 Show Collections" : "📂 Hide Collections";
});

// --- Load collections ---
async function loadCollections() {
    try {
        const res = await fetch("json/allidntt.json");
        allCards = await res.json();

        const collections = [...new Set(allCards.map(c => c.collection).filter(Boolean))];
        const groups = {};
        
        collections.forEach(c => {
            let prefix;
            if (c.startsWith("AA")) prefix = "AA";
            else if (c.startsWith("BB")) prefix = "BB";
            else prefix = c.substring(0, 8).toUpperCase();

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

// --- Render collection group ---
function renderCollectionGroup(prefix, collectionList) {
    const grid = document.getElementById("collectionGrid");
    grid.innerHTML = "";

    collectionList.forEach(c => {
        const btn = document.createElement("button");
        btn.textContent = c;
        btn.className = "collection-btn";
        if (selectedidnttCollections.includes(c)) btn.classList.add("selected");

        btn.onclick = () => {
            if (selectedidnttCollections.includes(c)) {
                selectedidnttCollections = selectedidnttCollections.filter(x => x !== c);
                btn.classList.remove("selected");
            } else {
                selectedidnttCollections.push(c);
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

// --- Update selected collections message ---
function updateSelectedCollectionsMessage() {
    const msgBar = document.getElementById("selectedCollectionsMsg");
    if (selectedidnttCollections.length === 0)
        msgBar.textContent = "No collections selected.";
    else
        msgBar.textContent = "Selected collections: " + selectedidnttCollections.join(", ");
}

// --- Update tab highlights ---
function updateTabHighlights() {
    const tabs = document.querySelectorAll(".collection-tab");
    tabs.forEach(tab => {
        const prefix = tab.textContent;
        // AA should not trigger A
        const anySelected = selectedidnttCollections.some(c => {
            if (prefix === "AA") return c.startsWith("AA");
            // exclude AA from A check
            return c.startsWith(prefix) && !c.startsWith("AA");
        });
        tab.classList.toggle("active", anySelected);
    });
}

// --- Shuffle and pick helper ---
function shuffleAndPick(array, count) {
    const shuffled = [...array];
    shuffleArray(shuffled);
    return shuffled.slice(0, count);
}

// --- Shuffle array helper ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Generate random set of 16 cards ---
function generateRandomSet() {
    if (!selectedidnttCollections.length) {
        cards = [];
        return;
    }

    const filteredCards = allCards.filter(
        c =>
        c.collection &&
        selectedidnttCollections.some(
            sel => sel.trim().toLowerCase() === c.collection.trim().toLowerCase()
        )
    );

    let selectedCards = [];

    if (filteredCards.length >= 16) {
        const failCount = Math.floor(Math.random() * 2) + 1;
        const normalCount = 16 - failCount;
        const pickedNormal = shuffleAndPick(filteredCards, normalCount);
        const failCards = Array.from({ length: failCount }, () => ({
            name: "Fail",
            group: "Fail",
            image: "images/fail.png"
        }));

        selectedCards = shuffleAndPick([...pickedNormal, ...failCards], 16);
    } else {
        selectedCards = [...filteredCards];
        const missing = 16 - selectedCards.length;
        for (let i = 0; i < missing; i++) {
            selectedCards.push({ name: "Fail", group: "Fail", image: "images/fail.png" });
        }
    }

    shuffleArray(selectedCards);
    cards = selectedCards;
}

// --- Display cards ---
function displayCards() {
    const container = document.getElementById("card-container");
    container.innerHTML = "";
    
    cards.forEach((card, i) => {
        const div = document.createElement("div");
        div.className = "card";
        div.dataset.revealed = "false";
        if (selectedIndex === i) div.classList.add("selected");
        if (hasConfirmed) div.classList.add("disabled");

        div.onclick = () => selectCard(i);

        const placeholder = document.createElement("img");
        placeholder.src = "images/spincard.png";
        placeholder.className = "placeholder";
        div.appendChild(placeholder);

        const img = document.createElement("img");
        img.src = card.image;
        img.alt = card.name;
        img.className = "card-image";
        img.style.display = "none";
        div.appendChild(img);

        container.appendChild(div);
    });
}

// --- Select a card ---
function selectCard(i) {
    if (hasConfirmed) return;
    document.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
    selectedCard = cards[i];
    selectedIndex = i;
    document.querySelectorAll(".card")[i].classList.add("selected");
}

// --- Confirm selection ---
function revealCard() {
if (selectedIndex === null) return;

    const el = document.querySelectorAll(".card")[selectedIndex];
    if (el.dataset.revealed === "true") return;

    const card = selectedCard;

    const placeholder = el.querySelector(".placeholder");
    if (placeholder) placeholder.style.display = "none";

    if (card.video) {
        const video = document.createElement("video");
        video.src = card.video;
        video.className = "card-video";
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        el.appendChild(video);
        video.play().catch(() => {});
    } else {
        const img = el.querySelector(".card-image");
        img.style.display = "block";
    }

    const tag = document.createElement("div");
    tag.className = "get-tag";
    tag.textContent = "Get";
    el.appendChild(tag);

    el.dataset.revealed = "true";

    const spinStatus = document.getElementById("spinStatus");
    const spinResult = document.getElementById("spinResult");

    if (card.name === "Fail") {
        spinStatus.textContent = "Spin failed";
        spinResult.textContent = "Please try again next time.";
    } else {
        spinStatus.textContent = "Spin was successful!";
        spinResult.innerHTML = `Chosen the <span style="color:#B09EF8;">${card.name}</span> Objekt.`;
    }

    document.querySelectorAll(".card").forEach(c => c.classList.add("disabled"));

    hasConfirmed = true;
    document.getElementById("reveal-all-btn").disabled = false;
    document.getElementById("confirm-btn").disabled = true;
    document.getElementById("try-again-btn").disabled = false;
}

// --- Reveal all ---
function revealAll() {
    document.getElementById("confirm-btn").disabled = true;

    document.querySelectorAll(".card").forEach((el, i) => {
        if (el.dataset.revealed === "true") return;

        const placeholder = el.querySelector(".placeholder");
        if (placeholder) placeholder.style.display = "none";

        const card = cards[i];

        if (i === selectedIndex && card.video) {
            const video = document.createElement("video");
            video.src = card.video;
            video.className = "card-video";
            video.muted = true;
            video.loop = true;
            video.autoplay = true;
            video.playsInline = true;
            el.appendChild(video);
            video.play().catch(() => {});

            const tag = document.createElement("div");
            tag.className = "get-tag";
            tag.textContent = "Get";
            el.appendChild(tag);
        } else {
            const img = el.querySelector(".card-image");
            if (img) img.style.display = "block";
        }

        el.dataset.revealed = "true";
    });
}

// --- Try again ---
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

// --- Button event listeners ---
document.getElementById("saveCollectionBtn").addEventListener("click", () => { 
    localStorage.setItem("selectedidnttCollections", JSON.stringify(selectedidnttCollections));
    generateRandomSet();
    displayCards();
    updateTabHighlights();
    updateSelectedCollectionsMessage();
    alert("✅ Collection selections saved!");
    location.reload();
});

// --- On load ---
window.onload = async () => {
    await loadCollections();
    if (selectedidnttCollections.length > 0) {
        generateRandomSet();
        displayCards();
    }
    updateSelectedCollectionsMessage();
};