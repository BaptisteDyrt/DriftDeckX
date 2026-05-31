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


function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findModel(modelId) {
  return MODELS.find(m => m.id === modelId) || {
    id: modelId,
    brandId: "other",
    nameReal: "Modèle inconnu",
    nameCarx: modelId
  };
}

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