const RevealEngine = (() => {
    let modal = null;
    let inner = null;
    let back = null;
    let isOpen = false;

    function init() {
        modal = document.getElementById("revealModal");
        inner = document.getElementById("revealInner");
        back = document.querySelector(".reveal-back");

        if (!modal || !inner || !back) {
            console.error("RevealEngine modal elements missing");
            return;
        }

        modal.addEventListener("click", e => {
            if (e.target === modal) {
                close();
            }
        });
    }

    function setReward(card) {
        back.innerHTML = "";

        if (card.video && card.video.trim() !== "") {
            const video = document.createElement("video");

            video.src = card.video;
            video.autoplay = true;
            video.loop = true;
            video.playsInline = true;
            video.controls = false;
            video.muted = false;
            video.className = "reveal-video";

            back.appendChild(video);

            video.play().catch(() => {});
            return;
        }

        const img = document.createElement("img");
        img.src = card.image;
        img.alt = card.name;

        back.appendChild(img);
    }

    function open(card, options = {}) {
        if (!modal) init();
        if (!modal) return;

        const {
            flipDelay = 500,
            holdDelay = 2200,
            revealAllDelay = 600,
            onReveal = null
        } = options;

        isOpen = true;

        setReward(card);

        inner.classList.remove("flipped");
        modal.classList.remove("hidden");

        document.body.classList.add("modal-open");

        setTimeout(() => {
            inner.classList.add("flipped");
        }, flipDelay);

        setTimeout(() => {
            if (onReveal) {
                onReveal(card);
            }

            close();
        }, flipDelay + holdDelay + revealAllDelay);
    }

    function close() {
        if (!modal) return;

        modal.classList.add("hidden");
        inner.classList.remove("flipped");

        document.body.classList.remove("modal-open");

        isOpen = false;
    }

    function reveal(card, statusEl, resultEl, options = {}) {
        const {
            autoRevealAll = true,
            revealAllFn = null
        } = options;

        if (statusEl) statusEl.style.opacity = "0";
        if (resultEl) resultEl.style.opacity = "0";

        open(card, {
            onReveal: revealedCard => {

                if (autoRevealAll && revealAllFn) {
                    revealAllFn();
                }

                if (statusEl && resultEl) {
                    if (revealedCard.name === "Fail") {
                        statusEl.textContent = "Spin failed";
                        resultEl.textContent =
                            "Please try again next time.";
                    } else {
                        statusEl.textContent =
                            "Spin was successful!";

                        resultEl.innerHTML =
                            `Chosen the <span style="color:#B09EF8;">${revealedCard.name}</span> Objekt.`;
                    }
                }

                requestAnimationFrame(() => {
                    if (statusEl) statusEl.style.opacity = "1";
                    if (resultEl) resultEl.style.opacity = "1";
                });
            }
        });
    }

    function isVisible() {
        return isOpen;
    }

    return {
        init,
        open,
        close,
        reveal,
        isVisible
    };
})();

window.RevealEngine = RevealEngine;