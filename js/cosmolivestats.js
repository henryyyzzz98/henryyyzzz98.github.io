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

const memberNames = Object.keys(nameColorMap);
let table1AllRows = [], filteredRows = [], currentPage = 0, rowsPerPage = 10;
let jsonCols = [];

function getColorForName(name) {
    return nameColorMap[name] || '';
}

function updateButtonStates() {
    const maxPage = Math.floor((filteredRows.length - 1) / rowsPerPage);
    document.getElementById("prevBtn").disabled = currentPage === 0;
    document.getElementById("nextBtn").disabled = currentPage >= maxPage;
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
        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = getColorForName(text);
        cell.appendChild(dot);
        cell.appendChild(document.createTextNode(text));
      } else {
        cell.innerText = text;
      }
    });
  });

  if (elementId === "table1") {
    const totalPages = Math.ceil(allRows.length / limit);
    document.getElementById("pageDisplay").innerText = `Page ${page + 1} of ${totalPages}`;
  }
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
      if (i === 14) val += ' Lives';       // Append "lives" for column 14
      if (i === 17) val = 'Avg ' + val;    // Prepend "AVG" for column 17
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

    buildTable("table1", [0,1,2,3,4], filteredRows, currentPage, rowsPerPage);
    buildRankingGrid("table2", rows, 13, [14,15,17]);
    buildRankingGrid("table3", rows, 21, [22,23]);
  });

document.getElementById("nextBtn").addEventListener("click", () => {
  const maxPage = Math.floor((filteredRows.length - 1) / rowsPerPage);
  if (currentPage < maxPage) {
    currentPage++;
    buildTable("table1", [0,1,2,3,4], filteredRows, currentPage, rowsPerPage);
    updateButtonStates();
  }
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    buildTable("table1", [0,1,2,3,4], filteredRows, currentPage, rowsPerPage);
    updateButtonStates();
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

  buildTable("table1", [0,1,2,3,4], filteredRows, currentPage, rowsPerPage);
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

document.addEventListener('click', (e) => {
  if (!suggestionsBox.contains(e.target) && e.target !== searchBox) {
    suggestionsBox.classList.remove('active');
  }
});