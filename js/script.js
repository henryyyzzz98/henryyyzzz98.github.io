const track = document.querySelector(".track");

const IMAGE = "images/spincard.png";
const CARD_COUNT = 14;

for (let i = 0; i < CARD_COUNT; i++) {
    const img = document.createElement("img");
    img.src = IMAGE;
    img.draggable = false;
    track.appendChild(img);
}

let position = 0;
let cardWidth = 0;
const speed = 0.4;

window.addEventListener("load", () => {

    cardWidth =
        track.firstElementChild.offsetWidth + 26;

    animate();

});

function animate() {

    position += speed;

    if (position >= cardWidth) {
        position -= cardWidth;
    }

    track.style.transform =
        `translate(${position}px,-50%)`;

    requestAnimationFrame(animate);

}