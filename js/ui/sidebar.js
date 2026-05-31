/**
 * Rendu de la sidebar DriftDeckX.
 *
 * Ce module est responsable de générer dynamiquement le contenu du
 * <ul id="garage-list"> avec les brands, cars et presets de l'user.
 *
 * ─── Architecture ──────────────────────────────────────────────────────
 *
 * Stratégie de rendu : "innerHTML monolithique".
 * À chaque changement de state, on régénère TOUT le HTML de la sidebar
 * en une seule string et on remplace le innerHTML du container. C'est
 * simple, performant pour un volume raisonnable (< 200 cars), et ça nous
 * évite la complexité du diffing manuel.
 *
 * Avantages :
 *  - Une seule source de vérité : le state + les données
 *  - Pas de "drift" entre l'état affiché et l'état réel
 *  - Code linéaire facile à lire
 *
 * Inconvénients (à connaître) :
 *  - Les inputs/focus de la sidebar disparaissent à chaque render
 *    (mais la sidebar n'a pas d'inputs, donc OK)
 *  - Les animations CSS qui dépendent d'un state DOM persistant peuvent
 *    rejouer (ex: si on rajoute des transitions sur les items, à voir)
 *
 * ─── Event handling ────────────────────────────────────────────────────
 *
 * Event delegation : un seul listener attaché au <ul id="garage-list">
 * qui intercepte tous les clicks et dispatch selon la cible (data-*
 * attributes). Marche même après re-render, pas besoin de re-attacher.
 *
 * Pattern : on lit `data-action` sur l'élément cliqué pour savoir quoi
 * faire (toggle-brand / select-car / select-preset).
 *
 * ─── Affichage des cars ─────────────────────────────────────────────────
 *
 * Format choisi pour les cars : 2 lignes par item.
 *  - Ligne 1 : nom IRL (ex: "Silvia S15")
 *  - Ligne 2 : nom CarX en petit gris (ex: "Spector RS")
 *
 * Les presets ne sont affichés QUE sous la car active, et UNIQUEMENT si
 * la car a 2+ presets (sinon le clic sur la car charge directement son
 * unique preset, pas besoin de sous-liste).
 */

import { BRANDS } from "../data/brands.js";
import { MODELS } from "../data/models.js";
import { listPresets } from "../storage.js";
import {
  getState,
  setActiveCar,
  setActivePreset,
  toggleBrand
} from "../state.js";
import { requestNavigation } from "./form.js";


// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Échappe les caractères HTML dangereux dans une string user-controllée.
 * À utiliser pour TOUS les contenus qui viennent du storage ou des inputs.
 *
 * Sans ça, un user qui nomme son preset `<script>alert('xss')</script>`
 * verrait son code exécuté quand on injecte le nom via innerHTML.
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

/**
 * Cherche un modèle par son id dans la liste statique.
 * Cas où on ne trouve pas : preset stocké pointe vers un model supprimé
 * du jeu (rare mais possible). On retourne un placeholder sécurisé.
 */
function findModel(modelId) {
  return MODELS.find(m => m.id === modelId) || {
    id: modelId,
    brandId: "other",
    nameReal: "Modèle inconnu",
    nameCarx: modelId
  };
}


// ─── Construction du modèle de données pour le rendu ─────────────────────

/**
 * À partir de la liste plate de presets, construit une structure groupée
 * par brand → car → presets. Ne renvoie que les brands non-vides
 * (filtrées au rendu, comme convenu).
 *
 * Structure de sortie :
 *   [
 *     {
 *       brand: { id, name },
 *       cars: [
 *         {
 *           model: { id, brandId, nameReal, nameCarx },
 *           presets: [ {id, modelId, name, ...}, ... ]
 *         }
 *       ]
 *     }
 *   ]
 *
 * L'ordre des brands respecte BRANDS[]. L'ordre des cars suit l'ordre
 * d'apparition de chaque modelId dans le tableau de presets — à terme on
 * pourrait trier alpha ou par dernière utilisation, mais pas en V0.
 */
function buildGarageTree(presets) {
  // Map<brandId, Map<modelId, presets[]>>
  const tree = new Map();

  for (const preset of presets) {
    const model = findModel(preset.modelId);
    const brandId = model.brandId;

    if (!tree.has(brandId)) {
      tree.set(brandId, new Map());
    }
    const brandMap = tree.get(brandId);

    if (!brandMap.has(model.id)) {
      brandMap.set(model.id, { model, presets: [] });
    }
    brandMap.get(model.id).presets.push(preset);
  }

  // Conversion en tableau ordonné selon BRANDS[]
  const result = [];
  for (const brand of BRANDS) {
    if (!tree.has(brand.id)) continue; // brand vide → on saute
    const brandMap = tree.get(brand.id);
    result.push({
      brand,
      cars: Array.from(brandMap.values())
    });
  }
  return result;
}


// ─── Rendu HTML ──────────────────────────────────────────────────────────

/**
 * Génère le HTML complet de la sidebar.
 * Appelée à chaque changement de state ou de données.
 *
 * @param {Array} presets - Liste complète des presets (depuis storage)
 * @param {object} state  - Snapshot de l'état (cf. state.js)
 * @returns {string} HTML à injecter dans #garage-list
 */
function renderSidebarHtml(presets, state) {
  const tree = buildGarageTree(presets);

  // Cas particulier : garage vide
  if (tree.length === 0) {
    return `
      <li class="brands__empty">
        <p>Aucun préréglage enregistré.</p>
      </li>
    `;
  }

  return tree.map(({ brand, cars }) => {
    const isExpanded = state.expandedBrands.has(brand.id);

    // ── Génération des cars de cette brand ────────────────────────────
    const carsHtml = cars.map(({ model, presets }) => {
      const isActiveCar    = state.activeCarId === model.id;
      const showBadge      = presets.length >= 2;
      const showPresetList = isActiveCar && presets.length >= 2;

      // Liste des presets (seulement si car active + 2+ presets)
      let presetsHtml = "";
      if (showPresetList) {
        presetsHtml = `
          <ul class="presets" role="list">
            ${presets.map(preset => {
              const isActivePreset = state.activePresetId === preset.id;
              return `
                <li class="preset-item">
                  <button
                    type="button"
                    class="preset-button${isActivePreset ? " is-active" : ""}"
                    data-action="select-preset"
                    data-preset-id="${escapeHtml(preset.id)}"
                    ${isActivePreset ? 'aria-current="true"' : ""}
                  >
                    <span class="preset-button__marker" aria-hidden="true">›</span>
                    <span class="preset-button__name">${escapeHtml(preset.name)}</span>
                  </button>
                </li>
              `;
            }).join("")}
          </ul>
        `;
      }

      // L'item car lui-même
      return `
        <li class="car-item">
          <button
            type="button"
            class="car-button${isActiveCar ? " is-active" : ""}"
            data-action="select-car"
            data-car-id="${escapeHtml(model.id)}"
            ${showPresetList ? 'aria-expanded="true"' : ""}
            ${isActiveCar ? 'aria-current="true"' : ""}
          >
            <span class="car-button__names">
              <span class="car-button__name-real">${escapeHtml(model.nameReal)}</span>
              <span class="car-button__name-carx">${escapeHtml(model.nameCarx)}</span>
            </span>
            ${showBadge ? `<span class="car-button__badge" aria-label="${presets.length} préréglages">${presets.length}</span>` : ""}
          </button>
          ${presetsHtml}
        </li>
      `;
    }).join("");

    // ── Génération de la brand (accordéon) ─────────────────────────────
    return `
      <li class="brand-item">
        <details
          class="brand-details"
          data-brand-id="${escapeHtml(brand.id)}"
          ${isExpanded ? "open" : ""}
        >
          <summary class="brand-summary" data-action="toggle-brand" data-brand-id="${escapeHtml(brand.id)}">
            <svg class="brand-summary__chevron" width="10" height="10" viewBox="0 0 10 10"
                 fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M3 1 L7 5 L3 9" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="brand-summary__name">${escapeHtml(brand.name)}</span>
          </summary>
          <div class="cars-wrapper">
            <ul class="cars" role="list">
              ${carsHtml}
            </ul>
          </div>
        </details>
      </li>
    `;
  }).join("");
}


// ─── API publique ────────────────────────────────────────────────────────

/**
 * Met à jour la sidebar avec l'état courant. À appeler après chaque
 * changement de state (via subscribe dans main.js).
 *
 * Charge les presets de manière asynchrone (storage.js est async-first
 * pour préparer Firebase V1).
 */
export async function renderSidebar() {
  const container = document.getElementById("garage-list");
  if (!container) {
    console.error("[sidebar] Container #garage-list introuvable.");
    return;
  }

  const presets = await listPresets();
  const state = getState();
  container.innerHTML = renderSidebarHtml(presets, state);
}

/**
 * Câble l'event delegation sur le container de la sidebar.
 * À appeler une seule fois au démarrage (depuis main.js).
 *
 * Tous les clicks dans la sidebar sont interceptés ici et dispatchés
 * vers le bon setter de state selon le `data-action` de l'élément.
 *
 * Cas particulier `<summary>` : on intercepte le click et on appelle
 * `preventDefault()` pour gérer l'état d'expansion via notre state JS
 * plutôt que via le comportement natif <details>. Sinon on aurait un
 * double-toggle (natif + notre state).
 */
export async function attachSidebarEvents() {
  const container = document.getElementById("garage-list");
  if (!container) {
    console.error("[sidebar] Container #garage-list introuvable pour les events.");
    return;
  }

  container.addEventListener("click", async (event) => {
    // On remonte au plus proche élément avec data-action
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;

    const action = trigger.dataset.action;

    switch (action) {
      case "toggle-brand": {
        // On bloque le comportement natif du <summary> pour piloter via state
        event.preventDefault();
        const brandId = trigger.dataset.brandId;
        if (brandId) toggleBrand(brandId);
        break;
      }

      case "select-car": {
        const carId = trigger.dataset.carId;
        if (!carId) return;

        // On charge tous les presets pour trouver le 1er de cette car
        const all = await listPresets();
        const carPresets = all.filter(p => p.modelId === carId);
        if (carPresets.length === 0) return;

        // Si le formulaire d'ajout est actif, on intercepte via la modale
        requestNavigation(() => setActiveCar(carId, carPresets[0].id));
        break;
      }

      case "select-preset": {
        const presetId = trigger.dataset.presetId;
        if (!presetId) return;
        requestNavigation(() => setActivePreset(presetId));
        break;
      }

      default:
        console.warn(`[sidebar] Action inconnue : ${action}`);
    }
  });
}