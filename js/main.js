/**
 * Point d'entrée et orchestrateur de DriftDeckX.
 *
 * Responsabilités :
 *  1. Câbler les événements UI statiques (Dashboard, Ajouter un réglage)
 *  2. Câbler l'event delegation de la sidebar
 *  3. Câbler les raccourcis clavier
 *  4. S'abonner au state pour re-render à chaque changement
 *  5. Rendre l'état initial (sidebar + main panel + title)
 *
 * ─── Architecture générale ─────────────────────────────────────────────
 *
 *   ┌─────────────────┐
 *   │   user click    │
 *   └────────┬────────┘
 *            │
 *            ▼
 *   ┌─────────────────┐
 *   │     state.js    │   setActiveCar() / toggleBrand() / ...
 *   │  (setState)     │
 *   └────────┬────────┘
 *            │
 *            │  notify subscribers
 *            ▼
 *   ┌─────────────────┐
 *   │     main.js     │   onStateChange() — défini ici
 *   │   (subscriber)  │
 *   └────────┬────────┘
 *            │
 *            ├──► renderSidebar()    (depuis ui/sidebar.js)
 *            ├──► renderMainPanel()  (Dashboard ou preset selon view)
 *            └──► updateDocumentTitle()
 *
 * ─── Pourquoi tout passe par le state ? ─────────────────────────────────
 *
 * Pour qu'on ait UNE source de vérité. Si on commençait à muter le DOM
 * directement depuis les handlers, on aurait des incohérences entre
 * "ce qui est affiché" et "ce qu'on croit afficher".
 *
 * En passant tout par setState() → notify → render, on garantit que
 * l'UI est TOUJOURS un reflet fidèle du state. Si l'UI a un bug, on sait
 * que le problème est dans le rendu, pas dans l'état.
 */

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


// ─── Rendu du main panel ─────────────────────────────────────────────────

/**
 * Met à jour le contenu du <main id="main-panel"> selon la vue active.
 *
 * En V0, le Dashboard est un simple placeholder centré. Les vues "preset",
 * "add-setup" et "edit-setup" affichent des placeholders également
 * (les vrais formulaires seront ajoutés dans une prochaine étape).
 */
function renderMainPanel(state) {
  const panel = document.getElementById("main-panel");
  if (!panel) {
    console.error("[main] Container #main-panel introuvable.");
    return;
  }

  if (state.view === "dashboard") {
    // Monte le Dashboard avec KPIs + moyennes (géré par ui/dashboard.js).
    // Charge async les presets pour calculer les stats.
    mountDashboard(panel);
    return;
  }

  if (state.view === "add-setup") {
    // Monte le formulaire multistep complet (géré par ui/form.js)
    mountForm(panel);
    return;
  }

  if (state.view === "edit-setup") {
    // Édition d'un preset existant : on charge le preset depuis le storage
    // puis on monte le formulaire en mode "edit" (draft pré-rempli, card
    // Identification masquée, bouton final "Mettre à jour").
    if (!state.activePresetId) {
      console.warn("[main] view=edit-setup sans activePresetId, fallback Dashboard");
      panel.innerHTML = "";
      return;
    }

    // Chargement async du preset puis montage du form. mountForm() est
    // synchrone mais a besoin du preset complet pour pré-remplir le draft.
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
    // Monte la vue détail (lecture seule des 62 champs via ui/preset-view.js)
    mountPresetView(panel, state.activePresetId);
    return;
  }

  // Cas non prévu — log mais ne crash pas
  console.warn(`[main] Vue inconnue : ${state.view}`);
  panel.innerHTML = "";
}


/**
 * Met à jour les états actifs des boutons de navigation statiques
 * (Dashboard et "Ajouter un réglage") selon la vue active.
 *
 * Cette logique vit ici (et pas dans le HTML) parce que les boutons sont
 * statiques mais leur état actif est dynamique. On lit chaque bouton par
 * son attribut `data-view` et on lui pose ou retire `aria-current="page"`.
 *
 * On utilise `aria-current` plutôt qu'une classe `.is-active` parce que :
 *  - C'est sémantiquement correct pour l'accessibilité (lecteurs d'écran)
 *  - On peut styler en CSS avec `[aria-current="page"]`
 *  - Une seule source de vérité (l'attribut ARIA pilote tout)
 */
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


/**
 * Helper d'échappement HTML (dupliqué de sidebar.js pour autonomie).
 * À factoriser dans utils/dom.js quand on créera ce fichier.
 */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// ─── Mise à jour du titre de l'onglet ────────────────────────────────────

/**
 * Met à jour <title> selon la vue active :
 *  - Dashboard         → "DriftDeckX"
 *  - add-setup         → "DriftDeckX | Nouveau préréglage"
 *  - edit-setup/preset → "DriftDeckX | <Nom du preset>"
 *
 * Chargé en async parce qu'on doit lire le nom du preset depuis le storage.
 */
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


// ─── Câblage des événements UI statiques ─────────────────────────────────

/**
 * Câble les boutons de navigation statiques de la sidebar (Dashboard et
 * "Ajouter un réglage"). Les éléments dynamiques (brands, cars, presets)
 * sont gérés par sidebar.js via event delegation.
 *
 * On utilise un seul listener avec délégation sur `.sidebar__nav` plutôt
 * que d'attacher 2 listeners individuels. Ça scale si on ajoute d'autres
 * boutons statiques plus tard (Réglages, Import/Export, etc.).
 */
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

    // Si on clique sur le bouton de la vue actuelle, ne rien faire
    // (évite d'ouvrir une modale juste pour rester où on est)
    if (view === currentView) return;

    // Action à exécuter (potentiellement après confirmation de la modale)
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

    // Si le formulaire d'ajout est actif, intercepter via la modale
    requestNavigation(navAction);
  });
}


// ─── Subscriber principal ────────────────────────────────────────────────

/**
 * Callback appelé à chaque changement de state.
 * Re-rend la sidebar, le main panel, met à jour les états actifs des
 * boutons de navigation, et met à jour le titre.
 *
 * Les 4 opérations sont indépendantes — si l'une échoue, les autres
 * tournent quand même (le try/catch est dans state.js, qui isole les
 * erreurs des subscribers).
 */
function onStateChange(state) {
  renderSidebar();
  renderMainPanel(state);
  updateNavActiveStates(state);
  updateDocumentTitle(state);
}


// ─── Initialisation ──────────────────────────────────────────────────────

/**
 * Point d'entrée : appelé une fois le DOM prêt.
 * (Pas besoin de DOMContentLoaded grâce à `type="module" defer` natif)
 */
async function init() {
  console.log("[main] Démarrage DriftDeckX V0");

  // 1. Câbler les événements (statiques + delegation sidebar + raccourcis clavier)
  attachStaticEvents();
  await attachSidebarEvents();
  attachKeyboardShortcuts();

  // 2. S'abonner aux changements de state
  subscribe(onStateChange);

  // 3. Rendu initial (état Dashboard par défaut au démarrage)
  onStateChange(getState());

  console.log("[main] Prêt.");
}


// Lance l'init dès le chargement du module
init().catch(err => {
  console.error("[main] Erreur fatale au démarrage :", err);
});