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
const rowsPerPage = 12;

const youtubeModal = document.getElementById("youtubeModal");
const modalContent = document.getElementById("youtubeFrame");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalInfoPanel = document.getElementById("modalInfoPanel");

function getColorForName(name) {
  return nameColorMap[name] || "";
}

function updateButtonStates() {
  const maxPage = Math.floor((filteredRows.length - 1) / rowsPerPage);
  document.getElementById("prevBtn").disabled = currentPage === 0;
  document.getElementById("nextBtn").disabled = currentPage >= maxPage;
  document.getElementById("pageDisplay").textContent = `Page ${currentPage + 1} of ${maxPage + 1}`;
}

function buildTable(elementId, colIndexes, allRows, page = 0, limit = null) {
  const table = document.getElementById(elementId);
  table.innerHTML = '';

  const header = table.insertRow();
  colIndexes.forEach(i => {
    const th = document.createElement('th');
    th.innerText = jsonCols[i] || `Col ${i+1}`;
    header.appendChild(th);
  });

  const start = page * limit;
  const sliced = limit ? allRows.slice(start, start + limit) : allRows;

  sliced.forEach(r => {
    const row = table.insertRow();
    row.style.transition = "all 0.3s ease";

    colIndexes.forEach(i => {
      const cell = row.insertCell();
      const text = r.c[i]?.f || r.c[i]?.v || '';

      if ((elementId === "table1" && i === 2)) {
        const nameTextColorMap = {
          SeoYeon: "#000000", HyeRin: "#ffffff", JiWoo: "#000000", ChaeYeon: "#ffffff", YooYeon: "#ffffff", SooMin: "#ffffff", NaKyoung: "#ffffff", YuBin: "#000000", Kaede: "#000000", DaHyun: "#000000", Kotone: "#000000", YeonJi: "#000000", Nien: "#000000", SoHyun: "#ffffff", Xinyu: "#000000", Mayu: "#000000", Lynn: "#000000", JooBin: "#000000", HaYeon: "#000000", ShiOn: "#000000", ChaeWon: "#000000", Sullin: "#000000", SeoAh: "#000000", JiYeon: "#000000"
        };
        const badge = document.createElement('span');
        const bgColor = getColorForName(text);
        const textColor = nameTextColorMap[text];

        badge.className = 'color-badge';
        badge.style.backgroundColor = bgColor;
        badge.style.color = textColor;
        badge.textContent = text;
        cell.appendChild(badge);
      } else {
        cell.innerText = text;
      }
    });
  });
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

function buildRankingGrid(containerId, rows, memberColIndex, extraIndexes = []) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'ranking-grid';

  rows.slice(0, 24).forEach((r, idx) => {
    const name = r.c[memberColIndex]?.v || '';
    const avatar = profileImageUrl[name] || '';
    const color = nameColorMap[name] || '#ccc';

    const card = document.createElement('div');
    card.className = 'ranking-card';
    card.style.borderColor = color;

    const img = document.createElement('img');
    img.src = avatar;
    img.alt = name;
    img.className = 'ranking-avatar';

    const rank = document.createElement('div');
    rank.className = 'ranking-rank';
    rank.textContent = `#${idx + 1}`;

    const displayName = document.createElement('div');
    displayName.className = 'ranking-name';
    displayName.textContent = name;

    const extras = document.createElement('div');
    extras.className = 'ranking-extras';
    extras.innerHTML = extraIndexes.map(i => {
      let val = r.c[i]?.f || r.c[i]?.v || '';
      if (i === 16) val += ' Lives';       // Append "lives" for column 14
      if (i === 19) val = 'Avg ' + val;    // Prepend "AVG" for column 17
      return `<div>${val}</div>`;
    }).join('');

    card.appendChild(rank);
    card.appendChild(img);
    card.appendChild(displayName);
    card.appendChild(extras);

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

fetch("https://docs.google.com/spreadsheets/d/1jXjnPCKMrbGBhk0wUBLv66YAhcIWO2xZ2yTTL1-LMIM/gviz/tq?tqx=out:json")
  .then(res => res.text())
  .then(text => {
    const json = JSON.parse(text.substr(47).slice(0, -2));
    const rows = json.table.rows;
    jsonCols = json.table.cols.map(col => col.label);

    table1AllRows = rows;
    filteredRows = rows;

    currentPage = Math.floor((filteredRows.length - 1) / rowsPerPage);
    
    buildTable1Grid(filteredRows, currentPage);
    buildRankingGrid("table2", rows, 15, [16,17,19]);
    buildRankingGrid("table3", rows, 23, [24,25]);
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

const searchBox = document.getElementById('searchBox');
const suggestionsBox = document.getElementById('suggestions');

searchBox.addEventListener('input', function () {
  const query = this.value.toLowerCase();
  currentPage = 0;
  filteredRows = table1AllRows.filter(r => {
    const val = (r.c[2]?.v || '').toString().toLowerCase();
    return val.includes(query);
  });

  updateButtonStates();

  if (!query) {
    suggestionsBox.classList.remove('active');
    suggestionsBox.innerHTML = '';
    return;
  }

  const matches = memberNames.filter(name => name.toLowerCase().includes(query));
  suggestionsBox.innerHTML = matches.map(name => `<div>${name}</div>`).join('');
  suggestionsBox.classList.toggle('active', matches.length > 0);
});

suggestionsBox.addEventListener('click', function(e) {
  if (e.target.tagName === 'DIV') {
    const selectedName = e.target.textContent;
    searchBox.value = selectedName;
    searchBox.dispatchEvent(new Event('input'));
    suggestionsBox.innerHTML = '';
    suggestionsBox.classList.remove('active');
  }
});