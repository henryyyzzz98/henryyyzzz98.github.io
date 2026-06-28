const RevealEngine = (() => {

    let modal = null;
    let inner = null;
    let image = null;

    let isOpen = false;

    function init() {
        modal = document.getElementById("revealModal");
        inner = document.getElementById("revealInner");
        image = document.getElementById("revealImage");

        if (!modal || !inner || !image) {
            console.error("RevealEngine modal elements missing");
            return;
        }

        modal.addEventListener("click", e => {
            if (e.target === modal) {
                close();
            }
        });
    }

    function open(card, options = {}) {
        if (!modal) init();

        if (!modal) return;

        const {
            flipDelay = 900,
            textDelay = 900,
            onReveal = null
        } = options;

        isOpen = true;

        image.src = card.image;

        inner.classList.remove("flipped");
        modal.classList.remove("hidden");

        document.body.classList.add("modal-open");

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    inner.classList.add("flipped");
                }, flipDelay);
            });
        });

        if (onReveal) {
            setTimeout(() => {
                onReveal(card);
            }, textDelay);
        }
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
            revealAllDelay = 900,
            revealAllFn = null
        } = options;

        open(card, {
            onReveal: revealedCard => {

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

                setTimeout(() => {
                    close();

                    setTimeout(() => {
                        if (autoRevealAll && revealAllFn) {
                            revealAllFn();
                        }

                        setTimeout(() => {
                            close();

                            if (autoRevealAll && revealAllFn) {
                                revealAllFn();
                            }

                            const selectBtn = document.getElementById("confirm-btn");
                            const retryBtn = document.getElementById("try-again-btn");

                            selectBtn.style.display = "none";
                            retryBtn.style.display = "inline-block";

                        }, revealAllDelay);

                        // ONLY update text here
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

                    }, 500);

                }, revealAllDelay);
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