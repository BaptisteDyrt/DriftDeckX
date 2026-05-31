/**
 * Schéma des champs de réglages (tuning) CarX Drift Racing Online.
 *
 * Ce fichier est la source unique de vérité pour générer dynamiquement
 * le formulaire de configuration d'un preset. Quand CarX ajoute un nouveau
 * paramètre dans un patch, on l'ajoute ici et il apparaît dans l'UI sans
 * toucher au reste du code.
 *
 * ─── Structure ──────────────────────────────────────────────────────────
 * TUNING_SCHEMA = {
 *   <sectionId>: {
 *     label: string,           // Nom affiché de la section
 *     fields: [
 *       {
 *         id: string,          // Clé unique (camelCase, immuable)
 *         label: string,       // Libellé affiché
 *         type: string,        // 'number' | 'boolean'
 *         min?: number,        // Borne min (type 'number')
 *         max?: number,        // Borne max (type 'number')
 *         step?: number,       // Incrément (type 'number')
 *         unit?: string|null,  // Unité affichée (null si aucune)
 *         default: any,        // Valeur par défaut
 *         axis?: 'front'|'rear', // Présent si le champ est dédoublé AV/AR
 *         enabledIf?: {        // Condition d'activation (sinon champ grisé)
 *           field: string,
 *           equals: any
 *         }
 *       }
 *     ]
 *   }
 * }
 *
 * ─── Conventions ────────────────────────────────────────────────────────
 * - Valeurs par défaut = médiane du range (arrondi supérieur si nécessaire)
 *   sauf exception explicite (cf. mass).
 * - Champs AV+AR : générés en double avec préfixes `front` / `rear` et
 *   propriété `axis` correspondante. L'`id` reste celui de base (`length`),
 *   les `id` finaux dans les presets sont `frontLength` / `rearLength`.
 * - Champs conditionnels : restent visibles mais sont `disabled` dans l'UI
 *   tant que leur `enabledIf` n'est pas satisfait.
 * - Champs `boolean` : rendus en toggle switch.
 *
 * ─── Ne JAMAIS modifier les `id` après mise en production ───────────────
 * Les `id` servent de clés dans les presets stockés (localStorage / Firebase).
 * Renommer un `id` casserait tous les presets existants des utilisateurs.
 * Pour renommer l'affichage, modifier `label` uniquement.
 */


// ─── Helpers privés ──────────────────────────────────────────────────────

/**
 * Génère deux champs AV/AR à partir d'une définition de base.
 * @param {object} base - Définition du champ (id, label, min, max, step, unit, default)
 * @returns {object[]} Deux objets, un pour 'front', un pour 'rear'
 */
function axisPair(base) {
  return [
    { ...base, id: `front${capitalize(base.id)}`, label: `${base.label} (avant)`, axis: "front" },
    { ...base, id: `rear${capitalize(base.id)}`,  label: `${base.label} (arrière)`, axis: "rear" }
  ];
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// ─── Schéma principal ────────────────────────────────────────────────────

export const TUNING_SCHEMA = {

  // ──────────────────────────────────────────────────────────────────────
  // SUSPENSION (champs dédoublés AV/AR)
  // ──────────────────────────────────────────────────────────────────────
  suspension: {
    label: "Suspension",
    fields: [
      ...axisPair({ id: "length",       label: "Longueur",             type: "number", min: 0, max: 35,    step: 0.1, unit: "cm",      default: 17.5 }),
      ...axisPair({ id: "stiffness",    label: "Rigidité",             type: "number", min: 0, max: 400,   step: 1,   unit: "kN/m",    default: 200 }),
      ...axisPair({ id: "fastBound",    label: "Serrage rapide",       type: "number", min: 0, max: 22000, step: 10,  unit: "N.sec/m", default: 11000 }),
      ...axisPair({ id: "fastRebound",  label: "Compression rapide",   type: "number", min: 0, max: 22000, step: 10,  unit: "N.sec/m", default: 11000 }),
      ...axisPair({ id: "bound",        label: "Serrage",              type: "number", min: 0, max: 22000, step: 10,  unit: "N.sec/m", default: 11000 }),
      ...axisPair({ id: "rebound",      label: "Compression",          type: "number", min: 0, max: 22000, step: 10,  unit: "N.sec/m", default: 11000 }),
      ...axisPair({ id: "antiRollBar",  label: "Barre stabilisatrice", type: "number", min: 0, max: 150,   step: 1,   unit: "kN/m",    default: 75 })
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // ALIGNEMENT (2 champs AV+AR, 5 champs AV uniquement)
  // ──────────────────────────────────────────────────────────────────────
  alignment: {
    label: "Alignement",
    fields: [
      ...axisPair({ id: "camber", label: "Carrossage", type: "number", min: -15, max: 15, step: 0.1,  unit: null, default: 0 }),
      ...axisPair({ id: "toe",    label: "Pincement",  type: "number", min: -1,  max: 1,  step: 0.01, unit: null, default: 0 }),
      { id: "caster",       label: "Chasse",    type: "number", min: 0, max: 15,  step: 0.1, unit: "grad", default: 7.5 },
      { id: "steering",     label: "Direction", type: "number", min: 0, max: 20,  step: 1,   unit: "mm",   default: 10 },
      { id: "steeringLock", label: "Braquage",  type: "number", min: 0, max: 65,  step: 1,   unit: "grad", default: 33 },
      { id: "ackermann",    label: "Ackermann", type: "number", min: 0, max: 100, step: 1,   unit: "%",    default: 50 },
      { id: "kingpin",      label: "Pivot",     type: "number", min: 0, max: 20,  step: 1,   unit: "grad", default: 10 }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // Pneus (champs dédoublés AV/AR)
  // ──────────────────────────────────────────────────────────────────────
  wheel: {
    label: "Pneus",
    fields: [
      ...axisPair({ id: "diameter", label: "Diamètre",    type: "number", min: 13,  max: 25,  step: 1,  unit: "in",   default: 19 }),
      ...axisPair({ id: "width",    label: "Largeur",     type: "number", min: 165, max: 325, step: 5,  unit: "mm",   default: 245 }),
      ...axisPair({ id: "pressure", label: "Pression",    type: "number", min: 60,  max: 300, step: 1,  unit: "kPa",  default: 180 }),
      ...axisPair({ id: "grip",     label: "Adhérence",   type: "number", min: 90,  max: 120, step: 10, unit: "%",    default: 110 }),
      ...axisPair({ id: "offset",   label: "Empattement", type: "number", min: -20, max: 40,  step: 1,  unit: null,   default: 10 }),
      ...axisPair({ id: "profile",  label: "Profil",      type: "number", min: 20,  max: 70,  step: 5,  unit: "%",    default: 45 }),
      ...axisPair({ id: "spacing",  label: "Écart",       type: "number", min: -30, max: 50,  step: 1,  unit: "mm",   default: 10 })
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // FREINS
  // ──────────────────────────────────────────────────────────────────────
  brakes: {
    label: "Freins",
    fields: [
      { id: "power",   label: "Puissance",   type: "number",  min: 1000, max: 10000, step: 1, unit: "N/m", default: 5500 },
      { id: "balance", label: "Répartition", type: "number",  min: 0,    max: 100,   step: 1, unit: "%",   default: 50 },
      { id: "abs",     label: "ABS",         type: "boolean", default: false }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // MOTEUR (1 champ conditionnel)
  // ──────────────────────────────────────────────────────────────────────
  engine: {
    label: "Moteur",
    fields: [
      { id: "gain",          label: "Gain",      type: "number",  min: -20,   max: 20,    step: 1,    unit: "%",     default: 0 },
      { id: "torque",        label: "Couple",    type: "number",  min: 3000,  max: 8000,  step: 1,    unit: "V/min", default: 5500 },
      { id: "rpmLimiter",    label: "Limiteur",  type: "number",  min: 4000,  max: 10000, step: 1,    unit: "V/min", default: 7000 },
      { id: "turbo",         label: "Turbo",     type: "boolean", default: false },
      {
        id: "turboPressure",
        label: "Pression",
        type: "number",
        min: 0,
        max: 2,
        step: 0.01,
        unit: "atm",
        default: 1.00,
        enabledIf: { field: "turbo", equals: true }
      }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // TRANSMISSION (2 toggles + 2 champs conditionnels en cascade)
  // ──────────────────────────────────────────────────────────────────────
  transmission: {
    label: "Transmission",
    fields: [
      { id: "preload",     label: "Préchargement",        type: "number", min: 0,   max: 500, step: 1,    unit: "N/m", default: 250 },
      { id: "powerLock",   label: "Blocage puissance",    type: "number", min: 0,   max: 100, step: 1,    unit: "%",   default: 50 },
      { id: "coastLock",   label: "Blocage roues libres", type: "number", min: 0,   max: 100, step: 1,    unit: "%",   default: 50 },
      { id: "finalDrive",  label: "Finale",               type: "number", min: 2.5, max: 6,   step: 0.01, unit: null,  default: 3.50 },
      { id: "gear1",       label: "V1",                   type: "number", min: 0.6, max: 10,  step: 0.01, unit: null,  default: 2.80 },
      { id: "gear2",       label: "V2",                   type: "number", min: 0.6, max: 10,  step: 0.01, unit: null,  default: 2.50 },
      { id: "gear3",       label: "V3",                   type: "number", min: 0.6, max: 10,  step: 0.01, unit: null,  default: 2.10 },
      { id: "gear4",       label: "V4",                   type: "number", min: 0.6, max: 10,  step: 0.01, unit: null,  default: 1.80 },
      { id: "gear5",       label: "V5",                   type: "number", min: 0.6, max: 10,  step: 0.01, unit: null,  default: 1.60 },
      { id: "gear6",       label: "V6",                   type: "number", min: 0.6, max: 10,  step: 0.01, unit: null,  default: 1.40 },
      { id: "hasGear7",    label: "Activer V7",           type: "boolean", default: false },
      {
        id: "gear7",
        label: "V7",
        type: "number",
        min: 0.6,
        max: 10,
        step: 0.01,
        unit: null,
        default: 1.20,
        enabledIf: { field: "hasGear7", equals: true }
      },
      {
        id: "hasGear8",
        label: "Activer V8",
        type: "boolean",
        default: false,
        enabledIf: { field: "hasGear7", equals: true }  // cascade : V8 dépend de V7 actif
      },
      {
        id: "gear8",
        label: "V8",
        type: "number",
        min: 0.6,
        max: 10,
        step: 0.01,
        unit: null,
        default: 1.00,
        enabledIf: { field: "hasGear8", equals: true }
      }
    ]
  },

  // ──────────────────────────────────────────────────────────────────────
  // POIDS
  // ──────────────────────────────────────────────────────────────────────
  weight: {
    label: "Poids",
    fields: [
      // NOTE : `mass` est volontairement à 1350 (≈ poids d'une S15) plutôt
      // que la médiane mathématique (2650 kg). Cohérence drift > convention.
      { id: "mass",          label: "Masse",           type: "number", min: 800, max: 4500, step: 1, unit: "kg", default: 1350 },
      { id: "transfer",      label: "Transfert",       type: "number", min: 45,  max: 60,   step: 1, unit: "%",  default: 53 },
      { id: "centerOfMass",  label: "Centre de masse", type: "number", min: 20,  max: 30,   step: 1, unit: "%",  default: 25 }
    ]
  }
};


// ─── Helpers de consultation ─────────────────────────────────────────────

/**
 * Retourne toutes les sections sous forme de tableau ordonné.
 * Utile pour itérer dans l'ordre d'affichage du formulaire.
 */
export function getSections() {
  return Object.entries(TUNING_SCHEMA).map(([id, section]) => ({
    id,
    label: section.label,
    fields: section.fields
  }));
}

/**
 * Retourne tous les champs aplatis, toutes sections confondues.
 * Utile pour validation globale ou export JSON.
 */
export function getAllFields() {
  return Object.values(TUNING_SCHEMA).flatMap(section => section.fields);
}

/**
 * Trouve un champ par son id (recherche globale toutes sections).
 */
export function getFieldById(fieldId) {
  return getAllFields().find(field => field.id === fieldId);
}

/**
 * Génère un objet "preset vierge" avec toutes les valeurs par défaut.
 * Utile pour initialiser un nouveau preset lors de la création.
 */
export function getDefaultTuning() {
  const tuning = {};
  for (const field of getAllFields()) {
    tuning[field.id] = field.default;
  }
  return tuning;
}