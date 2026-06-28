function getSpinScript(selected) {
    const season = selected.name.split(" ")[0];
    const group = selected.sourceGroup;

    if (group === "idntt") {
        const map = {
            Summer25: "su25",
            Autumn25: "au25",
            Winter26: "wi26",
            Spring26: "sp26",
        };

        const prefix = map[season];
        if (!prefix) return null;

        return `seasons/${prefix}idntt.js`;
    }

    const seasonMap = {
        Atom: "a",
        Binary: "b",
        Cream: "c",
        Divine: "d",
        Ever: "e",
    };

    const match = season.match(/^([A-Za-z]+)(\d+)$/);

    if (!match) return null;

    const prefix = seasonMap[match[1]];
    const number = parseInt(match[2], 10);

    if (!prefix) return null;

    return `seasons/${prefix}${number}${group}.js`;
}

const selected = JSON.parse(
    sessionStorage.getItem("selectedSpinObjekt")
);

if (!selected) {
    document.getElementById("spinResult").textContent =
        "No selected Objekt found.";
    throw new Error("Missing selected objekt");
}

const scriptPath = getSpinScript(selected);

if (!scriptPath) {
    document.getElementById("spinResult").textContent =
        "Spin configuration not found.";
    throw new Error("Missing script");
}

localStorage.removeItem("selectedObjekt");

const script = document.createElement("script");
script.src = scriptPath;
document.body.appendChild(script);