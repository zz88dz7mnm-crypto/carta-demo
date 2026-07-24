(function () {
  var currentFile = window.location.pathname.split("/").pop() || "index.html";
  var isAdmin = currentFile === "admin.html";

  var links = [
    {
      href: "index.html",
      label: "Inicio",
      icon: '<path d="M3 12L12 3l9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21V12h6v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    },
    {
      href: "platos.html",
      label: "Platos",
      icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    },
    {
      href: "bebidas.html",
      label: "Bebidas",
      icon: '<path d="M8 2h8l-1 7H9L8 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 9c0 5 6 5 6 10H9c0-5 6-5 6-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><line x1="6" y1="22" x2="18" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    },
    {
      href: "sin-gluten.html",
      label: "Sin gluten",
      icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    },
    {
      href: "postres.html",
      label: "Postres",
      icon: '<path d="M4 11h16a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-1a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 5c0-2 6-2 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    },
  ];

  function makeLink(href, label, iconPath, action) {
    var el = document.createElement(action ? "button" : "a");
    if (href) el.href = href;
    if (action) {
      el.type = "button";
      el.setAttribute("data-action", action);
    }
    el.className =
      "nav-drawer__link" +
      (currentFile === href ? " nav-drawer__link--active" : "");
    el.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + iconPath + "</svg>" + label;
    el.addEventListener("click", close);
    return el;
  }

  function buildDrawer() {
    var overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    overlay.addEventListener("click", close);

    var drawer = document.createElement("nav");
    drawer.className = "nav-drawer";
    drawer.setAttribute("aria-label", "Menú de navegación");

    // Header
    var head = document.createElement("div");
    head.className = "nav-drawer__head";
    head.innerHTML =
      '<img src="assets/brand/levels-mark-white.png" alt="Levels Bar">' +
      "<strong>Levels Bar</strong>";
    drawer.appendChild(head);

    // Carta links
    var section = document.createElement("div");
    section.className = "nav-drawer__section";
    var cartaLabel = document.createElement("p");
    cartaLabel.className = "nav-drawer__label";
    cartaLabel.textContent = "Carta";
    section.appendChild(cartaLabel);

    links.forEach(function (item) {
      section.appendChild(makeLink(item.href, item.label, item.icon, null));
    });

    drawer.appendChild(section);

    // Admin section: Configuración + Cerrar sesión (solo en admin.html, cuando el app esté visible)
    if (isAdmin) {
      var adminSection = document.createElement("div");
      adminSection.className = "nav-drawer__section";
      adminSection.id = "nav-drawer-admin-section";
      adminSection.hidden = true;

      var divider = document.createElement("div");
      divider.className = "nav-drawer__divider";
      adminSection.appendChild(divider);

      var adminLabel = document.createElement("p");
      adminLabel.className = "nav-drawer__label";
      adminLabel.textContent = "Admin";
      adminSection.appendChild(adminLabel);

      adminSection.appendChild(
        makeLink(
          null,
          "Configuración",
          '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="2"/>',
          "open-settings"
        )
      );

      adminSection.appendChild(
        makeLink(
          null,
          "Cerrar sesión",
          '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 17 21 12 16 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
          "logout"
        )
      );

      drawer.appendChild(adminSection);

      // Show admin section only when the admin app panel is visible
      var observer = new MutationObserver(function () {
        var app = document.getElementById("admin-app");
        if (app) adminSection.hidden = app.hidden;
      });
      document.addEventListener("DOMContentLoaded", function () {
        var app = document.getElementById("admin-app");
        if (app) {
          adminSection.hidden = app.hidden;
          observer.observe(app, { attributes: true, attributeFilter: ["hidden"] });
        }
      });
    }

    // Footer WhatsApp (solo en páginas de carta, no en admin)
    if (!isAdmin) {
      var footer = document.createElement("div");
      footer.className = "nav-drawer__footer";
      footer.innerHTML =
        '<a href="https://wa.me/5493511234567?text=Hola%2C%20quiero%20hacer%20una%20reserva" target="_blank" rel="noopener noreferrer">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Z"/></svg>' +
        "Reservar por WhatsApp" +
        "</a>";
      drawer.appendChild(footer);
    }

    // Toggle button
    var toggle = document.createElement("button");
    toggle.className = "nav-toggle";
    toggle.setAttribute("aria-label", "Abrir menú");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML =
      '<span class="nav-toggle__icon"><span></span><span></span><span></span></span>';
    toggle.addEventListener("click", function () {
      document.body.classList.contains("nav-open") ? close() : open();
    });

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.body.appendChild(toggle);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function open() {
    document.body.classList.add("nav-open");
    document.querySelector(".nav-toggle").setAttribute("aria-expanded", "true");
  }

  function close() {
    document.body.classList.remove("nav-open");
    document.querySelector(".nav-toggle").setAttribute("aria-expanded", "false");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildDrawer);
  } else {
    buildDrawer();
  }
})();
