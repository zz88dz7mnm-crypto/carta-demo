(function () {
  const CHANNEL_NAME = "levels-menu-updates";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function getData() {
    try {
      const response = await fetch("/api/menu", { cache: "no-store" });
      if (!response.ok) throw new Error("bad-status");
      return await response.json();
    } catch (error) {
      // Sitio servido como estatico puro (sin server.js corriendo): usamos
      // la carta embebida en assets/menu-data.js como respaldo.
      return clone(window.DEFAULT_MENU_DATA || {});
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderCards(grid, cards) {
    grid.innerHTML = "";
    cards.forEach((card) => {
      const link = el("a", `section-card${card.soldOut ? " section-card--sold-out" : ""}`);
      link.href = card.soldOut ? "#" : card.href;
      if (card.soldOut) {
        link.setAttribute("aria-disabled", "true");
        link.addEventListener("click", (event) => event.preventDefault());
      }
      if (card.imagePosition) link.style.setProperty("--image-position", card.imagePosition);

      const image = el("img");
      image.src = card.image;
      image.alt = "";
      link.appendChild(image);

      link.appendChild(el("span", "", card.label));
      if (card.soldOut) link.appendChild(el("em", "sold-out-badge", "Agotado"));
      grid.appendChild(link);
    });
  }

  function renderCategory(category) {
    const article = el("article", `category${category.soldOut ? " category--sold-out" : ""}`);
    const head = el("div", "category__head");
    head.appendChild(el("h3", "", category.title));
    if (category.description) head.appendChild(el("p", "", category.description));
    if (category.soldOut) head.appendChild(el("em", "sold-out-badge sold-out-badge--inline", "Agotado"));
    article.appendChild(head);

    const itemsWrap = el("div", "items");
    category.items.forEach((item) => {
      const row = el("div", `item${item.soldOut || category.soldOut ? " item--sold-out" : ""}`);
      const content = el("div");
      content.appendChild(el("strong", "", item.name));
      if (item.description) content.appendChild(el("span", "", item.description));
      row.appendChild(content);
      row.appendChild(el("b", "", item.soldOut || category.soldOut ? "Agotado" : item.price));
      itemsWrap.appendChild(row);
    });
    article.appendChild(itemsWrap);
    return article;
  }

  function renderMenuPage(section, page) {
    const heading = section.querySelector(".section-heading");
    section.innerHTML = "";
    if (heading) {
      const eyebrow = heading.querySelector("p");
      const title = heading.querySelector("h2");
      if (eyebrow) eyebrow.textContent = page.eyebrow || eyebrow.textContent;
      if (title) title.textContent = page.title || title.textContent;
      section.appendChild(heading);
    }

    if (page.soldOut) {
      const note = el("p", "menu-note menu-note--sold-out", "Esta sección está agotada por el momento.");
      section.appendChild(note);
      return;
    }

    if (page.note) section.appendChild(el("p", "menu-note", page.note));
    page.groups.forEach((group) => {
      if (group.label) section.appendChild(el("p", "menu-group", group.label));
      (group.categories || []).forEach((category) => section.appendChild(renderCategory(category)));
    });
  }

  function currentFile() {
    const file = window.location.pathname.split("/").pop() || "index.html";
    return file === "" ? "index.html" : file;
  }

  async function render() {
    const data = await getData();
    const file = currentFile();

    if (file === "index.html") {
      const grid = document.querySelector("#carta .section-picker__grid");
      if (grid && data.cards) renderCards(grid, data.cards);
      return;
    }

    if (file === "bebidas.html") {
      const grid = document.querySelector("#bebidas .section-picker__grid");
      if (grid && data.beverageCards) renderCards(grid, data.beverageCards);
      return;
    }

    const page = data.pages && data.pages[file];
    const section = document.querySelector(".menu-section");
    if (page && section) renderMenuPage(section, page);
  }

  window.LevelsMenu = {
    CHANNEL_NAME,
    getData,
    render,
  };

  render();

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", render);
  }
})();
