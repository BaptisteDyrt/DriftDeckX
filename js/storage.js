/**
 * Couche d'abstraction de stockage pour DriftDeckX.
 *
 * Ce module est la SEULE interface entre l'app et le mécanisme de persistance.
 * Tout le reste de l'app (UI, services, state) doit passer par ces fonctions
 * et ne JAMAIS accéder à localStorage directement.
 *
 * ─── Pourquoi cette couche d'abstraction ? ─────────────────────────────
 *
 * V0 (actuel)  : localStorage du navigateur (synchrone, local)
 * V1 (à venir) : Firebase Firestore (asynchrone, cloud, multi-device)
 *
 * Pour passer de V0 à V1, il suffira de remplacer le contenu des fonctions
 * ci-dessous par des appels Firestore — sans toucher au reste de l'app.
 * C'est pourquoi TOUTES les fonctions retournent des Promises, même en V0
 * où localStorage est synchrone : on simule l'asynchrone dès maintenant
 * pour que l'UI soit déjà "Firebase-ready".
 *
 * ─── Architecture des données ──────────────────────────────────────────
 *
 * Un seul "tableau plat" de presets en localStorage, sous la clé STORAGE_KEY.
 * Pas de regroupement par car ou par brand : les cars sont déduites par
 * groupage des presets sur leur `modelId`.
 *
 *   localStorage["driftdeckx.presets"] = JSON.stringify([
 *     { id, modelId, name, createdAt, updatedAt, tuning: {...} },
 *     ...
 *   ])
 *
 * Avantage : structure plate, prête pour Firestore (1 collection = 1 doc/preset).
 *
 * ─── Conventions ────────────────────────────────────────────────────────
 *
 * - Toutes les fonctions sont `async` (retournent une Promise)
 * - Les erreurs de lecture (JSON corrompu, etc.) sont catchées et loggées,
 *   et la fonction retourne une valeur "neutre" (tableau vide pour list, etc.)
 * - Les fonctions de mutation lèvent une erreur si le preset n'existe pas
 * - Les `id` sont générés automatiquement à la création
 * - `createdAt` est figé, `updatedAt` est mis à jour à chaque modification
 */


// ─── Configuration ───────────────────────────────────────────────────────

/**
 * Clé localStorage. Doit rester synchronisée avec fixtures.js.
 * En V1, cette clé deviendra le nom de la collection Firestore.
 */
const STORAGE_KEY = "driftdeckx.presets";


// ─── Helpers internes ────────────────────────────────────────────────────

/**
 * Génère un UUID v4. Utilise crypto.randomUUID() si disponible (tous les
 * navigateurs modernes), sinon fallback manuel.
 */
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Timestamp ISO de l'instant présent.
 * Format universel, triable, parsable, prêt pour Firestore.
 */
function now() {
  return new Date().toISOString();
}

/**
 * Lit le tableau brut depuis localStorage. Robuste aux cas d'erreur :
 *  - clé absente → []
 *  - JSON corrompu → [] + log d'erreur
 *  - valeur non-tableau → [] + log d'erreur
 *
 * Cette fonction est privée : l'extérieur passe par `listPresets()`.
 */
function readRaw() {
  if (typeof localStorage === "undefined") {
    console.warn("[storage] localStorage indisponible.");
    return [];
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error("[storage] Données corrompues (pas un tableau) — reset.");
      return [];
    }
    return parsed;
  } catch (err) {
    console.error("[storage] JSON corrompu en localStorage :", err);
    return [];
  }
}

/**
 * Écrit le tableau dans localStorage. Privée également.
 * Peut lever si le quota localStorage est atteint (~5-10 MB selon le navigateur).
 */
function writeRaw(presets) {
  if (typeof localStorage === "undefined") {
    throw new Error("localStorage indisponible");
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}


// ─── API publique : lecture ──────────────────────────────────────────────

/**
 * Retourne tous les presets stockés, dans l'ordre du tableau brut.
 *
 * @returns {Promise<Array>} Liste de presets (jamais null, [] si vide)
 */
export async function listPresets() {
  return readRaw();
}

/**
 * Retourne un preset par son id, ou null s'il n'existe pas.
 *
 * @param {string} presetId
 * @returns {Promise<object|null>}
 */
export async function getPresetById(presetId) {
  const all = readRaw();
  return all.find(p => p.id === presetId) || null;
}

/**
 * Retourne tous les presets d'un modèle donné.
 * Utile pour la sidebar (déduire la liste des cars affichées) et pour
 * compter le nombre de presets par car (badge "2", "3"...).
 *
 * @param {string} modelId
 * @returns {Promise<Array>}
 */
export async function getPresetsByModel(modelId) {
  const all = readRaw();
  return all.filter(p => p.modelId === modelId);
}

/**
 * Retourne la liste des `modelId` distincts présents dans le storage.
 * Utile pour la sidebar : on en déduit les cars à afficher, et on peut
 * croiser avec BRANDS/MODELS pour grouper par marque.
 *
 * @returns {Promise<string[]>}
 */
export async function getUsedModelIds() {
  const all = readRaw();
  return [...new Set(all.map(p => p.modelId))];
}


// ─── API publique : écriture ─────────────────────────────────────────────

/**
 * Crée un nouveau preset. Génère automatiquement `id`, `createdAt` et
 * `updatedAt`. Retourne le preset créé (avec son nouvel id).
 *
 * @param {object} preset - Doit contenir au minimum { modelId, name, tuning }
 * @returns {Promise<object>} Le preset créé, complet
 */
export async function createPreset(preset) {
  if (!preset.modelId) throw new Error("createPreset: modelId manquant");
  if (!preset.name)    throw new Error("createPreset: name manquant");
  if (!preset.tuning)  throw new Error("createPreset: tuning manquant");

  const timestamp = now();
  const newPreset = {
    id: uuid(),
    modelId: preset.modelId,
    name: preset.name,
    createdAt: timestamp,
    updatedAt: timestamp,
    tuning: preset.tuning
  };

  const all = readRaw();
  all.push(newPreset);
  writeRaw(all);

  return newPreset;
}

/**
 * Met à jour un preset existant. Préserve `id` et `createdAt`, met à jour
 * `updatedAt` automatiquement. Les autres champs sont remplacés par les
 * valeurs du patch (merge superficiel — pour modifier `tuning` partiellement,
 * passer un objet `tuning` complet).
 *
 * @param {string} presetId
 * @param {object} patch - Champs à modifier (name, tuning, modelId)
 * @returns {Promise<object>} Le preset mis à jour
 * @throws {Error} Si le preset n'existe pas
 */
export async function updatePreset(presetId, patch) {
  const all = readRaw();
  const index = all.findIndex(p => p.id === presetId);
  if (index === -1) {
    throw new Error(`updatePreset: preset introuvable (id=${presetId})`);
  }

  const updated = {
    ...all[index],
    ...patch,
    id: all[index].id,                  // protection : id immuable
    createdAt: all[index].createdAt,    // protection : createdAt immuable
    updatedAt: now()
  };

  all[index] = updated;
  writeRaw(all);
  return updated;
}

/**
 * Supprime un preset par son id.
 *
 * @param {string} presetId
 * @returns {Promise<boolean>} true si supprimé, false si introuvable
 */
export async function deletePreset(presetId) {
  const all = readRaw();
  const filtered = all.filter(p => p.id !== presetId);

  if (filtered.length === all.length) {
    // Aucun preset n'avait cet id
    return false;
  }

  writeRaw(filtered);
  return true;
}

/**
 * Supprime tous les presets d'un modèle donné.
 * Utile si on veut "vider une voiture" en un coup.
 *
 * @param {string} modelId
 * @returns {Promise<number>} Nombre de presets supprimés
 */
export async function deletePresetsByModel(modelId) {
  const all = readRaw();
  const filtered = all.filter(p => p.modelId !== modelId);
  const deletedCount = all.length - filtered.length;

  if (deletedCount > 0) {
    writeRaw(filtered);
  }
  return deletedCount;
}


// ─── API publique : administration ───────────────────────────────────────

/**
 * Remplace TOUS les presets stockés par le tableau fourni.
 * Utile pour :
 *   - Import JSON (restauration de backup)
 *   - Injection des fixtures de démo
 *   - Tests
 *
 * @param {Array} presets - Nouveau tableau complet
 * @returns {Promise<void>}
 */
export async function replaceAllPresets(presets) {
  if (!Array.isArray(presets)) {
    throw new Error("replaceAllPresets: argument doit être un tableau");
  }
  writeRaw(presets);
}

/**
 * Vide complètement le storage (supprime tous les presets).
 *
 * @returns {Promise<void>}
 */
export async function clearAll() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Retourne des stats sur le storage (utile pour debug / dashboard).
 *
 * @returns {Promise<{ count: number, sizeBytes: number, modelCount: number }>}
 */
export async function getStorageStats() {
  const all = readRaw();
  const raw = localStorage.getItem(STORAGE_KEY) || "";
  return {
    count: all.length,
    sizeBytes: new Blob([raw]).size,
    modelCount: new Set(all.map(p => p.modelId)).size
  };
}