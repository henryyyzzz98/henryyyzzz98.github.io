const grid = document.getElementById("grid");
const loading = document.getElementById("loading");
const searchInput = document.getElementById("search");
const tabs = document.querySelectorAll(".tab");
const backButton = document.getElementById("backButton");

const memberFilter = document.getElementById("memberFilter");
const seasonFilter = document.getElementById("seasonFilter");

const FILTERS = {
  triples: {
    members: ["SeoYeon", "HyeRin", "JiWoo", "ChaeYeon", "YooYeon", "SooMin", "NaKyoung", "YuBin", "Kaede", "DaHyun", "Kotone", "YeonJi", "Nien", "SoHyun", "Xinyu", "Mayu", "Lynn", "JooBin", "HaYeon", "ShiOn", "ChaeWon", "Sullin", "SeoAh", "JiYeon"],
    seasons: [
      "Atom01",
      "Binary01",
      "Cream01",
      "Divine01",
      "Ever01",
      "Atom02",
      "Binary02",
      "Cream02",
    ],
  },

  artms: {
    members: ["HeeJin", "HaSeul", "KimLip", "JinSoul", "Choerry"],
    seasons: [
      "Atom01",
      "Binary01",
      "Cream01",
      "Divine01",
      "Ever01",
      "Atom02"
    ],
  },

  idntt: {
    members: ["DoHun", "HeeJu", "TaeIn", "JaeYoung", "JuHo", "JiWoon", "HwanHee", "CheongMyeong", "Towa", "KyuHyuk", "NuRi", "SeongJun", "YeJoon", "GyeongBeen", "EunSoo", "GiWoong", "JooHeon", "GyungHo", "EunChan", "EunSung"],
    seasons: ["Summer25", "Autumn25", "Winter26", "Spring26","Summer26"],
  },
};

const state = {
  activeGroup: "triples",
  searchText: "",
  member: "",
  season: "",
};

function populateFilters() {
  const config = FILTERS[state.activeGroup];

  memberFilter.innerHTML = `
        <option value="">Select Member</option>
    `;

  seasonFilter.innerHTML = `
        <option value="">Select Season</option>
    `;

  config.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member;
    option.textContent = member;
    memberFilter.appendChild(option);
  });

  config.seasons.forEach((season) => {
    const option = document.createElement("option");
    option.value = season;
    option.textContent = season;
    seasonFilter.appendChild(option);
  });
}

function render() {
  grid.innerHTML = "";

  let cards = App.getGroup(state.activeGroup);

  const hasFilter =
    state.searchText.trim() !== "" ||
    state.member !== "" ||
    state.season !== "";

  if (!hasFilter) {
    grid.innerHTML = `
            <div class="empty">
                Select a member, season, or search to view Objekts
            </div>
        `;
    return;
  }

  // Search filter
  if (state.searchText.trim() !== "") {
    const search = state.searchText.toLowerCase();

    cards = cards.filter(
      (card) =>
        card.name.toLowerCase().includes(search) ||
        card.member.toLowerCase().includes(search),
    );
  }

  // Member filter
  if (state.member) {
    cards = cards.filter((card) => card.member === state.member);
  }

  // Season filter
  if (state.season) {
    cards = cards.filter((card) =>
      card.name.startsWith(state.season),
    );
  }

  if (!cards.length) {
    grid.innerHTML = `
            <div class="empty">
                No Objekts found
            </div>
        `;
    return;
  }

  const fragment = document.createDocumentFragment();

  cards.forEach((card) => {
    const cardElement = document.createElement("div");
    cardElement.className = "objekt-card";

    cardElement.innerHTML = `
            <img src="${card.image}" alt="${card.name}">
            <div class="info">
                <div class="member">${card.member}</div>
                <div class="collection">${card.name}</div>
            </div>
        `;

    cardElement.addEventListener("click", () => {
      App.saveSelection({
        ...card,
        sourceGroup: state.activeGroup,
      });

      window.location.href = "index.html";
    });

    fragment.appendChild(cardElement);
  });

  grid.appendChild(fragment);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelector(".tab.active").classList.remove("active");

    tab.classList.add("active");

    state.activeGroup = tab.dataset.group;
    state.member = "";
    state.season = "";
    state.searchText = "";

    searchInput.value = "";
    memberFilter.value = "";
    seasonFilter.value = "";

    populateFilters();
    render();
  });
});

searchInput.addEventListener("input", (e) => {
  state.searchText = e.target.value;
  render();
});

memberFilter.addEventListener("change", (e) => {
  state.member = e.target.value;
  render();
});

seasonFilter.addEventListener("change", (e) => {
  state.season = e.target.value;
  render();
});

if (backButton) {
  backButton.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

async function init() {
  try {
    loading.style.display = "block";
    grid.style.display = "none";

    await App.init();

    populateFilters();

    loading.style.display = "none";
    grid.style.display = "grid";

    render();
  } catch (error) {
    console.error(error);

    loading.innerHTML = `
            Failed to load Objekt data
        `;
  }
}

init();
