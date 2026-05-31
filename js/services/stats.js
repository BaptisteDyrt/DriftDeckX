import { TUNING_SCHEMA } from "../data/schema.js";

export function computeDashboardStats(presets) {
  if (!Array.isArray(presets) || presets.length === 0) {
    return emptyStats();
  }

  return {
    presetCount: presets.length,
    carCount: countUniqueCars(presets),
    turboPercent: computeTurboPercent(presets),
    massAverage: computeFieldAverage(presets, "mass"),
    suspensionAverages: computeSectionAverages(presets, "suspension"),
    alignmentAverages: computeSectionAverages(presets, "alignment")
  };
}


// ─── Helpers de calcul ───────────────────────────────────────────────────

/**
 * Compte les modèles uniques utilisés par les presets.
 * Une voiture qui a 3 presets compte pour 1 voiture.
 */
function countUniqueCars(presets) {
  const uniqueModelIds = new Set();
  for (const preset of presets) {
    uniqueModelIds.add(preset.modelId);
  }
  return uniqueModelIds.size;
}

/**
 * Pourcentage entier de presets dont turbo est activé (true).
 * Retourne 0 si aucun preset.
 *
 * Exemple : 3 turbo sur 5 presets → 60
 */
function computeTurboPercent(presets) {
  if (presets.length === 0) return 0;
  const turboOn = presets.filter(p => p.tuning?.turbo === true).length;
  return Math.round((turboOn / presets.length) * 100);
}

/**
 * Moyenne d'un champ numérique sur tous les presets, arrondie au `step`
 * du schema. Le step donne la précision attendue par CarX :
 *   - step: 1     → arrondi entier
 *   - step: 0.5   → arrondi à 0.5 près
 *   - step: 0.01  → arrondi à 2 décimales
 *   - step: 50    → arrondi à 50 près
 *
 * @param {Array<object>} presets
 * @param {string} fieldId - id du champ dans le schema
 * @returns {number} valeur arrondie, ou 0 si pas de données
 */
function computeFieldAverage(presets, fieldId) {
  const field = findFieldInSchema(fieldId);
  if (!field) return 0;

  const values = presets
    .map(p => p.tuning?.[fieldId])
    .filter(v => typeof v === "number" && Number.isFinite(v));

  if (values.length === 0) return 0;

  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = sum / values.length;

  return roundToStep(avg, field.step ?? 1);
}

/**
 * Calcule la moyenne de tous les champs d'une section donnée.
 * Retourne un Map<fieldId, average> pour conserver l'ordre du schema (utile
 * au rendu pour préserver l'ordre d'affichage).
 *
 * @param {Array<object>} presets
 * @param {string} sectionKey - clé de section dans TUNING_SCHEMA (ex: "suspension")
 * @returns {Map<string, number>}
 */
function computeSectionAverages(presets, sectionKey) {
  const section = TUNING_SCHEMA[sectionKey];
  if (!section) return new Map();

  const averages = new Map();
  for (const field of section.fields) {
    // Skip les champs non-numériques (boolean) — pas de moyenne sensée
    if (field.type === "boolean") continue;
    averages.set(field.id, computeFieldAverage(presets, field.id));
  }
  return averages;
}

/**
 * Arrondit une valeur au step donné.
 * Ex : roundToStep(17.62, 0.5) → 17.5
 *      roundToStep(17.78, 0.5) → 18
 *      roundToStep(11234, 50)  → 11250
 *      roundToStep(0.847, 0.01) → 0.85
 *
 * Utilise une division/multiplication pour éviter les pièges du modulo
 * sur les flottants (0.1 + 0.2 !== 0.3, etc.).
 */
function roundToStep(value, step) {
  if (step <= 0) return value;
  const rounded = Math.round(value / step) * step;
  // Normalise la précision flottante (ex: 17.5 au lieu de 17.500000001)
  // en formatant via toFixed selon le nombre de décimales du step.
  const decimals = (String(step).split(".")[1] || "").length;
  return Number(rounded.toFixed(decimals));
}

/**
 * Trouve un champ par id en parcourant toutes les sections du schema.
 * Cherche d'abord par id direct.
 */
function findFieldInSchema(fieldId) {
  for (const section of Object.values(TUNING_SCHEMA)) {
    const found = section.fields.find(f => f.id === fieldId);
    if (found) return found;
  }
  return null;
}

/**
 * Structure de stats par défaut pour le cas "garage vide".
 * Permet au rendu de ne pas avoir à vérifier `null` partout.
 */
function emptyStats() {
  return {
    presetCount: 0,
    carCount: 0,
    turboPercent: 0,
    massAverage: 0,
    suspensionAverages: new Map(),
    alignmentAverages: new Map()
  };
}