const nameColorMap = {
  SeoYeon: "#22aeff", HyeRin: "#7e00ff", JiWoo: "#ffff00", ChaeYeon: "#98c64a", YooYeon: "#d10a6f",
  SooMin: "#fc83a4", NaKyoung: "#6599a4", YuBin: "#ffe3e2", Kaede: "#ffc935", DaHyun: "#ff9ad6",
  Kotone: "#fde000", YeonJi: "#5974ff", Nien: "#ff953f", SoHyun: "#1222b5", Xinyu: "#d51313",
  Mayu: "#fe8e76", Lynn: "#ab61b8", JooBin: "#b8f54d", HaYeon: "#52d9ba", ShiOn: "#ff428a",
  ChaeWon: "#c7a3e0", Sullin: "#7aba8c", SeoAh: "#cff2ff", JiYeon: "#ffab61"
};

const profileImageUrl = {
  SeoYeon: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S1.jpg",
  HyeRin: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S2.jpg",
  JiWoo: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S3.jpg",
  ChaeYeon: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S4.jpg",
  YooYeon: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S5.jpg",
  SooMin: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S6.jpg",
  NaKyoung: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S7.jpg",
  YuBin: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S8.jpg",
  Kaede: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S9.jpg",
  DaHyun: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S10.jpg",
  Kotone: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S11.jpg",
  YeonJi: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S12.jpg",
  Nien: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S13.jpg",
  SoHyun: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S14.jpg",
  Xinyu: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S15.jpg",
  Mayu: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S16.jpg",
  Lynn: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S17.jpg",
  JooBin: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S18.jpg",
  HaYeon: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S19.jpg",
  ShiOn: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S20.jpg",
  ChaeWon: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S21.jpg",
  Sullin: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S22.jpg",
  SeoAh: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S23.jpg",
  JiYeon: "https://static.cosmo.fans/uploads/member-profile/2025-05-01/S24.jpg"
};

let table1AllRows = [], filteredRows = [], currentPage = 0;
const rowsPerPage = 10;

const youtubeModal = document.getElementById("youtubeModal");
const modalContent = document.getElementById("youtubeFrame");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalInfoPanel = document.getElementById("modalInfoPanel");

function getColorForName(name) {
  return nameColorMap[name] || "#666";
}

function updateButtonStates() {
  const maxPage = Math.floor((filteredRows.length - 1) / rowsPerPage);
  document.getElementById("prevBtn").disabled = currentPage === 0;
  document.getElementById("nextBtn").disabled = currentPage >= maxPage;
  document.getElementById("pageDisplay").textContent = `Page ${currentPage + 1} of ${maxPage + 1}`;
}

function buildTable1Grid(rows, page = 0) {
  const container = document.getElementById("table1");
  container.innerHTML = "";

  const start = page * rowsPerPage;
  const pageRows = rows.slice(start, start + rowsPerPage);

  pageRows.forEach((r, idx) => {
    const c = r.c;
    const name = c[2]?.v || "";
    const avatar = profileImageUrl[name] || "";
    const color = getColorForName(name);

    // Video ID in column 5 (index 5)
    const videoId = c[6]?.v || "";

    const colA = c[0]?.f || c[0]?.v || "";
    const colB = c[1]?.f || c[1]?.v || "";
    const colC = c[2]?.f || c[2]?.v || "";
    const colD = c[3]?.f || c[3]?.v || "";
    const colE = c[4]?.f || c[4]?.v || "";

    const card = document.createElement("div");
    card.className = "ranking-card";
    card.style.borderColor = color;
    card.style.cursor = videoId ? "pointer" : "default";

    const rank = document.createElement("div");
    rank.className = "ranking-rank";
    rank.textContent = `#${start + idx + 1}`;

    const img = document.createElement("img");
    img.src = avatar;
    img.alt = name;
    img.className = "ranking-avatar";

    const displayName = document.createElement("div");
    displayName.className = "ranking-name";
    displayName.textContent = name;

    const infoDiv = document.createElement("div");
    infoDiv.className = "card-info";
    infoDiv.innerHTML = `
      <div><strong>Date:</strong> ${colB}</div>
      <div><strong>LIVE:</strong> ${colD}</div>
      <div><strong>Duration:</strong> ${colE}</div>
    `;

    card.appendChild(rank);
    card.appendChild(img);
    card.appendChild(displayName);
    card.appendChild(infoDiv);

    if (videoId) {
      card.addEventListener("click", () => {
        modalContent.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        youtubeModal.classList.add("show");

        modalInfoPanel.innerHTML = `
          <div><strong>Date:</strong> ${colB}</div>
          <div><strong>Member:</strong> ${colC}</div>
          <div><strong>LIVE:</strong> ${colD}</div>
          <div><strong>Duration:</strong> ${colE}</div>
        `;
      });
    }

    container.appendChild(card);
  });

  updateButtonStates();
}

function filterByName(rows, filter) {
  if (!filter) return rows;
  const f = filter.toLowerCase();
  return rows.filter(r => (r.c[2]?.v || "").toLowerCase().includes(f));
}

fetch("https://docs.google.com/spreadsheets/d/1jXjnPCKMrbGBhk0wUBLv66YAhcIWO2xZ2yTTL1-LMIM/gviz/tq?tqx=out:json")
  .then(res => res.text())
  .then(text => {
    const json = JSON.parse(text.substr(47).slice(0, -2));
    table1AllRows = json.table.rows;
    filteredRows = table1AllRows;
    currentPage = 0;
    buildTable1Grid(filteredRows, currentPage);
  })
  .catch(e => {
    console.error("Failed to load Google Sheet data:", e);
  });

document.getElementById("nextBtn").addEventListener("click", () => {
  const maxPage = Math.floor((filteredRows.length - 1) / rowsPerPage);
  if (currentPage < maxPage) {
    currentPage++;
    buildTable1Grid(filteredRows, currentPage);
  }
});
document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    buildTable1Grid(filteredRows, currentPage);
  }
});

document.getElementById('searchBox').addEventListener('input', function () {
  filteredRows = filterByName(table1AllRows, this.value);
  currentPage = 0;
  buildTable1Grid(filteredRows, currentPage);
});

closeModalBtn.addEventListener('click', () => {
  youtubeModal.classList.remove('show');
  modalContent.src = '';
});
youtubeModal.addEventListener('click', (e) => {
  if (e.target === youtubeModal) {
    youtubeModal.classList.remove('show');
    modalContent.src = '';
  }
});
document.addEventListener('keydown', e => {
  if (e.key === "Escape" && youtubeModal.classList.contains('show')) {
    youtubeModal.classList.remove('show');
    modalContent.src = '';
  }
});