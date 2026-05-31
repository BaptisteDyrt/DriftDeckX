/**
 * Vue détail d'un pré-réglage — lecture seule.
 *
 * Affiche les 62 champs du tuning groupés par section dans une grille
 * 3 colonnes :
 *
 *   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
 *   │   SUSPENSION     │ │   ALIGNEMENT     │ │   TRANSMISSION   │
 *   │                  │ │                  │ │   (étendu)       │
 *   └──────────────────┘ └──────────────────┘ │                  │
 *   ┌─────────────────────────────────────┐   │                  │
 *   │              PNEUS                  │   │                  │
 *   │         (étendu sur 2 cols)         │   │                  │
 *   └─────────────────────────────────────┘   └──────────────────┘
 *   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
 *   │     FREINS       │ │     MOTEUR       │ │     POIDS        │
 *   └──────────────────┘ └──────────────────┘ └──────────────────┘
 *
 * Header au-dessus de la grille :
 *  - Brand name (lime uppercase)
 *  - Model nameReal - nameCarx (séparateur "-")
 *  - Pills des presets de la voiture (switch entre presets sans sidebar)
 *
 * 3 types de visualisation des valeurs :
 *  - Texte simple (label gauche / valeur droite, avec préfixes AV/AR si paire)
 *  - Barre de progression "simple" (lime, gauche vers droite)
 *  - Barre de progression "split" (depuis le centre, gauche OU droite)
 *
 * 7 icônes thématiques (assets/icons/icon-*.svg) à côté du titre de chaque card.
 */

import { BRANDS } from "../data/brands.js";
import { MODELS } from "../data/models.js";
import { TUNING_SCHEMA } from "../data/schema.js";
import { listPresets } from "../storage.js";
import { setActivePreset, showEditSetupForm } from "../state.js";
import { el, clear } from "../utils/dom.js";
import { openModal } from "./modal.js";
import { deletePresetWithRedirection, renamePreset } from "../services/garage.js";


// ─── Configuration des champs en "split bar" ─────────────────────────────

/**
 * IDs des champs à afficher en barre split (centre vers gauche/droite).
 * Tous les autres champs avec unité % sont en barre "simple" (lime gauche
 * → droite, valeur centrée).
 *
 * Pour l'instant, aucun champ n'utilise la split bar : tous les % (balance,
 * transfer, centerOfMass, etc.) sont en barre simple. On garde ce mécanisme
 * et le code de `renderSplitBar` au cas où on aurait besoin de la
 * réactiver pour un champ plus tard.
 */
const SPLIT_BAR_FIELDS = new Set();


// ─── Configuration des cards ─────────────────────────────────────────────

/**
 * Ordre d'affichage des cards et icône associée.
 * Le nom doit matcher une `key` de TUNING_SCHEMA (sauf "weight" qui devient
 * une card "Poids" séparée, alors que dans le schema Identification+Poids
 * sont mélangés au step 1).
 */
const CARD_CONFIG = [
  { id: "suspension",   title: "Suspension",   icon: "icon-damper.svg",    area: "suspension" },
  { id: "alignment",    title: "Alignement",   icon: "icon-alignment.svg", area: "alignment" },
  { id: "wheel",        title: "Pneus",        icon: "icon-wheel.svg",     area: "pneus" },
  { id: "brakes",       title: "Freins",       icon: "icon-brake.svg",     area: "freins" },
  { id: "engine",       title: "Moteur",       icon: "icon-engine.svg",    area: "moteur" },
  { id: "transmission", title: "Transmission", icon: "icon-gearbox.svg",   area: "transmission" },
  { id: "weight",       title: "Poids",        icon: "icon-weight.svg",    area: "poids" }
];


// ─── Helpers de formatage ────────────────────────────────────────────────

/**
 * Formate un nombre pour l'affichage : entier si pas de décimales utiles,
 * sinon 1-2 décimales selon la précision.
 *
 * Exemples : 17.5 → "17,5", 1350 → "1 350", 0 → "0"
 */
function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  // Espace fine en séparateur de milliers (style FR)
  const fixed = Number.isInteger(value)
    ? String(value)
    : value.toFixed(value % 1 === 0 ? 0 : 2).replace(/\.?0+$/, "");

  // Insère des espaces tous les 3 chiffres (millier)
  const [intPart, decPart] = fixed.split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${withSpaces},${decPart}` : withSpaces;
}

/**
 * Formate l'unité pour l'affichage à côté de la valeur (lowercase, sauf %).
 * Le formulaire affichait les unités en MAJUSCULES dans les headers (style
 * label), ici c'est l'inverse : minuscules en suffixe de valeur (style data).
 */
function formatUnit(unit) {
  if (!unit) return "";
  return unit;
}


// ─── Détection du type de visualisation ──────────────────────────────────

/**
 * Détermine le type de visualisation à utiliser pour un champ donné.
 *
 *  - "split"   : barre split (centre vers gauche/droite) → champs de
 *                répartition (balance, transfer)
 *  - "bar"     : barre simple lime → champs en % autres que ci-dessus
 *  - "boolean" : badge ON/OFF compact → champs type:boolean
 *  - "text"    : texte simple aligné à droite → tout le reste
 */
function getVisualizationType(field) {
  if (field.type === "boolean") return "boolean";
  if (SPLIT_BAR_FIELDS.has(field.id)) return "split";
  if (field.unit === "%") return "bar";
  return "text";
}


// ─── Helpers pour gérer les paires AV/AR ─────────────────────────────────

/**
 * À partir d'une liste de champs schema dont certains ont un préfixe
 * front/rear (AV/AR), retourne une liste "regroupée" où chaque paire AV+AR
 * apparaît comme une seule entrée.
 *
 * Format de retour :
 *  - Champs simples : { kind: "single", field }
 *  - Paires AV+AR   : { kind: "pair", baseId, front, rear, label }
 */
function groupAxisPairs(fields) {
  const result = [];
  const seenBaseIds = new Set();

  for (const field of fields) {
    if (field.axis === "front") {
      const baseId = field.id.slice("front".length);
      const normalizedBaseId = baseId.charAt(0).toLowerCase() + baseId.slice(1);
      if (seenBaseIds.has(normalizedBaseId)) continue;
      seenBaseIds.add(normalizedBaseId);

      const rearId = `rear${baseId}`;
      const rearField = fields.find(f => f.id === rearId);
      if (!rearField) continue;

      result.push({
        kind: "pair",
        baseId: normalizedBaseId,
        front: field,
        rear: rearField,
        // Retire le suffixe "(avant)" du label pour avoir juste "Longueur"
        label: field.label.replace(/\s*\(avant\)\s*$/i, "")
      });
    } else if (field.axis === "rear") {
      continue;
    } else {
      result.push({ kind: "single", field });
    }
  }

  return result;
}


// ─── Rendu : valeur formatée selon son type ──────────────────────────────

/**
 * Rend la valeur d'un champ "text" : nombre formaté + unité + préfixe AV/AR
 * optionnel (affiché APRÈS la valeur, contrairement au formulaire).
 *
 * Exemple : "17.5 av"
 */
function renderTextValue(value, unit, axisLabel = null) {
  return el("span", { class: "preset-value preset-value--text" }, [
    el("span", { class: "preset-value__number" }, formatNumber(value)),
    unit
      ? el("span", { class: "preset-value__unit" }, " " + formatUnit(unit))
      : null,
    axisLabel
      ? el("span", { class: "preset-value__axis" }, " " + axisLabel.toLowerCase())
      : null
  ]);
}

/**
 * Rend une barre de progression "simple" : remplit de gauche vers droite
 * en lime. La valeur en % est affichée dans la barre.
 *
 * Le pourcentage de remplissage est calculé entre min et max du schema :
 *  - value=min → 0% rempli
 *  - value=max → 100% rempli
 *  - value au milieu → 50% rempli
 *
 * Utilisé pour : powerLock, coastLock, ackermann, grip, balance, etc.
 */
function renderSimpleBar(value, field) {
  const min = field.min;
  const max = field.max;
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const percent = Math.round(ratio * 100);

  return el("div", { class: "preset-bar preset-bar--simple" }, [
    el("div", {
      class: "preset-bar__fill",
      style: { width: `${percent}%` }
    }),
    el("span", { class: "preset-bar__label" }, [
      el("span", { class: "preset-bar__number" }, formatNumber(value)),
      el("span", { class: "preset-bar__unit" }, " " + formatUnit(field.unit))
    ])
  ]);
}

/**
 * Rend une barre "split" pour les champs de répartition (50% = équilibre).
 *
 * Le visuel : 2 demi-barres séparées par un trait au centre. Si la valeur
 * est <50%, la gauche se remplit. Si >50%, la droite se remplit.
 * Les 2 valeurs sont affichées : à gauche (value) et à droite (100 - value).
 *
 * Utilisé pour : balance (Répartition freins), transfer (Transfert poids).
 */
function renderSplitBar(value, field) {
  // Pour balance et transfer, value est le % "côté droit"
  // Ex: balance=75 → AV=25%, AR=75%
  const right = value;
  const left = 100 - value;

  return el("div", { class: "preset-bar preset-bar--split" }, [
    // Demi-barre gauche : se remplit de droite vers gauche (depuis le centre)
    el("div", { class: "preset-bar__half preset-bar__half--left" }, [
      el("span", { class: "preset-bar__half-label" },
        `${formatNumber(left)}${formatUnit(field.unit)}`),
      el("div", {
        class: "preset-bar__half-fill preset-bar__half-fill--left",
        style: { width: `${left}%` }
      })
    ]),
    // Demi-barre droite : se remplit de gauche vers droite (depuis le centre)
    el("div", { class: "preset-bar__half preset-bar__half--right" }, [
      el("div", {
        class: "preset-bar__half-fill preset-bar__half-fill--right",
        style: { width: `${right}%` }
      }),
      el("span", { class: "preset-bar__half-label" },
        `${formatNumber(right)}${formatUnit(field.unit)}`)
    ])
  ]);
}

/**
 * Rend un badge ON/OFF pour les champs boolean.
 *
 * En lecture seule, plus besoin du toggle complet : un badge compact suffit
 * à indiquer l'état.
 *
 * Le badge a 2 variants :
 *  - on  : fond lime, texte foncé
 *  - off : fond transparent, texte gris
 */
function renderBooleanBadge(value) {
  const isOn = value === true;
  return el("span", {
    class: `preset-badge preset-badge--${isOn ? "on" : "off"}`
  }, isOn ? "ON" : "OFF");
}


// ─── Rendu : une ligne de champ (label + valeur(s)) ──────────────────────

/**
 * Rend une ligne pour un champ "single" (non-AV/AR).
 *
 * Layout : label à gauche, visualisation à droite.
 *
 * Cas particulier des champs conditionnels désactivés (enabledIf non remplie) :
 *  - Au lieu d'afficher la valeur, on affiche "—" (placeholder neutre)
 *  - Le label reste visible pour que l'user voie que le champ existe mais
 *    n'est pas utilisé sur ce preset
 *
 * Pour les champs boolean dont la condition n'est pas remplie (ex: hasGear8
 * quand hasGear7 est OFF), on n'affiche RIEN du tout (la ligne est masquée
 * dans renderTransmissionCard via filtrage en amont).
 */
function renderSingleRow(field, tuning) {
  const value = tuning[field.id];
  const vizType = getVisualizationType(field);

  // Champ conditionnel désactivé → afficher "—" comme demandé
  if (!isFieldEnabledInTuning(field, tuning) && vizType !== "boolean") {
    return el("div", { class: "preset-row preset-row--disabled" }, [
      el("span", { class: "preset-row__label" }, field.label),
      el("span", { class: "preset-row__value preset-row__value--dash" }, "—")
    ]);
  }

  let valueEl;
  if (vizType === "boolean") {
    valueEl = renderBooleanBadge(value);
  } else if (vizType === "split") {
    valueEl = renderSplitBar(value, field);
  } else if (vizType === "bar") {
    valueEl = renderSimpleBar(value, field);
  } else {
    valueEl = renderTextValue(value, field.unit);
  }

  return el("div", { class: `preset-row preset-row--${vizType}` }, [
    el("span", { class: "preset-row__label" }, field.label),
    el("span", { class: "preset-row__value" }, valueEl)
  ]);
}

/**
 * Rend une ligne pour une paire AV+AR.
 *
 * Layout : label à gauche, valeur AV + valeur AR à droite (chacune avec son
 * préfixe "av" / "ar" en minuscules après la valeur).
 *
 * Exemple : "Longueur                17.5 av    17.5 ar"
 *
 * @param {object} pair
 * @param {object} tuning
 * @param {object} [options]
 * @param {boolean} [options.hideUnit] - Si true, n'affiche pas l'unité à
 *   côté de chaque valeur (utile pour Suspension où l'on garde uniquement
 *   AV/AR pour ne pas surcharger visuellement). L'unité globale du champ
 *   reste connue via le label si besoin.
 */
function renderPairRow(pair, tuning, options = {}) {
  const frontValue = tuning[pair.front.id];
  const rearValue = tuning[pair.rear.id];
  const unitOrNull = options.hideUnit ? null : pair.front.unit;

  return el("div", { class: "preset-row preset-row--pair" }, [
    el("span", { class: "preset-row__label" }, pair.label),
    el("span", { class: "preset-row__value preset-row__value--pair" }, [
      renderTextValue(frontValue, unitOrNull, "AV"),
      renderTextValue(rearValue, unitOrNull, "AR")
    ])
  ]);
}


// ─── isFieldEnabled (copie locale pour découpler de form.js) ─────────────

/**
 * Évalue si un champ avec enabledIf est actif dans le tuning donné.
 * Récursif pour gérer les cascades (V8 dépend de hasGear8 dépend de hasGear7).
 *
 * Note : on duplique cette logique depuis form.js (qui lit formState.draft)
 * parce qu'ici on a besoin de l'évaluer sur un preset stocké (tuning passé
 * en argument). Si on factorise plus tard, on pourra mettre cette fonction
 * dans utils/.
 */
function isFieldEnabledInTuning(field, tuning) {
  if (!field.enabledIf) return true;
  const { field: depFieldId, equals } = field.enabledIf;
  if (tuning[depFieldId] !== equals) return false;

  // Cascade : la dépendance doit être elle-même active
  for (const section of Object.values(TUNING_SCHEMA)) {
    const depField = section.fields.find(f => f.id === depFieldId);
    if (depField) {
      return isFieldEnabledInTuning(depField, tuning);
    }
  }
  return true;
}


// ─── Cards spécifiques (certaines ont une logique custom) ────────────────

/**
 * Rend la card "Pneus" avec la synthèse "Size" en première ligne.
 *
 * "Size" est une combinaison de 3 champs schema :
 *   width / profile R diameter  →  ex: "245 / 35 R19"
 *
 * Donc on retire les 3 champs originaux (width, profile, diameter) du rendu
 * pour les remplacer par la ligne Size synthétisée. Les autres champs
 * (pressure, grip, wheelbase, offset) sont affichés normalement après.
 *
 * Ordre final (validé sur le design) :
 *   1. Size (combo, AV+AR)
 *   2. Pression (AV+AR)
 *   3. Adhérence (AV+AR)
 *   4. Empattement (AV+AR)
 *   5. Écart (AV+AR)
 */
function renderWheelCardRows(tuning) {
  const rows = [];

  // 1. Ligne "Size" : combinaison Width / Profile R Diameter
  rows.push(renderSizeRow(tuning));

  // 2. Autres champs : on parcourt les paires en sautant width/profile/diameter.
  // Comme pour Suspension, on masque les unités à côté des valeurs AV/AR.
  // L'unité reste connue via le label de la card "Pneus" (kPa, %, mm) et est
  // déjà implicite pour le pilote.
  const fields = TUNING_SCHEMA.wheel.fields;
  const skipBaseIds = new Set(["width", "profile", "diameter"]);
  const pairs = groupAxisPairs(fields);

  for (const item of pairs) {
    if (item.kind === "pair" && skipBaseIds.has(item.baseId)) continue;
    if (item.kind === "pair") {
      rows.push(renderPairRow(item, tuning, { hideUnit: true }));
    } else {
      rows.push(renderSingleRow(item.field, tuning));
    }
  }

  return rows;
}

/**
 * Rend la ligne "Size" synthétisée pour la card Pneus.
 *
 * Format : "245 / 35 R19" pour chaque côté (AV + AR).
 * Les 3 champs (width, profile, diameter) sont combinés en une seule
 * chaîne formattée.
 */
function renderSizeRow(tuning) {
  const formatSize = (width, profile, diameter) =>
    `${formatNumber(width)} / ${formatNumber(profile)} R${formatNumber(diameter)}`;

  const front = formatSize(
    tuning.frontWidth,
    tuning.frontProfile,
    tuning.frontDiameter
  );
  const rear = formatSize(
    tuning.rearWidth,
    tuning.rearProfile,
    tuning.rearDiameter
  );

  return el("div", { class: "preset-row preset-row--pair" }, [
    el("span", { class: "preset-row__label" }, "Size"),
    el("span", { class: "preset-row__value preset-row__value--pair" }, [
      el("span", { class: "preset-value preset-value--text" }, [
        el("span", { class: "preset-value__number" }, front),
        el("span", { class: "preset-value__axis" }, " av")
      ]),
      el("span", { class: "preset-value preset-value--text" }, [
        el("span", { class: "preset-value__number" }, rear),
        el("span", { class: "preset-value__axis" }, " ar")
      ])
    ])
  ]);
}


/**
 * Rend la card "Poids" en fusionnant les 3 champs du schema (mass, transfer,
 * centerOfMass) qui dans le schema sont dans la section "weight".
 *
 * Tous les champs sont single (non AV/AR).
 */
function renderWeightCardRows(tuning) {
  return TUNING_SCHEMA.weight.fields.map(field => renderSingleRow(field, tuning));
}


/**
 * Rend la card "Moteur".
 *
 * Particularité : le champ booléen "turbo" est rendu sur la même ligne que
 * son label (pas dans une grosse ligne séparée comme dans le formulaire),
 * suivi de la valeur de "Pression" (turboPressure) qui dépend de turbo.
 *
 * Si turbo = OFF, on affiche "Turbo OFF" + Pression "—".
 * Si turbo = ON, on affiche "Turbo ON 1.20 atm".
 */
function renderEngineCardRows(tuning) {
  const rows = [];

  for (const field of TUNING_SCHEMA.engine.fields) {
    if (field.id === "turboPressure") {
      // Ligne spéciale : Turbo + Pression combinés
      rows.push(renderTurboRow(tuning));
      continue;
    }
    if (field.id === "turbo") continue; // Inclus dans turboPressure
    rows.push(renderSingleRow(field, tuning));
  }

  return rows;
}

/**
 * Rend la ligne "Turbo" qui combine le badge ON/OFF avec la valeur de
 * Pression (si Turbo ON) ou "—" (si Turbo OFF).
 *
 * Format final :
 *   Turbo    [ON] 1.20 atm
 *   Turbo    [OFF] —
 */
function renderTurboRow(tuning) {
  const turboOn = tuning.turbo === true;
  const pressure = tuning.turboPressure;
  const pressureField = TUNING_SCHEMA.engine.fields.find(f => f.id === "turboPressure");

  return el("div", { class: "preset-row preset-row--turbo" }, [
    el("span", { class: "preset-row__label" }, "Turbo"),
    el("span", { class: "preset-row__value" }, [
      renderBooleanBadge(turboOn),
      turboOn
        ? renderTextValue(pressure, pressureField.unit)
        : el("span", { class: "preset-value__dash" }, " —")
    ])
  ]);
}


/**
 * Rend la card "Transmission".
 *
 * Particularités :
 *  - Les toggles V7/V8 (hasGear7, hasGear8) sont rendus avec leur badge
 *    sur la même ligne que leur valeur de gear correspondante.
 *  - Format : "V7 [ON] 2.8" ou "V8 [OFF] —"
 *
 * Ordre validé sur le design :
 *   Préchargement, Blocage puissance, Blocage roues libres, Finale,
 *   V1, V2, V3, V4, V5, V6, V7 (+ badge), V8 (+ badge)
 */
function renderTransmissionCardRows(tuning) {
  const rows = [];

  for (const field of TUNING_SCHEMA.transmission.fields) {
    // Toggles : on les ignore ici, ils sont fusionnés avec leur gear correspondant
    if (field.id === "hasGear7" || field.id === "hasGear8") continue;

    // Gears 7 et 8 : ligne combinée avec leur toggle
    if (field.id === "gear7") {
      rows.push(renderGearWithBadge(tuning, "V7", "hasGear7", "gear7", field));
      continue;
    }
    if (field.id === "gear8") {
      rows.push(renderGearWithBadge(tuning, "V8", "hasGear8", "gear8", field));
      continue;
    }

    rows.push(renderSingleRow(field, tuning));
  }

  return rows;
}

/**
 * Rend une ligne pour V7 ou V8 : label + badge ON/OFF + valeur.
 *
 * Si le toggle est OFF (ou désactivé en cascade), la valeur est remplacée
 * par "—" pour signifier qu'elle n'est pas utilisée par CarX.
 */
function renderGearWithBadge(tuning, label, toggleId, gearId, gearField) {
  const isOn = tuning[toggleId] === true;
  // Vérifier aussi la cascade (gear8 OFF si hasGear7 OFF même si hasGear8 true)
  const enabled = isFieldEnabledInTuning(gearField, tuning);

  return el("div", { class: "preset-row preset-row--gear" }, [
    el("span", { class: "preset-row__label" }, label),
    el("span", { class: "preset-row__value preset-row__value--gear" }, [
      renderBooleanBadge(isOn && enabled),
      enabled
        ? renderTextValue(tuning[gearId], gearField.unit)
        : el("span", { class: "preset-value__dash" }, " —")
    ])
  ]);
}


// ─── Rendu : Card générique ──────────────────────────────────────────────

/**
 * Rend une card complète : header (icône + titre) + body (rows).
 *
 * Le body est calculé selon le type de section :
 *  - "wheel"        → renderWheelCardRows (avec synthèse Size)
 *  - "weight"       → renderWeightCardRows
 *  - "engine"       → renderEngineCardRows (avec turbo combiné)
 *  - "transmission" → renderTransmissionCardRows (avec V7/V8 combinés)
 *  - autres         → groupAxisPairs + rendu standard
 */
function renderCard(config, tuning) {
  let rows;

  if (config.id === "wheel") {
    rows = renderWheelCardRows(tuning);
  } else if (config.id === "weight") {
    rows = renderWeightCardRows(tuning);
  } else if (config.id === "engine") {
    rows = renderEngineCardRows(tuning);
  } else if (config.id === "transmission") {
    rows = renderTransmissionCardRows(tuning);
  } else {
    // Rendu générique (suspension, alignment, brakes).
    // Pour Suspension uniquement : on masque les unités à côté des valeurs
    // AV/AR pour alléger visuellement (les 7 lignes ont des unités N.sec/m
    // qui prennent beaucoup de place et n'apportent pas d'info utile au
    // pilote habitué à ces réglages).
    const pairs = groupAxisPairs(TUNING_SCHEMA[config.id].fields);
    const pairOptions = { hideUnit: config.id === "suspension" };

    rows = pairs.map(item =>
      item.kind === "pair"
        ? renderPairRow(item, tuning, pairOptions)
        : renderSingleRow(item.field, tuning)
    );
  }

  return el("section", {
    class: "preset-card",
    style: { gridArea: config.area }
  }, [
    el("header", { class: "preset-card__header" }, [
      el("img", {
        src: `./assets/icons/${config.icon}`,
        alt: "",
        class: "preset-card__icon",
        "aria-hidden": "true",
        width: "16",
        height: "16"
      }),
      el("h2", { class: "preset-card__title" }, config.title)
    ]),
    // Pour Pneus : layout interne en 2 colonnes (auto-flow column), parce
    // que la card s'étend sur 2 cols du layout global et qu'elle a peu
    // de lignes (5 champs après synthèse Size). Pour les autres cards :
    // layout vertical par défaut.
    el("div", {
      class: `preset-card__body${config.id === "wheel" ? " preset-card__body--cols-2" : ""}`
    }, rows)
  ]);
}


// ─── Rendu : Header (brand + model + pills + actions) ───────────────────

/**
 * Rend le header de la vue : brand uppercase lime, modèle (nameReal -
 * nameCarx), et une ligne d'outils contenant à gauche les pills des
 * presets de la voiture, à droite la barre d'actions (Exporter, Modifier
 * dropdown, Supprimer).
 *
 * Structure visuelle :
 *
 *   NISSAN
 *   400Z
 *   [Oyakata] [Piste Longue] [Piste Courte]    [Exporter] [Modifier ▾] [🗑]
 *   ←─── pills ────────────────────────────→  ←──── actions ─────────→
 *
 * Les pills permettent de switcher entre les presets de la voiture sans
 * passer par la sidebar. Le preset actif a un fond lime + bordure.
 */
function renderHeader(preset, allCarPresets) {
  const model = MODELS.find(m => m.id === preset.modelId);
  const brand = model ? BRANDS.find(b => b.id === model.brandId) : null;

  if (!model || !brand) {
    return el("header", { class: "preset-header" }, [
      el("h1", { class: "preset-header__title" }, "Préréglage")
    ]);
  }

  return el("header", { class: "preset-header" }, [
    el("p", { class: "preset-header__brand" }, brand.name.toUpperCase()),
    el("h1", { class: "preset-header__title" }, [
      el("span", {}, model.nameReal),
      el("span", { class: "preset-header__separator" }, " - "),
      el("span", {}, model.nameCarx)
    ]),
    // Toolbar : pills à gauche, actions à droite (justify-between en CSS)
    el("div", { class: "preset-header__toolbar" }, [
      el("div", { class: "preset-header__pills" },
        allCarPresets.map(p =>
          el("button", {
            type: "button",
            class: `preset-pill${p.id === preset.id ? " preset-pill--active" : ""}`,
            onClick: () => {
              if (p.id !== preset.id) setActivePreset(p.id);
            }
          }, p.name)
        )
      ),
      renderActionsBar(preset)
    ])
  ]);
}


/**
 * Rend la barre d'actions à droite du header : Exporter (primary lime),
 * Modifier le réglage (secondary lime atténué, avec dropdown), Supprimer
 * (square rouge avec icône poubelle).
 *
 * @param {object} preset - preset actif (nécessaire pour les actions)
 */
function renderActionsBar(preset) {
  return el("div", { class: "preset-actions" }, [
    // ─── Exporter ───────────────────────────────────────────────────
 /*    el("button", {
      type: "button",
      class: "preset-action preset-action--primary",
      onClick: () => {
        console.log("[preset-view] Exporter :", preset.id);
        // TODO : implémentation export → services/export.js
      }
    }, [Ò
      el("img", {
        src: "./assets/icons/icon-download.svg",
        alt: "",
        class: "preset-action__icon",
        "aria-hidden": "true",
        width: "16",
        height: "16"
      }),
      el("span", { class: "preset-action__label" }, "Exporter")
    ]), */

    // ─── Modifier le réglage (avec dropdown) ────────────────────────
    renderEditDropdown(preset),

    // ─── Supprimer (carré rouge) ────────────────────────────────────
    el("button", {
      type: "button",
      class: "preset-action preset-action--danger",
      "aria-label": "Supprimer le préréglage",
      onClick: () => openDeleteModal(preset)
    }, [
      el("img", {
        src: "./assets/icons/icon-delete.svg",
        alt: "",
        class: "preset-action__icon",
        "aria-hidden": "true",
        width: "16",
        height: "16"
      })
    ])
  ]);
}


/**
 * Ouvre la modale de confirmation de suppression d'un preset.
 *
 * Sécurité UX : l'user doit taper exactement le nom du preset pour activer
 * le bouton "Supprimer définitivement" (mode strict — case et espaces
 * sensibles, comme GitHub pour la suppression de repo).
 *
 * Au confirm : la suppression + redirection cascade sont déléguées au
 * service garage.js. Pas de feedback visuel après suppression (décision
 * UX validée : la disparition du preset de la sidebar est suffisante).
 *
 * @param {object} preset - le preset à supprimer
 */
function openDeleteModal(preset) {
  openModal({
    title: "Supprimer le pré-réglage ?",
    message: [
      el("p", {}, [
        "Cette action est ",
        el("strong", {}, "irréversible"),
        ". Pour confirmer, tapez le nom du pré-réglage :"
      ]),
      el("p", { class: "modal__message-emphasis" }, preset.name)
    ],
    input: {
      placeholder: preset.name,
      expectedValue: preset.name,
      strict: true
    },
    confirmText: "Supprimer définitivement",
    cancelText: "Annuler",
    danger: true,
    onConfirm: async () => {
      try {
        await deletePresetWithRedirection(preset.id);
      } catch (error) {
        console.error("[preset-view] Erreur lors de la suppression :", error);
        alert("Erreur lors de la suppression du pré-réglage.");
      }
    }
  });
}


/**
 * Ouvre la modale de renommage d'un preset.
 *
 * Mode "saisie libre" :
 *  - Input pré-rempli avec le nom actuel, tout sélectionné à l'ouverture
 *    (l'user peut taper directement par-dessus pour remplacer)
 *  - Bouton "Mettre à jour" disabled tant que le champ est vide
 *  - Message d'erreur si > 30 caractères (limite cohérente avec le form
 *    d'ajout)
 *  - Enter dans l'input = click sur "Mettre à jour" (si valide)
 *
 * Au confirm : appel à renamePreset() via le service garage, qui s'occupe
 * de la mise à jour du storage + du refresh de la vue détail et de la
 * sidebar via state.
 *
 * @param {object} preset - le preset à renommer
 */
function openRenameModal(preset) {
  openModal({
    title: "Renommer le pré-réglage",
    input: {
      initialValue: preset.name,
      maxLength: 30,
      placeholder: "Nom du pré-réglage"
    },
    confirmText: "Mettre à jour",
    cancelText: "Annuler",
    onConfirm: async (newName) => {
      // Si l'user n'a rien changé (juste fermé en confirmant le même nom),
      // on évite un update inutile qui modifierait updatedAt sans raison.
      if (newName.trim() === preset.name) return;

      try {
        await renamePreset(preset.id, newName);
      } catch (error) {
        console.error("[preset-view] Erreur lors du renommage :", error);
        alert("Erreur lors du renommage du pré-réglage.");
      }
    }
  });
}


/**
 * Rend le bouton "Modifier le réglage" qui ouvre un dropdown avec 2 options :
 *   - Renommer
 *   - Éditer le réglage
 *
 * Le dropdown apparaît juste en dessous du bouton, fait la même largeur que
 * le bouton parent, et se ferme :
 *   - Au click extérieur (event listener sur document)
 *   - Au click sur une option (action déclenchée)
 *   - À l'appui sur Escape
 *
 * On gère l'état ouvert/fermé directement via les classes CSS, pas dans
 * un state global — le dropdown est éphémère et isolé à cette vue.
 *
 * @param {object} preset - preset actif (nécessaire pour les actions)
 */
function renderEditDropdown(preset) {
  // Le wrapper contient le bouton ET le menu (positionné en absolute dessous)
  const wrapper = el("div", { class: "preset-action-dropdown" });

  // Bouton trigger : icône + label + chevron
  const trigger = el("button", {
    type: "button",
    class: "preset-action preset-action--secondary",
    "aria-haspopup": "menu",
    "aria-expanded": "false",
    onClick: (e) => {
      e.stopPropagation();
      toggleDropdown(wrapper);
    }
  }, [
    el("img", {
      src: "./assets/icons/icon-edit.svg",
      alt: "",
      class: "preset-action__icon",
      "aria-hidden": "true",
      width: "16",
      height: "16"
    }),
    el("span", { class: "preset-action__label" }, "Modifier le réglage")
  ]);

  // Menu déroulant : 2 options
  const menu = el("div", {
    class: "preset-action-menu",
    role: "menu",
    "aria-hidden": "true"
  }, [
    el("button", {
      type: "button",
      class: "preset-action-menu__item",
      role: "menuitem",
      onClick: () => {
        closeAllDropdowns();
        openRenameModal(preset);
      }
    }, "Renommer"),
    el("button", {
      type: "button",
      class: "preset-action-menu__item",
      role: "menuitem",
      onClick: () => {
        closeAllDropdowns();
        showEditSetupForm(preset.id, preset.modelId);
      }
    }, "Éditer le réglage")
  ]);

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  return wrapper;
}


/**
 * Bascule l'état ouvert/fermé d'un dropdown. Ferme tous les autres
 * dropdowns ouverts avant d'ouvrir celui-ci (un seul à la fois).
 */
function toggleDropdown(wrapper) {
  const isOpen = wrapper.classList.contains("preset-action-dropdown--open");
  closeAllDropdowns();
  if (!isOpen) openDropdown(wrapper);
}

function openDropdown(wrapper) {
  wrapper.classList.add("preset-action-dropdown--open");
  const trigger = wrapper.querySelector(".preset-action--secondary");
  const menu = wrapper.querySelector(".preset-action-menu");
  if (trigger) trigger.setAttribute("aria-expanded", "true");
  if (menu) menu.setAttribute("aria-hidden", "false");
}

function closeAllDropdowns() {
  document.querySelectorAll(".preset-action-dropdown--open").forEach(wrapper => {
    wrapper.classList.remove("preset-action-dropdown--open");
    const trigger = wrapper.querySelector(".preset-action--secondary");
    const menu = wrapper.querySelector(".preset-action-menu");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (menu) menu.setAttribute("aria-hidden", "true");
  });
}


// ─── Listeners globaux pour la fermeture des dropdowns ───────────────────

/**
 * Pose les listeners globaux (une seule fois au chargement du module) pour
 * fermer les dropdowns au click extérieur ou à l'appui sur Escape.
 *
 * Le listener est posé au niveau document avec un guard : si le click vient
 * d'un dropdown ouvert (intérieur), on laisse passer (le toggleDropdown
 * gère le close lui-même via stopPropagation au click extérieur).
 */
if (typeof document !== "undefined" && !globalThis.__driftDeckXDropdownListenersInstalled) {
  globalThis.__driftDeckXDropdownListenersInstalled = true;

  document.addEventListener("click", (e) => {
    // Si le click est dans un dropdown ouvert, ne pas fermer
    if (e.target.closest(".preset-action-dropdown--open")) return;
    closeAllDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDropdowns();
  });
}


// ─── API publique ────────────────────────────────────────────────────────

/**
 * Monte la vue détail d'un preset dans le main panel.
 *
 * Lit le preset depuis le storage via son id (passé en argument), et tous
 * les presets de la même voiture pour afficher les pills.
 *
 * @param {HTMLElement} mountPoint - <main id="main-panel">
 * @param {string} presetId - id du preset à afficher
 */
export async function mountPresetView(mountPoint, presetId) {
  clear(mountPoint);

  // Charger le preset + tous les presets de la même voiture pour les pills
  const allPresets = await listPresets();
  const preset = allPresets.find(p => p.id === presetId);

  if (!preset) {
    // Cas d'erreur : preset supprimé ou id invalide
    mountPoint.appendChild(
      el("section", { class: "preset-view" }, [
        el("p", { class: "preset-view__error" }, "Préréglage introuvable.")
      ])
    );
    return;
  }

  const carPresets = allPresets.filter(p => p.modelId === preset.modelId);

  // Container racine
  const view = el("section", { class: "preset-view" }, [
    renderHeader(preset, carPresets),
    el("div", { class: "preset-grid" },
      CARD_CONFIG.map(config => renderCard(config, preset.tuning))
    )
  ]);

  mountPoint.appendChild(view);
}