/**
 * Service "garage" — logique métier au-dessus de storage.js.
 *
 * Responsabilités :
 *  - Orchestrer les opérations CRUD sur les presets avec leurs conséquences
 *    (state, sidebar, redirection)
 *  - Calculer les redirections en cascade après une suppression
 *  - Centraliser la logique métier qui combine plusieurs modules (storage,
 *    state, models, brands)
 *
 * Pourquoi un module dédié plutôt qu'appeler storage.js directement ?
 *  - Évite la duplication de logique (la cascade de redirection serait
 *    autrement réimplémentée à chaque endroit qui supprime)
 *  - Permet de tester la logique métier indépendamment de l'UI
 *  - Prépare le terrain pour V1 où storage.js sera remplacé par Firebase
 *    (le garage continuera de fonctionner identiquement)
 *
 * Les fonctions ici NE TOUCHENT JAMAIS le DOM directement. Elles mutent
 * uniquement le storage et le state — la sidebar et la vue se rafraîchissent
 * via le subscriber dans main.js.
 */

import { listPresets, deletePreset, updatePreset } from "../storage.js";
import { MODELS } from "../data/models.js";
import { BRANDS } from "../data/brands.js";
import {
  showDashboard,
  selectPresetWithBrandExpanded,
  setActivePreset,
  getState
} from "../state.js";


// ─── Renommage d'un preset ───────────────────────────────────────────────

/**
 * Renomme un preset existant. Le `updatedAt` est mis à jour automatiquement
 * par storage.js.
 *
 * Après le renommage, on réémet un changement d'état via `setActivePreset()`
 * pour forcer un re-render de la vue détail (le nouveau nom doit s'afficher
 * dans la pill active + dans la sidebar). Pas de redirection : l'user reste
 * sur le même preset.
 *
 * Le nom est trimmé avant sauvegarde pour éviter les espaces parasites en
 * début/fin (cohérent avec la création).
 *
 * @param {string} presetId
 * @param {string} newName - nouveau nom (sera trimmé)
 * @returns {Promise<object>} le preset mis à jour
 */
export async function renamePreset(presetId, newName) {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("renamePreset: le nom ne peut pas être vide");
  }

  const updated = await updatePreset(presetId, { name: trimmed });

  // Force un re-render en réémettant l'activePresetId (même valeur).
  // Le subscriber state dans main.js rafraîchit alors la vue détail
  // (nouveau nom dans la pill, dans le titre potentiellement) et la
  // sidebar (nouveau nom dans la liste des presets de la voiture).
  setActivePreset(presetId);

  return updated;
}


// ─── Suppression d'un preset ─────────────────────────────────────────────

/**
 * Supprime un preset puis redirige selon la logique cascade :
 *   1. S'il reste d'autres presets sur la même voiture → premier de ceux-ci
 *   2. Sinon, la voiture disparaît du garage :
 *      → Voiture précédente non vide dans la même brand → premier preset
 *   3. Sinon, la brand disparaît aussi :
 *      → Brand précédente non vide dans le garage → premier preset de la
 *        première voiture
 *   4. Sinon, garage totalement vide → Dashboard
 *
 * @param {string} presetId - id du preset à supprimer
 * @returns {Promise<void>}
 */
export async function deletePresetWithRedirection(presetId) {
  // 1. Snapshot AVANT suppression pour calculer la redirection
  const allPresets = await listPresets();
  const target = allPresets.find(p => p.id === presetId);
  if (!target) {
    console.warn("[garage] Preset à supprimer introuvable :", presetId);
    return;
  }

  const model = MODELS.find(m => m.id === target.modelId);
  if (!model) {
    console.warn("[garage] Modèle introuvable :", target.modelId);
    await deletePreset(presetId);
    showDashboard();
    return;
  }

  // 2. Effectuer la suppression dans le storage
  await deletePreset(presetId);

  // 3. Calculer la redirection sur le NOUVEAU snapshot (sans le preset supprimé)
  const remainingPresets = allPresets.filter(p => p.id !== presetId);
  const nextTarget = findRedirectionTarget(target, model, remainingPresets);

  // 4. Naviguer vers la cible (ou Dashboard si garage vide)
  if (!nextTarget) {
    showDashboard();
    return;
  }

  const nextModel = MODELS.find(m => m.id === nextTarget.modelId);
  selectPresetWithBrandExpanded(
    nextModel.brandId,
    nextTarget.modelId,
    nextTarget.id
  );
}


/**
 * Calcule où rediriger après suppression d'un preset.
 *
 * Stratégie en cascade (lit dans l'ordre des MODELS et BRANDS pour cohérence
 * avec l'affichage sidebar) :
 *
 *  1. Reste-t-il un autre preset sur la MÊME voiture ?
 *     → Oui : prendre le premier (ordre de création).
 *  2. Reste-t-il une autre voiture dans la MÊME brand avec au moins
 *     un preset ?
 *     → Oui : prendre la PRÉCÉDENTE (selon l'ordre dans MODELS) qui a
 *       au moins un preset, sinon la SUIVANTE non vide.
 *  3. Reste-t-il une autre brand avec au moins un preset ?
 *     → Oui : prendre la PRÉCÉDENTE non vide dans l'ordre BRANDS, puis
 *       son premier modèle non vide, puis son premier preset.
 *  4. Garage vide → null (l'appelant doit aller Dashboard).
 *
 * @param {object} deletedPreset - le preset qui vient d'être supprimé
 * @param {object} deletedModel  - le modèle du preset supprimé
 * @param {array}  remainingPresets - liste des presets restants
 * @returns {object|null} le preset cible, ou null si garage vide
 */
function findRedirectionTarget(deletedPreset, deletedModel, remainingPresets) {
  // Cas 1 : même voiture, autre preset ?
  const sameCarPresets = remainingPresets.filter(
    p => p.modelId === deletedModel.id
  );
  if (sameCarPresets.length > 0) {
    return sameCarPresets[0]; // Premier de l'ordre de création
  }

  // Cas 2 : même brand, autre voiture ?
  const brandModels = MODELS.filter(m => m.brandId === deletedModel.brandId);
  const deletedIndex = brandModels.findIndex(m => m.id === deletedModel.id);

  // On cherche d'abord en arrière (voiture précédente non vide)
  for (let i = deletedIndex - 1; i >= 0; i--) {
    const candidate = brandModels[i];
    const presets = remainingPresets.filter(p => p.modelId === candidate.id);
    if (presets.length > 0) return presets[0];
  }

  // Si rien en arrière, on cherche en avant
  for (let i = deletedIndex + 1; i < brandModels.length; i++) {
    const candidate = brandModels[i];
    const presets = remainingPresets.filter(p => p.modelId === candidate.id);
    if (presets.length > 0) return presets[0];
  }

  // Cas 3 : autre brand non vide ?
  const deletedBrandIndex = BRANDS.findIndex(b => b.id === deletedModel.brandId);

  // Brand précédente non vide
  for (let i = deletedBrandIndex - 1; i >= 0; i--) {
    const target = findFirstPresetInBrand(BRANDS[i].id, remainingPresets);
    if (target) return target;
  }

  // Brand suivante non vide
  for (let i = deletedBrandIndex + 1; i < BRANDS.length; i++) {
    const target = findFirstPresetInBrand(BRANDS[i].id, remainingPresets);
    if (target) return target;
  }

  // Cas 4 : garage totalement vide
  return null;
}


/**
 * Cherche le premier preset disponible dans une brand donnée, en respectant
 * l'ordre des modèles (premier modèle non vide, puis son premier preset).
 *
 * @param {string} brandId
 * @param {array}  remainingPresets
 * @returns {object|null}
 */
function findFirstPresetInBrand(brandId, remainingPresets) {
  const brandModels = MODELS.filter(m => m.brandId === brandId);
  for (const model of brandModels) {
    const presets = remainingPresets.filter(p => p.modelId === model.id);
    if (presets.length > 0) return presets[0];
  }
  return null;
}