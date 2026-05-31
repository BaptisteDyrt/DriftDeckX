import { listPresets } from "./storage.js";
import { MODELS } from "./data/models.js";
import {
  getState,
  subscribe,
  showDashboard,
  showAddSetupForm
} from "./state.js";
import { renderSidebar, attachSidebarEvents } from "./ui/sidebar.js";
import { mountForm, isFormActive, requestNavigation } from "./ui/form.js";
import { mountPresetView } from "./ui/preset-view.js";
import { mountDashboard } from "./ui/dashboard.js";
import { attachKeyboardShortcuts } from "./shortcuts.js";

function renderMainPanel(state) {
  const panel = document.getElementById("main-panel");
  if (!panel) {
    console.error("[main] Container #main-panel introuvable.");
    return;
  }

  if (state.view === "dashboard") {
    mountDashboard(panel);
    return;
  }

  if (state.view === "add-setup") {
    mountForm(panel);
    return;
  }

  if (state.view === "edit-setup") {
    if (!state.activePresetId) {
      console.warn("[main] view=edit-setup sans activePresetId, fallback Dashboard");
      panel.innerHTML = "";
      return;
    }

    listPresets().then(allPresets => {
      const preset = allPresets.find(p => p.id === state.activePresetId);
      if (!preset) {
        console.warn("[main] Preset à éditer introuvable :", state.activePresetId);
        panel.innerHTML = "";
        return;
      }
      mountForm(panel, { mode: "edit", preset });
    });
    return;
  }

  if (state.view === "preset") {
    if (!state.activePresetId) {
      console.warn("[main] view=preset sans activePresetId, fallback Dashboard");
      panel.innerHTML = "";
      return;
    }
    mountPresetView(panel, state.activePresetId);
    return;
  }

  console.warn(`[main] Vue inconnue : ${state.view}`);
  panel.innerHTML = "";
}

function updateNavActiveStates(state) {
  const navItems = document.querySelectorAll(".sidebar__nav .nav-item[data-view]");
  for (const item of navItems) {
    const view = item.dataset.view;
    if (view === state.view) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  }
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function updateDocumentTitle(state) {
  if (state.view === "dashboard") {
    document.title = "DriftDeckX";
    return;
  }

  if (state.view === "add-setup") {
    document.title = "DriftDeckX | Nouveau préréglage";
    return;
  }

  if (!state.activePresetId) {
    document.title = "DriftDeckX";
    return;
  }

  const all = await listPresets();
  const preset = all.find(p => p.id === state.activePresetId);
  if (preset) {
    document.title = `DriftDeckX | ${preset.name}`;
  } else {
    document.title = "DriftDeckX";
  }
}

function attachStaticEvents() {
  const nav = document.querySelector(".sidebar__nav");
  if (!nav) {
    console.warn("[main] Container .sidebar__nav introuvable.");
    return;
  }

  nav.addEventListener("click", (event) => {
    const button = event.target.closest(".nav-item[data-view]");
    if (!button) return;

    const view = button.dataset.view;
    const currentView = getState().view;

    if (view === currentView) return;

    const navAction = () => {
      switch (view) {
        case "dashboard":
          showDashboard();
          break;
        case "add-setup":
          showAddSetupForm();
          break;
        default:
          console.warn(`[main] Vue inconnue sur bouton nav : ${view}`);
      }
    };

    requestNavigation(navAction);
  });
}

function onStateChange(state) {
  renderSidebar();
  renderMainPanel(state);
  updateNavActiveStates(state);
  updateDocumentTitle(state);
}

async function init() {

  attachStaticEvents();
  await attachSidebarEvents();
  attachKeyboardShortcuts();
  subscribe(onStateChange);
  onStateChange(getState());
}

init().catch(err => {
  console.error("[main] Erreur fatale au démarrage :", err);
});