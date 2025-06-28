const nameColorMap = {
      SeoYeon: "#22aeff",
      HyeRin: "#7e00ff",
      JiWoo: "#ffff00",
      ChaeYeon: "#98c64a",
      YooYeon: "#d10a6f",
      SooMin: "#fc83a4",
      NaKyoung: "#6599a4",
      YuBin: "#ffe3e2",
      Kaede: "#ffc935",
      DaHyun: "#ff9ad6",
      Kotone: "#fde000",
      YeonJi: "#5974ff",
      Nien: "#ff953f",
      SoHyun: "#1222b5",
      Xinyu: "#d51313",
      Mayu: "#fe8e76",
      Lynn: "#ab61b8",
      JooBin: "#b8f54d",
      HaYeon: "#52d9ba",
      ShiOn: "#ff428a",
      ChaeWon: "#c7a3e0",
      Sullin: "#7aba8c",
      SeoAh: "#cff2ff",
      JiYeon: "#ffab61"
    };

    const memberNames = Object.keys(nameColorMap);
    let table1AllRows = [], filteredRows = [], currentPage = 0, rowsPerPage = 12;

    function getColorForName(name) {
      return nameColorMap[name] || '';
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

          if ((elementId === "table1" && i === 2) || (elementId === "table2" && i === 13) || (elementId === "table3" && i === 21)) {
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
    }

    let jsonCols = [];

    fetch("https://docs.google.com/spreadsheets/d/1jXjnPCKMrbGBhk0wUBLv66YAhcIWO2xZ2yTTL1-LMIM/gviz/tq?tqx=out:json")
      .then(res => res.text())
      .then(text => {
        const json = JSON.parse(text.substr(47).slice(0, -2));
        const rows = json.table.rows;
        jsonCols = json.table.cols.map(col => col.label);

      function buildTable(elementId, colIndexes, allRows, page = 0, limit = null) {
        const table = document.getElementById(elementId);
        table.innerHTML = ''; // clear previous content

        // Create header row
        const header = table.insertRow();
        colIndexes.forEach(i => {
          const th = document.createElement('th');
          th.innerText = json.table.cols[i]?.label || ``;
          header.appendChild(th);
        });

        const start = page * limit;
        const sliced = limit ? allRows.slice(start, start + limit) : allRows;

        sliced.forEach(r => {
          const row = table.insertRow();
          colIndexes.forEach(i => {
            const cell = row.insertCell();
            const text = r.c[i]?.f || r.c[i]?.v || '';

            if ((elementId === "table1" && i === 2) || (elementId === "table2" && i === 13) || (elementId === "table3" && i === 21)) {
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
      }

        // Store all rows for table1 to enable search filtering
        table1AllRows = rows;
        filteredRows = rows;

        // Initial render for table1 with all rows
        buildTable("table1", [0,1,2,3,4], filteredRows, currentPage, rowsPerPage);

        // Table 2: L to R → Index 11–17, limit 24 rows
        buildTable("table2", [11, 13, 14, 15, 17], rows, 0, 24);

        // Table 3: T to X → Index 19,21,22,23, limit 24 rows
        buildTable("table3", [19, 21, 22, 23], rows, 0, 24);
      });

      document.getElementById("nextBtn").addEventListener("click", () => {
        const maxPage = Math.floor(filteredRows.length / rowsPerPage);
        if (currentPage < maxPage) {
          currentPage++;
          buildTable("table1", [0,1,2,3,4], filteredRows, currentPage, rowsPerPage);
        }
      });
      
      document.getElementById("prevBtn").addEventListener("click", () => {
        if (currentPage > 0) {
          currentPage--;
          buildTable("table1", [0,1,2,3,4], filteredRows, currentPage, rowsPerPage);
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