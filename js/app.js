const App = {
  cache: null,

  selectedKey: "selectedObjekt",

  async init() {
    if (this.cache) {
      return this.cache;
    }

    try {
      const [artms, idntt, triples] = await Promise.all([
        fetch("json/allartms.json").then((r) => r.json()),
        fetch("json/allidntt.json").then((r) => r.json()),
        fetch("json/alltriples.json").then((r) => r.json()),
      ]);

      this.cache = {
        artms,
        idntt,
        triples,
      };

      return this.cache;
    } catch (error) {
      console.error("Failed to load JSON files", error);
      throw error;
    }
  },

  getGroup(group) {
    if (!this.cache) return [];
    return this.cache[group] || [];
  },

  saveSelection(objekt) {
    localStorage.setItem(this.selectedKey, JSON.stringify(objekt));
  },

  getSelection() {
    const data = localStorage.getItem(this.selectedKey);
    if (!data) return null;
    return JSON.parse(data);
  },

  search(group, keyword) {
    keyword = keyword.toLowerCase();

    return this.getGroup(group).filter((card) => {
      return (
        card.member.toLowerCase().includes(keyword) ||
        card.name.toLowerCase().includes(keyword) ||
        card.collection.toLowerCase().includes(keyword)
      );
    });
  },
};
