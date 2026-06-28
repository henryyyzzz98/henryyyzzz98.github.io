const track = document.querySelector(".track");
const selector = document.querySelector(".selector-inner");
const selectButton = document.getElementById("selectButton");
const selectedImage = document.getElementById("selectedObjekt");
const spinButton = document.getElementById("spinButton");

const CARD_IMAGE = "images/spincard.png";
const CARD_COUNT = 18;
const CARD_GAP = 26;

let position = 0;
let cardWidth = 0;
const speed = 0.4;

function createBackgroundCards() {
    for (let i = 0; i < CARD_COUNT; i++) {
        const img = document.createElement("img");
        img.src = CARD_IMAGE;
        img.draggable = false;
        track.appendChild(img);
    }
}

function animateTrack() {
    position += speed;

    if (position >= cardWidth) {
        position -= cardWidth;
    }

    track.style.transform =
        `translate(${position}px, -50%)`;

    requestAnimationFrame(animateTrack);
}

function loadSelectedObjekt() {
    const selected = App.getSelection();

    if (!selected) {
        selectedImage.hidden = true;
        selectButton.hidden = false;
        spinButton.disabled = true;
        spinButton.style.opacity = "0.6";
        return;
    }

    selectedImage.src = selected.image;
    selectedImage.hidden = false;
    selectButton.hidden = true;

    spinButton.disabled = false;
    spinButton.style.opacity = "1";
}

selector.addEventListener("click", () => {
    window.location.href = "select.html";
});

spinButton.addEventListener("click", () => {
    const selected = App.getSelection();

    if (!selected) {
        alert("Please select an Objekt first.");
        return;
    }

    const season = selected.name.split(" ")[0];
    const group = selected.sourceGroup;

    // Block spring25 spins
    if (group === "idntt" && season.toLowerCase() === "spring25") {
        alert("Spring25 Objekts cannot be used for spin.");
        return;
    }

    sessionStorage.setItem(
        "selectedSpinObjekt",
        JSON.stringify(selected)
    );

    location.href = "game.html";
});

window.addEventListener("load", () => {
    createBackgroundCards();

    cardWidth =
        track.firstElementChild.offsetWidth + CARD_GAP;

    animateTrack();

    loadSelectedObjekt();
});