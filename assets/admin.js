(function () {
  const CHANNEL_NAME = "levels-menu-updates";
  const editor = document.querySelector("#editor");
  const pageNav = document.querySelector("#page-nav");
  const saveState = document.querySelector("#save-state");
  const searchInput = document.querySelector("#admin-search");
  const searchResults = document.querySelector("#admin-search-results");
  const login = document.querySelector("#admin-login");
  const app = document.querySelector("#admin-app");
  const loginForm = document.querySelector("#admin-login-form");
  const loginError = document.querySelector("#admin-login-error");
  const loginUser = document.querySelector("#admin-user");
  const loginPass = document.querySelector("#admin-pass");
  const passwordGate = document.querySelector("#admin-password-gate");
  const passwordForm = document.querySelector("#admin-password-form");
  const passwordError = document.querySelector("#admin-password-error");
  const currentPassInput = document.querySelector("#admin-current-pass");
  const newPassInput = document.querySelector("#admin-new-pass");
  const settingsModal = document.querySelector("#admin-settings");
  const usernameForm = document.querySelector("#admin-username-form");
  const usernameError = document.querySelector("#admin-username-error");
  const newUsernameInput = document.querySelector("#admin-new-username");
  const usernameCurrentPassInput = document.querySelector("#admin-username-current-pass");
  const passwordFormModal = document.querySelector("#admin-password-form-modal");
  const passwordModalError = document.querySelector("#admin-password-modal-error");
  const modalCurrentPassInput = document.querySelector("#admin-modal-current-pass");
  const modalNewPassInput = document.querySelector("#admin-modal-new-pass");
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  let data = null;
  let activeTarget = "cards";
  let pendingFocusId = "";
  let passwordGateForced = false;
  let saveTimer = null;
  let currentUsername = "";

  // ---------------------------------------------------------------------
  // Llamadas a la API
  // ---------------------------------------------------------------------

  async function api(path, options) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }
    if (!response.ok) {
      const message = (body && body.error) || `Error (${response.status})`;
      throw Object.assign(new Error(message), { status: response.status });
    }
    return body;
  }

  function fetchSession() {
    return api("/api/session");
  }

  function fetchMenu() {
    return api("/api/menu");
  }

  function persistMenu() {
    return api("/api/menu", { method: "PUT", body: JSON.stringify(data) });
  }

  function login_(username, password) {
    return api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
  }

  function logout_() {
    return api("/api/logout", { method: "POST" });
  }

  function changePassword(currentPassword, newPassword) {
    return api("/api/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
  }

  function changeUsername(newUsername, currentPassword) {
    return api("/api/change-username", { method: "POST", body: JSON.stringify({ newUsername, currentPassword }) });
  }

  // ---------------------------------------------------------------------
  // Guardado (con debounce para no golpear la API en cada tecla)
  // ---------------------------------------------------------------------

  function flashToast(message) {
    saveState.textContent = message;
    saveState.classList.add("is-visible");
    window.clearTimeout(saveState._timer);
    saveState._timer = window.setTimeout(() => {
      saveState.classList.remove("is-visible");
    }, 1400);
  }

  async function persistNow(message) {
    try {
      await persistMenu();
      if (channel) channel.postMessage({ type: "updated" });
      flashToast(message || "Guardado");
    } catch (error) {
      console.error("[admin] no se pudo guardar:", error);
      flashToast(error.status === 401 ? "Sesión vencida, volvé a entrar" : "Error al guardar");
      if (error.status === 401) {
        window.setTimeout(() => window.location.reload(), 1200);
      }
    }
  }

  function saveDebounced(message) {
    flashToast(message || "Guardando...");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => persistNow(message), 450);
  }

  function saveImmediate(message) {
    window.clearTimeout(saveTimer);
    return persistNow(message);
  }

  // ---------------------------------------------------------------------
  // Helpers de edicion (sin cambios respecto de la version anterior)
  // ---------------------------------------------------------------------

  function byPath(path) {
    return path.reduce((current, key) => current[key], data);
  }

  function setByPath(path, value) {
    const last = path[path.length - 1];
    const parent = byPath(path.slice(0, -1));
    parent[last] = value;
  }

  function button(label, action, extraClass) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `admin-icon-button${extraClass ? ` ${extraClass}` : ""}`;
    node.textContent = label;
    node.dataset.action = action;
    return node;
  }

  function actionButton(text, action) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "admin-button";
    node.textContent = text;
    node.dataset.action = action;
    return node;
  }

  function field(label, path, value, options) {
    const wrap = document.createElement("div");
    wrap.className = "admin-field";
    const labelNode = document.createElement("label");
    labelNode.textContent = label;
    wrap.appendChild(labelNode);

    const input = options && options.textarea ? document.createElement("textarea") : document.createElement("input");
    if (!(options && options.textarea)) input.type = "text";
    input.value = value || "";
    input.dataset.bind = JSON.stringify(path);
    wrap.appendChild(input);
    return wrap;
  }

  function check(label, path, checked) {
    const wrap = document.createElement("label");
    wrap.className = "admin-switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(checked);
    input.dataset.bind = JSON.stringify(path);
    const track = document.createElement("span");
    track.className = "admin-switch__track";
    const text = document.createElement("span");
    text.className = "admin-switch__label";
    text.textContent = label;
    wrap.append(input, track, text);
    return wrap;
  }

  function bindPath(node, path) {
    node.dataset.path = JSON.stringify(path);
    return node;
  }

  function dragHandle(arrayPath, index) {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "admin-drag-handle";
    handle.draggable = true;
    handle.setAttribute("aria-label", "Arrastrar para reordenar");
    handle.dataset.action = "drag";
    handle.dataset.index = index;
    bindPath(handle, arrayPath);
    handle.innerHTML = "<span></span><span></span><span></span><span></span><span></span><span></span>";
    return handle;
  }

  function rowActions(arrayPath, index, canDelete) {
    const actions = document.createElement("div");
    actions.className = "admin-row-actions";

    const up = button("Arriba", "move-up");
    bindPath(up, arrayPath);
    up.dataset.index = index;
    actions.appendChild(up);

    const down = button("Abajo", "move-down");
    bindPath(down, arrayPath);
    down.dataset.index = index;
    actions.appendChild(down);

    if (canDelete) {
      const del = button("Borrar", "delete", "admin-icon-button--danger");
      bindPath(del, arrayPath);
      del.dataset.index = index;
      actions.appendChild(del);
    }

    return actions;
  }

  function renderNav() {
    pageNav.innerHTML = "";

    const foodFiles = ["platos.html", "sin-gluten.html", "postres.html"];
    const beverageFiles = [
      "bebidas-cervezas.html",
      "bebidas-cocktails.html",
      "bebidas-tragos-de-autor.html",
      "bebidas-gin-tonic.html",
      "bebidas-destilados.html",
      "bebidas-vinos.html",
      "bebidas-sin-alcohol.html",
    ];

    function addLabel(text) {
      const label = document.createElement("p");
      label.className = "admin-nav-label";
      label.textContent = text;
      pageNav.appendChild(label);
    }

    function addPage(file, indent) {
      const page = data.pages[file];
      if (!page) return;
      const node = document.createElement("button");
      node.type = "button";
      node.className = `admin-nav${indent ? " admin-nav--sub" : ""}${activeTarget === `page:${file}` ? " is-active" : ""}`;
      node.textContent = page.title;
      node.dataset.target = `page:${file}`;
      pageNav.appendChild(node);
    }

    addLabel("Secciones");
    foodFiles.forEach((file) => addPage(file, false));
    addLabel("Subdivisiones de bebidas");
    beverageFiles.forEach((file) => addPage(file, true));

    document.querySelectorAll(".admin-nav").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.target === activeTarget);
    });
  }

  function renderCardEditor(title, path) {
    const cards = byPath(path);
    editor.innerHTML = "";

    const section = document.createElement("section");
    section.className = "admin-section";
    const head = document.createElement("div");
    head.className = "admin-section-head";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    head.appendChild(h2);
    section.appendChild(head);

    const list = document.createElement("div");
    list.className = "admin-card-list";
    cards.forEach((card, index) => {
      const cardNode = document.createElement("article");
      cardNode.className = "admin-card";
      cardNode.dataset.dropPath = JSON.stringify(path);
      cardNode.dataset.dropIndex = index;

      const cardHead = document.createElement("div");
      cardHead.className = "admin-card-head";
      cardHead.appendChild(dragHandle(path, index));
      const strong = document.createElement("strong");
      strong.textContent = card.label;
      cardHead.appendChild(strong);
      cardHead.appendChild(rowActions(path, index, false));
      cardNode.appendChild(cardHead);

      const grid = document.createElement("div");
      grid.className = "admin-grid admin-grid--single";
      grid.appendChild(field("Nombre visible", [...path, index, "label"], card.label));
      cardNode.appendChild(grid);
      cardNode.appendChild(check("Marcar como agotada", [...path, index, "soldOut"], card.soldOut));
      list.appendChild(cardNode);
    });

    section.appendChild(list);
    editor.appendChild(section);
  }

  function renderPageEditor(file) {
    const page = data.pages[file];
    const pagePath = ["pages", file];
    editor.innerHTML = "";

    const meta = document.createElement("section");
    meta.className = "admin-section";
    const metaHead = document.createElement("div");
    metaHead.className = "admin-section-head";
    const h2 = document.createElement("h2");
    h2.textContent = page.title;
    metaHead.appendChild(h2);
    metaHead.appendChild(check("Seccion completa agotada", [...pagePath, "soldOut"], page.soldOut));
    meta.appendChild(metaHead);

    const metaGrid = document.createElement("div");
    metaGrid.className = "admin-grid";
    metaGrid.appendChild(field("Titulo", [...pagePath, "title"], page.title));
    metaGrid.appendChild(field("Etiqueta", [...pagePath, "eyebrow"], page.eyebrow));
    metaGrid.appendChild(field("Nota superior", [...pagePath, "note"], page.note || "", { textarea: true }));
    meta.appendChild(metaGrid);
    meta.appendChild(actionButton("Agregar seccion", "add-category"));
    editor.appendChild(meta);

    page.groups.forEach((group, groupIndex) => {
      const groupPath = [...pagePath, "groups", groupIndex];
      if (group.label) {
        const groupNode = document.createElement("section");
        groupNode.className = "admin-section";
        groupNode.appendChild(field("Grupo", [...groupPath, "label"], group.label));
        editor.appendChild(groupNode);
      }

      (group.categories || []).forEach((category, categoryIndex) => {
        const categoryPath = [...groupPath, "categories", categoryIndex];
        const categoryNode = document.createElement("article");
        categoryNode.className = "admin-category";
        categoryNode.id = `edit-${category.id}`;

        const categoryHead = document.createElement("div");
        categoryHead.className = "admin-category-head";
        const strong = document.createElement("strong");
        strong.textContent = category.title;
        categoryHead.appendChild(strong);
        categoryHead.appendChild(rowActions([...groupPath, "categories"], categoryIndex, true));
        categoryNode.appendChild(categoryHead);

        const categoryGrid = document.createElement("div");
        categoryGrid.className = "admin-grid";
        categoryGrid.appendChild(field("Nombre de seccion", [...categoryPath, "title"], category.title));
        categoryGrid.appendChild(field("Descripcion", [...categoryPath, "description"], category.description || "", { textarea: true }));
        categoryNode.appendChild(categoryGrid);
        categoryNode.appendChild(check("Marcar seccion agotada", [...categoryPath, "soldOut"], category.soldOut));

        if (!category.items.length) {
          categoryNode.appendChild(empty("No hay productos en esta seccion."));
        }

        category.items.forEach((item, itemIndex) => {
          const itemPath = [...categoryPath, "items", itemIndex];
          const itemNode = document.createElement("article");
          itemNode.className = "admin-item";
          itemNode.id = `edit-${item.id}`;
          itemNode.dataset.dropPath = JSON.stringify([...categoryPath, "items"]);
          itemNode.dataset.dropIndex = itemIndex;

          const itemHead = document.createElement("div");
          itemHead.className = "admin-item-head";
          itemHead.appendChild(dragHandle([...categoryPath, "items"], itemIndex));
          const itemTitle = document.createElement("strong");
          itemTitle.textContent = item.name;
          itemHead.appendChild(itemTitle);
          itemHead.appendChild(rowActions([...categoryPath, "items"], itemIndex, true));
          itemNode.appendChild(itemHead);

          const itemGrid = document.createElement("div");
          itemGrid.className = "admin-grid";
          itemGrid.appendChild(field("Producto", [...itemPath, "name"], item.name));
          itemGrid.appendChild(field("Precio", [...itemPath, "price"], item.price));
          itemGrid.appendChild(field("Descripcion", [...itemPath, "description"], item.description || "", { textarea: true }));
          itemNode.appendChild(itemGrid);
          itemNode.appendChild(check("Marcar producto agotado", [...itemPath, "soldOut"], item.soldOut));
          categoryNode.appendChild(itemNode);
        });

        const add = actionButton("Agregar producto", "add-item");
        bindPath(add, [...categoryPath, "items"]);
        categoryNode.appendChild(add);
        editor.appendChild(categoryNode);
      });
    });
  }

  function empty(text) {
    const node = document.createElement("p");
    node.className = "admin-empty";
    node.textContent = text;
    return node;
  }

  function render() {
    renderNav();
    if (activeTarget === "cards") {
      renderCardEditor("Menu principal", ["cards"]);
    } else if (activeTarget === "beverageCards") {
      renderCardEditor("Bebidas", ["beverageCards"]);
    } else {
      renderPageEditor(activeTarget.replace("page:", ""));
    }

    if (pendingFocusId) {
      const target = document.getElementById(pendingFocusId);
      pendingFocusId = "";
      if (target) {
        target.classList.add("admin-highlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => target.classList.remove("admin-highlight"), 1800);
      }
    }
  }

  function move(path, index, direction) {
    const array = byPath(path);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= array.length) return;
    const [item] = array.splice(index, 1);
    array.splice(nextIndex, 0, item);
  }

  function moveTo(path, fromIndex, toIndex) {
    const array = byPath(path);
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= array.length || toIndex >= array.length) return;
    const [item] = array.splice(fromIndex, 1);
    array.splice(toIndex, 0, item);
  }

  function addCategory() {
    const file = activeTarget.replace("page:", "");
    const page = data.pages[file];
    if (!page.groups.length) page.groups.push({ id: `grupo-${Date.now()}`, label: "", categories: [] });
    const targetGroup = page.groups[page.groups.length - 1];
    targetGroup.categories = targetGroup.categories || [];
    targetGroup.categories.push({
      id: `seccion-${Date.now()}`,
      title: "Nueva seccion",
      description: "",
      soldOut: false,
      items: [],
    });
  }

  function addItem(path) {
    byPath(path).push({
      id: `producto-${Date.now()}`,
      name: "Nuevo producto",
      description: "",
      price: "$0",
      soldOut: false,
    });
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function searchCatalog(query) {
    const needle = normalize(query);
    if (!needle) return [];
    const matches = [];
    Object.entries(data.pages).forEach(([file, page]) => {
      page.groups.forEach((group) => {
        (group.categories || []).forEach((category) => {
          const categoryText = normalize(`${page.title} ${group.label || ""} ${category.title} ${category.description || ""}`);
          if (categoryText.includes(needle)) {
            matches.push({
              type: "Seccion",
              title: category.title,
              detail: page.title,
              target: `page:${file}`,
              focusId: `edit-${category.id}`,
            });
          }
          category.items.forEach((item) => {
            const itemText = normalize(`${page.title} ${group.label || ""} ${category.title} ${item.name} ${item.description || ""} ${item.price || ""}`);
            if (itemText.includes(needle)) {
              matches.push({
                type: "Producto",
                title: item.name,
                detail: `${page.title} / ${category.title} / ${item.price || "sin precio"}`,
                target: `page:${file}`,
                focusId: `edit-${item.id}`,
              });
            }
          });
        });
      });
    });
    return matches.slice(0, 12);
  }

  function renderSearchResults() {
    const matches = searchCatalog(searchInput.value);
    searchResults.innerHTML = "";
    searchResults.hidden = !searchInput.value.trim();
    if (!searchInput.value.trim()) return;
    if (!matches.length) {
      const emptyNode = document.createElement("p");
      emptyNode.className = "admin-search__empty";
      emptyNode.textContent = "No encontre coincidencias.";
      searchResults.appendChild(emptyNode);
      return;
    }
    matches.forEach((match) => {
      const buttonNode = document.createElement("button");
      buttonNode.type = "button";
      buttonNode.className = "admin-search__result";
      buttonNode.dataset.target = match.target;
      buttonNode.dataset.focusId = match.focusId;
      buttonNode.innerHTML = `<span>${match.type}</span><strong></strong><small></small>`;
      buttonNode.querySelector("strong").textContent = match.title;
      buttonNode.querySelector("small").textContent = match.detail;
      searchResults.appendChild(buttonNode);
    });
  }

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target === searchInput) {
      renderSearchResults();
      return;
    }
    if (!target.dataset.bind) return;
    const path = JSON.parse(target.dataset.bind);
    setByPath(path, target.type === "checkbox" ? target.checked : target.value);
    if (target.type === "checkbox") {
      saveImmediate("Guardado");
    } else {
      saveDebounced("Guardando");
    }
    renderNav();
  });

  document.addEventListener("dragstart", (event) => {
    const handle = event.target.closest(".admin-drag-handle");
    if (!handle) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        path: JSON.parse(handle.dataset.path),
        index: Number(handle.dataset.index),
      }),
    );
    handle.closest(".admin-card, .admin-item")?.classList.add("is-dragging");
  });

  document.addEventListener("dragend", (event) => {
    event.target.closest(".admin-card, .admin-item")?.classList.remove("is-dragging");
    document.querySelectorAll(".is-drag-over").forEach((node) => node.classList.remove("is-drag-over"));
  });

  document.addEventListener("dragover", (event) => {
    const target = event.target.closest(".admin-card, .admin-item");
    if (!target || !target.dataset.dropPath) return;
    event.preventDefault();
    target.classList.add("is-drag-over");
  });

  document.addEventListener("dragleave", (event) => {
    event.target.closest(".admin-card, .admin-item")?.classList.remove("is-drag-over");
  });

  document.addEventListener("drop", (event) => {
    const target = event.target.closest(".admin-card, .admin-item");
    if (!target || !target.dataset.dropPath) return;
    event.preventDefault();
    target.classList.remove("is-drag-over");
    const dragged = JSON.parse(event.dataTransfer.getData("application/json") || "{}");
    const dropPath = JSON.parse(target.dataset.dropPath);
    if (JSON.stringify(dragged.path) !== JSON.stringify(dropPath)) return;
    moveTo(dropPath, Number(dragged.index), Number(target.dataset.dropIndex));
    saveImmediate("Orden actualizado");
    render();
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-target], [data-action]");
    if (!target) return;

    if (target.dataset.target) {
      activeTarget = target.dataset.target;
      if (target.dataset.focusId) {
        pendingFocusId = target.dataset.focusId;
        searchResults.hidden = true;
      }
      render();
      return;
    }

    const action = target.dataset.action;
    if (action === "add-category") {
      addCategory();
      saveImmediate("Seccion agregada");
      render();
      return;
    }
    if (action === "add-item") {
      addItem(JSON.parse(target.dataset.path));
      saveImmediate("Producto agregado");
      render();
      return;
    }
    if (action === "move-up" || action === "move-down") {
      move(JSON.parse(target.dataset.path), Number(target.dataset.index), action === "move-up" ? -1 : 1);
      saveImmediate("Orden actualizado");
      render();
      return;
    }
    if (action === "delete") {
      if (!window.confirm("Borrar este elemento?")) return;
      byPath(JSON.parse(target.dataset.path)).splice(Number(target.dataset.index), 1);
      saveImmediate("Borrado");
      render();
      return;
    }
    if (action === "logout") {
      logout_().finally(() => window.location.reload());
      return;
    }
    if (action === "open-settings") {
      openSettings();
      return;
    }
    if (action === "close-settings") {
      closeSettings();
    }
  });

  function openSettings() {
    usernameError.hidden = true;
    passwordModalError.hidden = true;
    newUsernameInput.value = currentUsername;
    usernameCurrentPassInput.value = "";
    modalCurrentPassInput.value = "";
    modalNewPassInput.value = "";
    settingsModal.hidden = false;
  }

  function closeSettings() {
    settingsModal.hidden = true;
  }

  usernameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    usernameError.hidden = true;
    try {
      const result = await changeUsername(newUsernameInput.value.trim(), usernameCurrentPassInput.value);
      currentUsername = result.username;
      usernameCurrentPassInput.value = "";
      flashToast("Usuario actualizado");
    } catch (error) {
      usernameError.textContent = error.message || "No se pudo cambiar el usuario.";
      usernameError.hidden = false;
    }
  });

  passwordFormModal.addEventListener("submit", async (event) => {
    event.preventDefault();
    passwordModalError.hidden = true;
    try {
      await changePassword(modalCurrentPassInput.value, modalNewPassInput.value);
      modalCurrentPassInput.value = "";
      modalNewPassInput.value = "";
      flashToast("Clave actualizada");
    } catch (error) {
      passwordModalError.textContent = error.message || "No se pudo cambiar la clave.";
      passwordModalError.hidden = false;
    }
  });

  // ---------------------------------------------------------------------
  // Autenticacion
  // ---------------------------------------------------------------------

  function showScreen(name) {
    login.hidden = name !== "login";
    passwordGate.hidden = name !== "password";
    app.hidden = name !== "app";
  }

  function openPasswordGate() {
    passwordError.hidden = true;
    currentPassInput.value = "";
    newPassInput.value = "";
    showScreen("password");
    currentPassInput.focus();
  }

  async function loadAndShowApp() {
    data = await fetchMenu();
    showScreen("app");
    render();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.hidden = true;
    try {
      const result = await login_(loginUser.value.trim(), loginPass.value);
      currentUsername = loginUser.value.trim().toLowerCase();
      loginPass.value = "";
      if (result.mustChangePassword) {
        passwordGateForced = true;
        openPasswordGate();
      } else {
        await loadAndShowApp();
      }
    } catch (error) {
      loginError.textContent = error.message || "Usuario o clave incorrectos.";
      loginError.hidden = false;
      loginPass.value = "";
      loginPass.focus();
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    passwordError.hidden = true;
    try {
      await changePassword(currentPassInput.value, newPassInput.value);
      currentPassInput.value = "";
      newPassInput.value = "";
      if (passwordGateForced || !data) {
        passwordGateForced = false;
        await loadAndShowApp();
      } else {
        showScreen("app");
      }
      flashToast("Clave actualizada");
    } catch (error) {
      passwordError.textContent = error.message || "No se pudo cambiar la clave.";
      passwordError.hidden = false;
    }
  });

  (async function boot() {
    try {
      const session = await fetchSession();
      if (!session.authenticated) {
        showScreen("login");
        loginUser.focus();
        return;
      }
      currentUsername = session.username;
      if (session.mustChangePassword) {
        passwordGateForced = true;
        openPasswordGate();
        return;
      }
      await loadAndShowApp();
    } catch (error) {
      console.error("[admin] no se pudo verificar la sesion:", error);
      showScreen("login");
    }
  })();
})();
